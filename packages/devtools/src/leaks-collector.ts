import {
  addProfilerListener,
  angularMajor,
  keepaliveDue,
  type Profiler,
} from './change-detection.ts';
import { componentHosts, type ComponentDebugNg } from './component-tree.ts';
import { createDomDirty, type DomDirty } from './dom-dirty.ts';
import { elementId } from './element-id.ts';
import { domTree, type HostTree } from './host-tree.ts';
import { className } from './injector-tree.ts';
import { redactMessage, redactUrl } from './router.ts';
import { redactText } from './serialize.ts';
import { clip } from './text.ts';
import {
  MAX_LEAK_COMPONENTS,
  MAX_LEAK_DESTROYED,
  MAX_LEAK_SUBSCRIPTIONS,
  type LeakComponent,
  type LeakDestroyed,
  type LeakSubscription,
  type LeaksReport,
  type SubscriptionTracking,
} from './rpc/leaks-tools.ts';

/** Components a scan walks. */
const MAX_WALK = 2000;
/** Components whose signal graph a scan reads to count effects. */
const MAX_EFFECT_HOSTS = 500;
/** Destroyed instances the page keeps tracking; the oldest goes first. */
export const MAX_TRACKED_DESTROYED = 500;
/** Subscriptions the page keeps while tracking; closed ones go first, then the oldest. */
export const MAX_TRACKED_SUBSCRIPTIONS = 2000;
/** A subscription whose stack names no component class is dropped after this long. */
const UNRESOLVED_MS = 30_000;
/**
 * A scan walks the page when elements came or went, and otherwise this
 * rarely, so effects made without a DOM change still show. The component
 * tree walks on its own pace; this walk stays out of its way.
 */
const SCAN_HEARTBEAT_MS = 30_000;
const MAX_FRAMES = 12;
const MAX_SOURCE = 200;
/** `sessionStorage` key that keeps subscription tracking on across a reload. */
export const TRACKING_KEY = 'pangular-leak-subscriptions';

/** The parts of `window.ng` this collector reads. */
export interface LeaksDebugNg extends ComponentDebugNg {
  getInjector?(el: Element): unknown;
  ɵgetSignalGraph?(injector: unknown): { nodes?: { id?: unknown; kind?: unknown }[] } | null;
}

/**
 * Whether the page's Angular records DI debug data that keeps destroyed
 * components in memory. From 16.2 a development build's
 * `publishDefaultGlobalUtils` turns on the injector profiler
 * (`setupFrameworkInjectorProfiler`) in the same step that publishes
 * `ng.ɵgetInjectorProviders`, and keeps it on. Its records hold every
 * injected value (a `NodeInjector`, `ChangeDetectorRef`, `DestroyRef`) and,
 * from 17.0, the injecting view (`injectedIn.lView`), under the component
 * class as key, so each destroyed instance stays reachable through its own or
 * its parent's view. Nothing on the page can tell that apart from a leak.
 */
export function holdsDestroyedInstances(ng: LeaksDebugNg | undefined): boolean {
  return read(() => typeof ng?.ɵgetInjectorProviders === 'function', false);
}

interface Rpc {
  rpc: {
    call(name: string, ...args: unknown[]): Promise<unknown>;
    register?(definition: {
      name: string;
      type: 'event' | 'action' | 'query';
      jsonSerializable: boolean;
      handler: (...args: any[]) => unknown;
    }): void;
  };
}

interface WeakApi {
  WeakRef?: new <T extends object>(target: T) => { deref(): T | undefined };
  FinalizationRegistry?: new <T>(callback: (held: T) => void) => {
    register(target: object, held: T, token?: object): void;
    unregister(token: object): unknown;
  };
}

type Ref<T extends object> = { deref(): T | undefined };

interface ObservableModule {
  Observable?: { prototype?: Record<string, unknown> };
}

