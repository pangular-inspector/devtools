import { elementId } from './element-id.ts';
import type { HostTree } from './host-tree.ts';
import { serialize } from './serialize.ts';
import { clip } from './text.ts';
import {
  instrumentPipes,
  readBoundArg,
  scanPipeViews,
  staleCheckFor,
  stripBundlerPrefix,
  type NgDebugApi,
  type PipeCall,
  type PipeInstrumentation,
  type PipeUsage,
  type StaleCheck,
} from './pipes-runtime.ts';
import type {
  AsyncUsageInfo,
  PipeComponentUsage,
  PipeInstanceCall,
  PipePageReport,
  PipeTarget,
  PipeUsageInfo,
} from './rpc/pipes-tools.ts';

type AnyRecord = Record<string, any>;

interface Rpc {
  rpc: {
    call(name: string, ...args: unknown[]): Promise<unknown>;
    register(definition: {
      name: string;
      type: 'event' | 'action' | 'query';
      jsonSerializable: boolean;
      handler: (...args: any[]) => unknown;
    }): void;
  };
}

const HEARTBEAT_MS = 5000;
const FULL_SCAN_EVERY = 20;
const MAX_ADDED_ROOTS = 200;
const MAX_TARGETS = 10;
const MAX_ASYNC_USAGES = 200;

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function componentName(component: unknown): string {
  const name = read(() => (component as { constructor?: Function })?.constructor?.name, undefined);
  return name ? stripBundlerPrefix(name) : '?';
}

const MAX_DESCRIBE_CHARS = 200;
const DESCRIBE_LIMITS = { depth: 4, keys: 20, items: 20, text: MAX_DESCRIBE_CHARS, budget: 200 };

