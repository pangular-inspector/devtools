import { className } from './injector-tree.ts';

/** Angular's `ProfilerEvent` values that the recorder reads. */
export const PROFILER_EVENT = {
  OutputStart: 6,
  ChangeDetectionStart: 12,
  ChangeDetectionEnd: 13,
  ChangeDetectionSyncStart: 14,
  ComponentStart: 18,
  ComponentEnd: 19,
} as const;

const TOP_PER_CYCLE = 10;
const MAX_COMPONENTS = 100;
const MAX_HOSTS = 2000;

export interface CdCheck {
  name: string;
  checks: number;
  /** Time in the component's own template and hooks, children excluded. */
  ms: number;
}

export interface CdCycle {
  id: number;
  at: number;
  ms: number;
  /** How many times Angular synchronized the views in this tick. */
  passes: number;
  /** The output listener that ran last before the tick, when there was one. */
  trigger?: string;
  checks: number;
  components: CdCheck[];
}

export interface CdComponentStat {
  name: string;
  checks: number;
  ms: number;
  maxMs: number;
  cycles: number;
}

export interface CdRecording {
  recording: boolean;
  startedAt: number | null;
  cycles: CdCycle[];
  /** Older cycles removed at `limits.cdCycles`. */
  dropped: number;
  components: CdComponentStat[];
  /** Checks per component host, keyed by the component tree's element id. */
  hosts: Record<string, number>;
}

type Ctor = object;

interface RawCycle {
  id: number;
  at: number;
  start: number;
  ms: number;
  passes: number;
  trigger?: string;
  checks: Map<Ctor, { checks: number; ms: number }>;
}

interface Frame {
  start: number;
  children: number;
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
  const listener =
    typeof trigger.listener === 'function' ? (trigger.listener as { name?: string }).name : '';
  return listener && !/^(wrapListener|anonymous|bound )/.test(listener)
    ? `${owner} (${listener})`
    : owner;
}

const round = (ms: number) => Math.round(ms * 100) / 100;

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
  let lastOutput: { owner: unknown; listener: unknown } | undefined;
  let totals = new Map<Ctor, CdComponentStat & { lastCycle: number }>();
  let perInstance = new WeakMap<object, number>();
  let instances: WeakRef<object>[] = [];
  let prunedCycle = 0;

  const onEvent = (event: number, instance?: unknown, hook?: unknown) => {
    if (!recording) return;
    switch (event) {
      case PROFILER_EVENT.OutputStart:
        if (!current) lastOutput = { owner: instance, listener: hook };
        return;
      case PROFILER_EVENT.ChangeDetectionStart:
        current = {
          id: ++seq,
          at: clock(),
          start: now(),
          ms: 0,
          passes: 0,
          trigger: triggerText(lastOutput),
          checks: new Map(),
        };
        lastOutput = undefined;
        stack = [];
        return;
      case PROFILER_EVENT.ChangeDetectionSyncStart:
        if (current) current.passes++;
        return;
      case PROFILER_EVENT.ComponentStart:
        if (current) stack.push({ start: now(), children: 0 });
        return;
      case PROFILER_EVENT.ComponentEnd: {
        const frame = current ? stack.pop() : undefined;
        if (!current || !frame || !instance || typeof instance !== 'object') return;
        const total = now() - frame.start;
        const self = Math.max(0, total - frame.children);
        const parent = stack.at(-1);
        if (parent) parent.children += total;
        const ctor = (instance as { constructor: Ctor }).constructor;
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
        } else if (totals.size < MAX_COMPONENTS * 10) {
          totals.set(ctor, {
            name: '',
            checks: 1,
            ms: self,
            maxMs: self,
            cycles: 1,
            lastCycle: current.id,
          });
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
        if (instances.length < MAX_HOSTS) {
          instances.push(new WeakRef(instance));
          perInstance.set(instance, 1);
        }
        return;
      }
      case PROFILER_EVENT.ChangeDetectionEnd: {
        if (!current) return;
        current.ms = now() - current.start;
        cycles.push(current);
        if (cycles.length > options.maxCycles) {
          dropped += cycles.length - options.maxCycles;
          cycles = cycles.slice(-options.maxCycles);
        }
        current = null;
        stack = [];
        return;
      }
    }
  };

  const reset = () => {
    seq = 0;
    dropped = 0;
    cycles = [];
    current = null;
    stack = [];
    lastOutput = undefined;
    totals = new Map();
    perInstance = new WeakMap();
    instances = [];
    prunedCycle = 0;
  };

  return {
    onEvent,
    get recording() {
      return recording;
    },
    /** Starts a fresh recording. */
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
      lastOutput = undefined;
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
      return {
        recording,
        startedAt,
        dropped,
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
      };
    },
  };
}

export type CdRecorder = ReturnType<typeof createCdRecorder>;
