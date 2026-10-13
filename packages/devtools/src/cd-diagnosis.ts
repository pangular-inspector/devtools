import { UNNAMED_SIGNAL } from './cd-data.ts';
import { PROFILER_EVENT } from './cd-recorder.ts';
import { listenerName } from './cd-timing.ts';
import type {
  CdCause,
  CdCauseKind,
  CdDiagnosis,
  CdInputStat,
  CdWasteStat,
  CdZoneStat,
} from './config.ts';
import { className } from './injector-tree.ts';
import { installSignalWriteHook, type RawSignalNode } from './signal-history.ts';
import { rawNodeOf } from './signal-resources.ts';
import { appFrames, captureStack } from './signal-stack.ts';

/**
 * The `NotificationSource` values Angular passes to
 * `ChangeDetectionSchedulerImpl.notify`, checked against the scheduler and
 * its callers in `@angular/core/fesm2022/_debug_node-chunk.mjs` and
 * `_pending_tasks-chunk.mjs` (Angular 22). The enum is `const`, so the
 * numbers are all a build has.
 */
export const NOTIFY = {
  /** `markAncestorsForTraversal`: a signal a template read changed. */
  MarkAncestorsForTraversal: 0,
  SetInput: 1,
  DeferBlockStateUpdate: 2,
  DebugApplyChanges: 3,
  MarkForCheck: 4,
  /** `wrapListener`: a template listener runs. */
  Listener: 5,
  CustomElement: 6,
  RenderHook: 7,
  ViewAttached: 8,
  ViewDetachedFromDOM: 9,
  AsyncAnimationsLoaded: 10,
  PendingTaskRemoved: 11,
  RootEffect: 12,
  ViewEffect: 13,
} as const;

/** What each notification says about the cause. Missing ones (11) don't make Angular refresh views. */
const NOTIFY_KIND: Partial<Record<number, CdCauseKind>> = {
  0: 'signal',
  1: 'input',
  2: 'view',
  3: 'view',
  4: 'markForCheck',
  5: 'event',
  6: 'view',
  7: 'view',
  8: 'view',
  9: 'view',
  10: 'view',
  12: 'effect',
  13: 'effect',
};

/** Notifications that make Angular refresh views (`dirtyFlags` 1, 2, 4 or 16), not only run afterRender hooks. */
const REFRESHING = new Set<number>([0, 1, 2, 3, 4, 5, 6, 12, 13]);

/** A notification that does not refresh views is dropped after this long without a tick. */
const STALE_MS = 100;
/** Inputs compared per class, and items compared per input. */
const MAX_INPUTS = 30;
const MAX_ITEMS = 50;
/** Classes and inputs the diagnosis keeps totals for. */
const MAX_CLASSES = 1000;
const MAX_INPUT_ROWS = 500;
/** Rows a snapshot lists. */
const LISTED_CLASSES = 100;
const LISTED_ROWS = 50;
const MAX_TASKS = 3;
const MAX_TEXT = 200;

/**
 * Frames of Angular's HTTP backends. The XHR backend answers in a `load`
 * event, which the event target already shows; the fetch backend answers in
 * a promise, so only the stack shows it.
 */
const HTTP_FRAME =
  /\b_?(FetchBackend|HttpXhrBackend|HttpInterceptorHandler)\b|@angular[/_]common[/_]http/;
const TIMER_TASK =
  /^(setTimeout|setInterval|setImmediate|requestAnimationFrame|webkitRequestAnimationFrame|mozRequestAnimationFrame)$/;
const HTTP_TASK = /XMLHttpRequest|fetch|JSONP/i;
/** Class names in stack frames that are not app classes. */
const NOT_APP_CLASS =
  /^(HTML|SVG|Window|Promise|Object|Array|Function|Timeout|XMLHttpRequest|EventTarget|Zone|Generator|AsyncGenerator|Map|Set)\b/;

type Ctor = object;
type AnyRecord = Record<string, unknown>;

