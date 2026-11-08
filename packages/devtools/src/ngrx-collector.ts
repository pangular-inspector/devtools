import { queueMicrotaskOutside } from './outside-angular.ts';
import * as angularCore from '@angular/core';
import { isRedactedKey, REDACTED, withRedactionScope } from './forms-privacy.ts';
import { documentTree, type HostTree } from './host-tree.ts';
import { className, tokenName } from './injector-tree.ts';
import {
  devtoolsProblem,
  diff,
  joinStatePath,
  dispatchProblem,
  NGRX_BURST_WINDOW_MS,
  NGRX_DIFF_MORE_CAP,
  NGRX_LOOP_BURST,
  NGRX_MAX_STATS,
  NGRX_TRACE_FRAMES,
  referenceDiff,
  serialize,
  serializeSlice,
  type NgrxActionStat,
  type NgrxClassicStoreInfo,
  type NgrxDevtoolsRequest,
  type NgrxDiffEntry,
  type NgrxActionOrigin,
  type NgrxLogEntry,
  type NgrxRequest,
  type NgrxRequestResult,
  type NgrxSignalStoreInfo,
  type NgrxUnrestorable,
  type NgrxUnrestorableUpdate,
} from './ngrx-shared.ts';
import { registeredPatchState, registeredWatchState } from './ngrx-register.ts';
import { historyRequest, type HistorySource } from './ngrx-history.ts';
import { markSecretWriter, safeArgs, touchesSecret } from './ngrx-args.ts';
import { SliceCache } from './ngrx-slice-cache.ts';
import { ReportMemo, ReportVersion } from './ngrx-report-memo.ts';
import { appFrames, captureStack } from './signal-stack.ts';

/**
 * Angular's `untracked` (16.0+), read at runtime: a named import of it fails
 * the build of an app on Angular 12 to 15 under webpack's strict ESM rules.
 * Signals don't exist before 16.0, so reading the value directly is the same.
 */
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    !!value &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

function untracked<T>(body: () => T): T {
  const fn = Reflect.get(angularCore, 'untracked') as ((body: () => T) => T) | undefined;
  return typeof fn === 'function' ? fn(body) : body();
}

type AnyRecord = Record<PropertyKey, any>;

export interface NgrxDebugNg<H extends object = Element> {
  getInjector?(el: H): unknown;
  getComponent?(el: H): unknown;
  ɵgetInjectorMetadata?(injector: unknown): { type: string; source: unknown } | null;
  ɵgetInjectorProviders?(injector: unknown): { token: unknown; isViewProvider?: boolean }[];
  ɵgetInjectorResolutionPath?(injector: unknown): unknown[];
}

/**
 * Rolling call stats for one wrapped method. `totalDurationMs` is a running sum (not a
 * history array, per the "keep pushes/state cheap" rule) divided by `calls` in `report()`
 * to get `avgDurationMs`.
 */
interface MethodInfo {
  calls: number;
  timedCalls: number;
  rx: boolean;
  totalDurationMs: number;
  lastDurationMs?: number;
}

interface Tracked {
  id: string;
  instance: object;
  source: AnyRecord;
  kind: NgrxSignalStoreInfo['kind'];
  className: string;
  scope: string;
  stateKeys: PropertyKey[];
  methods: Map<string, MethodInfo>;
  references: Set<string>;
  writable: boolean;
  depth: number;
  pendingBefore: Record<PropertyKey, unknown> | null;
  lastNoop: Map<string, number>;
  undo: (() => void)[];
  /**
   * Injector resolved for this store at discovery, used to subscribe through
   * `watchState()` when it is registered. `null` when the store is tracked
   * from a path without an injector (e.g. the signalState tests that only
   * stub `getInjector`).
   */
  injector: unknown;
  /** True once `watchState()` is attached — then `onWrite` short-circuits. */
  watched: boolean;
  /**
   * The last snapshot a watcher produced for this store. Each watchState
   * callback diffs the live state against it and then replaces it, so every
   * patchState call (even several in the same tick) ends up as its own entry.
   */
  lastWatched: Snapshot | null;
  /**
   * While a wrapped method call is on the stack, state writes from inside it
   * get labeled with the method's name and args (and their duration folds into
   * the method's rolling stats) instead of showing as a bare `patchState` entry.
   */
  methodStack: {
    name: string;
    args: unknown[];
    startedAt: number;
    fired?: number;
    /** The wrapped method, for the argument masking in `ngrx-args.ts`. */
    method?: unknown;
    /** Entries this call logged with arguments, masked after the fact once it writes a secret. */
    logged?: NgrxLogEntry[];
    /** With `ngrx.trace`: where the method was called from. */
    trace?: string[];
  }[];
  /**
   * Outer method calls that returned a promise not settled yet. A write after
   * an `await` runs outside the call's frame, so it is logged as a bare
   * `patchState`; when it touches a secret, the arguments of these calls are
   * masked after the fact, since one of them most likely made it.
   */
  asyncCalls: Set<Tracked['methodStack'][number]>;
  /**
   * The store uses `withDevtools()`: nothing is wrapped, changes come from
   * `watchState()` or, without it, from a compare against `lastSeen` on each collect.
   */
  watchOnly: boolean;
  lastSeen: Snapshot | null;
  /** With `ngrx.trace`: the call site of the first write waiting for the microtask fallback. */
  pendingTrace?: string[];
}

interface Classic {
  store: AnyRecord;
  devtools: AnyRecord | null;
  scope: string;
  last: unknown;
  lastRaw: unknown;
  origins: WeakMap<object, NgrxActionOrigin>;
  /** With `ngrx.trace`: where each action was dispatched from. */
  traces: WeakMap<object, string[]>;
  stop: () => void;
}

type Snapshot = Record<PropertyKey, unknown>;

type Method = (this: unknown, ...args: unknown[]) => unknown;

/**
 * What each log entry keeps for restores and the history (`ngrx-history.ts`):
 * the raw states around it. NgRx state is immutable, so these share structure.
 */
type Saved =
  | { kind: 'signal'; tracked: Tracked; before: Snapshot; after: Snapshot }
  | { kind: 'classic'; action: unknown; before: unknown; after: unknown }
  | { kind: 'event' };

const MAX_LOG = 200;
const MAX_DIFF = 50;
const NOOP_GAP_MS = 1000;
const SMALL = { depth: 4, maxKeys: 20, maxString: 300, budget: 400 };
/** A computed that threw when read, and what the report shows for it. */
const UNREADABLE = Symbol('unreadable');
const COULD_NOT_READ = { '@type': 'Error', message: 'Could not read' } as const;
// Entity ids are typically short primitives; allow more of them through than SMALL
// so `count` (from the raw array) and the sampled `ids` stay close for most stores.
const ENTITY_IDS_SMALL = { depth: 1, maxKeys: 500, maxString: 200, budget: 3000 };

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Guards `performance.now()` the way this file guards every other page-provided API. */
function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function symbolNamed(value: unknown, name: string): symbol | undefined {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return undefined;
  return read(
    () => Object.getOwnPropertySymbols(value).find((s) => s.description === name),
    undefined,
  );
}

export function isSignal(value: unknown): boolean {
  return typeof value === 'function' && !!symbolNamed(value, 'SIGNAL');
}

function peek(sig: unknown): unknown {
  const key = symbolNamed(sig, 'SIGNAL');
  const node = key ? (sig as AnyRecord)[key] : undefined;
  if (node && typeof node === 'object' && 'value' in node && !('computation' in node)) {
    return node.value;
  }
  return read(() => untracked(sig as () => unknown), undefined);
}

export function stateSourceOf(value: unknown): AnyRecord | null {
  const key = symbolNamed(value, 'STATE_SOURCE');
  const source = key ? (value as AnyRecord)[key] : undefined;
  return source && typeof source === 'object' ? source : null;
}

function stripped(token: unknown): string {
  return tokenName(token).replace(/^_+/, '');
}

function componentElements<H extends object>(ng: NgrxDebugNg<H>, tree: HostTree<H>): H[] {
  const out: H[] = [];
  const stack = [...tree.roots()].reverse();
  while (stack.length) {
    const el = stack.pop()!;
    if (read(() => !!ng.getComponent?.(el), false)) out.push(el);
    stack.push(...[...tree.children(el)].reverse());
  }
  return out;
}

function envScope<H extends object>(ng: NgrxDebugNg<H>, injector: AnyRecord): string {
  if (read(() => injector['scopes']?.has?.('root'), false)) return 'root';
  if (read(() => injector['scopes']?.has?.('platform'), false)) return 'platform';
  const source = read(() => ng.ɵgetInjectorMetadata?.(injector)?.source, undefined);
  return typeof source === 'string' && source ? source : 'environment';
}

/** The kept diff rows, and how many more changes were counted past them. */
interface Changes {
  diff: NgrxDiffEntry[];
  more: number;
}

/** `diffTruncated` for an entry, set only when changes were left out. */
function truncated(more: number): { diffTruncated?: number } {
  return more > 0 ? { diffTruncated: Math.min(more, NGRX_DIFF_MORE_CAP) } : {};
}

const slices = new SliceCache();

