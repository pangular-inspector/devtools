import type { DevframeSetupInfo, RemoteAssets } from 'devframe';
import { defineDevframe } from 'devframe';
import { createSharedState } from 'devframe/utils/shared-state';
import { PANGULAR_LOGO_DATA_URI } from './brand.ts';
import { SCAN_RPC_DEFINITIONS, SCAN_TOOLS, scanTool } from './rpc/scan-tools.ts';
import {
  expireCapacitorPages,
  mergeCapacitorReport,
  patchCapacitorState,
  syncCapacitorState,
  toCapacitorReport,
  type CapacitorPage,
  type CapacitorState,
} from './rpc/capacitor-tools.ts';
import { pageHighlightTarget } from './rpc/page-highlight-target.ts';
import { registerConsoleGlobals } from './rpc/console-globals.ts';
import { registerErrors } from './rpc/errors-register.ts';
import { registerServerErrors } from './rpc/server-errors-register.ts';
import { registerHttpAgentTools } from './devframe-http-tools.ts';
import { registerFormsAgentTools } from './devframe-forms-tools.ts';
import { registerComponentAgentTools } from './devframe-component-tools.ts';
import { registerRouterAgentTools } from './devframe-router-tools.ts';
import { registerPerformance } from './rpc/perf-register.ts';
import { registerBuild } from './rpc/build-register.ts';
import { registerSnapshot } from './rpc/snapshot-tools.ts';
import { registerLeaks } from './rpc/leaks-register.ts';
import { registerReduxStores } from './rpc/redux-stores-register.ts';
import { registerTanstackQuery } from './rpc/query-register.ts';
import { registerPlugins } from './rpc/plugins-register.ts';
import { registerStartup } from './rpc/startup-register.ts';
import { registerIonic } from './rpc/ionic-register.ts';
import type { PangularServerPlugin } from './plugin.ts';
import { registerAudit } from './rpc/audit-register.ts';
import { INJECTOR_TREE_LIMITS, sanitizeInjectorTree } from './rpc/injector-report.ts';
import { createFrameworkNames, markFramework } from './rpc/framework-tokens.ts';
import { lintPipes } from './rpc/pipe-lint.ts';
import { cachedPipeLint } from './rpc/pipe-lint-cache.ts';
import { scanPipes } from './rpc/get-pipes.ts';
import { createPageOwners, type OwnerBroadcast } from './rpc/page-owners.ts';
import { trackPageSessions } from './rpc/page-sessions.ts';
import { createOpenInEditor, defaultLauncher } from './rpc/open-in-editor.ts';
import { isAnalogProject, servedAnalogRoot } from './rpc/analog-scan.ts';
import { signalStateForAgents } from './rpc/signal-tools.ts';
import { createSignalPeeks } from './rpc/signal-peeks.ts';
import {
  signalWatchRequest,
  watchSignalRequests,
  watchSignalText,
  type WatchSignalArgs,
} from './rpc/signal-watch-tools.ts';
import { signalOwner } from './signal-graph.ts';
import { scanNgrxStore } from './rpc/get-ngrx-store.ts';
import { createNgrxHistory } from './rpc/ngrx-session-tools.ts';
import { createProviderValues } from './rpc/provider-values.ts';
import { requestInjectorRefresh } from './rpc/injector-refresh.ts';
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
import { createNgrxDevtoolsTools } from './rpc/ngrx-devtools-tools.ts';
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
import { ZONE_MODES } from './zone-mode.ts';
import {
  expireComponentPages,
  findComponents,
  isComponentReport,
  latestComponentPage,
  toComponentPage,
} from './rpc/component-tools.ts';
import { createDeferLoads } from './rpc/defer-loads.ts';
import { PICK_KEYS } from './component-pick.ts';
import { createComponentEdits } from './rpc/component-edits.ts';
import { createSignalRestores } from './rpc/signal-restores.ts';
import { createComponentValues } from './rpc/component-values.ts';
import {
  formsResourceText,
  currentForms,
  expirePages,
  isPageReport,
  matchForms,
  mergePageReport,
  type PageReport,
  type FormsState,
} from './rpc/forms-tools.ts';
import { playwrightTestText } from './rpc/forms-playwright.ts';
import {
  explainFieldText,
  explainSubmitText,
  exportFormText,
  type FieldArgs,
  formPayloadText,
  lintFormsFor,
} from './rpc/forms-explain.ts';
import { findFormSource } from './rpc/forms-source.ts';
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
  isRouterReport,
  mergeRouterReport,
  routerResourceText,
  touchRouterPage,
  type RouterPage,
  type RouterState,
} from './rpc/router-tools.ts';
import { exportNavigationText, matchUrl, routerLintResult } from './rpc/router-config-tools.ts';
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
import { redactMessage, redactUrl } from './router.ts';
import { isSsrRequestId, ssrRegistry } from './ssr-registry.ts';
import { sanitizeSsrOverrides, type SsrOverride } from './ssr-overrides.ts';
import { ssrOverrideTools } from './rpc/ssr-override-tools.ts';
import { createComponentScreenshots } from './rpc/component-screenshots.ts';
import { sanitizeSsrRequest } from './rpc/ssr-tools.ts';
import {
  expireCdPages,
  markCdPagesStopped,
  toCdPage,
  type CdPage,
  type CdState,
} from './rpc/cd-tools.ts';
import { toCdOptionsRequest } from './cd-data.ts';
import type { HttpPage, HttpPayloadState, HttpReport, HttpState } from './types.ts';

