import type { DevframeSetupInfo, RemoteAssets } from 'devframe';
import { defineDevframe } from 'devframe';
import { createSharedState } from 'devframe/utils/shared-state';
import { PANGULAR_LOGO_DATA_URI } from './brand.ts';
import { getRoutes } from './rpc/get-routes.ts';
import { getComponents } from './rpc/get-components.ts';
import { getPipes } from './rpc/get-pipes.ts';
import {
  capacitorCallsText,
  capacitorPluginsText,
  expireCapacitorPages,
  mergeCapacitorReport,
  patchCapacitorState,
  syncCapacitorState,
  toCapacitorReport,
  type CapacitorPage,
  type CapacitorState,
} from './rpc/capacitor-tools.ts';
import { forBlocksText } from './rpc/for-blocks-tools.ts';
import {
  HYDRATION_DESCRIPTION,
  HYDRATION_OVERLAY_DESCRIPTION,
  hydrationOverlayText,
  hydrationText,
} from './rpc/hydration-tools.ts';
import { registerConsoleGlobals } from './rpc/console-globals.ts';
import { registerErrors } from './rpc/errors-register.ts';
import { registerSnapshot } from './rpc/snapshot-tools.ts';
import { registerLeaks } from './rpc/leaks-register.ts';
import { registerReduxStores } from './rpc/redux-stores-register.ts';
import { registerTanstackQuery } from './rpc/query-register.ts';
import { registerPlugins } from './rpc/plugins-register.ts';
import { registerStartup } from './rpc/startup-register.ts';
import type { PangularServerPlugin } from './plugin.ts';
import { registerAudit } from './rpc/audit-register.ts';
import { inspectProvidersText } from './rpc/injector-tools.ts';
import { registerInjectionExplain } from './rpc/injection-explain.ts';
import { sanitizeInjectorTree } from './rpc/injector-report.ts';
import { createFrameworkNames, markFramework } from './rpc/framework-tokens.ts';
import { lintPipes, lintPipesText } from './rpc/pipe-lint.ts';
import { cachedPipeLint } from './rpc/pipe-lint-cache.ts';
import { templateLintTool } from './rpc/template-lint-tool.ts';
import { explainPipeOnPage, pipeRecordRequest, pipeRecordText } from './rpc/pipes-agent.ts';
import { createPageOwners } from './rpc/page-owners.ts';
import { trackPageSessions } from './rpc/page-sessions.ts';
import { getBuildMeta } from './rpc/build-meta.ts';
import { createOpenInEditor, defaultLauncher } from './rpc/open-in-editor.ts';
import { servedAnalogRoot } from './rpc/analog-scan.ts';
import { getSignals } from './rpc/get-signals.ts';
import { SIGNAL_TOOL_MAX, signalGraphText, type InspectSignalsArgs } from './rpc/signal-tools.ts';
import { createSignalPeeks } from './rpc/signal-peeks.ts';
import {
  signalWatchRequest,
  watchSignalRequests,
  watchSignalText,
  type WatchSignalArgs,
} from './rpc/signal-watch-tools.ts';
import { injectorMatches, isEnvironmentRequest, signalOwner } from './signal-graph.ts';
import { getProviders } from './rpc/get-providers.ts';
import { getNgrxStore, scanNgrxStore } from './rpc/get-ngrx-store.ts';
import { createNgrxHistory } from './rpc/ngrx-session-tools.ts';
import { createProviderValues } from './rpc/provider-values.ts';
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
  directiveHostText,
  expireComponentPages,
  findComponents,
  isComponentReport,
  latestComponentPage,
  otherMatchesText,
  toComponentPage,
  truncationText,
} from './rpc/component-tools.ts';
import { LIST_COMPONENTS_DESCRIPTION, listComponentsText } from './rpc/component-outline.ts';
import { inspectComponentText } from './rpc/component-detail-text.ts';
import { createComponentEdits } from './rpc/component-edits.ts';
import { createComponentValues, valueResultText } from './rpc/component-values.ts';
import { parsePath } from './component-edit.ts';
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
  UNTRUSTED,
  untrusted,
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
  pipeInstrumentRequest,
  type PipePageReport,
  type PipesState,
} from './rpc/pipes-tools.ts';
import {
  clearRouterNavigations,
  currentRouter,
  expireRouterPages,
  explainNavigationText,
  inspectRouteText,
  isRouterReport,
  mergeRouterReport,
  noPage,
  routerActionText,
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
  MAX_DELAY_MS,
  sanitizeCalls,
  sanitizeRules,
  type HttpCall,
  type HttpRule,
} from './http-rules.ts';
import { sanitizeHydration, sanitizePayload, type PayloadSummary } from './http-payload.ts';
import { redactCall } from './http-redact.ts';
import { redactMessage, redactUrl } from './router.ts';
import { isSsrRequestId, ssrRegistry } from './ssr-registry.ts';
import { sanitizeSsrOverrides, type SsrOverride } from './ssr-overrides.ts';
import { ssrOverrideTools } from './rpc/ssr-override-tools.ts';
import { createComponentScreenshots } from './rpc/component-screenshots.ts';
import { explainSsrRequestText, listSsrRequestsText, sanitizeSsrRequest } from './rpc/ssr-tools.ts';
import { listHttpCallsText } from './rpc/http-tools.ts';
import { httpWaterfallText, type HttpWaterfallArgs } from './rpc/http-waterfall.ts';
import {
  httpRulesText,
  removeHttpRule,
  ruleChangeText,
  upsertHttpRule,
  type RuleChange,
  type SetHttpRuleArgs,
} from './rpc/http-rule-tools.ts';
import {
  cdOptionsText,
  cdUnknownPageText,
  cdViewsAsked,
  cdViewsText,
  changeDetectionText,
  expireCdPages,
  pickCdPage,
  toCdPage,
  type CdPage,
  type CdState,
} from './rpc/cd-tools.ts';
import { cdExportText } from './rpc/cd-export-tools.ts';
import { cdDiagnosisText } from './rpc/cd-diagnosis-tools.ts';
import { toCdOptionsRequest } from './cd-data.ts';
import type { HttpPage, HttpPayloadState, HttpReport, HttpState } from './types.ts';

import { analogPages, nameServerFns, registerAnalog } from './rpc/analog-register.ts';
import { clearCalls } from './analog-server-log.ts';
import { createPageVisibility } from './rpc/page-ttl.ts';
import {
  createAngularPages,
  sanitizeAngularReport,
  unsupportedToolText,
} from './rpc/angular-pages.ts';
import {
  PAGE_ARGUMENT,
  byRecency,
  listPagesText,
  pageArgument,
  choosePageText,
  nativeAppName,
  needsDomText,
  pageDetails,
  summarizePages,
  unknownPageText,
} from './rpc/pages.ts';
import { LIVE_RESOURCE_NOTE, liveResourceText } from './rpc/resource-text.ts';
import { trackHubDocks } from './hub-dock-status.ts';
import { createHubFeed } from './hub-messages.ts';
import { PANEL_COMMAND_EVENT, registerHubCommands } from './hub-commands.ts';
import {
  OPEN_IN_PANEL_DESCRIPTION,
  OPEN_IN_PANEL_EVENT,
  openInPanel,
} from './rpc/open-in-panel.ts';
import { clip } from './text.ts';
import { setRedaction } from './forms-privacy.ts';
import {
  FORM_WRITE_ACTIONS,
  FORMLESS_FORM_ACTIONS,
  PANGULAR_CONFIG_KEY,
  ROUTER_WRITE_ACTIONS,
  actionBlockedMessage,
  agentAllowed,
  agentSafety,
  agentTags,
  angularUnavailableText,
  enabledPanelTabs,
  isPageAgentEntry,
  pangularConfigWarning,
  resolvePangularConfig,
  rpcAllowed,
  type PangularConfig,
  type PangularInspector,
  type ResolvedPangularConfig,
} from './config.ts';

export * from './config.ts';
export {
  definePangularServerPlugin,
  type PangularPluginPage,
  type PangularPluginTool,
  type PangularPluginToolContext,
  type PangularServerPlugin,
  type PangularServerPluginContext,
  type PluginActionResult,
} from './plugin.ts';

import { registerAuthTokens } from './auth-tokens.ts';
import {
  BROWSER_TOOLS_CHANGED,
  BROWSER_TOOLS_STATE,
  createBrowserToolsSwitch,
  registerBrowserTools,
  type BrowserToolHost,
} from './rpc/browser-tools.ts';
import pkg from '../package.json' with { type: 'json' };
import { INTEREST_TICK_MS, createPageInterest, leased } from './rpc/page-interest.ts';
import { createReportDeltas, deltaPush } from './rpc/report-deltas.ts';
import {
  CHANGE_DETECTION_SHAPE,
  COMPONENT_TREE_SHAPE,
  FORMS_SHAPE,
  INJECTOR_TREE_SHAPE,
} from './push-delta.ts';
import { MARKDOWN_OUTPUT_SCHEMA } from './rpc/agent-output.ts';
import { createWaitForTool } from './rpc/wait-for.ts';

type CapacitorToolArgs = {
  page?: string;
  plugin?: string;
  failed?: boolean;
  slowMs?: number;
  limit?: number;
};

type PageGraph = SignalGraph & { pageId?: string };

const ENV_WAIT_MS = 1500;
const AGENT_HIGHLIGHT_MS = 2000;

const clientAssets: RemoteAssets = {
  package: pkg.name,
  version: pkg.version,
  path: 'dist/public',
  resolveFrom: import.meta.url,
};