function parsedJson(text: string): unknown {
  if (!/^\s*[[{]/.test(text)) return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function describeValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  const safe = serialize(typeof value === 'string' ? parsedJson(value) : value, DESCRIBE_LIMITS);
  if (typeof safe === 'string') return clip(safe, MAX_DESCRIBE_CHARS);
  try {
    return clip(JSON.stringify(safe) ?? String(safe), MAX_DESCRIBE_CHARS);
  } catch {
    return '[Unreadable]';
  }
}

const RESUBSCRIBE_STREAK = 3;

interface AsyncSourceHistory {
  source: unknown;
  streak: number;
  resubscribing: boolean;
}

/** Marks an `AsyncPipe` whose source changed on `RESUBSCRIBE_STREAK` reports
 * in a row, e.g. `getData() | async` building a new Observable per check. */
function resubscribingOf(
  history: WeakMap<AnyRecord, AsyncSourceHistory>,
  instance: AnyRecord,
  source: unknown,
): boolean {
  if (source === undefined || source === null) return history.get(instance)?.resubscribing ?? false;
  const prev = history.get(instance);
  if (!prev) {
    history.set(instance, { source, streak: 0, resubscribing: false });
    return false;
  }
  if (prev.source !== source) {
    prev.source = source;
    prev.streak++;
    if (prev.streak >= RESUBSCRIBE_STREAK) prev.resubscribing = true;
  } else {
    prev.streak = 0;
  }
  return prev.resubscribing;
}

/** `AsyncPipe` keeps its subscribed source and latest value on plain (not
 * ECMAScript-private) fields — `_obj`/`_latestValue` — so this reads them
 * passively; no patching needed, unlike other pipes' call tracking. */
function asyncReportFor(
  usages: PipeUsage[],
  targetOf: (component: unknown) => PipeTarget | undefined,
  history: WeakMap<AnyRecord, AsyncSourceHistory>,
): AsyncUsageInfo[] {
  const asyncUsages = usages.filter((u) => u.name === 'async');
  const bySource = new Map<unknown, number>();
  for (const usage of asyncUsages) {
    const source = read(() => (usage.instance as { _obj?: unknown })._obj, undefined);
    if (source === undefined || source === null) continue;
    bySource.set(source, (bySource.get(source) ?? 0) + 1);
  }
  const resubscribing = new Map<AnyRecord, boolean>();
  for (const usage of asyncUsages) {
    const source = read(() => (usage.instance as { _obj?: unknown })._obj, undefined);
    resubscribing.set(usage.instance, resubscribingOf(history, usage.instance, source));
  }
  return asyncUsages.slice(0, MAX_ASYNC_USAGES).map((usage) => {
    const source = read(() => (usage.instance as { _obj?: unknown })._obj, undefined);
    const hasSource = source !== undefined && source !== null;
    const latestValue = hasSource
      ? read(() => (usage.instance as { _latestValue?: unknown })._latestValue, undefined)
      : undefined;
    const target = targetOf(usage.component);
    return {
      component: componentName(usage.component),
      hasSource,
      latestValue: latestValue === undefined ? undefined : describeValue(latestValue),
      duplicate: hasSource && (bySource.get(source) ?? 0) > 1,
      ...(resubscribing.get(usage.instance) ? { resubscribing: true } : {}),
      ...(target ? { target } : {}),
    };
  });
}

interface InstanceStats {
  callCount: number;
  /** Raw, not yet described: serializing is deferred to `reportFor` (at most
   * every few seconds) so the per-call hot path stays a couple of stores. */
  lastArgs: unknown[];
  lastResult: unknown;
  lastCaller?: string;
  lastAt: number;
}

const MAX_HASH_DEPTH = 2;
const MAX_HASH_ITEMS = 50;

/** A cheap, size-capped structural fingerprint — not a real hash, just
 * "different enough to notice" for detecting in-place mutation of an
 * argument whose reference stayed the same. Never throws. */
function shapeHash(value: unknown, depth = 0): string {
  if (value === null) return 'null';
  if (typeof value !== 'object') return `${typeof value}:${String(value)}`;
  return read(() => {
    if (value instanceof Date) return `date:${value.getTime()}`;
    if (depth >= MAX_HASH_DEPTH) return '…';
    if (Array.isArray(value)) {
      const items = value.slice(0, MAX_HASH_ITEMS).map((v) => shapeHash(v, depth + 1));
      return `[${items.join(',')}${value.length > MAX_HASH_ITEMS ? ',…' : ''}]`;
    }
    if (value instanceof Map || value instanceof Set) {
      const entries: string[] = [];
      for (const [k, v] of value.entries()) {
        if (entries.length >= MAX_HASH_ITEMS) break;
        entries.push(
          value instanceof Map
            ? `${shapeHash(k, depth + 1)}:${shapeHash(v, depth + 1)}`
            : shapeHash(v, depth + 1),
        );
      }
      return `${value instanceof Map ? 'map' : 'set'}:${value.size}{${entries.join(',')}}`;
    }
    const keys = Object.keys(value as object).slice(0, MAX_HASH_ITEMS);
    const entries = keys.map((k) => `${k}:${shapeHash((value as AnyRecord)[k], depth + 1)}`);
    return `{${entries.join(',')}}`;
  }, '?');
}

const MAX_INSTANCE_CALLS = 5;

function describeCall(s: InstanceStats) {
  return {
    lastArgs: s.lastArgs.map(describeValue),
    lastResult: describeValue(s.lastResult),
    lastCaller: s.lastCaller,
  };
}

interface StaleSnapshot {
  ref: unknown;
  hash: string;
  calls: number;
}

/** EXPERIMENTAL: per-pipe-instance state for the stale-pure-pipe check.
 * `checks` caches the recovered binding slot (or the fact that recovery
 * failed) so the regex scan only ever runs once per instance. */
class StaleTracker {
  private readonly checks = new WeakMap<AnyRecord, StaleCheck | null>();
  private readonly snapshots = new WeakMap<AnyRecord, StaleSnapshot>();
  private readonly detected = new WeakMap<AnyRecord, number>();

  constructor(private readonly callsOf: (instance: AnyRecord) => number) {}

  /** When the instance was first seen stale, kept until its argument changes
   * reference or `transform` runs again (the value is fresh again). */
  staleSince(usage: PipeUsage): number | undefined {
    const prev = this.snapshots.get(usage.instance);
    const stale = this.isStale(usage);
    const current = this.snapshots.get(usage.instance);
    if (stale) {
      if (!this.detected.has(usage.instance)) this.detected.set(usage.instance, Date.now());
    } else if (
      !prev ||
      !current ||
      !Object.is(prev.ref, current.ref) ||
      prev.calls !== current.calls
    ) {
      this.detected.delete(usage.instance);
    }
    return this.detected.get(usage.instance);
  }

  /** Returns true the moment a pure pipe's bound argument is found unchanged
   * by reference but different in shape from last time, and `transform` has
   * not run since, i.e. Angular's own memoization skipped a re-render that a
   * mutated argument arguably deserved. */
  isStale(usage: PipeUsage): boolean {
    if (!usage.isPure) return false;
    let check = this.checks.get(usage.instance);
    if (check === undefined) {
      check = staleCheckFor(usage);
      this.checks.set(usage.instance, check);
    }
    if (!check) return false;
    const current = read(() => readBoundArg(usage, check!), undefined);
    const isObj = current !== null && typeof current === 'object';
    const prev = this.snapshots.get(usage.instance);
    const hash = isObj ? shapeHash(current) : '';
    const calls = this.callsOf(usage.instance);
    this.snapshots.set(usage.instance, { ref: current, hash, calls });
    if (!prev) return false;
    if (!Object.is(prev.ref, current)) return false;
    if (calls !== prev.calls) return false;
    return isObj && hash !== prev.hash;
  }
}

export interface PipesCollector {
  push(): void;
  /** Stops pushing reports, e.g. on `pagehide`, so an in-flight or timed push
   * can't re-register a page the server was just told to forget. */
  pause(): void;
  /** Resumes after `pause` (a page restored from the back/forward cache). */
  resume(): void;
  stop(): void;
}

export interface PipesOptions<H extends object> {
  /** Hosts to scan in place of the DOM, such as an Angular Native app's views. */
  tree?: HostTree<H>;
}

function hostsOf<H extends object>(tree: HostTree<H>): H[] {
  const out: H[] = [];
  const stack = tree.roots().reverse();
  while (stack.length) {
    const host = stack.pop()!;
    out.push(host);
    stack.push(...tree.children(host).reverse());
  }
  return out;
}

/** Live pipe usage: discovery (always on, cheap) plus, once instrumented,
 * per-call tracking via prototype patching. Mirrors `attachForms`'s shape. */
export function attachPipes<H extends object = Element>(
  my: Rpc,
  pageId: string,
  getNg: () => NgDebugApi | undefined,
  options: PipesOptions<H> = {},
): PipesCollector {
  const tree = options.tree;
  let instrumented = false;
  let instrumentation: PipeInstrumentation | null = null;
  let stats = new WeakMap<AnyRecord, InstanceStats>();
  const callsOf = (instance: AnyRecord) => stats.get(instance)?.callCount ?? 0;
  let staleTracker = new StaleTracker(callsOf);
  const asyncHistory = new WeakMap<AnyRecord, AsyncSourceHistory>();
  const ownerNames = new Set<string>();
  let lastPayload = '';
  let lastPushAt = 0;
  let paused = false;

  let usages: PipeUsage[] = [];
  let entries: Element[] = [];
  let scansSinceFull = 0;
  let fullScanDue = true;
  let removed = false;
  const added = new Set<Element>();
  const textParents = new Set<Element>();
  const observer =
    !tree && typeof MutationObserver === 'function'
      ? new MutationObserver((records) => {
          for (const record of records) {
            if (record.removedNodes.length) removed = true;
            for (const node of Array.from(record.addedNodes)) {
              if (node.nodeType !== 1) {
                if (node.parentElement) textParents.add(node.parentElement);
                continue;
              }
              added.add(node as Element);
            }
          }
          if (added.size + textParents.size > MAX_ADDED_ROOTS) {
            added.clear();
            textParents.clear();
            fullScanDue = true;
          }
        })
      : null;
  observer?.observe(document.documentElement, { childList: true, subtree: true });

  function discover(ng: NgDebugApi): PipeUsage[] {
    if (tree) {
      usages = scanPipeViews(ng, hostsOf(tree) as unknown as Element[]).usages;
      return usages;
    }
    scansSinceFull++;
    let elements: Iterable<Element>;
    if (!observer || fullScanDue || scansSinceFull >= FULL_SCAN_EVERY) {
      elements = document.querySelectorAll('*');
      fullScanDue = false;
      scansSinceFull = 0;
    } else if (added.size || textParents.size || removed) {
      const candidates = new Set<Element>(document.querySelectorAll('[ng-version]'));
      for (const el of entries) if (el.isConnected) candidates.add(el);
      for (const el of textParents) if (el.isConnected) candidates.add(el);
      for (const el of added) {
        if (!el.isConnected) continue;
        candidates.add(el);
        for (const child of Array.from(el.querySelectorAll('*'))) candidates.add(child);
      }
      elements = candidates;
    } else {
      return usages;
    }
    added.clear();
    textParents.clear();
    removed = false;
    const scan = scanPipeViews(ng, elements);
    usages = scan.usages;
    entries = scan.entries;
    return usages;
  }

  function targetOf(ng: NgDebugApi): (component: unknown) => PipeTarget | undefined {
    const cache = new Map<unknown, PipeTarget | undefined>();
    return (component) => {
      if (cache.has(component)) return cache.get(component);
      const host =
        component && typeof component === 'object'
          ? read(() => ng.getHostElement?.(component) ?? null, null)
          : null;
      const isHost = tree
        ? tree.isHost(host)
        : typeof Element === 'function' && host instanceof Element;
      const target = isHost && host ? { pageId, id: elementId(host) } : undefined;
      cache.set(component, target);
      return target;
    };
  }

  function onPipeCall(call: PipeCall) {
    const prev = stats.get(call.instance);
    if (prev) {
      prev.callCount++;
      prev.lastArgs = call.args;
      prev.lastResult = call.result;
      prev.lastCaller = call.caller;
      prev.lastAt = Date.now();
      return;
    }
    stats.set(call.instance, {
      callCount: 1,
      lastArgs: call.args,
      lastResult: call.result,
      lastCaller: call.caller,
      lastAt: Date.now(),
    });
  }

  function reportFor(
    usages: PipeUsage[],
    targetOf: (component: unknown) => PipeTarget | undefined,
  ): PipeUsageInfo[] {
    const byName = new Map<string, PipeUsage[]>();
    for (const usage of usages) {
      const group = byName.get(usage.name);
      if (group) group.push(usage);
      else byName.set(usage.name, [usage]);
    }
    const out: PipeUsageInfo[] = [];
    for (const [name, group] of byName) {
      const byComponent = new Map<string, PipeComponentUsage>();
      for (const usage of group) {
        const label = componentName(usage.component);
        let entry = byComponent.get(label);
        if (!entry) {
          entry = { name: label, count: 0 };
          byComponent.set(label, entry);
        }
        entry.count++;
        const target = targetOf(usage.component);
        if (target && !entry.targets?.some((t) => t.id === target.id)) {
          entry.targets ??= [];
          if (entry.targets.length < MAX_TARGETS) entry.targets.push(target);
        }
      }
      const components = Array.from(byComponent.values());

      let callCount = 0;
      const called: { usage: PipeUsage; stats: InstanceStats }[] = [];
      let staleAt: number | undefined;
      for (const usage of group) {
        const s = stats.get(usage.instance);
        if (s) {
          callCount += s.callCount;
          called.push({ usage, stats: s });
        }
        // Only while instrumented: the check has a real (capped) cost, and
        // establishing a baseline while not watching would just be noise.
        const since = instrumented ? staleTracker.staleSince(usage) : undefined;
        if (since !== undefined && (staleAt === undefined || since < staleAt)) staleAt = since;
      }

      called.sort((a, b) => b.stats.lastAt - a.stats.lastAt);
      const latest = called[0]?.stats;
      // Usages of one pipe can see different values (e.g. `x | p` and
      // `x | other | p`), so a single "last" would misrepresent them.
      const instances: PipeInstanceCall[] | undefined =
        called.length > 1
          ? called.slice(0, MAX_INSTANCE_CALLS).map(({ usage, stats: s }) => ({
              component: componentName(usage.component),
              callCount: s.callCount,
              ...describeCall(s),
            }))
          : undefined;

      out.push({
        name,
        className: group[0].className,
        isPure: group[0].isPure,
        instanceCount: group.length,
        components,
        call:
          callCount > 0 && latest
            ? {
                callCount,
                ...describeCall(latest),
                instances,
              }
            : undefined,
        stale: staleAt !== undefined ? { detectedAt: staleAt } : undefined,
      });
    }
    return out;
  }

  async function pushPipes() {
    if (paused) return;
    try {
      const ng = getNg();
      if (!ng?.getComponent) return;
      const usages = discover(ng);
      for (const usage of usages) ownerNames.add(componentName(usage.component));
      if (instrumentation) {
        for (const usage of usages) instrumentation.addPipe(usage);
      }
      const targets = targetOf(ng);
      const report: PipePageReport = {
        pageId,
        pipes: reportFor(usages, targets),
        async: asyncReportFor(usages, targets, asyncHistory),
        instrumented,
      };
      const payload = JSON.stringify(report);
      const now = Date.now();
      if (payload === lastPayload && now - lastPushAt < HEARTBEAT_MS) return;
      lastPayload = payload;
      lastPushAt = now;
      if (paused) return;
      await my.rpc.call('push-pipes', report);
    } catch {
      return;
    }
  }

  function setInstrumented(on: boolean): { ok: true; message: string } {
    if (on && !instrumentation) {
      stats = new WeakMap();
      staleTracker = new StaleTracker(callsOf);
      instrumentation = instrumentPipes(onPipeCall, ownerNames);
      instrumented = true;
      void pushPipes();
      return { ok: true, message: 'Recording pipe calls, inputs/outputs and callers.' };
    }
    if (!on && instrumentation) {
      instrumentation.stop();
      instrumentation = null;
      instrumented = false;
      void pushPipes();
    }
    return { ok: true, message: on ? 'Already recording.' : 'Stopped recording.' };
  }

  my.rpc.register({
    name: 'instrument-pipes',
    type: 'event',
    jsonSerializable: true,
    handler: (on: boolean) => setInstrumented(on !== false),
  });

  return {
    push: () => void pushPipes(),
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      lastPayload = '';
      void pushPipes();
    },
    stop() {
      paused = true;
      observer?.disconnect();
      usages = [];
      entries = [];
      added.clear();
      textParents.clear();
      instrumentation?.stop();
      instrumentation = null;
      instrumented = false;
    },
  };
}