import { analogPages, nameServerFns, registerAnalog } from './rpc/analog-register.ts';
import { createPageHeartbeats } from './rpc/page-heartbeats.ts';
import { createPageVisibility } from './rpc/page-ttl.ts';
import { guardPangularSharedStateWrites } from './rpc/shared-state-write-guard.ts';
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
  agentSafety,
  agentTags,
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
import { securityStatusHandler, type PangularSecurityHost } from './security-status.ts';
import { watchTokenRotation } from './auth-rotate.ts';
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
import { createPageOrder, defaultPage, rankPages, setPageOrder } from './rpc/default-page.ts';
import { namingPageRead } from './rpc/page-read-scope.ts';
import { navigationDiffResult } from './rpc/router-diff.ts';
import { callsForNavigation, nextNavigation } from './rpc/router-http.ts';
import { NavigationStream } from './rpc/router-stream.ts';
import { routePreviewResult } from './rpc/router-preview.ts';
import { routerStateForApp } from './rpc/router-apps.ts';
import { nameStoreTokens } from './rpc/store-tokens.ts';
import { notAProjectText, readsSource, refusingTool } from './rpc/project-root.ts';
import { STATE_READ_BY, stateReadTool } from './rpc/state-read-tool.ts';
import { createLibraryGate, usedLibraries } from './rpc/library-tools.ts';
import { createPushAcks } from './rpc/push-acks.ts';
import { refusal, ToolRefusal } from './rpc/refusal.ts';