type SetupInfo = DevframeSetupInfo & {
  config?: ResolvedPangularConfig;
  pageTools?: boolean;
  serverPlugins?: readonly PangularServerPlugin[];
};

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
    const agentExposed = (entry: { id: string }) =>
      agentAllowed(entry, config) && (pageTools || !isPageAgentEntry(entry.id));
    setRedaction(config.redaction);
    const on = config.inspectors;
    const limits = config.limits;
    const my = ctx.scope('pangular');
    (ctx.staticConfig as Record<string, unknown>)[PANGULAR_CONFIG_KEY] = config;
    const register: typeof my.rpc.register = (definition) => {
      if (!rpcAllowed(definition.name, config)) return;
      const exposed = !definition.agent || agentAllowed({ id: definition.name }, config);
      if (!exposed) return my.rpc.register({ ...definition, agent: undefined });
      const agent = definition.agent && { ...definition.agent, tags: agentTags(definition.name) };
      my.rpc.register(agent ? { ...definition, agent } : definition);
    };
    // Agent writes, NG errors and hydration mismatches, posted to the hub's messages.
    const feed = createHubFeed(ctx, config);
    const agent = {
      registerTool: (tool: Parameters<typeof ctx.agent.registerTool>[0]) => {
        // The tier and the tags come from the tool's entry in AGENT_ENTRIES, so
        // the config is the one place that sets them.
        if (agentExposed(tool))
          ctx.agent.registerTool(
            feed.wrapTool({
              ...tool,
              safety: agentSafety(tool.id, config),
              tags: agentTags(tool.id),
              handler: leased(() => interest, tool.handler),
            }),
          );
      },
      registerResource: (resource: Parameters<typeof ctx.agent.registerResource>[0]) => {
        if (agentExposed(resource))
          ctx.agent.registerResource({ ...resource, read: leased(() => interest, resource.read) });
      },
    };

    register(getRoutes);
    register(getComponents);
    register(getPipes);
    register(getSignals);
    register(getProviders);
    register(getNgrxStore);
    register(getBuildMeta);
    register({
      name: 'open-in-editor',
      type: 'action',
      jsonSerializable: true,
      handler: createOpenInEditor({
        // The served app can live in a subfolder (an Nx app, an Analog example),
        // and its scans report paths from there.
        roots: () => [ctx.workspaceRoot, ctx.cwd, servedAnalogRoot(ctx.cwd)],
        launch: defaultLauncher(ctx.services),
      }),
    });

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
    // One connection owns each page id, so one tab (or a stray client) can't
    // overwrite or forget the pages another one reports.
    const owners = createPageOwners(ctx.rpc, liveTtl);
    const owns = (pageId: unknown): pageId is string =>
      typeof pageId === 'string' && owners.write(pageId);
    // A request is settled only by the page it was sent to, from the connection
    // that owns that page, so another client can't answer for it.
    const answersFor = (target: string | undefined, pageId: unknown) =>
      (target === undefined || pageId === target) && owns(pageId);

    // Pages push their heavy reports only while a panel or an agent watches.
    const interest = createPageInterest({
      rpcHost: ctx.rpc,
      leaseMs: limits.idleAfterMs,
      hidden: (pageId) => visibility.has(pageId),
      broadcast: (message) =>
        void my.rpc
          .broadcast({ method: 'page-interest-changed', args: [message], optional: true })
          ?.catch?.(() => {}),
    });
    register({
      name: 'page-interest',
      type: 'action',
      jsonSerializable: true,
      handler: (message: unknown) => interest.handle(message),
    });
    const interestTick = setInterval(() => interest.tick(), INTEREST_TICK_MS);
    interestTick.unref?.();
    // A page that left is not waited for when an agent wakes the pages.
    const mayForget = (pageId: unknown): pageId is string => {
      if (typeof pageId !== 'string' || !owners.forget(pageId)) return false;
      interest.forget(pageId);
      return true;
    };

    // The `read` agent tools, for the page to register with browser agents.
    // `agent.browserTools` sets where the switch starts; the panel's Settings
    // flips it for every page until the server restarts.
    const browserToolsState = await my.rpc.sharedState(BROWSER_TOOLS_STATE, {
      initialValue: { enabled: config.agent.browserTools, config: config.agent.browserTools },
    });
    const browserToolsSwitch = createBrowserToolsSwitch(config.agent.browserTools, (state) => {
      browserToolsState.mutate((draft) => {
        draft.enabled = state.enabled;
        draft.config = state.config;
      });
      void my.rpc
        .broadcast({ method: BROWSER_TOOLS_CHANGED, args: [state], optional: true })
        ?.catch?.(() => {});
    });
    registerBrowserTools(register, ctx as unknown as BrowserToolHost, {
      enabled: browserToolsSwitch.enabled,
      owns,
      switch: browserToolsSwitch,
    });

    let onPageClaimed = (_pageId: string) => {};
    register({
      name: 'claim-page',
      type: 'action',
      jsonSerializable: true,
      handler: (message: { pageId?: unknown; key?: unknown } | null) => {
        const pageId = message?.pageId;
        if (typeof pageId !== 'string' || !pageId || pageId.length >= 50) return { ok: false };
        const ok = owners.claim(pageId, message?.key);
        // The overlay claims once per load: what the audit holds of the old document is stale.
        if (ok) onPageClaimed(pageId);
        return { ok };
      },
    });

    register({
      name: 'report-page-visibility',
      type: 'action',
      jsonSerializable: true,
      handler: (report: { pageId?: unknown; hidden?: unknown } | null) => {
        const pageId = report?.pageId;
        if (typeof pageId !== 'string' || !pageId || pageId.length >= 50) return;
        if (!owners.write(pageId)) return;
        if (visibility.set(pageId, report?.hidden === true)) applyVisibility();
      },
    });

    // Each page's Angular version and debug API parts, so a view can say why it is empty.
    const angularPages = createAngularPages();
    const pageAngularState = await my.rpc.sharedState('page-angular', {
      initialValue: angularPages.snapshot(),
    });
    const applyAngularPages = () =>
      pageAngularState.mutate((draft) => {
        draft.pages = angularPages.snapshot().pages;
      });
    register({
      name: 'report-page-angular',
      type: 'action',
      jsonSerializable: true,
      handler: (report: unknown) => {
        const info = sanitizeAngularReport(report);
        if (!info || !owns(info.pageId)) return;
        if (angularPages.set(info)) applyAngularPages();
      },
    });
    register({
      name: 'forget-page-angular',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        if (mayForget(pageId) && angularPages.forget(pageId)) applyAngularPages();
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
    // What each page's next delta builds on (`push-delta.ts`).
    const componentDeltas = createReportDeltas(COMPONENT_TREE_SHAPE);
    const injectorDeltas = createReportDeltas(INJECTOR_TREE_SHAPE);
    const cdDeltas = createReportDeltas(CHANGE_DETECTION_SHAPE);
    const formDeltas = createReportDeltas(FORMS_SHAPE);
    const applyComponentPages = () =>
      componentTree.mutate((draft) => {
        draft.pages = Object.fromEntries(componentPages);
        draft.nodes = latestComponentPage(componentPages.values())?.roots ?? [];
      });
    const componentWaiters = new Set<() => void>();
    // `console` marks a selection made in the panel, which sets `$ng0` on that page.
    const selectComponentOnPage = (
      pageId: string | undefined,
      id: string | null,
      console = false,
    ) => {
      componentTree.mutate((draft) => {
        draft.selectedId = id;
      });
      void my.rpc.broadcast({
        method: 'inspect-component-in-page',
        args: [{ pageId, id, ...(console && pageId ? { console: true } : {}) }],
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
    const signalPeeks = createSignalPeeks();

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
    // Token names from the installed @angular/* packages mark framework providers and injectors.
    const withFramework = (page: InjectorPage, names: ReadonlySet<string>): InjectorPage => ({
      ...page,
      roots: markFramework(page.roots, names),
      environment: markFramework(page.environment, names),
    });
    const frameworkNames = createFrameworkNames(
      () => [ctx.cwd, ctx.workspaceRoot],
      (names) => {
        if (!injectorPages.size) return;
        for (const [id, page] of injectorPages) injectorPages.set(id, withFramework(page, names));
        applyInjectorPages();
      },
    );
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
        draft.pagesReportedAt = next.pagesReportedAt ?? {};
        draft.setupErrors = next.setupErrors ?? [];
        draft.instrumented = next.instrumented ?? [];
        draft.dropped = next.dropped ?? {};
        draft.webMcp = next.webMcp ?? [];
      });

    register({
      name: 'push-forms',
      type: 'action',
      jsonSerializable: true,
      handler: deltaPush(formDeltas, owns, (report) => {
        if (!isPageReport(report) || !owns(report.pageId)) return false;
        applyForms(
          mergePageReport(
            formPages,
            report,
            Date.now(),
            limits.formTimeline,
            visibility.ttl(FORMS_PAGE_TTL_MS),
          ),
        );
        feed.ngErrors(report.pageId, 'forms', report.setupErrors ?? []);
        return true;
      }),
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
        if (next.asyncTotal === undefined) delete draft.asyncTotal;
        else draft.asyncTotal = next.asyncTotal;
        if (next.pages === undefined) delete draft.pages;
        else draft.pages = next.pages;
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
        if (!isPipePageReport(report) || !owns(report.pageId)) return;
        pipeSessions.bind(report.pageId);
        applyPipes(mergePipePageReport(pipePages, report, Date.now(), liveTtl));
      },
    });

    register({
      name: 'forget-pipes-page',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: string) => {
        if (!mayForget(pageId)) return;
        pipeSessions.unbind(pageId);
        if (pipePages.delete(pageId)) {
          applyPipes(currentPipes(pipePages));
        }
      },
    });

    // Shared by the panel's Record calls button and the record-pipes agent tool.
    const requestPipeRecording = (message: unknown) => {
      const request = pipeInstrumentRequest(message, pipePages);
      // No page has reported yet: starting now would patch every connected tab.
      if (request.on && !request.pageId) return { request, pages: { pages: 0 } };
      void my.rpc.broadcast({ method: 'instrument-pipes', args: [request], optional: true });
      if (!request.pageId) return { request, pages: { pages: pipePages.size } };
      return { request, pages: { pages: pipePages.has(request.pageId) ? 1 : 0 } };
    };

    register({
      name: 'request-instrument-pipes',
      type: 'action',
      jsonSerializable: true,
      handler: (message: unknown) => requestPipeRecording(message).pages,
    });

    register({
      name: 'pipe-lint',
      type: 'query',
      jsonSerializable: true,
      // A source scan like get-pipes, so a static report bakes it in too.
      snapshot: true,
      handler: () => lintPipes(ctx.cwd),
    });

    const capacitorPages = new Map<string, CapacitorPage>();
    // With patches on, a push sends the panel what changed, not every page:
    // devframe's own shared states send the whole value on each change.
    const capacitorShared = await my.rpc.sharedState('capacitor', {
      sharedState: createSharedState<CapacitorState>({
        initialValue: { pages: {} },
        enablePatches: true,
      }),
    });
    const applyCapacitor = () =>
      capacitorShared.mutate((draft) => syncCapacitorState(draft, capacitorPages));
    const capacitorSessions = trackPageSessions(ctx.rpc, (pageIds) => {
      let removed = false;
      for (const pageId of pageIds) removed = capacitorPages.delete(pageId) || removed;
      if (removed) applyCapacitor();
    });

    register({
      name: 'push-capacitor',
      type: 'action',
      jsonSerializable: true,
      handler: (message: unknown) => {
        const report = toCapacitorReport(message);
        if (!report || !owns(report.pageId)) return { known: true };
        capacitorSessions.bind(report.pageId);
        const answer = mergeCapacitorReport(capacitorPages, report, limits.capacitorCalls);
        if (answer.known) {
          capacitorShared.mutate((draft) => patchCapacitorState(draft, capacitorPages, report));
        }
        return answer;
      },
    });

    register({
      name: 'forget-capacitor-page',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: string) => {
        if (!mayForget(pageId)) return;
        capacitorSessions.unbind(pageId);
        if (capacitorPages.delete(pageId)) applyCapacitor();
      },
    });

    const errorsInspector = on.errors
      ? await registerErrors({
          my,
          rpcHost: ctx.rpc,
          register,
          agent,
          owns,
          mayForget,
          ttl: liveTtl,
        })
      : null;
    const leaksInspector = on.components
      ? await registerLeaks({
          my,
          rpcHost: ctx.rpc,
          register,
          agent,
          owns,
          mayForget,
          ttl: liveTtl,
        })
      : null;
    const startupInspector = on.injectors
      ? await registerStartup({
          my,
          rpcHost: ctx.rpc,
          register,
          agent,
          owns,
          mayForget,
          ttl: liveTtl,
        })
      : null;
    // A plugin tool's tier comes from the plugin; `pluginToolAllowed` checks it against the config.
    const pluginsInspector = on.plugins
      ? await registerPlugins({
          my,
          rpcHost: ctx.rpc,
          config,
          register,
          agent,
          registerPluginTool: (tool, safety) =>
            ctx.agent.registerTool(
              feed.wrapTool({
                ...(tool as Parameters<typeof ctx.agent.registerTool>[0]),
                safety,
                tags: agentTags(String(tool['id'])),
                handler: leased(() => interest, tool['handler']),
              }),
            ),
          pageTools,
          owns,
          mayForget,
          ttl: liveTtl,
          serverPlugins: info?.serverPlugins,
        })
      : null;

    const reduxStores = on.ngrx
      ? await registerReduxStores({
          my,
          rpcHost: ctx.rpc,
          register,
          agent,
          owns,
          mayForget,
          ttl: liveTtl,
          maxLog: limits.changeLog,
        })
      : null;
    const tanstackQuery = on.tanstackQuery
      ? await registerTanstackQuery({
          my,
          rpcHost: ctx.rpc,
          register,
          agent,
          owns,
          mayForget,
          answersFor,
          ttl: liveTtl,
          writes: config.actions.tanstackQuery,
          blocked: actionBlockedMessage('tanstackQuery'),
        })
      : null;

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
        if (!owns(report.pageId)) return { hasConfig: true };
        try {
          applyRouter(
            mergeRouterReport(routerPages, report, Date.now(), visibility.ttl(ROUTER_PAGE_TTL_MS)),
          );
        } catch {
          routerPages.delete(report.pageId);
          applyRouter(currentRouter(routerPages));
        }
        feed.navigations(report.pageId, report.navigations);
        return { hasConfig: !!routerPages.get(report.pageId)?.config };
      },
    });

    register({
      name: 'ping-router',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        if (!owns(pageId) || !touchRouterPage(routerPages, pageId)) return { known: false };
        const reportedAt = routerPages.get(pageId as string)!.reportedAt;
        routerState.mutate((draft) => {
          const page = draft.pages.find((p) => p.pageId === pageId);
          if (page) page.reportedAt = reportedAt;
        });
        return { known: true };
      },
    });

    const pendingActions = new Map<
      string,
      { pageId: string | undefined; settle: (result: unknown) => void }
    >();
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
          resolve({
            error:
              'No page answered within 15s. Is the app open in a browser, or the device app in the foreground?',
          });
        }, 15_000);
        timer.unref?.();
        pendingActions.set(requestId, {
          pageId,
          settle: (result) => {
            clearTimeout(timer);
            pendingActions.delete(requestId);
            resolve(result);
          },
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
      handler: (message: { requestId?: unknown; pageId?: unknown; result?: unknown }) => {
        if (typeof message?.requestId !== 'string') return;
        const pending = pendingActions.get(message.requestId);
        if (pending && answersFor(pending.pageId, message.pageId)) pending.settle(message.result);
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
      name: 'clear-router-navigations',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        if (!config.actions.router) throw new Error(actionBlockedMessage('router'));
        if (typeof pageId !== 'string') throw new Error('Give the id of the page to clear.');
        if (clearRouterNavigations(routerPages, pageId)) applyRouter(currentRouter(routerPages));
        void my.rpc.broadcast({ method: 'router-clear', args: [{ pageId }], optional: true });
      },
    });

    register({
      name: 'forget-router-page',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: string) => {
        if (mayForget(pageId) && routerPages.delete(pageId)) {
          applyRouter(currentRouter(routerPages));
        }
      },
    });

    const httpPages = new Map<string, HttpPage>();
    const registry = httpRegistry();
    registry.dispose?.();
    registry.rules = on.http && config.actions.http ? (registry.rules ?? []) : [];
    const httpState = await my.rpc.sharedState('http', {
      initialValue: {
        serverCalls: [],
        requests: [],
        pages: [],
        rules: [...registry.rules],
        ssrOverrides: [],
      } as HttpState,
    });
    // Overrides change server responses, so they live only while this server runs.
    ssrRegistry().overrides = [];
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
    const ssr = ssrRegistry();
    ssr.record = on.http
      ? (raw) => {
          const request = sanitizeSsrRequest(raw);
          if (!request) return;
          // Server calls are batched, so flush them first to keep their order.
          if (flushTimer) {
            clearTimeout(flushTimer);
            flushServerCalls();
          }
          httpState.mutate((draft) => {
            draft.requests.push(request);
            const extra = draft.requests.length - limits.httpCalls;
            if (extra > 0) draft.requests.splice(0, extra);
          });
        }
      : undefined;
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
      if (!pageIds.filter((id) => httpPayloads.delete(id)).length) return;
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
        if (page.pageId.length >= 50 || !owns(page.pageId)) return;
        const known = httpPages.get(page.pageId);
        const url = redactUrl(page.url);
        const hasPayload = page.payload !== undefined;
        if (!hasPayload && !known) return { needPayload: true };
        const calls = sanitizeCalls(page.calls, limits.httpCalls).map(redactCall);
        httpPages.set(page.pageId, {
          pageId: page.pageId,
          url,
          initialUrl: typeof page.initialUrl === 'string' ? redactUrl(page.initialUrl) : url,
          title:
            typeof page.title === 'string'
              ? redactMessage(page.title.slice(0, 2000)).slice(0, 200)
              : '',
          hydration: sanitizeHydration(page.hydration),
          calls:
            page.full === false && known
              ? [...known.calls, ...calls].slice(-limits.httpCalls)
              : calls,
          dropped:
            typeof page.dropped === 'number' && page.dropped > 0 ? Math.floor(page.dropped) : 0,
          ...(isSsrRequestId(page.ssrRequestId)
            ? { ssrRequestId: page.ssrRequestId }
            : known?.ssrRequestId
              ? { ssrRequestId: known.ssrRequestId }
              : {}),
          firstSeenAt: known?.firstSeenAt ?? Date.now(),
          reportedAt: Date.now(),
        });
        applyHttpPages();
        feed.hydration(page.pageId, httpPages.get(page.pageId)?.hydration);
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
        const page = owns(pageId) ? httpPages.get(pageId) : undefined;
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
        if (mayForget(pageId) && httpPages.has(pageId)) forgetHttpPages([pageId]);
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

    const saveSsrOverrides = (overrides: SsrOverride[]) => {
      ssrRegistry().overrides = overrides;
      httpState.mutate((draft) => {
        draft.ssrOverrides = overrides;
      });
      return overrides;
    };
    register({
      name: 'set-ssr-overrides',
      type: 'action',
      jsonSerializable: true,
      handler: (input: unknown) => {
        if (!config.actions.http) throw new Error(actionBlockedMessage('http'));
        return saveSsrOverrides(sanitizeSsrOverrides(input));
      },
    });
    // The panel's TransferState payload and SSR overrides, for agents.
    for (const tool of ssrOverrideTools({
      config,
      overrides: () => ssrRegistry().overrides ?? [],
      save: saveSsrOverrides,
      payloads: () => httpPayloads,
      pages: () => httpPages.values(),
    }))
      agent.registerTool(tool);

    const clearHttpCalls = () => {
      if (!config.actions.http) throw new Error(actionBlockedMessage('http'));
      pendingServerCalls = [];
      pendingDropped = 0;
      for (const [id, page] of httpPages) httpPages.set(id, { ...page, calls: [], dropped: 0 });
      httpState.mutate((draft) => {
        draft.serverCalls = [];
        draft.serverDropped = 0;
        draft.requests = [];
        draft.pages = [...httpPages.values()].sort((a, b) => a.firstSeenAt - b.firstSeenAt);
      });
      void my.rpc.broadcast({ method: 'http-clear', args: [], optional: true });
    };

    register({
      name: 'clear-http-calls',
      type: 'action',
      jsonSerializable: true,
      handler: clearHttpCalls,
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
      if (angularPages.expire(liveTtl)) applyAngularPages();
      owners.expire();
      const staleHttp = [...httpPages].filter(([id, p]) => Date.now() - p.reportedAt > liveTtl(id));
      if (staleHttp.length) forgetHttpPages(staleHttp.map(([id]) => id));
      const stale = [...signalPages].filter(([id, p]) => Date.now() - p.reportedAt > liveTtl(id));
      if (stale.length) forgetSignalPages(stale.map(([id]) => id));
      if (expireComponentPages(componentPages, Date.now(), liveTtl)) applyComponentPages();
      if (expireCdPages(cdPages, Date.now(), liveTtl)) applyCd();
      for (const id of goneCdPages) {
        if (!componentPages.has(id) && !injectorPages.has(id)) goneCdPages.delete(id);
      }
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
      if (expireCapacitorPages(capacitorPages, Date.now(), liveTtl)) applyCapacitor();
      errorsInspector?.expire();
      leaksInspector?.expire();
      reduxStores?.expire();
      tanstackQuery?.expire();
      startupInspector?.expire();
      pluginsInspector?.expire();
      componentDeltas.prune((id) => componentPages.has(id));
      injectorDeltas.prune((id) => injectorPages.has(id));
      cdDeltas.prune((id) => cdPages.has(id));
      formDeltas.prune((id) => formPages.has(id));
      // A page that stopped reporting (a closed browser that never said
      // goodbye) is gone, so a wake doesn't wait for it. Forms are left out:
      // their reports outlive the page to keep the timeline.
      interest.prune(
        (id) =>
          owners.alive(id) || componentPages.has(id) || injectorPages.has(id) || cdPages.has(id),
      );
    }, 5000);
    expiry.unref?.();
    registry.owner = ctx;
    registry.dispose = () => {
      clearInterval(expiry);
      clearInterval(interestTick);
      pluginsInspector?.dispose();
      interest.stop();
      clearTimeout(flushTimer);
      registry.record = undefined;
      ssr.record = undefined;
      ssr.overrides = undefined;
    };

    const httpSnapshot = () => httpState.value() as HttpState;
    agent.registerTool({
      id: 'pangular:list-ssr-requests',
      title: 'List SSR requests',
      outputSchema: MARKDOWN_OUTPUT_SCHEMA,
      description:
        'Recent document requests that the Angular SSR server answered, traced by `devtools.ssrMiddleware` or `withPangularSsr()`: id, URL, status, render mode read from the HTML (Server, Prerender, Client), render time, how many server HttpClient calls the render made, and whether a connected page reported loading that response. Empty when neither is installed.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'How many requests to list (1-100, default 20).' },
        },
      },
      handler: async (args: { limit?: number }) => {
        const state = httpSnapshot();
        return { markdown: listSsrRequestsText(state.requests, state.pages, args) };
      },
    });

    agent.registerTool({
      id: 'pangular:explain-ssr-request',
      title: 'Explain an SSR request',
      description:
        'One SSR request from start to finish: status, render mode, render and fetch times, kept response headers, each server HttpClient call, then the browser page that loaded the response with its hydration result and any call the browser made again instead of reading the transfer cache. Picks the request by `id` (from list-ssr-requests), else the newest one for `url`, else the newest one.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Request id from list-ssr-requests.' },
          url: {
            type: 'string',
            description: 'Path and query of the page, such as /destinations.',
          },
        },
      },
      handler: async (args: { id?: string; url?: string }) => {
        const state = httpSnapshot();
        return {
          markdown: explainSsrRequestText(state.requests, state.serverCalls, state.pages, args),
        };
      },
    });

    agent.registerTool({
      id: 'pangular:list-http-calls',
      title: 'List HTTP calls',
      outputSchema: MARKDOWN_OUTPUT_SCHEMA,
      description:
        "The app's HttpClient calls recorded by `withPangular()`, newest first: side (SSR or client), method, URL, status, duration and flags (mocked or faulted by a rule, cancelled, transfer cache hit or skip, the matched rule). Without `page` it lists every reporting tab and the server; with `page` only that tab and the server render that served it. Secrets in URLs, errors, previews and headers are masked; `headers` adds each call's request and response headers. Empty when no page uses the interceptor.",
      inputSchema: {
        type: 'object',
        properties: {
          page: PAGE_ARGUMENT,
          url: { type: 'string', description: 'Only calls whose URL contains this text.' },
          failed: {
            type: 'boolean',
            description:
              'Only failed calls: status 400 or more, no response, an error, or cancelled.',
          },
          limit: { type: 'integer', description: 'How many calls to list (1-200, default 30).' },
          preview: {
            type: 'boolean',
            description: 'Add the masked response preview of each listed call.',
          },
          headers: {
            type: 'boolean',
            description: 'Add the masked request and response headers of each listed call.',
          },
        },
      },
      handler: async (args: {
        page?: string;
        url?: string;
        failed?: boolean;
        limit?: number;
        preview?: boolean;
        headers?: boolean;
      }) => ({
        markdown: listHttpCallsText(httpSnapshot(), { ...args, page: pageArgument(args) }),
      }),
    });

    agent.registerTool({
      id: 'pangular:http-waterfall',
      title: 'Show an HTTP waterfall',
      description:
        "One page's client HttpClient calls as a waterfall, grouped by navigation (a new group each time the page URL changes), newest navigation first: each call's start offset in its navigation, duration, status and a text bar. With `headers`, each call's request headers (as they reached `withPangular()`) and the response headers the app could read; `Authorization`, cookies, secret-looking names, JWTs and bearer tokens are masked. Empty when no page uses the interceptor.",
      inputSchema: {
        type: 'object',
        properties: {
          page: PAGE_ARGUMENT,
          limit: {
            type: 'integer',
            description: 'How many navigations to show, newest first (1-50, default 5).',
          },
          headers: {
            type: 'boolean',
            description: 'Add the masked request and response headers of each call.',
          },
        },
      },
      handler: async (args: HttpWaterfallArgs & Record<string, unknown>) => ({
        markdown: httpWaterfallText(httpSnapshot(), { ...args, page: pageArgument(args) }),
      }),
    });

    agent.registerTool({
      id: 'pangular:list-capacitor-calls',
      title: 'List Capacitor plugin calls',
      outputSchema: MARKDOWN_OUTPUT_SCHEMA,
      description:
        'List Capacitor plugin calls made by the app, newest first: plugin, method, bridge target (native vs web), arguments, result/error, and duration. Also includes active listeners and event counts. Filter by `plugin`, `failed` calls, or `slowMs`. Calls a web implementation answers are logged only when `@pangular-inspector/devtools/capacitor-hook` loads before @capacitor/core. Arguments, results, and errors are masked for privacy. Empty when no Capacitor app reports.',
      inputSchema: {
        type: 'object',
        properties: {
          page: PAGE_ARGUMENT,
          plugin: { type: 'string', description: 'Only calls to this plugin, such as Camera.' },
          failed: { type: 'boolean', description: 'Only calls that failed.' },
          slowMs: {
            type: 'integer',
            description: 'Only calls that took at least this many milliseconds.',
          },
          limit: { type: 'integer', description: 'How many calls to list (1-200, default 30).' },
        },
      },
      handler: async (args: CapacitorToolArgs) => ({
        markdown: capacitorCallsText(capacitorPages, { ...args, page: pageArgument(args) }),
      }),
    });

    agent.registerTool({
      id: 'pangular:list-capacitor-plugins',
      title: 'List Capacitor plugins',
      outputSchema: MARKDOWN_OUTPUT_SCHEMA,
      description:
        'The Capacitor environment of the app and its plugins: platform, server URL, whether CapacitorHttp and native logging are on, the WebView user agent, and each plugin with whether it is available on this platform, imported by the app, installed natively, and its native methods. Flags plugins the app imports that are not available (run `npx cap sync`) and native plugins the app does not import. Empty when no Capacitor app reports.',
      inputSchema: { type: 'object', properties: { page: PAGE_ARGUMENT } },
      handler: async (args: { page?: string }) => ({
        markdown: capacitorPluginsText(capacitorPages, { page: pageArgument(args) }),
      }),
    });

    const ruleInput = {
      id: { type: 'string', description: 'Rule id from list-http-rules. Leave out to add a rule.' },
      pattern: {
        type: 'string',
        description:
          'Part of the request URL, where `*` matches anything, such as /api/orders*. A leading `^` anchors it at the start of the path, such as ^/api/.',
      },
      method: { type: 'string', description: 'Only this method, such as GET. Any when left out.' },
      target: {
        type: 'string',
        enum: ['client', 'server', 'both'],
        description: 'Browser calls, SSR calls, or both (default).',
      },
      status: {
        type: 'integer',
        description:
          'Status to answer with: 400 or more fails the request, below 400 returns `body`.',
      },
      delayMs: { type: 'integer', description: `Hold the request back (0-${MAX_DELAY_MS} ms).` },
      body: { description: 'Mock response body: JSON text or a JSON value. Alone it answers 200.' },
      enabled: { type: 'boolean', description: 'Default true.' },
    };
    const newRuleId = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const httpRuleChange = (change: RuleChange, verb: 'Added' | 'Updated' | 'Removed') => {
      if (!config.actions.http) return { markdown: actionBlockedMessage('http') };
      if ('error' in change) return { markdown: change.error };
      setHttpRules(change.rules);
      return { markdown: ruleChangeText(verb, change.rule, change.rules) };
    };

    agent.registerTool({
      id: 'pangular:list-http-rules',
      title: 'List HTTP mock rules',
      outputSchema: MARKDOWN_OUTPUT_SCHEMA,
      description:
        'The HTTP fault and mock rules the panel or an agent set, in match order: id, on or off, method, URL pattern, whether it applies to browser calls, SSR calls or both, and its effect (fail with a status, answer with a status and mock body, delay). Rules apply to every connected tab and to the server. Patterns and bodies are masked like recorded calls. Empty when no rule is set.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => ({
        markdown: httpRulesText(registry.rules ?? [], config.actions.http),
      }),
    });

    agent.registerTool({
      id: 'pangular:set-http-rule',
      title: 'Set an HTTP mock rule',
      description:
        "Adds an HTTP fault or mock rule, or replaces the rule with `id`, the same way the panel's Fault injection form does (development only). `pattern` plus at least one of `status`, `delayMs` or `body`. The rule applies to every connected tab right away and to SSR on the next page load. Returns the saved rule list. Needs the HTTP write action (actions.http).",
      inputSchema: { type: 'object', properties: ruleInput, required: ['pattern'] },
      handler: async (args: SetHttpRuleArgs) => {
        const rules = registry.rules ?? [];
        const verb = typeof args.id === 'string' && args.id ? 'Updated' : 'Added';
        return httpRuleChange(upsertHttpRule(rules, args, newRuleId), verb);
      },
    });

    agent.registerTool({
      id: 'pangular:remove-http-rule',
      title: 'Remove an HTTP mock rule',
      description:
        'Removes the HTTP fault or mock rule with `id` (from list-http-rules) and returns the rules left. Needs the HTTP write action (actions.http).',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Rule id from list-http-rules.' } },
        required: ['id'],
      },
      handler: async (args: { id?: unknown }) =>
        httpRuleChange(removeHttpRule(registry.rules ?? [], args.id), 'Removed'),
    });

    agent.registerTool({
      id: 'pangular:clear-recordings',
      title: 'Clear recordings',
      description:
        'Clears recorded HTTP calls, router navigations, or Analog server calls between reproduction runs (development only). Specify `target` as "http", "router", "analog", or "all". An optional `page` clears only the navigations of that specific page.',
      inputSchema: {
        type: 'object',
        required: ['target'],
        properties: {
          target: {
            type: 'string',
            enum: ['http', 'router', 'analog', 'all'],
            description: 'Which recordings to clear: `http`, `router`, `analog`, or `all`.',
          },
          page: PAGE_ARGUMENT,
        },
      },
      handler: async (args: { target?: unknown; page?: string }) => {
        const target = typeof args?.target === 'string' ? args.target : undefined;
        if (!target || !['http', 'router', 'analog', 'all'].includes(target)) {
          throw new Error('Provide a valid target: "http", "router", "analog", or "all".');
        }

        const pageId = pageArgument(args as Record<string, unknown> | undefined);
        if (pageId && (target === 'router' || target === 'all') && !routerPages.has(pageId)) {
          return {
            markdown: unknownPageText(pageId, byRecency(routerPages.values()), 'a router report'),
          };
        }

        const cleared: string[] = [];
        const skipped: string[] = [];

        const httpEligible =
          config.actions.http && config.agent.tools.http && config.inspectors.http;
        if (target === 'http' || target === 'all') {
          if (!httpEligible) {
            const reason = !config.actions.http
              ? 'actions.http is turned off'
              : !config.agent.tools.http
                ? 'agent.tools.http is turned off'
                : 'inspectors.http is turned off';
            if (target === 'http') {
              if (!config.actions.http) throw new Error(actionBlockedMessage('http'));
              throw new Error(`HTTP recording is disabled in the devtools config (${reason}).`);
            }
            skipped.push(`HTTP calls (${reason})`);
          } else {
            clearHttpCalls();
            cleared.push('recorded HTTP calls');
          }
        }

        const routerEligible =
          config.actions.router && config.agent.tools.router && config.inspectors.router;
        if (target === 'router' || target === 'all') {
          if (!routerEligible) {
            const reason = !config.actions.router
              ? 'actions.router is turned off'
              : !config.agent.tools.router
                ? 'agent.tools.router is turned off'
                : 'inspectors.router is turned off';
            if (target === 'router') {
              if (!config.actions.router) throw new Error(actionBlockedMessage('router'));
              throw new Error(`Router recording is disabled in the devtools config (${reason}).`);
            }
            skipped.push(`router navigations (${reason})`);
          } else {
            if (pageId) {
              if (clearRouterNavigations(routerPages, pageId)) {
                applyRouter(currentRouter(routerPages));
              }
              void my.rpc.broadcast({ method: 'router-clear', args: [{ pageId }], optional: true });
              cleared.push(`router navigations for page "${pageId}"`);
            } else {
              for (const id of routerPages.keys()) {
                clearRouterNavigations(routerPages, id);
                void my.rpc.broadcast({
                  method: 'router-clear',
                  args: [{ pageId: id }],
                  optional: true,
                });
              }
              applyRouter(currentRouter(routerPages));
              cleared.push('router navigations');
            }
          }
        }

        const analogEligible =
          config.actions.analog && config.agent.tools.analog && config.inspectors.analog;
        if (target === 'analog' || target === 'all') {
          if (!analogEligible) {
            const reason = !config.actions.analog
              ? 'actions.analog is turned off'
              : !config.agent.tools.analog
                ? 'agent.tools.analog is turned off'
                : 'inspectors.analog is turned off';
            if (target === 'analog') {
              if (!config.actions.analog) throw new Error(actionBlockedMessage('analog'));
              throw new Error(`Analog recording is disabled in the devtools config (${reason}).`);
            }
            skipped.push(`Analog calls (${reason})`);
          } else {
            clearCalls();
            cleared.push('Analog server calls');
          }
        }

        if (cleared.length === 0) {
          return { markdown: `No recordings were cleared. Skipped: ${skipped.join(', ')}.` };
        }

        let message = `Cleared ${cleared.join(', ')}.`;
        if (skipped.length > 0) {
          message += ` Skipped: ${skipped.join(', ')}.`;
        }
        return { markdown: message };
      },
    });

    register({
      name: 'ping-forms',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        const page = owns(pageId) ? formPages.get(pageId) : undefined;
        if (!page) return { known: false };
        page.reportedAt = Date.now();
        return { known: true };
      },
    });

    register({
      name: 'forget-forms-page',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: string) => {
        if (!mayForget(pageId)) return;
        formDeltas.forget(pageId);
        if (formPages.delete(pageId)) applyForms(currentForms(formPages, limits.formTimeline));
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
      handler: (
        selector:
          string | { pageId?: unknown; id?: unknown; selector?: unknown; reveal?: unknown } | null,
      ) => {
        const target =
          selector && typeof selector === 'object' && typeof selector.id === 'string'
            ? {
                id: selector.id.slice(0, 50),
                ...(typeof selector.pageId === 'string' ? { pageId: selector.pageId } : {}),
                ...(selector.reveal === true ? { reveal: true } : {}),
              }
            : selector && typeof selector === 'object' && typeof selector.selector === 'string'
              ? {
                  selector: selector.selector.slice(0, 500),
                  ...(typeof selector.pageId === 'string' ? { pageId: selector.pageId } : {}),
                }
              : typeof selector === 'string'
                ? selector
                : '';
        if (target) highlightSessions.bind('highlight-in-page');
        else highlightSessions.unbind('highlight-in-page');
        void my.rpc.broadcast({ method: 'highlight-in-page', args: [target], optional: true });
      },
    });

    const pendingFormActions = new Map<
      string,
      { pageId: string | undefined; settle: (result: unknown) => void }
    >();
    let formActionSeq = 0;

    const requestFormAction = (request: Record<string, unknown>, timeoutMs = 15_000) => {
      const action = request['action'] as string;
      if (!config.actions.forms && FORM_WRITE_ACTIONS.includes(action)) {
        return Promise.resolve<Record<string, unknown>>({
          ok: false,
          error: actionBlockedMessage('forms'),
        });
      }
      const formId = request['formId'];
      if (!FORMLESS_FORM_ACTIONS.includes(action) && (typeof formId !== 'string' || !formId)) {
        return Promise.resolve<Record<string, unknown>>({
          ok: false,
          error: `${String(action)} needs a formId.`,
        });
      }
      return sendFormAction(request, timeoutMs);
    };

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
            error: `No page answered within ${Math.round(timeoutMs / 1000)}s. Is the app open in a browser (or the device app in the foreground), with that form on screen?`,
          });
        }, timeoutMs);
        timer.unref?.();
        pendingFormActions.set(requestId, {
          pageId,
          settle: (result) => {
            clearTimeout(timer);
            pendingFormActions.delete(requestId);
            resolve(
              (result && typeof result === 'object'
                ? result
                : { ok: false, error: 'Empty answer.' }) as Record<string, unknown>,
            );
          },
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
      handler: (message: { requestId?: unknown; pageId?: unknown; result?: unknown }) => {
        if (typeof message?.requestId !== 'string') return;
        const pending = pendingFormActions.get(message.requestId);
        if (pending && answersFor(pending.pageId, message.pageId)) pending.settle(message.result);
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

    // A tab whose connection dropped gets no change detection record request,
    // so its report goes at once and the tool does not count it as connected
    // until it reports again. Bound from the component, injector and change
    // detection reports, the ones the tool reads tabs from.
    const cdPages = new Map<string, CdPage>();
    const goneCdPages = new Set<string>();
    let applyCd = () => {};
    const cdSessions = trackPageSessions(ctx.rpc, (pageIds) => {
      let removed = false;
      for (const pageId of pageIds) {
        goneCdPages.add(pageId);
        removed = cdPages.delete(pageId) || removed;
      }
      if (removed) applyCd();
    });
    const cdSeen = (pageId: string) => {
      cdSessions.bind(pageId);
      goneCdPages.delete(pageId);
    };

    register({
      name: 'push-component-tree',
      type: 'action',
      jsonSerializable: true,
      handler: deltaPush(componentDeltas, owns, (report) => {
        if (!isComponentReport(report) || !owns(report.pageId)) return false;
        componentPages.set(report.pageId, toComponentPage(report));
        cdSeen(report.pageId);
        applyComponentPages();
        for (const check of [...componentWaiters]) check();
        return true;
      }),
    });

    const cdState = await my.rpc.sharedState('change-detection', {
      initialValue: { pages: {} } as CdState,
    });
    applyCd = () =>
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

    const requestCdOptions = (message: unknown) => {
      const raw = (message && typeof message === 'object' ? message : {}) as { pageId?: unknown };
      const pageId = typeof raw.pageId === 'string' ? raw.pageId.slice(0, 50) : undefined;
      void my.rpc.broadcast({
        method: 'change-detection-options',
        args: [{ pageId, ...toCdOptionsRequest(message) }],
        optional: true,
      });
    };

    register({
      name: 'push-change-detection',
      type: 'action',
      jsonSerializable: true,
      handler: deltaPush(cdDeltas, owns, (report) => {
        const page = toCdPage(report, limits.cdCycles);
        if (!page || !owns(page.pageId)) return false;
        cdPages.set(page.pageId, page);
        cdSeen(page.pageId);
        applyCd();
        return true;
      }),
    });

    register({
      name: 'ping-change-detection',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        const page = owns(pageId) ? cdPages.get(pageId) : undefined;
        if (!page) return { known: false };
        cdPages.set(page.pageId, { ...page, reportedAt: Date.now() });
        cdSeen(page.pageId);
        return { known: true };
      },
    });

    register({
      name: 'forget-change-detection-page',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        if (!mayForget(pageId)) return;
        cdDeltas.forget(pageId);
        if (cdPages.delete(pageId)) applyCd();
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
      name: 'request-change-detection-options',
      type: 'action',
      jsonSerializable: true,
      handler: (message: unknown) => {
        requestCdOptions(message);
      },
    });

    register({
      name: 'ping-component-tree',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        const page = owns(pageId) ? componentPages.get(pageId) : undefined;
        if (!page) return { known: false };
        componentPages.set(page.pageId, { ...page, reportedAt: Date.now() });
        cdSeen(page.pageId);
        return { known: true };
      },
    });

    register({
      name: 'forget-component-page',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        if (!mayForget(pageId)) return;
        componentDeltas.forget(pageId);
        if (componentPages.delete(pageId)) applyComponentPages();
      },
    });

    register({
      name: 'select-component',
      type: 'action',
      jsonSerializable: true,
      handler: (target: string | { pageId?: unknown; id?: unknown; console?: unknown } | null) => {
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
        selectComponentOnPage(pageId, id, target?.console === true);
      },
    });

    // Draws the hydration overlay on a page; it changes nothing in the app.
    const requestHydrationOverlay = (message: { pageId?: unknown; on?: unknown } | null) => {
      if (typeof message?.on !== 'boolean') return;
      const pageId = typeof message.pageId === 'string' ? message.pageId.slice(0, 50) : undefined;
      void my.rpc.broadcast({
        method: 'hydration-overlay',
        args: [{ pageId, on: message.on }],
        optional: true,
      });
    };
    register({
      name: 'request-hydration-overlay',
      type: 'action',
      jsonSerializable: true,
      handler: requestHydrationOverlay,
    });

    // Writes to component inputs, properties and signals: panel and agent tools.
    const componentEdits = createComponentEdits({
      config,
      pages: () => componentPages.values(),
      broadcast: (method, message) =>
        void my.rpc.broadcast({ method, args: [message], optional: true }),
      answersFor,
    });
    register({
      name: 'component-edit-result',
      type: 'action',
      jsonSerializable: true,
      handler: componentEdits.answer,
    });
    register({
      name: 'request-component-edit',
      type: 'action',
      jsonSerializable: true,
      handler: (message: { pageId?: unknown; request?: unknown } | null) =>
        componentEdits.request(message?.pageId, message?.request),
    });
    for (const tool of componentEdits.tools) agent.registerTool(tool);

    // Nested levels of component values: the panel opens them, inspect-component reads them.
    const componentValues = createComponentValues({
      pages: () => componentPages.values(),
      broadcast: (method, message) =>
        void my.rpc.broadcast({ method, args: [message], optional: true }),
      answersFor,
    });
    register({
      name: 'component-value-result',
      type: 'action',
      jsonSerializable: true,
      handler: componentValues.answer,
    });
    register({
      name: 'request-component-value',
      type: 'action',
      jsonSerializable: true,
      handler: (message: { pageId?: unknown; request?: unknown } | null) =>
        componentValues.request(message?.pageId, message?.request),
    });

    // Images of one component, drawn by its page: the screenshot-component tool.
    const componentScreenshots = createComponentScreenshots({
      pages: () => componentPages.values(),
      broadcast: (method, message) =>
        void my.rpc.broadcast({ method, args: [message], optional: true }),
      answersFor,
    });
    register({
      name: 'component-screenshot-result',
      type: 'action',
      jsonSerializable: true,
      handler: componentScreenshots.answer,
    });
    agent.registerTool(componentScreenshots.tool);

    registerConsoleGlobals({
      config,
      register,
      broadcast: (message) => void my.rpc.broadcast(message),
      answersFor,
    });

    const pendingPicks = new Map<
      string,
      { pageId: string; settle: (result: Record<string, unknown>) => void }
    >();
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
            resolve({
              ok: false,
              error:
                'The page did not answer. Is the app still open in a browser, or the device app in the foreground?',
            });
          }, 20_000);
          timer.unref?.();
          pendingPicks.set(requestId, {
            pageId,
            settle: (result) => {
              clearTimeout(timer);
              pendingPicks.delete(requestId);
              if (result['ok'] === true && typeof result['id'] === 'string') {
                componentTree.mutate((draft) => {
                  draft.selectedId = result['id'] as string;
                });
              }
              resolve({ ...result, pageId });
            },
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
      handler: (message: { requestId?: unknown; pageId?: unknown; result?: unknown } | null) => {
        if (typeof message?.requestId !== 'string') return;
        const pending = pendingPicks.get(message.requestId);
        if (!pending || !answersFor(pending.pageId, message.pageId)) return;
        const result =
          message.result && typeof message.result === 'object'
            ? (message.result as Record<string, unknown>)
            : { ok: false, error: 'Empty answer.' };
        pending.settle(result);
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

    // Shared by the panel's Watch and Record write stacks buttons and the watch-signal agent tool.
    const sendSignalWatch = (message: unknown) => {
      const request = signalWatchRequest(message, signalPages);
      if (!request) return { pages: 0 };
      void my.rpc.broadcast({ method: 'signal-watch', args: [request], optional: true });
      return { pages: signalPages.has(request.pageId) ? 1 : 0, pageId: request.pageId };
    };

    register({
      name: 'set-signal-watch',
      type: 'action',
      jsonSerializable: true,
      handler: sendSignalWatch,
    });

    agent.registerTool({
      id: 'pangular:watch-signal',
      title: 'Watch a signal',
      description:
        'Watch a signal on the running page and toggle write stack recording. Watched signals log changes to the console; pangular:inspect-signals includes them in `watch`. When write stacks are enabled, exact history entries include the top app call frames. Pass `node` (id or label) to watch, `watch: false` to unwatch, or `stacks: true|false` to toggle stack traces. Resets on reload. Uses `page` or the most recent page with a signal graph.',
      inputSchema: {
        type: 'object',
        properties: {
          node: {
            type: 'string',
            description:
              'Node id or label from pangular:inspect-signals. A label watches every node with it.',
          },
          watch: {
            type: 'boolean',
            description: 'False stops watching `node`. Defaults to true.',
          },
          stacks: {
            type: 'boolean',
            description: 'True records write stacks on the page, false stops.',
          },
          page: PAGE_ARGUMENT,
        },
      },
      handler: async (args: WatchSignalArgs) => {
        const unsupported = signalPages.size
          ? null
          : unsupportedToolText(angularPages.pick(pageArgument(args)), 'signalGraph');
        if (unsupported) return { markdown: unsupported };
        const asked = watchSignalRequests(args ?? {}, signalPages, pageArgument(args));
        if ('markdown' in asked) return asked;
        for (const request of asked.requests) sendSignalWatch({ ...request, pageId: asked.pageId });
        return { markdown: watchSignalText(args ?? {}, asked.pageId, asked.labels) };
      },
    });

    register({
      name: 'push-signal-graph',
      type: 'action',
      jsonSerializable: true,
      handler: (incoming: PageGraph & { historyDelta?: Record<string, SignalChange[]> }) => {
        const pageId = incoming?.pageId;
        const known = typeof pageId === 'string' && pageId.length < 50;
        if (known && !owners.write(pageId)) return { delta: true };
        const prev = known ? signalPages.get(pageId)?.graph : undefined;
        let graph: PageGraph = incoming;
        let delta = true;
        if (incoming?.historyDelta) {
          const { historyDelta, ...rest } = incoming;
          // Node ids are only unique per component or injector, so a delta for a new owner can't
          // build on the previous history.
          const base = prev && signalOwner(prev) === signalOwner(rest) ? prev : undefined;
          if (!base) delta = false;
          const history: Record<string, SignalChange[]> = {};
          for (const { id } of [...(rest.nodes ?? []), ...(rest.resources ?? [])]) {
            const list = [...(base?.history?.[id] ?? []), ...(historyDelta[id] ?? [])];
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
        const page = owns(pageId) ? signalPages.get(pageId) : undefined;
        if (!page) return { known: false };
        signalPages.set(pageId as string, { ...page, reportedAt: Date.now() });
        return { known: true };
      },
    });

    register({
      name: 'signal-graph-peek-result',
      type: 'action',
      jsonSerializable: true,
      handler: (message: unknown) => {
        const pageId = (message as { pageId?: unknown } | null)?.pageId;
        if (answersFor(undefined, pageId)) signalPeeks.answer(message);
      },
    });

    register({
      name: 'forget-signal-page',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        if (mayForget(pageId) && signalPages.has(pageId)) forgetSignalPages([pageId]);
      },
    });

    register({
      name: 'push-injector-tree',
      type: 'action',
      jsonSerializable: true,
      handler: deltaPush(injectorDeltas, owns, (raw) => {
        const report = raw as {
          pageId?: unknown;
          roots?: unknown;
          environment?: unknown;
          truncated?: unknown;
          zone?: unknown;
        } | null;
        const pageId = report?.pageId;
        if (typeof pageId !== 'string' || !pageId || pageId.length >= 50) return false;
        if (!owners.write(pageId)) return false;
        const zone = ZONE_MODES.find((mode) => mode === report?.zone);
        const tree = sanitizeInjectorTree(report?.roots, report?.environment);
        const names = frameworkNames.current();
        const page: InjectorPage = {
          pageId,
          roots: tree.roots,
          environment: tree.environment,
          ...(report?.truncated === true || tree.truncated ? { truncated: true } : {}),
          ...(zone ? { zone } : {}),
          reportedAt: Date.now(),
        };
        injectorPages.set(pageId, withFramework(page, names ?? new Set()));
        cdSeen(pageId);
        applyInjectorPages();
        return true;
      }),
    });

    register({
      name: 'ping-injector-tree',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        const page = owns(pageId) ? injectorPages.get(pageId) : undefined;
        if (!page) return { known: false };
        injectorPages.set(page.pageId, { ...page, reportedAt: Date.now() });
        cdSeen(page.pageId);
        return { known: true };
      },
    });

    register({
      name: 'forget-injector-page',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: unknown) => {
        if (!mayForget(pageId)) return;
        injectorDeltas.forget(pageId);
        if (injectorPages.delete(pageId)) applyInjectorPages();
      },
    });

    // The value of a provider an injector already created: the Injectors view and read-provider-value.
    const providerValues = createProviderValues({
      pages: () => injectorPages.values(),
      latest: () => latestInjectorPage(),
      broadcast: (method, message) =>
        void my.rpc.broadcast({ method, args: [message], optional: true }),
      answersFor,
    });
    register({
      name: 'provider-value-result',
      type: 'action',
      jsonSerializable: true,
      handler: providerValues.answer,
    });
    register({
      name: 'request-provider-value',
      type: 'action',
      jsonSerializable: true,
      handler: (message: { pageId?: unknown; request?: unknown } | null) =>
        providerValues.request(message?.pageId, message?.request),
    });

    register({
      name: 'push-ngrx-state',
      type: 'action',
      jsonSerializable: true,
      handler: (report: unknown) => {
        if (!isNgrxReport(report) || !owns(report.pageId)) return { seq: 0 };
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
        if (mayForget(pageId) && ngrxPages.delete(pageId)) applyNgrx();
      },
    });

    // The URL and title of each page, from its router, HTTP or component report.
    const livePageDetails = () =>
      pageDetails({
        router: [...routerPages.values()].map((page) => ({
          pageId: page.pageId,
          reportedAt: page.reportedAt,
          url: page.snapshot?.url,
        })),
        http: httpPages.values(),
        components: componentPages.values(),
      });
    const withPageUrls = <T extends { pageId: string; reportedAt: number }>(pages: T[]) => {
      const details = livePageDetails();
      return pages.map((page) => ({
        pageId: page.pageId,
        reportedAt: page.reportedAt,
        url: details.get(page.pageId)?.url,
      }));
    };

    const pendingNgrx = new Map<string, { pageId: string; settle: (result: unknown) => void }>();
    let ngrxSeq = 0;

    register({
      name: 'ngrx-action-result',
      type: 'action',
      jsonSerializable: true,
      handler: (message: { requestId?: unknown; pageId?: unknown; result?: unknown }) => {
        if (typeof message?.requestId !== 'string') return;
        const pending = pendingNgrx.get(message.requestId);
        if (pending && answersFor(pending.pageId, message.pageId)) pending.settle(message.result);
      },
    });

    const requestNgrxAction = (page: unknown, request: unknown) =>
      new Promise<NgrxRequestResult>((resolve) => {
        const kind = (request as { type?: unknown } | null)?.type;
        // Reading an entry's state or exporting a session changes nothing, so writes off allow it.
        const reads = kind === 'entry' || kind === 'export';
        if (!reads && !config.actions.ngrx) return resolve({ error: actionBlockedMessage('ngrx') });
        const all = ngrxStateOf(ngrxPages).pages;
        // A restore can target a signal store; every other request needs the classic Store.
        const pages = kind === 'restore' || reads ? all : all.filter((p) => p.classic);
        // Without a page, a write would reach every tab, or one the caller did not choose.
        if (typeof page !== 'string' && pages.length !== 1 && !(reads && pages.length)) {
          return resolve({
            error: pages.length
              ? choosePageText(withPageUrls(pages), 'NgRx state')
              : 'No page reports NgRx state. Open the app in a browser, or pass the page id.',
          });
        }
        const pageId = typeof page === 'string' ? page : pages[0].pageId;
        const requestId = `n${++ngrxSeq}`;
        const timer = setTimeout(() => {
          pendingNgrx.delete(requestId);
          resolve({
            error:
              'No page answered within 10s. Is the app open in a browser, or the device app in the foreground?',
          });
        }, 10_000);
        timer.unref?.();
        pendingNgrx.set(requestId, {
          pageId,
          settle: (result) => {
            clearTimeout(timer);
            pendingNgrx.delete(requestId);
            resolve((result ?? {}) as NgrxRequestResult);
          },
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

    // Past entries, session export and import, and generated tests (rpc/ngrx-session-tools.ts).
    const ngrxHistory = createNgrxHistory({
      ask: (page, request) => requestNgrxAction(page, request),
      page: (pageId) => ngrxPages.get(pageId),
      pages: () => byRecency(ngrxPages.values()),
    });
    register({
      name: 'request-ngrx-history',
      type: 'action',
      jsonSerializable: true,
      handler: (message: unknown) => ngrxHistory.history(message),
    });
    register({
      name: 'import-ngrx-session',
      type: 'action',
      jsonSerializable: true,
      handler: (message: { session?: unknown } | null) =>
        ngrxHistory.importSession(message?.session),
    });

    // Agent resources
    agent.registerResource({
      id: 'pangular:component-tree',
      name: 'Angular Component Tree',
      description:
        'Live component instances per page as JSON: roots has rendered instances (id, name, tag, directives, hydration), directive-only hosts, counts, and detail for selected instance (inputs, outputs, properties, dependencies, source location). Empty when no page is connected. ' +
        LIVE_RESOURCE_NOTE,
      mimeType: 'application/json',
      read: () => ({
        text: liveResourceText(
          componentTree.value(),
          'pangular:list-components and pangular:inspect-component',
        ),
      }),
    });

    agent.registerResource({
      id: 'pangular:signal-graph',
      name: 'Angular Signal Graph',
      description:
        'Live signal dependency graph per connected page: nodes (signal, computed, effect, linkedSignal), producer-to-consumer edges, component/injector contexts, resources, and recent value history. Empty when no page is connected. ' +
        LIVE_RESOURCE_NOTE,
      mimeType: 'application/json',
      read: () => ({
        text: liveResourceText(signalGraphState.value(), 'pangular:inspect-signals'),
      }),
    });

    agent.registerResource({
      id: 'pangular:injector-tree',
      name: 'Angular Injector Tree',
      description:
        'DI injector hierarchy per connected page (element and environment injectors with providers, injected dependencies, and zone change detection mode). Empty when no page is connected. ' +
        LIVE_RESOURCE_NOTE,
      mimeType: 'application/json',
      read: () => ({
        text: liveResourceText(injectorTreeState.value(), 'pangular:inspect-providers'),
      }),
    });

    agent.registerResource({
      id: 'pangular:ngrx-store',
      name: 'NgRx Store State',
      description:
        'Live NgRx state per connected page: @ngrx/signals stores (state, computed, methods) and classic @ngrx/store state, plus a change log with per-entry state diffs and action origin (dispatch, effect, reactive). Empty when no page is connected. ' +
        LIVE_RESOURCE_NOTE,
      mimeType: 'application/json',
      read: () => ({
        text: liveResourceText(
          ngrxStoreState.value(),
          'pangular:inspect-signal-store and pangular:signal-store-history',
        ),
      }),
    });

    agent.registerResource({
      id: 'pangular:forms',
      name: 'Angular Forms',
      description:
        "Every form a connected page last reported (Signal Forms, reactive and template-driven), with each field's value, status, touched, dirty and errors, plus recent changes. The JSON starts with an `_untrusted` notice. Empty when no page is connected.",
      mimeType: 'application/json',
      read: () => ({ text: formsResourceText(formsState.value() as FormsState) }),
    });

    agent.registerResource({
      id: 'pangular:router',
      name: 'Angular Router',
      description:
        'The active route tree (params, data, guards, resolvers) and recent navigations of each connected page. The JSON starts with an `_untrusted` notice. Empty when no page is connected.',
      mimeType: 'application/json',
      read: () => ({ text: routerResourceText(routerState.value() as RouterState) }),
    });

    const ngrxPageProperty = {
      type: 'string',
      description: 'Page id, when more than one tab reports. Defaults to every page.',
    } as const;

    agent.registerTool({
      id: 'pangular:inspect-signal-store',
      title: 'Inspect a signal store',
      outputSchema: MARKDOWN_OUTPUT_SCHEMA,
      description: INSPECT_SIGNAL_STORE_DESCRIPTION,
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
      title: 'Show signal store history',
      description: SIGNAL_STORE_HISTORY_DESCRIPTION,
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

    const forAgents = (key: PangularInspector) => on[key] && config.agent.tools[key];
    const waitFor = createWaitForTool({
      components: forAgents('components') ? () => componentPages.values() : undefined,
      router: forAgents('router') ? () => routerPages.values() : undefined,
      http: forAgents('http') ? () => httpPages.values() : undefined,
      errors: forAgents('errors') ? errorsInspector?.state : undefined,
      subscribe: [componentTree, routerState, httpState].map(
        (state) => (listener: () => void) => state.on('updated', listener),
      ),
      keepAlive: () => interest.touch(),
    });
    if (waitFor) agent.registerTool(waitFor);

    agent.registerTool({
      id: 'pangular:highlight',
      title: 'Highlight a component',
      description:
        'Highlight a component in the running Angular app and select it: the pangular:component-tree resource then carries its live `detail` and pangular:inspect-signals targets it. Pass an instance id from the pangular:component-tree resource (targets that exact instance, e.g. the second card of a list), a class name, a host tag, or any CSS selector. A class name or tag resolves on the most recent page unless `page` names another tab. When it matches several instances, it picks the first and lists the ids of all of them.',
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
        if (typeof args.selector !== 'string' || !args.selector.trim()) {
          return { markdown: 'Pass `selector`: an instance id, class name or host tag.' };
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
      title: 'Inspect a component',
      outputSchema: MARKDOWN_OUTPUT_SCHEMA,
      description:
        'Get live details of a component instance: inputs, outputs, properties (signals unwrapped), listeners, host directives, DI dependencies, change detection, and source location. Pass `selector` (instance id, class name, or host tag); without `page` it searches every page. It selects the instance on its page (the panel follows); several matches answer for the first and list the other ids. Fields carry `edit` (for pangular:set-component-property or pangular:set-signal) or `locked`. `path` reads a nested value without changing the selection. Secrets are redacted; cut past 20,000 characters.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'Instance id (e.g. c12), class name (e.g. ProductCard) or host tag.',
          },
          path: {
            type: 'string',
            description:
              'Read one value instead of the whole detail: an input or property name, then keys and indexes, such as `user.address` or `items[0]` (an index counts the entries of a Map or Set).',
          },
          depth: {
            type: 'number',
            description: 'With `path`: levels to read below it, 1 to 5. Defaults to 1.',
          },
          limit: {
            type: 'number',
            description: 'With `path`: most entries per object or list, 1 to 1000. Defaults to 30.',
          },
          page: componentPageProperty,
          pageId: { type: 'string', description: 'Same as `page`.' },
        },
        required: ['selector'],
      },
      handler: async (args: {
        selector: string;
        path?: unknown;
        depth?: unknown;
        limit?: unknown;
        page?: string;
        pageId?: string;
      }) => {
        const page = pageArgument(args, 'pageId');
        const valuePath = args.path === undefined || args.path === '' ? null : parsePath(args.path);
        if (args.path !== undefined && args.path !== '' && !valuePath) {
          return {
            markdown:
              'Pass `path` as a property name, or a path such as `user.address` or `items[0]`.',
          };
        }
        const unknown = unknownComponentPage(page);
        if (unknown) return unknown;
        if (![...componentPages.values()].some((entry) => entry.roots.length)) {
          return { markdown: noComponentTree('') };
        }
        if (typeof args.selector !== 'string' || !args.selector.trim()) {
          return { markdown: 'Pass `selector`: an instance id, class name or host tag.' };
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
        if (hit.node.kind === 'directive') {
          return { markdown: untrusted(directiveHostText(hit.node, hit.pageId)) };
        }
        const others = otherMatchesText(hits, args.selector);
        if (valuePath) {
          const whole = (value: unknown) =>
            typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined;
          const result = await componentValues.request(hit.pageId, {
            id: hit.node.id,
            path: valuePath,
            depth: whole(args.depth),
            limit: whole(args.limit),
          });
          const text = valueResultText(result, { ...hit.node, pageId: hit.pageId }, valuePath);
          return { markdown: others ? `${text}\n\n${others}` : text };
        }
        selectComponentOnPage(hit.pageId, hit.node.id);
        const detail = await waitForComponentDetail(hit.pageId, hit.node.id);
        if (!detail) {
          return {
            markdown: `Selected \`${hit.node.name}\` (instance \`${hit.node.id}\` on page \`${hit.pageId}\`), but the page did not report its detail within 3 seconds. The instance may have been destroyed, or the tab may be in the background. Try again, or read the pangular:component-tree resource later.${others ? `\n\n${others}` : ''}`,
          };
        }
        return {
          // The notice is part of the heading, so the cap counts it too.
          markdown: inspectComponentText(
            detail,
            untrusted(
              `Live detail of \`${detail.name}\` (\`<${detail.tag}>\`, instance \`${detail.id}\` on page \`${hit.pageId}\`), read from the running page.${others ? `\n\n${others}` : ''}`,
            ),
          ),
        };
      },
    });

    agent.registerTool({
      id: 'pangular:list-components',
      title: 'List live components',
      outputSchema: MARKDOWN_OUTPUT_SCHEMA,
      description: LIST_COMPONENTS_DESCRIPTION,
      inputSchema: {
        type: 'object',
        properties: {
          page: PAGE_ARGUMENT,
          filter: {
            type: 'string',
            description:
              'Search: plain text found in a class name, host tag or host directive (case-insensitive), `<tag>` for a host tag and `[dir]` for a directive, as in `<button> [matTooltip]`. Every part must match. Matches keep their ancestors.',
          },
          depth: {
            type: 'number',
            description: 'Most levels to list, 1 for the roots only. Unlimited without it.',
          },
          directiveHosts: {
            type: 'boolean',
            description:
              'False leaves out the elements that host directives but no component. Listed by default.',
          },
        },
      },
      handler: async (args: {
        page?: string;
        filter?: string;
        depth?: number;
        directiveHosts?: boolean;
      }) => ({
        markdown: listComponentsText(
          componentPages.values(),
          (pageId) => routerPages.get(pageId)?.outlets,
          {
            page: pageArgument(args),
            filter: typeof args?.filter === 'string' ? args.filter : undefined,
            depth: typeof args?.depth === 'number' ? args.depth : undefined,
            directiveHosts: args?.directiveHosts !== false,
          },
        ),
      }),
    });

    agent.registerTool({
      id: 'pangular:defer-blocks',
      title: 'List @defer blocks',
      description:
        'List live `@defer` blocks rendered on the page: owning component, state (placeholder, loading, complete, error), triggers, and incremental hydration status. Flags blocks needing attention (failed loads, stuck placeholders, dehydrated). Lists every page unless `page` names one. Requires an Angular development build with debug APIs enabled.',
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
              Date.now(),
              angularPages.get,
            ),
          }
        );
      },
    });

    agent.registerTool(templateLintTool(ctx.cwd));

    agent.registerTool({
      id: 'pangular:for-blocks',
      title: 'List @for blocks',
      description:
        'List live `@for` blocks rendered on the running page (Angular 22+ dev builds): owning component, item count, `track` expression target (`$index`, item, or expression), and `@empty` block status. Flags empty blocks lacking `@empty`. Lists every page unless `page` names one. Returns up to 50 blocks per page; results cut at 20,000 chars.',
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
            markdown: forBlocksText(
              byRecency(componentPages.values()).filter((entry) => !page || entry.pageId === page),
              angularPages.get,
            ),
          }
        );
      },
    });

    // Read-only mode keeps this tool as a read tool, without `overlay`.
    const hydrationOverlayAllowed = !config.agent.readOnly;
    agent.registerTool({
      id: 'pangular:hydration',
      title: 'Check hydration',
      description: `${HYDRATION_DESCRIPTION}${
        hydrationOverlayAllowed
          ? HYDRATION_OVERLAY_DESCRIPTION
          : ' The agent is read-only, so this tool cannot turn the hydration overlay on or off.'
      }`,
      inputSchema: {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            description:
              'Page id, when more than one tab reports (see pangular:list-pages). Lists every page without it.',
          },
          pageId: { type: 'string', description: 'Same as `page`.' },
          ...(hydrationOverlayAllowed
            ? {
                overlay: {
                  type: 'boolean',
                  description:
                    'Outline hydrated, skipped, mismatched and dehydrated regions on the page (true), or remove the outline (false).',
                },
              }
            : {}),
        },
      },
      handler: async (args: { page?: string; pageId?: string; overlay?: boolean }) => {
        const page = pageArgument(args, 'pageId');
        const unknown = unknownComponentPage(page);
        if (unknown) return unknown;
        const pages = byRecency(componentPages.values()).filter(
          (entry) => !page || entry.pageId === page,
        );
        if (args?.overlay === undefined) return { markdown: hydrationText(pages) };
        if (!hydrationOverlayAllowed) {
          return {
            markdown:
              'The agent is read-only in the devtools config (agent.readOnly), so it cannot turn the hydration overlay on or off. Use the Hydration section on the Components page of the panel, or call this tool without `overlay`.',
          };
        }
        if (typeof args.overlay !== 'boolean') {
          return { markdown: '`overlay` must be true or false.' };
        }
        const done = hydrationOverlayText(args.overlay, pages);
        if (!args.overlay || pages.some((entry) => entry.hydration)) {
          requestHydrationOverlay({ pageId: page, on: args.overlay });
        }
        return { markdown: `${done}\n\n${hydrationText(pages)}` };
      },
    });

    // Read-only mode keeps this tool as a read tool, without `record`.
    const cdRecordAllowed = !config.agent.readOnly;
    const cdActionDesc = cdRecordAllowed
      ? 'Recording is off until started: pass `record: "start"`, use the app, then call again; `stop` keeps it, `clear` empties it. `flash`, `track` (Chrome Performance panel) and `angularProfiling` turn on extra views.'
      : 'Recording is off until the panel starts it: under agent.readOnly this tool cannot record or turn on views.';
    agent.registerTool({
      id: 'pangular:change-detection',
      title: 'Record change detection',
      description: `Inspect change detection cycles from Angular's profiler (Angular 20+, dev build): slowest components, check counts, cycle durations, hooks and outputs, and the mode (zoneless or zone.js). ${cdActionDesc} \`export: "json"\` returns the panel file, \`"trace"\` a Perfetto trace (only counts past 100,000 characters). Uses \`page\` or the page that is recording.`,
      inputSchema: {
        type: 'object',
        properties: {
          ...(cdRecordAllowed
            ? {
                record: { type: 'string', enum: ['start', 'stop', 'clear'] },
                flash: {
                  type: 'boolean',
                  description:
                    'Turn the flash overlay on or off: a box over each component as it is checked.',
                },
                track: {
                  type: 'boolean',
                  description:
                    'Turn the "Pangular" track in the Chrome Performance panel on or off.',
                },
                angularProfiling: {
                  type: 'boolean',
                  enum: [true],
                  description:
                    "Call `ng.enableProfiling()` for Angular's own Performance panel track. It cannot be turned off until the page reloads.",
                },
              }
            : {}),
          page: { type: 'string', description: 'Page id; defaults to the page that is recording.' },
          limit: { type: 'number', description: 'Rows per list (default 10, max 50).' },
          export: {
            type: 'string',
            enum: ['json', 'trace'],
            description:
              'Return the recording as JSON instead of a summary: `json` for the panel file, `trace` for Perfetto.',
          },
        },
      },
      handler: async (args: {
        record?: string;
        page?: string;
        limit?: number;
        export?: string;
        flash?: boolean;
        track?: boolean;
        angularProfiling?: boolean;
      }) => {
        const unknown =
          args?.page &&
          cdUnknownPageText(
            args.page,
            cdState.value() as CdState,
            [...componentPages.values(), ...injectorPages.values()].filter(
              (page) => !goneCdPages.has(page.pageId),
            ),
          );
        if (unknown) return { markdown: unknown };
        if (args?.export !== undefined) {
          if (args.export !== 'json' && args.export !== 'trace') {
            return { markdown: '`export` must be `json` or `trace`.' };
          }
          if (args.record !== undefined) {
            return { markdown: 'Pass either `record` or `export`, not both.' };
          }
          if (cdViewsAsked(args)) {
            return {
              markdown:
                'Pass either `export` or `flash`, `track` and `angularProfiling`, not both.',
            };
          }
          return {
            markdown: cdExportText(cdState.value() as CdState, {
              page: args.page,
              export: args.export,
            }),
          };
        }
        if ((args?.record !== undefined || cdViewsAsked(args)) && !cdRecordAllowed) {
          return {
            markdown:
              'The agent is read-only in the devtools config (agent.readOnly), so it cannot start, stop or clear a change detection recording, or turn on the flash overlay, the Performance panel track or Angular profiling. Use the panel, then call this tool without those arguments.',
          };
        }
        // The live views draw on a DOM or into the browser's Performance panel.
        const liveViews = 'the flash overlay, the Performance panel track and Angular profiling';
        const reporting = [...componentPages.values()];
        const noViews = !cdViewsAsked(args)
          ? undefined
          : args?.page
            ? needsDomText(args.page, componentPages.get(args.page)?.platform, liveViews)
            : reporting.length > 0 && reporting.every((page) => nativeAppName(page.platform))
              ? `Every page that reports is an Angular Native or NativeScript app, which renders native views and has no DOM, so ${liveViews} need a page in a browser. pangular:list-pages lists each page's platform.`
              : undefined;
        // A native page skips the live views, but a `record` in the same call still runs.
        const views = noViews
          ? `${noViews} Recording with \`record\` works there.`
          : cdViewsAsked(args)
            ? cdViewsText(args)
            : '';
        if (noViews && args.record === undefined) return { markdown: views };
        if (views && !noViews) {
          requestCdOptions({
            pageId: args.page,
            flash: args.flash,
            track: args.track,
            angularProfiling: args.angularProfiling,
          });
          if (args.record === undefined) return { markdown: views };
        }
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
          if (noViews) return { markdown: `${noViews}\n\n${next}` };
          return { markdown: views ? `${next}\n\n${views}` : next };
        }
        const cd = cdState.value() as CdState;
        const text = changeDetectionText(cd, args ?? {}, angularPages.get);
        // The zone mode comes from the same page as the recording, not the latest tab.
        const zonePage = args?.page ?? pickCdPage(cd)?.pageId;
        const injectors = zonePage ? injectorPages.get(zonePage) : latestInjectorPage();
        const mode = injectors ? zoneModeText(injectors.zone, injectors.pageId) : '';
        const options = cdOptionsText(pickCdPage(cd, args?.page)?.options);
        const parts = [mode, text, options].filter(Boolean);
        return { markdown: parts.join('\n\n') };
      },
    });

    agent.registerTool({
      id: 'pangular:diagnose-change-detection',
      title: 'Diagnose change detection',
      description:
        'Why change detection ran and what it wasted, from the recording pangular:change-detection or the panel started (Angular 20+, dev build). Lists what started each cycle (DOM event, signal write, HTTP response, timer, markForCheck, setInput, effect, an app `ApplicationRef.tick()`, or a zone.js tick nothing asked for), components that change only in zone.js ticks, checks that changed nothing, inputs mutated in place or given an equal new reference, and OnPush hints. `limit` sets rows per list. Uses `page` or the page that is recording. Only reads. Empty until a recording ran.',
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page id; defaults to the page that is recording.' },
          limit: { type: 'number', description: 'Rows per list (default 10, max 50).' },
        },
      },
      handler: async (args: { page?: string; limit?: number }) => {
        const unknown =
          args?.page &&
          cdUnknownPageText(
            args.page,
            cdState.value() as CdState,
            [...componentPages.values(), ...injectorPages.values()].filter(
              (page) => !goneCdPages.has(page.pageId),
            ),
          );
        if (unknown) return { markdown: unknown };
        const cd = cdState.value() as CdState;
        const zonePage = args?.page ?? pickCdPage(cd)?.pageId;
        const injectors = zonePage ? injectorPages.get(zonePage) : latestInjectorPage();
        const mode = injectors ? zoneModeText(injectors.zone, injectors.pageId) : '';
        const text = cdDiagnosisText(cd, args ?? {}, angularPages.get);
        return { markdown: [mode, text].filter(Boolean).join('\n\n') };
      },
    });

    agent.registerTool({
      id: 'pangular:inspect-signals',
      title: 'Inspect signals',
      outputSchema: MARKDOWN_OUTPUT_SCHEMA,
      description:
        "Get the signal graph the running page last reported: signal nodes (signal, computed, linkedSignal, effect), dependency edges, resources, and value history. Only signals a template or an effect has read appear. `selector` names a component (tag, class, id), `root` for root service effects, or a route path. The page reports one component graph: for another component, call pangular:highlight first, or you get the graph available. Use `node` for a single node with its direct producers and consumers; `framework: false` excludes Angular's own nodes; `history: false` omits history.",
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description:
              'Host tag, class name or instance id of the component (e.g. app-root), `root`, or a route path (e.g. /admin).',
          },
          node: {
            type: 'string',
            description:
              'Node id or label. Returns only that node (every node with that label) and its direct producers and consumers, with their resources and history.',
          },
          history: {
            type: 'boolean',
            description: 'False leaves out the value history of every node. Defaults to true.',
          },
          framework: {
            type: 'boolean',
            description:
              'False leaves out the nodes Angular itself created (`framework: true`). Defaults to true.',
          },
          page: PAGE_ARGUMENT,
        },
        required: ['selector'],
      },
      handler: async (args: { selector: string; page?: string } & InspectSignalsArgs) => {
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
          // Ask for this injector's graph once. The page answers without
          // changing its selected target, so the Signals page keeps its view.
          const peeked = await signalPeeks.request(
            (request) =>
              void my.rpc.broadcast({
                method: 'peek-signal-graph',
                args: [request],
                optional: true,
              }),
            args.selector,
            page,
            page ? [page] : [...signalPages.keys()],
            ENV_WAIT_MS,
          );
          if (peeked && matches(peeked)) matched = peeked;
        }
        const graph =
          matched ??
          (page
            ? all.find((entry) => entry.pageId === page)?.graph
            : (signalGraphState.value().graph as PageGraph | null));
        const signalSupport = unsupportedToolText(
          angularPages.pick(page),
          'signalGraph',
          'The get-signals source scan still lists the signals in the source.',
        );
        if (!graph && signalSupport) return { markdown: signalSupport };
        if (!graph) {
          return {
            markdown: `No signal graph available. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio server has no page attached and only ever reports this.`,
          };
        }
        if (graph.unsupported) {
          // Angular 19.1 to 20.0 have `ɵgetSignalGraph`, but without node ids.
          const version = angularPages.get(page ?? graph.pageId)?.version;
          return {
            markdown: `**Unsupported on this Angular version.** The page's signal graph has no node ids, so there is no live graph. ${angularUnavailableText('signalGraph', version)} The get-signals source scan still works.`,
          };
        }
        const view = { node: args.node, history: args.history, framework: args.framework };
        // Signal values come from the page, so the graph sits behind the notice, inside the cap.
        const budget = SIGNAL_TOOL_MAX - UNTRUSTED.length - 2;
        if (!matches(graph)) {
          const known = (graph.environments ?? []).map((e) => `\`${e.name}\``).join(', ');
          const covers = graph.componentSelector ?? graph.injector?.name ?? 'another target';
          const hint = isEnvironmentRequest(args.selector)
            ? ` No environment injector on the page matches it${known ? `; the page knows ${known}` : ''}.`
            : '';
          const head = `No signal graph for \`${clip(args.selector, 200)}\`.${hint} The live graph covers \`${covers}\`:\n\n`;
          return {
            markdown: untrusted(
              (head + signalGraphText(graph, view, Math.max(0, budget - head.length))).slice(
                0,
                budget,
              ),
            ),
          };
        }
        return { markdown: untrusted(signalGraphText(graph, view, budget)) };
      },
    });

    agent.registerTool({
      id: 'pangular:inspect-providers',
      title: 'Inspect injectors and providers',
      outputSchema: MARKDOWN_OUTPUT_SCHEMA,
      description:
        'Get dependency injection injectors from a running page. Without arguments, returns the injector tree (element and environment injectors with providers). Use `selector` to filter by component tag, class, or environment injector (e.g. Root, Platform, Route: admin). Use `token` to find where a service or token is provided and injected. Supports `page` selection across multiple tabs.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description:
              'Optional. A tag name (app-card), a component or directive class name (CardComponent), an environment injector name (Root, Platform, Route: admin; case-insensitive), an injector id, or a component id from the component tree (c12). Returns only the matching injectors. At most 500 characters.',
          },
          token: {
            type: 'string',
            description:
              'Optional. A token name, such as a service class or InjectionToken description (HttpClient, API_URL). Returns where it is provided and injected. With `selector`, only injections by the matching injectors are listed. At most 500 characters.',
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
        const angular = angularPages.pick(page?.pageId ?? requested);
        const noTree = unsupportedToolText(angular, 'debugApi');
        if (noTree && !page?.roots.length) return { markdown: noTree };
        // Before Angular 17.0 the page sends only the element injectors it can see.
        const reduced =
          unsupportedToolText(angular, 'injectorMetadata') ??
          unsupportedToolText(angular, 'injectorProviders');
        const text = inspectProvidersText(page, args);
        return {
          markdown: reduced
            ? `${reduced} The page reports a reduced tree: element injectors with their components and directives, and providers and environment injectors only where its Angular exposes them.\n\n${text}`
            : text,
        };
      },
    });

    agent.registerTool(providerValues.tool);

    registerInjectionExplain({
      register,
      agent,
      page: (requested) => {
        if (requested && !injectorPages.has(requested)) {
          return {
            error: unknownPageText(requested, [...injectorPages.values()], 'an injector tree'),
          };
        }
        const page = requested ? injectorPages.get(requested) : latestInjectorPage();
        const angular = angularPages.pick(page?.pageId ?? requested);
        return { page, reduced: angular?.capabilities.injectorProviders === false };
      },
    });

    const noRouter = `No router state has been reported. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio server has no page attached and only ever reports this.`;
    const pageProperty = PAGE_ARGUMENT;

    agent.registerTool({
      id: 'pangular:inspect-route',
      title: 'Inspect the active route',
      outputSchema: MARKDOWN_OUTPUT_SCHEMA,
      description:
        'Inspect current route state on the running page: URL, query params, fragment, document title, in-flight navigation, active route tree (component, params, data, guards, resolvers), and outlet tree. Pass `selector` (component class, tag, or link text) to inspect the route for a specific component or check if a link is active. Secret values are redacted.',
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
      title: 'Explain a navigation',
      description:
        'Detailed breakdown of recent navigations, newest first: source trigger, redirect chains, redirect loops, phase timing, guards, resolvers, lazy loads, HTTP calls, and cancellation/error explanations with NG0 error details. Filter with `url` or `id`. Set `perf: true` to summarize slowest navigations and preloads.',
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
            maximum: limits.navigations,
            description: `How many navigations to return (default 5, at most ${limits.navigations}).`,
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
        return { markdown: explainNavigationText(state, args, Date.now(), limits.navigations) };
      },
    });

    agent.registerTool({
      id: 'pangular:list-routes',
      title: 'List live routes',
      outputSchema: MARKDOWN_OUTPUT_SCHEMA,
      description:
        "The router's live route config (not just the active route): every route with its full path, component or redirect, lazy state, outlet, guards, resolvers, title, the source file it is declared in and an example URL, with the active routes marked. Pass `match` to predict which route a URL matches (or the nearest routes when it matches none), `audit` for the guards protecting each page, or `filter` to narrow by path or component.",
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
      title: 'Lint routes',
      description:
        "Checks the live route config for common issues: routes after '**', shadowed param routes, missing pathMatch 'full' on empty paths, runtime redirect loops, deprecated guards, title issues, and security flags (e.g. emails or open redirects). Findings indicate severity (throws, warns, or silent) and remediation steps.",
      inputSchema: { type: 'object', properties: { page: pageProperty } },
      handler: async (args: { page?: string }) => {
        const state = routerState.value() as RouterState;
        if (!state.pages.length) return { markdown: noRouter };
        return { markdown: lintRoutesText(state, args) };
      },
    });

    agent.registerTool({
      id: 'pangular:router-config',
      title: 'Show the router setup',
      description:
        'How the router is set up on the running page: provideRouter, forRoot or other, or unknown when the build cannot tell, Angular version, effective options with which are set and which are defaults (onSameUrlNavigation, paramsInheritanceStrategy, urlUpdateStrategy, canceledNavigationResolution, scrolling, initial navigation), enabled features (input binding, view transitions, error handler, preloading strategy, scroller, resources), strategies (location, title, reuse, URL handling), base href, hydration and whether per-guard instrumentation is on.',
      inputSchema: { type: 'object', properties: { page: pageProperty } },
      handler: async (args: { page?: string }) => {
        const state = routerState.value() as RouterState;
        if (!state.pages.length) return { markdown: noRouter };
        return { markdown: routerConfigText(state, args) };
      },
    });

    agent.registerTool({
      id: 'pangular:export-navigation',
      title: 'Export a navigation',
      description:
        'A markdown repro for one navigation (default: the latest that did not succeed): Angular version, router options and features, how it started, the full redirect chain with every detail from explain-navigation, any redirect loop it is part of, and the relevant slice of the route config. Secret-looking values stay redacted.',
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
      title: "Explain a URL's render mode",
      description:
        "Which ServerRoute (from the workspace's *.routes.server.ts) and render mode (Server, Client, Prerender) a URL gets, plus server entries that match no client route and the render mode of every client route.",
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
      title: 'Navigate the app',
      description:
        'Performs router actions in the running app (dev only). Actions: `navigate` (navigates to `url` or `pattern` with `params`), `abort` (cancels in-flight navigation), `replay` (re-runs navigation by `id`), `probe` (runs the matcher without navigating; runs canMatch guards and may load lazy chunks), `instrument` (toggles guard/resolver logging), and `resolve-lazy` (inspects lazy routes). Actions `navigate`, `abort`, `replay`, and `probe` require `actions.router` permission.',
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
        return { markdown: routerActionText(result) };
      },
    });

    agent.registerTool({
      id: 'pangular:dispatch-ngrx-action',
      title: 'Dispatch an NgRx action',
      description:
        'Dispatches an action to the @ngrx/store Store in the running app (dev only) and returns the action log entry with origin and state diff. Pass `type` with optional `payload`, or `seq` to redispatch an action from the log. Without `page` it uses the one page with a Store; with several, it dispatches nothing and lists them. Requires `actions.ngrx` write permission.',
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
        const stores = pages.filter((p) => p.classic);
        // A dispatch changes the app, so it never picks one of several tabs on its own.
        if (!page && stores.length > 1) {
          return { markdown: choosePageText(withPageUrls(stores), 'an @ngrx/store Store') };
        }
        const target = page ? ngrxPages.get(page) : stores[0];
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

    for (const tool of ngrxHistory.tools) agent.registerTool(tool);

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
      title: 'Inspect forms',
      outputSchema: MARKDOWN_OUTPUT_SCHEMA,
      description:
        'Inspect forms on the running page (Signal Forms, reactive, and template-driven). Without arguments, lists all forms with status and error counts. Pass `form` for the full field tree (values, status, touched/dirty, errors, webMcp tool status). Filter using `path`, `onlyInvalid`, or `includeValues`. Secret values are redacted; large results are truncated past 20,000 characters.',
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
      title: 'Explain invalid forms',
      description:
        'Explain why forms on the running page are invalid: each failing field with its current value, the validator that failed, its message and whether it was touched, plus fields waiting on async validators and disabled reasons. Without `form` it covers every form that is invalid or waiting on async validation. Lists at most 100 problems per form; pass `path` to explain one group.',
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
              'Dotted field path to explain only that group or field, e.g. address or items.3. Applies to every matched form.',
          },
        },
      },
      handler: async (args: { form?: string; page?: string; path?: string }) => {
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
      title: 'Explain a form field',
      description:
        'Explain one form field: value, flags, every error with where it comes from (validator, template attribute, cross-field rule and which ancestor, async, parse, server/submission, setErrors), why validation is skipped (hidden, disabled, readonly), inherited disabled reasons, uncommitted or debounced input, stale validity, rules and validator names, the binding (accessor or [formField]) and DOM facts (label, visible error text, drift). Pass `selector` instead of form/path to start from a CSS selector.',
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
      title: 'Explain a form submit',
      description:
        'Explain what submitting a form will do and why it might do nothing: Signal Forms submit() dry-run (action present, ignoreValidators, already submitting), ngSubmit semantics for reactive and template forms, DOM reasons (no submit button, type="button", disabled button, directive not on a <form>, native validation), blocking and pending fields, and recent submits with their outcome (ran, blocked, threw).',
      inputSchema: { type: 'object', properties: { form: formProperty, page: formPageProperty } },
      handler: withForms(explainSubmitText),
    });

    agent.registerTool({
      id: 'pangular:form-payload',
      title: 'Show a form payload',
      description:
        'Show what a form would send: form.value vs getRawValue() with the disabled fields form.value drops (reactive), or the hidden/disabled/readonly fields Signal Forms keeps in the value without validating them, plus which fields the user changed. Each value is cut at 8,000 characters; pass `path` for one group.',
      inputSchema: {
        type: 'object',
        properties: { form: formProperty, path: pathProperty, page: formPageProperty },
      },
      handler: withForms(formPayloadText),
    });

    agent.registerTool({
      id: 'pangular:form-history',
      title: 'Show form history',
      description:
        'Timeline of form changes: value (with previous value and repeat count), status, submit (ran, blocked, threw), added and removed fields, each tagged with its origin (user, code, devtools, binding, or agent for a WebMCP tool call). Filter by form, path, type, origin or `since` (a marker from an earlier call). Returns the current marker.',
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
      title: 'Diff form values',
      description:
        'Net change of a form since a marker: each field whose value or status ended different, with from → to and how many changes happened in between. Get a marker from form-history, inspect-forms or a form-action result, act, then call this.',
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
      title: 'Lint forms',
      description:
        'Deterministic checks on live forms: stale validity after validator changes, stuck PENDING, unreachable submit, missing submission action, hidden fields still rendered, view out of sync with the model, [disabled] on reactive controls, required-but-unbound fields, NG01xxx setup errors, and model-aware accessibility (missing label, aria-invalid desync, required not exposed, error text not shown or not linked, no focus after invalid submit).',
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
      title: 'Lint pipes',
      description:
        'Deterministic checks on pipes found in source: an impure pipe used inside an @for block (runs every check, potentially once per row), `| json` left in a template (a debugging aid), a pure pipe whose transform() reads a signal (its memoization only tracks its own arguments, not signals it reads; zero-argument calls on injected services are reported at info level), and a method call piped to `| async`, like `getData() | async` (a new Observable per check makes AsyncPipe resubscribe every time).',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => ({ markdown: lintPipesText(ctx.cwd) }),
    });

    agent.registerTool({
      id: 'pangular:explain-pipe',
      title: 'Explain a pipe',
      description:
        'Explain one pipe by name: where it is declared or used, whether it is pure, live instance/call counts, time spent in transform, errors thrown and last input/output when instrumentation is on, an experimental stale-value warning, `| async` usages that resubscribe on every check or subscribe to the same source as another usage (for `async`), and any lint findings. Use this to answer "why is this pipe slow or stale?"',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'The pipe name as used after `|` in a template.' },
          page: PAGE_ARGUMENT,
        },
        required: ['name'],
      },
      handler: async (args: { name?: string; page?: string }) => {
        if (!args?.name) return { markdown: 'Pass a pipe `name`.' };
        return { markdown: explainPipeOnPage(args.name, ctx.cwd, pipePages, pageArgument(args)) };
      },
    });

    agent.registerTool({
      id: 'pangular:record-pipes',
      title: 'Record pipe calls',
      description:
        "Start or stop recording pipe calls on the running page, the same switch as Record calls in the Pipes panel. Recording wraps each pipe's transform() to count and time calls, count errors and keep the last input, output and caller, and turns on the experimental stale-argument check; pangular:explain-pipe then shows them. `start` records on the page `page` names, or on the most recent page; `stop` stops that page, or every page without `page`. Calls recorded so far stay after a stop.",
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['start', 'stop'] },
          page: PAGE_ARGUMENT,
        },
        required: ['action'],
      },
      handler: async (args: { action?: string; page?: string }) => {
        const asked = pipeRecordRequest(args?.action, pipePages, pageArgument(args));
        if ('markdown' in asked) return asked;
        const sent = requestPipeRecording(asked.request);
        return { markdown: pipeRecordText(sent.request, sent.pages.pages) };
      },
    });

    agent.registerTool({
      id: 'pangular:explain-custom-control',
      title: 'Explain a custom form control',
      description:
        'Explain how a field is bound to its element (built-in accessor, custom ControlValueAccessor, custom control, [formField]) and what is wrong with it: value drift, missing setDisabledState, touched never set, captured NG01xxx setup errors.',
      inputSchema: {
        type: 'object',
        properties: { form: formProperty, path: pathProperty, page: formPageProperty },
      },
      handler: withForms(explainCustomControlText),
    });

    agent.registerTool({
      id: 'pangular:export-form',
      title: 'Export a form',
      description:
        'Export a form as a JSON snapshot (tree, status, raw value) or as a test fixture (setValue / signal model plus the expected status) with a repro header. Secret values stay [redacted]. A snapshot keeps as many fields as fit in 20,000 characters (at most 200) and notes what was cut.',
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
      title: 'Wait for a form',
      description:
        'Wait until a form is settled (no pending async validation, debounce or submit in flight), valid, not pending, or submitted after a marker. Resolves as soon as the condition holds, or reports the state on timeout.',
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
      // The page writes the message, errors and skipped reasons.
      return untrusted(lines.join('\n'));
    };

    agent.registerTool({
      id: 'pangular:form-action',
      title: 'Run a form action',
      description:
        'Perform actions on a live form in dev mode. Actions include `set-value` (modes: code/user), `mark-touched`, `mark-untouched`, `mark-dirty`, `mark-pristine`, `touch-all`, `revalidate`, `reset`, `enable`, `disable`, `submit`, `focus`, `focus-first-invalid`, `store-as-global`, `snapshot`, `restore`, and `instrument`. Actions `reset`, `submit`, and `restore` require `confirm: true`. Secret, hidden and readonly fields are never written; disabled reactive fields require `force: true`.',
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
        const match = resolveForm(state.forms, str(args?.['form']));
        if (typeof match === 'string') return { markdown: match };
        const { form: _form, ...rest } = args;
        const result = await requestFormAction({ ...rest, formId: match.id });
        return { markdown: actionText(result, formsState.value() as FormsState) };
      },
    });

    agent.registerTool({
      id: 'pangular:fill-form',
      title: 'Fill a form',
      description:
        'Fill several fields at once, by dotted path, through the inputs like a user would (so parsing, dirty and touched run for real). Reports written and skipped fields (secret, hidden, readonly, disabled, missing, or a <select> with no option for the value) and the resulting status. A <select> value must equal the value of one of its options ([ngValue] or value); a multiple select takes an array. Optionally submits afterwards (needs confirm: true).',
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

    // Every reporting page, merged across inspectors, newest first.
    const livePages = () => {
      const details = livePageDetails();
      const platforms = new Map<string, string>();
      for (const page of componentPages.values()) {
        if (page.platform) platforms.set(page.pageId, page.platform);
      }
      for (const page of capacitorPages.values()) {
        if (page.info.bridge && !platforms.has(page.pageId)) {
          platforms.set(page.pageId, `capacitor-${page.info.platform}`);
        }
      }
      const withUrl = <T extends { pageId: string; reportedAt: number }>(pages: Iterable<T>) =>
        [...pages].map((page) => ({
          pageId: page.pageId,
          reportedAt: page.reportedAt,
          ...details.get(page.pageId),
          platform: platforms.get(page.pageId),
          angular: angularPages.get(page.pageId)?.version,
        }));
      return summarizePages(
        {
          components: withUrl(componentPages.values()),
          signals: withUrl([...signalPages].map(([pageId, entry]) => ({ pageId, ...entry }))),
          injectors: withUrl(injectorPages.values()),
          ngrx: withUrl([...ngrxPages.values(), ...(reduxStores?.pages() ?? [])]),
          tanstackQuery: withUrl(tanstackQuery?.pages() ?? []),
          forms: withUrl(formPages.values()),
          router: withUrl(routerPages.values()),
          pipes: withUrl(pipePages.values()),
          http: withUrl(httpPages.values()),
          capacitor: withUrl(capacitorPages.values()),
          errors: withUrl(errorsInspector?.pages() ?? []),
          startup: withUrl(startupInspector?.pages() ?? []),
          plugins: withUrl(pluginsInspector?.pages() ?? []),
          analog: withUrl(on.analog ? analogPages() : []),
        },
        visibility.list(),
      );
    };

    agent.registerTool({
      id: 'pangular:list-pages',
      title: 'List connected pages',
      outputSchema: MARKDOWN_OUTPUT_SCHEMA,
      description:
        'List connected browser tabs, Angular Native apps, and Capacitor apps reporting live data, newest first: page id, URL, title, platform, Angular version, recency, background status, and reporting inspectors. Pass a page id as `page` to the live tools to target a specific tab.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => ({ markdown: listPagesText(livePages()) }),
    });

    registerSnapshot({
      agent,
      config,
      sources: {
        pages: livePages,
        components: () => componentPages.values(),
        router: () => routerState.value() as RouterState,
        http: httpSnapshot,
        errors: () => errorsInspector?.state(),
        forms: () => formsState.value() as FormsState,
        signals: () => [...signalPages].map(([pageId, entry]) => ({ pageId, ...entry })),
        ngrx: () => ngrxPages,
        reduxStores: () => reduxStores?.state(),
        queries: () => tanstackQuery?.state(),
      },
    });

    // The hub frame the panel is served from, for full links into it.
    const panelBase = (ctx as { frames?: { id: string; base?: string }[] }).frames?.find(
      (frame) => frame.id === 'pangular',
    )?.base;
    agent.registerTool({
      id: 'pangular:open-in-panel',
      title: 'Open in the devtools panel',
      description: OPEN_IN_PANEL_DESCRIPTION,
      inputSchema: {
        type: 'object',
        required: ['tab'],
        properties: {
          tab: {
            type: 'string',
            enum: enabledPanelTabs(config).map((tab) => tab.id),
            description: 'The panel tab to open.',
          },
          id: {
            type: 'string',
            description:
              'The item to select: a component id on components and injectors, a form id on forms.',
          },
          page: PAGE_ARGUMENT,
        },
      },
      handler: async (args: { tab?: unknown; id?: unknown; page?: unknown }) => {
        const details = livePageDetails();
        const page = typeof args?.page === 'string' ? args.page : undefined;
        const newest = byRecency(componentPages.values())[0]?.pageId;
        const pageUrl =
          (page ? details.get(page)?.url : undefined) ??
          (newest ? details.get(newest)?.url : undefined) ??
          [...details.values()].find((detail) => detail.url)?.url;
        const result = openInPanel(args, {
          config,
          panelBase,
          pageUrl,
          pages: [...details.keys()],
        });
        if (result.link) {
          void my.rpc.broadcast({
            method: OPEN_IN_PANEL_EVENT,
            args: [result.link],
            optional: true,
          });
        }
        return { markdown: result.markdown };
      },
    });

    // The panel's commands in the hub's palette; the panels run them.
    registerHubCommands(ctx, config, (message) => {
      void my.rpc.broadcast({
        method: PANEL_COMMAND_EVENT,
        args: [message],
        optional: true,
      });
    });

    const audit = await registerAudit({
      my,
      register,
      agent,
      answersFor,
      agentSees: (inspector) => config.agent.tools[inspector],
      agentAxe: !config.agent.readOnly,
      agentReadOnly: config.agent.readOnly,
      platform: (pageId) => componentPages.get(pageId)?.platform,
      // Every page the overlay claimed, so axe works with any set of inspectors on.
      pages: () =>
        withPageUrls([
          ...owners.live(),
          ...componentPages.values(),
          ...httpPages.values(),
          ...routerPages.values(),
          ...formPages.values(),
          ...(errorsInspector?.pages() ?? []),
          ...(leaksInspector?.pages() ?? []),
        ]),
      sources: {
        ...(on.components
          ? {
              cd: () => cdState.value() as CdState,
              components: (pageId: string) => componentPages.get(pageId) ?? null,
            }
          : {}),
        ...(leaksInspector ? { leaks: leaksInspector.state } : {}),
        ...(errorsInspector ? { errors: errorsInspector.state } : {}),
        ...(on.router ? { router: () => routerState.value() as RouterState } : {}),
        ...(on.forms ? { forms: () => formsState.value() as FormsState } : {}),
        ...(on.http ? { http: () => httpState.value() as HttpState } : {}),
        ...(on.pipes ? { pipes: cachedPipeLint(() => lintPipes(ctx.cwd)) } : {}),
      },
    });
    onPageClaimed = audit.pageLoaded;

    if (on.analog) {
      await registerAnalog(my as never, { cwd: ctx.cwd, agent } as never, {
        blockCalls: config.actions.analog ? undefined : actionBlockedMessage('analog'),
        owner: ctx,
        ttl: liveTtl,
        owners,
      });
    }
    feed.attachDocks(
      trackHubDocks(ctx, 'pangular', config, {
        cwd: ctx.cwd,
        capacitor: capacitorShared,
        components: componentTree,
      }),
    );
    // The panel says which dock it shows, which clears that dock's unseen count.
    register({
      name: 'hub-dock-seen',
      type: 'action',
      jsonSerializable: true,
      handler: (dockId: unknown) => feed.seen(dockId),
    });
  },
});

