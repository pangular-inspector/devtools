import {
  CD_SPAN_KIND,
  MAX_RAW_SPANS,
  createSpanNames,
  createTimingTable,
  hookName,
  keepLongest,
  listenerName,
  type RawSpan,
} from './cd-timing.ts';
import type {
  CdAfterRenderStat,
  CdCheck,
  CdComponentStat,
  CdCycle,
  CdRecording,
  CdReport,
} from './config.ts';
import { createRefreshTracker } from './cd-refresh.ts';
import { className } from './injector-tree.ts';

/**
 * Angular's `ProfilerEvent` values that the recorder reads, checked against
 * the enum in `@angular/core/fesm2022/_debug_node-chunk.mjs` (Angular 22).
 */
export const PROFILER_EVENT = {
  TemplateUpdateStart: 2,
  LifecycleHookStart: 4,
  LifecycleHookEnd: 5,
  OutputStart: 6,
  OutputEnd: 7,
  ChangeDetectionStart: 12,
  ChangeDetectionEnd: 13,
  ChangeDetectionSyncStart: 14,
  ChangeDetectionSyncEnd: 15,
  AfterRenderHooksStart: 16,
  AfterRenderHooksEnd: 17,
  ComponentStart: 18,
  ComponentEnd: 19,
} as const;

const TOP_PER_CYCLE = 10;
/** Component classes a snapshot lists, by self time. */
export const MAX_COMPONENTS = 100;
/** Component classes the recorder keeps totals for. */
const MAX_TRACKED_CLASSES = MAX_COMPONENTS * 10;
/** Component instances the recorder counts checks for. */
export const MAX_HOSTS = 2000;
const MAX_NESTED = 10;
/** Open hooks or outputs past this depth are dropped, in case an end event never comes. */
const MAX_OPEN = 50;
/**
 * How long after an output listener ends a tick can still be credited to it.
 * Zone.js ticks right after the listener and the zoneless scheduler within a
 * frame; a later tick came from something else, such as a timer or HTTP.
 */
export const OUTPUT_TRIGGER_MS = 50;

export type { CdCheck, CdComponentStat, CdCycle, CdRecording, CdReport };

type Ctor = object;

interface RawCycle {
  id: number;
  at: number;
  start: number;
  ms: number;
  passes: number;
  trigger?: string;
  checks: Map<Ctor, { checks: number; ms: number }>;
  hookMs: number;
  afterRenderMs: number;
  outputMs: number;
  spans: RawSpan[];
  droppedSpans: number;
}

interface Frame {
  start: number;
  children: number;
}

interface HookFrame {
  start: number;
  instance: unknown;
  hook: unknown;
}

interface OutputFrame {
  start: number;
  children: number;
  owner: unknown;
  listener: unknown;
}

function nameOf(instance: unknown): string {
  const ctor = (instance as { constructor?: Ctor } | null)?.constructor;
  return typeof ctor === 'function' ? className(ctor as { name?: string }) : '?';
}

function triggerText(
  trigger: { owner: unknown; listener: unknown } | undefined,
): string | undefined {
  if (!trigger) return undefined;
  const owner = nameOf(trigger.owner);
  const listener = listenerName(trigger.listener);
  return listener ? `${owner} (${listener})` : owner;
}

const round = (ms: number) => Math.round(ms * 100) / 100;
const ctorOf = (instance: unknown): Ctor | null => {
  const ctor = (instance as { constructor?: unknown } | null)?.constructor;
  return typeof ctor === 'function' ? ctor : null;
};

/**
 * Records change detection cycles from Angular's profiler. `onEvent` keeps
 * classes, numbers and weak references to instances; names and ids are built
 * in `snapshot`.
 */