function snapshotDiff(before: Snapshot, after: Snapshot, keys: PropertyKey[]): Changes {
  const out: NgrxDiffEntry[] = [];
  const overflow = { more: 0 };
  for (const key of keys) {
    if (out.length >= MAX_DIFF && overflow.more >= NGRX_DIFF_MORE_CAP) break;
    if (before[key] === after[key]) continue;
    // Quoted the way the state tree writes a child path, as in `["first name"]`.
    const root = typeof key === 'string' ? joinStatePath('', key) : String(key);
    if (typeof key === 'string' && isRedactedKey(key)) {
      if (out.length < MAX_DIFF) {
        out.push({ path: root, op: 'change', before: REDACTED, after: REDACTED });
      } else overflow.more++;
      continue;
    }
    const counted = overflow.more;
    const found = diff(
      slices.before(key, before[key]),
      slices.after(key, after[key]),
      MAX_DIFF - out.length,
      undefined,
      overflow,
      root,
    );
    if (!found.length && overflow.more === counted) {
      out.push(
        ...referenceDiff(
          before[key],
          after[key],
          root,
          SMALL,
          MAX_DIFF - out.length,
          undefined,
          overflow,
        ),
      );
      continue;
    }
    for (const entry of found) {
      out.push({
        ...entry,
        ...('before' in entry ? { before: serialize(entry.before, SMALL) } : {}),
        ...('after' in entry ? { after: serialize(entry.after, SMALL) } : {}),
      });
    }
  }
  return { diff: out, more: overflow.more };
}

function syncValue(observable: AnyRecord | null | undefined): unknown {
  if (!observable) return undefined;
  if (typeof observable['getValue'] === 'function') {
    return read(() => observable['getValue'](), undefined);
  }
  let value: unknown;
  read(() => observable['subscribe']((v: unknown) => (value = v))?.unsubscribe?.(), undefined);
  return value;
}

/** Options of {@link createNgrxCollector}. */
export interface NgrxCollectorOptions {
  /** `ngrx.trace`: record a redacted call stack per entry. Off by default. */
  trace?: boolean;
}

/**
 * Whether a signal store uses `withDevtools()` from
 * `@angular-architects/ngrx-toolkit`, which adds members such as
 * `___uniqueDevtoolsId` and `___renameDevtoolsName`. Such a store already
 * reports to Redux DevTools through `watchState`, so the collector leaves it
 * unpatched.
 */
export function usesWithDevtools(value: object): boolean {
  const keys = read(() => Object.keys(value), [] as string[]);
  return keys.some((key) => /^_{2,}\w*devtools\w*$/i.test(key));
}

