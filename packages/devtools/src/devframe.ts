import type { DevframeSetupInfo, RemoteAssets } from 'devframe';
import { defineDevframe } from 'devframe';
import { PANGULAR_LOGO_DATA_URI } from './brand.ts';
import { getRoutes } from './rpc/get-routes.ts';
import { getComponents } from './rpc/get-components.ts';
import { getPipes } from './rpc/get-pipes.ts';
import { inspectProvidersText } from './rpc/injector-tools.ts';
import { lintPipes, lintPipesText } from './rpc/pipe-lint.ts';
import { explainPipeText } from './rpc/pipe-explain.ts';
import { trackPageSessions } from './rpc/page-sessions.ts';
import { getBuildMeta } from './rpc/build-meta.ts';
import { getSignals } from './rpc/get-signals.ts';
import { injectorMatches, isEnvironmentRequest } from './signal-graph.ts';
import { getProviders } from './rpc/get-providers.ts';
import { getNgrxStore, scanNgrxStore } from './rpc/get-ngrx-store.ts';
import {
  dispatchResultText,
  expireNgrxPages,
  isNgrxReport,
  mergeNgrxReport,
  ngrxStateOf,
  type NgrxDeclaration,
  type NgrxPages,
} from './rpc/ngrx-tools.ts';
import {
  INSPECT_SIGNAL_STORE_DESCRIPTION,
  SIGNAL_STORE_HISTORY_DESCRIPTION,
  inspectSignalStoreText,
  signalStoreHistoryText,
  withUntrustedPreamble,
} from './rpc/ngrx-live-tools.ts';
import {
  dispatchProblem,
  type NgrxRequest,
  type NgrxRequestResult,
  type NgrxState,
} from './ngrx-shared.ts';
import type {
  ComponentDetail,
  ComponentPage,
  InjectorPage,
  InjectorTreeNode,
  LiveComponentNode,
  SignalChange,
  SignalGraph,
  ZoneMode,
} from './types.ts';
import { ZONE_MODES, zoneModeText } from './zone-mode.ts';
import {
  deferBlocksText,
  expireComponentPages,
  findComponents,
  isComponentReport,
  latestComponentPage,
  otherMatchesText,
  toComponentPage,
  truncationText,
} from './rpc/component-tools.ts';
import {
  explainFormsText,
  formsResourceText,
  currentForms,
  expirePages,
  inspectFormsText,
  isPageReport,
  mergePageReport,
  type PageReport,
  type FormsState,
  type InspectFormsArgs,
  FORMS_PAGE_TTL_MS,
} from './rpc/forms-tools.ts';
import {
  explainCustomControlText,
  explainFieldText,
  explainSubmitText,
  fieldOwner,
  exportFormText,
  formDiffText,
  formHistoryText,
  formPayloadText,
  latestMarker,
  lintFormsFor,
  lintFormsText,
  resolveForm,
  waitSatisfied,
  type WaitUntil,
} from './rpc/forms-explain.ts';
import { findFormSource, sourceText } from './rpc/forms-source.ts';
import {
  currentPipes,
  expirePipePages,
  isPipePageReport,
  mergePipePageReport,
  type PipePageReport,
  type PipesState,
} from './rpc/pipes-tools.ts';
import {
  currentRouter,
  expireRouterPages,
  explainNavigationText,
  inspectRouteText,
  isRouterReport,
  mergeRouterReport,
  noPage,
  routerResourceText,
  touchRouterPage,
  type RouterPage,
  type RouterState,
  ROUTER_PAGE_TTL_MS,
} from './rpc/router-tools.ts';
import {
  explainRenderModeText,
  exportNavigationText,
  lintRoutesText,
  listRoutesText,
  matchUrl,
  routerConfigText,
  routerLintResult,
} from './rpc/router-config-tools.ts';
import { extractRoutes } from './rpc/get-routes.ts';
import { scanServerRoutes } from './rpc/server-routes.ts';
import {
  httpRegistry,
  sanitizeCalls,
  sanitizeRules,
  type HttpCall,
  type HttpRule,
} from './http-rules.ts';
import { sanitizeHydration, sanitizePayload, type PayloadSummary } from './http-payload.ts';
import { redactCall } from './http-redact.ts';
import { redactUrl } from './router.ts';
import {
  changeDetectionText,
  expireCdPages,
  toCdPage,
  type CdPage,
  type CdState,
} from './rpc/cd-tools.ts';
import type { HttpPage, HttpPayloadState, HttpReport, HttpState } from './types.ts';

import { nameServerFns, registerAnalog } from './rpc/analog-register.ts';
import { createPageVisibility } from './rpc/page-ttl.ts';
import {
  PAGE_ARGUMENT,
  byRecency,
  listPagesText,
  pageArgument,
  summarizePages,
  unknownPageText,
} from './rpc/pages.ts';
import { registerHubDocks } from './hub-docks.ts';
import { setRedaction } from './forms-privacy.ts';
import {
  FORM_WRITE_ACTIONS,
  PANGULAR_CONFIG_KEY,
  ROUTER_WRITE_ACTIONS,
  actionBlockedMessage,
  agentAllowed,
  isPageAgentEntry,
  pangularConfigWarning,
  resolvePangularConfig,
  rpcAllowed,
  type PangularConfig,
  type ResolvedPangularConfig,
} from './config.ts';

export * from './config.ts';

import pkg from '../package.json' with { type: 'json' };

type PageGraph = SignalGraph & { pageId?: string };

const ENV_WAIT_MS = 1500;
const AGENT_HIGHLIGHT_MS = 2000;

const clientAssets: RemoteAssets = {
  package: pkg.name,
  version: pkg.version,
  path: 'dist/public',
  resolveFrom: import.meta.url,
};

type SetupInfo = DevframeSetupInfo & { config?: ResolvedPangularConfig; pageTools?: boolean };

