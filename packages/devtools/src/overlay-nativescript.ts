// The overlay for a NativeScript Angular app. It reports the same live data as
// the browser overlay, over the app's network connection to a devtools server
// running on the developer's machine.
//
// Call `initNativeScriptOverlay()` before `runNativeScriptAngularApp()`, and
// give the runtime a `WebSocket` global first (for example by importing
// `@valor/nativescript-websockets` in `polyfills.ts`).

import { outsideAngular, setTimeoutOutside } from './outside-angular.ts';
import { Application, isAndroid } from '@nativescript/core';
import { connectDevframe } from 'devframe/client';
import { keepaliveDue } from './change-detection.ts';
import { collectComponentTree, type ComponentDebugNg } from './component-tree.ts';
import { registerComponentValues } from './component-values-overlay.ts';
import { configFromConnection } from './config.ts';
import { elementById } from './element-id.ts';
import { setRedaction } from './forms-privacy.ts';
import { legacyRedaction, serverRedaction } from './overlay-redaction.ts';
import { hostBySelector } from './host-tree.ts';
import { collectInjectorTree } from './injector-tree.ts';
import {
  applicationErrorsTarget,
  attachNativeDiagnostics,
  nativeDebugApi,
} from './native-diagnostics.ts';
import { attachNgrx } from './ngrx-overlay.ts';
import { installReduxDevtoolsHook, uninstallReduxDevtoolsHook } from './redux-devtools-hook.ts';
import { HIGHLIGHT_SAFETY_MS } from './page-highlight.ts';
import { attachPipes } from './pipes-collector.ts';
import type { NgDebugApi } from './pipes-runtime.ts';
import {
  collectSignalGraph,
  graphKey,
  graphValue,
  toSignalTarget,
  type SignalDebugNg,
  type SignalTarget,
} from './signal-graph.ts';
import { createSignalHistory, installSignalWriteHook } from './signal-history.ts';
import { registerSignalPeek } from './signal-peek.ts';
import { serializeNamed } from './serialize.ts';
import {
  nativeScriptTree,
  renderedView,
  type NativeScriptDebugNg,
  type NativeView,
} from './overlay-nativescript-views.ts';
import { claimPageOnServer, newPageId, newPageKey } from './page-id.ts';

type DebugNg = SignalDebugNg<NativeView> & ComponentDebugNg<NativeView> & NativeScriptDebugNg;

type Rpc = Awaited<ReturnType<typeof connectDevframe>>;

const TRUST_TIMEOUT_MS = 5000;
/** How long a highlight stays when the request names no duration. */
const FLASH_MS = 2000;

class UntrustedError extends Error {}

export interface NativeScriptOverlayOptions {
  /** Absolute URL of the devtools server. Defaults to `defaultDevtoolsBaseURL()`. */
  baseURL?: string;
  /** How often the app reports, in milliseconds. Defaults to the server's `limits.refreshMs`. */
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
  // Before the app starts, so stores that look for the Redux DevTools extension find the stand-in.
  installReduxDevtoolsHook();

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
  // The page id outlives the sessions, so the panel keeps the app selected
  // and no ghost page is left behind when the socket reconnects.
  const pageId = newPageId();
  // In memory, like the page id: a new connection shows it to get the page back.
  const pageKey = newPageKey();
  const retryMs = options.retryMs ?? 5000;
  let disposed = false;
  let session: (() => void) | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let unreachable = false;

  const again = () => {
    session?.();
    session = undefined;
    if (disposed || retry) return;
    retry = setTimeoutOutside(() => {
      retry = undefined;
      start();
    }, retryMs);
  };
  const start = () => {
    connect(baseURL, pageId, pageKey, options.intervalMs, again).then(
      (dispose) => {
        if (disposed) {
          dispose();
          return;
        }
        session = dispose;
        unreachable = false;
        console.log(`[pangular] Connected to the devtools server at ${baseURL}`);
      },
      (error: unknown) => {
        if (!unreachable) {
          console.warn(
            error instanceof UntrustedError
              ? `[pangular] The devtools server at ${baseURL} did not accept the app. Start it with --no-auth. Retrying every ${retryMs}ms.`
              : `[pangular] Could not reach the devtools server at ${baseURL}; retrying every ${retryMs}ms.`,
          );
        }
        unreachable = true;
        again();
      },
    );
  };
  // Called from app code, maybe inside the Angular zone: the sessions and their timers must not make zone.js apps tick.
  outsideAngular(start);

  return () => {
    disposed = true;
    clearTimeout(retry);
    session?.();
    session = undefined;
  };
}

async function connect(
  baseURL: string,
  pageId: string,
  pageKey: string,
  intervalMs: number | undefined,
  onDisconnected: () => void,
) {
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
    const trusted = await rpc.ensureTrusted(TRUST_TIMEOUT_MS).catch(() => false);
    if (!trusted) throw new UntrustedError();
    const stop = await startSession(rpc, pageId, pageKey, intervalMs);
    if (dead) {
      closing = true;
      stop(false);
      return () => {};
    }
    return () => {
      closing = true;
      // A dropped socket takes no more calls, so only a live one is told to
      // forget the page.
      stop(!dead);
    };
  } catch (error) {
    closing = true;
    rpc.close?.();
    throw error;
  }
}

