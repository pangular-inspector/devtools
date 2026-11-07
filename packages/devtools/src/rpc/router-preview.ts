import type { RouteNode } from '../router-config.ts';
import { code, UNTRUSTED } from './forms-tools.ts';
import {
  matchUrl,
  renderModeFor,
  sourceFor,
  type MatchResult,
  type SourceRoute,
} from './router-config-tools.ts';
import {
  capped,
  freshness,
  list,
  noPage,
  pickPage,
  type RouterPage,
  type RouterState,
} from './router-tools.ts';
import type { ServerRouteEntry } from './server-routes.ts';

/** A redirect the prediction followed: from one URL to the next, through a `redirectTo` route. */
export interface PreviewHop {
  from: string;
  to: string;
  route: string;
}

/** One route of the matched chain, parent first. */
export interface PreviewRoute {
  path: string;
  component?: string;
  outlet?: string;
  lazy?: 'unloaded' | 'loaded';
  title?: string;
  source?: string;
  /** The route is active now, so it keeps its component and reruns guards only when its params change. */
  active?: boolean;
}

/** One phase of the navigation, in the order the router runs them, with what runs in it. */
export interface PreviewStep {
  phase: string;
  items: string[];
}

/**
 * What going to a URL would do, predicted from the live route config
 * without navigating: the redirects it follows, the route chain it ends
 * on, and the guards, lazy chunks, resolvers and components of each phase.
 */
export interface RoutePreview {
  url: string;
  finalUrl: string;
  matched: boolean;
  hops: PreviewHop[];
  chain: PreviewRoute[];
  params: Record<string, string>;
  steps: PreviewStep[];
  renderMode?: { mode: string; path: string; file: string };
  /** Where the prediction stopped short: a function redirect, an unloaded lazy route, a redirect loop. */
  stopped?: string;
  notes: string[];
  nearest: string[];
}

export type RoutePreviewResult = RoutePreview | { error: string };

const MAX_HOPS = 5;