/** The fields of Angular's `ChangeDetectionSchedulerImpl` this module reads or wraps. */
interface SchedulerLike {
  notify(source: number): void;
  runningTick?: boolean;
}

interface ZoneTask {
  type?: string;
  source?: string;
}

interface ZoneApi {
  current?: { get?(key: string): unknown };
  currentTask?: ZoneTask | null;
}

interface DebugNg {
  getInjector?(el: Element): unknown;
  ɵgetInjectorResolutionPath?(injector: unknown): unknown[];
  getDirectiveMetadata?(instance: unknown): {
    inputs?: Record<string, unknown>;
    changeDetection?: number;
  } | null;
}

interface Pending {
  source: number;
  at: number;
  event?: string;
  target?: string;
  http: boolean;
  task?: string;
  signal?: string;
  stack?: string[];
  owner?: unknown;
  listener?: unknown;
  more: number;
}

interface Frame {
  /** The context of the first template Angular ran in this check: the component itself when it was refreshed. */
  first: unknown;
  changed: boolean;
}

interface CycleInfo {
  cause: CdCause;
  refreshed: number;
  unchanged: number;
}

interface ClassMeta {
  inputs: [publicName: string, prop: string][];
  strategy?: 'OnPush' | 'Eager';
  component: boolean;
}

interface Snap {
  ref: unknown;
  items?: unknown[];
}

const NONE = Symbol('none');

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const ctorOf = (instance: unknown): Ctor | null => {
  const ctor = (instance as { constructor?: unknown } | null)?.constructor;
  return typeof ctor === 'function' ? ctor : null;
};

const nameOf = (instance: unknown): string => {
  const ctor = ctorOf(instance);
  return ctor ? className(ctor as { name?: string }) : '?';
};

const cut = (value: string) => value.slice(0, MAX_TEXT);

/**
 * The component whose compiled template function `name` is: `HttpExample` for
 * `HttpExample_For_3_Template_button_click_0_listener` or `App_Template`. The
 * compiler names a view `<parent>_<suffix>_<slot>_Template`, the suffix being a
 * control flow block or a lowercase tag such as `ng_template`.
 */
export function templateOwner(name: string): string | undefined {
  const match =
    /^(.+?)_(?:Template(?:_|$)|(?:For|ForEmpty|Conditional|Case|ProjectionFallback|Defer[A-Za-z]*|[a-z][a-z0-9_]*?)_\d+_)/.exec(
      name.replace(/^_+/, ''),
    );
  return match ? match[1] : undefined;
}

/**
 * Who a listener belongs to. Angular passes the view's context, which in an
 * `@for`, `@if` or `<ng-template>` is a context object (`RepeaterContext`,
 * `NgIfContext`), not a component; the listener's compiled name then gives the
 * component. Undefined when neither does.
 */
function ownerName(instance: unknown, listener: string): string | undefined {
  const ctor = ctorOf(instance);
  const def = ctor ? read(() => ('ɵcmp' in ctor ? true : 'ɵdir' in ctor), false) : false;
  if (def) return nameOf(instance);
  return listener ? templateOwner(listener) : undefined;
}

function isScheduler(value: unknown): value is SchedulerLike {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as AnyRecord)['notify'] === 'function' &&
    'runningTick' in value &&
    'appRef' in value
  );
}

/**
 * Angular's change detection scheduler (`ChangeDetectionSchedulerImpl`),
 * found among the values the app's environment injectors already hold,
 * through `ng.getInjector` and `ng.ɵgetInjectorResolutionPath`. Nothing is
 * created. Null when the page has no such scheduler (before Angular 18).
 */