export function createCdRecorder(options: {
  maxCycles: number;
  now?: () => number;
  clock?: () => number;
}) {
  const now = options.now ?? (() => performance.now());
  const clock = options.clock ?? Date.now;
  let recording = false;
  let startedAt: number | null = null;
  let seq = 0;
  let dropped = 0;
  let cycles: RawCycle[] = [];
  let current: RawCycle | null = null;
  let stack: Frame[] = [];
  // Cycles a nested tick interrupted, such as a recursive `ApplicationRef.tick`
  // that Angular starts and ends before throwing. They resume when it ends.
  let outer: { cycle: RawCycle; stack: Frame[] }[] = [];
  let lastOutput: { owner: unknown; listener: unknown; endedAt?: number } | undefined;
  // Lifecycle hooks, outputs and afterRender callbacks, timed with their own stacks.
  let hookStack: HookFrame[] = [];
  let outputStack: OutputFrame[] = [];
  let afterRenderStart: number | null = null;
  // The last output listener that ran outside a cycle, with its time, for the next cycle.
  let lastTopOutput: { start: number; ms: number; label: string } | undefined;
  let perfStart = 0;
  const hookTable = createTimingTable();
  const outputTable = createTimingTable();
  let afterRender: CdAfterRenderStat = { runs: 0, ms: 0, maxMs: 0 };
  let totals = new Map<Ctor, CdComponentStat & { lastCycle: number }>();
  let perInstance = new WeakMap<object, number>();
  let instances: WeakRef<object>[] = [];
  let prunedCycle = 0;
  // Classes and instances checked past the caps, each counted once. An
  // untracked instance keeps its checks so they carry over if a slot frees up.
  let untrackedClasses = new WeakSet<Ctor>();
  let untrackedClassCount = 0;
  let untrackedHosts = new WeakMap<object, number>();
  let untrackedHostCount = 0;
  // Which component pairs were real checks: the template ran, outside the checkNoChanges pass.
  const refresh = createRefreshTracker();

  const addSpan = (span: Omit<RawSpan, 'start'> & { at: number }) => {
    if (!current) return;
    if (current.spans.length >= MAX_RAW_SPANS) {
      current.droppedSpans++;
      return;
    }
    const { at, ...rest } = span;
    current.spans.push({ ...rest, start: at - current.start });
  };

  const onEvent = (event: number, instance?: unknown, hook?: unknown) => {
    if (!recording) return;
    const refreshed = refresh.onEvent(event, instance);
    switch (event) {
      case PROFILER_EVENT.OutputStart:
        if (!current) lastOutput = { owner: instance, listener: hook };
        outputStack.push({ start: now(), children: 0, owner: instance, listener: hook });
        if (outputStack.length > MAX_OPEN) outputStack.shift();
        return;
      case PROFILER_EVENT.OutputEnd: {
        const end = now();
        if (!current && lastOutput) lastOutput.endedAt = end;
        const frame = outputStack.pop();
        if (!frame) return;
        const total = end - frame.start;
        const parent = outputStack.at(-1);
        if (parent) parent.children += total;
        const ctor = ctorOf(frame.owner);
        if (ctor)
          outputTable.add(ctor, listenerName(frame.listener), Math.max(0, total - frame.children));
        const label = triggerText({ owner: frame.owner, listener: frame.listener }) ?? '?';
        if (current) {
          addSpan({
            ctor: null,
            label,
            at: frame.start,
            ms: total,
            depth: stack.length + hookStack.length,
            kind: CD_SPAN_KIND.output,
          });
        } else if (!parent) {
          lastTopOutput = { start: frame.start, ms: total, label };
        }
        return;
      }
      case PROFILER_EVENT.LifecycleHookStart:
        hookStack.push({ start: now(), instance, hook });
        if (hookStack.length > MAX_OPEN) hookStack.shift();
        return;
      case PROFILER_EVENT.LifecycleHookEnd: {
        const frame = hookStack.pop();
        if (!frame) return;
        const ms = now() - frame.start;
        const ctor = ctorOf(frame.instance);
        if (!ctor) return;
        const name = hookName(frame.instance, frame.hook);
        hookTable.add(ctor, name, ms);
        if (!current) return;
        // Nested hooks are already in the time of the hook that runs them.
        if (!hookStack.length) current.hookMs += ms;
        addSpan({
          ctor,
          label: name,
          at: frame.start,
          ms,
          depth: stack.length + hookStack.length,
          kind: CD_SPAN_KIND.hook,
        });
        return;
      }
      case PROFILER_EVENT.AfterRenderHooksStart:
        if (current) afterRenderStart = now();
        return;
      case PROFILER_EVENT.AfterRenderHooksEnd: {
        if (!current || afterRenderStart === null) return;
        const ms = now() - afterRenderStart;
        current.afterRenderMs += ms;
        afterRender.runs++;
        afterRender.ms += ms;
        afterRender.maxMs = Math.max(afterRender.maxMs, ms);
        addSpan({
          ctor: null,
          label: 'afterRender',
          at: afterRenderStart,
          ms,
          depth: stack.length,
          kind: CD_SPAN_KIND.afterRender,
        });
        afterRenderStart = null;
        return;
      }
      case PROFILER_EVENT.ChangeDetectionStart: {
        const start = now();
        if (lastOutput?.endedAt !== undefined && start - lastOutput.endedAt > OUTPUT_TRIGGER_MS) {
          lastOutput = undefined;
          lastTopOutput = undefined;
        }
        if (current) {
          outer.push({ cycle: current, stack });
          if (outer.length > MAX_NESTED) outer.shift();
        }
        const trigger = triggerText(lastOutput);
        const output = trigger ? lastTopOutput : undefined;
        current = {
          id: ++seq,
          at: clock(),
          start,
          ms: 0,
          passes: 0,
          trigger,
          checks: new Map(),
          hookMs: 0,
          afterRenderMs: 0,
          outputMs: output?.ms ?? 0,
          spans: [],
          droppedSpans: 0,
        };
        if (output) {
          addSpan({
            ctor: null,
            label: output.label,
            at: output.start,
            ms: output.ms,
            depth: 0,
            kind: CD_SPAN_KIND.output,
          });
        }
        lastOutput = undefined;
        lastTopOutput = undefined;
        stack = [];
        return;
      }
      case PROFILER_EVENT.ChangeDetectionSyncStart:
        if (current) current.passes++;
        return;
      case PROFILER_EVENT.ComponentStart:
        if (current) stack.push({ start: now(), children: 0 });
        return;
      case PROFILER_EVENT.ComponentEnd: {
        const frame = current ? stack.pop() : undefined;
        if (!current || !frame || !instance || typeof instance !== 'object') return;
        // Walked past (a clean OnPush view) or checkNoChanges: no check. The time of the
        // checks under it moves up; the walk itself stays in the parent's own time.
        if (!refreshed) {
          const parent = stack.at(-1);
          if (parent) parent.children += frame.children;
          return;
        }
        const total = now() - frame.start;
        const self = Math.max(0, total - frame.children);
        const parent = stack.at(-1);
        if (parent) parent.children += total;
        const ctor = (instance as { constructor: Ctor }).constructor;
        addSpan({
          ctor,
          label: '',
          at: frame.start,
          ms: total,
          // A component checked inside a running hook (a RouterOutlet's
          // ngOnInit, say) nests under that hook, as hook spans do.
          depth: stack.length + hookStack.length,
          kind: CD_SPAN_KIND.component,
        });
        const check = current.checks.get(ctor);
        if (check) {
          check.checks++;
          check.ms += self;
        } else {
          current.checks.set(ctor, { checks: 1, ms: self });
        }
        const stat = totals.get(ctor);
        if (stat) {
          stat.checks++;
          stat.ms += self;
          stat.maxMs = Math.max(stat.maxMs, self);
          if (stat.lastCycle !== current.id) {
            stat.cycles++;
            stat.lastCycle = current.id;
          }
        } else if (totals.size < MAX_TRACKED_CLASSES) {
          totals.set(ctor, {
            name: '',
            checks: 1,
            ms: self,
            maxMs: self,
            cycles: 1,
            lastCycle: current.id,
          });
        } else if (!untrackedClasses.has(ctor)) {
          untrackedClasses.add(ctor);
          untrackedClassCount++;
        }
        const seen = perInstance.get(instance);
        if (seen !== undefined) {
          perInstance.set(instance, seen + 1);
          return;
        }
        if (instances.length >= MAX_HOSTS && prunedCycle !== current.id) {
          prunedCycle = current.id;
          instances = instances.filter((ref) => ref.deref());
        }
        const earlier = untrackedHosts.get(instance);
        if (instances.length < MAX_HOSTS) {
          instances.push(new WeakRef(instance));
          perInstance.set(instance, (earlier ?? 0) + 1);
          if (earlier !== undefined) {
            untrackedHosts.delete(instance);
            untrackedHostCount--;
          }
        } else {
          untrackedHosts.set(instance, (earlier ?? 0) + 1);
          if (earlier === undefined) untrackedHostCount++;
        }
        return;
      }
      case PROFILER_EVENT.ChangeDetectionEnd: {
        if (!current) return;
        current.ms = now() - current.start;
        const { kept, dropped: droppedSpans } = keepLongest(current.spans, current.droppedSpans);
        current.spans = kept;
        current.droppedSpans = droppedSpans;
        cycles.push(current);
        if (cycles.length > options.maxCycles) {
          dropped += cycles.length - options.maxCycles;
          cycles = cycles.slice(-options.maxCycles);
        }
        const resumed = outer.pop();
        current = resumed?.cycle ?? null;
        stack = resumed?.stack ?? [];
        return;
      }
    }
  };

  const reset = () => {
    refresh.reset();
    seq = 0;
    dropped = 0;
    cycles = [];
    current = null;
    stack = [];
    outer = [];
    lastOutput = undefined;
    hookStack = [];
    outputStack = [];
    afterRenderStart = null;
    lastTopOutput = undefined;
    hookTable.reset();
    outputTable.reset();
    afterRender = { runs: 0, ms: 0, maxMs: 0 };
    perfStart = now();
    totals = new Map();
    perInstance = new WeakMap();
    instances = [];
    prunedCycle = 0;
    untrackedClasses = new WeakSet();
    untrackedClassCount = 0;
    untrackedHosts = new WeakMap();
    untrackedHostCount = 0;
  };

  return {
    onEvent,
    get recording() {
      return recording;
    },
    /** The id of the cycle that is running, or null between cycles. */
    get cycleId(): number | null {
      return current?.id ?? null;
    },
    /** True while the recorder holds cycles, recording or stopped. */
    get hasCycles() {
      return cycles.length > 0;
    },
    /** Starts a fresh recording, dropping what was recorded before. */
    start() {
      reset();
      recording = true;
      startedAt = clock();
    },
    /** Stops recording and keeps what it recorded. */
    stop() {
      recording = false;
      current = null;
      stack = [];
      outer = [];
      lastOutput = undefined;
      hookStack = [];
      outputStack = [];
      afterRenderStart = null;
      lastTopOutput = undefined;
    },
    clear() {
      reset();
      startedAt = recording ? clock() : null;
    },
    /** Cycles and totals with names, and checks per host id from `hostId`. */
    snapshot(hostId: (instance: object) => string | null): CdRecording {
      const hosts: Record<string, number> = {};
      for (const ref of instances) {
        const instance = ref.deref();
        const id = instance && hostId(instance);
        if (id) hosts[id] = (hosts[id] ?? 0) + (perInstance.get(instance!) ?? 0);
      }
      const droppedClasses = untrackedClassCount + Math.max(0, totals.size - MAX_COMPONENTS);
      const spanNames = createSpanNames();
      const hooks = hookTable.list(round);
      const outputs = outputTable.list(round);
      const droppedTimings = hooks.dropped + outputs.dropped;
      return {
        recording,
        startedAt,
        dropped,
        ...(droppedClasses ? { droppedClasses } : {}),
        ...(untrackedHostCount ? { droppedHosts: untrackedHostCount } : {}),
        hosts,
        cycles: cycles.map((cycle) => {
          const checks = [...cycle.checks].map(([ctor, check]) => ({
            name: className(ctor as { name?: string }),
            checks: check.checks,
            ms: round(check.ms),
          }));
          return {
            id: cycle.id,
            at: cycle.at,
            ms: round(cycle.ms),
            passes: cycle.passes,
            ...(cycle.trigger ? { trigger: cycle.trigger } : {}),
            checks: checks.reduce((sum, check) => sum + check.checks, 0),
            components: checks.sort((a, b) => b.ms - a.ms).slice(0, TOP_PER_CYCLE),
            t: Math.round(Math.max(0, cycle.start - perfStart) * 1000) / 1000,
            ...(cycle.hookMs ? { hookMs: round(cycle.hookMs) } : {}),
            ...(cycle.afterRenderMs ? { afterRenderMs: round(cycle.afterRenderMs) } : {}),
            ...(cycle.outputMs ? { outputMs: round(cycle.outputMs) } : {}),
            ...(cycle.spans.length ? { spans: cycle.spans.map(spanNames.tuple) } : {}),
            ...(cycle.droppedSpans ? { droppedSpans: cycle.droppedSpans } : {}),
          };
        }),
        components: [...totals]
          .map(([ctor, { lastCycle: _lastCycle, ...stat }]) => ({
            ...stat,
            name: className(ctor as { name?: string }),
            ms: round(stat.ms),
            maxMs: round(stat.maxMs),
          }))
          .sort((a, b) => b.ms - a.ms || b.checks - a.checks)
          .slice(0, MAX_COMPONENTS),
        ...(hooks.rows.length
          ? { hooks: hooks.rows.map(({ key, ...row }) => ({ ...row, hook: key })) }
          : {}),
        ...(outputs.rows.length
          ? {
              outputs: outputs.rows.map(({ key, ...row }) => ({
                ...row,
                ...(key ? { listener: key } : {}),
              })),
            }
          : {}),
        ...(droppedTimings ? { droppedTimings } : {}),
        ...(afterRender.runs
          ? {
              afterRender: {
                runs: afterRender.runs,
                ms: round(afterRender.ms),
                maxMs: round(afterRender.maxMs),
              },
            }
          : {}),
        ...(spanNames.names.length ? { spanNames: spanNames.names } : {}),
      };
    },
  };
}

export type CdRecorder = ReturnType<typeof createCdRecorder>;