export interface LeaksOptions {
  /** The refresh interval, so keepalives come before the server expires the page. */
  tickMs?: () => number;
  now?: () => number;
  tree?: () => HostTree<Element>;
  /** The page's current location, to count navigations and name routes. */
  route?: () => string;
  /** Loads the app's RxJS when tracking starts. */
  loadRxjs?: () => Promise<ObservableModule>;
  /** Adds an Angular profiler listener; `null` where Angular has no safe hook (before 20.0). */
  addProfiler?: (listener: Profiler) => (() => void) | null;
  /** The Angular major the page runs, 0 when unknown. */
  angularMajor?: () => number;
  /** Where the tracking choice is kept across a reload; `null` to keep it in memory. */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  /** `WeakRef` and `FinalizationRegistry`, from the page by default. */
  weak?: WeakApi;
  /** Whether a scan is due; the default watches the DOM for added and removed elements. */
  dirty?: DomDirty | null;
  /** Navigation events, the page's window by default. */
  target?: Pick<Window, 'addEventListener' | 'removeEventListener'> | null;
  /**
   * Whether a panel or an agent is looking (`page-lease.ts`). While idle the
   * collector keeps its live and destroyed bookkeeping but skips the effect
   * count and the report, and only re-sends the last report as a keepalive.
   */
  active?: () => boolean;
}

export interface LeaksCollector {
  /**
   * Scans when the page changed, then pushes when the report changed or a
   * keepalive is due. On an idle page (see `active`) only the bookkeeping runs.
   */
  push(force?: boolean): Promise<void>;
  /**
   * Notes which components are live or destroyed when the page changed, without
   * reading signal graphs or building a report; cheap enough to run on every refresh.
   */
  track(): void;
  /** Turns subscription tracking on or off. */
  setTracking(on: boolean): Promise<{ ok: boolean; message: string }>;
  /** Walks the page now, for tests and forced pushes. */
  scan(): void;
  report(): LeaksReport;
  /** Stops pushing and tells the server the page left (`pagehide`). */
  leave(): void;
  /** Starts again after `leave` (a page restored from the back/forward cache). */
  resume(): void;
  stop(): void;
}

interface Live {
  id: string;
  name: string;
  ref: Ref<object>;
  host: Ref<Element>;
  /** Where and when (in navigations) the page last showed it. */
  route: string;
  navigation: number;
  effects: number;
  sharedEffects: number;
}

interface Destroyed {
  id: string;
  name: string;
  ref: Ref<object>;
  host: Ref<Element>;
  route: string;
  destroyedAt: number;
  navigation: number;
  detached: boolean;
}

interface Tracked {
  ref: Ref<object>;
  /** Class names from the stack, innermost first. */
  candidates: string[];
  frames: string[];
  name?: string;
  instance?: Ref<object>;
  instanceId?: string;
  openedAt: number;
  route: string;
}

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const IDENT = /^[A-Za-z$][\w$]*$/;
const strip = (name: string) => name.replace(/^_+(?=[A-Za-z$])/, '');

/**
 * Class names a stack points at, innermost first: `new Card` (a constructor),
 * `Card.ngOnInit` (a method) and compiled template functions such as
 * `Card_Template` or `Card_Conditional_2_Template_button_click_0_listener`.
 */
export function stackClasses(stack: string | undefined): {
  names: string[];
  frames: string[];
  /** Names seen as a constructor (`new Card`): the object being built owns what it starts. */
  constructed: string[];
} {
  const names: string[] = [];
  const frames: string[] = [];
  const constructed: string[] = [];
  const add = (raw: string | undefined) => {
    const name = raw && strip(raw);
    if (name && IDENT.test(name) && !names.includes(name)) names.push(name);
  };
  for (const line of (stack ?? '').split('\n').slice(1, 40)) {
    const fn =
      /^\s*at\s+(?:async\s+)?(new\s+)?([\w$.]+)/.exec(line) ??
      /^(new\s+)?([\w$.]+)@/.exec(line.trim());
    if (!fn) continue;
    const [first, ...rest] = fn[2]!.split('.');
    const before = names.length;
    if (fn[1] || rest.length) add(first);
    if (fn[1] && first) constructed.push(strip(first));
    // `Card_Conditional_2_Template_button_click_0_listener`: every prefix, longest first.
    const bare = strip(first!);
    if (/_(?:\w+_)*Template/.test(bare)) {
      const pieces = bare.split('_');
      for (let n = pieces.length - 1; n >= 1; n--) add(pieces.slice(0, n).join('_'));
    }
    if (names.length > before && frames.length < MAX_FRAMES) frames.push(line.trim());
  }
  return { names, frames, constructed };
}