export function findCdScheduler(ng: unknown, roots: Iterable<Element>): SchedulerLike | null {
  const api = ng as DebugNg | null;
  if (!api || typeof api.getInjector !== 'function') return null;
  for (const root of roots) {
    const injector = read(() => api.getInjector!(root), null);
    if (!injector) continue;
    const path = read(() => api.ɵgetInjectorResolutionPath?.(injector) ?? [], [] as unknown[]);
    for (const each of path) {
      const records = read(() => (each as { records?: unknown } | null)?.records, undefined);
      if (!(records instanceof Map)) continue;
      for (const record of records.values()) {
        const value = read(() => (record as { value?: unknown } | null)?.value, undefined);
        if (isScheduler(value)) return value;
      }
    }
  }
  return null;
}

/** The items of an object input to compare by identity, or undefined for a primitive or function. */
function itemsOf(value: unknown): unknown[] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return read(() => {
    if (Array.isArray(value)) return [value.length, ...value.slice(0, MAX_ITEMS)];
    if (value instanceof Map) {
      const items: unknown[] = [value.size];
      for (const [key, item] of value) {
        if (items.length > MAX_ITEMS * 2) break;
        items.push(key, item);
      }
      return items;
    }
    if (value instanceof Set) return [value.size, ...[...value].slice(0, MAX_ITEMS)];
    // Dates, elements and other class instances keep their state where a shallow look misses it.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return undefined;
    const keys = Object.keys(value).slice(0, MAX_ITEMS);
    return [keys.length, ...keys.flatMap((key) => [key, (value as AnyRecord)[key]])];
  }, undefined);
}

function sameItems(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}

/** An input's value, without calling a signal: reading one inside a check would subscribe the running template to it. */
function inputValue(instance: object, prop: string): unknown {
  const value = read(() => (instance as AnyRecord)[prop], undefined);
  if (typeof value !== 'function') return value;
  const node = rawNodeOf(value) as { value?: unknown } | null;
  const stored = node?.value;
  return typeof stored === 'symbol' ? undefined : stored;
}

/**
 * Angular's functions between the code that changed something and `notify`,
 * by name, from `markViewDirty`, `markAncestorsForTraversal`, the signal set
 * path and `ComponentRef.setInput` in `@angular/core/fesm2022`.
 */
const ANGULAR_NOTIFY_PATH =
  /^(markViewDirty|markForCheck|markAncestorsForTraversal|updateAncestorTraversalFlagsOnAttach|consumerMarkedDirty|producerNotifyConsumers|producerIncrementEpoch|signalValueChanged|signalSetFn|signalUpdateFn|linkedSignalSetFn|linkedSignalUpdateFn|runPostSignalSetFn|setInput|addSequence|attachView|detachView|insertView)$/;
/** Names Angular uses on that path that app classes use too, skipped only without an app class: `signalFn.set`, not `CartStore.update`. */
const GENERIC_NOTIFY_PATH = /^(set|update|notify|register)$/;

/** A frame on Angular's path to `notify`, not app code. */
export const isAngularNotifyFrame = (line: string): boolean => {
  const name = frameName(line);
  if (ANGULAR_NOTIFY_PATH.test(name)) return true;
  return GENERIC_NOTIFY_PATH.test(name) && !frameClass(line.trim().replace(/^at\s+/, ''));
};

/** A stack frame's function name without its class and alias: `markForCheck` for `ViewRef.markForCheck [as m]`. */
function frameName(line: string): string {
  const text = line.trim().replace(/^at\s+/, '');
  const match = text.match(/^(.*?)\s*\(/) ?? text.match(/^(.*?)@/);
  const name = (match?.[1] ?? '').replace(/\s*\[as [^\]]+\]$/, '').replace(/^async\s+/, '');
  return name.split('.').pop() ?? '';
}

/** Frames of this module's `notify` wrapper, in V8 (`wrapper [as notify]`) and Firefox or Safari (`wrapper@`). */
const isWrapperFrame = (line: string) =>
  /\[as notify\]/.test(line) || frameName(line) === 'wrapper';
/** Frames of `ApplicationRef.tick`, `_tick` and `tickImpl`. */
const isTickFrame = (line: string) => /^_?tick(Impl)?$/.test(frameName(line));

