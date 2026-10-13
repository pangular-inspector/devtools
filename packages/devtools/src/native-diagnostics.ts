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
import type { SignalChange } from './types.ts';
import { attachStartup } from './startup-timing.ts';

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
    if (installed && read(() => utils.getGlobalHandler!(), undefined) === installed && previous) {
      read(() => utils.setGlobalHandler!(previous!), undefined);
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
    return { major: Number.isFinite(major) ? major : 0, alone: true };
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
  const leaks = on.components
    ? attachLeaks(my, pageId, getNg as () => LeaksDebugNg<H> | undefined, {
        tickMs,
        tree: () => tree,
        route: () => describe().url,
        title: () => describe().title,
        angularMajor: () => profilerGate().major,
        addProfiler: (listener) => addProfilerListener(getNg(), listener, profilerGate()),
        // Kept in memory: an app on a device has no session storage and no reload.
        storage: null,
        target: null,
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