/** A stack line without the URL's origin and query, masked and cut. */
function sourceText(frame: string): string {
  const short = frame
    .replace(/^at\s+/, '')
    .replace(
      /\(?(?:https?|file|webpack|chrome-extension):\/\/[^\s)]*?([^/\s)?#]+)(?:[?#][^\s):]*)?(:\d+(?::\d+)?)?\)?$/,
      '($1$2)',
    );
  return clip(redactText(short), MAX_SOURCE);
}

function nameOf(instance: object): string {
  return read(() => className((instance as { constructor: Function }).constructor), '?');
}

/**
 * Leak hints for one page: the live effects and (while tracking is on) the
 * open RxJS subscriptions of each component, and the component instances that
 * left the page but are still in memory. Instances are held through `WeakRef`
 * only and noticed when collected through a `FinalizationRegistry`, so the
 * collector itself keeps nothing alive. Destroyed means the host left the page
 * and Angular dropped its view (`ng.getInjector` gives the null injector from
 * Angular 14); a host that left while Angular still holds the view is
 * reported as detached instead. Where Angular's DI debug data keeps every
 * destroyed instance (`holdsDestroyedInstances`), the report lists detached
 * views only and says why (`support.retention: 'dev-di-debug'`); the
 * bookkeeping still runs, since subscriptions are flagged against it.
 * Subscription tracking wraps
 * `Observable.prototype.subscribe` only while it is on, and restores it when
 * turned off.
 */
export function attachLeaks(
  my: Rpc,
  pageId: string,
  getNg: () => LeaksDebugNg | undefined,
  options: LeaksOptions = {},
): LeaksCollector {
  const now = options.now ?? Date.now;
  const tickMs = options.tickMs ?? (() => 0);
  const active = options.active ?? (() => true);
  const hasDocument = typeof document !== 'undefined';
  // Through `dirty.watch`, so changes inside open shadow roots mark the walk due.
  const tree = options.tree ?? (() => (dirty ? dirty.watch(domTree()) : domTree()));
  const route =
    options.route ?? (() => read(() => location.pathname + location.search + location.hash, ''));
  const major =
    options.angularMajor ?? (() => (hasDocument ? read(() => angularMajor(document), 0) : 0));
  const weak: WeakApi =
    options.weak ??
    ({
      WeakRef: (globalThis as WeakApi).WeakRef,
      FinalizationRegistry: (globalThis as WeakApi).FinalizationRegistry,
    } as WeakApi);
  const storage =
    options.storage === undefined
      ? read(() => (typeof sessionStorage === 'undefined' ? null : sessionStorage), null)
      : options.storage;
  const target =
    options.target === undefined ? (typeof window === 'undefined' ? null : window) : options.target;
  const dirty =
    options.dirty === undefined
      ? hasDocument
        ? createDomDirty(document, { heartbeatMs: SCAN_HEARTBEAT_MS, now })
        : null
      : options.dirty;
  const addProfiler =
    options.addProfiler ??
    ((listener: Profiler) =>
      hasDocument ? addProfilerListener(getNg(), listener, document) : null);
  const loadRxjs =
    options.loadRxjs ?? (() => import('rxjs') as unknown as Promise<ObservableModule>);

  const live = new Map<string, Live>();
  const destroyed = new Map<string, Destroyed>();
  const instanceIds = new WeakMap<object, string>();
  const knownClasses = new Set<string>();
  /** When an instance of each class was last destroyed. */
  const lastDestroyed = new Map<string, number>();
  let tracked: Tracked[] = [];
  let collected = 0;
  let dropped = 0;
  let navigations = 0;
  let lastRoute = route();
  let tracking: SubscriptionTracking = 'off';
  let instancesKnown = false;
  let restoreSubscribe: (() => void) | null = null;
  let removeProfiler: (() => void) | null = null;
  const contexts: unknown[] = [];
  let lastKey = '';
  let sentAt = 0;
  let left = false;
  let stopped = false;
  let nullInjector: { for: unknown; value: unknown } | null = null;
  let effectsSupported = false;
  let uniqueEffects = 0;
  let effectsDue = false;
  let lastPayload: LeaksReport | null = null;

  const registry = weak.FinalizationRegistry
    ? new weak.FinalizationRegistry<string>((id) => {
        if (stopped) return;
        const entry = destroyed.get(id);
        if (entry && entry.ref.deref() === undefined) {
          destroyed.delete(id);
          collected++;
        }
      })
    : null;
  /**
   * `true` when retained instances can be listed; `'dev-di-debug'` when the
   * page's Angular keeps every destroyed instance itself, so none can be.
   */
  const retention = (ng: LeaksDebugNg | undefined): LeaksReport['support']['retention'] => {
    if (!weak.WeakRef || !registry || typeof ng?.getComponent !== 'function') return false;
    return holdsDestroyedInstances(ng) ? 'dev-di-debug' : true;
  };

  const checkNavigation = () => {
    const next = route();
    if (next === lastRoute) return;
    lastRoute = next;
    navigations++;
  };

  /** The injector Angular gives for an element it does not know, to tell a dropped view apart. */
  const emptyInjector = (ng: LeaksDebugNg) => {
    if (nullInjector?.for === ng) return nullInjector.value;
    // A detached element is never put on the page, so the app's DOM is untouched.
    const probe = hasDocument ? document.createElement('div') : null;
    const value = probe ? read(() => ng.getInjector?.(probe) ?? null, null) : null;
    nullInjector = { for: ng, value };
    return value;
  };
  const detachSupported = (ng: LeaksDebugNg | undefined) =>
    !!ng && typeof ng.getInjector === 'function' && major() >= 14;
  /** Angular still holds the view the host was rendered in. */
  const viewAlive = (ng: LeaksDebugNg, host: Element | undefined) => {
    if (!host || !detachSupported(ng)) return false;
    const injector = read(() => ng.getInjector!(host), null);
    if (!injector) return false;
    const empty = emptyInjector(ng);
    return empty !== null && injector !== empty;
  };

  const forget = (entry: Destroyed) => {
    destroyed.delete(entry.id);
    registry?.unregister(entry);
  };

  const markGone = (entry: Live, ng: LeaksDebugNg) => {
    live.delete(entry.id);
    const instance = entry.ref.deref();
    if (!instance) {
      collected++;
      return;
    }
    const host = entry.host.deref();
    const detached = viewAlive(ng, host);
    const gone: Destroyed = {
      id: entry.id,
      name: entry.name,
      ref: entry.ref,
      host: entry.host,
      // The route it lived on: a navigation usually destroys it and changes the URL at once.
      route: entry.route,
      destroyedAt: now(),
      navigation: entry.navigation,
      detached,
    };
    const previous = destroyed.get(entry.id);
    if (previous) forget(previous);
    destroyed.set(entry.id, gone);
    registry?.register(instance, entry.id, gone);
    if (!detached) lastDestroyed.set(entry.name, gone.destroyedAt);
    while (destroyed.size > MAX_TRACKED_DESTROYED) {
      const oldest = destroyed.values().next().value as Destroyed;
      forget(oldest);
      dropped++;
    }
  };

  /** Effect node ids per component, from Angular's signal graph (ids from 20.1). */
  const effectIds = (ng: LeaksDebugNg, host: Element): string[] | null => {
    const injector = read(() => ng.getInjector?.(host) ?? null, null);
    if (!injector) return [];
    const graph = read(() => ng.ɵgetSignalGraph!(injector), null);
    const nodes = graph && Array.isArray(graph.nodes) ? graph.nodes : [];
    const out: string[] = [];
    for (const node of nodes) {
      if (node?.kind !== 'effect') continue;
      if (typeof node.id !== 'string' && typeof node.id !== 'number') return null;
      out.push(String(node.id));
    }
    return out;
  };

  /** The cheap part of a scan: which instances are live, destroyed or detached. */
  const trackInstances = () => {
    const ng = getNg();
    checkNavigation();
    if (!ng || typeof ng.getComponent !== 'function' || !weak.WeakRef) return;
    const WeakRefImpl = weak.WeakRef;
    const walk = read(() => tree(), null);
    if (!walk) return;
    const hosts = read(() => componentHosts(ng, walk, MAX_WALK), [] as Element[]);
    const seen = new Set<string>();
    for (const host of hosts) {
      const instance = read(() => ng.getComponent!(host), null);
      if (!instance || typeof instance !== 'object') continue;
      const id = elementId(host);
      seen.add(id);
      let entry = live.get(id);
      if (entry && entry.ref.deref() !== instance) {
        markGone(entry, ng);
        entry = undefined;
      }
      if (!entry) {
        const back = destroyed.get(id);
        // A detached view put back on the page (route reuse) is live again.
        if (back && back.ref.deref() === instance) forget(back);
        const name = nameOf(instance);
        knownClasses.add(name);
        entry = {
          id,
          name,
          ref: new WeakRefImpl(instance),
          host: new WeakRefImpl(host),
          route: lastRoute,
          navigation: navigations,
          effects: 0,
          sharedEffects: 0,
        };
        live.set(id, entry);
        instanceIds.set(instance, id);
      }
      entry.route = lastRoute;
      entry.navigation = navigations;
    }
    for (const entry of [...live.values()]) {
      if (seen.has(entry.id)) continue;
      const host = entry.host.deref();
      // Still on the page, past the walk's cap.
      if (host && read(() => walk.connected(host), false) && hosts.length >= MAX_WALK) continue;
      markGone(entry, ng);
    }
    // A detached view that Angular has since dropped is destroyed now.
    for (const entry of destroyed.values()) {
      if (!entry.detached || viewAlive(ng, entry.host.deref())) continue;
      entry.detached = false;
      entry.destroyedAt = now();
      entry.navigation = navigations;
      lastDestroyed.set(entry.name, entry.destroyedAt);
    }
    effectsDue = true;
    pruneTracked();
  };

  /** Reads the signal graph again after a walk, only when someone looks at the result. */
  const refreshEffects = () => {
    if (!effectsDue) return;
    const ng = getNg();
    if (!ng) return;
    effectsDue = false;
    countEffects(ng);
  };

  const scan = () => {
    trackInstances();
    refreshEffects();
  };

  const countEffects = (ng: LeaksDebugNg) => {
    effectsSupported = typeof ng.ɵgetSignalGraph === 'function';
    if (!effectsSupported) return;
    const owners = new Map<string, string[]>();
    const perHost = new Map<string, string[]>();
    let n = 0;
    for (const entry of live.values()) {
      entry.effects = 0;
      entry.sharedEffects = 0;
      if (n++ >= MAX_EFFECT_HOSTS) continue;
      const host = entry.host.deref();
      if (!host) continue;
      const ids = effectIds(ng, host);
      if (ids === null) {
        // Before 20.1 graph nodes carry no ids, so effects can't be told apart.
        effectsSupported = false;
        return;
      }
      perHost.set(entry.id, ids);
      for (const effect of ids) {
        const list = owners.get(effect) ?? [];
        list.push(entry.id);
        owners.set(effect, list);
      }
    }
    // Angular files a component's effects under the view its host sits in, so
    // components side by side in one template list each other's effects.
    for (const [id, ids] of perHost) {
      const entry = live.get(id)!;
      for (const effect of ids) {
        if (owners.get(effect)!.length === 1) entry.effects++;
        else entry.sharedEffects++;
      }
    }
    uniqueEffects = owners.size;
  };
  // --- subscriptions ---

  /** Names the class (and instance id) once the walk knows them; `false` while it doesn't. */
  const resolve = (record: Tracked) => {
    if (!record.instanceId && record.instance) {
      const instance = record.instance.deref();
      const id = instance ? instanceIds.get(instance) : undefined;
      if (id) record.instanceId = id;
    }
    if (record.name) return knownClasses.has(record.name);
    const name = record.candidates.find((candidate) => knownClasses.has(candidate));
    if (!name) return false;
    record.name = name;
    return true;
  };

  const pruneTracked = () => {
    const at = now();
    tracked = tracked.filter((record) => {
      const sub = record.ref.deref();
      if (!sub || read(() => (sub as { closed?: unknown }).closed === true, true)) return false;
      return resolve(record) || at - record.openedAt < UNRESOLVED_MS;
    });
  };

  const onSubscribe = (sub: unknown, stack: string | undefined) => {
    if (!sub || typeof sub !== 'object' || !weak.WeakRef) return;
    const { names, frames, constructed } = stackClasses(stack);
    if (!names.length) return;
    const record: Tracked = {
      ref: new weak.WeakRef(sub),
      candidates: names.slice(0, 8),
      frames,
      openedAt: now(),
      route: route(),
    };
    // The innermost class on the stack with an open Angular context (hook,
    // template, listener) names the instance. A constructor before it stops
    // the search: a component built inside its parent's template owns what
    // its constructor starts, though the parent's context is the open one.
    // Otherwise the class is resolved on the next scan, once it is known.
    for (const name of record.candidates) {
      const context = contextOf(name);
      if (context) {
        record.name = name;
        record.instance = new weak.WeakRef(context);
        resolve(record);
        break;
      }
      if (constructed.includes(name)) break;
    }
    tracked.push(record);
    if (tracked.length > MAX_TRACKED_SUBSCRIPTIONS) {
      pruneTracked();
      if (tracked.length > MAX_TRACKED_SUBSCRIPTIONS) {
        tracked.splice(0, tracked.length - MAX_TRACKED_SUBSCRIPTIONS);
      }
    }
  };

  const contextOf = (name: string) => {
    for (let i = contexts.length - 1; i >= 0; i--) {
      const instance = contexts[i];
      if (!instance || typeof instance !== 'object') continue;
      // An instance built in this same pass is not walked yet: its id comes on the next scan.
      if (nameOf(instance) === name) return instance;
    }
    return null;
  };

  /** Angular's profiler events with a context: template create and update, lifecycle hooks, outputs. */
  const onProfile: Profiler = (event, instance) => {
    if (event === 0 || event === 2 || event === 4 || event === 6) contexts.push(instance);
    else if (event === 1 || event === 3 || event === 5 || event === 7) contexts.pop();
    // The end of a change detection run, or a listener added mid-run, leaves nothing open.
    else if (event === 13 || contexts.length > 64) contexts.length = 0;
  };

  const wrapSubscribe = (proto: Record<string, unknown>) => {
    const original = proto['subscribe'];
    if (typeof original !== 'function') return null;
    const own = Object.prototype.hasOwnProperty.call(proto, 'subscribe');
    let depth = 0;
    let active = true;
    const wrapped = function (this: unknown, ...args: unknown[]) {
      // Operators subscribe to their source inside the outer call; only the outer one counts.
      if (!active || depth > 0) return original.apply(this, args);
      depth++;
      let sub: unknown;
      try {
        sub = original.apply(this, args);
      } finally {
        depth--;
      }
      try {
        onSubscribe(sub, new Error().stack);
      } catch {
        // Tracking never gets in the way of the app's subscription.
      }
      return sub;
    };
    proto['subscribe'] = wrapped;
    return () => {
      active = false;
      if (proto['subscribe'] !== wrapped) return;
      if (own) proto['subscribe'] = original;
      else delete proto['subscribe'];
    };
  };

  const remember = (on: boolean) => {
    try {
      if (on) storage?.setItem(TRACKING_KEY, '1');
      else storage?.removeItem(TRACKING_KEY);
    } catch {
      // the choice lasts for this page load only
    }
  };

  const stopTracking = () => {
    restoreSubscribe?.();
    restoreSubscribe = null;
    removeProfiler?.();
    removeProfiler = null;
    contexts.length = 0;
    tracked = [];
    instancesKnown = false;
  };

  let starting: Promise<{ ok: boolean; message: string }> | null = null;
  const setTracking = async (on: boolean): Promise<{ ok: boolean; message: string }> => {
    if (!on) {
      starting = null;
      const was = tracking === 'on';
      stopTracking();
      tracking = 'off';
      remember(false);
      lastKey = '';
      return { ok: true, message: was ? 'Stopped tracking subscriptions.' : 'Not tracking.' };
    }
    if (tracking === 'on') return { ok: true, message: 'Already tracking subscriptions.' };
    if (starting) return starting;
    // Declared first, so the attempt can tell whether it is still the latest one.
    let attempt!: Promise<{ ok: boolean; message: string }>;
    attempt = (async () => {
      const rxjs = await loadRxjs().catch(() => null);
      // A later on/off while RxJS loads replaces `starting`; only the latest attempt may wrap.
      if (starting !== attempt || stopped)
        return { ok: false, message: 'Tracking was turned off.' };
      if (restoreSubscribe) return { ok: true, message: 'Already tracking subscriptions.' };
      const proto = read(() => rxjs?.Observable?.prototype ?? null, null);
      const restore = proto ? wrapSubscribe(proto) : null;
      if (!restore) {
        tracking = 'unavailable';
        lastKey = '';
        return { ok: false, message: 'The page has no RxJS Observable the overlay can load.' };
      }
      restoreSubscribe = restore;
      removeProfiler = read(() => addProfiler(onProfile), null);
      instancesKnown = !!removeProfiler;
      tracking = 'on';
      remember(true);
      lastKey = '';
      return { ok: true, message: 'Tracking subscriptions.' };
    })();
    starting = attempt;
    try {
      return await attempt;
    } finally {
      if (starting === attempt) starting = null;
    }
  };

  // --- report ---

  const report = (): LeaksReport => {
    const at = now();
    const ng = getNg();
    const openBy = new Map<string, number>();
    const liveClasses = new Set<string>();
    for (const entry of live.values()) liveClasses.add(entry.name);
    const leaks = new Map<string, LeakSubscription>();
    let totalSubs = 0;
    for (const record of tracked) {
      const sub = record.ref.deref();
      if (!sub || read(() => (sub as { closed?: unknown }).closed === true, true)) continue;
      if (!resolve(record) || !record.name) continue;
      const name = record.name;
      let reason: LeakSubscription['reason'] | null = null;
      if (record.instanceId) {
        const instance = record.instance?.deref();
        if (instance && live.get(record.instanceId)?.ref.deref() === instance) {
          openBy.set(record.instanceId, (openBy.get(record.instanceId) ?? 0) + 1);
          totalSubs++;
        } else {
          const gone = destroyed.get(record.instanceId);
          if (!gone?.detached) reason = 'instance-destroyed';
          if (instance && gone?.ref.deref() === instance) {
            openBy.set(record.instanceId, (openBy.get(record.instanceId) ?? 0) + 1);
          }
        }
      } else if (!liveClasses.has(name)) {
        const lastGone = lastDestroyed.get(name);
        if (lastGone !== undefined && lastGone >= record.openedAt) reason = 'no-live-instance';
      } else {
        totalSubs++;
      }
      if (!reason) continue;
      const frame = record.frames.find((line) => line.includes(name)) ?? record.frames[0];
      const source = frame ? sourceText(frame) : undefined;
      const key = `${name}|${record.instanceId ?? ''}|${source ?? ''}`;
      const held = leaks.get(key);
      if (held) {
        held.count++;
        held.openedAt = Math.min(held.openedAt, record.openedAt);
        continue;
      }
      leaks.set(key, {
        name,
        count: 1,
        route: redactUrl(record.route),
        openedAt: record.openedAt,
        reason,
        ...(record.instanceId ? { instanceId: record.instanceId } : {}),
        ...(source ? { source } : {}),
      });
    }

    const components: LeakComponent[] = [...live.values()]
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        effects: entry.effects,
        subscriptions: openBy.get(entry.id) ?? 0,
        ...(entry.sharedEffects ? { sharedEffects: entry.sharedEffects } : {}),
      }))
      .filter((entry) => entry.effects || entry.subscriptions || entry.sharedEffects)
      .sort(
        (a, b) =>
          b.effects +
          b.subscriptions +
          (b.sharedEffects ?? 0) -
          (a.effects + a.subscriptions + (a.sharedEffects ?? 0)),
      )
      .slice(0, MAX_LEAK_COMPONENTS);

    const kept = retention(ng);
    const gone: LeakDestroyed[] = [...destroyed.values()]
      // Angular's DI debug data keeps every destroyed instance: only detached views mean something.
      .filter(
        (entry) => entry.ref.deref() !== undefined && (kept !== 'dev-di-debug' || entry.detached),
      )
      .slice(0, MAX_LEAK_DESTROYED)
      .map((entry) => {
        const subs = openBy.get(entry.id) ?? 0;
        return {
          id: entry.id,
          name: entry.name,
          route: redactUrl(entry.route),
          destroyedAt: entry.destroyedAt,
          navigations: navigations - entry.navigation,
          ...(entry.detached ? { detached: true } : {}),
          ...(subs ? { subscriptions: subs } : {}),
        };
      });

    return {
      pageId,
      url: redactUrl(route()),
      title: redactMessage(read(() => (hasDocument ? document.title : ''), '')),
      at,
      support: {
        retention: kept,
        effects: effectsSupported,
        subscriptions: tracking,
        ...(tracking === 'on' && instancesKnown ? { instances: true } : {}),
        ...(detachSupported(ng) ? { detached: true } : {}),
      },
      navigations,
      totals: {
        components: live.size,
        effects: uniqueEffects,
        subscriptions: totalSubs,
        destroyed: destroyed.size,
        collected,
        dropped,
      },
      components,
      destroyed: gone,
      subscriptions: [...leaks.values()].slice(0, MAX_LEAK_SUBSCRIPTIONS),
    };
  };

  let scanDue = dirty ? dirty.cached(() => trackInstances()) : null;
  let queue = Promise.resolve();
  const send = async (payload: LeaksReport) => {
    sentAt = now();
    try {
      const answer = (await my.rpc.call('push-leaks', payload)) as { known?: boolean } | undefined;
      if (answer?.known === false) lastKey = '';
    } catch {
      lastKey = '';
    }
  };
  const pushOnce = async (force: boolean) => {
    if (left || stopped) return;
    checkNavigation();
    // The bookkeeping runs either way, so a component that lives only while idle is still seen.
    if (force || !scanDue) trackInstances();
    else scanDue();
    if (force || active()) {
      refreshEffects();
    } else if (lastPayload) {
      // Nobody looks: the last report keeps the page from expiring. The first one still goes out.
      if (keepaliveDue(sentAt, tickMs(), now())) await send(lastPayload);
      return;
    }
    const payload = report();
    const key = JSON.stringify({ ...payload, at: 0 });
    if (!force && key === lastKey && !keepaliveDue(sentAt, tickMs(), now())) return;
    lastKey = key;
    lastPayload = payload;
    await send(payload);
  };
  const push = (force = false) => (queue = queue.then(() => pushOnce(force)));

  const onNavigate = () => {
    checkNavigation();
  };
  target?.addEventListener('popstate', onNavigate);
  target?.addEventListener('hashchange', onNavigate);
  const navigation = read(
    () =>
      (globalThis as { navigation?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> })
        .navigation ?? null,
    null,
  );
  if (options.target === undefined) navigation?.addEventListener('navigatesuccess', onNavigate);

  my.rpc.register?.({
    name: 'leak-tracking',
    type: 'event',
    jsonSerializable: true,
    handler: (request: { pageId?: unknown; on?: unknown } | null) => {
      if (!request || typeof request !== 'object' || request.pageId !== pageId) return;
      void setTracking(request.on !== false).then(() => push(true));
    },
  });

  // Tracking that was on before a reload starts again at once, so the first screen is seen.
  if (read(() => storage?.getItem(TRACKING_KEY) === '1', false)) {
    void setTracking(true).then(() => push(true));
  }

  return {
    push,
    track() {
      if (left || stopped) return;
      checkNavigation();
      if (scanDue) scanDue();
      else trackInstances();
    },
    setTracking,
    scan,
    report,
    leave() {
      if (left) return;
      left = true;
      lastKey = '';
      void my.rpc.call('forget-leaks-page', pageId).catch(() => {});
    },
    resume() {
      left = false;
      lastKey = '';
      void push(true);
    },
    stop() {
      stopped = true;
      starting = null;
      stopTracking();
      dirty?.stop();
      scanDue = null;
      target?.removeEventListener('popstate', onNavigate);
      target?.removeEventListener('hashchange', onNavigate);
      if (options.target === undefined) {
        navigation?.removeEventListener('navigatesuccess', onNavigate);
      }
      live.clear();
      destroyed.clear();
    },
  };
}
