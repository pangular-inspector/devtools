// The diagnosis collectors of the native overlays (Angular Native and
// NativeScript): change detection, leaks, errors and the console, startup
// timing, provider values, TanStack Query, the other stores, page plugins and
// the page's Angular info. They are the browser overlay's collectors, given a
// host tree and a page description instead of the DOM, `location` and
// `document`, so both native overlays report the same data the same way.

import { attachChangeDetection } from './cd-overlay.ts';
import { addProfilerListener, type ProfilerGate } from './change-detection.ts';
import type { ResolvedPangularConfig } from './config.ts';
import type { DomDirty } from './dom-dirty.ts';
import { elementId } from './element-id.ts';
import { createRecentWrites } from './error-explain.ts';
import { attachErrors, type ErrorsDebugNg } from './errors-collector.ts';
import type { HostTree } from './host-tree.ts';
import { attachLeaks, type LeaksDebugNg } from './leaks-collector.ts';
import { attachAngularInfo } from './ng-capabilities.ts';
import { attachPlugins } from './plugins-collector.ts';
import { registerProviderValues, type ProviderDebugNg } from './provider-values.ts';
import { attachTanstackQuery, type QueryDebugNg } from './query-collector.ts';
import { attachReduxStores } from './redux-stores-collector.ts';
import { findRouter, type RouterDebugApi } from './router.ts';
import type { SignalChange } from './types.ts';
import { attachStartup } from './startup-timing.ts';

const debugApis = new WeakMap<object, object>();

/**
 * The `ng` global for a platform without a DOM, as one object per real
 * `ng`: collectors and the profiler hub key their state by it, so a fresh
 * wrapper on every call would register Angular's profiler again each time.
 * The wrapper inherits every util from the real `ng`, including ones Angular
 * or the router publish later, and only wraps `getDirectives`, which starts
 * with `node instanceof Text`, a DOM global these runtimes lack.
 */
export function nativeDebugApi<T extends object>(): T | undefined {
  const ng = (globalThis as { ng?: Record<string, unknown> }).ng;
  if (!ng || typeof ng['getComponent'] !== 'function') return undefined;
  const known = debugApis.get(ng);
  if (known) return known as T;
  const wrapper = Object.create(ng, {
    getDirectives: {
      configurable: true,
      enumerable: true,
      value: (host: unknown) => {
        const getDirectives = ng['getDirectives'];
        if (typeof getDirectives !== 'function') return [];
        return withTextGlobal(() => (getDirectives as (host: unknown) => unknown[])(host));
      },
    },
  }) as T;
  debugApis.set(ng, wrapper);
  return wrapper;
}

/** A stand-in `Text` global for the length of a call, when the runtime has none. */
function withTextGlobal<T>(fn: () => T): T {
  const g = globalThis as Record<string, unknown>;
  if ('Text' in g) return fn();
  g['Text'] = class Text {};
  try {
    return fn();
  } finally {
    delete g['Text'];
  }
}

/** A leak scan walks the app at least this often while its component tree stays the same. */
export const NATIVE_SCAN_HEARTBEAT_MS = 30_000;

/** Why the providers have no construction times on a device. */
export const NATIVE_STARTUP_NOTE =
  'Provider construction times need the startup hook, which loads before Angular in a browser only. An app on a device reports when it was first stable.';

interface Rpc {
  rpc: {
    call(name: string, ...args: unknown[]): Promise<unknown>;
    register(definition: {
      name: string;
      type: 'event';
      jsonSerializable: boolean;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: (...args: any[]) => unknown;
    }): void;
  };
}

export interface NativeDiagnosticsOptions<H extends object> {
  getNg: () => object | undefined;
  tree: HostTree<H>;
  config: ResolvedPangularConfig;
  /** The report interval, so keepalives come before the server expires the page. */
  tickMs: () => number;
  /** The page's URL and title, as the component tree reports them. */
  describe: () => { url: string; title: string };
  /** Where Angular's global error handler can be watched; none by default. */
  errorTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}

export interface NativeDiagnostics {
  /** Pushes of every collector the config turns on, run on each report tick. */
  readonly collectors: (() => Promise<void>)[];
  /** Pass to the signal history as `onChange`: the NG0100 explainer reads recent writes. */
  onSignalChange(
    id: string | undefined,
    label: string,
    change: SignalChange,
    raw?: { value: unknown },
  ): void;
  /** The signal write hook is installed, so the explainer knows it hears writes. */
  signalHookReady(): void;
  /** The component tree report changed: a leak scan is due on the next push. */
  treeChanged(): void;
  /** The app is going away: the server forgets what these collectors reported. */
  leave(): void;
  stop(): void;
}

