import { connectDevframe } from 'devframe/client';
export { registerNgrxSignals } from './ngrx-register.ts';
import { attachAnalog } from './analog-runtime.ts';
import { attachForms } from './forms-collector.ts';
import { attachPipes } from './pipes-collector.ts';
import { attachHttp } from './http-overlay.ts';
import { httpRegistry, storeRules } from './http-rules.ts';
import { attachNgrx } from './ngrx-overlay.ts';
import { collectInjectorTree } from './injector-tree.ts';
import {
  droppedNavigations,
  findRouters,
  redactMessage,
  redactUrl,
  setGeneration,
  setNavigationLimit,
  snapshotRouter,
  watchRouter,
  type NavigationRecord,
  type RouterDebugApi,
} from './router.ts';
import { ConfigTracker, activeIds, walkConfig, type RouteNode } from './router-config.ts';
import { detectSetup, preloaderOf, type RouterSetup } from './router-setup.ts';
import { linksOf, outletsOf } from './router-links.ts';
import {
  captureCallers,
  captureDiagnostics,
  capturePreloads,
  instrument,
  isRouterAction,
  onGuardsCheckStart,
  runAction,
  storeInstrumented,
  storedInstrumented,
  type PreloadRecord,
} from './router-actions.ts';
import { createSignalHistory, type RawSignalNode } from './signal-history.ts';
import { collectComponentTree, componentHostOf } from './component-tree.ts';
import { startComponentPick } from './component-pick.ts';
import { createDeferTracker } from './defer-blocks.ts';
import { elementById, elementId } from './element-id.ts';
import {
  collectSignalGraph,
  graphKey,
  graphValue,
  toSignalTarget,
  type SignalTarget,
} from './signal-graph.ts';
import { serializeNamed } from './serialize.ts';
import { configFromConnection } from './config.ts';
import { setRedaction } from './forms-privacy.ts';
import {
  keepaliveDue,
  outsideAngular,
  watchChangeDetection,
  type RefreshScheduler,
} from './change-detection.ts';
import { attachChangeDetection } from './cd-overlay.ts';
import { SETUP_URL, insideDevtoolsPanel } from './panel-frame.ts';
import { clearHighlight, showHighlight } from './page-highlight.ts';

declare global {
  interface Window {
    __ngDevtoolsComponentOf?: (el: unknown) => string | null;
  }
}

const PAGE_ID_KEY = 'ng-devtools-page-id';
const ROUTER_HEARTBEAT_MS = 5000;
/** A tab in the background still says it is there, at the pace browsers allow it. */
const HIDDEN_HEARTBEAT_MS = 60_000;

function storedPageId(): string | null {
  try {
    return sessionStorage.getItem(PAGE_ID_KEY);
  } catch {
    return null;
  }
}

function storePageId(id: string) {
  try {
    sessionStorage.setItem(PAGE_ID_KEY, id);
  } catch {
    return;
  }
}

async function claimPageId(): Promise<{ id: string; release: () => void }> {
  const fresh = Math.random().toString(36).slice(2, 6);
  let id = storedPageId() ?? fresh;
  if (typeof BroadcastChannel === 'undefined') {
    storePageId(id);
    return { id, release: () => {} };
  }
  const channel = new BroadcastChannel('ng-devtools-page-ids');
  let onTaken = () => {};
  channel.onmessage = (message) => {
    if (message.data?.claim === id) channel.postMessage({ taken: id });
    if (message.data?.taken === id) onTaken();
  };
  const taken = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 150);
    onTaken = () => {
      clearTimeout(timer);
      resolve(true);
    };
    channel.postMessage({ claim: id });
  });
  onTaken = () => {};
  if (taken) id = fresh;
  storePageId(id);
  return { id, release: () => channel.close() };
}

interface OverlayOptions {
  baseURL?: string | string[];
}

let current: { stop: () => void } | null = null;
let popup: Promise<typeof import('./popup.ts')> | undefined;

/**
 * Starts the overlay and resolves with its dispose. Only one overlay runs per
 * page: starting another stops the one before it, including the auto-started one.
 */
