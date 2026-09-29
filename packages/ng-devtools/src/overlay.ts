import { connectDevframe } from 'devframe/client';
export { registerNgrxSignals } from './ngrx-register.ts';
import { attachAnalog } from './analog-runtime.ts';
import { attachForms } from './forms-collector.ts';
import { attachPipes } from './pipes-collector.ts';
import { attachHttp } from './http-overlay.ts';
import { attachNgrx } from './ngrx-overlay.ts';
import { collectInjectorTree } from './injector-tree.ts';
import {
  findRouters,
  setGeneration,
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
import { elementById, elementId } from './element-id.ts';
import { collectSignalGraph, graphKey, toSignalTarget, type SignalTarget } from './signal-graph.ts';
import { serializeNamed } from './serialize.ts';

declare global {
  interface Window {
    __ngDevtoolsComponentOf?: (el: unknown) => string | null;
  }
}

let highlightEl: HTMLElement | null = null;
let highlightTimer: ReturnType<typeof setTimeout> | undefined;
let highlightFrame = 0;
const PAGE_ID_KEY = 'ng-devtools-page-id';
const ROUTER_HEARTBEAT_MS = 5000;

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

export async function initOverlay(options: { baseURL?: string | string[] } = {}) {
  // `connectDevframe()` alone looks for the connection next to the page, which
  // misses the documented `/__ng-devtools/` mount in a host app.
  const rpc = await connectDevframe({
    baseURL: options.baseURL ?? ['./', '/__ng-devtools/', '/__devframes/ng-devtools/'],
  });
  const my = rpc.scope('ng-devtools');

  let componentTarget: string | null = null;
  let lastTreeJson = '';
  let treeSkips = 0;
  async function pushTree(force = false) {
    const tree = collectComponentTree(getNg(), { selectedId: componentTarget });
    const json = JSON.stringify(tree);
    if (!force && json === lastTreeJson && ++treeSkips < 4) return;
    lastTreeJson = json;
    treeSkips = 0;
    await my.rpc.call('push-component-tree', { ...tree, pageId });
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
    const graph = collectSignalGraph(getNg(), signalTarget);
    if (!graph) return;
    const key = graphKey(graph);
    if (!force && key === lastSignalKey && ++signalSkips < 4) return;
    lastSignalKey = key;
    signalSkips = 0;
    const owner = graph.component?.id ?? '';
    const full = force || !historyDelta || owner !== historyFor;
    historyFor = owner;
    const history = signalHistory.collectDelta(graph.nodes, full);
    const answer = (await my.rpc.call('push-signal-graph', {
      ...graph,
      pageId,
      ...(full ? { history } : { historyDelta: history }),
    })) as { delta?: boolean } | undefined;
    historyDelta = answer?.delta === true;
  }

  let lastInjectorJson = '';
  let injectorSkips = 0;
  async function pushInjectorTree() {
    const tree = collectInjectorTree(getNg());
    const json = JSON.stringify(tree);
    if (json === lastInjectorJson && ++injectorSkips < 4) return;
    lastInjectorJson = json;
    injectorSkips = 0;
    await my.rpc.call('push-injector-tree', { ...tree, pageId });
  }

  const { id: pageId, release: releasePageId } = await claimPageId();
  const stopAnalog = attachAnalog(my, pageId, getNg);
  const forms = attachForms(my, pageId, getNg, { show: showHighlight, clear: clearHighlight });
  const pushForms = forms.push;
  const pipes = attachPipes(my, pageId, getNg);
  const pushPipes = pipes.push;
  const http = attachHttp(my, pageId);
  const ngrx = attachNgrx(my, pageId, getNg);
  const pushNgrxState = () => void ngrx.push();
  const pushHttp = () => void http.push().catch(() => {});

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
    typeof MutationObserver === 'function'
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
      if (router && ng) {
        if (configTracker.update(router) || !config) {
          config = walkConfig(router);
          setup = detectSetup(ng, router, routerCount, routerRoot);
          setGeneration(configTracker.generation);
          if (instrumented) {
            stopInstrument?.();
            stopInstrument = instrument(router, navigations);
          }
        }
        report['generation'] = configTracker.generation;
        if (sentGeneration !== configTracker.generation) report['config'] = config;
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

  pushTree();
  pushSignalGraph();
  pushInjectorTree();
  pushNgrxState();
  pushForms();
  pushPipes();
  pushRouter();
  pushHttp();

  const interval = setInterval(() => {
    pushTree();
    pushSignalGraph();
    pushInjectorTree();
    pushNgrxState();
    pushForms();
    pushPipes();
    pushRouter();
    pushHttp();
  }, 3000);

  my.rpc.register({
    name: 'highlight-in-page',
    type: 'event',
    jsonSerializable: true,
    handler: (selector: string | { pageId?: string; id?: string } | null) => {
      if (selector && typeof selector === 'object') {
        if (selector.pageId && selector.pageId !== pageId) return;
        clearHighlight();
        const host = typeof selector.id === 'string' ? elementById(selector.id) : null;
        if (host instanceof HTMLElement) showHighlight(host);
        return;
      }
      clearHighlight();
      if (typeof selector !== 'string' || !selector) return;
      // The selector comes from an agent, so it may not be valid CSS.
      let el: Element | null = null;
      try {
        el = document.querySelector(selector);
      } catch {
        return;
      }
      if (el instanceof HTMLElement) showHighlight(el);
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

  window.__ngDevtoolsComponentOf = (el) => {
    const host = el instanceof Element ? componentHostOf(getNg(), el) : null;
    return host ? elementId(host) : null;
  };

  const leave = () => {
    pipes.pause();
    void my.rpc.call('forget-forms-page', pageId).catch(() => {});
    void my.rpc.call('forget-router-page', pageId).catch(() => {});
    void my.rpc.call('forget-pipes-page', pageId).catch(() => {});
    void my.rpc.call('forget-component-page', pageId).catch(() => {});
    lastInjectorJson = '';
    void my.rpc.call('forget-injector-page', pageId).catch(() => {});
    http.leave();
    void my.rpc.call('forget-analog-page', pageId).catch(() => {});
    ngrx.leave();
  };
  addEventListener('pagehide', leave);
  const resendConfig = () => {
    sentGeneration = -1;
    pipes.resume();
  };
  addEventListener('pageshow', resendConfig);

  return () => {
    clearInterval(interval);
    restoreSignalHook();
    removeEventListener('pagehide', leave);
    forms.stop();
    pipes.stop();
    void my.rpc.call('forget-pipes-page', pageId).catch(() => {});
    ngrx.stop();
    stopAnalog();
    removeEventListener('pageshow', resendConfig);
    for (const cleanup of routerCleanup) cleanup();
    routerCleanup = [];
    stopInstrument?.();
    routerDomObserver?.disconnect();
    clearTimeout(routerPushTimer);
    releasePageId();
    clearHighlight();
    delete window.__ngDevtoolsComponentOf;
  };
}

function findAngularElements(): Element[] {
  const versionEls = Array.from(document.querySelectorAll('[ng-version]'));
  const allEls = Array.from(document.querySelectorAll('*'));
  const hostEls = allEls.filter((el) =>
    Array.from(el.attributes).some((a) => a.name.startsWith('_nghost')),
  );
  return Array.from(new Set([...versionEls, ...hostEls]));
}

// Highlight overlay
function showHighlight(el: HTMLElement) {
  clearHighlight();
  highlightEl = document.createElement('div');
  Object.assign(highlightEl.style, {
    position: 'fixed',
    background: 'rgba(245, 165, 36, 0.12)',
    border: '2px solid rgba(245, 165, 36, 0.9)',
    borderRadius: '4px',
    pointerEvents: 'none',
    zIndex: '2147483645',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(highlightEl);
  const follow = () => {
    if (!highlightEl) return;
    const rect = el.getBoundingClientRect();
    Object.assign(highlightEl.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    highlightFrame = requestAnimationFrame(follow);
  };
  follow();
  highlightTimer = setTimeout(clearHighlight, 2000);
}

function clearHighlight() {
  clearTimeout(highlightTimer);
  cancelAnimationFrame(highlightFrame);
  highlightEl?.remove();
  highlightEl = null;
}

// --- Signal Graph collection using Angular's debug API ---
type SignalSetHook = ((node: RawSignalNode) => void) | null;

export async function installSignalWriteHook(
  onWrite: (node: RawSignalNode) => void,
  load: () => Promise<{ setPostSignalSetFn: (fn: SignalSetHook) => SignalSetHook }> = () =>
    import('@angular/core/primitives/signals') as never,
): Promise<() => void> {
  let setHook: (fn: SignalSetHook) => SignalSetHook;
  try {
    ({ setPostSignalSetFn: setHook } = await load());
  } catch {
    // Without the hook, history falls back to poll samples only.
    return () => {};
  }
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
  !(typeof process !== 'undefined' && process.env?.['VITEST'])
) {
  initOverlay().catch(console.error);
  import('./popup.ts').then((m) => m.showDevtools()).catch(console.error);
}