/**
 * The Angular version a native renderer left on the root host. Angular sets
 * `ng-version` on the root component's host through the renderer's
 * `setAttribute`, which a native renderer keeps as an attribute, a prop or a
 * property of the view, depending on the platform.
 */
export function hostAngularVersion(host: unknown): string | undefined {
  if (!host || typeof host !== 'object') return undefined;
  const record = host as {
    getAttribute?: (name: string) => unknown;
    props?: Record<string, unknown>;
    attributes?: Record<string, unknown>;
    'ng-version'?: unknown;
  };
  const candidates = [
    read(() => record.getAttribute?.('ng-version'), undefined),
    read(() => record.props?.['ng-version'], undefined),
    read(() => record.attributes?.['ng-version'], undefined),
    read(() => record['ng-version'], undefined),
  ];
  const version = candidates.find(
    (value): value is string => typeof value === 'string' && /^\d+\.\d+/.test(value),
  );
  return version && version.length < 40 ? version : undefined;
}

/**
 * A leak scan schedule for a platform with no `MutationObserver`: a cached
 * read runs again when the component tree report changed, `heartbeatMs`
 * passed, or it is forced.
 */
export function createTreeDirty(
  heartbeatMs = NATIVE_SCAN_HEARTBEAT_MS,
  now: () => number = Date.now,
): DomDirty & { bump(): void } {
  let version = 0;
  return {
    bump() {
      version++;
    },
    watch: (tree) => tree,
    cached(readValue, keep) {
      let has = false;
      let value: ReturnType<typeof readValue>;
      let readVersion = -1;
      let readAt = 0;
      return (force = false) => {
        const fresh = has && !force && readVersion === version && now() - readAt < heartbeatMs;
        if (fresh) return value;
        readVersion = version;
        readAt = now();
        value = readValue();
        has = !keep || keep(value);
        return value;
      };
    },
    stop() {},
  };
}

/** How long a page without a Router found waits before it looks for one again. */
const ROUTER_RETRY_MS = 5000;
/** Angular's `EventType.NavigationEnd`, checked in `@angular/router/fesm2022/_router-chunk.mjs`. */
const NAVIGATION_END = 1;

type EventsTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

/**
 * The app's Angular Router, for the leak hints: its `url` names the route a
 * component lived on, and each `NavigationEnd` counts a navigation, which a
 * page on a device has no `location` or `popstate` for. The Router is looked
 * up through the root injectors, as the browser overlay's router inspector
 * does, and its events are listened to only until `stop()`.
 */
export function createRouterWatch(
  getNg: () => object | undefined,
  roots: () => object[],
  now: () => number = Date.now,
) {
  let router: Record<string, unknown> | null = null;
  let subscription: { unsubscribe?: () => void } | null = null;
  let triedAt = -Infinity;
  let stopped = false;
  const listeners = new Set<() => void>();
  const find = () => {
    if (router || stopped || now() - triedAt < ROUTER_RETRY_MS) return router;
    triedAt = now();
    const ng = getNg();
    if (!ng) return null;
    router = read(() => findRouter(ng as RouterDebugApi, roots() as Element[]), null);
    const events = router ? read(() => router!['events'], null) : null;
    if (events && typeof (events as { subscribe?: unknown }).subscribe === 'function') {
      subscription = read(
        () =>
          (
            events as { subscribe(fn: (event: unknown) => void): { unsubscribe?: () => void } }
          ).subscribe((event) => {
            if (read(() => (event as { type?: unknown })?.type, undefined) !== NAVIGATION_END) {
              return;
            }
            for (const listener of [...listeners]) read(listener, undefined);
          }),
        null,
      );
    }
    return router;
  };
  const target = {
    addEventListener(type: string, listener: unknown) {
      if (type === 'popstate' && typeof listener === 'function') {
        listeners.add(listener as () => void);
      }
    },
    removeEventListener(_type: string, listener: unknown) {
      listeners.delete(listener as () => void);
    },
  } as unknown as EventsTarget;
  return {
    /** The Router's URL, or `/` while the app has none. */
    route(): string {
      const found = find();
      const url = found ? read(() => found['url'], undefined) : undefined;
      return typeof url === 'string' && url ? url : '/';
    },
    /** Navigation events for the leaks collector: `popstate` stands for each `NavigationEnd`. */
    target,
    stop() {
      stopped = true;
      read(() => subscription?.unsubscribe?.(), undefined);
      subscription = null;
      router = null;
      listeners.clear();
    },
  };
}