/** Entries the collector writes itself (restores, Store DevTools operations), left out of the stats. */
const INTERNAL_TYPE = /^(Restore #\d+|Back to latest$|Store DevTools: )/;
/**
 * `@ngrx/signals` frames between a `patchState` call and a watcher, by name,
 * for a build that bundles NgRx into a chunk without a package path.
 */
const NGRX_INTERNAL_FRAME =
  /^(Object\.)?(patchState|notifyWatchers|executeWatcher|getWatchers|watchState|updateState)\b/;

/** Timestamps kept per stat to measure bursts. */
const BURST_SAMPLES = NGRX_LOOP_BURST;

interface StatInfo extends NgrxActionStat {
  totalMs: number;
  recent: number[];
}

export interface NgrxCollector {
  collect(rediscover?: boolean): {
    stores: NgrxSignalStoreInfo[];
    classic: NgrxClassicStoreInfo | null;
    /** Goes up when `stores` or `classic` changed since the previous collect. */
    version: number;
  };
  logSince(seq: number): NgrxLogEntry[];
  lastSeq(): number;
  /**
   * Entries whose args were masked after update number `after` (a call that
   * wrote a secret after it logged them), and the last update number.
   */
  argsRedactedSince(after: number): { seqs: number[]; last: number };
  /** Entries that became unrestorable after update number `after`, and the last update number. */
  unrestorableSince(after: number): { updates: NgrxUnrestorableUpdate[]; last: number };
  run(request: NgrxRequest): NgrxRequestResult;
  /**
   * The live state of one store, unserialized: `store` is the classic Store,
   * any other id a signal store's state fields. `null` when the store is gone.
   */
  rawState(storeId: string): { value: unknown } | null;
  /** Per-type counts since the page loaded, and a number that goes up when they change. */
  stats(): { stats: NgrxActionStat[]; version: number };
  stop(): void;
}

export function createNgrxCollector<H extends object = Element>(
  getNg: () => NgrxDebugNg<H> | undefined,
  onChange: () => void,
  tree: HostTree<H> = documentTree(),
  maxLog = MAX_LOG,
  options: NgrxCollectorOptions = {},
): NgrxCollector {
  /**
   * The app frames of the code running now, when `ngrx.trace` is on. `own` is
   * how many frames of this collector sit between `traceNow` and the code it
   * reports: a bundled build puts the overlay in the app's own chunks, where
   * the file filter of `appFrames` cannot tell them apart.
   */
  const traceNow = (own: number): string[] | undefined => {
    if (!options.trace) return undefined;
    const lines = (captureStack() ?? '').split('\n');
    // V8 starts with an `Error` line; Firefox and Safari list frames only.
    const header = lines[0] && !/^\s*at\s|@/.test(lines[0]) ? 1 : 0;
    const stack = lines.slice(header + 2 + own).join('\n');
    const frames = appFrames(stack, NGRX_TRACE_FRAMES + 4).filter(
      (frame) => !NGRX_INTERNAL_FRAME.test(frame),
    );
    return frames.length ? frames.slice(0, NGRX_TRACE_FRAMES) : undefined;
  };
  const withTrace = (trace: string[] | undefined) => (trace ? { trace } : {});
  const statsByKey = new Map<string, StatInfo>();
  let statsVersion = 0;
  const count = (entry: NgrxLogEntry) => {
    if (INTERNAL_TYPE.test(entry.type)) return;
    const key = `${entry.source}\u0000${entry.storeId}\u0000${entry.type}`;
    let stat = statsByKey.get(key);
    if (stat) statsByKey.delete(key);
    else {
      stat = {
        source: entry.source,
        storeId: entry.storeId,
        type: entry.type,
        count: 0,
        lastAt: 0,
        burst: 0,
        totalMs: 0,
        recent: [],
      };
    }
    // Most recent last, so the oldest key is dropped at the cap.
    statsByKey.set(key, stat);
    while (statsByKey.size > NGRX_MAX_STATS) statsByKey.delete(statsByKey.keys().next().value!);
    stat.count++;
    stat.lastAt = entry.timestamp;
    if (entry.durationMs !== undefined) {
      stat.timed = (stat.timed ?? 0) + 1;
      stat.totalMs += entry.durationMs;
      stat.maxMs = Math.max(stat.maxMs ?? 0, entry.durationMs);
    }
    if (entry.origin === 'effect') stat.effects = (stat.effects ?? 0) + 1;
    stat.recent.push(entry.timestamp);
    if (stat.recent.length > BURST_SAMPLES) stat.recent.shift();
    const inWindow = stat.recent.filter((t) => entry.timestamp - t < NGRX_BURST_WINDOW_MS).length;
    stat.burst = Math.max(stat.burst, inWindow);
    if (inWindow >= NGRX_LOOP_BURST && entry.origin === 'effect') stat.loop = true;
    statsVersion++;
  };
  const statsReport = (): NgrxActionStat[] =>
    [...statsByKey.values()]
      .map(({ totalMs, recent: _recent, ...stat }) => ({
        ...stat,
        ...(stat.timed ? { avgMs: Math.round(totalMs / stat.timed) } : {}),
      }))
      .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt);

  const ids = new WeakMap<object, string>();
  let nextId = 0;
  const idFor = (value: object) => {
    let id = ids.get(value);
    if (!id) ids.set(value, (id = `ngrx-${++nextId}`));
    return id;
  };

  const tracked = new Map<object, Tracked>();
  const wrappedSignals = new WeakSet<object>();
  const log: NgrxLogEntry[] = [];
  const saved = new Map<number, Saved>();
  let seq = 0;
  let classic: Classic | null = null;
  const storeReports = new ReportMemo<NgrxSignalStoreInfo>();
  const classicReports = new ReportMemo<NgrxClassicStoreInfo>();
  const reportVersion = new ReportVersion();
  let classicMisses = 0;
  /** Environment injectors already searched for a classic Store. */
  const classicEnvs = new WeakSet<object>();
  let dispatcher: AnyRecord | null = null;
  let dispatcherUndo: (() => void) | null = null;
  // Tracks per-element cleanup for component-scoped Dispatcher instances.
  // Released in discover() when the element is no longer present.
  const componentDispatcherUndos = new Map<H, () => void>();
  const attachedDispatchers = new WeakSet<AnyRecord>();
  let lost: (NgrxUnrestorableUpdate & { at: number })[] = [];
  let lostSeq = 0;
  // Entries whose args were masked after they were logged (and maybe pushed),
  // numbered like `lost` so the overlay sends each one to the server once.
  let masked: { seq: number; at: number }[] = [];
  let maskedSeq = 0;
  // Correlates a store's next `finish()` call with the `@ngrx/signals/events` event
  // whose synchronous `withReducer()` patchState caused it. Populated by the wrapped
  // `dispatch()` (see `wrapDispatch`/`attachDispatcher`) and consumed once by `finish()`.
  // Best effort: there is no way to recover which case reducer matched.
  // Keyed by the Tracked's `instance` so garbage collection of a store that was
  // never reconciled through `untrack()` (e.g. a page teardown that bypassed
  // `discover()`) does not keep the entry alive.
  const pendingEventByInstance = new WeakMap<object, { type: string; payload?: unknown }>();
  // The event currently flowing through a wrapped `Dispatcher.dispatch()` call,
  // if any. Set right before `original.apply()` runs and restored to its prior
  // value right after (see `wrapDispatch`), so it is only ever "live" for the
  // duration of that one synchronous call — including any `withReducer()` tap's
  // `patchState()`, which (through `watchState()`) calls `appendChange()`
  // synchronously from inside that same call. `appendChange()` reads this
  // directly instead of `pendingEventByInstance`, which only gets populated via
  // `pendingBefore` diffing — a mechanism `onWrite` skips for a watched store
  // (see `t.watched`), so it would never catch a watchState-recorded change.
  let currentDispatchedEvent: { type: string; payload?: unknown } | undefined;
  /** With `ngrx.trace`: where the event flowing through `Dispatcher.dispatch()` was dispatched. */
  let currentEventTrace: string[] | undefined;

  const append = (entry: Omit<NgrxLogEntry, 'seq'>, keep: Saved) => {
    const full = { ...entry, seq: ++seq };
    log.push(full);
    count(full);
    saved.set(full.seq, keep);
    while (log.length > maxLog) saved.delete(log.shift()!.seq);
    if (lost.some((u) => u.seq < log[0].seq)) lost = lost.filter((u) => u.seq >= log[0].seq);
    if (masked.some((u) => u.seq < log[0].seq)) {
      masked = masked.filter((u) => u.seq >= log[0].seq);
    }
    onChange();
    return full;
  };

  const snapshot = (t: Tracked): Snapshot => {
    const out: Snapshot = {};
    for (const key of t.stateKeys) out[key] = peek(t.source[key]);
    return out;
  };

  /** Masks the args of entries already logged, and queues the fix for the server. */
  const maskLogged = (entries: readonly NgrxLogEntry[] | undefined) => {
    for (const entry of entries ?? []) {
      if (!entry.args || entry.args.every((arg) => arg === REDACTED)) continue;
      entry.args = entry.args.map(() => REDACTED);
      masked.push({ seq: entry.seq, at: ++maskedSeq });
    }
  };

  /**
   * A write that no method frame claims and that touches a secret: every
   * async call of the store still running may have made it after an
   * `await`, so each one's method is marked as a secret writer and the
   * args it logged are masked, here and (through `argsRedactedSince`) on
   * the server. rxMethod streams return no promise and are not covered.
   */
  const maskAsyncCallers = (t: Tracked, before: Snapshot, after: Snapshot) => {
    if (!t.asyncCalls.size || !touchesSecret(before, after, t.stateKeys)) return;
    for (const call of t.asyncCalls) {
      markSecretWriter(call.method);
      maskLogged(call.logged);
    }
  };

  const finishNow = (
    t: Tracked,
    type: string,
    args: unknown[] | undefined,
    before: Snapshot,
    logNoop = false,
    durationMs?: number,
    method?: unknown,
    trace?: string[],
  ) => {
    const after = snapshot(t);
    const changes = snapshotDiff(before, after, t.stateKeys);
    // Clear the pending event correlation BEFORE the no-change early return.
    // A `withReducer()` case that patches a value equal to the one already there
    // produces no diff; leaving the entry would tag the next unrelated method
    // call on this store with that stale event.
    const causedByEvent = pendingEventByInstance.get(t.instance);
    if (causedByEvent) pendingEventByInstance.delete(t.instance);
    // Keep `lastWatched` in sync even for entries that did not come through
    // `watchState()` (restore paths, the microtask fallback, the method-call
    // noop entry). Otherwise the next real `watchState` firing would diff
    // against stale state.
    if (t.watched) t.lastWatched = after;
    if (t.watchOnly) t.lastSeen = after;
    if (!changes.diff.length) {
      if (!logNoop) return undefined;
      const noopAt = Date.now();
      if (noopAt - (t.lastNoop.get(type) ?? 0) < NOOP_GAP_MS) return undefined;
      t.lastNoop.set(type, noopAt);
    }
    // A write outside any method frame (after an `await`) that touches a secret.
    if (!args && !/^Restore #\d+/.test(type)) maskAsyncCallers(t, before, after);
    return append(
      {
        source: 'signal-store',
        storeId: t.id,
        type,
        ...(args
          ? {
              args: safeArgs(args, (a) => serialize(a, SMALL), {
                method,
                before,
                after,
                keys: t.stateKeys,
              }),
            }
          : {}),
        timestamp: Date.now(),
        diff: changes.diff,
        ...truncated(changes.more),
        restorable: t.writable,
        ...(causedByEvent ? { causedByEvent } : {}),
        ...(durationMs !== undefined ? { durationMs } : {}),
        ...withTrace(trace),
      },
      { kind: 'signal', tracked: t, before, after },
    );
  };

  // The redaction config is read once per update, and key and text answers are reused.
  const finish = (...args: Parameters<typeof finishNow>) =>
    withRedactionScope(() => finishNow(...args));

  const onWrite = (t: Tracked) => {
    // When a `watchState()` watcher is attached, every patchState (even
    // several in the same tick) fires one callback synchronously inside
    // `@ngrx/signals` after each one, so we rely on that for change entries
    // and skip the microtask-batched fallback entirely. The fallback below
    // is for apps that have not registered `watchState` via `registerNgrxSignals`.
    if (t.watched) return;
    if (t.depth > 0 || t.pendingBefore) return;
    t.pendingBefore = snapshot(t);
    // Under onWrite: the wrapped set or update.
    t.pendingTrace = traceNow(2);
    queueMicrotaskOutside(() => {
      const before = t.pendingBefore;
      const trace = t.pendingTrace;
      t.pendingBefore = null;
      t.pendingTrace = undefined;
      if (before) finish(t, 'patchState', undefined, before, false, undefined, undefined, trace);
    });
  };

  /**
   * Logs writes still waiting for the microtask above right away, so a method
   * call or restore that follows in the same tick gets its own entry and its
   * change does not also land in that `patchState` entry.
   */
  const flushPending = (t: Tracked) => {
    const before = t.pendingBefore;
    if (!before) return;
    const trace = t.pendingTrace;
    t.pendingBefore = null;
    t.pendingTrace = undefined;
    finish(t, 'patchState', undefined, before, false, undefined, undefined, trace);
  };

  /**
   * Appends one `signal-store` entry per patchState call, picked up through
   * `watchState()`. Dedicated to that path (not reused through `finish()`) so
   * it stays small and so it does not trip the per-method noop throttle.
   */
  const appendChangeNow = (
    t: Tracked,
    before: Snapshot,
    call: Tracked['methodStack'][number] | undefined,
    callTrace?: string[],
  ) => {
    const after = snapshot(t);
    const changes = snapshotDiff(before, after, t.stateKeys);
    // The watchState callback runs synchronously inside the dispatch that
    // caused it (see `currentDispatchedEvent`), so check that first; fall
    // back to `pendingEventByInstance` for a store that is not watched (the
    // microtask-fallback path, where `finish()` runs after dispatch returns).
    const causedByEvent = currentDispatchedEvent ?? pendingEventByInstance.get(t.instance);
    if (!currentDispatchedEvent && causedByEvent) pendingEventByInstance.delete(t.instance);
    if (!changes.diff.length) return;
    const type = call?.name ?? 'patchState';
    const isRestore = /^Restore #\d+/.test(type);
    const durationMs = call && !isRestore ? Math.round(now() - call.startedAt) : undefined;
    if (call && !isRestore && touchesSecret(before, after, t.stateKeys)) {
      // An earlier write of the same call may have logged arguments in clear.
      markSecretWriter(call.method);
      maskLogged(call.logged);
    }
    if (!call) maskAsyncCallers(t, before, after);
    const trace = isRestore ? undefined : callTrace;
    const logged = append(
      {
        source: 'signal-store',
        storeId: t.id,
        type,
        ...(call?.args?.length && !isRestore
          ? {
              args: safeArgs(call.args, (a) => serialize(a, SMALL), {
                method: call.method,
                before,
                after,
                keys: t.stateKeys,
              }),
            }
          : {}),
        timestamp: Date.now(),
        diff: changes.diff,
        ...truncated(changes.more),
        restorable: t.writable,
        ...(causedByEvent ? { causedByEvent } : {}),
        ...(durationMs !== undefined ? { durationMs } : {}),
        ...withTrace(trace),
      },
      { kind: 'signal', tracked: t, before, after },
    );
    if (call) call.fired = (call.fired ?? 0) + 1;
    if (call && logged?.args) (call.logged ??= []).push(logged);
  };

  const appendChange = (...args: Parameters<typeof appendChangeNow>) =>
    withRedactionScope(() => appendChangeNow(...args));

  /**
   * Subscribes once through the registered `watchState` so every patchState
   * call becomes its own log entry — including several in the same tick, which
   * the microtask-batched fallback merges into one. Needs an injector and the
   * `watchState` function; silently keeps the fallback when either is missing.
   */
  const attachWatcher = (t: Tracked) => {
    if (t.watched) return;
    const watchState = registeredWatchState();
    if (!watchState || !t.injector) return;
    const seed = snapshot(t);
    let subscription: { destroy(): void } | null = null;
    try {
      subscription = watchState(
        t.instance,
        () => {
          const before = t.lastWatched;
          t.lastWatched = snapshot(t);
          // The first callback runs synchronously on subscribe (`executeWatcher`
          // in `@ngrx/signals`'s own `watchState`) and serves only to seed
          // `lastWatched`. Every later firing is one patchState, which we turn
          // into one entry.
          if (!before) return;
          const call = t.methodStack[t.methodStack.length - 1];
          // The outermost method call's site, or, for a patchState outside a
          // method, this callback's own stack, which still holds its caller.
          const trace = call ? t.methodStack.find((frame) => frame.trace)?.trace : traceNow(1);
          appendChange(t, before, call, trace);
        },
        { injector: t.injector, manualCleanup: true },
      );
    } catch {
      // watchState may throw when the "injector" we grabbed is a stub (e.g.
      // tests) or lacks DestroyRef. The microtask fallback remains active.
      return;
    }
    t.watched = true;
    t.lastWatched = seed;
    if (subscription) t.undo.push(() => read(() => subscription!.destroy(), undefined));
  };

  const wrapSignal = (t: Tracked, sig: AnyRecord) => {
    if (wrappedSignals.has(sig)) return;
    wrappedSignals.add(sig);
    for (const name of ['set', 'update'] as const) {
      const original = sig[name];
      if (typeof original !== 'function') continue;
      sig[name] = function (this: unknown, ...args: unknown[]) {
        onWrite(t);
        return original.apply(this, args);
      };
      t.undo.push(() => {
        sig[name] = original;
        wrappedSignals.delete(sig);
      });
    }
  };

  const wrapMethod = (t: Tracked, name: string) => {
    const instance = t.instance as AnyRecord;
    const original = instance[name];
    const info: MethodInfo = {
      calls: 0,
      timedCalls: 0,
      rx: typeof original?.destroy === 'function',
      totalDurationMs: 0,
    };
    t.methods.set(name, info);
    const proxy = new Proxy(original, {
      apply(target, thisArg, args) {
        info.calls++;
        const outer = t.depth === 0;
        if (outer) flushPending(t);
        const before = outer ? snapshot(t) : null;
        const frame: Tracked['methodStack'][number] = {
          name,
          args,
          startedAt: now(),
          fired: 0,
          method: original,
          // Under the proxy's apply.
          ...(outer ? withTrace(traceNow(1)) : {}),
        };
        t.methodStack.push(frame);
        t.depth++;
        let result: unknown;
        try {
          result = Reflect.apply(target, thisArg, args);
          return result;
        } finally {
          // Wall-clock time of the synchronous call only: for an rxMethod/effect-style
          // member this is typically fast (it just starts a subscription), not how long
          // any async work it queued takes. See `NgrxLogEntry.durationMs`.
          const durationMs = Math.round(now() - frame.startedAt);
          info.lastDurationMs = durationMs;
          info.totalDurationMs += durationMs;
          info.timedCalls++;
          t.methodStack.pop();
          t.depth--;
          // Microtask-fallback path: one entry per method call (with throttled noop).
          let entry: NgrxLogEntry | undefined;
          if (before && !t.watched) {
            entry = finish(t, name, args, before, true, durationMs, original, frame.trace);
          }
          // watchState path: watchState already emitted one entry per patchState.
          // If the method did not patch at all (e.g. `isSaved` just reads state),
          // append a throttled noop entry so method calls stay visible.
          if (outer && t.watched && !frame.fired) {
            entry = finish(
              t,
              name,
              args,
              t.lastWatched ?? snapshot(t),
              true,
              durationMs,
              original,
              frame.trace,
            );
          }
          if (entry?.args) (frame.logged ??= []).push(entry);
          if (outer && isThenable(result)) {
            t.asyncCalls.add(frame);
            const settle = () => void t.asyncCalls.delete(frame);
            read(() => Promise.resolve(result).then(settle, settle), undefined);
          }
        }
      },
    });
    const ok = read(() => {
      instance[name] = proxy;
      return instance[name] === proxy;
    }, false);
    if (ok) t.undo.push(() => read(() => (instance[name] = original), undefined));
  };

  const untrack = (value: object) => {
    const t = tracked.get(value);
    if (!t) return;
    tracked.delete(value);
    pendingEventByInstance.delete(t.instance);
    for (const fn of t.undo.splice(0).reverse()) fn();
  };

  const track = (
    value: object,
    scope: string,
    found: Set<object>,
    injector: unknown = null,
  ): Tracked | null => {
    const source = stateSourceOf(value);
    if (!source) return null;
    found.add(value);
    const existing = tracked.get(value);
    if (existing) {
      // Remember the first injector we saw: a store appears first in its env,
      // then again as a component field reference, and we want the env's one
      // (components come in and out, env stays).
      if (!existing.injector && injector) existing.injector = injector;
      attachWatcher(existing);
      return existing;
    }
    const stateKeys = Reflect.ownKeys(source);
    const t: Tracked = {
      id: idFor(value),
      instance: value,
      source,
      kind: typeof value === 'function' ? 'signal-state' : 'signal-store',
      className:
        typeof value === 'function'
          ? 'signalState'
          : className((value as object).constructor as { name?: string }),
      scope,
      stateKeys,
      methods: new Map(),
      references: new Set(),
      writable: stateKeys.every((k) => typeof source[k]?.set === 'function'),
      depth: 0,
      pendingBefore: null,
      lastNoop: new Map(),
      undo: [],
      injector,
      watched: false,
      lastWatched: null,
      methodStack: [],
      asyncCalls: new Set(),
      watchOnly: typeof value === 'object' && usesWithDevtools(value),
      lastSeen: null,
    };
    tracked.set(value, t);
    if (t.watchOnly) {
      // withDevtools() already watches this store; patching it as well would
      // clash with it, so the methods are only listed, not wrapped.
      for (const key of Object.keys(value)) {
        const member = (value as AnyRecord)[key];
        if (typeof member === 'function' && !isSignal(member) && !/^_{2,}/.test(key)) {
          t.methods.set(key, {
            calls: 0,
            timedCalls: 0,
            rx: typeof member?.destroy === 'function',
            totalDurationMs: 0,
          });
        }
      }
      t.lastSeen = snapshot(t);
      attachWatcher(t);
      return t;
    }
    for (const key of stateKeys) wrapSignal(t, source[key]);
    if (t.kind === 'signal-store') {
      for (const key of Object.keys(value)) {
        const member = (value as AnyRecord)[key];
        if (typeof member === 'function' && !isSignal(member)) wrapMethod(t, key);
      }
    }
    attachWatcher(t);
    return t;
  };

  const findClassic = (ng: NgrxDebugNg<H>, envs: Map<AnyRecord, string>, rootInjector: unknown) => {
    const want: Record<string, (v: AnyRecord) => boolean> = {
      Store: (v) => typeof v['dispatch'] === 'function' && typeof v['select'] === 'function',
      ScannedActionsSubject: (v) => typeof v['subscribe'] === 'function',
      ActionsSubject: (v) =>
        typeof v['subscribe'] === 'function' && typeof v['next'] === 'function',
      StoreDevtools: (v) =>
        typeof v['jumpToAction'] === 'function' || typeof v['jumpToState'] === 'function',
    };
    const out: Record<string, AnyRecord> = {};
    let scope = 'root';
    for (const [env, envName] of envs) {
      const tokens = new Set<unknown>();
      const records = read(() => env['records'] as Map<unknown, unknown> | undefined, undefined);
      if (records instanceof Map) for (const token of records.keys()) tokens.add(token);
      for (const p of read(() => ng.ɵgetInjectorProviders?.(env) ?? [], [])) tokens.add(p.token);
      for (const token of tokens) {
        const name = stripped(token);
        const accept = want[name];
        if (!accept || out[name]) continue;
        // From the injector that lists the token: a Store provided in a route's environment
        // injector is not visible from the root. The root's element injector stays the
        // fallback for an environment injector that can't be read directly.
        const value = (read(() => env['get'](token, null), null) ??
          read(
            () => (rootInjector as AnyRecord | null)?.['get'](token, null),
            null,
          )) as AnyRecord | null;
        if (value && typeof value === 'object' && accept(value)) {
          out[name] = value;
          if (name === 'Store') scope = envName;
        }
      }
    }
    return out['Store'] ? { parts: out, scope } : null;
  };

  // `Dispatcher` (from `@ngrx/signals/events`) is `providedIn: 'platform'`, resolved
  // from the environment injector that holds it, and tracked apart from `findClassic`:
  // an app can use the events plugin without @ngrx/store's classic Store.
  const findDispatcher = (
    ng: NgrxDebugNg<H>,
    envs: Map<AnyRecord, string>,
    rootInjector: unknown,
  ): AnyRecord | null => {
    for (const [env] of envs) {
      const tokens = new Set<unknown>();
      const records = read(() => env['records'] as Map<unknown, unknown> | undefined, undefined);
      if (records instanceof Map) for (const token of records.keys()) tokens.add(token);
      for (const p of read(() => ng.ɵgetInjectorProviders?.(env) ?? [], [])) tokens.add(p.token);
      for (const token of tokens) {
        if (stripped(token) !== 'Dispatcher') continue;
        const value = (read(() => env['get'](token, null), null) ??
          read(
            () => (rootInjector as AnyRecord | null)?.['get'](token, null),
            null,
          )) as AnyRecord | null;
        if (value && typeof value === 'object' && typeof value['dispatch'] === 'function') {
          return value;
        }
      }
    }
    return null;
  };

  /** Serializes and appends a `source: 'event'` log entry. Called only from
   * `reducerEvents.events$` (not `events.events$`), so each dispatch emits
   * exactly one call here — no deduplication needed. Not restorable. */
  const logEvent = (event: unknown) => {
    const record = event && typeof event === 'object' ? (event as AnyRecord) : null;
    const type = read(() => String(record?.['type'] ?? 'event'), 'event');
    // Only attach `payload` when the event actually carries one. An event
    // declared with no payload (e.g. `bookingEvents.cancelled` where the type
    // is a plain string, no `type<>` wrapper, so the dispatched object has no
    // `payload` key) would otherwise show up as `{"@type":"undefined"}` in the
    // panel and the agent tool.
    const hasPayload = !!record && 'payload' in record && record['payload'] !== undefined;
    append(
      {
        source: 'event',
        storeId: 'event',
        type,
        eventType: type,
        ...(hasPayload ? { payload: serialize(record['payload'], SMALL) } : {}),
        timestamp: Date.now(),
        diff: [],
        restorable: false,
        ...withTrace(currentEventTrace),
      },
      { kind: 'event' },
    );
  };

  /** Wraps `Dispatcher.dispatch()` itself to correlate a store's next change with the
   * event that caused it, instead of relying on subscriber order against
   * `ReducerEvents.events$` (racy: whichever of `withReducer()`'s own subscription and
   * ours subscribed first runs first). By the time the wrapped `dispatch()` returns,
   * every synchronous reaction — including any `withReducer()` tap's `patchState()` —
   * has already run, so diffing which tracked stores are newly `pendingBefore` across
   * the call identifies exactly what this dispatch caused: still best effort (which
   * case reducer matched can't be recovered), but no longer order-dependent. Snapshotting
   * the "before" set also avoids re-attributing a store that was already pending from an
   * earlier, still-unresolved dispatch to this one. */
  const wrapDispatch = (d: AnyRecord): (() => void) | undefined => {
    const original = read(() => d['dispatch'], undefined) as
      ((...args: unknown[]) => unknown) | undefined;
    if (typeof original !== 'function') return undefined;
    const own = Object.prototype.hasOwnProperty.call(d, 'dispatch');
    d['dispatch'] = function (this: unknown, ...args: unknown[]) {
      const before = new Set<Tracked>();
      for (const t of tracked.values()) if (t.pendingBefore) before.add(t);
      const event = args[0];
      const record = event && typeof event === 'object' ? (event as AnyRecord) : null;
      const info = record
        ? (() => {
            const type = read(() => String(record['type'] ?? 'event'), 'event');
            const hasPayload = 'payload' in record && record['payload'] !== undefined;
            return hasPayload ? { type, payload: serialize(record['payload'], SMALL) } : { type };
          })()
        : undefined;
      // Live only for this call (including any synchronous reaction it causes,
      // like a `withReducer()` tap's `patchState()`). A nested dispatch — e.g.
      // one event handler dispatching another — restores the outer event
      // instead of leaving its own behind.
      const previous = currentDispatchedEvent;
      const previousTrace = currentEventTrace;
      currentDispatchedEvent = info;
      // Under the wrapped dispatch.
      currentEventTrace = traceNow(1);
      let result: unknown;
      try {
        result = original.apply(this, args);
      } finally {
        currentDispatchedEvent = previous;
        currentEventTrace = previousTrace;
      }
      if (info) {
        for (const t of tracked.values()) {
          if (t.pendingBefore && !before.has(t) && !pendingEventByInstance.has(t.instance)) {
            pendingEventByInstance.set(t.instance, info);
          }
        }
      }
      return result;
    };
    return () =>
      read(() => {
        if (own) d['dispatch'] = original;
        else delete d['dispatch'];
      }, undefined);
  };

  const attachDispatcher = (d: AnyRecord): (() => void) => {
    const reducerEvents$ = read(() => d['reducerEvents']?.['events$'], undefined);
    const subs: AnyRecord[] = [];
    if (reducerEvents$) {
      const sub = read(
        () => reducerEvents$['subscribe']((event: unknown) => logEvent(event)),
        undefined,
      );
      if (sub) subs.push(sub);
    }
    const restoreDispatch = wrapDispatch(d);
    return () => {
      for (const sub of subs) read(() => sub['unsubscribe']?.(), undefined);
      restoreDispatch?.();
    };
  };

  const classicState = (store: AnyRecord) => {
    const fromSource = syncValue(store['source']);
    return fromSource !== undefined ? fromSource : syncValue(store);
  };

  const logClassic = (
    c: Classic,
    type: string,
    action: unknown,
    withAction: boolean,
  ): NgrxLogEntry => {
    const raw = classicState(c.store);
    const next = serialize(raw);
    const overflow = { more: 0 };
    let changes = diff(c.last, next, MAX_DIFF, undefined, overflow).map((entry) => ({
      ...entry,
      ...('before' in entry ? { before: serialize(entry.before, SMALL) } : {}),
      ...('after' in entry ? { after: serialize(entry.after, SMALL) } : {}),
    }));
    if (!changes.length && !overflow.more && !Object.is(c.lastRaw, raw)) {
      changes = referenceDiff(c.lastRaw, raw, '', SMALL, MAX_DIFF, undefined, overflow).map(
        (entry) => (entry.path ? entry : { ...entry, path: '(root)' }),
      );
    }
    const origin =
      withAction && action && typeof action === 'object' ? c.origins.get(action) : undefined;
    const trace =
      withAction && action && typeof action === 'object' ? c.traces.get(action) : undefined;
    const before = c.lastRaw;
    c.last = next;
    c.lastRaw = raw;
    const held = c.devtools ? holds(c.devtools, action) : false;
    return append(
      {
        source: 'store',
        storeId: 'store',
        type,
        ...(withAction
          ? {
              action: serialize(action, { depth: 5, maxKeys: 50, maxString: 1000, budget: 2000 }),
            }
          : {}),
        ...(origin ? { origin } : {}),
        timestamp: Date.now(),
        diff: changes,
        ...truncated(overflow.more),
        restorable: held,
        ...(c.devtools && !held ? { unrestorable: 'not-recorded' as const } : {}),
        ...withTrace(trace),
      },
      { kind: 'classic', action, before, after: raw },
    );
  };

  const liftedOf = (devtools: AnyRecord) =>
    syncValue(devtools['liftedState']) as AnyRecord | undefined;

  const heldActions = (devtools: AnyRecord): Set<unknown> => {
    const byId = (liftedOf(devtools)?.['actionsById'] ?? {}) as Record<string, AnyRecord>;
    return new Set(read(() => Object.values(byId).map((lifted) => lifted?.['action']), []));
  };

  const holds = (devtools: AnyRecord, action: unknown): boolean => {
    const lifted = liftedOf(devtools);
    const staged = (lifted?.['stagedActionIds'] ?? []) as number[];
    const newest = read(
      () => lifted?.['actionsById']?.[staged[staged.length - 1]]?.['action'],
      null,
    );
    if (action === undefined) return false;
    return newest === action || heldActions(devtools).has(action);
  };

  const markDropped = () => {
    const devtools = classic?.devtools;
    if (!devtools) return;
    const open = log.filter((entry) => entry.source === 'store' && entry.restorable);
    if (!open.length) return;
    const held = heldActions(devtools);
    for (const entry of open) {
      const keep = saved.get(entry.seq);
      if (keep?.kind !== 'classic' || held.has(keep.action)) continue;
      entry.restorable = false;
      entry.unrestorable = 'dropped';
      lost.push({ seq: entry.seq, reason: 'dropped', at: ++lostSeq });
    }
  };

  const isPaused = (devtools: AnyRecord | null) => {
    if (!devtools) return false;
    const lifted = liftedOf(devtools);
    const index = lifted?.['currentStateIndex'];
    const states = lifted?.['computedStates'];
    return typeof index === 'number' && Array.isArray(states) && index < states.length - 1;
  };

  /**
   * Classic-store counterpart to {@link wrapDispatch} above: tags each dispatched
   * action with where it came from (`dispatch` call, an `Effect` using `next`,
   * or a `dispatch(() => action)` reactive form). Renamed from `wrapDispatch`
   * so it no longer collides with the events-plugin wrapper of the same name.
   */
  const wrapClassicDispatch = (
    store: AnyRecord,
    origins: WeakMap<object, NgrxActionOrigin>,
    traces: WeakMap<object, string[]>,
  ) => {
    let active = true;
    let reactive: unknown;
    const tag = (action: unknown, origin: NgrxActionOrigin) => {
      if (!active || !action || typeof action !== 'object') return;
      origins.set(action, origin);
      // Under tag and the wrapped dispatch or next.
      const trace = traceNow(2);
      if (trace) traces.set(action, trace);
    };
    const undo: (() => void)[] = [];
    const replace = (name: 'dispatch' | 'next', wrapper: (original: Method) => Method) => {
      const original = store[name] as Method;
      if (typeof original !== 'function') return;
      const own = Object.prototype.hasOwnProperty.call(store, name);
      const ok = read(() => {
        store[name] = wrapper(original);
        return store[name] !== original;
      }, false);
      if (!ok) return;
      undo.push(() =>
        read(() => {
          if (own) store[name] = original;
          else delete store[name];
        }, undefined),
      );
    };
    replace(
      'dispatch',
      (original) =>
        function (this: unknown, action: unknown, ...rest: unknown[]) {
          if (typeof action === 'function') {
            const fn = action as () => unknown;
            const wrapped = function (this: unknown) {
              const next = fn.call(this);
              if (active) reactive = next;
              return next;
            };
            return original.call(this, wrapped, ...rest);
          }
          const fromSignal = action !== undefined && action === reactive;
          reactive = undefined;
          tag(action, fromSignal ? 'reactive' : 'dispatch');
          return original.call(this, action, ...rest);
        },
    );
    replace(
      'next',
      (original) =>
        function (this: unknown, action: unknown, ...rest: unknown[]) {
          tag(action, 'effect');
          return original.call(this, action, ...rest);
        },
    );
    return () => {
      active = false;
      reactive = undefined;
      for (const fn of undo.splice(0).reverse()) fn();
    };
  };

  const attachClassic = ({
    parts: found,
    scope,
  }: {
    parts: Record<string, AnyRecord>;
    scope: string;
  }) => {
    const store = found['Store'];
    const devtools = found['StoreDevtools'] ?? null;
    const raw = classicState(store);
    const c: Classic = {
      store,
      devtools,
      scope,
      last: serialize(raw),
      lastRaw: raw,
      origins: new WeakMap(),
      traces: new WeakMap(),
      stop: () => {},
    };
    const undo = wrapClassicDispatch(store, c.origins, c.traces);
    const record = (action: unknown) => {
      const type = read(() => String((action as AnyRecord)['type'] ?? 'action'), 'action');
      logClassic(c, type, action, true);
    };
    const scanned = found['ScannedActionsSubject'];
    const actions = found['ActionsSubject'];
    let sub: AnyRecord | undefined;
    if (scanned) {
      sub = read(() => scanned['subscribe'](record), undefined);
    } else if (actions) {
      let first = true;
      sub = read(
        () =>
          actions['subscribe']((action: unknown) => {
            if (first) {
              first = false;
              return;
            }
            queueMicrotaskOutside(() => record(action));
          }),
        undefined,
      );
    }
    c.stop = () => {
      read(() => sub?.['unsubscribe']?.(), undefined);
      undo();
    };
    return c;
  };

  let discovered = false;
  const discover = (ng: NgrxDebugNg<H>) => {
    const found = new Set<object>();
    const envs = new Map<AnyRecord, string>();
    const elements = componentElements(ng, tree);
    let rootInjector: unknown = null;

    const perElement: { el: H; injector: unknown; component: AnyRecord | null }[] = [];
    for (const el of elements) {
      const injector = read(() => ng.getInjector!(el), null);
      if (!injector) continue;
      rootInjector ??= injector;
      const path = read(() => ng.ɵgetInjectorResolutionPath?.(injector) ?? [], [] as unknown[]);
      for (const candidate of path) {
        const env = candidate as AnyRecord;
        if (env && !envs.has(env) && read(() => env['records'] instanceof Map, false)) {
          envs.set(env, envScope(ng, env));
        }
      }
      perElement.push({
        el,
        injector,
        component: read(() => (ng.getComponent?.(el) as AnyRecord) ?? null, null),
      });
    }

    for (const [env, scope] of envs) {
      const records = env['records'] as Map<unknown, AnyRecord | undefined>;
      for (const record of read(() => [...records.values()], [] as (AnyRecord | undefined)[])) {
        const value = record?.['value'];
        if (value && (typeof value === 'object' || typeof value === 'function')) {
          track(value, scope, found, env);
        }
      }
    }

    for (const { el, injector, component } of perElement) {
      const owner = component ? className(component.constructor) : tree.tag(el);
      for (const p of read(() => ng.ɵgetInjectorProviders?.(injector) ?? [], [])) {
        const tname = stripped(p.token);
        if (/^SignalStore\d*$/.test(tname)) {
          const value = read(
            () => (injector as AnyRecord)['get'](p.token, null, { self: true, optional: true }),
            null,
          );
          if (value && typeof value === 'object') {
            track(value, `${owner} (component)`, found, injector);
          }
        } else if (tname === 'Dispatcher') {
          // A component can provide its own scoped Dispatcher via provideDispatcher().
          // Resolve with self:true so we only get the one this component owns, not the
          // platform-wide one (which findDispatcher already handles separately).
          const value = read(
            () => (injector as AnyRecord)['get'](p.token, null, { self: true, optional: true }),
            null,
          ) as AnyRecord | null;
          if (
            value &&
            typeof value === 'object' &&
            typeof value['dispatch'] === 'function' &&
            !attachedDispatchers.has(value)
          ) {
            attachedDispatchers.add(value);
            const detach = attachDispatcher(value);
            componentDispatcherUndos.get(el)?.();
            componentDispatcherUndos.set(el, () => {
              detach();
              attachedDispatchers.delete(value);
            });
          }
        }
      }
    }

    for (const t of tracked.values()) t.references.clear();
    for (const { injector, component } of perElement) {
      if (!component) continue;
      const owner = className(component.constructor);
      for (const key of read(() => Object.keys(component), [] as string[])) {
        const value = read(() => component[key], undefined);
        if (!value || (typeof value !== 'object' && typeof value !== 'function')) continue;
        const t = track(value, `${owner} (field)`, found, injector);
        t?.references.add(`${owner}.${key}`);
      }
    }

    for (const key of [...tracked.keys()]) if (!found.has(key)) untrack(key);

    // Release component-scoped Dispatcher subscriptions for destroyed elements.
    const currentEls = new Set(perElement.map((p) => p.el));
    for (const [el, undo] of [...componentDispatcherUndos.entries()]) {
      if (!currentEls.has(el)) {
        undo();
        componentDispatcherUndos.delete(el);
      }
    }

    // A lazy route can bring its own Store later: a new environment injector earns new tries.
    let newEnv = false;
    for (const env of envs.keys()) {
      if (classicEnvs.has(env)) continue;
      classicEnvs.add(env);
      newEnv = true;
    }
    if (newEnv) classicMisses = 0;
    if (!classic && classicMisses < 5) {
      const found = findClassic(ng, envs, rootInjector);
      if (found) classic = attachClassic(found);
      else if (envs.size) classicMisses++;
    }

    // `Dispatcher` is `providedIn: 'platform'`, so it only materializes once
    // something injects it. In a demo like `/ -> /booking`, that may happen
    // long after the initial discovery. Keep looking every pass instead of
    // giving up after a few misses — the lookup is cheap (map and provider
    // scan, no new work) and stops as soon as the Dispatcher appears.
    if (!dispatcher) {
      const found = findDispatcher(ng, envs, rootInjector);
      if (found && !attachedDispatchers.has(found)) {
        dispatcher = found;
        attachedDispatchers.add(found);
        dispatcherUndo = attachDispatcher(found);
      }
    }
  };

  // `withEntities()` is literally `withState({ entityMap, ids })` (or
  // `${collection}EntityMap`/`${collection}Ids`) plus a computed `entities` selector: it
  // adds nothing our collector doesn't already track as plain state/computed. This finds
  // those key pairs (by the same naming convention `withEntities` itself uses) and
  // summarizes them; it never removes `entityMap`/`ids` from `state`. `selectedId` is not
  // a real @ngrx/signals API, just a common app convention, so it's read best-effort.
  const entitiesOf = (
    t: Tracked,
    computedKeys: ReadonlySet<string>,
  ): NgrxSignalStoreInfo['entities'] => {
    const stateNames = new Set(t.stateKeys.map(String));
    const out: NonNullable<NgrxSignalStoreInfo['entities']> = [];
    for (const key of t.stateKeys) {
      const name = String(key);
      let collection: string | undefined;
      if (name === 'entityMap') collection = undefined;
      else {
        const match = /^(.+)EntityMap$/.exec(name);
        if (!match) continue;
        collection = match[1];
      }
      const idsKey = collection ? `${collection}Ids` : 'ids';
      if (!stateNames.has(idsKey)) continue;
      const idsRaw = read(() => peek(t.source[idsKey]), undefined);
      if (!Array.isArray(idsRaw)) continue;
      const entityMapRaw = read(() => peek(t.source[key]), undefined) as
        Record<PropertyKey, unknown> | undefined;
      const entitiesKey = collection ? `${collection}Entities` : 'entities';
      const entry: NonNullable<NgrxSignalStoreInfo['entities']>[number] = {
        ...(collection ? { collection } : {}),
        idsKey,
        entityMapKey: name,
        ...(computedKeys.has(entitiesKey) ? { entitiesKey } : {}),
        ids: read(() => serialize(idsRaw, ENTITY_IDS_SMALL), []) as (string | number)[],
        count: idsRaw.length,
      };
      const selectedIdKey = collection ? `${collection}SelectedId` : 'selectedId';
      if (stateNames.has(selectedIdKey)) {
        const selectedId = read(() => peek(t.source[selectedIdKey]), undefined);
        // `null` is the common "nothing selected yet" sentinel (e.g. `selectedId: string | null`);
        // treat it the same as absent instead of resolving `entityMap[null]` to a bogus "Selected" row.
        if (selectedId !== undefined && selectedId !== null) {
          entry.selectedIdKey = selectedIdKey;
          entry.selectedId = read(() => serialize(selectedId, SMALL), undefined);
          // Only set `selected` when the id actually resolves to an entity. A stale/dangling
          // id (removed from the collection but still referenced) leaves `selected` unset
          // rather than a serialized "undefined" marker, so the panel can tell "no match" apart
          // from a legitimate falsy entity value.
          const match = entityMapRaw?.[selectedId as PropertyKey];
          if (match !== undefined) {
            entry.selected = read(() => serializeSlice(selectedIdKey, match), undefined);
          }
        }
      }
      out.push(entry);
    }
    return out.length ? out : undefined;
  };

  /**
   * A `withDevtools()` store without `watchState` registered: nothing tells
   * the collector about a write, so each collect compares the state fields
   * by reference and logs the writes since the last one as one entry.
   */
  const compareWatchOnly = (t: Tracked) => {
    if (t.watched) return;
    const current = snapshot(t);
    const before = t.lastSeen;
    t.lastSeen = current;
    if (!before || t.stateKeys.every((key) => Object.is(before[key], current[key]))) return;
    finish(t, 'patchState', undefined, before);
  };

  /**
   * One signal store's report, rebuilt only when a raw value it is made of
   * changed (`ngrx-report-memo.ts`), so an unchanged store is not serialized.
   */
  const storeInfo = (t: Tracked): NgrxSignalStoreInfo => {
    const stateRaw = t.stateKeys.map((key) => peek(t.source[key]));
    const computedRaw: [string, unknown][] = [];
    if (t.kind === 'signal-store') {
      const stateNames = new Set(t.stateKeys.map(String));
      for (const key of Object.keys(t.instance)) {
        if (stateNames.has(key)) continue;
        const member = (t.instance as AnyRecord)[key];
        if (!isSignal(member)) continue;
        computedRaw.push([key, read(() => untracked(member as () => unknown), UNREADABLE)]);
      }
    }
    const methods = [...t.methods].map(([name, info]) => ({
      name,
      calls: info.calls,
      ...(info.rx ? { rx: true } : {}),
      ...(info.lastDurationMs !== undefined ? { lastDurationMs: info.lastDurationMs } : {}),
      ...(info.timedCalls > 0
        ? { avgDurationMs: Math.round(info.totalDurationMs / info.timedCalls) }
        : {}),
    }));
    const references = [...t.references].sort();
    const key = [
      t.stateKeys,
      t.scope,
      t.className,
      t.writable,
      JSON.stringify(methods),
      references.join('\n'),
      ...stateRaw,
      ...computedRaw.flat(),
    ];
    return storeReports.get(t, key, () => {
      const state: Record<string, unknown> = {};
      t.stateKeys.forEach((name, i) => {
        state[String(name)] = serializeSlice(name, stateRaw[i]);
      });
      const computed: Record<string, unknown> = {};
      for (const [name, raw] of computedRaw) {
        computed[name] =
          raw === UNREADABLE
            ? { ...COULD_NOT_READ }
            : read(() => serializeSlice(name, raw, { budget: 5000 }), { ...COULD_NOT_READ });
      }
      const entities =
        t.kind === 'signal-store' ? entitiesOf(t, new Set(Object.keys(computed))) : undefined;
      return {
        id: t.id,
        kind: t.kind,
        className: t.className,
        scope: t.scope,
        stateKeys: t.stateKeys.map(String),
        state,
        computed,
        ...(entities ? { entities } : {}),
        methods,
        references,
        writable: t.writable,
        ...(t.watchOnly ? { watchOnly: true as const } : {}),
      };
    });
  };

  /** The classic store's report, rebuilt only when its state or flags changed. */
  const classicInfo = (c: Classic): NgrxClassicStoreInfo => {
    const raw = classicState(c.store);
    const paused = isPaused(c.devtools);
    const lifted = c.devtools ? liftedOf(c.devtools) : undefined;
    const recording = lifted?.['isPaused'] === true;
    const skippedIds = lifted?.['skippedActionIds'];
    const key = [raw, c.lastRaw, c.last, !!c.devtools, c.scope, paused, recording, skippedIds];
    return classicReports.get(c, key, () => {
      const skipped = skippedSeqs(lifted);
      return {
        // `last` already holds `serialize(lastRaw)`, so the state is serialized
        // again only when the store emitted a new object since then.
        state: Object.is(raw, c.lastRaw) ? c.last : serialize(raw),
        devtools: !!c.devtools,
        scope: c.scope,
        ...(paused ? { paused: true } : {}),
        ...(recording ? { recordingPaused: true as const } : {}),
        ...(skipped.length ? { skipped } : {}),
      };
    });
  };

  /** The log entries whose actions Store DevTools skips. */
  const skippedSeqs = (lifted: AnyRecord | undefined): number[] => {
    const ids = lifted?.['skippedActionIds'];
    if (!Array.isArray(ids) || !ids.length) return [];
    const byId = (lifted?.['actionsById'] ?? {}) as Record<string, AnyRecord>;
    const actions = new Set(read(() => ids.map((id) => byId[id]?.['action']), [] as unknown[]));
    const out: number[] = [];
    for (const entry of log) {
      const keep = saved.get(entry.seq);
      if (keep?.kind === 'classic' && entry.action !== undefined && actions.has(keep.action)) {
        out.push(entry.seq);
      }
    }
    return out;
  };

  const report = () => {
    const stores = [...tracked.values()].map(storeInfo);
    const classicReport = classic ? classicInfo(classic) : null;
    return {
      stores,
      classic: classicReport,
      version: reportVersion.stamp([...stores, classicReport]),
    };
  };

  const collect = (rediscover = true) => {
    const ng = getNg();
    if (!ng?.getInjector) {
      return {
        stores: [] as NgrxSignalStoreInfo[],
        classic: null,
        version: reportVersion.stamp([]),
      };
    }
    if (rediscover || !discovered) {
      discover(ng);
      discovered = true;
    }
    markDropped();
    for (const t of tracked.values()) if (t.watchOnly) compareWatchOnly(t);
    return report();
  };

  const PAUSED_NOTE =
    'The store is paused on this state: new actions are logged but do not change the state until you go back to the latest state.';

  const backToLatest = (): NgrxRequestResult => {
    const c = classic;
    const devtools = c?.devtools;
    if (!c || !devtools) {
      return { error: 'Time travel for @ngrx/store needs provideStoreDevtools() in the app.' };
    }
    const lifted = liftedOf(devtools);
    const staged = (lifted?.['stagedActionIds'] ?? []) as number[];
    if (!staged.length) return { error: 'Store DevTools holds no actions.' };
    if (!isPaused(devtools))
      return { ok: true, message: 'The store is already on the latest state.' };
    const lastId = staged[staged.length - 1];
    if (typeof devtools['jumpToState'] === 'function') devtools['jumpToState'](staged.length - 1);
    else devtools['jumpToAction'](lastId);
    const actionsById = (lifted?.['actionsById'] ?? {}) as Record<string, AnyRecord>;
    logClassic(c, 'Back to latest', actionsById[lastId]?.['action'], false);
    return { ok: true, message: 'Back on the latest state. New actions change the state again.' };
  };

  /** The Store DevTools id of the action logged as `seq`, or the reason there is none. */
  const liftedIdOf = (seq: number): { id: number } | { error: string } => {
    const keep = saved.get(seq);
    const logged = log.find((e) => e.seq === seq);
    if (!keep || !logged) return { error: 'This action is no longer in the page history.' };
    if (keep.kind !== 'classic' || logged.action === undefined) {
      return { error: 'Only an @ngrx/store action from the log can be skipped or included.' };
    }
    const lifted = liftedOf(classic!.devtools!);
    const byId = (lifted?.['actionsById'] ?? {}) as Record<string, AnyRecord>;
    const id = Object.keys(byId).find((key) => byId[key]?.['action'] === keep.action);
    if (id === undefined) return { error: NOT_HELD[logged.unrestorable ?? 'dropped'] };
    return { id: Number(id) };
  };

  const devtoolsOp = (request: NgrxDevtoolsRequest): NgrxRequestResult => {
    const problem = devtoolsProblem(request);
    if (problem) return { error: problem };
    const c = classic;
    const devtools = c?.devtools;
    if (!c || !devtools) {
      return { error: 'The Store DevTools history needs provideStoreDevtools() in the app.' };
    }
    // An entry for the operation itself, so the log shows where the state jumped.
    const logOp = (label: string) => {
      const entry = logClassic(c, label, undefined, false);
      delete entry.unrestorable;
    };
    const call = (name: string, ...args: unknown[]) => {
      if (typeof devtools[name] !== 'function') return false;
      devtools[name](...args);
      return true;
    };
    const missing = (name: string) => ({
      error: `This version of Store DevTools has no ${name}().`,
    });
    switch (request.op) {
      case 'toggle': {
        const found = liftedIdOf(request.seq!);
        if ('error' in found) return found;
        if (!call('toggleAction', found.id)) return missing('toggleAction');
        const skipped = ((liftedOf(devtools)?.['skippedActionIds'] ?? []) as number[]).includes(
          found.id,
        );
        logOp(`Store DevTools: ${skipped ? 'skip' : 'include'} #${request.seq}`);
        return {
          ok: true,
          message: skipped
            ? `Skipped action #${request.seq}: the state is computed again without it.`
            : `Included action #${request.seq} again.`,
        };
      }
      case 'jump': {
        if (request.seq !== undefined) {
          // A jump moves the Store DevTools history; it never restores a signal store.
          if (saved.get(request.seq)?.kind === 'signal') {
            return { error: 'Only @ngrx/store entries can be used for a Store DevTools jump.' };
          }
          return run({ type: 'restore', seq: request.seq });
        }
        const staged = (liftedOf(devtools)?.['stagedActionIds'] ?? []) as number[];
        const index = request.index!;
        if (index >= staged.length) {
          return {
            error: `Store DevTools holds ${staged.length} state${staged.length === 1 ? '' : 's'} (0 to ${staged.length - 1}).`,
          };
        }
        if (!call('jumpToState', index)) return missing('jumpToState');
        logOp(`Store DevTools: jump to state ${index}`);
        const message =
          index === 0
            ? 'Jumped to the committed state.'
            : `Jumped to Store DevTools state ${index}.`;
        const paused = isPaused(devtools);
        return { ok: true, paused, message: paused ? `${message} ${PAUSED_NOTE}` : message };
      }
      case 'commit': {
        if (!call('commit')) return missing('commit');
        logOp('Store DevTools: commit');
        markDropped();
        return {
          ok: true,
          message:
            'Committed: the current state is the new starting point, and the earlier actions can no longer be restored.',
        };
      }
      case 'reset': {
        if (!call('reset')) return missing('reset');
        logOp('Store DevTools: reset');
        markDropped();
        return {
          ok: true,
          message:
            'Reset: the store is back on its initial state and the Store DevTools history is empty.',
        };
      }
      case 'pause': {
        const now = liftedOf(devtools)?.['isPaused'] === true;
        const paused = request.paused ?? !now;
        if (!call('pauseRecording', paused)) return missing('pauseRecording');
        onChange();
        return {
          ok: true,
          message: paused
            ? 'Recording paused: new actions still change the state, but Store DevTools does not record them, so they cannot be restored.'
            : 'Recording again: Store DevTools records new actions.',
        };
      }
    }
  };

  const NOT_HELD: Record<NgrxUnrestorable, string> = {
    dropped:
      'Store DevTools no longer holds this action, so it cannot be restored. It was dropped past maxAge, or the Store DevTools history was committed, reset or imported.',
    'not-recorded':
      'Store DevTools never recorded this action, so it cannot be restored. An actionsBlocklist, actionsSafelist or predicate option filtered it out, or recording was paused.',
  };

  const dispatch = (action: Record<string, unknown>, label: string): NgrxRequestResult => {
    const c = classic;
    if (!c) return { error: 'No @ngrx/store Store was found on this page.' };
    const after = seq;
    c.store['dispatch'](action);
    const entry = log.find(
      (e) => e.seq > after && (saved.get(e.seq) as AnyRecord)?.['action'] === action,
    );
    const paused = isPaused(c.devtools) ? ` ${PAUSED_NOTE}` : '';
    if (!entry) {
      return {
        ok: true,
        message: `Dispatched ${label}. Its log entry appears once the store handles it.${paused}`,
      };
    }
    return { ok: true, message: `Dispatched ${label} as #${entry.seq}.${paused}`, entry };
  };

  const dispatchAgain = (at: unknown): NgrxRequestResult => {
    if (typeof at !== 'number') return { error: 'Unknown request.' };
    const entry = log.find((e) => e.seq === at);
    const keep = saved.get(at);
    if (!entry || !keep) return { error: 'This action is no longer in the page history.' };
    if (keep.kind !== 'classic' || entry.action === undefined) {
      return { error: 'Only an @ngrx/store action from the log can be dispatched again.' };
    }
    const raw = keep.action;
    if (!raw || typeof raw !== 'object')
      return { error: 'This action cannot be dispatched again.' };
    return dispatch({ ...(raw as Record<string, unknown>) }, `#${at} again`);
  };

  const history: HistorySource = {
    entries: () => log,
    states: (at) => {
      const keep = saved.get(at);
      const entry = log.find((e) => e.seq === at);
      if (!keep || !entry || keep.kind === 'event') return null;
      if (keep.kind === 'classic')
        return { storeId: 'store', before: keep.before, after: keep.after };
      const named = (snap: Snapshot) =>
        Object.fromEntries(keep.tracked.stateKeys.map((k) => [String(k), snap[k]]));
      return { storeId: entry.storeId, before: named(keep.before), after: named(keep.after) };
    },
    storeOf: (storeId) => {
      if (storeId === 'store') return classic ? { kind: 'store', name: 'Store' } : null;
      for (const t of tracked.values()) {
        if (t.id === storeId) return { kind: t.kind, name: t.className };
      }
      return null;
    },
  };

  const run = (request: NgrxRequest): NgrxRequestResult => {
    if (request?.type === 'entry' || request?.type === 'export') {
      return historyRequest(history, request);
    }
    if (request?.type === 'latest') return backToLatest();
    if (request?.type === 'dispatch') {
      const problem = dispatchProblem(request.action, request.payload);
      if (problem) return { error: problem };
      return dispatch({ ...(request.payload ?? {}), type: request.action }, request.action);
    }
    if (request?.type === 'dispatch-again') return dispatchAgain(request.seq);
    if (request?.type === 'devtools') return devtoolsOp(request);
    if (!request || request.type !== 'restore' || typeof request.seq !== 'number') {
      return { error: 'Unknown request.' };
    }
    const entry = saved.get(request.seq);
    if (!entry) return { error: 'This change is no longer in the page history.' };
    if (entry.kind === 'event') {
      return { error: 'This is a dispatched event, not a state change, and cannot be restored.' };
    }
    if (entry.kind === 'signal') {
      const t = entry.tracked;
      if (!tracked.has(t.instance)) return { error: 'This store no longer exists on the page.' };
      if (!t.writable) return { error: 'This store state is read-only.' };
      flushPending(t);
      const before = snapshot(t);
      const patch: Record<PropertyKey, unknown> = {};
      for (const key of t.stateKeys) {
        if (entry.after[key] !== peek(t.source[key])) patch[key] = entry.after[key];
      }
      const patchState = t.kind === 'signal-store' ? registeredPatchState() : null;
      const label = `Restore #${request.seq}`;
      // Push a frame so the watchState callback labels its entry with the restore type
      // instead of `patchState`, and so finish() below knows the call already fired.
      const frame = { name: label, args: [] as unknown[], startedAt: now(), fired: 0 };
      t.methodStack.push(frame);
      t.depth++;
      try {
        if (patchState) {
          patchState(t.instance, patch);
        } else {
          for (const key of Reflect.ownKeys(patch)) t.source[key].set(patch[key]);
        }
      } finally {
        t.methodStack.pop();
        t.depth--;
      }
      if (patchState) {
        // When watchState is attached, appendChange already emitted one entry from
        // inside patchState; skip finish to avoid a duplicate.
        if (!t.watched) finish(t, label, undefined, before);
        return { ok: true, message: `Restored the state after change #${request.seq}.` };
      }
      finish(t, `${label} (watchState listeners not notified)`, undefined, before);
      return {
        ok: true,
        message: `Restored the state after change #${request.seq}. Call registerNgrxSignals({ patchState, watchState }) so watchState listeners run on restore.`,
      };
    }
    const c = classic;
    const devtools = c?.devtools;
    if (!c || !devtools) {
      return { error: 'Time travel for @ngrx/store needs provideStoreDevtools() in the app.' };
    }
    const lifted = liftedOf(devtools);
    const actionsById = (lifted?.['actionsById'] ?? {}) as Record<string, AnyRecord>;
    const id = Object.keys(actionsById).find(
      (key) => actionsById[key]?.['action'] === entry.action,
    );
    const logged = log.find((e) => e.seq === request.seq);
    const notHeld = () => {
      const reason = logged?.unrestorable ?? 'dropped';
      if (logged && logged.restorable) {
        logged.restorable = false;
        logged.unrestorable = reason;
        lost.push({ seq: logged.seq, reason, at: ++lostSeq });
        onChange();
      }
      return { error: NOT_HELD[reason] };
    };
    if (id === undefined) return notHeld();
    if (typeof devtools['jumpToAction'] === 'function') devtools['jumpToAction'](Number(id));
    else {
      const index = ((lifted?.['stagedActionIds'] ?? []) as number[]).indexOf(Number(id));
      if (index < 0) return notHeld();
      devtools['jumpToState'](index);
    }
    logClassic(c, `Restore #${request.seq}`, entry.action, false);
    const message = `Jumped to the state after action #${request.seq}.`;
    const paused = isPaused(devtools);
    return { ok: true, paused, message: paused ? `${message} ${PAUSED_NOTE}` : message };
  };

  return {
    collect: (rediscover) => withRedactionScope(() => collect(rediscover)),
    logSince: (after) => log.filter((entry) => entry.seq > after),
    lastSeq: () => seq,
    argsRedactedSince: (after) => ({
      seqs: masked.filter((u) => u.at > after).map((u) => u.seq),
      last: maskedSeq,
    }),
    unrestorableSince: (after) => ({
      updates: lost.filter((u) => u.at > after).map(({ seq, reason }) => ({ seq, reason })),
      last: lostSeq,
    }),
    run,
    stats: () => ({ stats: statsReport(), version: statsVersion }),
    rawState: (storeId) => {
      if (storeId === 'store') return classic ? { value: classicState(classic.store) } : null;
      for (const t of tracked.values()) {
        if (t.id === storeId) return { value: { ...snapshot(t) } };
      }
      return null;
    },
    stop: () => {
      classic?.stop();
      dispatcherUndo?.();
      for (const [, fn] of componentDispatcherUndos) fn();
      componentDispatcherUndos.clear();
      for (const key of [...tracked.keys()]) untrack(key);
    },
  };
}