const pangular = defineDevframe({
  id: 'pangular',
  name: 'Pangular Inspector',
  version: pkg.version,
  packageName: pkg.name,
  description: 'Inspect Angular component trees, signals, and routes at dev and build time.',
  homepage: 'https://pangular-inspector.dev',
  icon: PANGULAR_LOGO_DATA_URI,
  importMetaUrl: import.meta.url,
  clientAssets,
  dock: { visibility: 'false' },

  async setup(ctx, info?: SetupInfo) {
    const config = info?.config ?? resolvePangularConfig();
    const pageTools = info?.pageTools ?? true;
    const agentExposed = (entry: { id: string; safety?: string }) =>
      agentAllowed(entry, config) && (pageTools || !isPageAgentEntry(entry.id));
    setRedaction(config.redaction);
    const on = config.inspectors;
    const limits = config.limits;
    const my = ctx.scope('pangular');
    (ctx.staticConfig as Record<string, unknown>)[PANGULAR_CONFIG_KEY] = config;
    const register: typeof my.rpc.register = (definition) => {
      if (!rpcAllowed(definition.name, config)) return;
      const exposed = !definition.agent || agentAllowed({ id: definition.name }, config);
      my.rpc.register(exposed ? definition : { ...definition, agent: undefined });
    };
    const agent = {
      registerTool: (tool: Parameters<typeof ctx.agent.registerTool>[0]) => {
        if (agentExposed(tool)) ctx.agent.registerTool(tool);
      },
      registerResource: (resource: Parameters<typeof ctx.agent.registerResource>[0]) => {
        if (agentExposed(resource)) ctx.agent.registerResource(resource);
      },
    };

    register(getRoutes);
    register(getComponents);
    register(getPipes);
    register(getSignals);
    register(getProviders);
    register(getNgrxStore);
    register(getBuildMeta);

    // Tabs in the background stop reporting, so their last data stays until
    // they come back or close.
    const visibility = createPageVisibility();
    const liveTtl = visibility.ttl();
    const visibilityState = await my.rpc.sharedState('page-visibility', {
      initialValue: { hidden: [] as string[] },
    });
    const applyVisibility = () =>
      visibilityState.mutate((draft) => {
        draft.hidden = visibility.list();
      });
    register({
      name: 'report-page-visibility',
      type: 'action',
      jsonSerializable: true,
      handler: (report: { pageId?: unknown; hidden?: unknown } | null) => {
        const pageId = report?.pageId;
        if (typeof pageId !== 'string' || !pageId || pageId.length >= 50) return;
        if (visibility.set(pageId, report?.hidden === true)) applyVisibility();
      },
    });

    const componentTree = await my.rpc.sharedState('component-tree', {
      initialValue: {
        nodes: [] as LiveComponentNode[],
        pages: {} as Record<string, ComponentPage>,
        selectedId: null as string | null,
        highlightedId: null as string | null,
      },
    });
    const componentPages = new Map<string, ComponentPage>();
    const applyComponentPages = () =>
      componentTree.mutate((draft) => {
        draft.pages = Object.fromEntries(componentPages);
        draft.nodes = latestComponentPage(componentPages.values())?.roots ?? [];
      });
    const componentWaiters = new Set<() => void>();
    const selectComponentOnPage = (pageId: string | undefined, id: string | null) => {
      componentTree.mutate((draft) => {
        draft.selectedId = id;
      });
      void my.rpc.broadcast({
        method: 'inspect-component-in-page',
        args: [{ pageId, id }],
        optional: true,
      });
    };
    const waitForComponentDetail = (pageId: string, id: string, timeoutMs = 3000) =>
      new Promise<ComponentDetail | null>((resolve) => {
        const done = (detail: ComponentDetail | null) => {
          clearTimeout(timer);
          componentWaiters.delete(check);
          resolve(detail);
        };
        const check = () => {
          const detail = componentPages.get(pageId)?.detail;
          if (detail?.id === id) done(detail);
        };
        const timer = setTimeout(() => done(null), timeoutMs);
        timer.unref?.();
        componentWaiters.add(check);
        check();
      });

    await my.rpc.sharedState('routes', {
      initialValue: {
        routes: [],
        activeRoute: null,
      },
    });

    const signalGraphState = await my.rpc.sharedState('signal-graph', {
      initialValue: {
        graph: null as PageGraph | null,
        pages: {} as Record<string, PageGraph>,
        selectedNodeId: null as string | null,
      },
    });
    const signalPages = new Map<string, { graph: PageGraph; reportedAt: number }>();

    const injectorTreeState = await my.rpc.sharedState('injector-tree', {
      initialValue: {
        roots: [] as InjectorTreeNode[],
        environment: [] as InjectorTreeNode[],
        pages: {} as Record<string, InjectorPage>,
        truncated: false,
        zone: null as ZoneMode | null,
        selectedInjectorId: null as string | null,
      },
    });
    const injectorPages = new Map<string, InjectorPage>();
    const latestInjectorPage = () =>
      [...injectorPages.values()].sort((a, b) => b.reportedAt - a.reportedAt)[0];
    const applyInjectorPages = () =>
      injectorTreeState.mutate((draft) => {
        const latest = latestInjectorPage();
        draft.pages = Object.fromEntries(injectorPages);
        draft.roots = latest?.roots ?? [];
        draft.environment = latest?.environment ?? [];
        draft.truncated = latest?.truncated === true;
        draft.zone = latest?.zone ?? null;
      });

    const ngrxStoreState = await my.rpc.sharedState('ngrx-store', {
      initialValue: { pages: [] } as NgrxState,
    });
    const ngrxPages: NgrxPages = new Map();
    let ngrxDeclarations: { at: number; list: NgrxDeclaration[] } = { at: 0, list: [] };
    const ngrxNames = () => {
      if (Date.now() - ngrxDeclarations.at > 10_000) {
        let list: NgrxDeclaration[] = [];
        try {
          list = scanNgrxStore(ctx.cwd).filter((e) => e.kind === 'signal-store');
        } catch {
          list = [];
        }
        ngrxDeclarations = { at: Date.now(), list };
      }
      return ngrxDeclarations.list;
    };
    const applyNgrx = () =>
      ngrxStoreState.mutate((draft) => {
        draft.pages = ngrxStateOf(ngrxPages).pages as never;
      });

    const formPages = new Map<string, PageReport & { reportedAt: number }>();
    const formsState = await my.rpc.sharedState('forms', {
      initialValue: { forms: [], events: [], reportedAt: 0, setupErrors: [] } as FormsState,
    });

    const applyForms = (next: FormsState) =>
      formsState.mutate((draft) => {
        draft.forms = next.forms;
        draft.events = next.events;
        draft.reportedAt = next.reportedAt;
        draft.setupErrors = next.setupErrors ?? [];
        draft.instrumented = next.instrumented ?? [];
        draft.dropped = next.dropped ?? {};
        draft.webMcp = next.webMcp ?? [];
      });

    register({
      name: 'push-forms',
      type: 'action',
      jsonSerializable: true,
      handler: (report: unknown) => {
        if (!isPageReport(report)) return;
        applyForms(
          mergePageReport(
            formPages,
            report,
            Date.now(),
            limits.formTimeline,
            visibility.ttl(FORMS_PAGE_TTL_MS),
          ),
        );
      },
    });

    const pipePages = new Map<string, PipePageReport & { reportedAt: number }>();
    const pipesState = await my.rpc.sharedState('pipe-usage', {
      initialValue: { pipes: [], async: [], reportedAt: 0, instrumented: [] } as PipesState,
    });

    const applyPipes = (next: PipesState) =>
      pipesState.mutate((draft) => {
        draft.pipes = next.pipes;
        draft.async = next.async;
        draft.reportedAt = next.reportedAt;
        draft.instrumented = next.instrumented;
      });

    // A closed tab drops its connection at once, so its entries go with it
    // instead of lingering until they expire.
    const pipeSessions = trackPageSessions(ctx.rpc, (pageIds) => {
      let removed = false;
      for (const pageId of pageIds) removed = pipePages.delete(pageId) || removed;
      if (removed) applyPipes(currentPipes(pipePages));
    });

    register({
      name: 'push-pipes',
      type: 'action',
      jsonSerializable: true,
      handler: (report: unknown) => {
        if (!isPipePageReport(report)) return;
        pipeSessions.bind(report.pageId);
        applyPipes(mergePipePageReport(pipePages, report, Date.now(), liveTtl));
      },
    });

    register({
      name: 'forget-pipes-page',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: string) => {
        if (typeof pageId === 'string') pipeSessions.unbind(pageId);
        if (typeof pageId === 'string' && pipePages.delete(pageId)) {
          applyPipes(currentPipes(pipePages));
        }
      },
    });

    register({
      name: 'request-instrument-pipes',
      type: 'action',
      jsonSerializable: true,
      handler: (on: unknown) => {
        void my.rpc.broadcast({
          method: 'instrument-pipes',
          args: [on !== false],
          optional: true,
        });
        return { pages: pipePages.size };
      },
    });

    register({
      name: 'pipe-lint',
      type: 'query',
      jsonSerializable: true,
      handler: () => lintPipes(ctx.cwd),
    });

    const routerPages = new Map<string, RouterPage>();
    const routerState = await my.rpc.sharedState('router', {
      initialValue: { pages: [] } as RouterState,
    });

    const applyRouter = (next: RouterState) =>
      routerState.mutate((draft) => {
        draft.pages = next.pages;
      });

    register({
      name: 'push-router',
      type: 'action',
      jsonSerializable: true,
      handler: (report: unknown) => {
        if (!isRouterReport(report, limits.navigations)) return { hasConfig: false };
        try {
          applyRouter(
            mergeRouterReport(routerPages, report, Date.now(), visibility.ttl(ROUTER_PAGE_TTL_MS)),
          );
        } catch {
          routerPages.delete(report.pageId);
        }
        return { hasConfig: !!routerPages.get(report.pageId)?.config };
      },
    });

    register({
      name: 'ping-router',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        if (!touchRouterPage(routerPages, pageId)) return { known: false };
        const reportedAt = routerPages.get(pageId as string)!.reportedAt;
        routerState.mutate((draft) => {
          const page = draft.pages.find((p) => p.pageId === pageId);
          if (page) page.reportedAt = reportedAt;
        });
        return { known: true };
      },
    });

    const pendingActions = new Map<string, (result: unknown) => void>();
    let actionSeq = 0;

    const defaultPageId = () => {
      const state = routerState.value() as RouterState;
      return (state.pages.find((p) => p.snapshot) ?? state.pages[0])?.pageId;
    };

    const requestRouterAction = (page: string | undefined, request: unknown) => {
      const action = (request as { action?: unknown } | undefined)?.action;
      return !config.actions.router && ROUTER_WRITE_ACTIONS.includes(action as string)
        ? Promise.resolve<unknown>({ error: actionBlockedMessage('router') })
        : sendRouterAction(page, request);
    };

    const sendRouterAction = (page: string | undefined, request: unknown) =>
      new Promise<unknown>((resolve) => {
        const pageId = page || defaultPageId();
        const requestId = `a${++actionSeq}`;
        const timer = setTimeout(() => {
          pendingActions.delete(requestId);
          resolve({ error: 'No page answered within 15s. Is the app open in a browser?' });
        }, 15_000);
        timer.unref?.();
        pendingActions.set(requestId, (result) => {
          clearTimeout(timer);
          pendingActions.delete(requestId);
          resolve(result);
        });
        void my.rpc.broadcast({
          method: 'router-action',
          args: [{ requestId, pageId, request }],
          optional: true,
        });
      });

    register({
      name: 'router-action-result',
      type: 'action',
      jsonSerializable: true,
      handler: (message: { requestId?: unknown; result?: unknown }) => {
        if (typeof message?.requestId !== 'string') return;
        pendingActions.get(message.requestId)?.(message.result);
      },
    });

    register({
      name: 'request-router-action',
      type: 'action',
      jsonSerializable: true,
      handler: (message: { pageId?: string; request?: unknown }) =>
        requestRouterAction(
          typeof message?.pageId === 'string' ? message.pageId : undefined,
          message?.request,
        ),
    });

    const pageFor = (pageId: unknown) => {
      const state = routerState.value() as RouterState;
      return typeof pageId === 'string'
        ? state.pages.find((p) => p.pageId === pageId)
        : (state.pages.find((p) => p.snapshot) ?? state.pages[0]);
    };

    register({
      name: 'router-lint',
      type: 'query',
      jsonSerializable: true,
      handler: (pageId: unknown) => routerLintResult(pageFor(pageId)),
    });

    register({
      name: 'router-match',
      type: 'query',
      jsonSerializable: true,
      handler: (message: { pageId?: unknown; url?: unknown }) => {
        const page = pageFor(message?.pageId);
        if (!page?.config || typeof message?.url !== 'string') return null;
        return matchUrl(page.config, message.url.slice(0, 2000));
      },
    });

    register({
      name: 'router-export',
      type: 'query',
      jsonSerializable: true,
      handler: (message: { pageId?: unknown; id?: unknown }) =>
        exportNavigationText(routerState.value() as RouterState, {
          page: typeof message?.pageId === 'string' ? message.pageId : undefined,
          id: typeof message?.id === 'number' ? message.id : undefined,
        }),
    });

    register({
      name: 'forget-router-page',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: string) => {
        if (typeof pageId === 'string' && routerPages.delete(pageId)) {
          applyRouter(currentRouter(routerPages));
        }
      },
    });

    const httpPages = new Map<string, HttpPage>();
    const registry = httpRegistry();
    registry.dispose?.();
    registry.rules = on.http && config.actions.http ? (registry.rules ?? []) : [];
    const httpState = await my.rpc.sharedState('http', {
      initialValue: { serverCalls: [], pages: [], rules: [...registry.rules] } as HttpState,
    });
    const httpPayloadState = await my.rpc.sharedState('http-payloads', {
      initialValue: { pages: {} } as HttpPayloadState,
    });
    const httpPayloads = new Map<string, PayloadSummary>();
    let pendingServerCalls: HttpCall[] = [];
    let pendingDropped = 0;
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    const flushServerCalls = () => {
      flushTimer = undefined;
      const batch = pendingServerCalls;
      pendingServerCalls = [];
      let dropped = pendingDropped;
      pendingDropped = 0;
      httpState.mutate((draft) => {
        draft.serverCalls.push(...batch);
        const extra = draft.serverCalls.length - limits.httpCalls;
        if (extra > 0) {
          draft.serverCalls.splice(0, extra);
          dropped += extra;
        }
        if (dropped) draft.serverDropped = (draft.serverDropped ?? 0) + dropped;
      });
    };
    registry.record = on.http
      ? (call) => {
          pendingServerCalls.push(redactCall(call));
          if (pendingServerCalls.length > limits.httpCalls) {
            pendingServerCalls.shift();
            pendingDropped++;
          }
          flushTimer ??= setTimeout(flushServerCalls, 100);
        }
      : () => {};
    const applyHttpPages = () =>
      httpState.mutate((draft) => {
        draft.pages = [...httpPages.values()].sort((a, b) => a.firstSeenAt - b.firstSeenAt);
      });
    const forgetHttpPages = (pageIds: string[]) => {
      for (const id of pageIds) httpPages.delete(id);
      applyHttpPages();
      if (!pageIds.some((id) => httpPayloads.delete(id))) return;
      httpPayloadState.mutate((draft) => {
        for (const id of pageIds) delete draft.pages[id];
      });
    };
    const setHttpRules = (rules: HttpRule[]) => {
      registry.rules = rules;
      httpState.mutate((draft) => {
        draft.rules = rules;
      });
      void my.rpc.broadcast({ method: 'http-rules', args: [rules], optional: true });
      return rules;
    };

    register({
      name: 'push-http',
      type: 'action',
      jsonSerializable: true,
      handler: (report: unknown) => {
        const page = report as (Partial<HttpReport> & { payload?: unknown }) | null;
        if (!page || typeof page.pageId !== 'string' || typeof page.url !== 'string') return;
        if (page.pageId.length >= 50) return;
        const known = httpPages.get(page.pageId);
        const url = redactUrl(page.url);
        const hasPayload = page.payload !== undefined;
        if (!hasPayload && !known) return { needPayload: true };
        const calls = sanitizeCalls(page.calls, limits.httpCalls).map(redactCall);
        httpPages.set(page.pageId, {
          pageId: page.pageId,
          url,
          initialUrl: typeof page.initialUrl === 'string' ? redactUrl(page.initialUrl) : url,
          title: typeof page.title === 'string' ? page.title.slice(0, 200) : '',
          hydration: sanitizeHydration(page.hydration),
          calls:
            page.full === false && known
              ? [...known.calls, ...calls].slice(-limits.httpCalls)
              : calls,
          dropped:
            typeof page.dropped === 'number' && page.dropped > 0 ? Math.floor(page.dropped) : 0,
          firstSeenAt: known?.firstSeenAt ?? Date.now(),
          reportedAt: Date.now(),
        });
        applyHttpPages();
        if (hasPayload) {
          const payload = nameServerFns(sanitizePayload(page.payload));
          httpPayloads.set(page.pageId, payload);
          httpPayloadState.mutate((draft) => {
            draft.pages[page.pageId!] = payload;
          });
        }
        return { needPayload: false };
      },
    });

    register({
      name: 'ping-http',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        const page = typeof pageId === 'string' ? httpPages.get(pageId) : undefined;
        if (!page) return { known: false };
        httpPages.set(page.pageId, { ...page, reportedAt: Date.now() });
        return { known: true };
      },
    });

    register({
      name: 'forget-http-page',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        if (typeof pageId === 'string' && httpPages.has(pageId)) forgetHttpPages([pageId]);
      },
    });

    register({
      name: 'get-http-rules',
      type: 'query',
      jsonSerializable: true,
      handler: () => registry.rules ?? [],
    });

    register({
      name: 'set-http-rules',
      type: 'action',
      jsonSerializable: true,
      handler: (rules: unknown) => {
        if (!config.actions.http) throw new Error(actionBlockedMessage('http'));
        return setHttpRules(sanitizeRules(rules));
      },
    });

    register({
      name: 'clear-http-calls',
      type: 'action',
      jsonSerializable: true,
      handler: () => {
        if (!config.actions.http) throw new Error(actionBlockedMessage('http'));
        pendingServerCalls = [];
        pendingDropped = 0;
        for (const [id, page] of httpPages) httpPages.set(id, { ...page, calls: [], dropped: 0 });
        httpState.mutate((draft) => {
          draft.serverCalls = [];
          draft.serverDropped = 0;
          draft.pages = [...httpPages.values()].sort((a, b) => a.firstSeenAt - b.firstSeenAt);
        });
        void my.rpc.broadcast({ method: 'http-clear', args: [], optional: true });
      },
    });

    const forgetSignalPages = (ids: string[]) => {
      for (const id of ids) signalPages.delete(id);
      signalGraphState.mutate((draft) => {
        for (const id of ids) delete draft.pages[id];
        const ownerId = draft.graph?.pageId;
        if (ownerId && ids.includes(ownerId)) {
          const latest = [...signalPages.values()].sort((a, b) => b.reportedAt - a.reportedAt)[0];
          draft.graph = latest?.graph ?? null;
        }
      });
    };

    const expiry = setInterval(() => {
      if (visibility.expire()) applyVisibility();
      const staleHttp = [...httpPages].filter(([id, p]) => Date.now() - p.reportedAt > liveTtl(id));
      if (staleHttp.length) forgetHttpPages(staleHttp.map(([id]) => id));
      const stale = [...signalPages].filter(([id, p]) => Date.now() - p.reportedAt > liveTtl(id));
      if (stale.length) forgetSignalPages(stale.map(([id]) => id));
      if (expireComponentPages(componentPages, Date.now(), liveTtl)) applyComponentPages();
      if (expireCdPages(cdPages, Date.now(), liveTtl)) applyCd();
      const staleInjectors = [...injectorPages].filter(
        ([id, p]) => Date.now() - p.reportedAt > liveTtl(id),
      );
      if (staleInjectors.length) {
        for (const [id] of staleInjectors) injectorPages.delete(id);
        applyInjectorPages();
      }
      const next = expirePages(
        formPages,
        Date.now(),
        limits.formTimeline,
        visibility.ttl(FORMS_PAGE_TTL_MS),
      );
      if (next) applyForms(next);
      const nextRouter = expireRouterPages(
        routerPages,
        Date.now(),
        visibility.ttl(ROUTER_PAGE_TTL_MS),
      );
      if (nextRouter) applyRouter(nextRouter);
      const nextPipes = expirePipePages(pipePages, Date.now(), liveTtl);
      if (nextPipes) applyPipes(nextPipes);
      if (expireNgrxPages(ngrxPages, Date.now(), liveTtl)) applyNgrx();
    }, 5000);
    expiry.unref?.();
    registry.owner = ctx;
    registry.dispose = () => {
      clearInterval(expiry);
      clearTimeout(flushTimer);
      registry.record = undefined;
    };

    register({
      name: 'forget-forms-page',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: string) => {
        if (typeof pageId === 'string' && formPages.delete(pageId)) {
          applyForms(currentForms(formPages, limits.formTimeline));
        }
      },
    });

    const highlightSessions = trackPageSessions(ctx.rpc, (kinds) => {
      for (const method of kinds) void my.rpc.broadcast({ method, args: [null], optional: true });
    });

    register({
      name: 'request-form-highlight',
      type: 'action',
      jsonSerializable: true,
      handler: (target: { formId: string; path: string } | null) => {
        if (target) highlightSessions.bind('highlight-form-field');
        else highlightSessions.unbind('highlight-form-field');
        void my.rpc.broadcast({
          method: 'highlight-form-field',
          args: [target],
          optional: true,
        });
      },
    });

    register({
      name: 'request-page-highlight',
      type: 'action',
      jsonSerializable: true,
      handler: (selector: string | { pageId?: unknown; id?: unknown; reveal?: unknown } | null) => {
        const target =
          selector && typeof selector === 'object' && typeof selector.id === 'string'
            ? {
                id: selector.id.slice(0, 50),
                ...(typeof selector.pageId === 'string' ? { pageId: selector.pageId } : {}),
                ...(selector.reveal === true ? { reveal: true } : {}),
              }
            : typeof selector === 'string'
              ? selector
              : '';
        if (target) highlightSessions.bind('highlight-in-page');
        else highlightSessions.unbind('highlight-in-page');
        void my.rpc.broadcast({ method: 'highlight-in-page', args: [target], optional: true });
      },
    });

    const pendingFormActions = new Map<string, (result: unknown) => void>();
    let formActionSeq = 0;

    const requestFormAction = (request: Record<string, unknown>, timeoutMs = 15_000) =>
      !config.actions.forms && FORM_WRITE_ACTIONS.includes(request['action'] as string)
        ? Promise.resolve<Record<string, unknown>>({
            ok: false,
            error: actionBlockedMessage('forms'),
          })
        : sendFormAction(request, timeoutMs);

    const sendFormAction = (request: Record<string, unknown>, timeoutMs: number) =>
      new Promise<Record<string, unknown>>((resolve) => {
        const requestId = `f${++formActionSeq}`;
        const formId = typeof request['formId'] === 'string' ? request['formId'] : undefined;
        const explicit = typeof request['page'] === 'string' ? request['page'] : undefined;
        const pageId = explicit ?? (formId?.includes('@') ? formId.split('@')[1] : undefined);
        const { page: _page, ...payload } = request;
        const timer = setTimeout(() => {
          pendingFormActions.delete(requestId);
          resolve({
            ok: false,
            error: `No page answered within ${Math.round(timeoutMs / 1000)}s. Is the app open in a browser, with that form on screen?`,
          });
        }, timeoutMs);
        timer.unref?.();
        pendingFormActions.set(requestId, (result) => {
          clearTimeout(timer);
          pendingFormActions.delete(requestId);
          resolve(
            (result && typeof result === 'object'
              ? result
              : { ok: false, error: 'Empty answer.' }) as Record<string, unknown>,
          );
        });
        void my.rpc.broadcast({
          method: 'form-action',
          args: [{ requestId, pageId, request: payload }],
          optional: true,
        });
      });

    register({
      name: 'form-action-result',
      type: 'action',
      jsonSerializable: true,
      handler: (message: { requestId?: unknown; result?: unknown }) => {
        if (typeof message?.requestId !== 'string') return;
        pendingFormActions.get(message.requestId)?.(message.result);
      },
    });

    register({
      name: 'request-form-action',
      type: 'action',
      jsonSerializable: true,
      handler: (request: unknown) =>
        request && typeof request === 'object'
          ? requestFormAction(request as Record<string, unknown>)
          : { ok: false, error: 'Bad request.' },
    });

    register({
      name: 'forms-lint',
      type: 'query',
      jsonSerializable: true,
      handler: (args: { form?: unknown; page?: unknown } | null) =>
        lintFormsFor(formsState.value() as FormsState, {
          form: typeof args?.form === 'string' ? args.form : undefined,
          page: typeof args?.page === 'string' ? args.page : undefined,
        }),
    });

    register({
      name: 'forms-owners',
      type: 'query',
      jsonSerializable: true,
      handler: () =>
        (formsState.value() as FormsState).forms.map((form) => ({
          formId: form.id,
          label: form.label,
          file: findFormSource(ctx.cwd, form.owner, form.property)?.form?.file ?? null,
        })),
    });

    register({
      name: 'forms-explain',
      type: 'query',
      jsonSerializable: true,
      handler: (args: { kind?: unknown; form?: unknown; path?: unknown } | null) => {
        const state = formsState.value() as FormsState;
        const target = {
          form: typeof args?.form === 'string' ? args.form : undefined,
          path: typeof args?.path === 'string' ? args.path : undefined,
        };
        switch (args?.kind) {
          case 'submit':
            return explainSubmitText(state, target);
          case 'payload':
            return formPayloadText(state, target);
          case 'fixture':
            return exportFormText(state, { ...target, format: 'fixture' });
          default:
            return explainFieldText(state, target);
        }
      },
    });

    register({
      name: 'push-component-tree',
      type: 'action',
      jsonSerializable: true,
      handler: (report: unknown) => {
        if (!isComponentReport(report)) return;
        componentPages.set(report.pageId, toComponentPage(report));
        applyComponentPages();
        for (const check of [...componentWaiters]) check();
      },
    });

    const cdPages = new Map<string, CdPage>();
    const cdState = await my.rpc.sharedState('change-detection', {
      initialValue: { pages: {} } as CdState,
    });
    const applyCd = () =>
      cdState.mutate((draft) => {
        draft.pages = Object.fromEntries(cdPages);
      });
    const requestCdRecord = (message: { pageId?: unknown; on?: unknown; clear?: unknown }) => {
      const pageId = typeof message?.pageId === 'string' ? message.pageId.slice(0, 50) : undefined;
      const on = typeof message?.on === 'boolean' ? message.on : undefined;
      void my.rpc.broadcast({
        method: 'change-detection-record',
        args: [{ pageId, on, clear: message?.clear === true }],
        optional: true,
      });
    };

    register({
      name: 'push-change-detection',
      type: 'action',
      jsonSerializable: true,
      handler: (report: unknown) => {
        const page = toCdPage(report, limits.cdCycles);
        if (!page) return;
        cdPages.set(page.pageId, page);
        applyCd();
      },
    });

    register({
      name: 'ping-change-detection',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        const page = typeof pageId === 'string' ? cdPages.get(pageId) : undefined;
        if (!page) return { known: false };
        cdPages.set(page.pageId, { ...page, reportedAt: Date.now() });
        return { known: true };
      },
    });

    register({
      name: 'forget-change-detection-page',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        if (typeof pageId === 'string' && cdPages.delete(pageId)) applyCd();
      },
    });

    register({
      name: 'request-change-detection-record',
      type: 'action',
      jsonSerializable: true,
      handler: (message: { pageId?: unknown; on?: unknown; clear?: unknown }) => {
        requestCdRecord(message);
      },
    });

    register({
      name: 'ping-component-tree',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        const page = typeof pageId === 'string' ? componentPages.get(pageId) : undefined;
        if (!page) return { known: false };
        componentPages.set(page.pageId, { ...page, reportedAt: Date.now() });
        return { known: true };
      },
    });

    register({
      name: 'forget-component-page',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        if (typeof pageId === 'string' && componentPages.delete(pageId)) applyComponentPages();
      },
    });

    register({
      name: 'select-component',
      type: 'action',
      jsonSerializable: true,
      handler: (target: string | { pageId?: unknown; id?: unknown } | null) => {
        if (typeof target === 'string') {
          void my.rpc.broadcast({
            method: 'select-signal-component',
            args: [target.slice(0, 500)],
            optional: true,
          });
          return;
        }
        const id = typeof target?.id === 'string' ? target.id.slice(0, 50) : null;
        const pageId = typeof target?.pageId === 'string' ? target.pageId : undefined;
        selectComponentOnPage(pageId, id);
      },
    });

    const pendingPicks = new Map<string, (result: Record<string, unknown>) => void>();
    let pickSeq = 0;

    register({
      name: 'request-component-pick',
      type: 'action',
      jsonSerializable: true,
      handler: (target: { pageId?: unknown } | null) => {
        const asked = typeof target?.pageId === 'string' ? target.pageId : undefined;
        const pageId = asked ?? latestComponentPage(componentPages.values())?.pageId;
        if (!pageId || !componentPages.has(pageId)) {
          return { ok: false, error: 'No page is connected. Open the app in a browser first.' };
        }
        return new Promise<Record<string, unknown>>((resolve) => {
          const requestId = `pick${++pickSeq}`;
          const timer = setTimeout(() => {
            pendingPicks.delete(requestId);
            resolve({ ok: false, error: 'The page did not answer. Is the app still open?' });
          }, 20_000);
          timer.unref?.();
          pendingPicks.set(requestId, (result) => {
            clearTimeout(timer);
            pendingPicks.delete(requestId);
            if (result['ok'] === true && typeof result['id'] === 'string') {
              componentTree.mutate((draft) => {
                draft.selectedId = result['id'] as string;
              });
            }
            resolve({ ...result, pageId });
          });
          void my.rpc.broadcast({
            method: 'component-pick',
            args: [{ requestId, pageId }],
            optional: true,
          });
        });
      },
    });

    register({
      name: 'cancel-component-pick',
      type: 'action',
      jsonSerializable: true,
      handler: (target: { pageId?: unknown } | null) => {
        const pageId = typeof target?.pageId === 'string' ? target.pageId : undefined;
        void my.rpc.broadcast({
          method: 'component-pick',
          args: [{ pageId, cancel: true }],
          optional: true,
        });
      },
    });

    register({
      name: 'component-pick-result',
      type: 'action',
      jsonSerializable: true,
      handler: (message: { requestId?: unknown; result?: unknown } | null) => {
        if (typeof message?.requestId !== 'string') return;
        const result =
          message.result && typeof message.result === 'object'
            ? (message.result as Record<string, unknown>)
            : { ok: false, error: 'Empty answer.' };
        pendingPicks.get(message.requestId)?.(result);
      },
    });

    register({
      name: 'select-signal-target',
      type: 'action',
      jsonSerializable: true,
      handler: (target: { pageId?: unknown; id?: unknown; env?: unknown } | null) => {
        const id = typeof target?.id === 'string' ? target.id.slice(0, 50) : null;
        const env = typeof target?.env === 'string' ? target.env.slice(0, 200) : undefined;
        const pageId = typeof target?.pageId === 'string' ? target.pageId : undefined;
        void my.rpc.broadcast({
          method: 'select-signal-component',
          args: [env ? { pageId, env } : { pageId, id }],
          optional: true,
        });
      },
    });

    register({
      name: 'push-signal-graph',
      type: 'action',
      jsonSerializable: true,
      handler: (incoming: PageGraph & { historyDelta?: Record<string, SignalChange[]> }) => {
        const pageId = incoming?.pageId;
        const known = typeof pageId === 'string' && pageId.length < 50;
        const prev = known ? signalPages.get(pageId)?.graph : undefined;
        let graph: PageGraph = incoming;
        let delta = true;
        if (incoming?.historyDelta) {
          const { historyDelta, ...rest } = incoming;
          if (!prev) delta = false;
          const history: Record<string, SignalChange[]> = {};
          for (const { id } of [...(rest.nodes ?? []), ...(rest.resources ?? [])]) {
            const list = [...(prev?.history?.[id] ?? []), ...(historyDelta[id] ?? [])];
            if (list.length) history[id] = list.slice(-50);
          }
          graph = { ...rest, history };
        }
        if (known) signalPages.set(pageId, { graph, reportedAt: Date.now() });
        signalGraphState.mutate((draft) => {
          draft.graph = graph;
          // Every open page pushes, so one shared graph would flip between them.
          draft.pages = Object.fromEntries([...signalPages].map(([id, page]) => [id, page.graph]));
        });
        return { delta };
      },
    });

    register({
      name: 'ping-signal-graph',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        const page = typeof pageId === 'string' ? signalPages.get(pageId) : undefined;
        if (!page) return { known: false };
        signalPages.set(pageId as string, { ...page, reportedAt: Date.now() });
        return { known: true };
      },
    });

    register({
      name: 'forget-signal-page',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        if (typeof pageId === 'string' && signalPages.has(pageId)) forgetSignalPages([pageId]);
      },
    });

    register({
      name: 'push-injector-tree',
      type: 'action',
      jsonSerializable: true,
      handler: (
        report: {
          pageId?: unknown;
          roots?: unknown;
          environment?: unknown;
          truncated?: unknown;
          zone?: unknown;
        } | null,
      ) => {
        const pageId = report?.pageId;
        if (typeof pageId !== 'string' || !pageId || pageId.length >= 50) return;
        const zone = ZONE_MODES.find((mode) => mode === report?.zone);
        injectorPages.set(pageId, {
          pageId,
          roots: (Array.isArray(report?.roots) ? report.roots : []) as InjectorTreeNode[],
          environment: (Array.isArray(report?.environment)
            ? report.environment
            : []) as InjectorTreeNode[],
          ...(report?.truncated === true ? { truncated: true } : {}),
          ...(zone ? { zone } : {}),
          reportedAt: Date.now(),
        });
        applyInjectorPages();
      },
    });

    register({
      name: 'ping-injector-tree',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        const page = typeof pageId === 'string' ? injectorPages.get(pageId) : undefined;
        if (!page) return { known: false };
        injectorPages.set(page.pageId, { ...page, reportedAt: Date.now() });
        return { known: true };
      },
    });

    register({
      name: 'forget-injector-page',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        if (typeof pageId === 'string' && injectorPages.delete(pageId)) applyInjectorPages();
      },
    });

    register({
      name: 'push-ngrx-state',
      type: 'action',
      jsonSerializable: true,
      handler: (report: unknown) => {
        if (!isNgrxReport(report)) return { seq: 0 };
        const seq = mergeNgrxReport(ngrxPages, report, ngrxNames(), Date.now(), limits.changeLog);
        applyNgrx();
        return { seq };
      },
    });

    register({
      name: 'forget-ngrx-page',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        if (typeof pageId === 'string' && ngrxPages.delete(pageId)) applyNgrx();
      },
    });

    const pendingNgrx = new Map<string, (result: unknown) => void>();
    let ngrxSeq = 0;

    register({
      name: 'ngrx-action-result',
      type: 'action',
      jsonSerializable: true,
      handler: (message: { requestId?: unknown; result?: unknown }) => {
        if (typeof message?.requestId !== 'string') return;
        pendingNgrx.get(message.requestId)?.(message.result);
      },
    });

    const requestNgrxAction = (page: unknown, request: unknown) =>
      new Promise<NgrxRequestResult>((resolve) => {
        if (!config.actions.ngrx) return resolve({ error: actionBlockedMessage('ngrx') });
        const pageId = typeof page === 'string' ? page : ngrxStateOf(ngrxPages).pages[0]?.pageId;
        const requestId = `n${++ngrxSeq}`;
        const timer = setTimeout(() => {
          pendingNgrx.delete(requestId);
          resolve({ error: 'No page answered within 10s. Is the app open in a browser?' });
        }, 10_000);
        timer.unref?.();
        pendingNgrx.set(requestId, (result) => {
          clearTimeout(timer);
          pendingNgrx.delete(requestId);
          resolve((result ?? {}) as NgrxRequestResult);
        });
        void my.rpc.broadcast({
          method: 'ngrx-action',
          args: [{ requestId, pageId, request }],
          optional: true,
        });
      });

    register({
      name: 'request-ngrx-action',
      type: 'action',
      jsonSerializable: true,
      handler: (message: { pageId?: unknown; request?: unknown }) =>
        requestNgrxAction(message?.pageId, message?.request),
    });

    // Agent resources
    agent.registerResource({
      id: 'pangular:component-tree',
      name: 'Angular Component Tree',
      description:
        'Live component instances per connected page, as JSON: `pages[pageId].roots` is a tree with one node per rendered instance (`id` instance id, `name` class name, `tag` host tag, `directives` on the host), `platform` (`angular-native` for an Angular Native app, missing for a browser page), `count`, `truncated` and `truncatedBy` (`components` or `depth`, the cap that stopped collection, when the page has more instances than it lists), and `detail` (live input values, outputs, other properties, listeners, change detection, encapsulation and injected dependencies) for the selected instance: the one picked in the panel, on the page, or through pangular:highlight or pangular:inspect-component. `detail.properties` lists the other own fields (signals and resources unwrapped). `nodes` repeats the roots of the most recent page. Empty when no page is connected.',
      mimeType: 'application/json',
      read: () => ({ text: JSON.stringify(componentTree.value(), null, 2) }),
    });

    agent.registerResource({
      id: 'pangular:signal-graph',
      name: 'Angular Signal Graph',
      description:
        'Live signal dependency graph per connected page (`pages[pageId]`, `graph` is the latest): nodes (signal, computed, effect, linkedSignal), edges (producer→consumer), `component` (instance id, class name, host tag and host path) or `injector` (a root or route environment injector), `resources` (each resource folded into one entry with status, params, value and error), `environments` (injectors the page can report) and recent value history per node and status history per resource. Only signals a template or an effect has read appear. Read this to understand reactive data flow.',
      mimeType: 'application/json',
      read: () => ({ text: JSON.stringify(signalGraphState.value(), null, 2) }),
    });

    agent.registerResource({
      id: 'pangular:injector-tree',
      name: 'Angular Injector Tree',
      description:
        'DI injector hierarchy last reported by a connected page (`pages[pageId]`, `roots` and `environment` are the latest), with providers at each level. Element injectors list what their components and directives inject; environment injectors list what the services they already created inject. `zone` is the change detection mode: `zoneless`, `zone` (zone.js) or `zone-unused` (zoneless with zone.js still loaded). `truncated: true` means the page has more element injectors than it reports (the first 2000), so the rest are missing. Empty when no page is connected.',
      mimeType: 'application/json',
      read: () => ({ text: JSON.stringify(injectorTreeState.value(), null, 2) }),
    });

    agent.registerResource({
      id: 'pangular:ngrx-store',
      name: 'NgRx Store State',
      description:
        'Live NgRx state per connected page: each @ngrx/signals store (state, computed values, methods, the component fields that reference it) and the @ngrx/store state, plus a change log with a per-entry state diff (method calls, patchState writes, dispatched actions and restores). An @ngrx/store action entry has an `origin`: `dispatch` (Store.dispatch, usually a component or service), `effect` (sent by an NgRx effect through Store.next) or `reactive` (Store.dispatch with a function); it is missing for actions sent another way. `classic.paused` is true after a restore jumped Store DevTools to a past state: new actions are logged but do not change the state until the panel goes back to the latest state. An @ngrx/store entry with `unrestorable` cannot be restored: `dropped` means Store DevTools no longer holds the action (dropped past its `maxAge`, or its history was committed, reset or imported), `not-recorded` means it never recorded it (filtered out, or recording paused). Empty when no page is connected.',
      mimeType: 'application/json',
      read: () => ({ text: JSON.stringify(ngrxStoreState.value(), null, 2) }),
    });

    agent.registerResource({
      id: 'pangular:forms',
      name: 'Angular Forms',
      description:
        "Every form a connected page last reported (Signal Forms, reactive and template-driven), with each field's value, status, touched, dirty and errors, plus recent changes. Empty when no page is connected.",
      mimeType: 'application/json',
      read: () => ({ text: formsResourceText(formsState.value() as FormsState) }),
    });

    agent.registerResource({
      id: 'pangular:router',
      name: 'Angular Router',
      description:
        'The active route tree (params, data, guards, resolvers) and recent navigations of each connected page. Empty when no page is connected.',
      mimeType: 'application/json',
      read: () => ({ text: routerResourceText(routerState.value() as RouterState) }),
    });

    const ngrxPageProperty = {
      type: 'string',
      description: 'Page id, when more than one tab reports. Defaults to every page.',
    } as const;

    agent.registerTool({
      id: 'pangular:inspect-signal-store',
      description: INSPECT_SIGNAL_STORE_DESCRIPTION,
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          page: ngrxPageProperty,
          storeId: {
            type: 'string',
            description:
              'Store id (e.g. `ngrx-1`, as shown on the NgRx Store page or returned by a previous call). Omit for a summary of every store across the matching page(s).',
          },
        },
      },
      handler: async (args: { page?: string; storeId?: string }) => ({
        markdown: withUntrustedPreamble(
          inspectSignalStoreText(ngrxPages, args?.page, args?.storeId),
        ),
      }),
    });

    agent.registerTool({
      id: 'pangular:signal-store-history',
      description: SIGNAL_STORE_HISTORY_DESCRIPTION,
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          page: ngrxPageProperty,
          storeId: {
            type: 'string',
            description:
              'Store id to filter the log to. Omit to include every store, plus `@ngrx/signals/events` events with no store effect.',
          },
          since: {
            type: 'number',
            description:
              'Only return entries whose `seq` is strictly greater than this. Pass the last `seq` from a previous call to poll.',
          },
        },
      },
      handler: async (args: { page?: string; storeId?: string; since?: number }) => ({
        markdown: withUntrustedPreamble(
          signalStoreHistoryText(ngrxPages, args?.page, args?.storeId, args?.since),
        ),
      }),
    });

    // Agent tools
    const noComponentTree = (outcome: string) =>
      `No component tree has been reported${outcome}. This is what a page that has never connected reports, and also what a connected page reports when its components are not readable. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio server has no page attached and only ever reports this.`;
    const componentPageProperty = {
      type: 'string',
      description:
        'Page id, when more than one tab reports (see pangular:list-pages). Searches every page without it, newest first.',
    };
    const componentHits = (selector: string, pageId?: string) =>
      findComponents(
        byRecency(componentPages.values()).filter((page) => !pageId || page.pageId === pageId),
        selector,
      );
    const unknownComponentPage = (pageId: string | undefined) =>
      pageId && !componentPages.has(pageId)
        ? {
            markdown: unknownPageText(
              pageId,
              byRecency(componentPages.values()),
              'a component tree',
            ),
          }
        : null;

    agent.registerTool({
      id: 'pangular:highlight',
      description:
        'Highlight a component in the running Angular app and select it: the pangular:component-tree resource then carries its live `detail` and pangular:inspect-signals targets it. Pass an instance id from the pangular:component-tree resource (targets that exact instance, e.g. the second card of a list), a class name, a host tag, or any CSS selector. A class name or tag resolves on the most recent page unless `page` names another tab. When it matches several instances, it picks the first and lists the ids of all of them.',
      safety: 'action',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description:
              'Instance id (e.g. c12), class name (e.g. ProductCard), host tag (e.g. app-root) or CSS selector.',
          },
          page: componentPageProperty,
          pageId: { type: 'string', description: 'Same as `page`.' },
        },
        required: ['selector'],
      },
      handler: async (args: { selector: string; page?: string; pageId?: string }) => {
        const page = pageArgument(args, 'pageId');
        const all = byRecency(componentPages.values());
        if (page && !componentPages.has(page)) {
          return { markdown: unknownPageText(page, all, 'a component tree') };
        }
        const pages = page ? all.filter((entry) => entry.pageId === page) : all;
        if (!pages.some((entry) => entry.roots.length)) {
          return {
            markdown: noComponentTree(', so nothing was highlighted'),
          };
        }
        const hits = componentHits(args.selector, page);
        const [hit] = hits;
        const target = hit
          ? { pageId: hit.pageId, id: hit.node.id }
          : page
            ? { pageId: page, selector: args.selector }
            : args.selector;
        const shown = typeof target === 'string' ? { selector: target } : target;
        void my.rpc.broadcast({
          method: 'highlight-in-page',
          args: [{ ...shown, reveal: true, durationMs: AGENT_HIGHLIGHT_MS }],
          optional: true,
        });
        void my.rpc.broadcast({
          method: 'select-signal-component',
          args: [target],
          optional: true,
        });
        if (hit) selectComponentOnPage(hit.pageId, hit.node.id);
        const others = otherMatchesText(hits, args.selector);
        const cut = hit ? '' : truncationText(pages);
        const otherPages = [
          ...new Set(hits.map((entry) => entry.pageId).filter((id) => id !== hit?.pageId)),
        ];
        const also = otherPages.length
          ? ` It also matches on ${otherPages.map((id) => `\`${id}\``).join(', ')}. Pass \`page\` to pick another tab.`
          : '';
        return {
          markdown: hit
            ? `Sent a highlight request for \`${hit.node.name}\` (\`<${hit.node.tag}>\`, instance \`${hit.node.id}\` on page \`${hit.pageId}\`) and selected it.${also}${others ? `\n\n${others}` : ''}`
            : `Sent a highlight request for \`${args.selector}\`${page ? ` to page \`${page}\`` : ''}. It only shows if the selector matches an element on the page. No component instance matched, so the selection did not change.${cut ? ` ${cut}` : ''}`,
        };
      },
    });

    agent.registerTool({
      id: 'pangular:inspect-component',
      description:
        'Get the live detail of one component instance: inputs, outputs with whether a parent listens, other own properties (signals and resources unwrapped), DOM listeners, host directives, change detection, encapsulation, host path and injected services. Pass an instance id from the pangular:component-tree resource, a class name or a host tag. This selects the instance on its page (the panel follows) and waits for the page to report it. A class name or tag that matches several instances answers for the first and lists the ids of all of them. Secret-looking values are redacted.',
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'Instance id (e.g. c12), class name (e.g. ProductCard) or host tag.',
          },
          page: componentPageProperty,
          pageId: { type: 'string', description: 'Same as `page`.' },
        },
        required: ['selector'],
      },
      handler: async (args: { selector: string; page?: string; pageId?: string }) => {
        const page = pageArgument(args, 'pageId');
        const unknown = unknownComponentPage(page);
        if (unknown) return unknown;
        if (![...componentPages.values()].some((entry) => entry.roots.length)) {
          return { markdown: noComponentTree('') };
        }
        const hits = componentHits(args.selector, page);
        const [hit] = hits;
        if (!hit) {
          return {
            markdown: [
              `No component instance matches \`${args.selector}\`. Pass an instance id, class name or host tag from the pangular:component-tree resource.`,
              truncationText(
                [...componentPages.values()].filter((entry) => !page || entry.pageId === page),
              ),
            ]
              .filter(Boolean)
              .join(' '),
          };
        }
        selectComponentOnPage(hit.pageId, hit.node.id);
        const detail = await waitForComponentDetail(hit.pageId, hit.node.id);
        const others = otherMatchesText(hits, args.selector);
        if (!detail) {
          return {
            markdown: `Selected \`${hit.node.name}\` (instance \`${hit.node.id}\` on page \`${hit.pageId}\`), but the page did not report its detail within 3 seconds. The instance may have been destroyed, or the tab may be in the background. Try again, or read the pangular:component-tree resource later.${others ? `\n\n${others}` : ''}`,
          };
        }
        return {
          markdown: `Live detail of \`${detail.name}\` (\`<${detail.tag}>\`, instance \`${detail.id}\` on page \`${hit.pageId}\`), read from the running page.${others ? `\n\n${others}` : ''}\n\n${JSON.stringify(detail, null, 2)}`,
        };
      },
    });

    agent.registerTool({
      id: 'pangular:defer-blocks',
      description:
        "List the `@defer` blocks the running page renders, read live through Angular's debug API: the owning component, state (placeholder, loading, complete, error), incremental hydration state (dehydrated, hydrated), triggers and whether it has @loading, @placeholder and @error blocks. Flags blocks that failed to load, blocks still on their placeholder after 10 seconds, blocks still dehydrated and `hydrate never` blocks. Each open tab reports its own list; `page` picks one. Says so when the page has no defer block util (production builds).",
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            description:
              'Page id, when more than one tab reports (see pangular:list-pages). Lists every page without it.',
          },
          pageId: { type: 'string', description: 'Same as `page`.' },
        },
      },
      handler: async (args: { page?: string; pageId?: string }) => {
        const page = pageArgument(args, 'pageId');
        return (
          unknownComponentPage(page) ?? {
            markdown: deferBlocksText(
              byRecency(componentPages.values()).filter((entry) => !page || entry.pageId === page),
            ),
          }
        );
      },
    });

    agent.registerTool({
      id: 'pangular:change-detection',
      description:
        'Change detection cycles recorded with Angular\'s profiler (Angular 20+, development build): the slowest components by self time, the most often checked components, and the latest cycles with duration, component checks, sync passes and the output that ran before each one. Recording is off until the panel or this tool starts it; pass `record: "start"`, use the app, then call again without `record`. `stop` keeps the recording, `clear` empties it. The answer starts with the change detection mode the page runs: zoneless, zone.js, or zoneless with zone.js still loaded.',
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          record: { type: 'string', enum: ['start', 'stop', 'clear'] },
          page: { type: 'string', description: 'Page id; defaults to the page that is recording.' },
          limit: { type: 'number', description: 'Rows per list (default 10, max 50).' },
        },
      },
      handler: async (args: { record?: string; page?: string; limit?: number }) => {
        if (args?.record === 'start' || args?.record === 'stop' || args?.record === 'clear') {
          requestCdRecord({
            pageId: args.page,
            on: args.record === 'clear' ? undefined : args.record === 'start',
            clear: args.record === 'clear',
          });
          const next =
            args.record === 'start'
              ? 'Recording started on every connected page unless you passed `page`. Use the app, then call this tool again without `record`.'
              : args.record === 'stop'
                ? 'Recording stopped. The cycles recorded so far stay available.'
                : 'Recording cleared.';
          return { markdown: next };
        }
        const text = changeDetectionText(cdState.value() as CdState, args ?? {});
        const injectors = args?.page ? injectorPages.get(args.page) : latestInjectorPage();
        const mode = injectors ? zoneModeText(injectors.zone, injectors.pageId) : '';
        return { markdown: mode ? `${mode}\n\n${text}` : text };
      },
    });

    agent.registerTool({
      id: 'pangular:inspect-signals',
      description:
        "Get the signal graph the running page last reported: signal nodes (signal, computed, linkedSignal, effect), their dependency edges, `component` (instance id, class name, host tag and host path) or `injector` (an environment injector), `resources` (each resource(), httpResource() or rxResource() folded into one entry with status, isLoading, params, value, error and the ids of its internal nodes), `environments` (root and route injectors the page can report), and `history` (recent value changes per node id and status changes per resource id; `write` entries are exact, `sample` entries come from polling and `missed` counts values that went unseen). `changes` on a node or resource counts every change since the page first saw it, past the 50 kept entries. `nodeCount` is set when Angular reported more nodes than the 400 kept. Only signals a template or an effect has read appear. The page reports one graph: the component picked on the Signals page (or via pangular:highlight), otherwise the component the primary router outlet renders deepest, otherwise the first component with a graph. Pass `root` for effects in root services, or a route path (`/admin` or `Route: admin`) for effects in that route's providers; this switches the page's graph to that injector. A component selector that does not match the reported graph returns what is available instead; call pangular:highlight with it first to switch the graph to it.",
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description:
              'Host tag, class name or instance id of the component (e.g. app-root), `root`, or a route path (e.g. /admin).',
          },
          page: PAGE_ARGUMENT,
        },
        required: ['selector'],
      },
      handler: async (args: { selector: string; page?: string }) => {
        // `broadcast` resolves with nothing, so the page cannot answer a
        // question. Read the graph the overlay pushes into shared state.
        const page = pageArgument(args);
        const all = byRecency([...signalPages].map(([pageId, entry]) => ({ pageId, ...entry })));
        if (page && !signalPages.has(page)) {
          return { markdown: unknownPageText(page, all, 'a signal graph') };
        }
        const matches = (g: PageGraph) =>
          [g.componentSelector, g.component?.name, g.component?.id].includes(args.selector) ||
          (!!g.injector && injectorMatches(g.injector, args.selector));
        const latestMatch = () =>
          byRecency(
            [...signalPages]
              .map(([pageId, entry]) => ({ pageId, ...entry }))
              .filter((entry) => !page || entry.pageId === page),
          ).find((entry) => matches(entry.graph))?.graph;
        let matched = latestMatch();
        if (!matched && signalPages.size && isEnvironmentRequest(args.selector)) {
          void my.rpc.broadcast({
            method: 'select-signal-component',
            args: [page ? { pageId: page, env: args.selector } : { env: args.selector }],
            optional: true,
          });
          for (let waited = 0; !matched && waited < ENV_WAIT_MS; waited += 50) {
            await new Promise((resolve) => setTimeout(resolve, 50));
            matched = latestMatch();
          }
        }
        const graph =
          matched ??
          (page
            ? all.find((entry) => entry.pageId === page)?.graph
            : (signalGraphState.value().graph as PageGraph | null));
        if (!graph) {
          return {
            markdown: `No signal graph available. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio server has no page attached and only ever reports this.`,
          };
        }
        if (graph.unsupported) {
          return {
            markdown: `The page runs an Angular version whose signal graph has no node ids, so there is no live graph. The live signal graph needs Angular 20.1 or later. The get-signals source scan still works.`,
          };
        }
        const json = JSON.stringify(graph, null, 2);
        if (!matches(graph)) {
          const known = (graph.environments ?? []).map((e) => `\`${e.name}\``).join(', ');
          const covers = graph.componentSelector ?? graph.injector?.name ?? 'another target';
          const hint = isEnvironmentRequest(args.selector)
            ? ` No environment injector on the page matches it${known ? `; the page knows ${known}` : ''}.`
            : '';
          return {
            markdown: `No signal graph for \`${args.selector}\`.${hint} The live graph covers \`${covers}\`:\n\n${json}`,
          };
        }
        return { markdown: json };
      },
    });

    agent.registerTool({
      id: 'pangular:inspect-providers',
      description:
        'Get the DI injectors a running page reported. With no arguments, returns the whole tree (element and environment injectors with their providers, and what the services each environment injector already created inject), cut off at 20,000 characters. `selector` returns only the matching element injectors, each with what it injects and its lookup path resolved to names and provided tokens. `token` returns which injectors provide that token and which components or services inject it. Each open tab reports its own tree; `page` picks one and defaults to the most recent. Says so when the page reported only part of a large tree.',
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description:
              'Optional. A tag name (app-card), a component or directive class name (CardComponent), or an injector id. Returns only the matching element injectors.',
          },
          token: {
            type: 'string',
            description:
              'Optional. A token name, such as a service class or InjectionToken description (HttpClient, API_URL). Returns where it is provided and injected. With `selector`, only injections by the matching injectors are listed.',
          },
          page: PAGE_ARGUMENT,
          pageId: { type: 'string', description: 'Same as `page`.' },
        },
      },
      handler: async (args: {
        selector?: string;
        token?: string;
        page?: string;
        pageId?: string;
      }) => {
        const requested = pageArgument(args, 'pageId');
        if (requested && !injectorPages.has(requested)) {
          return {
            markdown: unknownPageText(requested, [...injectorPages.values()], 'an injector tree'),
          };
        }
        const page = requested ? injectorPages.get(requested) : latestInjectorPage();
        return { markdown: inspectProvidersText(page, args) };
      },
    });

    const noRouter = `No router state has been reported. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio server has no page attached and only ever reports this.`;
    const pageProperty = PAGE_ARGUMENT;

    agent.registerTool({
      id: 'pangular:inspect-route',
      description:
        'The route the running page is on right now: URL (and the browser URL when it differs), query params, fragment, document title, any navigation in flight, the active route tree (component, params and data with where each value comes from, own or inherited title, guards, resolvers) and the outlet tree with router-bound inputs and a preview of the `routerOutletData` each outlet passes (`ROUTER_OUTLET_DATA`). Pass `selector` (a component class, element tag or link text) to see the route a component was rendered for, or whether a link counts as active. Secret-looking values are redacted.',
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          page: pageProperty,
          selector: {
            type: 'string',
            description:
              'Component class name, element tag or link text to explain instead of the whole route.',
          },
        },
      },
      handler: async (args: { page?: string; selector?: string }) => {
        const state = routerState.value() as RouterState;
        if (!state.pages.length) return { markdown: noRouter };
        return { markdown: inspectRouteText(state, args) };
      },
    });

    agent.registerTool({
      id: 'pangular:explain-navigation',
      description:
        'Recent navigations on the running page, newest first, each as a full story: from and to, who started it (link, code, back/forward), extras, redirect chain, redirect loops (the cycle of URLs and the guard, redirectTo or navigate call behind each hop), per-phase timing, guards and resolvers (with each verdict when instrumentation is on), lazy loads, reused components, HTTP requests, scroll, title, and the cancel or error reason with a plain-language meaning and the NG0 error explained. Use it for "why did this navigation not work", "why was I redirected" or, with perf, "why is navigation slow".',
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          page: pageProperty,
          url: {
            type: 'string',
            description: 'Only navigations whose URL or final URL contains this text.',
          },
          id: { type: 'integer', description: 'Only the navigation with this id.' },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 50,
            description: 'How many navigations to return (default 5, at most 50).',
          },
          perf: {
            type: 'boolean',
            description: 'Summarize the slowest navigations and preloads instead.',
          },
        },
      },
      handler: async (args: {
        page?: string;
        url?: string;
        limit?: number;
        perf?: boolean;
        id?: number;
      }) => {
        const state = routerState.value() as RouterState;
        if (!state.pages.length) return { markdown: noRouter };
        return { markdown: explainNavigationText(state, args) };
      },
    });

    agent.registerTool({
      id: 'pangular:list-routes',
      description:
        "The router's live route config (not just the active route): every route with its full path, component or redirect, lazy state, outlet, guards, resolvers, title, the source file it is declared in and an example URL, with the active routes marked. Pass `match` to predict which route a URL matches (or the nearest routes when it matches none), `audit` for the guards protecting each page, or `filter` to narrow by path or component.",
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          page: pageProperty,
          match: {
            type: 'string',
            description: 'A URL such as /users/42 to match against the config.',
          },
          audit: { type: 'boolean', description: 'List the guards that protect each page.' },
          filter: {
            type: 'string',
            description: 'Only routes whose path or component contains this text.',
          },
        },
      },
      handler: async (args: {
        page?: string;
        match?: string;
        audit?: boolean;
        filter?: string;
      }) => {
        const state = routerState.value() as RouterState;
        if (!state.pages.length) return { markdown: noRouter };
        let sources: ReturnType<typeof extractRoutes> = [];
        try {
          sources = extractRoutes(ctx.cwd);
        } catch {
          sources = [];
        }
        return { markdown: listRoutesText(state, args, sources) };
      },
    });

    agent.registerTool({
      id: 'pangular:lint-routes',
      description:
        "Checks the live route config for mistakes: routes after '**', a :param route shadowing a literal one, duplicate paths, empty-path redirects without pathMatch 'full', redirect cycles, redirect loops seen at runtime (a chain of guard or redirectTo redirects, or code-started navigations, that comes back to a URL, with the guards involved), deprecated class guards and canLoad, lazy chunks downloaded before canActivate rejects, missing or duplicate titles, param/input name typos, RouterLinkActive without aria-current, emails in URLs and return URLs taken from query params. Each finding says whether Angular throws, warns or stays silent, and how to fix it.",
      safety: 'read',
      inputSchema: { type: 'object', properties: { page: pageProperty } },
      handler: async (args: { page?: string }) => {
        const state = routerState.value() as RouterState;
        if (!state.pages.length) return { markdown: noRouter };
        return { markdown: lintRoutesText(state, args) };
      },
    });

    agent.registerTool({
      id: 'pangular:router-config',
      description:
        'How the router is set up on the running page: provideRouter, forRoot or other, or unknown when the build cannot tell, Angular version, effective options with which are set and which are defaults (onSameUrlNavigation, paramsInheritanceStrategy, urlUpdateStrategy, canceledNavigationResolution, scrolling, initial navigation), enabled features (input binding, view transitions, error handler, preloading strategy, scroller, resources), strategies (location, title, reuse, URL handling), base href, hydration and whether per-guard instrumentation is on.',
      safety: 'read',
      inputSchema: { type: 'object', properties: { page: pageProperty } },
      handler: async (args: { page?: string }) => {
        const state = routerState.value() as RouterState;
        if (!state.pages.length) return { markdown: noRouter };
        return { markdown: routerConfigText(state, args) };
      },
    });

    agent.registerTool({
      id: 'pangular:export-navigation',
      description:
        'A markdown repro for one navigation (default: the latest that did not succeed): Angular version, router options and features, how it started, the full redirect chain with every detail from explain-navigation, any redirect loop it is part of, and the relevant slice of the route config. Secret-looking values stay redacted.',
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: { page: pageProperty, id: { type: 'integer', description: 'Navigation id.' } },
      },
      handler: async (args: { page?: string; id?: number }) => {
        const state = routerState.value() as RouterState;
        if (!state.pages.length) return { markdown: noRouter };
        return { markdown: exportNavigationText(state, args) };
      },
    });

    agent.registerTool({
      id: 'pangular:explain-render-mode',
      description:
        "Which ServerRoute (from the workspace's *.routes.server.ts) and render mode (Server, Client, Prerender) a URL gets, plus server entries that match no client route and the render mode of every client route.",
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          page: pageProperty,
          url: { type: 'string', description: 'URL to check; defaults to the page URL.' },
        },
      },
      handler: async (args: { page?: string; url?: string }) => {
        const state = routerState.value() as RouterState;
        let entries: ReturnType<typeof scanServerRoutes> = [];
        try {
          entries = scanServerRoutes(ctx.cwd);
        } catch {
          entries = [];
        }
        return { markdown: explainRenderModeText(state, entries, args) };
      },
    });

    agent.registerTool({
      id: 'pangular:navigate',
      description:
        'Acts on the running app\'s router (development only). action "navigate" goes to `url` (same-origin, starting with "/") or to `pattern` with `params` (e.g. /users/:id with {"id":"7"}), optionally with replaceUrl or skipLocationChange, and waits for the outcome; "abort" stops the navigation in flight; "replay" re-runs navigation `id` and compares the outcome; "probe" runs the real matcher for `url` without navigating (it runs canMatch and may load lazy chunks; when a canMatch guard redirects, it stops the redirect and returns `redirectedTo`); "instrument" turns per-guard and per-resolver recording on or off; "resolve-lazy" reads the routes of an unloaded lazy route (`routeId` from list-routes) without registering them. navigate, abort, replay and probe need the router write action (actions.router); instrument and resolve-lazy work without it.',
      safety: 'action',
      inputSchema: {
        type: 'object',
        properties: {
          page: pageProperty,
          action: {
            type: 'string',
            enum: ['navigate', 'abort', 'replay', 'probe', 'instrument', 'resolve-lazy'],
          },
          url: { type: 'string' },
          pattern: { type: 'string' },
          params: { type: 'object', additionalProperties: { type: 'string' } },
          replaceUrl: { type: 'boolean' },
          skipLocationChange: { type: 'boolean' },
          waitFor: {
            type: 'string',
            enum: ['navigation', 'stable'],
            description:
              'For navigate. "navigation" (default) returns when the navigation ends. "stable" also waits until the app has no pending tasks (HTTP requests, httpResource loads, timers), like ApplicationRef.whenStable(); the result says `stable: true`, or `stable: false` when 10s ran out first.',
          },
          id: { type: 'integer', description: 'Navigation id for replay.' },
          on: { type: 'boolean', description: 'For instrument.' },
          routeId: { type: 'string', description: 'Route id for resolve-lazy.' },
        },
        required: ['action'],
      },
      handler: async (args: {
        page?: string;
        action: string;
        url?: string;
        pattern?: string;
        params?: Record<string, string>;
        replaceUrl?: boolean;
        skipLocationChange?: boolean;
        waitFor?: 'navigation' | 'stable';
        id?: number;
        on?: boolean;
        routeId?: string;
      }) => {
        if (!config.actions.router && ROUTER_WRITE_ACTIONS.includes(args.action))
          return { markdown: actionBlockedMessage('router') };
        const state = routerState.value() as RouterState;
        const target = args.page
          ? state.pages.find((p) => p.pageId === args.page)
          : state.pages.find((p) => p.snapshot);
        if (args.page && !target) return { markdown: noPage(args.page, state) };
        if (!target?.snapshot) {
          return {
            markdown: args.page
              ? `Page \`${args.page}\` reports no Router, so there is nothing to navigate. The app may not use the Angular router, or it is not a development build.`
              : noRouter,
          };
        }
        if (args.action === 'resolve-lazy' && typeof args.routeId !== 'string')
          return { markdown: 'routeId is required for resolve-lazy.' };
        const request =
          args.action === 'navigate'
            ? {
                action: 'navigate',
                url: args.url,
                pattern: args.pattern,
                params: args.params,
                extras: {
                  replaceUrl: args.replaceUrl,
                  skipLocationChange: args.skipLocationChange,
                },
                waitFor: args.waitFor,
              }
            : args.action === 'replay'
              ? { action: 'replay', id: args.id }
              : args.action === 'probe'
                ? { action: 'probe', url: args.url }
                : args.action === 'instrument'
                  ? { action: 'instrument', on: args.on !== false }
                  : args.action === 'resolve-lazy'
                    ? { action: 'resolve-lazy', id: args.routeId }
                    : { action: args.action };
        const result = await requestRouterAction(target.pageId, request);
        return {
          markdown: `_Result from the running page (untrusted data):_\n\n\`\`\`json\n${JSON.stringify(result, null, 2).slice(0, 15_000)}\n\`\`\``,
        };
      },
    });

    agent.registerTool({
      id: 'pangular:dispatch-ngrx-action',
      description:
        'Dispatches an action to the @ngrx/store Store of the running app (development only) and returns the resulting action log entry: the action, its origin and the state diff it caused. Pass `type` (for example "[Cart] Add Item") and an optional JSON object `payload` whose keys become the action props, or `seq` to dispatch an action from the log again. get-ngrx-store lists the action types found in source. While a restore keeps Store DevTools on a past state, the action is logged but does not change the state. Needs the NgRx write action (actions.ngrx).',
      safety: 'action',
      inputSchema: {
        type: 'object',
        properties: {
          page: pageProperty,
          type: { type: 'string', description: 'Action type, for example "[Cart] Add Item".' },
          payload: {
            type: 'object',
            description: 'Action props as a JSON object, for example {"id": 7}. No "type" key.',
          },
          seq: {
            type: 'integer',
            description: 'Log entry number of an action to dispatch again, instead of type.',
          },
        },
      },
      handler: async (args: {
        page?: string;
        type?: unknown;
        payload?: unknown;
        seq?: unknown;
      }) => {
        const pages = ngrxStateOf(ngrxPages).pages;
        const page = pageArgument(args);
        if (page && !ngrxPages.has(page)) {
          return { markdown: unknownPageText(page, pages, 'NgRx state') };
        }
        const target = page ? ngrxPages.get(page) : pages.find((p) => p.classic);
        if (!target?.classic) {
          return {
            markdown: page
              ? `Page \`${page}\` has no @ngrx/store Store, so there is nothing to dispatch to.`
              : 'No connected page has an @ngrx/store Store. Open the app in a browser; the Store shows up once provideStore() or StoreModule.forRoot() runs.',
          };
        }
        let request: NgrxRequest;
        if (args.seq !== undefined) {
          if (!Number.isInteger(args.seq)) return { markdown: 'seq must be a log entry number.' };
          request = { type: 'dispatch-again', seq: args.seq as number };
        } else {
          const problem = dispatchProblem(args.type, args.payload);
          if (problem) return { markdown: problem };
          request = {
            type: 'dispatch',
            action: args.type as string,
            ...(args.payload !== undefined
              ? { payload: args.payload as Record<string, unknown> }
              : {}),
          };
        }
        return { markdown: dispatchResultText(await requestNgrxAction(target.pageId, request)) };
      },
    });

    const noForms = `No forms have been reported. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser, on a page that renders a form. The stdio server has no page attached and only ever reports this.`;
    const unknownFormPage = (args: unknown) => {
      const page = pageArgument(args as Record<string, unknown> | undefined);
      if (!page || formPages.has(page)) return undefined;
      return { markdown: unknownPageText(page, [...formPages.values()], 'forms') };
    };
    const formProperty = {
      type: 'string',
      description:
        'Form id (Checkout.form@ab12, or Checkout.form without the page) or part of its label (Component.property).',
    };

    agent.registerTool({
      id: 'pangular:inspect-forms',
      description:
        'Inspect the forms on the running page (Signal Forms, reactive and template-driven). Without arguments it lists each form with its status and error count. Pass `form` for its field tree (value, status, touched, dirty, errors per field). Signal Forms that set `experimentalWebMcpTool` also carry `webMcp`: the tool name, description, inputs, registration status (registered, or failed with the fields that blocked schema inference), required fields that changed since registration, duplicate names and recent agent calls. Password and other secret-looking values are redacted. For "why is this form invalid", call explain-form-invalid first.',
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          form: formProperty,
          page: {
            type: 'string',
            description: 'Page id (the part after @ in a form id) when several tabs are connected.',
          },
          path: {
            type: 'string',
            description:
              'Dotted field path to start the tree at, e.g. address.city or tags.1. Applies to every matched form.',
          },
          onlyInvalid: {
            type: 'boolean',
            description: 'Only include invalid or pending fields and their parents.',
          },
          includeValues: {
            type: 'boolean',
            description:
              "Include field values in this tool's output (default true). When false, values and value-bearing error params are left out; a custom error message that quotes the value is still returned as is.",
          },
        },
      },
      handler: async (args: InspectFormsArgs) => {
        const state = formsState.value() as FormsState;
        if (!state.forms.length) return { markdown: noForms };
        const elsewhere = unknownFormPage(args);
        if (elsewhere) return elsewhere;
        return { markdown: inspectFormsText(state, args) };
      },
    });

    agent.registerTool({
      id: 'pangular:explain-form-invalid',
      description:
        'Explain why forms on the running page are invalid: each failing field with its current value, the validator that failed, its message and whether it was touched, plus fields waiting on async validators and disabled reasons. Without `form` it covers every form that is invalid or waiting on async validation.',
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          form: formProperty,
          page: {
            type: 'string',
            description: 'Page id (the part after @ in a form id) when several tabs are connected.',
          },
        },
      },
      handler: async (args: { form?: string; page?: string }) => {
        const state = formsState.value() as FormsState;
        if (!state.forms.length) return { markdown: noForms };
        const elsewhere = unknownFormPage(args);
        if (elsewhere) return elsewhere;
        return { markdown: explainFormsText(state, args) };
      },
    });

    const formPageProperty = {
      type: 'string',
      description: 'Page id (the part after @ in a form id) when several tabs are connected.',
    };
    const pathProperty = {
      type: 'string',
      description:
        'Dotted field path, e.g. address.city or items.0.qty. Empty for the form itself.',
    };
    const withForms =
      <A>(fn: (state: FormsState, args: A) => string) =>
      async (args: A) => {
        const state = formsState.value() as FormsState;
        if (!state.forms.length) return { markdown: noForms };
        const elsewhere = unknownFormPage(args);
        if (elsewhere) return elsewhere;
        return { markdown: fn(state, args ?? ({} as A)) };
      };
    const str = (value: unknown) => (typeof value === 'string' ? value : undefined);

    agent.registerTool({
      id: 'pangular:explain-field',
      description:
        'Explain one form field: value, flags, every error with where it comes from (validator, template attribute, cross-field rule and which ancestor, async, parse, server/submission, setErrors), why validation is skipped (hidden, disabled, readonly), inherited disabled reasons, uncommitted or debounced input, stale validity, rules and validator names, the binding (accessor or [formField]) and DOM facts (label, visible error text, drift). Pass `selector` instead of form/path to start from a CSS selector.',
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          form: formProperty,
          path: pathProperty,
          selector: { type: 'string', description: 'CSS selector of an input bound to a field.' },
          page: formPageProperty,
        },
      },
      handler: async (args: { form?: string; path?: string; selector?: string; page?: string }) => {
        const state = formsState.value() as FormsState;
        if (!state.forms.length) return { markdown: noForms };
        const elsewhere = unknownFormPage(args);
        if (elsewhere) return elsewhere;
        let target = { form: args?.form, path: args?.path, page: args?.page };
        if (args?.selector) {
          const located = await requestFormAction(
            { action: 'locate', selector: args.selector, page: args.page },
            5000,
          );
          if (!located['ok']) return { markdown: String(located['error'] ?? 'Not found.') };
          target = {
            form: str(located['formId']),
            path: str(located['path']) ?? '',
            page: undefined,
          };
        }
        const owner = fieldOwner(state, target);
        const source = owner
          ? sourceText(findFormSource(ctx.cwd, owner.owner, owner.property, owner.path))
          : '';
        return { markdown: explainFieldText(state, target, Date.now(), source) };
      },
    });

    agent.registerTool({
      id: 'pangular:explain-submit',
      description:
        'Explain what submitting a form will do and why it might do nothing: Signal Forms submit() dry-run (action present, ignoreValidators, already submitting), ngSubmit semantics for reactive and template forms, DOM reasons (no submit button, type="button", disabled button, directive not on a <form>, native validation), blocking and pending fields, and recent submits with their outcome (ran, blocked, threw).',
      safety: 'read',
      inputSchema: { type: 'object', properties: { form: formProperty, page: formPageProperty } },
      handler: withForms(explainSubmitText),
    });

    agent.registerTool({
      id: 'pangular:form-payload',
      description:
        'Show what a form would send: form.value vs getRawValue() with the disabled fields form.value drops (reactive), or the hidden/disabled/readonly fields Signal Forms keeps in the value without validating them, plus which fields the user changed.',
      safety: 'read',
      inputSchema: { type: 'object', properties: { form: formProperty, page: formPageProperty } },
      handler: withForms(formPayloadText),
    });

    agent.registerTool({
      id: 'pangular:form-history',
      description:
        'Timeline of form changes: value (with previous value and repeat count), status, submit (ran, blocked, threw), added and removed fields, each tagged with its origin (user, code, devtools, binding, or agent for a WebMCP tool call). Filter by form, path, type, origin or `since` (a marker from an earlier call). Returns the current marker.',
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          form: formProperty,
          path: pathProperty,
          type: {
            type: 'string',
            enum: [
              'value',
              'status',
              'touched',
              'dirty',
              'submit',
              'reset',
              'added',
              'removed',
              'moved',
              'validators',
            ],
          },
          origin: { type: 'string', enum: ['user', 'code', 'devtools', 'binding', 'agent'] },
          since: { type: 'number', description: 'Only events after this marker.' },
          limit: { type: 'number', description: 'Max events (default 50, max 200).' },
          page: formPageProperty,
        },
      },
      handler: withForms(formHistoryText),
    });

    agent.registerTool({
      id: 'pangular:form-diff',
      description:
        'Net change of a form since a marker: each field whose value or status ended different, with from → to and how many changes happened in between. Get a marker from form-history, inspect-forms or a form-action result, act, then call this.',
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          form: formProperty,
          since: {
            type: 'number',
            description: 'Marker to diff from (default: everything buffered).',
          },
          page: formPageProperty,
        },
      },
      handler: withForms(formDiffText),
    });

    agent.registerTool({
      id: 'pangular:lint-forms',
      description:
        'Deterministic checks on live forms: stale validity after validator changes, stuck PENDING, unreachable submit, missing submission action, hidden fields still rendered, view out of sync with the model, [disabled] on reactive controls, required-but-unbound fields, NG01xxx setup errors, and model-aware accessibility (missing label, aria-invalid desync, required not exposed, error text not shown or not linked, no focus after invalid submit).',
      safety: 'read',
      inputSchema: { type: 'object', properties: { form: formProperty, page: formPageProperty } },
      handler: async (args: { form?: string; page?: string }) => {
        const state = formsState.value() as FormsState;
        if (!state.forms.length && !state.setupErrors?.length) return { markdown: noForms };
        const elsewhere = unknownFormPage(args);
        if (elsewhere) return elsewhere;
        return { markdown: lintFormsText(state, args ?? {}) };
      },
    });

    agent.registerTool({
      id: 'pangular:lint-pipes',
      description:
        'Deterministic checks on pipes found in source: an impure pipe used inside an @for block (runs every check, potentially once per row), `| json` left in a template (a debugging aid), a pure pipe whose transform() reads a signal (its memoization only tracks its own arguments, not signals it reads; zero-argument calls on injected services are reported at info level), and a method call piped to `| async`, like `getData() | async` (a new Observable per check makes AsyncPipe resubscribe every time).',
      safety: 'read',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => ({ markdown: lintPipesText(ctx.cwd) }),
    });

    agent.registerTool({
      id: 'pangular:explain-pipe',
      description:
        'Explain one pipe by name: where it is declared or used, whether it is pure, live instance/call counts and last input/output when instrumentation is on, an experimental stale-value warning, `| async` usages that resubscribe on every check (for `async`), and any lint findings. Use this to answer "why is this pipe slow or stale?"',
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'The pipe name as used after `|` in a template.' },
        },
        required: ['name'],
      },
      handler: async (args: { name?: string }) => {
        if (!args?.name) return { markdown: 'Pass a pipe `name`.' };
        return { markdown: explainPipeText(args.name, ctx.cwd, pipesState.value() as PipesState) };
      },
    });

    agent.registerTool({
      id: 'pangular:explain-custom-control',
      description:
        'Explain how a field is bound to its element (built-in accessor, custom ControlValueAccessor, custom control, [formField]) and what is wrong with it: value drift, missing setDisabledState, touched never set, captured NG01xxx setup errors.',
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: { form: formProperty, path: pathProperty, page: formPageProperty },
      },
      handler: withForms(explainCustomControlText),
    });

    agent.registerTool({
      id: 'pangular:export-form',
      description:
        'Export a form as a JSON snapshot (tree, status, raw value) or as a test fixture (setValue / signal model plus the expected status) with a repro header. Secret values stay [redacted].',
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          form: formProperty,
          format: { type: 'string', enum: ['snapshot', 'fixture'] },
          page: formPageProperty,
        },
      },
      handler: withForms(exportFormText),
    });

    agent.registerTool({
      id: 'pangular:wait-for-form',
      description:
        'Wait until a form is settled (no pending async validation, debounce or submit in flight), valid, not pending, or submitted after a marker. Resolves as soon as the condition holds, or reports the state on timeout.',
      safety: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          form: formProperty,
          until: { type: 'string', enum: ['settled', 'valid', 'not-pending', 'submitted'] },
          since: { type: 'number', description: 'Marker for `submitted`.' },
          timeoutMs: { type: 'number', description: 'Default 5000, max 30000.' },
          page: formPageProperty,
        },
      },
      handler: async (args: {
        form?: string;
        until?: WaitUntil;
        since?: number;
        timeoutMs?: number;
        page?: string;
      }) => {
        const elsewhere = unknownFormPage(args);
        if (elsewhere) return elsewhere;
        const timeout = Math.min(Math.max(Number(args?.timeoutMs) || 5000, 100), 30_000);
        const start = Date.now();
        while (true) {
          const state = formsState.value() as FormsState;
          if (waitSatisfied(state, args ?? {})) {
            return {
              markdown: `Condition \`${args?.until ?? 'settled'}\` holds after ${Date.now() - start}ms. Marker: ${latestMarker(state)}.\n\n${explainFormsText(state, { form: args?.form, page: args?.page })}`,
            };
          }
          if (Date.now() - start >= timeout) {
            return {
              markdown: `Timed out after ${timeout}ms waiting for \`${args?.until ?? 'settled'}\`.\n\n${explainFormsText(state, { form: args?.form, page: args?.page })}`,
            };
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      },
    });

    const actionText = (result: Record<string, unknown>, state: FormsState) => {
      const lines = [
        result['ok']
          ? `Done: ${String(result['message'] ?? '')}`
          : `Refused: ${String(result['error'] ?? result['message'] ?? 'failed')}`,
      ];
      const skipped = Array.isArray(result['skipped'])
        ? (result['skipped'] as { path: string; reason: string }[])
        : [];
      if (skipped.length)
        lines.push(`Skipped: ${skipped.map((s) => `\`${s.path}\` ${s.reason}`).join('; ')}.`);
      if (typeof result['status'] === 'string') lines.push(`Form status now: ${result['status']}.`);
      const invalid = Array.isArray(result['invalid']) ? (result['invalid'] as string[]) : [];
      if (invalid.length)
        lines.push(`Fields with errors: ${invalid.map((p) => `\`${p || '(form)'}\``).join(', ')}.`);
      if (typeof result['expression'] === 'string') lines.push(`Console: ${result['expression']}`);
      if (typeof result['snapshot'] === 'string')
        lines.push(`Snapshot id: ${result['snapshot']} (use with restore).`);
      lines.push(
        `Marker: ${latestMarker(state)}. Call form-diff with since set to the marker you had before this action to see what changed.`,
      );
      return lines.join('\n');
    };

    agent.registerTool({
      id: 'pangular:form-action',
      description:
        'Act on a live form (dev mode). Actions: set-value (mode code or user; user goes through the input like typing), mark-touched, mark-untouched, mark-dirty, mark-pristine, touch-all, revalidate (Signal Forms: reloads async/HTTP validation), reset, enable, disable (reactive only), submit, focus, focus-first-invalid, store-as-global ($form in the page console), snapshot, restore, instrument (value true or false: record the calling code of form changes, validator changes and template updates per keystroke, shown by form-history). reset, submit and restore need confirm: true. Secret, hidden and readonly fields are never written; disabled reactive fields need force.',
      safety: 'action',
      inputSchema: {
        type: 'object',
        required: ['action', 'form'],
        properties: {
          action: {
            type: 'string',
            enum: [
              'set-value',
              'mark-touched',
              'mark-untouched',
              'mark-dirty',
              'mark-pristine',
              'touch-all',
              'revalidate',
              'reset',
              'enable',
              'disable',
              'submit',
              'focus',
              'focus-first-invalid',
              'store-as-global',
              'snapshot',
              'restore',
              'instrument',
            ],
          },
          form: { type: 'string', description: 'Full form id, e.g. Checkout.form@ab12.' },
          path: pathProperty,
          value: { description: 'New value for set-value.' },
          mode: { type: 'string', enum: ['code', 'user'] },
          confirm: { type: 'boolean' },
          force: { type: 'boolean' },
          snapshot: { type: 'string', description: 'Snapshot id for restore.' },
        },
      },
      handler: async (args: Record<string, unknown>) => {
        const state = formsState.value() as FormsState;
        if (!state.forms.length) return { markdown: noForms };
        const elsewhere = unknownFormPage(args);
        if (elsewhere) return elsewhere;
        const match = resolveForm(state.forms, str(args?.['form']));
        if (typeof match === 'string') return { markdown: match };
        const { form: _form, ...rest } = args;
        const result = await requestFormAction({ ...rest, formId: match.id });
        return { markdown: actionText(result, formsState.value() as FormsState) };
      },
    });

    agent.registerTool({
      id: 'pangular:fill-form',
      description:
        'Fill several fields at once, by dotted path, through the inputs like a user would (so parsing, dirty and touched run for real). Reports written and skipped fields (secret, hidden, readonly, disabled, missing, or a <select> with no option for the value) and the resulting status. A <select> value must equal the value of one of its options ([ngValue] or value); a multiple select takes an array. Optionally submits afterwards (needs confirm: true).',
      safety: 'action',
      inputSchema: {
        type: 'object',
        required: ['form', 'values'],
        properties: {
          form: { type: 'string', description: 'Full form id, e.g. Checkout.form@ab12.' },
          values: { type: 'object', description: 'Map of field path to value.' },
          mode: { type: 'string', enum: ['code', 'user'] },
          submit: { type: 'boolean' },
          confirm: { type: 'boolean' },
        },
      },
      handler: async (args: Record<string, unknown>) => {
        const state = formsState.value() as FormsState;
        if (!state.forms.length) return { markdown: noForms };
        const elsewhere = unknownFormPage(args);
        if (elsewhere) return elsewhere;
        const match = resolveForm(state.forms, str(args?.['form']));
        if (typeof match === 'string') return { markdown: match };
        const result = await requestFormAction({
          action: 'fill',
          formId: match.id,
          values: args['values'],
          mode: args['mode'],
          submit: args['submit'],
          confirm: args['confirm'],
        });
        return { markdown: actionText(result, formsState.value() as FormsState) };
      },
    });

    agent.registerTool({
      id: 'pangular:list-pages',
      description:
        'List the browser tabs and Angular Native apps that report live data to this server, newest first: page id, URL, platform (`browser` or `Angular Native`), seconds since the last report and which inspectors report. Pass a page id as `page` to the live tools to pick a page; without it they use the most recent page.',
      safety: 'read',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const urls = new Map<string, string>();
        for (const page of routerPages.values()) {
          if (page.snapshot?.url) urls.set(page.pageId, page.snapshot.url);
        }
        for (const page of httpPages.values()) urls.set(page.pageId, page.url);
        const platforms = new Map<string, string>();
        for (const page of componentPages.values()) {
          if (page.platform) platforms.set(page.pageId, page.platform);
        }
        const withUrl = <T extends { pageId: string; reportedAt: number }>(pages: Iterable<T>) =>
          [...pages].map((page) => ({
            pageId: page.pageId,
            reportedAt: page.reportedAt,
            url: urls.get(page.pageId),
            platform: platforms.get(page.pageId),
          }));
        const pages = summarizePages({
          components: withUrl(componentPages.values()),
          signals: withUrl([...signalPages].map(([pageId, entry]) => ({ pageId, ...entry }))),
          injectors: withUrl(injectorPages.values()),
          ngrx: withUrl(ngrxPages.values()),
          forms: withUrl(formPages.values()),
          router: withUrl(routerPages.values()),
          pipes: withUrl(pipePages.values()),
          http: withUrl(httpPages.values()),
        });
        return { markdown: listPagesText(pages) };
      },
    });

    if (on.analog) {
      await registerAnalog(my as never, { cwd: ctx.cwd, agent } as never, {
        blockCalls: config.actions.analog ? undefined : actionBlockedMessage('analog'),
        owner: ctx,
        ttl: liveTtl,
      });
    }
    registerHubDocks(ctx, 'pangular', config);
  },
});

export interface PangularHostOptions {
  /**
   * Register the agent tools and resources that need a connected page. Off
   * for the stdio MCP server, which no page can reach.
   */
  pageTools?: boolean;
}

export function createPangular(options: PangularConfig = {}, host: PangularHostOptions = {}) {
  const warning = pangularConfigWarning(options);
  if (warning) console.warn(warning);
  const config = resolvePangularConfig(options);
  return defineDevframe({
    ...pangular,
    setup: (ctx, info) => {
      const withConfig: SetupInfo = { ...info, config, pageTools: host.pageTools };
      return pangular.setup(ctx, withConfig);
    },
  });
}

export default pangular;