function splitUrl(url: string): { path: string; rest: string } {
  const index = url.search(/[?#]/);
  return index < 0
    ? { path: url, rest: '' }
    : { path: url.slice(0, index), rest: url.slice(index) };
}

function parts(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function fill(path: string, params: Record<string, string>): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, (whole, name: string) => params[name] ?? whole);
}

/**
 * Where a `redirectTo` route sends `url`, the way the default redirect does:
 * an absolute target replaces the URL, a relative one replaces the matched
 * segments under the parent route; `:params` are filled in, and the rest of
 * the URL and its query stay. Undefined for a function redirect.
 */
export function redirectTarget(
  url: string,
  chain: RouteNode[],
  params: Record<string, string>,
): string | undefined {
  const node = chain[chain.length - 1];
  const redirect = node?.redirectTo;
  if (redirect === undefined || redirect.startsWith('function ')) return undefined;
  const { path, rest } = splitUrl(url);
  const consumed = parts(node.fullPath).length;
  const remaining = node.pathMatch === 'full' ? [] : parts(path).slice(consumed);
  const [targetPath, targetRest = ''] = redirect.split(/(?=[?#])/);
  const parent = chain.length > 1 ? fill(chain[chain.length - 2].fullPath, params) : '';
  const base = targetPath.startsWith('/')
    ? fill(targetPath, params)
    : `${parent.replace(/\/$/, '')}/${fill(targetPath, params)}`;
  const joined = `/${[...parts(base), ...remaining].join('/')}`;
  // Angular keeps the query and fragment of the URL only for a relative redirect;
  // an absolute one takes them from `redirectTo` alone.
  return `${joined}${targetRest || (targetPath.startsWith('/') ? '' : rest)}`;
}

function findNodes(nodes: RouteNode[] | undefined, ids: Set<string>, out: RouteNode[] = []) {
  for (const node of nodes ?? []) {
    if (ids.has(node.id)) out.push(node);
    findNodes(node.children, ids, out);
  }
  return out;
}

function stepsOf(chain: RouteNode[], leaving: RouteNode[]): PreviewStep[] {
  const steps: PreviewStep[] = [];
  const add = (phase: string, items: string[]) => {
    if (items.length) steps.push({ phase, items });
  };
  add(
    'canMatch (while matching; a rejection tries the next route)',
    chain.flatMap((node) =>
      (node.guards?.canMatch ?? []).map((name) => `${name} @ ${node.fullPath}`),
    ),
  );
  add(
    'Lazy children download (loadChildren, while matching)',
    chain
      .filter((node) => node.kind === 'lazy')
      .map(
        (node) =>
          `${node.fullPath} (${node.lazy === 'loaded' ? 'already loaded' : 'downloads now'})`,
      ),
  );
  add(
    'canDeactivate (routes being left)',
    leaving.flatMap((node) =>
      (node.guards?.canDeactivate ?? []).map((name) => `${name} @ ${node.fullPath}`),
    ),
  );
  add(
    'canActivateChild and canActivate',
    chain.flatMap((node, index) => [
      ...(index < chain.length - 1 ? (node.guards?.canActivateChild ?? []) : []).map(
        (name) => `canActivateChild ${name} @ ${node.fullPath}`,
      ),
      ...(node.guards?.canActivate ?? []).map((name) => `canActivate ${name} @ ${node.fullPath}`),
    ]),
  );
  add(
    'Lazy component download (loadComponent)',
    chain
      .filter((node) => node.kind === 'component' && node.lazy)
      .map(
        (node) =>
          `${node.component ?? node.fullPath} (${node.lazy === 'loaded' ? 'already loaded' : 'downloads now'})`,
      ),
  );
  add(
    'Resolvers',
    chain.flatMap((node) => (node.resolvers ?? []).map((name) => `${name} @ ${node.fullPath}`)),
  );
  add(
    'Renders',
    chain
      .filter((node) => node.component)
      .map(
        (node) =>
          `${node.component} for ${node.fullPath}${node.outlet ? ` in outlet ${node.outlet}` : ''}`,
      ),
  );
  const title = [...chain].reverse().find((node) => node.title)?.title;
  if (title) add('Title', [title]);
  return steps;
}

/**
 * Predicts what going to `url` would do on a page, from its live route
 * config, without navigating or running any app code.
 */
export function previewNavigation(
  page: RouterPage,
  url: string,
  sources: SourceRoute[] = [],
  serverRoutes: ServerRouteEntry[] = [],
): RoutePreviewResult {
  const config = page.config;
  if (!config) return { error: 'The page has not reported its route config yet.' };
  const target = url.startsWith('/') ? url : `/${url}`;
  const hops: PreviewHop[] = [];
  const notes: string[] = [];
  let current = target;
  let result: MatchResult = matchUrl(config, current);
  let stopped: string | undefined;
  const visited = new Set([splitUrl(current).path]);
  for (let hop = 0; hop < MAX_HOPS && result.matched; hop++) {
    const last = result.chain[result.chain.length - 1];
    if (last?.redirectTo === undefined) break;
    const next = redirectTarget(current, result.chain, result.params);
    if (next === undefined) {
      stopped = `${last.fullPath} redirects with a function (${last.redirectTo}); only the running app knows where it goes. Probe it in the app.`;
      break;
    }
    hops.push({ from: current, to: next, route: last.fullPath });
    current = next;
    const path = splitUrl(current).path;
    if (visited.has(path)) {
      stopped = `The redirects loop back to ${path}; Angular stops this with NG04016 in dev mode.`;
      break;
    }
    visited.add(path);
    notes.push(...result.notes.filter((note) => !note.includes('redirects to')));
    result = matchUrl(config, current);
  }
  notes.push(...result.notes.filter((note) => !note.includes('redirects to')));
  const chain = result.chain;
  const last = chain[chain.length - 1];
  if (!stopped && last?.kind === 'lazy' && last.lazy === 'unloaded') {
    stopped = `${last.fullPath} loads its children lazily and has not loaded yet, so the routes under it, and their guards, are not known. Read it with list-routes resolveLazy or the Read lazy button first.`;
  }
  if (!stopped && last?.redirectTo !== undefined) {
    stopped = `The redirects did not settle within ${MAX_HOPS} hops.`;
  }
  const active = new Set(page.activeIds ?? []);
  const chainIds = new Set(chain.map((node) => node.id));
  const leaving = findNodes(config, active).filter((node) => !chainIds.has(node.id));
  if (chain.some((node) => active.has(node.id))) {
    notes.push(
      'Routes marked active stay; with the default runGuardsAndResolvers they rerun guards and resolvers only when their params change.',
    );
  }
  const hit = serverRoutes.length ? renderModeFor(serverRoutes, current) : undefined;
  const preview: RoutePreview = {
    url: target,
    finalUrl: current,
    matched: result.matched && !stopped,
    hops,
    chain: chain.map((node) => {
      const route: PreviewRoute = { path: node.fullPath };
      if (node.component) route.component = node.component;
      if (node.outlet) route.outlet = node.outlet;
      if (node.lazy) route.lazy = node.lazy;
      if (node.title) route.title = node.title;
      const source = sourceFor(node, sources);
      if (source) route.source = source;
      if (active.has(node.id)) route.active = true;
      return route;
    }),
    params: result.params,
    steps: result.matched ? stepsOf(chain, leaving) : [],
    notes: [...new Set(notes)],
    nearest: result.nearest,
  };
  if (stopped) preview.stopped = stopped;
  if (hit) preview.renderMode = { mode: hit.renderMode, path: hit.path, file: hit.file };
  if (!result.matched && page.configTruncated) {
    preview.notes.push(
      'Part of the config was left out of the report, so a left-out route may still match.',
    );
  }
  return preview;
}

/** The preview for the panel: one page's prediction, or why there is none. */
export function routePreviewResult(
  state: RouterState,
  args: { page?: string; url?: string },
  sources: SourceRoute[] = [],
  serverRoutes: ServerRouteEntry[] = [],
): RoutePreviewResult {
  const page = pickPage(state, args.page);
  if (!page) return { error: 'No page reports router state.' };
  if (!args.url) return { error: 'Give a URL, such as /users/42.' };
  return previewNavigation(page, args.url.slice(0, 2000), sources, serverRoutes);
}

/** The preview as markdown for the `preview-navigation` agent tool. */
export function previewNavigationText(
  state: RouterState,
  args: { page?: string; url?: string },
  sources: SourceRoute[] = [],
  serverRoutes: ServerRouteEntry[] = [],
  now = Date.now(),
): string {
  const page = pickPage(state, args.page);
  if (!page) return noPage(args.page, state);
  const result = routePreviewResult(state, args, sources, serverRoutes);
  if ('error' in result) return `${result.error}${freshness(page, now)}`;
  const lines = [
    `**Going to ${code(result.url)}** (predicted from the live route config; nothing ran in the app)`,
  ];
  for (const hop of result.hops) {
    lines.push(`- redirect ${code(hop.from)} → ${code(hop.to)} (redirectTo on ${code(hop.route)})`);
  }
  if (result.chain.length) {
    lines.push(
      `- ${result.matched ? 'matches' : 'stops at'} ${result.chain
        .map((route) => `${code(route.path)}${route.active ? ' (active)' : ''}`)
        .join(' → ')}`,
    );
  } else {
    lines.push(
      `- matches no route (NG04002 at runtime)${result.nearest.length ? `; nearest: ${list(result.nearest)}` : ''}`,
    );
  }
  if (Object.keys(result.params).length) {
    lines.push(`- params: ${list(Object.entries(result.params).map(([k, v]) => `${k}=${v}`))}`);
  }
  if (result.steps.length) {
    lines.push('', '**In order**');
    result.steps.forEach((step, index) => {
      lines.push(`${index + 1}. ${step.phase}: ${list(step.items)}`);
    });
  }
  const files = result.chain.filter((route) => route.source);
  if (files.length) {
    lines.push(
      '',
      `**Declared in** ${files.map((route) => `${code(route.path)} ${code(route.source!)}`).join(', ')}`,
    );
  }
  if (result.renderMode) {
    lines.push(
      `**Render mode** ${code(result.renderMode.mode)} (ServerRoute ${code(result.renderMode.path)} in ${code(result.renderMode.file)})`,
    );
  }
  if (result.stopped) lines.push('', `_Stopped: ${result.stopped}_`);
  for (const note of result.notes) lines.push(`- ${note}`);
  lines.push(
    '',
    'canMatch guards, custom matchers and function redirects run only in the app: probe-route runs the real matcher and canMatch without navigating.',
  );
  return capped(`${UNTRUSTED}\n\n${lines.join('\n')}${freshness(page, now)}`, 'pass `page`');
}
