import { diffNavigationsText } from './rpc/router-diff.ts';
import { APP_ARGUMENT, routerStateForApp } from './rpc/router-apps.ts';
import { MAX_WAIT_MS, streamText, type NavigationStream } from './rpc/router-stream.ts';
import { previewNavigationText } from './rpc/router-preview.ts';
import type { HttpCall } from './http-rules.ts';
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
  requestRouterAction: (
    page: string | undefined,
    request: unknown,
    app?: string,
  ) => Promise<unknown>;
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
  navigationStream: NavigationStream;
  previewScans: () => {
    sources: ReturnType<typeof extractRoutes>;
    serverRoutes: ReturnType<typeof scanServerRoutes>;
  };
  routerHttpCalls: (pageId: string) => readonly HttpCall[] | undefined;
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
    navigationStream,
    previewScans,
    routerHttpCalls,
  } = env;
  /** The router state for a tool's `page` and `app`, with a line naming the page's other apps. */
  const routerFor = (args: { page?: string; app?: unknown }) => {
    const scoped = routerStateForApp(routerState.value() as RouterState, args);
    if ('error' in scoped) return { error: { markdown: refusal(scoped.error) } };
    return { state: scoped.state, page: scoped.page ?? args.page, note: scoped.note };
  };
  agent.registerTool({
    id: 'pangular:inspect-route',
    title: 'Inspect the active route',
    description:
      "The current route: URL, query params, fragment, title, in-flight navigation, the active route tree and outlets. `component` (a component or link text) checks one component's route or whether a link is active.",
    inputSchema: {
      type: 'object',
      properties: {
        page: pageProperty,
        app: APP_ARGUMENT,
        component: {
          type: 'string',
          description:
            'Component class name, element tag or link text to explain instead of the whole route.',
        },
      },
    },
    handler: async (args: { page?: string; app?: string; component?: string }) => {
      if (!(routerState.value() as RouterState).pages.length) return { markdown: noRouter };
      const scoped = routerFor(args);
      if ('error' in scoped) return scoped.error;
      return {
        markdown: inspectRouteText(scoped.state, { ...args, page: scoped.page }) + scoped.note,
      };
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
        app: APP_ARGUMENT,
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
      app?: string;
      url?: string;
      limit?: number;
      perf?: boolean;
      id?: number;
      format?: 'explain' | 'repro';
    }) => {
      if (!(routerState.value() as RouterState).pages.length) return { markdown: noRouter };
      const scoped = routerFor(args);
      if ('error' in scoped) return scoped.error;
      const { state, page, note } = scoped;
      if (args.format === 'repro') {
        if (args.perf) return { markdown: refusal('Pass either `perf` or `format: "repro"`.') };
        return { markdown: exportNavigationText(state, { page, id: args.id }) + note };
      }
      return {
        markdown:
          explainNavigationText(
            state,
            { ...args, page },
            Date.now(),
            limits.navigations,
            routerHttpCalls,
          ) + note,
      };
    },
  });

  agent.registerTool({
    id: 'pangular:diff-navigations',
    title: 'Diff two navigations',
    description:
      'What changed between two recorded navigations: URL, outcome, query params, route params and data, the component in each outlet, guard and resolver verdicts and timing. `b` defaults to the newest finished navigation, `a` to the last earlier one to the same path.',
    inputSchema: {
      type: 'object',
      properties: {
        page: pageProperty,
        app: APP_ARGUMENT,
        a: { type: 'integer', description: 'Id of the earlier navigation.' },
        b: { type: 'integer', description: 'Id of the later navigation.' },
      },
    },
    handler: async (args: { page?: string; app?: string; a?: number; b?: number }) => {
      if (!(routerState.value() as RouterState).pages.length) return { markdown: noRouter };
      const scoped = routerFor(args);
      if ('error' in scoped) return scoped.error;
      return {
        markdown: diffNavigationsText(scoped.state, { ...args, page: scoped.page }) + scoped.note,
      };
    },
  });

  agent.registerTool({
    id: 'pangular:follow-navigations',
    title: 'Follow navigations',
    description: `New and changed navigations since a cursor, oldest first, to follow a login or redirect flow without polling. Without \`since\`, the latest 5 and a cursor; pass it back as \`since\`, with \`waitMs\` (up to ${MAX_WAIT_MS}) to wait for the next one.`,
    inputSchema: {
      type: 'object',
      properties: {
        page: pageProperty,
        since: {
          type: 'integer',
          minimum: 0,
          description: 'The cursor a previous call returned. Without it, the last 5 navigations.',
        },
        waitMs: {
          type: 'integer',
          minimum: 0,
          maximum: MAX_WAIT_MS,
          description:
            'With `since`: how long to wait for a navigation when none came yet (default 0).',
        },
      },
    },
    handler: async (args: { page?: string; since?: number; waitMs?: number }) => {
      const state = routerState.value() as RouterState;
      if (args.page && !state.pages.some((p) => p.pageId === args.page)) {
        return { markdown: noPage(args.page, state) };
      }
      if (typeof args.since !== 'number' || !Number.isFinite(args.since)) {
        const all = navigationStream.read(0, args.page);
        const read = { ...all, entries: all.entries.slice(-5) };
        delete read.reset;
        return { markdown: streamText(read, { waited: false }) };
      }
      const since = Math.floor(args.since);
      const wait = typeof args.waitMs === 'number' && args.waitMs > 0 ? args.waitMs : 0;
      const read = await navigationStream.wait(since, wait, args.page);
      return { markdown: streamText(read, { since, waited: wait > 0 }) };
    },
  });

  agent.registerTool({
    id: 'pangular:preview-navigation',
    title: 'Preview a navigation',
    description:
      'What going to a URL would do, predicted from the live route config without navigating: redirects, the route chain and params, then in order the guards, lazy chunks, resolvers and components that run, with source files and the render mode.',
    inputSchema: {
      type: 'object',
      properties: {
        page: pageProperty,
        app: APP_ARGUMENT,
        url: { type: 'string', description: 'A path such as /admin/users?tab=roles.' },
      },
      required: ['url'],
    },
    handler: async (args: { page?: string; app?: string; url?: string }) => {
      if (!(routerState.value() as RouterState).pages.length) return { markdown: noRouter };
      if (typeof args.url !== 'string' || !args.url) {
        return { markdown: refusal('Pass `url`, such as /users/42.') };
      }
      const scoped = routerFor(args);
      if ('error' in scoped) return scoped.error;
      const { sources, serverRoutes } = previewScans();
      return {
        markdown:
          previewNavigationText(
            scoped.state,
            { ...args, page: scoped.page },
            sources,
            serverRoutes,
          ) + scoped.note,
      };
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
        app: APP_ARGUMENT,
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
      app?: string;
      match?: string;
      audit?: boolean;
      filter?: string;
      resolveLazy?: string;
    }) => {
      if (!(routerState.value() as RouterState).pages.length) return { markdown: noRouter };
      let scoped = routerFor(args);
      if ('error' in scoped) return scoped.error;
      let resolved = '';
      if (args.resolveLazy !== undefined) {
        const target = routerTarget(args.page);
        if (!('pageId' in target)) return target;
        const appId = scoped.state.pages.find((p) => p.pageId === target.pageId)?.appId;
        const result = await requestRouterAction(
          target.pageId,
          { action: 'resolve-lazy', id: args.resolveLazy },
          appId,
        );
        const answer = routerActionAnswer('resolve-lazy', target.pageId, result, []);
        if (refusalOf(answer) !== undefined) return { markdown: answer };
        resolved = `${answer}\n\n`;
        scoped = routerFor(args);
        if ('error' in scoped) return scoped.error;
      }
      const { state, note } = scoped;
      let sources: ReturnType<typeof extractRoutes> = [];
      try {
        sources = extractRoutes(ctx.cwd);
      } catch {
        sources = [];
      }
      return {
        markdown: `${resolved}${listRoutesText(state, { ...args, page: scoped.page }, sources)}${note}`,
      };
    },
  });

  agent.registerTool({
    id: 'pangular:lint-routes',
    title: 'Lint routes',
    description:
      "Checks the live route config: routes after '**', shadowed params, empty paths without pathMatch full, redirect loops, deprecated guards, title and security issues, and the first 100 RouterLinks on the page.",
    inputSchema: { type: 'object', properties: { page: pageProperty, app: APP_ARGUMENT } },
    handler: async (args: { page?: string; app?: string }) => {
      if (!(routerState.value() as RouterState).pages.length) return { markdown: noRouter };
      const scoped = routerFor(args);
      if ('error' in scoped) return scoped.error;
      return {
        markdown:
          lintRoutesText(scoped.state, { ...args, page: scoped.page }, undefined, {
            rules: config.lint.rules,
            httpFor: routerHttpCalls,
          }) + scoped.note,
      };
    },
  });

  agent.registerTool({
    id: 'pangular:router-config',
    title: 'Show the router setup',
    description:
      'How the router is set up: provideRouter or forRoot, effective options (set or default), features, strategies, base href, hydration and whether guard instrumentation is on.',
    inputSchema: { type: 'object', properties: { page: pageProperty, app: APP_ARGUMENT } },
    handler: async (args: { page?: string; app?: string }) => {
      if (!(routerState.value() as RouterState).pages.length) return { markdown: noRouter };
      const scoped = routerFor(args);
      if ('error' in scoped) return scoped.error;
      return {
        markdown: routerConfigText(scoped.state, { ...args, page: scoped.page }) + scoped.note,
      };
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