export function initOverlay(options: OverlayOptions = {}): Promise<() => void> {
  current?.stop();
  const cleanups: (() => void)[] = [];
  let stopped = false;
  const instance = {
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (current === instance) current = null;
      for (const cleanup of cleanups.splice(0).reverse()) {
        try {
          cleanup();
        } catch {
          continue;
        }
      }
    },
  };
  current = instance;
  const own = (cleanup: () => void) => {
    if (stopped) cleanup();
    else cleanups.push(cleanup);
    return !stopped;
  };
  return outsideAngular(() => startOverlay(options, own)).then(
    () => instance.stop,
    (error) => {
      // A stopped or replaced overlay failing to connect is expected, not an error.
      if (stopped) return instance.stop;
      instance.stop();
      throw error;
    },
  );
}

/** Stops the running overlay and removes the floating devtools button. */
export async function disposeOverlay(): Promise<void> {
  current?.stop();
  const loaded = await popup?.catch(() => undefined);
  await loaded?.hideDevtools();
}

// `connectDevframe()` alone looks for the connection next to the page, which
// misses the documented `/__ng-devtools/` mount in a host app.
const DEFAULT_BASES = ['./', '/__ng-devtools/', '/__devframes/ng-devtools/'];

function noServerError(bases: string | string[], cause: unknown): Error {
  const tried = (Array.isArray(bases) ? bases : [bases]).join(', ');
  return new Error(
    `[ng-devtools] No devtools server found (tried ${tried}). ` +
      'Mount initNgDevtoolsHub() or the ngDevtools() Vite plugin in your dev server, before the SSR handler. ' +
      `On a custom path, pass it to initOverlay({baseURL}). See ${SETUP_URL}`,
    { cause },
  );
}

