// The overlay for a NativeScript Angular app. It reports the same live data as
// the browser overlay, over the app's network connection to a devtools server
// running on the developer's machine.
//
// Call `initNativeScriptOverlay()` before `runNativeScriptAngularApp()`, and
// give the runtime a `WebSocket` global first (for example by importing
// `@valor/nativescript-websockets` in `polyfills.ts`).

import { Application, isAndroid } from '@nativescript/core';
import { connectDevframe } from 'devframe/client';
import { collectComponentTree, type ComponentDebugNg } from './component-tree.ts';
import { elementById } from './element-id.ts';
import { hostBySelector } from './host-tree.ts';
import { collectInjectorTree } from './injector-tree.ts';
import { attachNgrx } from './ngrx-overlay.ts';
import {
  collectSignalGraph,
  graphKey,
  toSignalTarget,
  type SignalDebugNg,
  type SignalTarget,
} from './signal-graph.ts';
import { createSignalHistory, installSignalWriteHook } from './signal-history.ts';
import { serializeNamed } from './serialize.ts';
import {
  nativeScriptTree,
  renderedView,
  type NativeScriptDebugNg,
  type NativeView,
} from './overlay-nativescript-views.ts';

type DebugNg = SignalDebugNg<NativeView> & ComponentDebugNg<NativeView> & NativeScriptDebugNg;

export interface NativeScriptOverlayOptions {
  /** Absolute URL of the devtools server. Defaults to `defaultDevtoolsBaseURL()`. */
  baseURL?: string;
  /** How often the app reports, in milliseconds. */
  intervalMs?: number;
  /** How long to wait before trying the server again after a failure, in milliseconds. */
  retryMs?: number;
}

/**
 * Where a simulator or emulator finds a devtools server on the machine that
 * runs it. A physical device needs the machine's LAN address instead.
 */
export function defaultDevtoolsBaseURL(port = 9999): string {
  // The Android emulator reaches its host at 10.0.2.2; the iOS simulator shares
  // the host's loopback interface.
  return `http://${isAndroid ? '10.0.2.2' : 'localhost'}:${port}/`;
}

export function initNativeScriptOverlay(options: NativeScriptOverlayOptions = {}): () => void {
  const baseURL = options.baseURL ?? defaultDevtoolsBaseURL();
  gateInjectorProfiler();
  installWebShims(baseURL);

  if (typeof WebSocket === 'undefined') {
    console.warn(
      '[pangular] No WebSocket global. Import @valor/nativescript-websockets in polyfills.ts before starting the overlay.',
    );
    return () => {};
  }
  ensureWebSocketStates();

  // The server and the app restart independently of each other, and the
  // devframe client has no reconnect of its own, so a session that fails or
  // drops is replaced after a pause for as long as the overlay is alive.
  const intervalMs = options.intervalMs ?? 3000;
  const retryMs = options.retryMs ?? 5000;
  let disposed = false;
  let session: (() => void) | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let unreachable = false;

  const again = () => {
    session?.();
    session = undefined;
    if (disposed || retry) return;
    retry = setTimeout(() => {
      retry = undefined;
      start();
    }, retryMs);
  };
  const start = () => {
    connect(baseURL, intervalMs, again).then(
      (dispose) => {
        if (disposed) {
          dispose();
          return;
        }
        session = dispose;
        unreachable = false;
        console.log(`[pangular] Connected to the devtools server at ${baseURL}`);
      },
      () => {
        if (!unreachable) {
          console.warn(
            `[pangular] Could not reach the devtools server at ${baseURL}; retrying every ${retryMs}ms.`,
          );
        }
        unreachable = true;
        again();
      },
    );
  };
  start();

  return () => {
    disposed = true;
    clearTimeout(retry);
    session?.();
    session = undefined;
  };
}

async function connect(baseURL: string, intervalMs: number, onDisconnected: () => void) {
  // SSE is out: the NativeScript fetch has no streaming body.
  // Closing the socket on purpose also fires the close event.
  let closing = false;
  let dead = false;
  const rpc = await connectDevframe({
    baseURL,
    transport: 'websocket',
    simpleAuth: false,
    otpParam: false,
    webmcp: false,
    wsOptions: {
      onDisconnected: () => {
        dead = true;
        if (!closing) onDisconnected();
      },
    },
  });
  try {
    const stop = await startSession(rpc, intervalMs);
    if (dead) {
      closing = true;
      stop();
      return () => {};
    }
    return () => {
      closing = true;
      stop();
    };
  } catch (error) {
    closing = true;
    rpc.close?.();
    throw error;
  }
}