export interface PangularHostOptions {
  /**
   * Register the agent tools and resources that need a connected page. Off
   * for the stdio MCP server, which no page can reach.
   */
  pageTools?: boolean;
  /**
   * Pairing tokens a client may send to be trusted without the one-time code.
   * Server-only: they never go into the published config.
   */
  authTokens?: string[];
  /** Server plugins: agent tools and shared state of Pangular plugins (`plugin.ts`). */
  serverPlugins?: readonly PangularServerPlugin[];
}

export function createPangular(options: PangularConfig = {}, host: PangularHostOptions = {}) {
  const warning = pangularConfigWarning(options);
  if (warning) console.warn(warning);
  const config = resolvePangularConfig(options);
  return defineDevframe({
    ...pangular,
    setup: (ctx, info) => {
      const withConfig: SetupInfo = {
        ...info,
        config,
        pageTools: host.pageTools,
        serverPlugins: host.serverPlugins,
      };
      if (host.authTokens?.length && !registerAuthTokens(ctx, host.authTokens)) {
        console.warn(
          '[pangular] The pairing tokens could not be registered, so clients need the one-time code.',
        );
      }
      return pangular.setup(ctx, withConfig);
    },
  });
}

/**
 * devframe's `initDevframe()`, from the copy this package depends on, to mount
 * the panel without the hub. A separate `devframe` install can resolve another
 * version.
 */
export { initDevframe } from 'devframe/initiate';

export default pangular;