/**
 * The frames below the `marker` frame near the top of `raw` (the first one,
 * or the last with `last`): the code that called into Angular. In a bundled
 * build the overlay and Angular share chunk files with the app, so their
 * frames can't be told apart by file and are cut by position and name
 * instead. A stack without the marker is kept.
 */
export function callerStack(
  raw: string,
  marker: (line: string) => boolean,
  options: { skip?: RegExp | ((line: string) => boolean); last?: boolean } = {},
): string {
  const { skip, last = false } = options;
  const lines = raw.split('\n');
  let cut = -1;
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    if (!marker(lines[i]!)) continue;
    cut = i;
    if (!last) break;
  }
  if (cut < 0) return raw;
  let rest = lines.slice(cut + 1);
  if (skip) {
    let i = 0;
    const skipped = (line: string) =>
      typeof skip === 'function' ? skip(line) : skip.test(frameName(line));
    while (i < rest.length && skipped(rest[i]!)) i++;
    rest = rest.slice(i);
  }
  return ['Error', ...rest].join('\n');
}

/** The class part of an app frame such as `Cart.add (src/app/cart.ts:12:5)`. */
function frameClass(frame: string | undefined): string | undefined {
  const match = frame?.match(/^([A-Z][\w$]*)\./);
  return match && !NOT_APP_CLASS.test(match[1]!) ? match[1] : undefined;
}

export interface CdDiagnosisOptions {
  getNg: () => unknown;
  maxCycles: number;
  doc?: () => Document | undefined;
  global?: () => AnyRecord;
  now?: () => number;
  stack?: () => string | undefined;
  /** Adds a signal write hook and resolves to its remover, or null when the page has none. */
  writeHook?: (onWrite: (node: RawSignalNode) => void) => Promise<(() => void) | null>;
}

/**
 * Finds what started each change detection cycle and which checks changed
 * nothing, while a recording runs. It wraps the scheduler's `notify`, adds a
 * signal write hook and watches DOM updates with a `MutationObserver`, and
 * undoes all three when the recording stops. `onEvent` gets the profiler
 * events after the recorder, with the id the recorder gave the cycle.
 */