async function startSession(
  rpc: Awaited<ReturnType<typeof connectDevframe>>,
  intervalMs: number,
): Promise<() => void> {
  const my = rpc.scope('pangular');
  const pageId = Math.random().toString(36).slice(2, 6);

  const tree = nativeScriptTree(angularDebugApi, () => Application.getRootView() as NativeView);

  let componentTarget: string | null = null;
  let lastTreeJson = '';
  let treeSkips = 0;
  async function pushTree(force = false) {
    const ng = angularDebugApi();
    if (!ng) return;
    const report = collectComponentTree(ng, { tree, selectedId: componentTarget });
    const json = JSON.stringify(report);
    if (!force && json === lastTreeJson && ++treeSkips < 4) return;
    lastTreeJson = json;
    treeSkips = 0;
    await my.rpc.call('push-component-tree', { ...report, pageId });
  }

  const signalHistory = createSignalHistory((value, name) =>
    serializeNamed(name, value, { budget: 1000 }),
  );
  const restoreSignalHook = await installSignalWriteHook(signalHistory.onWrite);

  let signalTarget: SignalTarget = null;
  let lastSignalKey = '';
  let signalSkips = 0;
  let historyDelta = false;
  let historyFor = '';
  async function pushSignalGraph(force = false) {
    const graph = collectSignalGraph(angularDebugApi(), signalTarget, tree);
    if (!graph) return;
    const key = graphKey(graph);
    if (!force && key === lastSignalKey && ++signalSkips < 4) return;
    lastSignalKey = key;
    signalSkips = 0;
    const owner = graph.component?.id ?? '';
    const full = force || !historyDelta || owner !== historyFor;
    historyFor = owner;
    const { changes: history, rollback } = signalHistory.collectDeltaWithRollback(
      graph.nodes,
      full,
    );
    let answer: { delta?: boolean } | undefined;
    try {
      answer = (await my.rpc.call('push-signal-graph', {
        ...graph,
        pageId,
        ...(full ? { history } : { historyDelta: history }),
      })) as { delta?: boolean } | undefined;
    } catch (error) {
      rollback();
      lastSignalKey = '';
      throw error;
    }
    historyDelta = answer?.delta === true;
  }

  let lastInjectorJson = '';
  let injectorSkips = 0;
  async function pushInjectorTree() {
    const ng = angularDebugApi();
    if (!ng) return;
    const report = collectInjectorTree(ng, tree);
    const json = JSON.stringify(report);
    if (json === lastInjectorJson && ++injectorSkips < 4) return;
    lastInjectorJson = json;
    injectorSkips = 0;
    await my.rpc.call('push-injector-tree', { ...report, pageId });
  }

  const ngrx = attachNgrx(my, pageId, angularDebugApi, undefined, {
    tree,
    describe: () => ({ url: '/', title: `NativeScript (${isAndroid ? 'Android' : 'iOS'})` }),
  });

  const report = async () => {
    await pushTree();
    await pushSignalGraph();
    await pushInjectorTree();
    await ngrx.push();
  };
  const tick = () => {
    if (rpc.status !== 'connected' && rpc.status !== 'connecting') return;
    report().catch((error) => console.warn('[pangular] report failed', error));
  };
  tick();
  const interval = setInterval(tick, intervalMs);

  my.rpc.register({
    name: 'highlight-in-page',
    type: 'event',
    jsonSerializable: true,
    handler: (selector: string | { pageId?: string; id?: string } | null) => {
      if (selector && typeof selector === 'object') {
        if (selector.pageId && selector.pageId !== pageId) return;
        const host =
          typeof selector.id === 'string'
            ? elementById(selector.id, (h) => tree.isHost(h) && tree.connected(h))
            : null;
        if (tree.isHost(host)) flash(renderedView(host));
        return;
      }
      if (typeof selector !== 'string' || !selector) return;
      const host = hostBySelector(tree, selector);
      if (host) flash(renderedView(host));
    },
  });

  my.rpc.register({
    name: 'select-signal-component',
    type: 'event',
    jsonSerializable: true,
    handler: (request: unknown) => {
      const next = toSignalTarget(request, pageId);
      if (next === undefined) return;
      signalTarget = next;
      void pushSignalGraph(true);
    },
  });

  my.rpc.register({
    name: 'inspect-component-in-page',
    type: 'event',
    jsonSerializable: true,
    handler: (request: { pageId?: string; id?: string | null } | null) => {
      if (request?.pageId && request.pageId !== pageId) return;
      componentTarget = typeof request?.id === 'string' ? request.id : null;
      void pushTree(true);
    },
  });

  return () => {
    clearInterval(interval);
    restoreSignalHook?.();
    ngrx.stop();
    void Promise.allSettled([
      my.rpc.call('forget-component-page', pageId),
      my.rpc.call('forget-injector-page', pageId),
      my.rpc.call('forget-ngrx-page', pageId),
    ]).finally(() => rpc.close?.());
  };
}