async function startOverlay(options: OverlayOptions, own: (cleanup: () => void) => boolean) {
  const bases = options.baseURL ?? DEFAULT_BASES;
  const rpc = await connectDevframe({ baseURL: bases }).catch((error: unknown) => {
    throw noServerError(bases, error);
  });
  if (!own(() => rpc.close?.())) return;
  const metaUrl = rpc.connection?.metaBaseUrl;
  if (metaUrl) {
    void popup?.then((m) => m.useDevtoolsBase(new URL('.', metaUrl).href)).catch(() => {});
  }
  const my = rpc.scope('ng-devtools');
  const devtoolsConfig = configFromConnection(rpc.connectionMeta);
  const on = devtoolsConfig.inspectors;
  const limits = devtoolsConfig.limits;
  if (!on.http) storeRules([]);
  setRedaction(devtoolsConfig.redaction);
  setNavigationLimit(limits.navigations);
  if (on.http) httpRegistry().maxCalls = limits.httpCalls;

  let refresher: RefreshScheduler | undefined;
  const tickMs = () => refresher?.intervalMs ?? limits.refreshMs;

  const pingKnows = async (name: string) => {
    const answer = (await my.rpc.call(name, pageId)) as { known?: boolean } | undefined;
    return answer?.known !== false;
  };

  let componentTarget: string | null = null;
  const deferTracker = createDeferTracker();
  let lastTreeJson = '';
  let treeSentAt = 0;
  async function pushTree(force = false) {
    const ng = getNg();
    const deferBlocks = deferTracker.collect(ng);
    const tree = {
      ...collectComponentTree(ng, { selectedId: componentTarget }),
      url: redactUrl(location.href),
      title: redactMessage(document.title),
      ...(deferBlocks ? { deferBlocks } : {}),
    };
    const json = JSON.stringify(tree);
    if (!force && json === lastTreeJson) {
      if (!keepaliveDue(treeSentAt, tickMs())) return;
      treeSentAt = Date.now();
      if (await pingKnows('ping-component-tree')) return;
    }
    lastTreeJson = json;
    treeSentAt = Date.now();
    await my.rpc.call('push-component-tree', { ...tree, pageId });
  }

  const signalHistory = createSignalHistory(
    (value, name) => serializeNamed(name, value, { budget: 1000 }),
    Date.now,
    (value, name) => graphValue(name, value),
  );
  const restoreSignalHook = on.signals ? await installSignalWriteHook(signalHistory.onWrite) : null;
  if (!own(restoreSignalHook ?? (() => {}))) return;
  const writeHookMissing = on.signals && !restoreSignalHook;

  let signalTarget: SignalTarget = null;
  let lastSignalKey = '';
  let signalSentAt = 0;
  let historyDelta = false;
  let historyFor = '';

  async function pushSignalGraph(force = false) {
    const graph = collectSignalGraph(getNg(), signalTarget);
    if (!graph) return;
    const key = graphKey(graph);
    if (!force && key === lastSignalKey) {
      if (!keepaliveDue(signalSentAt, tickMs())) return;
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
    const history = signalHistory.collectDelta([...graph.nodes, ...statuses], full);
    for (const item of [...graph.nodes, ...(graph.resources ?? [])]) {
      const changes = signalHistory.changesOf(item.id);
      if (changes) item.changes = changes;
    }
    const answer = (await my.rpc.call('push-signal-graph', {
      ...graph,
      ...(writeHookMissing ? { writeHook: false as const } : {}),
      pageId,
      ...(full ? { history } : { historyDelta: history }),
    })) as { delta?: boolean } | undefined;
    historyDelta = answer?.delta === true;
  }

  let lastInjectorJson = '';
  let injectorSentAt = 0;
  async function pushInjectorTree() {
    const tree = collectInjectorTree(getNg());
    const json = JSON.stringify(tree);
    if (json === lastInjectorJson) {
      if (!keepaliveDue(injectorSentAt, tickMs())) return;
      injectorSentAt = Date.now();
      if (await pingKnows('ping-injector-tree')) return;
    }
    lastInjectorJson = json;
    injectorSentAt = Date.now();
    await my.rpc.call('push-injector-tree', { ...tree, pageId });
  }

  const { id: pageId, release: releasePageId } = await claimPageId();
  if (!own(releasePageId)) return;
  const stopAnalog = on.analog ? attachAnalog(my, pageId, getNg, limits.refreshMs) : () => {};
  const forms = on.forms
    ? attachForms(
        my,
        pageId,
        getNg,
        { show: showHighlight, clear: clearHighlight },
        limits.formTimeline,
      )
    : null;
  const pipes = on.pipes ? attachPipes(my, pageId, getNg) : null;
  const http = on.http ? attachHttp(my, pageId, tickMs) : null;
  const cd = on.components ? attachChangeDetection(my, pageId, getNg, limits.cdCycles) : null;
  const ngrx = on.ngrx ? attachNgrx(my, pageId, getNg, limits.changeLog) : null;

  const navigations: NavigationRecord[] = [];
  const preloads: PreloadRecord[] = [];
  const configTracker = new ConfigTracker();
  let router: Record<string, unknown> | null = null;
  let routerCount = 0;
  let routerRoot: Element | null = null;
  let routerCleanup: (() => void)[] = [];
  let stopInstrument: (() => void) | null = null;
  let instrumented = storedInstrumented();
  let config: RouteNode[] | undefined;
  let configTruncated = 0;
  let setup: RouterSetup | undefined;
  let sentGeneration = -1;
  let routerMisses = 0;
  let lastRouterPayload = '';
  let lastRouterPushAt = 0;
  let routerPushTimer: ReturnType<typeof setTimeout> | undefined;
  let routerDomDirty = true;
  let outlets: ReturnType<typeof outletsOf> = [];
  let links: ReturnType<typeof linksOf> = [];
  const routerDomObserver =
    on.router && typeof MutationObserver === 'function'
      ? new MutationObserver(() => (routerDomDirty = true))
      : null;
  routerDomObserver?.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'href', 'aria-current'],
  });

  function onRouterChange() {
    routerDomDirty = true;
    scheduleRouterPush();
  }

  function instrumentLoadedRoutes() {
    if (!instrumented || !router || !configTracker.update(router)) return;
    config = undefined;
    const previous = stopInstrument;
    const next = instrument(router, navigations);
    stopInstrument = () => {
      next();
      previous?.();
    };
  }

  function setInstrumented(on: boolean) {
    stopInstrument?.();
    stopInstrument = null;
    instrumented = on;
    storeInstrumented(on);
    if (on && router) stopInstrument = instrument(router, navigations);
    lastRouterPayload = '';
    scheduleRouterPush();
  }

  function attachRouter(ng: RouterDebugApi) {
    const roots = Array.from(document.querySelectorAll('[ng-version]'));
    const candidates = roots.length ? roots : findAngularElements().slice(0, 1);
    const routers = findRouters(ng, candidates);
    if (!routers.length) {
      if (roots.some((root) => read(() => !!ng?.getComponent?.(root), false))) routerMisses++;
      return;
    }
    router = routers[0];
    routerCount = routers.length;
    routerRoot = candidates[0] ?? null;
    const stop = watchRouter(router, navigations, onRouterChange);
    if (stop) routerCleanup.push(stop);
    routerCleanup.push(onGuardsCheckStart(router, instrumentLoadedRoutes));
    routerCleanup.push(captureCallers(router, navigations, ng));
    routerCleanup.push(captureDiagnostics(router, navigations));
    routerCleanup.push(capturePreloads(preloaderOf(ng, routerRoot), preloads, scheduleRouterPush));
  }

  async function pushRouter() {
    try {
      const ng = getNg() as RouterDebugApi | undefined;
      if (!router && routerMisses < 3 && ng) attachRouter(ng);
      const snapshot = router ? snapshotRouter(router) : null;
      const report: Record<string, unknown> = { pageId, snapshot, navigations };
      const dropped = droppedNavigations(navigations);
      if (dropped) report['dropped'] = dropped;
      if (router && ng) {
        if (configTracker.update(router) || !config) {
          const cut = { routes: 0 };
          config = walkConfig(router, cut);
          configTruncated = cut.routes;
          setup = detectSetup(ng, router, routerCount, routerRoot);
          setGeneration(configTracker.generation);
          if (instrumented) {
            stopInstrument?.();
            stopInstrument = instrument(router, navigations);
          }
        }
        report['generation'] = configTracker.generation;
        if (sentGeneration !== configTracker.generation) report['config'] = config;
        if (configTruncated) report['configTruncated'] = configTruncated;
        report['activeIds'] = activeIds(router);
        report['setup'] = setup;
        if (routerDomDirty) {
          routerDomDirty = false;
          outlets = outletsOf(router);
          links = linksOf(ng, router);
        }
        report['outlets'] = outlets;
        report['links'] = links;
        report['preloads'] = preloads;
        report['instrumented'] = instrumented;
      }
      const payload = JSON.stringify(report);
      if (payload === lastRouterPayload) {
        if (Date.now() - lastRouterPushAt < ROUTER_HEARTBEAT_MS) return;
        lastRouterPushAt = Date.now();
        const ping = (await my.rpc.call('ping-router', pageId)) as { known?: boolean } | undefined;
        if (ping?.known === false) {
          lastRouterPayload = '';
          sentGeneration = -1;
        }
        return;
      }
      lastRouterPayload = payload;
      lastRouterPushAt = Date.now();
      const answer = (await my.rpc.call('push-router', report)) as
        { hasConfig?: boolean } | undefined;
      if (answer?.hasConfig === false) sentGeneration = -1;
      else if (report['config']) sentGeneration = configTracker.generation;
    } catch {
      return;
    }
  }

  function scheduleRouterPush() {
    clearTimeout(routerPushTimer);
    routerPushTimer = setTimeout(() => void pushRouter(), 50);
  }

  const collectors = [
    on.components && (() => void pushTree().catch(() => {})),
    on.signals && (() => void pushSignalGraph().catch(() => {})),
    on.injectors && (() => void pushInjectorTree().catch(() => {})),
    ngrx && (() => void ngrx.push()),
    forms?.push,
    pipes?.push,
    on.router && (() => void pushRouter()),
    http && (() => void http.push().catch(() => {})),
    cd && (() => void cd.push().catch(() => {})),
  ].filter((collect) => typeof collect === 'function');
  const pushAll = () => collectors.forEach((run) => run());
  pushAll();
  const watch = () => watchChangeDetection({ getNg, refresh: pushAll, pollMs: limits.refreshMs });
  refresher = watch();

  // A tab in the background runs its timers about once a minute, so it stops
  // collecting and says so; the server keeps its last data meanwhile.
  const reportVisibility = (hidden: boolean) =>
    void my.rpc.call('report-page-visibility', { pageId, hidden }).catch(() => {});
  let stillHidden: ReturnType<typeof setInterval> | undefined;
  let left = false;
  const onVisibility = () => {
    if (left) return;
    if (document.visibilityState === 'hidden') {
      if (!refresher) return;
      refresher.stop();
      refresher = undefined;
      reportVisibility(true);
      stillHidden = outsideAngular(() =>
        setInterval(() => reportVisibility(true), HIDDEN_HEARTBEAT_MS),
      );
      return;
    }
    if (refresher) return;
    clearInterval(stillHidden);
    reportVisibility(false);
    pushAll();
    refresher = watch();
  };
  document.addEventListener('visibilitychange', onVisibility);
  onVisibility();

  my.rpc.register({
    name: 'highlight-in-page',
    type: 'event',
    jsonSerializable: true,
    handler: (
      selector:
        | string
        | {
            pageId?: string;
            id?: string;
            selector?: string;
            reveal?: boolean;
            durationMs?: number;
          }
        | null,
    ) => {
      clearHighlight();
      if (selector && typeof selector === 'object') {
        if (selector.pageId && selector.pageId !== pageId) return;
        const options = {
          reveal: selector.reveal === true,
          ...(typeof selector.durationMs === 'number' ? { durationMs: selector.durationMs } : {}),
        };
        if (typeof selector.id === 'string') {
          const host = elementById(selector.id);
          if (host instanceof Element) showHighlight(host, options);
          return;
        }
        if (typeof selector.selector === 'string') highlightSelector(selector.selector, options);
        return;
      }
      if (typeof selector === 'string') highlightSelector(selector, {});
    },
  });

  my.rpc.register({
    name: 'router-action',
    type: 'event',
    jsonSerializable: true,
    handler: (message: { requestId?: string; pageId?: string; request?: unknown }) => {
      if (!message || typeof message.requestId !== 'string') return;
      if (message.pageId && message.pageId !== pageId) return;
      const respond = (result: unknown) =>
        void my.rpc
          .call('router-action-result', { requestId: message.requestId, pageId, result })
          .catch(() => {});
      if (!router) return respond({ error: 'This page has no Router.' });
      if (!isRouterAction(message.request)) return respond({ error: 'Unknown action.' });
      runAction(router, navigations, message.request, setInstrumented).then(respond, (error) =>
        respond({ error: String((error as Error)?.message ?? error) }),
      );
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

  let cancelComponentPick: (() => void) | null = null;
  if (on.components) {
    my.rpc.register({
      name: 'component-pick',
      type: 'event',
      jsonSerializable: true,
      handler: (request: { requestId?: unknown; pageId?: unknown; cancel?: unknown } | null) => {
        if (!request || (request.pageId && request.pageId !== pageId)) return;
        cancelComponentPick?.();
        if (request.cancel === true || typeof request.requestId !== 'string') return;
        const requestId = request.requestId;
        const pick = startComponentPick({
          getNg,
          highlight: { show: showHighlight, clear: clearHighlight },
        });
        cancelComponentPick = pick.cancel;
        void pick.result.then((result) => {
          if (cancelComponentPick === pick.cancel) cancelComponentPick = null;
          if (result.ok) {
            componentTarget = result.id;
            void pushTree(true).catch(() => {});
          }
          void my.rpc.call('component-pick-result', { requestId, pageId, result }).catch(() => {});
        });
      },
    });
    own(() => cancelComponentPick?.());

    const componentOf = (el: unknown) => {
      const host = el instanceof Element ? componentHostOf(getNg(), el) : null;
      return host ? elementId(host) : null;
    };
    window.__ngDevtoolsComponentOf = componentOf;
    own(() => {
      if (window.__ngDevtoolsComponentOf === componentOf) delete window.__ngDevtoolsComponentOf;
    });
  }

  const forget = (inspector: keyof typeof on, name: string) => {
    if (on[inspector]) void my.rpc.call(name, pageId).catch(() => {});
  };
  const leave = () => {
    left = true;
    refresher?.stop();
    refresher = undefined;
    clearInterval(stillHidden);
    reportVisibility(false);
    pipes?.pause();
    forget('forms', 'forget-forms-page');
    forget('router', 'forget-router-page');
    forget('pipes', 'forget-pipes-page');
    forget('components', 'forget-component-page');
    lastSignalKey = '';
    historyDelta = false;
    forget('signals', 'forget-signal-page');
    cd?.leave();
    lastInjectorJson = '';
    forget('injectors', 'forget-injector-page');
    http?.leave();
    forget('analog', 'forget-analog-page');
    ngrx?.leave();
  };
  addEventListener('pagehide', leave);
  const resendConfig = () => {
    sentGeneration = -1;
    pipes?.resume();
    left = false;
    onVisibility();
  };
  addEventListener('pageshow', resendConfig);

  own(() => {
    refresher?.stop();
    refresher = undefined;
    clearInterval(stillHidden);
    document.removeEventListener('visibilitychange', onVisibility);
    removeEventListener('pagehide', leave);
    removeEventListener('pageshow', resendConfig);
    leave();
    forms?.stop();
    pipes?.stop();
    ngrx?.stop();
    cd?.stop();
    stopAnalog();
    for (const cleanup of routerCleanup) cleanup();
    routerCleanup = [];
    stopInstrument?.();
    stopInstrument = null;
    routerDomObserver?.disconnect();
    clearTimeout(routerPushTimer);
    clearHighlight();
  });
}

function highlightSelector(selector: string, options: { reveal?: boolean; durationMs?: number }) {
  if (!selector) return;
  // The selector comes from an agent, so it may not be valid CSS.
  let el: Element | null = null;
  try {
    el = document.querySelector(selector);
  } catch {
    return;
  }
  if (el) showHighlight(el, options);
}

function findAngularElements(): Element[] {
  const versionEls = Array.from(document.querySelectorAll('[ng-version]'));
  const allEls = Array.from(document.querySelectorAll('*'));
  const hostEls = allEls.filter((el) =>
    Array.from(el.attributes).some((a) => a.name.startsWith('_nghost')),
  );
  return Array.from(new Set([...versionEls, ...hostEls]));
}

// --- Signal Graph collection using Angular's debug API ---
type SignalSetHook = ((node: RawSignalNode) => void) | null;

export async function installSignalWriteHook(
  onWrite: (node: RawSignalNode) => void,
  load: () => Promise<{ setPostSignalSetFn: (fn: SignalSetHook) => SignalSetHook }> = () =>
    import('@angular/core/primitives/signals') as never,
): Promise<(() => void) | null> {
  let setHook: (fn: SignalSetHook) => SignalSetHook;
  try {
    ({ setPostSignalSetFn: setHook } = await load());
  } catch {
    // Without the hook, history falls back to poll samples only.
    return null;
  }
  if (typeof setHook !== 'function') return null;
  let prev: SignalSetHook = null;
  let active = true;
  const hook = (node: RawSignalNode) => {
    prev?.(node);
    if (!active) return;
    try {
      onWrite(node);
    } catch {
      return;
    }
  };
  prev = setHook(hook);
  return () => {
    active = false;
    const current = setHook(prev);
    // Someone chained after us; keep theirs, our hook now just forwards.
    if (current !== hook) setHook(current);
  };
}

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function getNg(): any {
  return (window as any).ng;
}

// Auto-init when loaded as a script (skip during test environment)
if (
  typeof document !== 'undefined' &&
  !(typeof process !== 'undefined' && process.env?.['VITEST']) &&
  !insideDevtoolsPanel()
) {
  initOverlay().catch(console.error);
  popup = import('./popup.ts');
  popup.then((m) => m.showDevtools()).catch(console.error);
}