export function createCdDiagnosis(options: CdDiagnosisOptions) {
  const doc = options.doc ?? (() => (typeof document === 'undefined' ? undefined : document));
  const global = options.global ?? (() => globalThis as unknown as AnyRecord);
  const now = options.now ?? (() => performance.now());
  const stack = options.stack ?? captureStack;
  const writeHook = options.writeHook ?? ((onWrite) => installSignalWriteHook(onWrite));

  let active = false;
  let started = false;
  /** What the last start could hook, kept after a stop. */
  let hooked = { triggers: false, waste: false };
  let generation = 0;
  let scheduler: SchedulerLike | null = null;
  let unwrap: (() => void) | null = null;
  let removeWriteHook: (() => void) | null = null;
  let observer: MutationObserver | null = null;

  let pending: Pending | null = null;
  let depth = 0;
  let inSync = false;
  let frames: Frame[] = [];
  let cycleStack: { info: CycleInfo; frames: Frame[]; inSync: boolean }[] = [];
  let current: CycleInfo | null = null;

  let cycles = new Map<number, CycleInfo>();
  let causes: Partial<Record<CdCauseKind, number>> = {};
  let classes = new Map<
    Ctor,
    { refreshed: number; unchanged: number; zone: number; tasks: string[] }
  >();
  let untracked = 0;
  let inputRows = new Map<string, CdInputStat>();
  let seen = new WeakMap<object, Map<string, Snap>>();
  const metas = new WeakMap<Ctor, ClassMeta>();

  const zoneApi = (): ZoneApi | undefined =>
    read(() => global()['Zone'] as ZoneApi | undefined, undefined);

  const zoneTask = (): string | undefined => {
    const task = read(() => zoneApi()?.currentTask ?? null, null);
    const source = read(() => task?.source, undefined);
    return typeof source === 'string' && source ? cut(source) : undefined;
  };

  const inAngularZone = (): boolean =>
    read(() => zoneApi()?.current?.get?.('isAngularZone') === true, false);

  const domEvent = (): { type: string; target?: string; xhr: boolean } | null => {
    const event = read(() => global()['event'] as Event | undefined, undefined);
    if (!event || typeof event !== 'object' || typeof event.type !== 'string') return null;
    const target = read(() => event.target, null);
    const Xhr = read(
      () => global()['XMLHttpRequest'] as typeof XMLHttpRequest | undefined,
      undefined,
    );
    const xhr = !!Xhr && read(() => target instanceof Xhr, false);
    const tag = read(
      () => (target && 'localName' in target ? String((target as Element).localName) : undefined),
      undefined,
    );
    return { type: cut(event.type), ...(tag ? { target: cut(tag) } : {}), xhr };
  };

  const onNotify = (source: number) => {
    if (!active || depth > 0) return;
    const at = now();
    if (pending && !REFRESHING.has(pending.source) && at - pending.at > STALE_MS) pending = null;
    if (pending && (REFRESHING.has(pending.source) || !REFRESHING.has(source))) {
      pending.more++;
      return;
    }
    const event = domEvent();
    const task = zoneTask();
    // A listener's own frames are Angular's; the app's run after this call.
    const taken = source === NOTIFY.Listener ? undefined : stack();
    const raw = taken && callerStack(taken, isWrapperFrame, { skip: isAngularNotifyFrame });
    const http =
      !!event?.xhr || (!!raw && HTTP_FRAME.test(raw)) || (!!task && HTTP_TASK.test(task));
    const appStack = raw ? appFrames(raw) : [];
    pending = {
      source,
      at,
      ...(event && !event.xhr ? { event: event.type } : {}),
      ...(event?.target && !event.xhr ? { target: event.target } : {}),
      http,
      ...(task ? { task } : {}),
      ...(appStack.length ? { stack: appStack } : {}),
      more: pending ? pending.more + 1 : 0,
    };
  };

  const onWrite = (node: RawSignalNode) => {
    if (!active || depth > 0 || !pending || pending.signal !== undefined) return;
    pending.signal = cut(read(() => node.debugName, undefined) || UNNAMED_SIGNAL);
  };

  const causeOf = (): CdCause => {
    const zone = inAngularZone();
    const running = read(() => scheduler?.runningTick === true, false);
    const flag = zone && !running ? { zone: true } : {};
    const p = pending;
    if (p) {
      const base = NOTIFY_KIND[p.source] ?? 'unknown';
      const listener = p.listener !== undefined ? listenerName(p.listener) : '';
      const owner = p.owner !== undefined ? ownerName(p.owner, listener) : undefined;
      const timer = !!p.task && TIMER_TASK.test(p.task);
      const kind: CdCauseKind = p.http
        ? 'http'
        : base !== 'event' && p.event
          ? 'event'
          : timer && base !== 'event'
            ? 'timer'
            : base;
      const component = owner ?? frameClass(p.stack?.[0]);
      return {
        kind,
        ...(kind !== base ? { via: base } : {}),
        ...(component ? { component: cut(component) } : {}),
        ...(listener ? { listener: cut(listener) } : {}),
        ...(p.event ? { event: p.event } : {}),
        ...(p.target ? { target: p.target } : {}),
        ...(p.signal ? { signal: p.signal } : {}),
        ...(p.task ? { task: p.task } : {}),
        ...flag,
        ...(p.stack ? { stack: p.stack } : {}),
        ...(p.more ? { more: p.more } : {}),
      };
    }
    if (running) return { kind: 'unknown' };
    const task = zoneTask();
    // Without the scheduler no notification is seen, so a tick can't be told apart from one it ran.
    if (!scheduler) return { kind: 'unknown', ...flag, ...(task && zone ? { task } : {}) };
    if (zone) return { kind: 'zone', zone: true, ...(task ? { task } : {}) };
    const taken = stack();
    const frames = taken ? appFrames(callerStack(taken, isTickFrame, { last: true })) : [];
    const component = frameClass(frames[0]);
    return {
      kind: 'tick',
      ...(component ? { component } : {}),
      ...(frames.length ? { stack: frames } : {}),
    };
  };

  /** Credits DOM updates since the last call to the component being checked. */
  const credit = () => {
    const records = observer ? read(() => observer!.takeRecords(), [] as MutationRecord[]) : [];
    if (records.length && frames.length) frames.at(-1)!.changed = true;
  };

  const metaOf = (instance: object, ctor: Ctor): ClassMeta => {
    const known = metas.get(ctor);
    if (known) return known;
    const ng = options.getNg() as DebugNg | undefined;
    const meta = read(() => ng?.getDirectiveMetadata?.(instance) ?? null, null);
    const inputs = Object.entries(meta?.inputs ?? {})
      .slice(0, MAX_INPUTS)
      .map(([name, entry]): [string, string] => [
        name,
        typeof entry === 'string'
          ? entry
          : Array.isArray(entry) && typeof entry[0] === 'string'
            ? entry[0]
            : name,
      ]);
    const strategy =
      meta?.changeDetection === 0 ? 'OnPush' : meta?.changeDetection === 1 ? 'Eager' : undefined;
    const value: ClassMeta = {
      inputs,
      ...(strategy ? { strategy } : {}),
      component: read(() => 'ɵcmp' in (ctor as AnyRecord), false),
    };
    metas.set(ctor, value);
    return value;
  };

  const inputRow = (ctor: Ctor, input: string, parent: unknown): CdInputStat | null => {
    const name = className(ctor as { name?: string });
    const key = `${name}\u0000${input}`;
    let row = inputRows.get(key);
    if (!row) {
      if (inputRows.size >= MAX_INPUT_ROWS) return null;
      const parentCtor = ctorOf(parent);
      const parentMeta =
        parentCtor && parent && typeof parent === 'object' ? metaOf(parent, parentCtor) : null;
      row = {
        name,
        input: cut(input),
        ...(parentMeta?.component ? { parent: nameOf(parent) } : {}),
        inPlace: 0,
        sameContents: 0,
      };
      inputRows.set(key, row);
    }
    return row;
  };

  /** Compares the inputs with the last check; true when one got a new reference. */
  const compareInputs = (instance: object, ctor: Ctor, meta: ClassMeta, parent: unknown) => {
    if (!meta.inputs.length) return false;
    let before = seen.get(instance);
    if (!before) {
      before = new Map();
      seen.set(instance, before);
    }
    let renewed = false;
    for (const [name, prop] of meta.inputs) {
      const value = inputValue(instance, prop);
      const items = itemsOf(value);
      const old = before.get(prop);
      before.set(prop, items ? { ref: value, items } : { ref: value });
      if (!old) continue;
      if (!Object.is(old.ref, value)) {
        renewed = true;
        if (inSync && old.items && items && sameItems(old.items, items)) {
          const row = inputRow(ctor, name, parent);
          if (row) row.sameContents++;
        }
      } else if (inSync && old.items && items && !sameItems(old.items, items)) {
        const row = inputRow(ctor, name, parent);
        if (row) row.inPlace++;
      }
    }
    return renewed;
  };

  const countClass = (ctor: Ctor) => {
    let stat = classes.get(ctor);
    if (!stat) {
      if (classes.size >= MAX_CLASSES) {
        untracked++;
        return null;
      }
      stat = { refreshed: 0, unchanged: 0, zone: 0, tasks: [] };
      classes.set(ctor, stat);
    }
    return stat;
  };

  const onComponentEnd = (instance: unknown) => {
    credit();
    const frame = frames.pop();
    if (!frame || !current || !instance || typeof instance !== 'object') return;
    const ctor = ctorOf(instance);
    if (!ctor) return;
    const meta = metaOf(instance, ctor);
    const parent = frames.at(-1);
    const renewed = compareInputs(instance, ctor, meta, parent?.first);
    // The parent's template set the new reference, so the parent's check did something.
    if (renewed && parent) parent.changed = true;
    if (!inSync || frame.first !== instance) return;
    current.refreshed++;
    const stat = countClass(ctor);
    if (!frame.changed) {
      current.unchanged++;
      if (stat) stat.unchanged++;
    } else if (stat && current.cause.kind === 'zone') {
      stat.zone++;
      const task = current.cause.task;
      if (task && stat.tasks.length < MAX_TASKS && !stat.tasks.includes(task))
        stat.tasks.push(task);
    }
    if (stat) stat.refreshed++;
  };

  const onEvent = (event: number, instance: unknown, hook: unknown, cycleId: number | null) => {
    if (!active) return;
    switch (event) {
      case PROFILER_EVENT.OutputStart:
        if (depth === 0 && pending?.source === NOTIFY.Listener && pending.owner === undefined) {
          pending.owner = instance;
          pending.listener = hook;
        }
        return;
      case PROFILER_EVENT.ChangeDetectionStart: {
        // DOM updates from before the tick belong to no check.
        if (depth === 0 && observer) read(() => observer!.takeRecords(), []);
        const info: CycleInfo = { cause: causeOf(), refreshed: 0, unchanged: 0 };
        pending = null;
        if (current) cycleStack.push({ info: current, frames, inSync });
        depth++;
        current = info;
        frames = [];
        inSync = false;
        causes[info.cause.kind] = (causes[info.cause.kind] ?? 0) + 1;
        if (cycleId !== null) {
          cycles.set(cycleId, info);
          // The recorder keeps `maxCycles`; ids past that are no longer asked for.
          while (cycles.size > options.maxCycles) cycles.delete(cycles.keys().next().value!);
        }
        return;
      }
      case PROFILER_EVENT.ChangeDetectionSyncStart:
        inSync = true;
        return;
      case PROFILER_EVENT.ChangeDetectionSyncEnd:
        inSync = false;
        return;
      case PROFILER_EVENT.ComponentStart:
        if (!depth) return;
        credit();
        frames.push({ first: NONE, changed: false });
        return;
      case PROFILER_EVENT.TemplateUpdateStart: {
        const top = frames.at(-1);
        if (depth && top && top.first === NONE) top.first = instance;
        return;
      }
      case PROFILER_EVENT.ComponentEnd:
        if (depth) onComponentEnd(instance);
        return;
      case PROFILER_EVENT.ChangeDetectionEnd: {
        if (!depth) return;
        if (observer) read(() => observer!.takeRecords(), []);
        depth--;
        const outer = cycleStack.pop();
        current = outer?.info ?? null;
        frames = outer?.frames ?? [];
        inSync = outer?.inSync ?? false;
        return;
      }
    }
  };

  const hookScheduler = () => {
    const document = doc();
    const roots = document ? read(() => [...document.querySelectorAll('[ng-version]')], []) : [];
    scheduler = findCdScheduler(options.getNg(), roots);
    const target = scheduler;
    if (!target) return;
    const own = Object.prototype.hasOwnProperty.call(target, 'notify');
    const original = target.notify;
    const wrapper = function (this: unknown, source: number) {
      try {
        onNotify(source);
      } catch {
        // Attribution never breaks Angular's scheduling.
      }
      return original.call(this, source);
    };
    target.notify = wrapper;
    unwrap = () => {
      if (target.notify !== wrapper) return;
      if (own) target.notify = original;
      else delete (target as Partial<SchedulerLike>).notify;
    };
  };

  const watchDom = () => {
    const document = doc();
    const Observer = read(
      () => global()['MutationObserver'] as typeof MutationObserver | undefined,
      undefined,
    );
    if (!document?.documentElement || typeof Observer !== 'function') return;
    observer = read(() => {
      const created = new Observer(() => {});
      created.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
      return created;
    }, null);
  };

  const reset = () => {
    pending = null;
    depth = 0;
    inSync = false;
    frames = [];
    cycleStack = [];
    current = null;
    cycles = new Map();
    causes = {};
    classes = new Map();
    untracked = 0;
    inputRows = new Map();
    seen = new WeakMap();
  };

  const unhook = () => {
    unwrap?.();
    unwrap = null;
    scheduler = null;
    observer?.disconnect();
    observer = null;
    removeWriteHook?.();
    removeWriteHook = null;
  };

  return {
    onEvent,
    /** Starts a fresh diagnosis and hooks into the page. */
    start() {
      unhook();
      reset();
      active = true;
      started = true;
      const run = ++generation;
      hookScheduler();
      watchDom();
      hooked = { triggers: scheduler !== null, waste: observer !== null };
      void writeHook(onWrite)
        .then((remove) => {
          // Stopped, or started again, while the hook loaded.
          if (run !== generation || !active) remove?.();
          else removeWriteHook = remove;
        })
        .catch(() => {});
    },
    /** Stops and unhooks, keeping what was found. */
    stop() {
      active = false;
      generation++;
      unhook();
      pending = null;
      depth = 0;
      inSync = false;
      frames = [];
      cycleStack = [];
      current = null;
    },
    clear() {
      reset();
    },
    /** The cause and check counts of a cycle, by the recorder's id. */
    cycle(id: number): { cause?: CdCause; refreshed?: number; unchanged?: number } {
      const info = cycles.get(id);
      if (!info) return {};
      return {
        cause: info.cause,
        ...(info.refreshed ? { refreshed: info.refreshed } : {}),
        ...(info.unchanged ? { unchanged: info.unchanged } : {}),
      };
    },
    /** Totals over the recording, or undefined before the first start. */
    snapshot(major?: number): CdDiagnosis | undefined {
      if (!started) return undefined;
      const components: CdWasteStat[] = [...classes]
        .filter(([, stat]) => stat.refreshed > 0)
        .map(([ctor, stat]) => {
          const strategy = metas.get(ctor)?.strategy;
          return {
            name: className(ctor as { name?: string }),
            refreshed: stat.refreshed,
            unchanged: stat.unchanged,
            ...(strategy ? { strategy } : {}),
          };
        })
        .sort((a, b) => b.unchanged - a.unchanged || b.refreshed - a.refreshed)
        .slice(0, LISTED_CLASSES);
      const inputs = [...inputRows.values()]
        .filter((row) => row.inPlace || row.sameContents)
        .sort((a, b) => b.inPlace - a.inPlace || b.sameContents - a.sameContents)
        .slice(0, LISTED_ROWS)
        .map((row) => ({ ...row }));
      const zone: CdZoneStat[] = [...classes]
        .filter(([, stat]) => stat.zone > 0)
        .map(([ctor, stat]) => ({
          name: className(ctor as { name?: string }),
          ticks: stat.zone,
          ...(stat.tasks.length ? { tasks: [...stat.tasks] } : {}),
        }))
        .sort((a, b) => b.ticks - a.ticks)
        .slice(0, LISTED_ROWS);
      return {
        triggers: hooked.triggers,
        waste: hooked.waste,
        ...(major ? { major } : {}),
        causes: { ...causes },
        components,
        ...(inputs.length ? { inputs } : {}),
        ...(zone.length ? { zone } : {}),
        zoneJs: !!zoneApi(),
      };
    },
    /** Classes refreshed past the 1000 the diagnosis keeps totals for. */
    get untracked() {
      return untracked;
    },
  };
}

export type CdDiagnosisRecorder = ReturnType<typeof createCdDiagnosis>;