function angularDebugApi(): DebugNg | undefined {
  const ng = (globalThis as { ng?: DebugNg }).ng;
  if (typeof ng?.getComponent !== 'function') return undefined;
  const getDirectives = ng.getDirectives;
  if (!getDirectives) return ng;
  return { ...ng, getDirectives: (host) => withTextGlobal(() => getDirectives(host)) };
}

/**
 * Angular's `getDirectives()` starts with `node instanceof Text`, a DOM global
 * a NativeScript runtime lacks, so a stand-in exists for the length of the call.
 */
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

const flashing = new WeakMap<
  NativeView,
  { borderWidth: unknown; borderColor: unknown; timer: ReturnType<typeof setTimeout> }
>();

/** Outline a view for two seconds, keeping the border it had for when that ends. */
function flash(view: NativeView) {
  const active = flashing.get(view);
  if (active) clearTimeout(active.timer);
  const { borderWidth, borderColor } = active ?? view;
  view.borderWidth = 2;
  view.borderColor = '#68b6ff';
  const timer = setTimeout(() => {
    flashing.delete(view);
    view.borderWidth = borderWidth;
    view.borderColor = borderColor;
  }, 2000);
  flashing.set(view, { borderWidth, borderColor, timer });
}

/**
 * Angular wires its injector profiler, which backs the provider lists the DI
 * inspector shows, only when `window` exists as the platform is created, so a
 * `window` is defined here and removed once the profiler is in place. The
 * moment is read off the `ng` global: core publishes `getComponent` right
 * after wiring the profiler, and `getComponent` is the sentinel rather than
 * the `ng` object itself because the router publishes its own utilities onto
 * that object earlier, while `provideRouter()` evaluates.
 */
function gateInjectorProfiler() {
  const g = globalThis as Record<string, unknown>;
  if ('window' in g || 'ng' in g) return;
  Object.defineProperty(g, 'window', { configurable: true, get: () => g });
  const removeWindow = () => {
    if (Object.getOwnPropertyDescriptor(g, 'window')?.get) delete g['window'];
  };
  Object.defineProperty(g, 'ng', {
    configurable: true,
    enumerable: true,
    get: () => undefined,
    set(value: unknown) {
      Object.defineProperty(g, 'ng', {
        configurable: true,
        enumerable: true,
        writable: true,
        value,
      });
      if (!value || typeof value !== 'object') {
        removeWindow();
        return;
      }
      Object.defineProperty(value, 'getComponent', {
        configurable: true,
        enumerable: true,
        get: () => undefined,
        set(fn: unknown) {
          Object.defineProperty(value, 'getComponent', {
            configurable: true,
            enumerable: true,
            writable: true,
            value: fn,
          });
          removeWindow();
        },
      });
    },
  });
}

/**
 * `devframe/client` reads `location` and `navigator` as bare globals when it
 * resolves the socket URL and identifies the client. A NativeScript runtime has
 * neither, so the server's address stands in for the page's.
 */
function installWebShims(baseURL: string) {
  const g = globalThis as Record<string, unknown>;
  if (typeof g['location'] === 'undefined') {
    const url = new URL(baseURL);
    g['location'] = {
      href: url.href,
      origin: url.origin,
      protocol: url.protocol,
      host: url.host,
      hostname: url.hostname,
      port: url.port,
      pathname: url.pathname,
      search: '',
      hash: '',
    };
  }
  if (typeof g['navigator'] === 'undefined') {
    g['navigator'] = { userAgent: `NativeScript/${isAndroid ? 'android' : 'ios'}` };
  }
}

/**
 * The transport compares `readyState` with the constants on the `WebSocket`
 * constructor, which a polyfill may only define on its instances.
 */
function ensureWebSocketStates() {
  const states = WebSocket as unknown as Record<string, number>;
  states['CONNECTING'] ??= 0;
  states['OPEN'] ??= 1;
  states['CLOSING'] ??= 2;
  states['CLOSED'] ??= 3;
}
