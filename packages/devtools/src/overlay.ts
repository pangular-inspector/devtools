import { connectDevframe } from 'devframe/client';
import { overlayPopup } from './overlay-popup.ts';
import {
  forgetDevframeConnection,
  overlayConnectOptions,
  overlayReconnectOptions,
  warnOnConnectionTrouble,
} from './overlay-connection.ts';
import { createOverlayLink, type LinkClient } from './overlay-link.ts';
export { registerNgrxSignals } from './ngrx-register.ts';
import { attachAnalog } from './analog-runtime.ts';
import { attachForms } from './forms-collector.ts';
import { attachPipes } from './pipes-collector.ts';
import { attachHttp } from './http-overlay.ts';
import { attachCapacitor } from './capacitor-overlay.ts';
import { attachErrors } from './errors-collector.ts';
import { attachLeaks } from './leaks-collector.ts';
import { attachPlugins } from './plugins-collector.ts';
import { attachStartup } from './startup-timing.ts';
import { attachBrowserTools } from './browser-tools.ts';
import { attachAxe, axeOwnerNg } from './axe-runner.ts';
import { createRecentWrites } from './error-explain.ts';
import { allowClientRules, httpRegistry } from './http-rules.ts';
import { attachNgrx } from './ngrx-overlay.ts';
import { attachReduxStores } from './redux-stores-collector.ts';
import { uninstallReduxDevtoolsHook } from './redux-devtools-hook.ts';
import { attachTanstackQuery } from './query-collector.ts';
import { collectInjectorTree } from './injector-tree.ts';
import { registerProviderValues } from './provider-values.ts';
import {
  clearNavigations,
  droppedNavigations,
  findRouters,
  redactMessage,
  redactUrl,
  resetNavigations,
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
import { createSignalHistory, installSignalWriteHook } from './signal-history.ts';
import { registerSignalPeek } from './signal-peek.ts';
import { registerSignalRestore } from './signal-restore.ts';
import { createSignalWatch, registerSignalWatch } from './signal-watch.ts';
export { installSignalWriteHook } from './signal-history.ts';
import {
  collectComponentTree,
  componentHostOf,
  selectedComponentDetail,
} from './component-tree.ts';
import { startComponentPick } from './component-pick.ts';
import { registerComponentEdit } from './component-edit-overlay.ts';
import { registerComponentValues } from './component-values-overlay.ts';
import type { ScreenshotRequest } from './component-screenshot.ts';
import { installSourceHelpers } from './component-source.ts';
import { createDeferTracker } from './defer-blocks.ts';
import { attachHydrationOverlay } from './hydration-overlay.ts';
import { controlFlowReader, createForTracker } from './for-blocks.ts';
import { attachConsoleGlobals } from './console-handles.ts';
import { elementById, elementId } from './element-id.ts';
import {
  collectSignalGraph,
  graphKey,
  graphValue,
  signalOwner,
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
import { attachAngularInfo } from './ng-capabilities.ts';
import { createScanBackoff } from './router-attach.ts';
import { DEVTOOLS_BASES, SETUP_URL } from './panel-frame.ts';
import { overlayStarts } from './overlay-start.ts';
import { clearHighlight, showHighlight } from './page-highlight.ts';
import { claimPageOnServer, newPageId, newPageKey } from './page-id.ts';
import { createDeltaChannel } from './delta-channel.ts';
import { COMPONENT_TREE_SHAPE, INJECTOR_TREE_SHAPE } from './push-delta.ts';
import { createDomDirty } from './dom-dirty.ts';
import { domTree } from './host-tree.ts';
import { LEASED_PUSH_MS, createPageLease, throttle } from './page-lease.ts';
import { createPageHeartbeat, keepaliveAfter } from './page-heartbeat.ts';

declare global {
  interface Window {
    __pangularComponentOf?: (el: unknown) => string | null;
    __pangularPageId?: string;
  }
}

const PAGE_ID_KEY = 'pangular-page-id';
/** The secret minted with the page id, kept next to it. */
const PAGE_SECRET_KEY = 'pangular-page-key';
const ROUTER_HEARTBEAT_MS = 5000;
/** A tab in the background still says it is there, at the pace browsers allow it. */
const HIDDEN_HEARTBEAT_MS = 60_000;

function stored(name: string): string | null {
  try {
    return sessionStorage.getItem(name);
  } catch {
    return null;
  }
}

function storePageId(id: string, key: string) {
  try {
    sessionStorage.setItem(PAGE_ID_KEY, id);
    sessionStorage.setItem(PAGE_SECRET_KEY, key);
  } catch {
    return;
  }
}

/**
 * The page id, kept for the tab's life in `sessionStorage`, and the secret
 * minted with it. A duplicated tab copies both, so it gets a fresh pair.
 */
async function claimPageId(): Promise<{ id: string; key: string; release: () => void }> {
  const fresh = newPageId();
  const storedId = stored(PAGE_ID_KEY);
  const storedKey = stored(PAGE_SECRET_KEY);
  let id = storedId ?? fresh;
  let key = storedId && storedKey ? storedKey : newPageKey();
  if (typeof BroadcastChannel === 'undefined') {
    storePageId(id, key);
    return { id, key, release: () => {} };
  }
  const channel = new BroadcastChannel('pangular-page-ids');
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
  if (taken) {
    id = fresh;
    key = newPageKey();
  }
  storePageId(id, key);
  return { id, key, release: () => channel.close() };
}

type DevframeConnectionMeta = NonNullable<
  NonNullable<Parameters<typeof connectDevframe>[0]>['connectionMeta']
>;

/**
 * The content of a devtools server's `__connection.json`. `configs` is loose,
 * so the whole file, with its `pangular` config, can be passed as it is.
 */
export type OverlayConnectionMeta = Omit<DevframeConnectionMeta, 'configs' | 'backend'> & {
  /** A string, so an imported `__connection.json` type-checks as it is. */
  backend: string;
  configs?: Record<string, unknown>;
};

export interface OverlayOptions {
  /** Where the devtools server is, or a list of places to try in order. */
  baseURL?: string | string[];
  /**
   * The server's `__connection.json`, passed in so the overlay does not fetch
   * it. Use it when the page runs on another origin than the server, such as a
   * Capacitor WebView, where that fetch is blocked.
   */
  connectionMeta?: OverlayConnectionMeta;
  /**
   * A pairing token the server trusts (`auth: {tokens}`, or `--auth-token` on
   * the CLI), so the page skips the one-time code. A dev secret: don't commit it.
   */
  authToken?: string;
}

let current: { stop: () => void } | null = null;

/**
 * Starts the overlay and resolves with its dispose. Only one overlay runs per
 * page: starting another stops the one before it, including the auto-started one.
 */
export function initOverlay(options: OverlayOptions = {}): Promise<() => void> {
  overlayStarts.count++;
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
  const loaded = await overlayPopup()?.catch(() => undefined);
  await loaded?.hideDevtools();
}

// `connectDevframe()` alone looks for the connection next to the page, which
// misses the documented `/__pangular/` mount in a host app. The floating
// button looks in the same places.
const DEFAULT_BASES = DEVTOOLS_BASES;

const SERVER_HINT =
  'Mount initPangularHub() or the pangular() Vite plugin in your dev server, before the SSR handler. ' +
  `On a custom path, pass it to initOverlay({baseURL}). See ${SETUP_URL}`;
const DEVICE_HINT =
  "From an app on a device, check that the server listens on the network (--host 0.0.0.0) and allows the app's origin, and that the WebView may load http: an https page blocks it as mixed content, and Android blocks cleartext unless the app allows it. See https://pangular-inspector.dev/guides/capacitor/";

/**
 * `manual`: the overlay was given `connectionMeta`, so only the device and
 * network hints apply. `device`: it runs in a Capacitor WebView without it,
 * which may be live reload from the dev server, so it gets both hints.
 */
function noServerError(
  bases: string | string[],
  cause: unknown,
  { device, manual }: { device: boolean; manual: boolean },
): Error {
  const tried = (Array.isArray(bases) ? bases : [bases]).join(', ');
  const hints = manual ? DEVICE_HINT : device ? `${SERVER_HINT} ${DEVICE_HINT}` : SERVER_HINT;
  return new Error(`[pangular] No devtools server found (tried ${tried}). ${hints}`, { cause });
}

async function startOverlay(options: OverlayOptions, own: (cleanup: () => void) => boolean) {
  const bases = options.baseURL ?? DEFAULT_BASES;
  const where = {
    device: !!(globalThis as { Capacitor?: unknown }).Capacitor,
    manual: !!options.connectionMeta,
  };
  const rpc = await connectDevframe(overlayConnectOptions(options, DEFAULT_BASES)).catch(
    (error: unknown) => {
      throw noServerError(bases, error, where);
    },
  );
  // Follows the server through restarts: `my` always calls the live connection.
  const link = createOverlayLink(rpc as unknown as LinkClient, {
    connect: async () => {
      forgetDevframeConnection();
      return (await connectDevframe(
        overlayReconnectOptions(options, DEFAULT_BASES, rpc.connection?.metaBaseUrl),
      )) as unknown as LinkClient;
    },
  });
  if (!own(link.stop)) return;
  if (!own(warnOnConnectionTrouble(rpc, options))) return;
  const metaUrl = rpc.connection?.metaBaseUrl;
  if (metaUrl) {
    void overlayPopup()
      ?.then((m) => m.useDevtoolsBase(new URL('.', metaUrl).href))
      .catch(() => {});
  }
  const my = link.scope;
  const devtoolsConfig = configFromConnection(rpc.connectionMeta);
  void overlayPopup()
    ?.then((m) => m.setPopupHotkey(devtoolsConfig.popup.hotkey))
    .catch(() => {});
  const on = devtoolsConfig.inspectors;
  const limits = devtoolsConfig.limits;
  allowClientRules(on.http && devtoolsConfig.actions.http);
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
  let attachValues: ReturnType<typeof registerComponentValues> | undefined;
  const deferTracker = createDeferTracker();
  const forTracker = createForTracker();
  // The component tree is made of elements, so it is walked again only when
  // elements came or went (or every few seconds); the selected detail is always fresh.
  const dirty = createDomDirty();
  if (!own(dirty.stop)) return;
  const readComponents = dirty.cached(
    () =>
      collectComponentTree(getNg(), {
        tree: dirty.watch(domTree()),
        directiveHosts: true,
        hydration: true,
      }),
    // A page still hydrating changes without adding elements.
    (tree) => tree.roots.length > 0 && !tree.hydration?.counts.dehydratedBlocks,
  );
  function collectTree(force = false) {
    const ng = getNg();
    const blocksOf = controlFlowReader(ng);
    const deferBlocks = deferTracker.collect(ng, document, blocksOf);
    const structure = readComponents(force);
    const components = {
      ...structure,
      detail: ng?.getComponent
        ? selectedComponentDetail(ng, { selectedId: componentTarget, withDetail: attachValues })
        : null,
    };
    return {
      ...components,
      ...hydrationOverlay?.report(components, deferBlocks),
      url: redactUrl(location.href),
      title: redactMessage(document.title),
      ...(deferBlocks ? { deferBlocks } : {}),
      ...(deferTracker.truncated ? { deferTruncated: true } : {}),
      ...forTracker.collect(ng, document, blocksOf),
    };
  }
  async function pushTree(force = false) {
    // An idle page only says it is there (`page-lease.ts`).
    if (!force && !lease.active) return treeChannel.keepalive(() => collectTree(true));
    await treeChannel.send(collectTree(force), force);
  }

  const signalWatch = createSignalWatch();
  // Named signal writes of the last moments, for the NG0100 explainer of the Errors inspector.
  const recentWrites = createRecentWrites();
  const signalHistory = createSignalHistory(
    (value, name) => serializeNamed(name, value, { budget: 1000 }),
    Date.now,
    (value, name) => graphValue(name, value),
    {
      stacks: signalWatch.stacks,
      restorable: on.signals && devtoolsConfig.actions.components,
      onChange: (id, label, change, raw) => {
        signalWatch.onChange(id, label, change);
        if (on.errors) recentWrites.add(id, label, change, raw);
      },
    },
  );
  const restoreSignalHook = on.signals ? await installSignalWriteHook(signalHistory.onWrite) : null;
  if (restoreSignalHook) recentWrites.listening();
  if (!own(restoreSignalHook ?? (() => {}))) return;
  const writeHookMissing = on.signals && !restoreSignalHook;

  let signalTarget: SignalTarget = null;
  let lastSignalKey = '';
  let signalSentAt = 0;
  let historyDelta = false;
  let historyFor = '';

  async function pushSignalGraph(force = false) {
    const graph = signalWatch.attach(collectSignalGraph(getNg(), signalTarget));
    if (!graph) return;
    const key = graphKey(graph);
    if (!force && key === lastSignalKey) {
      if (!keepaliveDue(signalSentAt, tickMs())) return;
      signalSentAt = Date.now();
      if (await pingKnows('ping-signal-graph')) return;
    }
    lastSignalKey = key;
    signalSentAt = Date.now();
    const owner = signalOwner(graph);
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
        ...(writeHookMissing ? { writeHook: false as const } : {}),
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

  // Not cached on DOM changes: environment injectors list the services they
  // created, which grows without any element being added.
  async function pushInjectorTree(force = false) {
    if (!force && !lease.active) {
      return injectorChannel.keepalive(() => ({ ...collectInjectorTree(getNg()) }));
    }
    await injectorChannel.send({ ...collectInjectorTree(getNg()) }, force);
  }

  const { id: pageId, key: pageKey, release: releasePageId } = await claimPageId();
  if (!own(releasePageId)) return;
  // Before any report, so a reloaded tab gets its page id back at once.
  await claimPageOnServer(my.rpc, pageId, pageKey);
  // The overlay may have been stopped while the claim was on its way.
  if (!own(() => {})) return;
  window.__pangularPageId = pageId;
  own(() => {
    if (window.__pangularPageId === pageId) delete window.__pangularPageId;
  });
  const channel = (push: string, ping: string, shape: typeof COMPONENT_TREE_SHAPE) =>
    createDeltaChannel({
      call: (name, ...args) => my.rpc.call(name, ...args),
      pageId,
      push,
      ping,
      shape,
      tickMs,
    });
  const treeChannel = channel('push-component-tree', 'ping-component-tree', COMPONENT_TREE_SHAPE);
  const injectorChannel = channel('push-injector-tree', 'ping-injector-tree', INJECTOR_TREE_SHAPE);
  // Reads the value of a provider the injectors already created, for the Injectors view.
  if (on.injectors) registerProviderValues(my.rpc, pageId, getNg);
  // Wakes up with a push of every leased report when a panel or an agent looks again.
  const lease = createPageLease(my, pageId, {
    wake: () =>
      Promise.all([
        on.components && pushTree(true),
        on.injectors && pushInjectorTree(true),
        on.components && cd?.push(false, true),
        forms?.push(true),
        leaks?.push(true),
        plugins?.push(true),
        errors?.push(),
      ]),
  });
  own(lease.stop);
  // One small call keeps every report of this page alive, so unchanged ones aren't sent again.
  const heartbeat = createPageHeartbeat(my, pageId, { watching: lease.update });
  own(heartbeat.stop);
  // The first reports go out in full either way, so an idle page is still listed.
  void lease.refresh();
  const stopAnalog = on.analog ? attachAnalog(my, pageId, getNg, limits.refreshMs) : () => {};
  const forms = on.forms
    ? attachForms(
        my,
        pageId,
        getNg,
        { show: showHighlight, clear: clearHighlight },
        limits.formTimeline,
        { active: () => lease.active },
      )
    : null;
  const pipes = on.pipes ? attachPipes(my, pageId, getNg) : null;
  const http = on.http ? attachHttp(my, pageId, tickMs) : null;
  if (http) own(http.stop);
  const capacitor = on.capacitor
    ? attachCapacitor(my, pageId, {
        maxCalls: limits.capacitorCalls,
        tickMs: limits.refreshMs,
        devtoolsUrl: metaUrl,
      })
    : null;
  const hydrationOverlay = on.components
    ? attachHydrationOverlay(my, pageId, () => void pushTree(true).catch(() => {}))
    : null;
  const cd = on.components
    ? attachChangeDetection(my, pageId, getNg, limits.cdCycles, tickMs, () => lease.active)
    : null;
  const ngrx = on.ngrx ? attachNgrx(my, pageId, getNg, limits.changeLog) : null;
  // NGXS, Elf and MiniRx report through their Redux DevTools integration.
  if (!on.ngrx) uninstallReduxDevtoolsHook();
  const otherStores = on.ngrx ? attachReduxStores(my, pageId, { maxLog: limits.changeLog }) : null;
  const queries = on.tanstackQuery
    ? attachTanstackQuery(my, pageId, getNg, {
        allowWrites: devtoolsConfig.actions.tanstackQuery,
      })
    : null;
  const errors = on.errors
    ? attachErrors(my, pageId, getNg, {
        tickMs,
        writes: recentWrites,
        active: () => lease.active,
      })
    : null;
  const leaks = on.components
    ? attachLeaks(my, pageId, getNg, { tickMs, active: () => lease.active })
    : null;
  const plugins = on.plugins
    ? attachPlugins(my, pageId, getNg, {
        config: devtoolsConfig,
        active: () => lease.active,
        tickMs,
      })
    : null;
  const startup = on.injectors ? attachStartup(my, pageId, getNg, { tickMs }) : null;
  // Runs axe-core only when the panel or an agent asks; it loads axe-core then.
  // The component owning each element is component data: only with that inspector on.
  const axe = attachAxe(my, pageId, axeOwnerNg(on.components, getNg));
  const angularInfo = attachAngularInfo(my, pageId, getNg, { tickMs });
  // Always attached: the panel's Settings can turn the tools on after the page
  // connects, and the server lists none while they are off.
  const browserTools = attachBrowserTools(my, pageId);
  const consoleGlobals = attachConsoleGlobals(my, pageId, {
    getNg,
    inspectors: on,
    ngrxState: ngrx?.rawState,
  });
  own(consoleGlobals.dispose);

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
  const routerScan = createScanBackoff();
  let lastRouterPayload = '';
  let lastRouterPushAt = 0;
  let routerPushTimer: ReturnType<typeof setTimeout> | undefined;
  let routerDomDirty = true;
  let outlets: ReturnType<typeof outletsOf> = [];
  let links: ReturnType<typeof linksOf> = [];
  let linksTruncated = 0;
  let linksUnchecked = 0;
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
    if (!routerScan.due()) return;
    const roots = Array.from(document.querySelectorAll('[ng-version]'));
    const candidates = roots.length ? roots : findAngularElements().slice(0, 1);
    const routers = findRouters(ng, candidates);
    if (!routers.length) {
      // A root that is not bootstrapped yet is cheap to check again on the next push.
      const bootstrapped = candidates.some((root) => read(() => !!ng?.getComponent?.(root), false));
      if (bootstrapped || !roots.length) routerScan.miss();
      return;
    }
    routerScan.reset();
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

  /** True when the watched router was destroyed or its root left the page (HMR, re-bootstrap). */
  function routerGone(): boolean {
    if (!router) return false;
    if (read(() => router!['disposed'] === true, false)) return true;
    return !!routerRoot && !routerRoot.isConnected;
  }

  function detachRouter() {
    for (const cleanup of routerCleanup) cleanup();
    routerCleanup = [];
    stopInstrument?.();
    stopInstrument = null;
    router = null;
    routerCount = 0;
    routerRoot = null;
    // A new router counts navigation ids from 1 again, so old records would take its events.
    resetNavigations(navigations);
    preloads.length = 0;
    config = undefined;
    configTruncated = 0;
    setup = undefined;
    sentGeneration = -1;
    lastRouterPayload = '';
    routerDomDirty = true;
    outlets = [];
    links = [];
    linksTruncated = 0;
    linksUnchecked = 0;
  }

  async function pushRouter() {
    try {
      const ng = getNg() as RouterDebugApi | undefined;
      if (routerGone()) detachRouter();
      if (!router && ng) attachRouter(ng);
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
          const cut = { links: 0, unchecked: 0 };
          links = linksOf(ng, router, cut);
          linksTruncated = cut.links;
          linksUnchecked = cut.unchecked;
        }
        report['outlets'] = outlets;
        report['links'] = links;
        if (linksTruncated) report['linksTruncated'] = linksTruncated;
        if (linksUnchecked) report['linksUnchecked'] = linksUnchecked;
        report['preloads'] = preloads;
        report['instrumented'] = instrumented;
      }
      const payload = JSON.stringify(report);
      if (payload === lastRouterPayload) {
        if (!keepaliveAfter(lastRouterPushAt, ROUTER_HEARTBEAT_MS)) return;
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
      lastRouterPayload = '';
      return;
    }
  }

  function scheduleRouterPush() {
    clearTimeout(routerPushTimer);
    routerPushTimer = setTimeout(() => void pushRouter(), 50);
  }

  // The leased reports go out at most once a second; forced pushes don't wait.
  const paced = (fn: () => void) => {
    const run = throttle(fn, LEASED_PUSH_MS);
    own(run.cancel);
    return run;
  };
  // Leak bookkeeping runs on every refresh so short-lived components are seen; the report is paced.
  const pushLeaks = leaks && paced(() => void leaks.push().catch(() => {}));
  const collectors = [
    () => void angularInfo.push(),
    on.components && paced(() => void pushTree().catch(() => {})),
    on.signals && (() => void pushSignalGraph().catch(() => {})),
    on.injectors && paced(() => void pushInjectorTree().catch(() => {})),
    ngrx && (() => void ngrx.push()),
    otherStores && (() => void otherStores.push()),
    queries && (() => void queries.push()),
    forms && paced(() => void forms.sync()),
    pipes?.push,
    on.router && (() => void pushRouter()),
    http && (() => void http.push().catch(() => {})),
    cd && paced(() => void cd.push().catch(() => {})),
    errors && (() => void errors.push().catch(() => {})),
    leaks &&
      pushLeaks &&
      (() => {
        leaks.track();
        pushLeaks();
      }),
    plugins && paced(() => void plugins.push().catch(() => {})),
    startup && paced(() => void startup.push().catch(() => {})),
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
      heartbeat.pause();
      refresher.stop();
      refresher = undefined;
      reportVisibility(true);
      stillHidden = outsideAngular(() =>
        setInterval(() => reportVisibility(true), HIDDEN_HEARTBEAT_MS),
      );
      return;
    }
    outsideAngular(heartbeat.start);
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
    name: 'router-clear',
    type: 'event',
    jsonSerializable: true,
    handler: (message: { pageId?: unknown } | undefined) => {
      if (!on.router || message?.pageId !== pageId) return;
      clearNavigations(navigations);
      lastRouterPayload = '';
      scheduleRouterPush();
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
  registerSignalWatch(my.rpc, pageId, signalWatch, () => {
    void pushSignalGraph(true).catch(() => {});
  });
  registerSignalPeek(
    my.rpc,
    pageId,
    (target) => collectSignalGraph(getNg(), target),
    signalHistory,
  );
  if (on.signals) {
    registerSignalRestore(my.rpc, pageId, {
      getNg,
      history: signalHistory,
      allowed: devtoolsConfig.actions.components,
      restored: () => void pushSignalGraph(true).catch(() => {}),
    });
  }

  my.rpc.register({
    name: 'inspect-component-in-page',
    type: 'event',
    jsonSerializable: true,
    handler: (request: { pageId?: string; id?: string | null; console?: boolean } | null) => {
      if (request?.pageId && request.pageId !== pageId) return;
      componentTarget = typeof request?.id === 'string' ? request.id : null;
      // Only a selection made in the panel for this page sets `$ng0`.
      if (request?.console === true && request.pageId === pageId) {
        consoleGlobals.selectComponent(componentTarget);
      }
      void pushTree(true).catch(() => {});
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
            consoleGlobals.selectComponent(result.id);
            void pushTree(true).catch(() => {});
            if (result.openInEditor && result.source) {
              void my.rpc.call('open-in-editor', result.source).catch(() => {});
            }
          }
          void my.rpc.call('component-pick-result', { requestId, pageId, result }).catch(() => {});
        });
      },
    });
    own(() => cancelComponentPick?.());
    attachValues = registerComponentValues(my.rpc, pageId, {
      getNg,
      changed: () => void pushTree().catch(() => {}),
    });
    registerComponentEdit(my.rpc, pageId, {
      getNg,
      allowed: devtoolsConfig.actions.components,
      edited: () => void pushTree(true).catch(() => {}),
    });
    // Loaded on the first capture, so pages that never take one don't pay for it.
    my.rpc.register({
      name: 'component-screenshot',
      type: 'event',
      jsonSerializable: true,
      handler: (message: ScreenshotRequest | null) =>
        void import('./component-screenshot.ts')
          .then((screenshot) => screenshot.answerScreenshotRequest(my.rpc, pageId, message))
          // A chunk that fails to load leaves the request to time out on the server.
          .catch(() => {}),
    });

    const componentOf = (el: unknown) => {
      const host = el instanceof Element ? componentHostOf(getNg(), el) : null;
      return host ? elementId(host) : null;
    };
    window.__pangularComponentOf = componentOf;
    own(() => {
      if (window.__pangularComponentOf === componentOf) delete window.__pangularComponentOf;
    });
    own(installSourceHelpers(pageId, getNg));
  }

  const forget = (inspector: keyof typeof on, name: string) => {
    if (on[inspector]) void my.rpc.call(name, pageId).catch(() => {});
  };
  const leave = () => {
    left = true;
    heartbeat.pause();
    refresher?.stop();
    refresher = undefined;
    clearInterval(stillHidden);
    reportVisibility(false);
    pipes?.pause();
    forms?.leave();
    forget('forms', 'forget-forms-page');
    forget('router', 'forget-router-page');
    lastRouterPayload = '';
    forget('pipes', 'forget-pipes-page');
    treeChannel.resync();
    forget('components', 'forget-component-page');
    lastSignalKey = '';
    historyDelta = false;
    forget('signals', 'forget-signal-page');
    cd?.leave();
    injectorChannel.resync();
    forget('injectors', 'forget-injector-page');
    http?.leave();
    capacitor?.leave();
    forget('analog', 'forget-analog-page');
    ngrx?.leave();
    otherStores?.leave();
    queries?.leave();
    errors?.leave();
    leaks?.leave();
    plugins?.leave();
    startup?.leave();
    angularInfo.leave();
    browserTools.leave();
  };
  addEventListener('pagehide', leave);
  const resendConfig = () => {
    // Whatever the server held of this page may be gone: every report goes out again.
    heartbeat.lost();
    sentGeneration = -1;
    pipes?.resume();
    capacitor?.resume();
    errors?.resume();
    leaks?.resume();
    plugins?.resume();
    startup?.resume();
    browserTools.resume();
    void lease.refresh();
    left = false;
    onVisibility();
  };
  addEventListener('pageshow', resendConfig);
  // After a server restart: stop sending, then claim the page and send everything again.
  link.follow({
    dropped: leave,
    restored: async () => {
      await claimPageOnServer(my.rpc, pageId, pageKey);
      resendConfig();
    },
  });

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
    capacitor?.stop();
    ngrx?.stop();
    otherStores?.stop();
    queries?.stop();
    errors?.stop();
    leaks?.stop();
    plugins?.stop();
    startup?.stop();
    browserTools.stop();
    axe.stop();
    cd?.stop();
    hydrationOverlay?.stop();
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