async function startSession(
  rpc: Rpc,
  pageId: string,
  pageKey: string,
  intervalMs: number | undefined,
): Promise<(forget: boolean) => void> {
  const my = rpc.scope('pangular');
  // Before any report, so the server hands this connection the page at once.
  await claimPageOnServer(my.rpc, pageId, pageKey);
  const config = configFromConnection(rpc.connectionMeta);
  const on = config.inspectors;
  const tickMs = intervalMs ?? config.limits.refreshMs;
  // Sent only to a trusted connection, so it is not in `__connection.json`.
  // Without it nothing is read: the session fails and the next attempt asks again.
  const redaction = await serverRedaction(my.rpc, legacyRedaction(rpc.connectionMeta));
  if (!redaction) throw new Error('[pangular] Could not read the redaction config');
  setRedaction(redaction);
  const title = `NativeScript (${isAndroid ? 'Android' : 'iOS'})`;

  const tree = nativeScriptTree(angularDebugApi, () => Application.getRootView() as NativeView);
  if (!on.ngrx) uninstallReduxDevtoolsHook();
  const diagnostics = attachNativeDiagnostics(my, pageId, {
    getNg: angularDebugApi,
    tree,
    config,
    tickMs: () => tickMs,
    describe: () => ({ url: '/', title }),
    errorTarget: applicationErrorsTarget(Application),
  });

  const pingKnows = async (name: string) => {
    const answer = (await my.rpc.call(name, pageId)) as { known?: boolean } | undefined;
    return answer?.known !== false;
  };

  let componentTarget: string | null = null;
  const attachValues = registerComponentValues(my.rpc, pageId, {
    getNg: angularDebugApi,
    tree,
    changed: () => void pushTree().catch(() => {}),
  });
  let lastTreeJson = '';
  let treeSentAt = 0;
  async function pushTree(force = false) {
    const ng = angularDebugApi();
    if (!ng) return;
    const report = {
      ...collectComponentTree(ng, { tree, selectedId: componentTarget, withDetail: attachValues }),
      url: '/',
      title,
      platform: 'nativescript' as const,
    };
    const json = JSON.stringify(report);
    if (!force && json === lastTreeJson) {
      if (!keepaliveDue(treeSentAt, tickMs)) return;
      treeSentAt = Date.now();
      if (await pingKnows('ping-component-tree')) return;
    }
    if (json !== lastTreeJson) diagnostics.treeChanged();
    lastTreeJson = json;
    treeSentAt = Date.now();
    try {
      await my.rpc.call('push-component-tree', { ...report, pageId });
    } catch (error) {
      // Sent again on the next tick.
      if (lastTreeJson === json) lastTreeJson = '';
      throw error;
    }
  }

  const signalHistory = createSignalHistory(
    (value, name) => serializeNamed(name, value, { budget: 1000 }),
    Date.now,
    (value, name) => graphValue(name, value),
    { onChange: diagnostics.onSignalChange },
  );
  const restoreSignalHook = on.signals ? await installSignalWriteHook(signalHistory.onWrite) : null;
  if (restoreSignalHook) diagnostics.signalHookReady();

  let signalTarget: SignalTarget = null;
  let lastSignalKey = '';
  let signalSentAt = 0;
  let historyDelta = false;
  let historyFor = '';
  async function pushSignalGraph(force = false) {
    const graph = collectSignalGraph(angularDebugApi(), signalTarget, tree);
    if (!graph) return;
    const key = graphKey(graph);
    if (!force && key === lastSignalKey) {
      if (!keepaliveDue(signalSentAt, tickMs)) return;
      signalSentAt = Date.now();
      if (await pingKnows('ping-signal-graph')) return;
    }
    lastSignalKey = key;
    signalSentAt = Date.now();
    const owner = graph.component?.id ?? '';
    const full = force || !historyDelta || owner !== historyFor;
    historyFor = owner;
    const statuses = (graph.resources ?? [])
      .filter((r) => r.status)
      .map((r) => ({
        id: r.id,
        kind: 'resource' as const,
        label: r.name,
        epoch: r.epoch,
        value: r.status,
      }));
    const { changes: history, rollback } = signalHistory.collectDeltaWithRollback(
      [...graph.nodes, ...statuses],
      full,
    );
    for (const item of [...graph.nodes, ...(graph.resources ?? [])]) {
      const changes = signalHistory.changesOf(item.id);
      if (changes) item.changes = changes;
    }
    let answer: { delta?: boolean } | undefined;
    try {
      answer = (await my.rpc.call('push-signal-graph', {
        ...graph,
        ...(restoreSignalHook ? {} : { writeHook: false as const }),
        pageId,
        ...(full ? { history } : { historyDelta: history }),
      })) as { delta?: boolean } | undefined;
    } catch (error) {
      rollback();
      lastSignalKey = '';
      historyDelta = false;
      throw error;
    }
    historyDelta = answer?.delta === true;
  }

  let lastInjectorJson = '';
  let injectorSentAt = 0;
  async function pushInjectorTree() {
    const ng = angularDebugApi();
    if (!ng) return;
    const report = collectInjectorTree(ng, tree);
    const json = JSON.stringify(report);
    if (json === lastInjectorJson) {
      if (!keepaliveDue(injectorSentAt, tickMs)) return;
      injectorSentAt = Date.now();
      if (await pingKnows('ping-injector-tree')) return;
    }
    lastInjectorJson = json;
    injectorSentAt = Date.now();
    try {
      await my.rpc.call('push-injector-tree', { ...report, pageId });
    } catch (error) {
      // Sent again on the next tick, even when the page did not change.
      if (lastInjectorJson === json) lastInjectorJson = '';
      throw error;
    }
  }

  const ngrx = on.ngrx
    ? attachNgrx(my, pageId, angularDebugApi, config.limits.changeLog, {
        tree,
        describe: () => ({ url: '/', title }),
      })
    : null;

  const pipes = on.pipes
    ? attachPipes(my, pageId, () => angularDebugApi() as NgDebugApi | undefined, { tree })
    : null;

  const collectors = [
    on.components && pushTree,
    on.signals && pushSignalGraph,
    on.injectors && pushInjectorTree,
    ngrx && (() => ngrx.push()),
    pipes && (async () => pipes.push()),
    ...diagnostics.collectors,
  ].filter((collect) => typeof collect === 'function');
  const report = async () => {
    for (const collect of collectors) {
      await collect().catch((error: unknown) => console.warn('[pangular] report failed', error));
    }
  };
  const tick = () => {
    if (rpc.status !== 'connected' && rpc.status !== 'connecting') return;
    report().catch((error) => console.warn('[pangular] report failed', error));
  };
  tick();
  const interval = setInterval(tick, tickMs);

  my.rpc.register({
    name: 'highlight-in-page',
    type: 'event',
    jsonSerializable: true,
    handler: (
      request:
        string | { pageId?: string; id?: string; selector?: string; durationMs?: number } | null,
    ) => {
      const wanted = typeof request === 'string' ? { selector: request } : request;
      if (wanted?.pageId && wanted.pageId !== pageId) return;
      clearFlash();
      if (!wanted) return;
      const host =
        typeof wanted.id === 'string'
          ? elementById<NativeView>(wanted.id, (h) => tree.isHost(h) && tree.connected(h))
          : typeof wanted.selector === 'string' && wanted.selector
            ? hostBySelector(tree, wanted.selector)
            : null;
      if (host && tree.isHost(host)) flash(renderedView(host), wanted.durationMs);
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
      void pushSignalGraph(true).catch(() => {});
    },
  });
  registerSignalPeek(
    my.rpc,
    pageId,
    (target) => collectSignalGraph(angularDebugApi(), target, tree),
    signalHistory,
  );

  my.rpc.register({
    name: 'inspect-component-in-page',
    type: 'event',
    jsonSerializable: true,
    handler: (request: { pageId?: string; id?: string | null } | null) => {
      if (request?.pageId && request.pageId !== pageId) return;
      componentTarget = typeof request?.id === 'string' ? request.id : null;
      void pushTree(true).catch(() => {});
    },
  });

  return (forget) => {
    clearInterval(interval);
    clearFlash();
    restoreSignalHook?.();
    ngrx?.stop();
    pipes?.stop();
    diagnostics.stop();
    if (!forget) {
      rpc.close?.();
      return;
    }
    const pages = [
      on.components && 'forget-component-page',
      on.signals && 'forget-signal-page',
      on.injectors && 'forget-injector-page',
      on.ngrx && 'forget-ngrx-page',
      on.pipes && 'forget-pipes-page',
    ].filter((name): name is string => typeof name === 'string');
    diagnostics.leave();
    void Promise.allSettled(pages.map((name) => my.rpc.call(name, pageId))).finally(() =>
      rpc.close?.(),
    );
  };
}

function angularDebugApi(): DebugNg | undefined {
  return nativeDebugApi<DebugNg>();
}

let flashed: {
  view: NativeView;
  borderWidth: unknown;
  borderColor: unknown;
  timer: ReturnType<typeof setTimeout>;
} | null = null;

/**
 * Outline a view for `durationMs` (two seconds by default), keeping the border
 * it had for when that ends or the next request clears it.
 */
function flash(view: NativeView, durationMs?: number) {
  clearFlash();
  const { borderWidth, borderColor } = view;
  view.borderWidth = 2;
  view.borderColor = '#68b6ff';
  const timer = setTimeout(
    clearFlash,
    typeof durationMs === 'number' && durationMs > 0
      ? Math.min(durationMs, HIGHLIGHT_SAFETY_MS)
      : FLASH_MS,
  );
  flashed = { view, borderWidth, borderColor, timer };
}

/** Put back the border the outlined view had. */
function clearFlash() {
  if (!flashed) return;
  const { view, borderWidth, borderColor, timer } = flashed;
  flashed = null;
  clearTimeout(timer);
  view.borderWidth = borderWidth;
  view.borderColor = borderColor;
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
