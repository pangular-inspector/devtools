import type { DevframeSetupInfo, RemoteAssets } from 'devframe';
import { defineDevframe } from 'devframe';
import { createSharedState } from 'devframe/utils/shared-state';
import { PANGULAR_LOGO_DATA_URI } from './brand.ts';
import { SCAN_RPC_DEFINITIONS, SCAN_TOOLS, scanTool } from './rpc/scan-tools.ts';
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
import {
  explainPipeOnPage,
  pipeRecordRequest,
  pipeRecordTargets,
  pipeRecordText,
} from './rpc/pipes-agent.ts';
import { createPageOwners, type OwnerBroadcast } from './rpc/page-owners.ts';
import { trackPageSessions } from './rpc/page-sessions.ts';
import { createOpenInEditor, defaultLauncher } from './rpc/open-in-editor.ts';
import { isAnalogProject, servedAnalogRoot } from './rpc/analog-scan.ts';
import {
  SIGNAL_TOOL_MAX,
  signalGraphText,
  signalStateForAgents,
  type InspectSignalsArgs,
} from './rpc/signal-tools.ts';
import { createSignalPeeks } from './rpc/signal-peeks.ts';
import {
  signalWatchRequest,
  watchSignalRequests,
  watchSignalText,
  type WatchSignalArgs,
} from './rpc/signal-watch-tools.ts';
import { injectorMatches, isEnvironmentRequest, signalOwner } from './signal-graph.ts';
import { scanNgrxStore } from './rpc/get-ngrx-store.ts';
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
  storeIdNamed,
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
import { createSignalRestores } from './rpc/signal-restores.ts';
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
  routerResourceText,
  touchRouterPage,
  type RouterPage,
  type RouterState,
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
import { httpWaterfallText } from './rpc/http-waterfall.ts';
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
  markCdPagesStopped,
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
import { createPageHeartbeats } from './rpc/page-heartbeats.ts';
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
import { injectorResourceText } from './rpc/injector-resource.ts';
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
import { REDACTION_CONFIG_RPC } from './overlay-redaction.ts';
import {
  FORM_WRITE_ACTIONS,
  FORMLESS_FORM_ACTIONS,
  PANGULAR_CONFIG_KEY,
  connectionConfig,
  ROUTER_WRITE_ACTIONS,
  actionBlockedMessage,
  agentAllowed,
  clearRecordingTargets,
  agentSafety,
  agentTags,
  angularUnavailableText,
  enabledPanelTabs,
  isPageAgentEntry,
  sharedStateExposed,
  autoLibraries,
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
import { registerCodeGuard } from './auth-guard.ts';
import { expireAuthTokens, protectAuthFile, scopeAuthStore } from './auth-store.ts';
import {
  BROWSER_TOOLS_CHANGED,
  BROWSER_TOOLS_STATE,
  createBrowserToolsSwitch,
  registerBrowserTools,
  type BrowserToolHost,
} from './rpc/browser-tools.ts';
import pkg from '../package.json' with { type: 'json' };
import { INTEREST_TICK_MS, createPageInterest, leased } from './rpc/page-interest.ts';
import { createPageResourceSource, providePageResources } from './agent-page-resources.ts';
import { createReportDeltas, deltaPush } from './rpc/report-deltas.ts';
import {
  CHANGE_DETECTION_SHAPE,
  COMPONENT_TREE_SHAPE,
  FORMS_SHAPE,
  INJECTOR_TREE_SHAPE,
} from './push-delta.ts';
import { createWaitForTool } from './rpc/wait-for.ts';
import { answeringText, type MarkdownAnswer } from './rpc/agent-output.ts';
import { guardHandler } from './rpc/tool-input.ts';
import {
  createPageOrder,
  defaultPage,
  notePageRead,
  rankPages,
  setPageOrder,
} from './rpc/default-page.ts';
import { namingPageRead } from './rpc/page-read-scope.ts';
import { routerActionAnswer } from './rpc/router-action-answer.ts';
import { nameStoreTokens } from './rpc/store-tokens.ts';
import { notAProjectText, readsSource, refusingTool } from './rpc/project-root.ts';
import { STATE_READ_BY, stateReadTool } from './rpc/state-read-tool.ts';
import { createLibraryGate, usedLibraries } from './rpc/library-tools.ts';
import { createPushAcks } from './rpc/push-acks.ts';
import { cdRecordAnswer } from './rpc/cd-record-tool.ts';
import { refusal, refusalOf, refusedAnswer, ToolRefusal } from './rpc/refusal.ts';

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
  notAProject?: string;
  /** Library inspectors the given config leaves to the project (`autoLibraries`). */
  autoLibraries?: readonly PangularInspector[];
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
    (ctx.staticConfig as Record<string, unknown>)[PANGULAR_CONFIG_KEY] = connectionConfig(config);
    const rootRefusal = info?.notAProject && notAProjectText(info.notAProject);
    const register: typeof my.rpc.register = (definition) => {
      if (!rpcAllowed(definition.name, config)) return;
      // A source scan of a folder without an Angular project refuses and names the folder.
      if (rootRefusal && definition.agent) {
        definition = {
          ...definition,
          handler: () => {
            throw new ToolRefusal(rootRefusal);
          },
        } as typeof definition;
      }
      const exposed = !definition.agent || agentAllowed({ id: definition.name }, config);
      if (!exposed) return my.rpc.register({ ...definition, agent: undefined });
      const agent = definition.agent && { ...definition.agent, tags: agentTags(definition.name) };
      my.rpc.register(agent ? { ...definition, agent } : definition);
    };
    // Agent writes, NG errors and hydration mismatches, posted to the hub's messages.
    const feed = createHubFeed(ctx, config);
    // The URL of a page, for the line that names it in a tool answer. Set once the reports exist.
    let pageUrl: (pageId: string) => string | undefined = () => undefined;
    type AgentToolInput = Parameters<typeof ctx.agent.registerTool>[0];
    // Analog, Capacitor and TanStack Query tools wait until the app uses the library.
    const libraryGate = createLibraryGate<AgentToolInput>({
      auto: info?.autoLibraries ?? autoLibraries(),
      used: usedLibraries(
        info?.autoLibraries ?? autoLibraries(),
        [ctx.cwd, ctx.workspaceRoot],
        () => isAnalogProject(ctx.cwd),
      ),
      reporting: {
        analog: () => on.analog && analogPages().length > 0,
        capacitor: () => capacitorPages.size > 0,
        tanstackQuery: () => (tanstackQuery?.pages().length ?? 0) > 0,
      },
      register: (tool) => registerAgentTool(tool),
    });
    const agent = {
      registerTool: (tool: AgentToolInput) => {
        if (agentExposed(tool) && !libraryGate.hold(tool)) registerAgentTool(tool);
      },
      registerResource: (resource: Parameters<typeof ctx.agent.registerResource>[0]) => {
        if (agentExposed(resource))
          ctx.agent.registerResource({ ...resource, read: leased(() => interest, resource.read) });
      },
    };
    function registerAgentTool(input: AgentToolInput) {
      const tool = rootRefusal && readsSource(input.id) ? refusingTool(input, rootRefusal) : input;
      // The tier and the tags come from the tool's entry in AGENT_ENTRIES, so
      // the config is the one place that sets them.
      ctx.agent.registerTool(
        feed.wrapTool({
          ...tool,
          // Every answer is one plain text block (rpc/agent-output.ts).
          outputSchema: undefined,
          safety: agentSafety(tool.id, config),
          tags: agentTags(tool.id),
          // Arguments are checked against `inputSchema` before the lease
          // wakes any page, and refusals go out with `isError`.
          handler: answeringText(
            guardHandler(
              tool.inputSchema,
              // A live tool's answer names the page it read.
              isPageAgentEntry(tool.id)
                ? namingPageRead(
                    leased(() => interest, tool.handler),
                    pageUrl,
                  )
                : leased(() => interest, tool.handler),
              tool.id,
            ),
          ),
        }),
      );
    }

    // The panel reads the scans as RPC functions; agents read them as the `scan-*` tools.
    for (const definition of SCAN_RPC_DEFINITIONS) {
      register({ ...(definition as Parameters<typeof register>[0]), agent: undefined });
    }
    for (const spec of SCAN_TOOLS) agent.registerTool(scanTool(spec, ctx));
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
    // Pages that beat keep all their reports, so they send only what changed.
    const heartbeats = createPageHeartbeats();
    const visibility = createPageVisibility((pageId) => heartbeats.alive(pageId));
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
    // The default page of every tool: foreground first, then the newest connection.
    const pageOrder = createPageOrder(() => visibility.list());
    setPageOrder(pageOrder.rank);
    const owns = (pageId: unknown): pageId is string => {
      if (typeof pageId !== 'string' || !owners.write(pageId)) return false;
      pageOrder.seen(pageId);
      return true;
    };
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
    register({
      name: 'page-heartbeat',
      type: 'action',
      jsonSerializable: true,
      handler: (message: { pageId?: unknown } | null) => {
        const pageId = message?.pageId;
        if (typeof pageId !== 'string' || !pageId || pageId.length >= 50) return undefined;
        if (!owners.write(pageId)) return undefined;
        // The forms and router tools call a page stale by its last report, so
        // a beat counts as their report, in the shared states too.
        const now = Date.now();
        touchFormsPage(pageId, now);
        touchRouter(pageId, now);
        const known = heartbeats.beat(pageId, now, visibility.has);
        return { known, ...interest.handle({ pageId }) };
      },
    });
    const interestTick = setInterval(() => interest.tick(), INTEREST_TICK_MS);
    interestTick.unref?.();
    // A page that left is not waited for when an agent wakes the pages.
    const mayForget = (pageId: unknown): pageId is string => {
      if (typeof pageId !== 'string' || !owners.forget(pageId)) return false;
      interest.forget(pageId);
      pageOrder.forget(pageId);
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

    // Not in `__connection.json`: only a trusted page learns which names are secret.
    register({
      name: REDACTION_CONFIG_RPC,
      type: 'query',
      jsonSerializable: true,
      handler: () => config.redaction,
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
        // A claim comes before the page sends everything, so its first beat finds it known.
        if (ok) heartbeats.beat(pageId);
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
        heartbeats.touch(pageId);
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
    const latestInjectorPage = () => rankPages(injectorPages.values())[0];
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
    /** The page an NgRx read tool reads: `page`; else, unless `store` names a store, the default page. */
    const ngrxReadPage = (args: { page?: string; store?: string } | undefined) =>
      args?.page || (args?.store ? undefined : defaultPage(ngrxPages.values())?.pageId);
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
    /** A sign of life from a page with forms: its report time, here and in the shared state. */
    const touchFormsPage = (pageId: string, now = Date.now()): boolean => {
      const page = formPages.get(pageId);
      if (!page) return false;
      page.reportedAt = now;
      formsState.mutate((draft) => {
        draft.pagesReportedAt = { ...draft.pagesReportedAt, [pageId]: now };
        draft.reportedAt = Math.min(...[...formPages.values()].map((p) => p.reportedAt));
      });
      return true;
    };

    register({
      name: 'push-forms',
      type: 'action',
      jsonSerializable: true,
      handler: deltaPush(formDeltas, owns, (report) => {
        if (!isPageReport(report) || !owns(report.pageId)) return false;
        applyForms(mergePageReport(formPages, report, Date.now(), limits.formTimeline, liveTtl));
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
        pipeAcks.notify(report.pageId, report);
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
    // A page confirms a recording request by pushing its pipe report again.
    const pipeAcks = createPushAcks<PipePageReport>();
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
      // A source scan like scan-pipes, so a static report bakes it in too.
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
                outputSchema: undefined,
                safety,
                tags: agentTags(String(tool['id'])),
                handler: answeringText(
                  guardHandler(
                    tool['inputSchema'],
                    leased(() => interest, tool['handler']),
                  ),
                ),
              }),
            ),
          pageTools,
          owns,
          mayForget,
          ttl: liveTtl,
          seenAt: heartbeats.seenAt,
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
    /** A sign of life from a page with a router: its report time, here and in the shared state. */
    const touchRouter = (pageId: string, now = Date.now()): boolean => {
      if (!touchRouterPage(routerPages, pageId, now)) return false;
      routerState.mutate((draft) => {
        const page = draft.pages.find((p) => p.pageId === pageId);
        if (page) page.reportedAt = now;
      });
      return true;
    };

    register({
      name: 'push-router',
      type: 'action',
      jsonSerializable: true,
      handler: (report: unknown) => {
        if (!isRouterReport(report, limits.navigations)) return { hasConfig: false };
        if (!owns(report.pageId)) return { hasConfig: true };
        try {
          applyRouter(mergeRouterReport(routerPages, report, Date.now(), liveTtl));
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
      handler: (pageId: unknown) => ({ known: owns(pageId) && touchRouter(pageId) }),
    });

    const pendingActions = new Map<
      string,
      { pageId: string | undefined; settle: (result: unknown) => void }
    >();
    let actionSeq = 0;

    const defaultPageId = () => {
      const state = routerState.value() as RouterState;
      return (defaultPage(state.pages.filter((p) => p.snapshot)) ?? defaultPage(state.pages))
        ?.pageId;
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
        // No page could answer: say so now instead of after the 15 s wait.
        const routed = (routerState.value() as RouterState).pages;
        const known = page
          ? routed.some((p) => p.pageId === page) || componentPages.has(page) || owners.alive(page)
          : routed.length > 0 || componentPages.size > 0 || owners.live().length > 0;
        if (!known) {
          return resolve({
            error: page
              ? `Page \`${page.slice(0, 50)}\` is not connected. pangular:list-pages lists the pages that are.`
              : 'No page is connected. Open the app in a browser, or the device app in the foreground.',
          });
        }
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
        : (defaultPage(state.pages.filter((p) => p.snapshot)) ?? defaultPage(state.pages));
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
          const latest = rankPages(
            [...signalPages].map(([pageId, entry]) => ({ ...entry, pageId })),
          )[0];
          draft.graph = latest?.graph ?? null;
        }
      });
    };

    const expiry = setInterval(() => {
      // Background marks first, then beats, on one clock: a page whose data
      // goes in this sweep is gone from the beats too, so its next beat is unknown.
      const now = Date.now();
      if (visibility.expire(now)) applyVisibility();
      heartbeats.expire(now, visibility.has);
      if (angularPages.expire(liveTtl)) applyAngularPages();
      owners.expire(now);
      const staleHttp = [...httpPages].filter(([id, p]) => now - p.reportedAt > liveTtl(id));
      if (staleHttp.length) forgetHttpPages(staleHttp.map(([id]) => id));
      const stale = [...signalPages].filter(([id, p]) => now - p.reportedAt > liveTtl(id));
      if (stale.length) forgetSignalPages(stale.map(([id]) => id));
      if (expireComponentPages(componentPages, now, liveTtl)) applyComponentPages();
      if (expireCdPages(cdPages, now, liveTtl)) applyCd();
      for (const id of goneCdPages) {
        if (!componentPages.has(id) && !injectorPages.has(id)) goneCdPages.delete(id);
      }
      const staleInjectors = [...injectorPages].filter(
        ([id, p]) => now - p.reportedAt > liveTtl(id),
      );
      if (staleInjectors.length) {
        for (const [id] of staleInjectors) injectorPages.delete(id);
        applyInjectorPages();
      }
      const next = expirePages(formPages, now, limits.formTimeline, liveTtl);
      if (next) applyForms(next);
      const nextRouter = expireRouterPages(routerPages, now, liveTtl);
      if (nextRouter) applyRouter(nextRouter);
      const nextPipes = expirePipePages(pipePages, now, liveTtl);
      if (nextPipes) applyPipes(nextPipes);
      if (expireNgrxPages(ngrxPages, now, liveTtl)) applyNgrx();
      if (expireCapacitorPages(capacitorPages, now, liveTtl)) applyCapacitor();
      errorsInspector?.expire(now);
      leaksInspector?.expire(now);
      reduxStores?.expire(now);
      tanstackQuery?.expire(now);
      startupInspector?.expire(now);
      pluginsInspector?.expire(now);
      componentDeltas.prune((id) => componentPages.has(id));
      injectorDeltas.prune((id) => injectorPages.has(id));
      cdDeltas.prune((id) => cdPages.has(id));
      formDeltas.prune((id) => formPages.has(id));
      // A page that stopped reporting (a closed browser that never said
      // goodbye) is gone, so a wake doesn't wait for it.
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
      description:
        'Recent document requests the SSR server answered: id, URL, status, render mode, render time, server HttpClient calls and whether a page loaded the response. Needs ssrMiddleware or withPangularSsr(); empty otherwise.',
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
        "One SSR request end to end (`id`, else newest for `url`, else newest): status, render mode, timings, headers, server HttpClient calls, then the page's hydration and any call it repeated instead of using the transfer cache.",
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
      description:
        'HttpClient calls recorded by withPangular(), newest first: side, method, URL, status, duration, rule and cache flags, and the response preview. `view: "waterfall"` draws a page\'s client calls per navigation instead. `headers` adds headers. Masked. Empty without the interceptor.',
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
          limit: {
            type: 'integer',
            description:
              'How many calls to list (1-200, default 30); with `view: "waterfall"`, how many navigations to draw (1-50, default 5).',
          },
          preview: {
            type: 'boolean',
            description: 'Add the masked response preview of each listed call.',
          },
          headers: {
            type: 'boolean',
            description: 'Add the masked request and response headers of each listed call.',
          },
          view: {
            type: 'string',
            enum: ['list', 'waterfall'],
            description:
              '`list` (default), or `waterfall`: start offset, duration and status of each client call, grouped by navigation. `url`, `failed` and `preview` apply to the list only.',
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
        view?: 'list' | 'waterfall';
      }) => {
        if (args.view === 'waterfall') {
          const listOnly = (['url', 'failed', 'preview'] as const).filter(
            (key) => args[key] !== undefined,
          );
          if (listOnly.length) {
            return {
              markdown: refusal(
                `${listOnly.map((key) => `\`${key}\``).join(', ')} apply to the list, not to \`view: "waterfall"\`.`,
              ),
            };
          }
          return {
            markdown: httpWaterfallText(httpSnapshot(), {
              page: pageArgument(args),
              limit: args.limit,
              headers: args.headers,
            }),
          };
        }
        const snapshot = httpSnapshot();
        // Without `page`, the default page and the server render that served it, like every live tool.
        const page = pageArgument(args) ?? defaultPage(snapshot.pages ?? [])?.pageId;
        return { markdown: listHttpCallsText(snapshot, { ...args, page }) };
      },
    });

    agent.registerTool({
      id: 'pangular:capacitor-list-calls',
      title: 'List Capacitor plugin calls',
      description:
        'Capacitor plugin calls, newest first: plugin, method, native or web target, arguments, result or error and duration, plus listeners. Filter by `plugin`, `failed` or `slowMs`. Masked.',
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
      id: 'pangular:capacitor-list-plugins',
      title: 'List Capacitor plugins',
      description:
        'The Capacitor environment (platform, server URL, CapacitorHttp, user agent) and each plugin: available, imported, installed natively, methods. Flags imported plugins that are missing natively.',
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
      if (!config.actions.http) return { markdown: refusal(actionBlockedMessage('http')) };
      if ('error' in change) return { markdown: refusal(change.error) };
      setHttpRules(change.rules);
      return { markdown: ruleChangeText(verb, change.rule, change.rules) };
    };

    agent.registerTool({
      id: 'pangular:list-http-rules',
      title: 'List HTTP mock rules',
      description:
        'The HTTP fault and mock rules, in match order: id, on or off, method, URL pattern, browser or SSR scope and effect. Empty when no rule is set.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => ({
        markdown: httpRulesText(registry.rules ?? [], config.actions.http),
      }),
    });

    agent.registerTool({
      id: 'pangular:set-http-rule',
      title: 'Set an HTTP mock rule',
      description:
        'Add or replace (`id`) an HTTP fault or mock rule (dev only): `pattern` plus `status`, `delayMs` or `body`. Applies to every tab now and to SSR on the next load. Needs actions.http.',
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

    // Only the recordings this config lets an agent clear are offered as targets.
    const clearTargets: string[] = [...clearRecordingTargets(config), 'all'];
    const clearTargetList = clearTargets.map((target) => `\`${target}\``).join(', ');
    agent.registerTool({
      id: 'pangular:clear-recordings',
      title: 'Clear recordings',
      description: `Clear recorded HTTP calls, router navigations or Analog server calls between runs (\`target\`: ${clearTargetList}). \`page\` clears one page's navigations only.`,
      inputSchema: {
        type: 'object',
        required: ['target'],
        properties: {
          target: {
            type: 'string',
            enum: clearTargets,
            description: `Which recordings to clear: ${clearTargetList}.`,
          },
          page: PAGE_ARGUMENT,
        },
      },
      handler: async (args: { target?: unknown; page?: string }) => {
        const target = typeof args?.target === 'string' ? args.target : undefined;
        if (!target || !clearTargets.includes(target)) {
          return { markdown: refusal(`Pass \`target\`: one of ${clearTargetList}.`) };
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
      handler: (pageId: unknown) => ({ known: owns(pageId) && touchFormsPage(pageId) }),
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
        // Only the page's own connection gets the request: it can carry the values an agent fills in.
        // The scoped `broadcast` passes `filter` through to devframe's host; its type leaves it out.
        void (my.rpc.broadcast as (options: OwnerBroadcast) => Promise<void>)({
          method: 'form-action',
          args: [{ requestId, pageId, request: payload }],
          optional: true,
          filter: owners.deliversTo(pageId),
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
    const markCdStopped = (pageId?: string) => {
      if (markCdPagesStopped(cdPages, pageId)) applyCd();
    };
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
    // The pages confirm a recording request by pushing their recording again.
    const cdAcks = createPushAcks<CdPage>();
    const requestCdRecord = (message: { pageId?: unknown; on?: unknown; clear?: unknown }) => {
      const pageId = typeof message?.pageId === 'string' ? message.pageId.slice(0, 50) : undefined;
      const on = typeof message?.on === 'boolean' ? message.on : undefined;
      // The summary must not say "Recording is on" from the last push before the stop.
      if (on === false) markCdStopped(pageId);
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
        cdAcks.notify(page.pageId, page);
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
      // Only the page's own connection gets the value to write, not the panel or other tabs.
      broadcast: (method, message) => {
        const pageId = (message as { pageId?: unknown } | null)?.pageId;
        void (my.rpc.broadcast as (options: OwnerBroadcast) => Promise<void>)({
          method,
          args: [message],
          optional: true,
          filter: owners.deliversTo(typeof pageId === 'string' ? pageId : undefined),
        });
      },
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
        'Watch a signal (`node`, id or label) so its changes log to the console and show in inspect-signals, or unwatch with `watch: false`; `stacks` toggles write stacks. Resets on reload.',
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

    // The panel's Restore button on a signal's value history; the value stays on the page.
    const signalRestores = createSignalRestores({
      config,
      graphOf: (pageId) => signalPages.get(pageId)?.graph,
      broadcast: (method, message) =>
        void my.rpc.broadcast({ method, args: [message], optional: true }),
      answersFor,
    });
    register({
      name: 'signal-restore-result',
      type: 'action',
      jsonSerializable: true,
      handler: signalRestores.answer,
    });
    register({
      name: 'request-signal-restore',
      type: 'action',
      jsonSerializable: true,
      handler: (message: { pageId?: unknown; request?: unknown } | null) =>
        signalRestores.request(message?.pageId, message?.request),
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
        if (!owns(pageId)) return false;
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
        // Signal stores get the names the NgRx tools use (rpc/store-tokens.ts).
        const named = on.ngrx ? nameStoreTokens(page, ngrxNames()) : page;
        injectorPages.set(pageId, withFramework(named, names ?? new Set()));
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
      latest: () => defaultPage(injectorPages.values()),
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
    pageUrl = (pageId) => livePageDetails().get(pageId)?.url;
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
      return pages.map((page) => {
        const detail = details.get(page.pageId);
        return {
          pageId: page.pageId,
          reportedAt: page.reportedAt,
          url: detail?.url,
          // The Audit page picker names a page by its title before its URL.
          ...(detail?.title ? { title: detail.title } : {}),
        };
      });
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
        if (typeof page === 'string' && !all.some((p) => p.pageId === page)) {
          return resolve({
            error: `Page \`${page.slice(0, 50)}\` reports no NgRx state. pangular:list-pages lists the pages that do.`,
          });
        }
        const pageId = typeof page === 'string' ? page : defaultPage(pages)!.pageId;
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
        'Live component instances per page as JSON: rendered instances, directive hosts, counts and the selected instance detail. Empty when no page is connected. ' +
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
        'Live signal graph per page as JSON: nodes, edges (`consumer` reads `producer`, by node id), contexts, resources, value history. Empty with no page. ' +
        LIVE_RESOURCE_NOTE,
      mimeType: 'application/json',
      read: () => ({
        text: liveResourceText(
          signalStateForAgents(signalGraphState.value()),
          'pangular:inspect-signals',
        ),
      }),
    });

    agent.registerResource({
      id: 'pangular:injector-tree',
      name: 'Angular Injector Tree',
      description:
        'DI injectors per page as JSON: element and environment injectors with providers and dependencies, and the zone mode. Empty when no page is connected. Past 100,000 characters an outline with provider counts.',
      mimeType: 'application/json',
      read: () => ({
        text: injectorResourceText(injectorTreeState.value(), Object.fromEntries(injectorPages)),
      }),
    });

    agent.registerResource({
      id: 'pangular:ngrx-store',
      name: 'NgRx Store State',
      description:
        'Live NgRx state per page as JSON: signal stores, classic Store state and the change log with diffs and action origins. Empty when no page is connected. ' +
        LIVE_RESOURCE_NOTE,
      mimeType: 'application/json',
      read: () => ({
        text: liveResourceText(
          ngrxStoreState.value(),
          'pangular:ngrx-inspect-store and pangular:ngrx-history',
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

    // The same states one page at a time, for the MCP resource templates (`agent-mcp.ts`).
    providePageResources(
      ctx,
      createPageResourceSource({
        states: {
          'component-tree': componentTree,
          'signal-graph': signalGraphState,
          'injector-tree': injectorTreeState,
          'ngrx-store': ngrxStoreState,
          forms: formsState,
          router: routerState,
        },
        touch: () => interest.touch(),
      }),
    );

    const ngrxPageProperty = {
      type: 'string',
      description: 'Page id, when more than one tab reports. Defaults to every page.',
    } as const;

    agent.registerTool({
      id: 'pangular:ngrx-inspect-store',
      title: 'Inspect a signal store',
      description: INSPECT_SIGNAL_STORE_DESCRIPTION,
      inputSchema: {
        type: 'object',
        properties: {
          page: ngrxPageProperty,
          store: {
            type: 'string',
            description:
              'Store id or name (e.g. `ngrx-1` or `CartStore`, as shown on the NgRx Store page or returned by a previous call). Omit for a summary of every store across the matching page(s).',
          },
        },
      },
      handler: async (args: { page?: string; store?: string }) => ({
        markdown: withUntrustedPreamble(
          inspectSignalStoreText(
            ngrxPages,
            ngrxReadPage(args),
            storeIdNamed(ngrxPages, ngrxReadPage(args), args?.store),
          ),
        ),
      }),
    });

    agent.registerTool({
      id: 'pangular:ngrx-history',
      title: 'Show signal store history',
      description: SIGNAL_STORE_HISTORY_DESCRIPTION,
      inputSchema: {
        type: 'object',
        properties: {
          page: ngrxPageProperty,
          store: {
            type: 'string',
            description:
              'Store id or name to filter the log to. Omit to include every store, plus `@ngrx/signals/events` events with no store effect.',
          },
          after: {
            type: 'number',
            description:
              'Only return entries whose `seq` is strictly greater than this. Pass the last `seq` from a previous call to poll.',
          },
        },
      },
      handler: async (args: { page?: string; store?: string; after?: number }) => ({
        markdown: withUntrustedPreamble(
          signalStoreHistoryText(
            ngrxPages,
            ngrxReadPage(args),
            storeIdNamed(ngrxPages, ngrxReadPage(args), args?.store),
            args?.after,
          ),
        ),
      }),
    });

    // Agent tools
    const noComponentTree = (outcome: string) =>
      `No component tree has been reported${outcome}. This is what a page that has never connected reports, and also what a connected page reports when its components are not readable. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio MCP server has no page, so there it always answers this.`;
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
    // Set with the forms tools below.
    let waitForForm:
      ((args: Record<string, unknown>, timeoutMs: number) => Promise<MarkdownAnswer>) | undefined;
    const waitFor = createWaitForTool({
      forms: forAgents('forms') ? (args, timeoutMs) => waitForForm!(args, timeoutMs) : undefined,
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
        'Outline a component in the page and select it, so component-tree and inspect-signals follow it: `component` (instance id, class or tag; the first of several matches) or `selector` (CSS). `hydration: true` outlines the hydration regions instead, `false` removes them.',
      inputSchema: {
        type: 'object',
        properties: {
          component: {
            type: 'string',
            description:
              'Instance id (e.g. c12), class name (e.g. ProductCard) or host tag (e.g. app-root).',
          },
          selector: { type: 'string', description: 'A CSS selector, such as .card > h2.' },
          hydration: {
            type: 'boolean',
            description:
              'Outline the hydration regions on the page (true), or remove the outline (false).',
          },
          page: componentPageProperty,
        },
      },
      handler: async (args: {
        component?: string;
        selector?: string;
        hydration?: boolean;
        page?: string;
      }) => {
        const page = pageArgument(args);
        const all = byRecency(componentPages.values());
        if (page && !componentPages.has(page)) {
          return { markdown: unknownPageText(page, all, 'a component tree') };
        }
        const pages = page ? all.filter((entry) => entry.pageId === page) : all;
        const given = (['component', 'selector', 'hydration'] as const).filter(
          (key) => args[key] !== undefined,
        );
        if (given.length !== 1) {
          return {
            markdown: refusal(
              'Pass one of `component` (an instance id, class name or host tag), `selector` (a CSS selector) or `hydration` (true or false).',
            ),
          };
        }
        if (args.hydration !== undefined) {
          const done = hydrationOverlayText(args.hydration, pages);
          const sent = args.hydration ? pages.some((entry) => entry.hydration) : pages.length > 0;
          // Nothing to send the request to is a refusal, not a request sent.
          if (!sent) return { markdown: refusal(`${done}\n\n${hydrationText(pages)}`) };
          requestHydrationOverlay({ pageId: page, on: args.hydration });
          return { markdown: `${done}\n\n${hydrationText(pages)}` };
        }
        if (!pages.some((entry) => entry.roots.length)) {
          return refusedAnswer(noComponentTree(', so nothing was highlighted'));
        }
        const wanted = args.component ?? args.selector;
        if (typeof wanted !== 'string' || !wanted.trim()) {
          return {
            markdown: refusal(
              args.component !== undefined
                ? 'Pass `component`: an instance id, class name or host tag.'
                : 'Pass `selector`: a CSS selector.',
            ),
          };
        }
        if (args.selector !== undefined) {
          const target = page ? { pageId: page, selector: wanted } : wanted;
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
          return {
            markdown: `Sent the CSS selector \`${wanted}\` to ${page ? `page \`${page}\`` : `every page (${pages.map((entry) => `\`${entry.pageId}\``).join(', ')})`}; the page outlines it only if an element matches, which the page does not confirm.`,
          };
        }
        const hits = componentHits(wanted, page);
        const [hit] = hits;
        if (!hit) {
          const cut = truncationText(pages);
          return {
            markdown: refusal(
              `No component instance matches \`${wanted}\`${page ? ` on page \`${page}\`` : ''}, so nothing was highlighted. Pass an instance id, class name or host tag from pangular:list-components, or a CSS selector as \`selector\`.${cut ? ` ${cut}` : ''}`,
            ),
          };
        }
        const target = { pageId: hit.pageId, id: hit.node.id };
        void my.rpc.broadcast({
          method: 'highlight-in-page',
          args: [{ ...target, reveal: true, durationMs: AGENT_HIGHLIGHT_MS }],
          optional: true,
        });
        void my.rpc.broadcast({
          method: 'select-signal-component',
          args: [target],
          optional: true,
        });
        selectComponentOnPage(hit.pageId, hit.node.id);
        const others = otherMatchesText(hits, wanted);
        const otherPages = [
          ...new Set(hits.map((entry) => entry.pageId).filter((id) => id !== hit.pageId)),
        ];
        const also = otherPages.length
          ? ` It also matches on ${otherPages.map((id) => `\`${id}\``).join(', ')}. Pass \`page\` to pick another tab.`
          : '';
        return {
          markdown: `Sent a highlight request for \`${hit.node.name}\` (\`<${hit.node.tag}>\`, instance \`${hit.node.id}\` on page \`${hit.pageId}\`) and selected it.${also}${others ? `\n\n${others}` : ''}`,
        };
      },
    });

    agent.registerTool({
      id: 'pangular:inspect-component',
      title: 'Inspect a component',
      description:
        'Live details of a component instance (`component`: id, class or tag): inputs, outputs, properties, listeners, host directives, DI dependencies, change detection and source. Fields say `edit` or `locked`. `path` reads a nested value. Masked; cut at 20,000 characters.',
      inputSchema: {
        type: 'object',
        properties: {
          component: {
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
        },
        required: ['component'],
      },
      handler: async (args: {
        component: string;
        path?: unknown;
        depth?: unknown;
        limit?: unknown;
        page?: string;
      }) => {
        const page = pageArgument(args);
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
        if (typeof args.component !== 'string' || !args.component.trim()) {
          return { markdown: 'Pass `component`: an instance id, class name or host tag.' };
        }
        const hits = componentHits(args.component, page);
        const [hit] = hits;
        if (!hit) {
          return {
            markdown: [
              `No component instance matches \`${args.component}\`. Pass an instance id, class name or host tag from the pangular:component-tree resource.`,
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
        const others = otherMatchesText(hits, args.component);
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
        'Live @defer blocks: owning component, state, triggers and incremental hydration, flagging failed loads, stuck placeholders and dehydrated blocks. Every page unless `page` names one.',
      inputSchema: {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            description:
              'Page id, when more than one tab reports (see pangular:list-pages). Lists every page without it.',
          },
        },
      },
      handler: async (args: { page?: string }) => {
        const page = pageArgument(args);
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
        'Live @for blocks (Angular 22+ dev builds): owning component, item count, what `track` uses, and @empty status. Every page unless `page` names one. Up to 50 blocks per page.',
      inputSchema: {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            description:
              'Page id, when more than one tab reports (see pangular:list-pages). Lists every page without it.',
          },
        },
      },
      handler: async (args: { page?: string }) => {
        const page = pageArgument(args);
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

    agent.registerTool({
      id: 'pangular:hydration',
      title: 'Check hydration',
      description: `${HYDRATION_DESCRIPTION} pangular:highlight with \`hydration: true\` outlines the regions on the page.`,
      inputSchema: {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            description:
              'Page id, when more than one tab reports (see pangular:list-pages). Lists every page without it.',
          },
        },
      },
      handler: async (args: { page?: string }) => {
        const page = pageArgument(args);
        const unknown = unknownComponentPage(page);
        if (unknown) return unknown;
        const pages = byRecency(componentPages.values()).filter(
          (entry) => !page || entry.pageId === page,
        );
        return { markdown: hydrationText(pages) };
      },
    });

    const cdUnknown = (page: string | undefined) =>
      page &&
      cdUnknownPageText(
        page,
        cdState.value() as CdState,
        [...componentPages.values(), ...injectorPages.values()].filter(
          (entry) => !goneCdPages.has(entry.pageId),
        ),
      );

    agent.registerTool({
      id: 'pangular:change-detection',
      title: 'Read change detection',
      description:
        "Change detection cycles from Angular's profiler (Angular 20+ dev builds): slowest components, checks, durations and the zone mode. pangular:record-change-detection starts a recording. `export`: json or trace.",
      inputSchema: {
        type: 'object',
        properties: {
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
      handler: async (args: { page?: string; limit?: number; export?: string }) => {
        const unknown = cdUnknown(args?.page);
        if (unknown) return { markdown: unknown };
        if (args?.export !== undefined) {
          if (args.export !== 'json' && args.export !== 'trace') {
            return { markdown: refusal('`export` must be `json` or `trace`.') };
          }
          return {
            markdown: cdExportText(
              cdState.value() as CdState,
              { page: args.page, export: args.export },
              undefined,
              angularPages.get,
            ),
          };
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
      id: 'pangular:record-change-detection',
      title: 'Record change detection',
      description:
        'Start, stop or clear a change detection recording (`record`), and turn the live views on or off: `flash` boxes each checked component, `track` adds a Chrome Performance panel track, `angularProfiling` calls ng.enableProfiling(). Read the result with pangular:change-detection.',
      inputSchema: {
        type: 'object',
        properties: {
          record: { type: 'string', enum: ['start', 'stop', 'clear'] },
          flash: {
            type: 'boolean',
            description:
              'Turn the flash overlay on or off: a box over each component as it is checked.',
          },
          track: {
            type: 'boolean',
            description: 'Turn the "Pangular" track in the Chrome Performance panel on or off.',
          },
          angularProfiling: {
            type: 'boolean',
            enum: [true],
            description:
              "Call `ng.enableProfiling()` for Angular's own Performance panel track. It cannot be turned off until the page reloads.",
          },
          page: { type: 'string', description: 'Page id; defaults to the page that is recording.' },
        },
      },
      handler: async (args: {
        record?: string;
        page?: string;
        flash?: boolean;
        track?: boolean;
        angularProfiling?: boolean;
      }) => {
        const unknown = cdUnknown(args?.page);
        if (unknown) return { markdown: unknown };
        if (args?.record === undefined && !cdViewsAsked(args)) {
          return {
            markdown: refusal(
              'Pass `record` (start, stop or clear), or `flash`, `track` or `angularProfiling`.',
            ),
          };
        }
        if (
          args.record !== undefined &&
          args.record !== 'start' &&
          args.record !== 'stop' &&
          args.record !== 'clear'
        ) {
          return { markdown: refusal('`record` must be `start`, `stop` or `clear`.') };
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
        const record = args.record as 'start' | 'stop' | 'clear';
        const cdNow = cdState.value() as CdState;
        const answer = await cdRecordAnswer({
          record,
          page: args.page,
          connected: rankPages(
            [...componentPages.values(), ...injectorPages.values(), ...Object.values(cdNow.pages)]
              .filter((page) => !goneCdPages.has(page.pageId))
              .filter((page, i, all) => all.findIndex((p) => p.pageId === page.pageId) === i),
          ).map((page) => page.pageId),
          recording: Object.values(cdNow.pages)
            .filter((page) => page.recording && !goneCdPages.has(page.pageId))
            .map((page) => page.pageId),
          send: () =>
            requestCdRecord({
              pageId: args.page,
              on: record === 'clear' ? undefined : record === 'start',
              clear: record === 'clear',
            }),
          acks: cdAcks,
        });
        if ('refused' in answer) return answer;
        const next = answer.markdown;
        if (noViews) return { markdown: `${noViews}\n\n${next}` };
        return { markdown: views ? `${next}\n\n${views}` : next };
      },
    });

    agent.registerTool({
      id: 'pangular:diagnose-change-detection',
      title: 'Diagnose change detection',
      description:
        'Why change detection ran and what it wasted, from a recording: what started each cycle, components changed only in zone ticks, checks that changed nothing, mutated or same-value inputs, and OnPush hints. Empty until a recording ran.',
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
      description:
        'The signal graph the page last reported: nodes, edges (`consumer` reads `producer`, by node id), resources and value history. `component` names a component, `root` for root effects, or a route; `node` narrows to one node. Only signals something read appear.',
      inputSchema: {
        type: 'object',
        properties: {
          component: {
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
        required: ['component'],
      },
      handler: async (args: { component: string; page?: string } & InspectSignalsArgs) => {
        if (typeof args?.component !== 'string' || !args.component.trim()) {
          return {
            markdown: refusal(
              'Pass `component`: a host tag, class name or instance id (such as app-root), `root` for root service effects, or a route path such as /admin.',
            ),
          };
        }
        // `broadcast` resolves with nothing, so the page cannot answer a
        // question. Read the graph the overlay pushes into shared state.
        const page = pageArgument(args);
        const all = byRecency([...signalPages].map(([pageId, entry]) => ({ pageId, ...entry })));
        if (page && !signalPages.has(page)) {
          return { markdown: unknownPageText(page, all, 'a signal graph') };
        }
        const matches = (g: PageGraph) =>
          [g.componentSelector, g.component?.name, g.component?.id].includes(args.component) ||
          (!!g.injector && injectorMatches(g.injector, args.component));
        const latestMatch = () =>
          byRecency(
            [...signalPages]
              .map(([pageId, entry]) => ({ pageId, ...entry }))
              .filter((entry) => !page || entry.pageId === page),
          ).find((entry) => matches(entry.graph))?.graph;
        let matched = latestMatch();
        if (!matched && signalPages.size && isEnvironmentRequest(args.component)) {
          // Ask for this injector's graph once. The page answers without
          // changing its selected target, so the Signals page keeps its view.
          const peeked = await signalPeeks.request(
            (request) =>
              void my.rpc.broadcast({
                method: 'peek-signal-graph',
                args: [request],
                optional: true,
              }),
            args.component,
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
          'The scan-signals source scan still lists the signals in the source.',
        );
        if (!graph && signalSupport) return { markdown: signalSupport };
        if (!graph) {
          return {
            markdown: `No signal graph available. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio MCP server has no page, so there it always answers this.`,
          };
        }
        if (graph.unsupported) {
          // Angular 19.1 to 20.0 have `ɵgetSignalGraph`, but without node ids.
          const version = angularPages.get(page ?? graph.pageId)?.version;
          return {
            markdown: `**Unsupported on this Angular version.** The page's signal graph has no node ids, so there is no live graph. ${angularUnavailableText('signalGraph', version)} The scan-signals source scan still works.`,
          };
        }
        const view = { node: args.node, history: args.history, framework: args.framework };
        // Signal values come from the page, so the graph sits behind the notice, inside the cap.
        const budget = SIGNAL_TOOL_MAX - UNTRUSTED.length - 2;
        if (!matches(graph)) {
          const known = (graph.environments ?? []).map((e) => `\`${e.name}\``).join(', ');
          const covers = graph.componentSelector ?? graph.injector?.name ?? 'another target';
          const hint = isEnvironmentRequest(args.component)
            ? ` No environment injector on the page matches it${known ? `; the page knows ${known}` : ''}.`
            : '';
          const head = `No signal graph for \`${clip(args.component, 200)}\`.${hint} The live graph covers \`${covers}\`:\n\n`;
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
      description:
        'DI injectors on the page: without arguments the injector tree with providers; `injector` narrows to one injector (component, Root, Platform, Route: x); `token` finds where a token is provided and injected.',
      inputSchema: {
        type: 'object',
        properties: {
          injector: {
            type: 'string',
            description:
              'Optional. A tag name (app-card), a component or directive class name (CardComponent), an environment injector name (Root, Platform, Route: admin; case-insensitive), an injector id, or a component id from the component tree (c12). Returns only the matching injectors. At most 500 characters.',
          },
          token: {
            type: 'string',
            description:
              'Optional. A token name, such as a service class or InjectionToken description (HttpClient, API_URL). Returns where it is provided and injected. With `injector`, only injections by the matching injectors are listed. At most 500 characters.',
          },
          page: PAGE_ARGUMENT,
        },
      },
      handler: async (args: { injector?: string; token?: string; page?: string }) => {
        const requested = pageArgument(args);
        if (requested && !injectorPages.has(requested)) {
          return {
            markdown: unknownPageText(requested, [...injectorPages.values()], 'an injector tree'),
          };
        }
        const page = requested ? injectorPages.get(requested) : defaultPage(injectorPages.values());
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
        const page = requested ? injectorPages.get(requested) : defaultPage(injectorPages.values());
        const angular = angularPages.pick(page?.pageId ?? requested);
        return { page, reduced: angular?.capabilities.injectorProviders === false };
      },
    });

    const noRouter = `No router state has been reported. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio MCP server has no page, so there it always answers this.`;
    const pageProperty = PAGE_ARGUMENT;

    agent.registerTool({
      id: 'pangular:inspect-route',
      title: 'Inspect the active route',
      description:
        "The current route: URL, query params, fragment, title, in-flight navigation, the active route tree and outlets. `component` (a component or link text) checks one component's route or whether a link is active.",
      inputSchema: {
        type: 'object',
        properties: {
          page: pageProperty,
          component: {
            type: 'string',
            description:
              'Component class name, element tag or link text to explain instead of the whole route.',
          },
        },
      },
      handler: async (args: { page?: string; component?: string }) => {
        const state = routerState.value() as RouterState;
        if (!state.pages.length) return { markdown: noRouter };
        return { markdown: inspectRouteText(state, args) };
      },
    });

    agent.registerTool({
      id: 'pangular:explain-navigation',
      title: 'Explain a navigation',
      description:
        'Recent navigations, newest first: trigger, redirects and loops, phase timing, guards, resolvers, lazy loads, HTTP calls and why one failed. Filter by `url` or `id`; `perf: true` summarizes the slowest; `format: "repro"` gives a repro of one (default: the latest that failed).',
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
          format: {
            type: 'string',
            enum: ['explain', 'repro'],
            description:
              '`explain` (default), or `repro`: a markdown repro of one navigation with the version, router options, trigger, redirect chain, loops and the relevant route config. Values stay redacted.',
          },
        },
      },
      handler: async (args: {
        page?: string;
        url?: string;
        limit?: number;
        perf?: boolean;
        id?: number;
        format?: 'explain' | 'repro';
      }) => {
        const state = routerState.value() as RouterState;
        if (!state.pages.length) return { markdown: noRouter };
        if (args.format === 'repro') {
          if (args.perf) return { markdown: refusal('Pass either `perf` or `format: "repro"`.') };
          return { markdown: exportNavigationText(state, { page: args.page, id: args.id }) };
        }
        return { markdown: explainNavigationText(state, args, Date.now(), limits.navigations) };
      },
    });

    agent.registerTool({
      id: 'pangular:list-routes',
      title: 'List live routes',
      description:
        "The router's live config: every route with full path, component or redirect, lazy state, guards, resolvers, title and source file, active routes marked. `match` predicts the route for a URL; `audit` lists guards per page; `resolveLazy` loads one lazy route's children first.",
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
          resolveLazy: {
            type: 'string',
            description:
              'Route id of a lazy route (from this list) to load first, so its children are listed too.',
          },
        },
      },
      handler: async (args: {
        page?: string;
        match?: string;
        audit?: boolean;
        filter?: string;
        resolveLazy?: string;
      }) => {
        let state = routerState.value() as RouterState;
        if (!state.pages.length) return { markdown: noRouter };
        let resolved = '';
        if (args.resolveLazy !== undefined) {
          const target = routerTarget(args.page);
          if (!('pageId' in target)) return target;
          const result = await requestRouterAction(target.pageId, {
            action: 'resolve-lazy',
            id: args.resolveLazy,
          });
          const answer = routerActionAnswer('resolve-lazy', target.pageId, result, []);
          if (refusalOf(answer) !== undefined) return { markdown: answer };
          resolved = `${answer}\n\n`;
          state = routerState.value() as RouterState;
        }
        let sources: ReturnType<typeof extractRoutes> = [];
        try {
          sources = extractRoutes(ctx.cwd);
        } catch {
          sources = [];
        }
        return { markdown: `${resolved}${listRoutesText(state, args, sources)}` };
      },
    });

    agent.registerTool({
      id: 'pangular:lint-routes',
      title: 'Lint routes',
      description:
        "Checks the live route config: routes after '**', shadowed params, empty paths without pathMatch full, redirect loops, deprecated guards, title and security issues, and the first 100 RouterLinks on the page.",
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
        'How the router is set up: provideRouter or forRoot, effective options (set or default), features, strategies, base href, hydration and whether guard instrumentation is on.',
      inputSchema: { type: 'object', properties: { page: pageProperty } },
      handler: async (args: { page?: string }) => {
        const state = routerState.value() as RouterState;
        if (!state.pages.length) return { markdown: noRouter };
        return { markdown: routerConfigText(state, args) };
      },
    });

    agent.registerTool({
      id: 'pangular:scan-render-mode',
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

    // The page each router write runs in: the one asked for, or the only one with a router.
    const routerTarget = (
      page: string | undefined,
    ): { pageId: string } | MarkdownAnswer | ReturnType<typeof refusedAnswer> => {
      const state = routerState.value() as RouterState;
      const routed = state.pages.filter((p) => p.snapshot);
      // Every action runs in one page; one the caller did not choose only when it is the only one.
      if (!page && routed.length > 1) {
        return { markdown: choosePageText(withPageUrls(routed), 'a router') };
      }
      const target = page ? state.pages.find((p) => p.pageId === page) : defaultPage(routed);
      if (page && !target) return { markdown: noPage(page, state) };
      if (!target?.snapshot) {
        return refusedAnswer(
          page
            ? `Page \`${page}\` reports no Router, so there is nothing to navigate. The app may not use the Angular router, or it is not a development build.`
            : noRouter,
        );
      }
      return { pageId: target.pageId };
    };
    /** Sends one page router action and answers with its result. */
    const runRouterAction = async (
      page: string | undefined,
      request: { action: string } & Record<string, unknown>,
    ) => {
      const target = routerTarget(page);
      if (!('pageId' in target)) return target;
      const result = await requestRouterAction(target.pageId, request);
      const navigations = routerPages.get(target.pageId)?.navigations;
      return {
        markdown: routerActionAnswer(request.action, target.pageId, result, navigations),
      };
    };

    const NAVIGATE_ACTIONS = ['go', 'abort', 'replay'] as const;
    agent.registerTool({
      id: 'pangular:navigate',
      title: 'Navigate the app',
      description:
        'Router writes in the running app (dev only): `go` (`url`, or `pattern` + `params`), `abort` the navigation in flight, `replay` a recorded one (`id`). Needs `page` when several tabs report a router; the result names the page.',
      inputSchema: {
        type: 'object',
        properties: {
          page: pageProperty,
          action: { type: 'string', enum: [...NAVIGATE_ACTIONS] },
          url: { type: 'string', description: 'For go: a same-origin path such as /users/42.' },
          pattern: {
            type: 'string',
            description: 'For go: a route path such as /users/:id, filled from `params`.',
          },
          params: { type: 'object', additionalProperties: { type: 'string' } },
          replaceUrl: { type: 'boolean' },
          skipLocationChange: { type: 'boolean' },
          waitFor: {
            type: 'string',
            enum: ['navigation', 'stable'],
            description:
              'For go. "navigation" (default) returns when the navigation ends. "stable" also waits until the app has no pending tasks (HTTP requests, httpResource loads, timers), like ApplicationRef.whenStable(); the result says `stable: true`, or `stable: false` when 10s ran out first.',
          },
          id: { type: 'integer', description: 'Navigation id for replay.' },
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
      }) => {
        if (!(NAVIGATE_ACTIONS as readonly unknown[]).includes(args?.action)) {
          const known = NAVIGATE_ACTIONS.map((name) => `\`${name}\``).join(', ');
          return {
            markdown: refusal(
              typeof args?.action === 'string' && args.action
                ? `Unknown action \`${args.action.slice(0, 40)}\`. Pass \`action\`: one of ${known}.`
                : `Pass \`action\`: one of ${known}.`,
            ),
          };
        }
        if (!config.actions.router) return { markdown: refusal(actionBlockedMessage('router')) };
        const request =
          args.action === 'go'
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
              : { action: 'abort' };
        return runRouterAction(args.page, request);
      },
    });

    agent.registerTool({
      id: 'pangular:probe-route',
      title: 'Probe a route',
      description:
        "Which route a URL would match in the running app, without navigating: runs the routes' canMatch guards (dev only) and answers the matched route, the guards' results and why it stopped. Needs actions.router.",
      inputSchema: {
        type: 'object',
        properties: {
          page: pageProperty,
          url: { type: 'string', description: 'A same-origin path such as /admin/users.' },
        },
        required: ['url'],
      },
      handler: async (args: { page?: string; url?: string }) => {
        if (!config.actions.router) return { markdown: refusal(actionBlockedMessage('router')) };
        return runRouterAction(args.page, { action: 'probe', url: args.url });
      },
    });

    agent.registerTool({
      id: 'pangular:record-guards',
      title: 'Record guard timing',
      description:
        "Turn guard and resolver recording on (`on: true`, the default) or off in the page, so pangular:explain-navigation shows each guard's and resolver's result and time. Wraps the router's guards until the page reloads.",
      inputSchema: {
        type: 'object',
        properties: {
          page: pageProperty,
          on: { type: 'boolean', description: 'true starts recording (default), false stops it.' },
        },
      },
      handler: async (args: { page?: string; on?: boolean }) =>
        runRouterAction(args.page, { action: 'instrument', on: args.on !== false }),
    });

    agent.registerTool({
      id: 'pangular:ngrx-dispatch',
      title: 'Dispatch an NgRx action',
      description:
        'Dispatch an action (`type`, `payload`) or redispatch a logged one (`seq`) to the @ngrx/store Store (dev only); returns the log entry with origin and diff. Needs `page` when several tabs have a Store, and actions.ngrx.',
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
        const target = page ? ngrxPages.get(page) : defaultPage(stores);
        if (!target?.classic) {
          return {
            markdown: refusal(
              page
                ? `Page \`${page}\` has no @ngrx/store Store, so there is nothing to dispatch to.`
                : 'No connected page has an @ngrx/store Store. Open the app in a browser; the Store shows up once provideStore() or StoreModule.forRoot() runs.',
            ),
          };
        }
        let request: NgrxRequest;
        if (args.seq !== undefined) {
          if (!Number.isInteger(args.seq))
            return { markdown: refusal('seq must be a log entry number.') };
          request = { type: 'dispatch-again', seq: args.seq as number };
        } else {
          const problem = dispatchProblem(args.type, args.payload);
          if (problem) return { markdown: refusal(problem) };
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

    const noForms = `No forms have been reported. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser, on a page that renders a form. The stdio MCP server has no page, so there it always answers this.`;
    /**
     * `args` with `page` set to the default page (`default-page.ts`) when the
     * call names neither a page nor a form, so a form tool reads one tab like
     * every other tool. A `form` names its page itself.
     */
    const onDefaultFormPage = <A>(args: A): A => {
      const record = (args ?? {}) as { page?: unknown; form?: unknown };
      if (pageArgument(record as Record<string, unknown>)) return args;
      if (typeof record.form === 'string' && record.form) return args;
      const forms = (formsState.value() as FormsState).forms;
      const reporting = [...formPages.values()].filter((page) =>
        forms.some((form) => form.id.endsWith(`@${page.pageId}`)),
      );
      const page = defaultPage(reporting);
      return page ? ({ ...record, page: page.pageId } as A) : args;
    };
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
      description:
        'Forms on the page (Signal Forms, reactive, template-driven). Without `form`: each form with status and error counts. With `form`: the field tree; narrow with `path`, `onlyInvalid`, `includeValues`. Reads 100 fields per group and says when it cut one. Masked; cut at 20,000 characters.',
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
        return { markdown: inspectFormsText(state, onDefaultFormPage(args)) };
      },
    });

    agent.registerTool({
      id: 'pangular:explain-invalid-forms',
      title: 'Explain invalid forms',
      description:
        'Why forms are invalid: each failing field with value, validator, message and touched state, plus pending async validators and disabled reasons. Without `form`, every invalid form. Reads 100 fields per group; says when a failing field may be past that.',
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
        return { markdown: explainFormsText(state, onDefaultFormPage(args)) };
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
        return { markdown: fn(state, onDefaultFormPage(args ?? ({} as A))) };
      };
    const str = (value: unknown) => (typeof value === 'string' ? value : undefined);

    agent.registerTool({
      id: 'pangular:explain-field',
      title: 'Explain a form field',
      description:
        'One form field in depth (`form` + `path`, or `selector`): value, flags, each error and where it comes from, why validation is skipped, pending input, the binding and DOM facts.',
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
        'What submitting a form will do and why it might do nothing: submit setup, DOM reasons, blocking and pending fields, and recent submits with their outcome.',
      inputSchema: { type: 'object', properties: { form: formProperty, page: formPageProperty } },
      handler: withForms(explainSubmitText),
    });

    agent.registerTool({
      id: 'pangular:inspect-form-payload',
      title: 'Show a form payload',
      description:
        'What a form would send: form.value against getRawValue() and the fields each drops or keeps, plus what the user changed. `path` narrows to one group.',
      inputSchema: {
        type: 'object',
        properties: { form: formProperty, path: pathProperty, page: formPageProperty },
      },
      handler: withForms(formPayloadText),
    });

    agent.registerTool({
      id: 'pangular:list-form-changes',
      title: 'Show form history',
      description:
        'Timeline of form changes (value, status, submit, fields added or removed) tagged with origin (user, code, devtools, binding, agent). Filter by form, path, type, origin or `after` (a marker); returns the current marker.',
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
          after: { type: 'number', description: 'Only events after this marker.' },
          limit: { type: 'number', description: 'Max events (default 50, max 200).' },
          page: formPageProperty,
        },
      },
      handler: withForms(formHistoryText),
    });

    agent.registerTool({
      id: 'pangular:explain-form-changes',
      title: 'Diff form values',
      description:
        'Net change of a form since a marker: each field whose value or status ended different, with from → to and how many changes happened in between. Get a marker from list-form-changes, inspect-forms or a run-form-action result, act, then call this.',
      inputSchema: {
        type: 'object',
        properties: {
          form: formProperty,
          after: {
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
        'Checks live forms: stale validity, stuck PENDING, unreachable submit, hidden fields still rendered, view and model out of sync, [disabled] on reactive controls, unbound required fields, NG01xxx errors and accessibility.',
      inputSchema: { type: 'object', properties: { form: formProperty, page: formPageProperty } },
      handler: async (args: { form?: string; page?: string }) => {
        const state = formsState.value() as FormsState;
        if (!state.forms.length && !state.setupErrors?.length) return { markdown: noForms };
        const elsewhere = unknownFormPage(args);
        if (elsewhere) return elsewhere;
        return { markdown: lintFormsText(state, onDefaultFormPage(args ?? {})) };
      },
    });

    agent.registerTool({
      id: 'pangular:scan-pipe-usage',
      title: 'Lint pipes',
      description:
        'Source checks of pipes: impure pipes inside @for, `| json` left in templates, pure pipes that read signals, and method calls piped to `| async`.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => ({ markdown: lintPipesText(ctx.cwd) }),
    });

    agent.registerTool({
      id: 'pangular:explain-pipe',
      title: 'Explain a pipe',
      description:
        'One pipe by name: where it is declared and used, purity, live instances and calls, time, errors and last input and output while recording, async misuse and lint findings.',
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
        'Start or stop recording pipe calls (`action`), like Record calls in the Pipes panel; explain-pipe then shows counts, time, inputs and stale-argument checks. `start` uses the default page; `stop` without `page` stops every page that records.',
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
        const { on } = asked.request;
        const targets = pipeRecordTargets(asked.request, pipePages);
        // A page already in the asked state pushes nothing new; it counts as confirmed.
        const already = targets.filter((id) => (pipePages.get(id)?.instrumented ?? false) === on);
        const pending = targets.filter((id) => !already.includes(id));
        const confirmed = pipeAcks.wait(pending, (report) => (report.instrumented ?? false) === on);
        if (pending.length) {
          requestPipeRecording(targets.length === 1 ? { pageId: targets[0], on } : { on });
        }
        const done = new Set([...already, ...(await confirmed)]);
        return {
          markdown: pipeRecordText(
            on,
            targets,
            targets.filter((id) => done.has(id)),
          ),
        };
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

    // `wait-for` with `condition: "form"`: polls the forms state until the condition holds.
    waitForForm = async (raw, timeout) => {
      const args = raw as {
        form?: string;
        until?: WaitUntil;
        after?: number;
        page?: string;
      };
      const elsewhere = unknownFormPage(args);
      if (elsewhere) return elsewhere as MarkdownAnswer;
      const start = Date.now();
      while (true) {
        const state = formsState.value() as FormsState;
        if (waitSatisfied(state, args)) {
          return {
            markdown: `Condition \`${args.until ?? 'settled'}\` holds after ${Date.now() - start}ms. Marker: ${latestMarker(state)}.\n\n${explainFormsText(state, { form: args.form, page: args.page })}`,
          };
        }
        if (Date.now() - start >= timeout) {
          return {
            markdown: `Timed out after ${timeout}ms waiting for \`${args.until ?? 'settled'}\`.\n\n${explainFormsText(state, { form: args.form, page: args.page })}`,
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    };

    /**
     * The forms state once the page pushed the events of a write, so the
     * marker an answer gives includes them. Waits at most 1s.
     */
    const formsAfter = async (marker: number, result: Record<string, unknown>) => {
      // A refused write changed nothing, so there is nothing to wait for.
      if (!result['ok']) return formsState.value() as FormsState;
      for (let waited = 0; waited < 1000; waited += 50) {
        const state = formsState.value() as FormsState;
        if (latestMarker(state) > marker) return state;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return formsState.value() as FormsState;
    };

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
        `Marker: ${latestMarker(state)}. Call explain-form-changes with \`after\` set to the marker you had before this action to see what changed.`,
      );
      // The page writes the message, errors and skipped reasons.
      const text = untrusted(lines.join('\n'));
      return result['ok'] ? text : refusal(text);
    };

    agent.registerTool({
      id: 'pangular:run-form-action',
      title: 'Run a form action',
      description:
        'Act on a live form (dev only): set-value, mark-touched/untouched/dirty/pristine, touch-all, revalidate, reset, enable, disable, submit, focus, focus-first-invalid, store-as-global, snapshot, restore, instrument. reset, submit and restore need `confirm: true`.',
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
        if (!state.forms.length) return refusedAnswer(noForms);
        const match = resolveForm(state.forms, str(args?.['form']));
        if (typeof match === 'string') return { markdown: match };
        const { form: _form, ...rest } = args;
        // A form id ends with its page id, after the @.
        notePageRead(match.id.split('@')[1]);
        const before = latestMarker(state);
        const result = await requestFormAction({ ...rest, formId: match.id });
        return { markdown: actionText(result, await formsAfter(before, result)) };
      },
    });

    agent.registerTool({
      id: 'pangular:fill-form',
      title: 'Fill a form',
      description:
        'Fill several fields by dotted path through the inputs like a user would. Reports written and skipped fields (secret, hidden, readonly, disabled, missing) and the status. `submit` submits afterwards (needs `confirm: true`).',
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
        if (!state.forms.length) return refusedAnswer(noForms);
        const match = resolveForm(state.forms, str(args?.['form']));
        if (typeof match === 'string') return { markdown: match };
        notePageRead(match.id.split('@')[1]);
        const before = latestMarker(state);
        const result = await requestFormAction({
          action: 'fill',
          formId: match.id,
          values: args['values'],
          mode: args['mode'],
          submit: args['submit'],
          confirm: args['confirm'],
        });
        return { markdown: actionText(result, await formsAfter(before, result)) };
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
          // An idle page sends only its heartbeat, which counts as a report here.
          reportedAt: Math.max(page.reportedAt, heartbeats.seenAt(page.pageId) ?? 0),
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

    // Replaces devframe's built-in shared-state reader with a capped one (rpc/state-read-tool.ts).
    const stateHost = ctx.rpc.sharedState as unknown as {
      keys(): string[];
      get(key: string): Promise<{ value(): unknown }>;
    };
    const stateRead = stateReadTool({
      keys: () => stateHost.keys(),
      value: async (key) => (await stateHost.get(key)).value(),
      exposed: (key) => sharedStateExposed(key, config),
      readBy: (key) => STATE_READ_BY[key],
    });
    ctx.agent.registerTool({
      ...stateRead,
      handler: answeringText(guardHandler(stateRead.inputSchema, stateRead.handler)),
    });

    agent.registerTool({
      id: 'pangular:list-pages',
      title: 'List connected pages',
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
  /**
   * The folder the server scans, when it holds no Angular project (a wrong
   * `--root`). Source scan tools then refuse and name it, so the agent sees
   * why they would come back empty.
   */
  notAProject?: string;
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
        notAProject: host.notAProject,
        autoLibraries: autoLibraries(options),
      };
      // First, so devframe opens its token store in the private folder.
      // The stdio MCP server (no page tools) has no clients to trust.
      if (host.pageTools !== false) guardAuth(ctx);
      if (host.authTokens?.length && !registerAuthTokens(ctx, host.authTokens)) {
        console.warn(
          '[pangular] The pairing tokens could not be registered, so clients need the one-time code.',
        );
      }
      return pangular.setup(ctx, withConfig);
    },
  });
}

/** Rate-limits the one-time code and expires old tokens (`auth-guard.ts`, `auth-store.ts`). */
function guardAuth(ctx: Parameters<typeof pangular.setup>[0]): void {
  const dir = scopeAuthStore(ctx);
  // devframe writes the token file 100 ms after a change, with the default mode.
  const protect = () => {
    if (dir) setTimeout(() => protectAuthFile(dir), 500).unref?.();
  };
  if (!registerCodeGuard(ctx, { onTrusted: protect })) {
    console.warn('[pangular] The one-time code guard could not be registered.');
  }
  expireAuthTokens(ctx, protect);
}

/**
 * devframe's `initDevframe()`, from the copy this package depends on, to mount
 * the panel without the hub. A separate `devframe` install can resolve another
 * version.
 */
export { initDevframe } from 'devframe/initiate';

export default pangular;
