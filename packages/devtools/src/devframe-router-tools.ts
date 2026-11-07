import {
  explainNavigationText,
  inspectRouteText,
  noPage,
  type RouterPage,
  type RouterState,
} from './rpc/router-tools.ts';
import {
  explainRenderModeText,
  exportNavigationText,
  lintRoutesText,
  listRoutesText,
  routerConfigText,
} from './rpc/router-config-tools.ts';
import { extractRoutes } from './rpc/get-routes.ts';
import { scanServerRoutes } from './rpc/server-routes.ts';
import { PAGE_ARGUMENT, choosePageText } from './rpc/pages.ts';
import { actionBlockedMessage, type ResolvedPangularConfig } from './config.ts';
import { type MarkdownAnswer } from './rpc/agent-output.ts';
import { defaultPage } from './rpc/default-page.ts';
import { routerActionAnswer } from './rpc/router-action-answer.ts';
import { refusal, refusalOf, refusedAnswer } from './rpc/refusal.ts';
import type { AgentRegistrar, DevframeNodeContext, SharedState } from './devframe-env.ts';

/** What `registerRouterAgentTools` reads from the devframe server's setup (`devframe.ts`). */
export interface RegisterRouterAgentToolsEnv {
  agent: AgentRegistrar;
  config: ResolvedPangularConfig;
  ctx: DevframeNodeContext;
  limits: ResolvedPangularConfig['limits'];
  noRouter: string;
  pageProperty: typeof PAGE_ARGUMENT;
  requestRouterAction: (page: string | undefined, request: unknown) => Promise<unknown>;
  routerPages: Map<string, RouterPage>;
  routerState: SharedState<RouterState>;
  withPageUrls: <T extends { pageId: string; reportedAt: number }>(
    pages: T[],
  ) => {
    title?: string | undefined;
    pageId: string;
    reportedAt: number;
    url: string | undefined;
  }[];
}

export function registerRouterAgentTools(env: RegisterRouterAgentToolsEnv) {
  const {
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
  } = env;
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
      return { markdown: lintRoutesText(state, args, undefined, { rules: config.lint.rules }) };
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
}