interface ErrorUtilsLike {
  getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
  setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
}

/**
 * React Native's global error handler (`ErrorUtils`) as the `error` events of
 * an event target, for the errors collector. The previous handler always runs
 * after the listeners, and is put back when the last listener leaves.
 * Undefined where there is no `ErrorUtils`.
 */
export function errorUtilsTarget(
  utils: ErrorUtilsLike | undefined = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils,
): Pick<Window, 'addEventListener' | 'removeEventListener'> | undefined {
  if (
    typeof utils?.getGlobalHandler !== 'function' ||
    typeof utils.setGlobalHandler !== 'function'
  ) {
    return undefined;
  }
  const listeners = new Set<(event: Event) => void>();
  let previous: ((error: unknown, isFatal?: boolean) => void) | undefined;
  let installed: ((error: unknown, isFatal?: boolean) => void) | null = null;
  const install = () => {
    previous = read(() => utils.getGlobalHandler!(), undefined);
    installed = (error, isFatal) => {
      const message = read(() => String((error as { message?: unknown })?.message ?? ''), '');
      for (const listener of [...listeners]) {
        try {
          listener({ error, message } as unknown as Event);
        } catch {
          // A listener never stops the app's own handler.
        }
      }
      previous?.(error, isFatal);
    };
    read(() => utils.setGlobalHandler!(installed!), undefined);
  };
  const uninstall = () => {
    // Only while ours is the active handler, so a handler set after ours stays.
    if (installed && read(() => utils.getGlobalHandler!(), undefined) === installed) {
      const restore = previous ?? (() => {});
      read(() => utils.setGlobalHandler!(restore), undefined);
    }
    installed = null;
    previous = undefined;
  };
  return {
    addEventListener(type: string, listener: unknown) {
      if (type !== 'error' || typeof listener !== 'function') return;
      listeners.add(listener as (event: Event) => void);
      if (!installed) install();
    },
    removeEventListener(type: string, listener: unknown) {
      if (type !== 'error') return;
      listeners.delete(listener as (event: Event) => void);
      if (!listeners.size) uninstall();
    },
  } as Pick<Window, 'addEventListener' | 'removeEventListener'>;
}

interface ApplicationEventsLike {
  on?: (event: string, callback: (args: unknown) => void) => void;
  off?: (event: string, callback: (args: unknown) => void) => void;
}

/** NativeScript's error events: thrown and not caught, and dropped while one was handled. */
const NATIVESCRIPT_ERROR_EVENTS = ['uncaughtError', 'discardedError'] as const;

/**
 * NativeScript's `Application` error events as the `error` events of an
 * event target, for the errors collector. `uncaughtError` and
 * `discardedError` carry the error in `args.error`. Undefined when
 * `Application` has no `on` and `off`.
 */
export function applicationErrorsTarget(app: ApplicationEventsLike | undefined) {
  if (typeof app?.on !== 'function' || typeof app.off !== 'function') return undefined;
  const callbacks = new Map<unknown, (args: unknown) => void>();
  return {
    addEventListener(type: string, listener: unknown) {
      if (type !== 'error' || typeof listener !== 'function' || callbacks.has(listener)) return;
      const callback = (args: unknown) => {
        const error = read(() => (args as { error?: unknown })?.error, undefined);
        const message = read(() => String((error as { message?: unknown })?.message ?? ''), '');
        (listener as (event: Event) => void)({ error, message } as unknown as Event);
      };
      callbacks.set(listener, callback);
      for (const name of NATIVESCRIPT_ERROR_EVENTS) read(() => app.on!(name, callback), undefined);
    },
    removeEventListener(type: string, listener: unknown) {
      const callback = callbacks.get(listener);
      if (type !== 'error' || !callback) return;
      callbacks.delete(listener);
      for (const name of NATIVESCRIPT_ERROR_EVENTS) read(() => app.off!(name, callback), undefined);
    },
  } as unknown as EventsTarget;
}

/**
 * Starts the diagnosis collectors the config turns on for one native page.
 * Each one pushes with `pageId`, skips unchanged reports and sends a
 * keepalive inside the server's expiry, as in the browser.
 */
