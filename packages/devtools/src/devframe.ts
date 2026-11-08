import type { DevframeSetupInfo, RemoteAssets } from 'devframe';
import { defineDevframe } from 'devframe';
import { PANGULAR_LOGO_DATA_URI } from './brand.ts';
import { SCAN_RPC_DEFINITIONS, SCAN_TOOLS, scanTool } from './rpc/scan-tools.ts';
import { expireCapacitorPages } from './rpc/capacitor-tools.ts';
import { registerHttpAgentTools } from './devframe-http-tools.ts';
import { registerFormsAgentTools } from './devframe-forms-tools.ts';
import { registerComponentAgentTools } from './devframe-component-tools.ts';
import { registerRouterAgentTools } from './devframe-router-tools.ts';
import { registerSnapshot } from './rpc/snapshot-tools.ts';
import type { PangularServerPlugin } from './plugin.ts';
import { registerAudit } from './rpc/audit-register.ts';
import { lintPipes } from './rpc/pipe-lint.ts';
import { cachedPipeLint } from './rpc/pipe-lint-cache.ts';
import { createOpenInEditor, defaultLauncher } from './rpc/open-in-editor.ts';
import { servedAnalogRoot } from './rpc/analog-scan.ts';
import { expireNgrxPages } from './rpc/ngrx-tools.ts';
import { expireComponentPages } from './rpc/component-tools.ts';
import { expirePages, type FormsState } from './rpc/forms-tools.ts';
import { expirePipePages } from './rpc/pipes-tools.ts';
import { expireRouterPages, type RouterState } from './rpc/router-tools.ts';
import { expireCdPages, type CdState } from './rpc/cd-tools.ts';
import type { HttpState } from './types.ts';
import { registerAnalog } from './rpc/analog-register.ts';
import { guardPangularSharedStateWrites } from './rpc/shared-state-write-guard.ts';
import { PAGE_ARGUMENT, byRecency, listPagesText } from './rpc/pages.ts';
import { trackHubDocks } from './hub-dock-status.ts';
import { createHubFeed } from './hub-messages.ts';
import { PANEL_COMMAND_EVENT, registerHubCommands } from './hub-commands.ts';
import {
  OPEN_IN_PANEL_DESCRIPTION,
  OPEN_IN_PANEL_EVENT,
  openInPanel,
} from './rpc/open-in-panel.ts';
import { setRedaction } from './forms-privacy.ts';
import {
  PANGULAR_CONFIG_KEY,
  connectionConfig,
  actionBlockedMessage,
  enabledPanelTabs,
  sharedStateExposed,
  autoLibraries,
  pangularConfigWarning,
  resolvePangularConfig,
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
import pkg from '../package.json' with { type: 'json' };
import { createRegistrars } from './devframe-registrars.ts';
import { createPageDirectory, registerHighlights, registerPageRegistry } from './devframe-pages.ts';
import {
  componentToolHelpers,
  createComponentState,
  registerComponentPick,
  registerComponentRpc,
} from './devframe-components.ts';
import { createSignalState, registerSignalRpc } from './devframe-signals.ts';
import { createInjectorState, registerInjectorRpc } from './devframe-injectors.ts';
import {
  createNgrxState,
  registerNgrxDispatchTools,
  registerNgrxReadTools,
  registerNgrxRpc,
} from './devframe-ngrx.ts';
import { createFormsState, registerFormActions, registerFormsPages } from './devframe-forms.ts';
import { registerPipes } from './devframe-pipes.ts';
import { registerCapacitor } from './devframe-capacitor.ts';
import { registerInspectors } from './devframe-inspectors.ts';
import { registerRouter } from './devframe-router.ts';
import { registerHttp } from './devframe-http.ts';
import { registerLiveResources } from './devframe-resources.ts';
import { createWaitForTool } from './rpc/wait-for.ts';
import { answeringText, type MarkdownAnswer } from './rpc/agent-output.ts';
import { guardHandler } from './rpc/tool-input.ts';
import { notAProjectText } from './rpc/project-root.ts';
import { STATE_READ_BY, stateReadTool } from './rpc/state-read-tool.ts';

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
    setRedaction(config.redaction);
    const on = config.inspectors;
    const limits = config.limits;
    const my = ctx.scope('pangular');
    (ctx.staticConfig as Record<string, unknown>)[PANGULAR_CONFIG_KEY] = connectionConfig(config);
    const rootRefusal = info?.notAProject && notAProjectText(info.notAProject);
    // Agent writes, NG errors and hydration mismatches, posted to the hub's messages.
    const feed = createHubFeed(ctx, config);
    // The URL of a page, for the line that names it in a tool answer. Set once the reports exist.
    let pageUrl: (pageId: string) => string | undefined = () => undefined;
    const { register, agent } = createRegistrars({
      ctx,
      my,
      config,
      pageTools,
      rootRefusal: rootRefusal || undefined,
      feed,
      autoLibraries: info?.autoLibraries,
      pageUrl: () => pageUrl,
      interest: () => interest,
      reporting: {
        capacitor: () => capacitorPages.size > 0,
        tanstackQuery: () => (inspectors.tanstackQuery?.pages().length ?? 0) > 0,
      },
    });

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

    // Owners, heartbeats, background marks and the lease of every page.
    const pages = await registerPageRegistry({
      ctx,
      my,
      config,
      register,
      // The forms and router tools call a page stale by its last report, so a beat counts as one.
      touchFormsPage: (pageId, now) => forms.touchFormsPage(pageId, now),
      touchRouter: (pageId, now) => router.touchRouter(pageId, now),
    });
    const { heartbeats, visibility, liveTtl, owners, owns, answersFor, interest, mayForget } =
      pages;
    const { angularPages } = pages;

    const components = await createComponentState({ my });
    const { componentTree, componentPages } = components;

    await my.rpc.sharedState('routes', {
      initialValue: {
        routes: [],
        activeRoute: null,
      },
    });

    const signals = await createSignalState({ my });
    const { signalGraphState, signalPages } = signals;
    const injectors = await createInjectorState({ ctx, my });
    const { injectorTreeState, injectorPages } = injectors;
    const ngrx = await createNgrxState({ ctx, my });
    const { ngrxStoreState, ngrxPages } = ngrx;
    const forms = await createFormsState({ my, config, register, owns, feed, liveTtl });
    const { formPages, formsState } = forms;
    const pipes = await registerPipes({ ctx, my, config, register, owns, mayForget, liveTtl });
    const { pipePages } = pipes;
    const { capacitorPages, capacitorShared, applyCapacitor } = await registerCapacitor({
      ctx,
      my,
      config,
      register,
      owns,
      mayForget,
    });
    const inspectors = await registerInspectors({
      ctx,
      my,
      config,
      register,
      agent,
      feed,
      interest,
      owns,
      mayForget,
      answersFor,
      liveTtl,
      pageTools,
      seenAt: heartbeats.seenAt,
      serverPlugins: info?.serverPlugins,
    });
    const { errorsInspector, leaksInspector } = inspectors;

    const router = await registerRouter({
      ctx,
      my,
      config,
      register,
      owns,
      mayForget,
      answersFor,
      owners,
      feed,
      liveTtl,
      componentPages,
      httpPages: () => http.httpPages,
    });
    const { routerPages, navigationStream, routerState, applyRouter } = router;

    const http = await registerHttp({
      my,
      config,
      register,
      agent,
      owns,
      mayForget,
      answersFor,
      feed,
    });
    const { httpPages, registry, httpState } = http;

    const expiry = setInterval(() => {
      // Background marks first, then beats, on one clock: a page whose data
      // goes in this sweep is gone from the beats too, so its next beat is unknown.
      const now = Date.now();
      if (visibility.expire(now)) pages.applyVisibility();
      heartbeats.expire(now, visibility.has);
      if (angularPages.expire(liveTtl)) pages.applyAngularPages();
      owners.expire(now);
      const staleHttp = [...httpPages].filter(([id, p]) => now - p.reportedAt > liveTtl(id));
      if (staleHttp.length) http.forgetHttpPages(staleHttp.map(([id]) => id));
      const stale = [...signalPages].filter(([id, p]) => now - p.reportedAt > liveTtl(id));
      if (stale.length) signals.forgetSignalPages(stale.map(([id]) => id));
      if (expireComponentPages(componentPages, now, liveTtl)) components.applyComponentPages();
      if (expireCdPages(components.cdPages, now, liveTtl)) components.applyCd();
      for (const id of components.goneCdPages) {
        if (!componentPages.has(id) && !injectorPages.has(id)) components.goneCdPages.delete(id);
      }
      const staleInjectors = [...injectorPages].filter(
        ([id, p]) => now - p.reportedAt > liveTtl(id),
      );
      if (staleInjectors.length) {
        for (const [id] of staleInjectors) injectorPages.delete(id);
        injectors.applyInjectorPages();
      }
      const next = expirePages(formPages, now, limits.formTimeline, liveTtl);
      if (next) forms.applyForms(next);
      const nextRouter = expireRouterPages(routerPages, now, liveTtl);
      if (nextRouter) {
        applyRouter(nextRouter);
        router.dropGoneStreamPages();
      }
      const nextPipes = expirePipePages(pipePages, now, liveTtl);
      if (nextPipes) pipes.applyPipes(nextPipes);
      if (expireNgrxPages(ngrxPages, now, liveTtl)) ngrx.applyNgrx();
      if (expireCapacitorPages(capacitorPages, now, liveTtl)) applyCapacitor();
      inspectors.errorsInspector?.expire(now);
      inspectors.serverErrors?.expire(now);
      inspectors.perfInspector?.expire(now);
      inspectors.leaksInspector?.expire(now);
      inspectors.reduxStores?.expire(now);
      inspectors.tanstackQuery?.expire(now);
      inspectors.startupInspector?.expire(now);
      inspectors.ionicInspector?.expire(now);
      inspectors.pluginsInspector?.expire(now);
      components.componentDeltas.prune((id) => componentPages.has(id));
      injectors.injectorDeltas.prune((id) => injectorPages.has(id));
      components.cdDeltas.prune((id) => components.cdPages.has(id));
      forms.formDeltas.prune((id) => formPages.has(id));
      // A page that stopped reporting (a closed browser that never said
      // goodbye) is gone, so a wake doesn't wait for it.
      interest.prune(
        (id) =>
          owners.alive(id) ||
          componentPages.has(id) ||
          injectorPages.has(id) ||
          components.cdPages.has(id),
      );
    }, 5000);
    expiry.unref?.();
    registry.owner = ctx;
    registry.dispose = () => {
      clearInterval(expiry);
      clearInterval(pages.interestTick);
      inspectors.pluginsInspector?.dispose();
      inspectors.serverErrors?.dispose();
      interest.stop();
      http.stopFlush();
      registry.record = undefined;
      http.ssr.record = undefined;
      http.ssr.overrides = undefined;
    };

    const httpSnapshot = () => httpState.value() as HttpState;
    registerHttpAgentTools({
      agent,
      applyRouter,
      capacitorPages,
      clearHttpCalls: http.clearHttpCalls,
      config,
      httpState,
      my,
      registry,
      routerPages,
      setHttpRules: http.setHttpRules,
      navigationStream,
    });

    registerFormsPages({ config, register, owns, mayForget, state: forms });
    registerHighlights({ ctx, my, register });
    const requestFormAction = registerFormActions({
      ctx,
      my,
      config,
      register,
      owners,
      answersFor,
      formsState,
      formPageUrl: (state, args) => directory.formPageUrl(state, args),
    });

    const cd = await registerComponentRpc({
      ctx,
      my,
      config,
      register,
      agent,
      owns,
      mayForget,
      answersFor,
      owners,
      state: components,
    });
    registerComponentPick({ my, register, answersFor, state: components });
    registerSignalRpc({
      my,
      config,
      register,
      agent,
      owns,
      mayForget,
      answersFor,
      owners,
      angularPages,
      state: signals,
    });
    const providerValues = registerInjectorRpc({
      my,
      register,
      owns,
      mayForget,
      answersFor,
      on,
      ngrxNames: ngrx.ngrxNames,
      cdSeen: cd.cdSeen,
      state: injectors,
    });
    const ngrxRpc = registerNgrxRpc({
      my,
      config,
      register,
      owns,
      mayForget,
      answersFor,
      withPageUrls: (list) => directory.withPageUrls(list),
      state: ngrx,
    });

    const directory = createPageDirectory({
      config,
      pages,
      inspectors,
      componentPages,
      signalPages,
      injectorPages,
      ngrxPages,
      formPages,
      pipePages,
      capacitorPages,
      routerPages,
      httpPages,
    });
    const { livePageDetails, withPageUrls, livePages } = directory;
    pageUrl = (pageId) => livePageDetails().get(pageId)?.url;

    registerLiveResources({
      ctx,
      agent,
      interest,
      componentTree,
      signalGraphState,
      injectorTreeState,
      injectorPages,
      ngrxStoreState,
      formsState,
      routerState,
      pipePages,
    });
    registerNgrxReadTools({ agent, state: ngrx });

    // Agent tools
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
      cdAcks: cd.cdAcks,
      cdState: cd.cdState,
      ...componentToolHelpers(componentPages),
      componentPages,
      componentValues: cd.componentValues,
      config,
      ctx,
      goneCdPages: components.goneCdPages,
      injectorPages,
      latestInjectorPage: injectors.latestInjectorPage,
      my,
      providerValues,
      register,
      requestCdOptions: cd.requestCdOptions,
      requestCdRecord: cd.requestCdRecord,
      requestHydrationOverlay: cd.requestHydrationOverlay,
      routerPages,
      selectComponentOnPage: components.selectComponentOnPage,
      signalGraphState,
      signalPages,
      signalPeeks: signals.signalPeeks,
      waitForComponentDetail: components.waitForComponentDetail,
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
      requestRouterAction: router.requestRouterAction,
      routerPages,
      routerState,
      withPageUrls,
      navigationStream,
      previewScans: router.previewScans,
      routerHttpCalls: router.routerHttpCalls,
    });

    registerNgrxDispatchTools({ agent, state: ngrx, rpc: ngrxRpc, withPageUrls });

    ({ waitForForm } = registerFormsAgentTools({
      agent,
      config,
      ctx,
      formPages,
      formsState,
      pipeAcks: pipes.pipeAcks,
      pipePages,
      requestFormAction,
      requestPipeRecording: pipes.requestPipeRecording,
      formPageUrl: directory.formPageUrl,
    }));

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
        reduxStores: () => inspectors.reduxStores?.state(),
        queries: () => inspectors.tanstackQuery?.state(),
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
              cd: () => cd.cdState.value() as CdState,
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
    pages.onPageClaimed(audit.pageLoaded);

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