type PageGraph = SignalGraph & { pageId?: string };

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
  /** How the host lets clients in, and how many pairing tokens it took, for `security-status`. */
  security?: PangularSecurityHost;
  pairingTokens?: number;
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
    guardPangularSharedStateWrites(ctx.rpc);
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
      handler: () => lintPipes(ctx.cwd, { rules: config.lint.rules }),
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
    // SSR and Vite errors of this process (`server-errors.ts`); no page reports them.
    const serverErrors = on.errors
      ? await registerServerErrors({ my, register, agent, capture: pageTools })
      : null;
    const perfInspector = on.performance
      ? await registerPerformance({
          my,
          rpcHost: ctx.rpc,
          register,
          agent,
          owns,
          mayForget,
          ttl: liveTtl,
        })
      : null;
    if (on.build) registerBuild({ register, agent, root: ctx.cwd });
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
    // The `ion-router-outlet` stacks of Ionic pages, shown in the Capacitor tab.
    const ionicInspector = on.capacitor
      ? await registerIonic({ my, rpcHost: ctx.rpc, register, owns, mayForget, ttl: liveTtl })
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
    /** Every navigation the pages report, numbered, for pangular:follow-navigations. */
    const navigationStream = new NavigationStream();
    /** Drops the stream entries and signatures of pages that expired or were forgotten. */
    const dropGoneStreamPages = () => {
      for (const id of navigationStream.pageIds()) {
        if (!routerPages.has(id)) navigationStream.clear(id);
      }
    };
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
        // Merging a report expires stale pages too.
        dropGoneStreamPages();
        // A report that failed to merge left no page, so its navigations stay out of the stream.
        if (routerPages.has(report.pageId)) {
          navigationStream.record(report.pageId, report.navigations);
        }
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

    const requestRouterAction = (page: string | undefined, request: unknown, app?: string) => {
      const action = (request as { action?: unknown } | undefined)?.action;
      return !config.actions.router && ROUTER_WRITE_ACTIONS.includes(action as string)
        ? Promise.resolve<unknown>({ error: actionBlockedMessage('router') })
        : sendRouterAction(page, request, app);
    };

    const sendRouterAction = (page: string | undefined, request: unknown, app?: string) =>
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
          // `app` picks one app on a page that runs several (`router-apps.ts`).
          args: [{ requestId, pageId, request, ...(app ? { app } : {}) }],
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
      handler: (message: { pageId?: string; app?: unknown; request?: unknown }) =>
        requestRouterAction(
          typeof message?.pageId === 'string' ? message.pageId : undefined,
          message?.request,
          typeof message?.app === 'string' ? message.app.slice(0, 60) : undefined,
        ),
    });

    /** The router state with one page shown as one of its apps, for the panel's app picker. */
    const routerStateFor = (pageId: unknown, app: unknown): RouterState => {
      const state = routerState.value() as RouterState;
      if (typeof app !== 'string' || !app) return state;
      const scoped = routerStateForApp(state, {
        page: typeof pageId === 'string' ? pageId : undefined,
        app,
      });
      // An app the page does not have shows nothing, never the first app under its name.
      return 'error' in scoped ? { pages: [] } : scoped.state;
    };
    const pageFor = (pageId: unknown, app?: unknown) => {
      const state = routerStateFor(pageId, app);
      return typeof pageId === 'string'
        ? state.pages.find((p) => p.pageId === pageId)
        : (defaultPage(state.pages.filter((p) => p.snapshot)) ?? defaultPage(state.pages));
    };

    register({
      name: 'router-lint',
      type: 'query',
      jsonSerializable: true,
      // A page id, or `{ pageId, app }` for one app of a page that runs several.
      handler: (target: unknown) =>
        routerLintResult(
          target && typeof target === 'object'
            ? pageFor((target as { pageId?: unknown }).pageId, (target as { app?: unknown }).app)
            : pageFor(target),
          {
            rules: config.lint.rules,
            httpFor: routerHttpCalls,
          },
        ),
    });

    register({
      name: 'router-match',
      type: 'query',
      jsonSerializable: true,
      handler: (message: { pageId?: unknown; app?: unknown; url?: unknown }) => {
        const page = pageFor(message?.pageId, message?.app);
        if (!page?.config || typeof message?.url !== 'string') return null;
        return matchUrl(page.config, message.url.slice(0, 2000));
      },
    });

    /** The HTTP inspector's calls of a page, for the router's per-navigation HTTP join. */
    const routerHttpCalls = (pageId: string) =>
      on.http ? httpPages.get(pageId)?.calls : undefined;

    register({
      name: 'router-http',
      type: 'query',
      jsonSerializable: true,
      handler: (message: { pageId?: unknown; app?: unknown; id?: unknown }) => {
        const page = pageFor(message?.pageId, message?.app);
        const nav = page?.navigations.find((n) => n.id === message?.id);
        if (!page || !nav) return null;
        return callsForNavigation(
          nav,
          nextNavigation(page.navigations, nav),
          routerHttpCalls(page.pageId),
        );
      },
    });

    /** The source routes and ServerRoute entries a preview names, empty when the scan fails. */
    const previewScans = () => {
      let sources: ReturnType<typeof extractRoutes> = [];
      let serverRoutes: ReturnType<typeof scanServerRoutes> = [];
      try {
        sources = extractRoutes(ctx.cwd);
      } catch {
        sources = [];
      }
      try {
        serverRoutes = scanServerRoutes(ctx.cwd);
      } catch {
        serverRoutes = [];
      }
      return { sources, serverRoutes };
    };

    register({
      name: 'router-preview',
      type: 'query',
      jsonSerializable: true,
      handler: (message: { pageId?: unknown; app?: unknown; url?: unknown }) => {
        const { sources, serverRoutes } = previewScans();
        return routePreviewResult(
          routerStateFor(message?.pageId, message?.app),
          {
            page: typeof message?.pageId === 'string' ? message.pageId : undefined,
            url: typeof message?.url === 'string' ? message.url : undefined,
          },
          sources,
          serverRoutes,
        );
      },
    });

    register({
      name: 'router-diff',
      type: 'query',
      jsonSerializable: true,
      handler: (message: { pageId?: unknown; app?: unknown; a?: unknown; b?: unknown }) =>
        navigationDiffResult(routerStateFor(message?.pageId, message?.app), {
          page: typeof message?.pageId === 'string' ? message.pageId : undefined,
          a: typeof message?.a === 'number' ? message.a : undefined,
          b: typeof message?.b === 'number' ? message.b : undefined,
        }),
    });

    register({
      name: 'router-export',
      type: 'query',
      jsonSerializable: true,
      handler: (message: { pageId?: unknown; app?: unknown; id?: unknown }) =>
        exportNavigationText(routerStateFor(message?.pageId, message?.app), {
          page: typeof message?.pageId === 'string' ? message.pageId : undefined,
          id: typeof message?.id === 'number' ? message.id : undefined,
        }),
    });

    register({
      name: 'clear-router-navigations',
      type: 'action',
      jsonSerializable: true,
      // A page id, or `{ pageId, app }` to clear one app of a page that runs several.
      handler: (target: unknown) => {
        if (!config.actions.router) throw new Error(actionBlockedMessage('router'));
        const record =
          target && typeof target === 'object' ? (target as Record<string, unknown>) : {};
        const pageId = typeof target === 'string' ? target : record['pageId'];
        const app = typeof record['app'] === 'string' && record['app'] ? record['app'] : undefined;
        if (typeof pageId !== 'string') throw new Error('Give the id of the page to clear.');
        const page = routerPages.get(pageId);
        const secondary = !!app && !!page?.apps?.some((a) => a.id === app && !a.primary);
        if (clearRouterNavigations(routerPages, pageId, Date.now(), app)) {
          applyRouter(currentRouter(routerPages));
        }
        // The stream follows the first app only.
        if (!secondary) navigationStream.clear(pageId);
        void my.rpc.broadcast({
          method: 'router-clear',
          args: [app ? { pageId, app } : { pageId }],
          optional: true,
        });
      },
    });

    register({
      name: 'forget-router-page',
      type: 'action',
      jsonSerializable: true,
      handler: (pageId: string) => {
        if (mayForget(pageId) && routerPages.delete(pageId)) {
          applyRouter(currentRouter(routerPages));
          navigationStream.clear(pageId);
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
      if (nextRouter) {
        applyRouter(nextRouter);
        dropGoneStreamPages();
      }
      const nextPipes = expirePipePages(pipePages, now, liveTtl);
      if (nextPipes) applyPipes(nextPipes);
      if (expireNgrxPages(ngrxPages, now, liveTtl)) applyNgrx();
      if (expireCapacitorPages(capacitorPages, now, liveTtl)) applyCapacitor();
      errorsInspector?.expire(now);
      serverErrors?.expire(now);
      perfInspector?.expire(now);
      leaksInspector?.expire(now);
      reduxStores?.expire(now);
      tanstackQuery?.expire(now);
      startupInspector?.expire(now);
      ionicInspector?.expire(now);
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
      serverErrors?.dispose();
      interest.stop();
      clearTimeout(flushTimer);
      registry.record = undefined;
      ssr.record = undefined;
      ssr.overrides = undefined;
    };

    const httpSnapshot = () => httpState.value() as HttpState;
    registerHttpAgentTools({
      agent,
      applyRouter,
      capacitorPages,
      clearHttpCalls,
      config,
      httpState,
      my,
      registry,
      routerPages,
      setHttpRules,
      navigationStream,
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
      handler: (selector: unknown) => {
        const target = pageHighlightTarget(selector);
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
        lintFormsFor(
          formsState.value() as FormsState,
          {
            form: typeof args?.form === 'string' ? args.form : undefined,
            page: typeof args?.page === 'string' ? args.page : undefined,
          },
          undefined,
          { rules: config.lint.rules },
        ),
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
          case 'playwright':
            return playwrightTestText(state, { ...target, url: formPageUrl(state, target) });
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
      handler: deltaPush(componentDeltas, owns, (report, pageNow) => {
        if (!isComponentReport(report) || !owns(report.pageId)) return false;
        componentPages.set(report.pageId, toComponentPage(report, Date.now(), pageNow));
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

    // Loads one @defer block when an agent asks: same gate and owner check as the writes above.
    const deferLoads = createDeferLoads({
      config,
      pages: () => componentPages.values(),
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
      name: 'defer-load-result',
      type: 'action',
      jsonSerializable: true,
      handler: deferLoads.answer,
    });
    agent.registerTool(deferLoads.tool);

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

    // A keyboard move of the running pick: the panel sends the key, the page
    // answers with the component it shows now on the pick's result channel.
    register({
      name: 'request-component-pick-move',
      type: 'action',
      jsonSerializable: true,
      handler: (target: { pageId?: unknown; key?: unknown } | null) => {
        const key = PICK_KEYS.find((k) => k === target?.key);
        if (!key) return { moved: false, error: 'Unknown key.' };
        const asked = typeof target?.pageId === 'string' ? target.pageId : undefined;
        const pageId = asked ?? latestComponentPage(componentPages.values())?.pageId;
        if (!pageId || !componentPages.has(pageId)) {
          return { moved: false, error: 'No page is connected. Open the app in a browser first.' };
        }
        return new Promise<Record<string, unknown>>((resolve) => {
          const requestId = `pick${++pickSeq}`;
          const timer = setTimeout(() => {
            pendingPicks.delete(requestId);
            resolve({ moved: false, error: 'The page did not answer.' });
          }, 5_000);
          timer.unref?.();
          pendingPicks.set(requestId, {
            pageId,
            settle: (result) => {
              clearTimeout(timer);
              pendingPicks.delete(requestId);
              resolve(result);
            },
          });
          void my.rpc.broadcast({
            method: 'component-pick',
            args: [{ requestId, pageId, move: key }],
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
          ...(report?.truncated === true || tree.truncated
            ? { truncated: true, limits: INJECTOR_TREE_LIMITS }
            : {}),
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

    // The panel asks the page to read an element injector again (the one it
    // selected), or every injector (Refresh). The page pushes a fresh tree.
    register({
      name: 'request-injector-refresh',
      type: 'action',
      jsonSerializable: true,
      handler: (message: { pageId?: unknown; injectorId?: unknown } | null) =>
        requestInjectorRefresh(
          message,
          injectorPages.keys(),
          (method, args) => void my.rpc.broadcast({ method, args: [args], optional: true }),
        ),
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
    /** The address of the page a form is on, for the Playwright test export. */
    function formPageUrl(state: FormsState, args: FieldArgs): string | undefined {
      const forms = matchForms(state.forms, args.form, args.page);
      const pageId = (forms[0]?.id ?? '').split('@')[1] ?? args.page;
      return pageId ? livePageDetails().get(pageId)?.url : undefined;
    }
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

    agent.registerResource({
      id: 'pangular:pipe-usages',
      name: 'Angular Pipe Usages',
      description:
        'Pipes as JSON: `source` has each pipe with purity and template uses; `pipes`/`async` the live page usage, with churn and stale findings while recording. ' +
        LIVE_RESOURCE_NOTE,
      mimeType: 'application/json',
      read: () => {
        const live = currentPipes(pipePages);
        return {
          text: liveResourceText(
            { source: scanPipes(ctx.cwd), ...live },
            'pangular:scan-pipes and pangular:explain-pipe',
          ),
        };
      },
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

    registerComponentAgentTools({
      agent,
      angularPages,
      cdAcks,
      cdState,
      componentHits,
      componentPageProperty,
      componentPages,
      componentValues,
      config,
      ctx,
      goneCdPages,
      injectorPages,
      latestInjectorPage,
      my,
      noComponentTree,
      providerValues,
      register,
      requestCdOptions,
      requestCdRecord,
      requestHydrationOverlay,
      routerPages,
      selectComponentOnPage,
      signalGraphState,
      signalPages,
      signalPeeks,
      unknownComponentPage,
      waitForComponentDetail,
    });

    const noRouter = `No router state has been reported. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio MCP server has no page, so there it always answers this.`;
    const pageProperty = PAGE_ARGUMENT;

    registerRouterAgentTools({
      agent,
      config,
      ctx,
      limits,
      noRouter,
      pageProperty,
      requestRouterAction,
      routerPages,
      routerState,
      withPageUrls,
      navigationStream,
      previewScans,
      routerHttpCalls,
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
    // Store DevTools history operations and the explain-change read (rpc/ngrx-devtools-tools.ts).
    for (const tool of createNgrxDevtoolsTools({
      ask: (page, request) => requestNgrxAction(page, request),
      pages: () => ngrxPages,
    })) {
      agent.registerTool(tool);
    }

    ({ waitForForm } = registerFormsAgentTools({
      agent,
      config,
      ctx,
      formPages,
      formsState,
      pipeAcks,
      pipePages,
      requestFormAction,
      requestPipeRecording,
      formPageUrl,
    }));

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
      const withUrl = <
        T extends { pageId: string; reportedAt: number; url?: string; title?: string },
      >(
        pages: Iterable<T>,
      ) =>
        [...pages].map((page) => ({
          pageId: page.pageId,
          // An idle page sends only its heartbeat, which counts as a report here.
          reportedAt: Math.max(page.reportedAt, heartbeats.seenAt(page.pageId) ?? 0),
          // A page only one inspector reports, such as Ionic, still names its own URL and title.
          ...(page.url !== undefined ? { url: page.url } : {}),
          ...(page.title !== undefined ? { title: page.title } : {}),
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
          ionic: withUrl(ionicInspector?.pages() ?? []),
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
      rules: config.lint.rules,
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
        ...(on.pipes
          ? { pipes: cachedPipeLint(() => lintPipes(ctx.cwd, { rules: config.lint.rules })) }
          : {}),
      },
    });
    onPageClaimed = audit.pageLoaded;

    if (on.analog) {
      await registerAnalog(my as never, { cwd: ctx.cwd, agent } as never, {
        blockCalls: config.actions.analog ? undefined : actionBlockedMessage('analog'),
        owner: ctx,
        ttl: liveTtl,
        owners,
        rules: config.lint.rules,
        contentSchema: config.analog.contentSchema,
      });
    }
    feed.attachDocks(
      trackHubDocks(ctx, 'pangular', config, {
        cwd: ctx.cwd,
        capacitor: capacitorShared,
        components: componentTree,
      }),
    );
    // Auth and access for the Dashboard, trusted clients only (`security-status.ts`).
    if (pageTools) {
      register({
        name: 'security-status',
        type: 'query',
        jsonSerializable: true,
        handler: securityStatusHandler(ctx, info?.security, info?.pairingTokens ?? 0),
      });
    }
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
  /** How the host lets clients in, for the Dashboard's security status (`security-status.ts`). */
  security?: PangularSecurityHost;
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
        security: host.security,
        pairingTokens: host.authTokens?.length ?? 0,
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
  // `pangular token --rotate` asks through the token folder (`auth-rotate.ts`).
  if (dir) watchTokenRotation(ctx, dir);
}

/**
 * devframe's `initDevframe()`, from the copy this package depends on, to mount
 * the panel without the hub. A separate `devframe` install can resolve another
 * version.
 */
export { initDevframe } from 'devframe/initiate';

export default pangular;