export function attachNativeDiagnostics<H extends object>(
  my: Rpc,
  pageId: string,
  options: NativeDiagnosticsOptions<H>,
): NativeDiagnostics {
  const { getNg, tree, config, tickMs, describe } = options;
  const on = config.inspectors;
  const limits = config.limits;
  const version = () => hostAngularVersion(read(() => tree.roots()[0], undefined));
  const profilerGate = (): ProfilerGate => {
    const major = Number.parseInt(version() ?? '', 10);
    return { major: Number.isFinite(major) ? major : 0 };
  };
  const hostId = (host: unknown) =>
    host && read(() => tree.isHost(host), false) ? elementId(host as object) : null;
  const writes = createRecentWrites();
  const dirty = createTreeDirty();

  const cd = on.components
    ? attachChangeDetection(my, pageId, getNg, limits.cdCycles, tickMs, () => true, {
        profilerGate,
        roots: () => tree.roots(),
        hostId,
      })
    : null;
  const routerWatch = on.components ? createRouterWatch(getNg, () => tree.roots()) : null;
  const leaks = routerWatch
    ? attachLeaks(my, pageId, getNg as () => LeaksDebugNg<H> | undefined, {
        tickMs,
        tree: () => tree,
        route: routerWatch.route,
        title: () => describe().title,
        angularMajor: () => profilerGate().major,
        addProfiler: (listener) => addProfilerListener(getNg(), listener, profilerGate()),
        // Kept in memory: an app on a device has no session storage and no reload.
        storage: null,
        target: routerWatch.target,
        dirty,
        // Angular reads only DOM nodes as unknown hosts, so detached views can't be told apart.
        probe: null,
      })
    : null;
  const errors = on.errors
    ? attachErrors(my, pageId, getNg as () => ErrorsDebugNg | undefined, {
        tickMs,
        writes,
        tree: tree as HostTree<object>,
        describe,
        target: options.errorTarget ?? NO_EVENTS,
      })
    : null;
  if (on.injectors) {
    registerProviderValues(my.rpc, pageId, getNg as () => ProviderDebugNg<H> | undefined);
  }
  const startup = on.injectors
    ? attachStartup(my, pageId, getNg, {
        tickMs,
        root: () => tree.roots()[0],
        describe,
        env: {
          get version() {
            return version();
          },
          noHook: NATIVE_STARTUP_NOTE,
        },
      })
    : null;
  const queries = on.tanstackQuery
    ? attachTanstackQuery(my, pageId, getNg as () => QueryDebugNg<H> | undefined, {
        tree,
        allowWrites: config.actions.tanstackQuery,
        describe,
      })
    : null;
  // NGXS, Elf and MiniRx report through their Redux DevTools integration.
  const otherStores = on.ngrx
    ? attachReduxStores(my, pageId, { maxLog: limits.changeLog, describe })
    : null;
  const plugins = on.plugins
    ? attachPlugins(my, pageId, getNg, { config, tickMs, describe })
    : null;
  const angularInfo = attachAngularInfo(my, pageId, getNg, {
    tickMs,
    doc: () => undefined,
    version,
  });

  const collectors = [
    cd && (() => cd.push()),
    leaks && (() => leaks.push()),
    errors && (() => errors.push()),
    startup && (() => startup.push()),
    queries && (() => queries.push()),
    otherStores && (() => otherStores.push()),
    plugins && (() => plugins.push()),
    () => angularInfo.push(),
  ].filter((collect): collect is () => Promise<void> => typeof collect === 'function');

  return {
    collectors,
    onSignalChange(id, label, change, raw) {
      if (on.errors) writes.add(id, label, change, raw);
    },
    signalHookReady() {
      writes.listening();
    },
    treeChanged() {
      dirty.bump();
    },
    leave() {
      cd?.leave();
      leaks?.leave();
      errors?.leave();
      startup?.leave();
      queries?.leave();
      otherStores?.leave();
      plugins?.leave();
      angularInfo.leave();
    },
    stop() {
      cd?.stop();
      leaks?.stop();
      routerWatch?.stop();
      errors?.stop();
      startup?.stop();
      queries?.stop();
      otherStores?.stop();
      plugins?.stop();
    },
  };
}

/** An event target that never fires, where a platform has no global error events. */
const NO_EVENTS = {
  addEventListener() {},
  removeEventListener() {},
} as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>;

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
