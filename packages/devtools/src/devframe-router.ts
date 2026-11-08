// The Router inspector on the devframe server (`devframe.ts`): the `router`
// shared state, the navigation stream, the router actions a page runs and the
// panel's lint, match, HTTP, preview, diff and export reads. Its agent tools
// live in `devframe-router-tools.ts`.

import {
  ROUTER_WRITE_ACTIONS,
  actionBlockedMessage,
  type ResolvedPangularConfig,
} from './config.ts';
import type { HubFeed } from './hub-messages.ts';
import { defaultPage } from './rpc/default-page.ts';
import { extractRoutes } from './rpc/get-routes.ts';
import type { PageOwners } from './rpc/page-owners.ts';
import type { PageTtl } from './rpc/page-ttl.ts';
import { routerStateForApp } from './rpc/router-apps.ts';
import { exportNavigationText, matchUrl, routerLintResult } from './rpc/router-config-tools.ts';
import { navigationDiffResult } from './rpc/router-diff.ts';
import { callsForNavigation, nextNavigation } from './rpc/router-http.ts';
import { routePreviewResult } from './rpc/router-preview.ts';
import { NavigationStream } from './rpc/router-stream.ts';
import {
  clearRouterNavigations,
  currentRouter,
  isRouterReport,
  mergeRouterReport,
  touchRouterPage,
  unknownRouterApp,
  type RouterPage,
  type RouterState,
} from './rpc/router-tools.ts';
import { scanServerRoutes } from './rpc/server-routes.ts';
import type { ComponentPage, HttpPage } from './types.ts';
import type {
  AnswersFor,
  DevframeNodeContext,
  Owns,
  PangularScope,
  Register,
} from './devframe-env.ts';

/** What `registerRouter` reads from the devframe server's setup (`devframe.ts`). */
export interface RouterEnv {
  ctx: DevframeNodeContext;
  my: PangularScope;
  config: ResolvedPangularConfig;
  register: Register;
  owns: Owns;
  mayForget: Owns;
  answersFor: AnswersFor;
  owners: PageOwners;
  feed: HubFeed;
  liveTtl: PageTtl;
  componentPages: Map<string, ComponentPage>;
  /** The HTTP inspector's pages (`devframe-http.ts`), for the per-navigation HTTP join. */
  httpPages: () => Map<string, HttpPage>;
}

export async function registerRouter(env: RouterEnv) {
  const {
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
    httpPages,
  } = env;
  const on = config.inspectors;
  const limits = config.limits;
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
        navigationStream.recordReport(report);
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
    return (defaultPage(state.pages.filter((p) => p.snapshot)) ?? defaultPage(state.pages))?.pageId;
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
    on.http ? httpPages().get(pageId)?.calls : undefined;

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
      const unknownApp = unknownRouterApp(routerPages, pageId, app);
      if (unknownApp) throw new Error(unknownApp);
      const secondary = routerPages.get(pageId)?.apps?.some((a) => a.id === app && !a.primary);
      if (clearRouterNavigations(routerPages, pageId, Date.now(), app)) {
        applyRouter(currentRouter(routerPages));
      }
      // Each app's navigations in the stream go with its history; the first app's carry no id.
      navigationStream.clear(pageId, app ? (secondary ? app : null) : undefined);
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

  return {
    routerPages,
    navigationStream,
    dropGoneStreamPages,
    routerState,
    applyRouter,
    touchRouter,
    requestRouterAction,
    routerHttpCalls,
    previewScans,
  };
}
