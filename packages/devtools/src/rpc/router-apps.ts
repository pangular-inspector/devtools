import type { RouterAppReport } from '../router-apps.ts';
import { code } from './forms-tools.ts';
import { detectLoops } from './router-loops.ts';
import { pickPage, type RouterPage, type RouterState } from './router-tools.ts';

/** The `app` argument of the router agent tools. */
export const APP_ARGUMENT = {
  type: 'string',
  description:
    'On a page that runs several Angular apps with a Router, the app to read: its id or root component name, as the answer lists them. Defaults to the first app.',
} as const;

/** The apps of a page that runs more than one Angular app with a Router, else none. */
export function routerAppsOf(page: RouterPage | undefined): RouterAppReport[] {
  return page?.apps && page.apps.length > 1 ? page.apps : [];
}

function label(app: RouterAppReport): string {
  return app.name && app.name !== app.selector
    ? `${code(app.id)} (${code(app.name)} in ${code(`<${app.selector}>`)})`
    : `${code(app.id)} (${code(`<${app.selector}>`)})`;
}

/** Finds an app by id, root component name or tag, ignoring case. */
export function findRouterApp(page: RouterPage, app: string): RouterAppReport | undefined {
  const apps = routerAppsOf(page);
  const needle = app.trim().toLowerCase();
  return (
    apps.find((a) => a.id.toLowerCase() === needle) ??
    apps.find((a) => a.name.toLowerCase() === needle) ??
    apps.find((a) => a.selector.toLowerCase() === needle)
  );
}

/**
 * The page as one of its apps sees it: that app's route, navigations, config,
 * setup, outlets, links and preloads in place of the first app's. Guard
 * recording is one switch for the whole page. The first app's own entry
 * gives the page unchanged.
 */
export function routerAppPage(page: RouterPage, app: RouterAppReport): RouterPage {
  if (app.primary) return { ...page, appId: app.id };
  const navigations = app.navigations ?? [];
  const view: RouterPage = {
    pageId: page.pageId,
    reportedAt: page.reportedAt,
    changedAt: page.changedAt,
    snapshot: app.snapshot ?? null,
    navigations,
    apps: page.apps,
    appId: app.id,
  };
  if (app.dropped) view.dropped = app.dropped;
  if (app.generation !== undefined) view.generation = app.generation;
  if (app.config) view.config = app.config;
  if (app.configTruncated) view.configTruncated = app.configTruncated;
  if (app.activeIds) view.activeIds = app.activeIds;
  if (app.setup) view.setup = app.setup;
  if (app.outlets) view.outlets = app.outlets;
  if (app.links) view.links = app.links;
  if (app.linksTruncated) view.linksTruncated = app.linksTruncated;
  if (app.linksUnchecked) view.linksUnchecked = app.linksUnchecked;
  if (app.preloads) view.preloads = app.preloads;
  if (page.instrumented !== undefined) view.instrumented = page.instrumented;
  view.loops = detectLoops(navigations, app.config);
  return view;
}

/** One line naming a page's apps, for an answer about one of them. */
export function routerAppsNote(page: RouterPage | undefined): string {
  const apps = routerAppsOf(page);
  if (!apps.length) return '';
  const current = apps.find((a) => a.id === page?.appId) ?? apps[0];
  const others = apps.filter((a) => a !== current);
  return `\n\nThis page runs ${apps.length} Angular apps with a Router. This answer is about ${label(current)}; the others are ${others.map(label).join(', ')}. Pass \`app\` to read another.`;
}

/**
 * The router state with the asked-for page replaced by the view of one of its
 * apps, for the router tools' `app` argument. Without `app` the state is
 * unchanged, and the note names the other apps on a page that has several.
 */
export function routerStateForApp(
  state: RouterState,
  args: { page?: string; app?: unknown },
): { state: RouterState; page?: string; note: string } | { error: string } {
  const page = pickPage(state, args.page);
  if (args.app === undefined || args.app === null || args.app === '') {
    return { state, note: routerAppsNote(page) };
  }
  if (typeof args.app !== 'string') return { error: 'Pass `app` as a string.' };
  if (!page) return { state, note: '' };
  const apps = routerAppsOf(page);
  if (!apps.length) {
    return {
      error: `Page ${code(page.pageId)} runs one Angular app with a Router, so there is no app to pick. Leave \`app\` out.`,
    };
  }
  const app = findRouterApp(page, args.app);
  if (!app) {
    return {
      error: `Page ${code(page.pageId)} has no app ${code(args.app.slice(0, 60))}. Its apps are ${apps.map(label).join(', ')}.`,
    };
  }
  const view = routerAppPage(page, app);
  return {
    state: { pages: state.pages.map((p) => (p === page ? view : p)) },
    page: page.pageId,
    note: routerAppsNote(view),
  };
}
