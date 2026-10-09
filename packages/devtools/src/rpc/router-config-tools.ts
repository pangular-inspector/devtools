import type { RouteNode } from '../router-config.ts';
import type { NavigationRecord } from '../router.ts';
import type { ServerRouteEntry } from './server-routes.ts';
import { code, UNTRUSTED } from './forms-tools.ts';
import {
  capped,
  describeNavigation,
  freshness,
  list,
  loopsOf,
  loopsText,
  noPage,
  otherPages,
  pickPage,
  type RouterPage,
  type RouterState,
} from './router-tools.ts';
import { hopText, loopChain, loopTitle, redirectCycles } from './router-loops.ts';

export interface SourceRoute {
  path: string;
  fullPath?: string;
  component?: string;
  redirectTo?: string;
  file: string;
  line?: number;
}

export interface MatchResult {
  matched: boolean;
  chain: RouteNode[];
  params: Record<string, string>;
  notes: string[];
  nearest: string[];
}

export interface LintFinding {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  route: string;
  message: string;
  fix: string;
  angular: 'throws' | 'warns' | 'silent';
}

const MAX_LIST = 400;

function walk(
  nodes: RouteNode[] | undefined,
  visit: (node: RouteNode, parents: RouteNode[]) => void,
  parents: RouteNode[] = [],
) {
  for (const node of nodes ?? []) {
    visit(node, parents);
    walk(node.children, visit, [...parents, node]);
  }
}

function segmentsOf(url: string): string[] {
  const path = url.split(/[?#]/)[0].replace(/\(.*\)$/, '');
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.split(';')[0]);
}

function parts(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function exampleUrl(fullPath: string): string {
  return fullPath.replace(/:([A-Za-z0-9_]+)/g, '1').replace(/\/\*\*$/, '/anything');
}

/**
 * Predicts which configured route a URL matches, the way the default
 * matcher does for the primary outlet. canMatch guards, custom matchers and
 * lazy routes that have not loaded are marked as depending on runtime.
 */
export function matchUrl(nodes: RouteNode[], url: string): MatchResult {
  const segments = segmentsOf(url);
  const notes: string[] = [];
  const attempt = (
    candidates: RouteNode[],
    remaining: string[],
    params: Record<string, string>,
    depth: number,
  ): { chain: RouteNode[]; params: Record<string, string> } | null => {
    if (depth > 13) return null;
    for (const node of candidates) {
      if (node.outlet) continue;
      if (node.matcher) {
        notes.push(
          `${code(node.fullPath)} uses a custom matcher (${code(node.matcher)}); only the running app can tell whether it matches.`,
        );
        continue;
      }
      if (node.path === '**') return { chain: [node], params };
      const own = parts(node.path);
      if (own.length > remaining.length) continue;
      const next = { ...params };
      const ok = own.every((part, i) => {
        if (part.startsWith(':')) {
          next[part.slice(1)] = remaining[i];
          return true;
        }
        return part === remaining[i];
      });
      if (!ok) continue;
      const rest = remaining.slice(own.length);
      if (node.redirectTo !== undefined) {
        if (node.pathMatch === 'full' && rest.length) continue;
        notes.push(
          `${code(node.fullPath)} redirects to ${code(node.redirectTo)}; the router matches again from there.`,
        );
        return { chain: [node], params: next };
      }
      if (node.guards?.canMatch?.length) {
        notes.push(
          `${code(node.fullPath)} has canMatch (${list(node.guards.canMatch)}); if it rejects, the router tries the next sibling.`,
        );
      }
      if (node.kind === 'lazy' && node.lazy === 'unloaded') {
        notes.push(
          `${code(node.fullPath)} loads its children lazily and has not loaded yet; the rest of the match depends on them.`,
        );
        return { chain: [node], params: next };
      }
      if (node.children?.length) {
        const sub = attempt(node.children, rest, next, depth + 1);
        if (sub) return { chain: [node, ...sub.chain], params: sub.params };
        if (rest.length === 0 && (node.component || node.kind === 'component')) {
          return { chain: [node], params: next };
        }
        continue;
      }
      if (rest.length === 0) return { chain: [node], params: next };
    }
    return null;
  };
  const found = attempt(nodes, segments, {}, 0);
  if (found) return { matched: true, chain: found.chain, params: found.params, notes, nearest: [] };
  const leaves: string[] = [];
  walk(nodes, (node) => {
    if (!node.children?.length && !node.outlet) leaves.push(node.fullPath);
  });
  const score = (path: string) => {
    const candidate = parts(path);
    let common = 0;
    while (
      common < candidate.length &&
      common < segments.length &&
      (candidate[common] === segments[common] || candidate[common].startsWith(':'))
    ) {
      common++;
    }
    return common - Math.abs(candidate.length - segments.length) * 0.1;
  };
  const nearest = [...new Set(leaves)].sort((a, b) => score(b) - score(a)).slice(0, 3);
  return { matched: false, chain: [], params: {}, notes, nearest };
}

function effectiveGuards(node: RouteNode, parents: RouteNode[]): string[] {
  const out: string[] = [];
  for (const parent of parents) {
    for (const name of parent.guards?.canActivateChild ?? [])
      out.push(`canActivateChild ${name} @ ${parent.fullPath}`);
    for (const name of parent.guards?.canMatch ?? [])
      out.push(`canMatch ${name} @ ${parent.fullPath}`);
    for (const name of parent.guards?.canActivate ?? [])
      out.push(`canActivate ${name} @ ${parent.fullPath}`);
  }
  for (const name of node.guards?.canMatch ?? []) out.push(`canMatch ${name}`);
  for (const name of node.guards?.canActivate ?? []) out.push(`canActivate ${name}`);
  return out;
}

function sourceFor(node: RouteNode, sources: SourceRoute[]): string | undefined {
  const same = (s: SourceRoute) =>
    s.fullPath === node.fullPath &&
    (s.redirectTo !== undefined) === (node.redirectTo !== undefined);
  const bare = sources.filter((s) => same(s) && !s.component);
  const hit =
    sources.find((s) => same(s) && s.component === node.component) ??
    (node.children?.length ? bare[0] : bare[bare.length - 1]) ??
    sources.find((s) => s.path === node.path && s.component && s.component === node.component) ??
    sources.find(
      (s) => s.path === node.path && s.redirectTo !== undefined && s.redirectTo === node.redirectTo,
    ) ??
    sources.find((s) => s.path === node.path);
  return hit && (hit.line ? `${hit.file}:${hit.line}` : hit.file);
}

function nodeLine(
  node: RouteNode,
  depth: number,
  active: Set<string>,
  sources: SourceRoute[],
): string {
  const pad = '  '.repeat(depth);
  const what =
    node.redirectTo !== undefined
      ? `redirect → ${code(node.redirectTo)}${node.pathMatch ? ` (pathMatch ${node.pathMatch})` : ''}`
      : node.component
        ? code(node.component)
        : node.kind;
  const bits = [`${pad}- ${code(node.fullPath)} ${what}`];
  if (active.has(node.id)) bits.push('**active**');
  if (node.lazy) bits.push(`lazy ${node.lazy}`);
  if (node.outlet) bits.push(`outlet ${code(node.outlet)}`);
  if (node.matcher) bits.push(`matcher ${code(node.matcher)}`);
  if (node.title) bits.push(`title ${code(node.title)}`);
  for (const [kind, names] of Object.entries(node.guards ?? {}))
    bits.push(`${kind} ${list(names)}`);
  if (node.resolvers) bits.push(`resolve ${list(node.resolvers)}`);
  if (node.providers) bits.push(`${node.providers} provider(s)`);
  if (node.runGuardsAndResolvers) bits.push(`runGuardsAndResolvers ${node.runGuardsAndResolvers}`);
  if (/:/.test(node.fullPath)) bits.push(`e.g. ${code(exampleUrl(node.fullPath))}`);
  const file = sourceFor(node, sources);
  if (file) bits.push(`in ${code(file)}`);
  return bits.join(' · ');
}

export function listRoutesText(
  state: RouterState,
  args: { page?: string; match?: string; audit?: boolean; filter?: string },
  sources: SourceRoute[] = [],
  now = Date.now(),
): string {
  const page = pickPage(state, args.page);
  if (!page) return noPage(args.page, state);
  const config = page.config;
  if (!config) {
    return `Page ${code(page.pageId)} has not reported its route config yet${page.setup?.mode === 'events-only' ? ' (events-only mode: this build has no debug utils, so the config cannot be read)' : ''}.${freshness(page, now)}`;
  }
  const active = new Set(page.activeIds ?? []);
  const truncated = page.configTruncated
    ? `${page.configTruncated} route(s) were left out: the page lists at most 200 routes per level and 1000 in total.`
    : '';
  if (args.match) {
    const result = matchUrl(config, args.match);
    const lines = result.matched
      ? [
          `${code(args.match)} matches: ${result.chain.map((node) => code(node.fullPath)).join(' → ')}`,
          Object.keys(result.params).length
            ? `params: ${list(Object.entries(result.params).map(([k, v]) => `${k}=${v}`))}`
            : '',
        ]
      : [
          truncated
            ? `${code(args.match)} matches no route in the reported part of the config; a left-out route may still match it.`
            : `${code(args.match)} matches no configured route (NG04002 at runtime).`,
          result.nearest.length ? `Nearest routes: ${list(result.nearest)}` : '',
        ];
    lines.push(...result.notes.map((note) => `- ${note}`));
    if (truncated) lines.push(truncated);
    lines.push(
      'This is a prediction from the config; use the navigate tool with action "probe" to run the real matcher (runs canMatch and loads lazy chunks).',
    );
    return capped(`${UNTRUSTED}\n\n${lines.filter(Boolean).join('\n')}${freshness(page, now)}`);
  }
  if (args.audit) {
    const lines: string[] = [
      'Protection per route (client-side only: the server must enforce access too):',
    ];
    if (truncated) lines.push(truncated);
    walk(config, (node, parents) => {
      if (node.children?.length || node.redirectTo !== undefined) return;
      const guards = effectiveGuards(node, parents);
      const lazyAncestor = [...parents, node].find((p) => p.kind === 'lazy');
      const weak =
        lazyAncestor && guards.length && !guards.some((g) => g.startsWith('canMatch'))
          ? ' (lazy chunk downloads before canActivate runs; canMatch would stop that)'
          : '';
      lines.push(
        `- ${code(node.fullPath)}: ${guards.length ? list(guards) : 'unprotected'}${weak}`,
      );
    });
    return capped(`${UNTRUSTED}\n\n${lines.join('\n')}${freshness(page, now)}`);
  }
  const needle = args.filter?.toLowerCase();
  const lines: string[] = [];
  let count = 0;
  const visit = (nodes: RouteNode[], depth: number) => {
    for (const node of nodes) {
      if (count >= MAX_LIST) return;
      const hit =
        !needle ||
        node.fullPath.toLowerCase().includes(needle) ||
        !!node.component?.toLowerCase().includes(needle);
      if (hit) {
        lines.push(nodeLine(node, depth, active, sources));
        count++;
      }
      if (node.children) visit(node.children, depth + 1);
    }
  };
  visit(config, 0);
  const header = `Live route config (generation ${page.generation ?? '?'}): ${count} route(s)${needle ? ` matching ${code(args.filter!)}` : ''}. Lazy routes show their children once loaded.${truncated ? ` ${truncated}` : ''}`;
  return capped(
    `${UNTRUSTED}\n\n${header}\n\n${lines.join('\n')}${otherPages(state, page)}${freshness(page, now)}`,
  );
}

export type RouterLintResult =
  | { checked: true; findings: LintFinding[] }
  | { checked: false; reason: 'no-page' | 'events-only' | 'no-config' };

/** Lint findings for the panel, or why no check could run. */
export function routerLintResult(page: RouterPage | undefined): RouterLintResult {
  if (!page) return { checked: false, reason: 'no-page' };
  if (!page.config)
    return {
      checked: false,
      reason: page.setup?.mode === 'events-only' ? 'events-only' : 'no-config',
    };
  return { checked: true, findings: lintRoutes(page) };
}

/**
 * Checks the live route config (and what the page reported about links,
 * setup and navigations) for mistakes Angular throws on, warns about, or
 * silently accepts.
 */
export function lintRoutes(page: RouterPage): LintFinding[] {
  const findings: LintFinding[] = [];
  const config = page.config ?? [];
  const inputBinding = page.setup?.features['componentInputBinding'] === 'on';
  const siblingsOf = (nodes: RouteNode[]) => {
    const primary = nodes.filter((node) => !node.outlet);
    const wildcard = primary.findIndex((node) => node.path === '**');
    if (wildcard >= 0 && wildcard < primary.length - 1) {
      findings.push({
        rule: 'wildcard-not-last',
        severity: 'error',
        route: primary[wildcard].fullPath,
        message: `${primary.length - wildcard - 1} route(s) after '**' can never match.`,
        fix: "Move the '**' route to the end of its list.",
        angular: 'silent',
      });
    }
    const seen = new Map<string, RouteNode>();
    for (const node of primary) {
      const key = `${node.path}|${node.pathMatch ?? 'prefix'}`;
      const earlier = seen.get(key);
      if (
        earlier &&
        !node.guards?.canMatch &&
        !earlier.guards?.canMatch &&
        !node.matcher &&
        !node.children?.length &&
        !earlier.children?.length &&
        !(node.kind === 'lazy' && node.lazy === 'unloaded') &&
        !(earlier.kind === 'lazy' && earlier.lazy === 'unloaded')
      ) {
        findings.push({
          rule: 'duplicate-path',
          severity: 'warning',
          route: node.fullPath,
          message: `Duplicate path; the earlier route with the same path always wins.`,
          fix: 'Remove one, or add canMatch to choose between them.',
          angular: 'silent',
        });
      }
      if (!node.children?.length) seen.set(key, node);
    }
    primary.forEach((node, index) => {
      const own = parts(node.path);
      if (own.length !== 1 || !own[0].startsWith(':') || node.guards?.canMatch) return;
      for (const later of primary.slice(index + 1)) {
        const laterParts = parts(later.path);
        if (laterParts.length === 1 && !laterParts[0].startsWith(':') && laterParts[0] !== '**') {
          findings.push({
            rule: 'param-shadows-literal',
            severity: 'warning',
            route: later.fullPath,
            message: `${code(node.fullPath)} comes first and matches ${code(later.path)} as its param, so this route is never reached.`,
            fix: `Put ${code(later.path)} before ${code(node.path)}.`,
            angular: 'silent',
          });
        }
      }
    });
    for (const node of primary) {
      if (node.path === '' && node.redirectTo !== undefined && node.pathMatch !== 'full') {
        findings.push({
          rule: 'empty-redirect-prefix',
          severity: 'error',
          route: node.fullPath,
          message: "An empty-path redirect without pathMatch 'full' matches every URL.",
          fix: "Add pathMatch: 'full'.",
          angular: 'throws',
        });
      }
    }
  };
  const untitled: string[] = [];
  siblingsOf(config);
  walk(config, (node, parents) => {
    if (node.children?.length) siblingsOf(node.children);
    if (node.classGuards?.length) {
      findings.push({
        rule: 'class-guard',
        severity: 'info',
        route: node.fullPath,
        message: `Class-based guards/resolvers (${list(node.classGuards)}) are deprecated.`,
        fix: 'Use functional guards, e.g. () => inject(AuthService).isLoggedIn().',
        angular: 'silent',
      });
    }
    if (node.guards?.canLoad?.length) {
      findings.push({
        rule: 'can-load',
        severity: 'warning',
        route: node.fullPath,
        message: 'canLoad is deprecated, and PreloadAllModules skips routes that have it.',
        fix: 'Use canMatch instead.',
        angular: 'silent',
      });
    }
    const lazy = node.kind === 'lazy';
    if (
      lazy &&
      node.guards?.canActivate?.length &&
      !node.guards?.canMatch?.length &&
      !node.guards?.canLoad?.length
    ) {
      findings.push({
        rule: 'chunk-before-guard',
        severity: 'info',
        route: node.fullPath,
        message:
          'The lazy chunk is downloaded before canActivate runs, so users who are rejected still get the code.',
        fix: 'Add the check as canMatch too if the code itself should not ship to them.',
        angular: 'silent',
      });
    }
    const isLeafComponent = !node.children?.length && (node.component || node.kind === 'component');
    if (isLeafComponent && !node.title && ![...parents].some((p) => p.title)) {
      untitled.push(node.fullPath);
    }
    if (inputBinding && node.inputs) {
      for (const part of parts(node.path)) {
        if (!part.startsWith(':')) continue;
        const name = part.slice(1);
        if (!node.inputs.includes(name)) {
          const close = node.inputs.find((input) => input.toLowerCase() === name.toLowerCase());
          if (close) {
            findings.push({
              rule: 'param-input-mismatch',
              severity: 'warning',
              route: node.fullPath,
              message: `Param ${code(':' + name)} does not bind to input ${code(close)} (names are case-sensitive).`,
              fix: `Rename one so they match.`,
              angular: 'silent',
            });
          }
        }
      }
    }
  });
  if (untitled.length) {
    findings.push({
      rule: 'missing-title',
      severity: 'info',
      route:
        untitled.slice(0, 10).join(', ') +
        (untitled.length > 10 ? ` and ${untitled.length - 10} more` : ''),
      message: `${untitled.length} page route(s) have no title on themselves or a parent, so the document title does not change when they activate (screen readers announce the old one).`,
      fix: "Add title: 'Page name' (or a title resolver) to each.",
      angular: 'silent',
    });
  }
  const titles = new Map<string, string[]>();
  walk(config, (node) => {
    if (node.title && !node.title.startsWith('resolver ') && !node.children?.length) {
      titles.set(node.title, [...(titles.get(node.title) ?? []), node.fullPath]);
    }
  });
  for (const [title, routes] of titles) {
    if (routes.length > 1) {
      findings.push({
        rule: 'duplicate-title',
        severity: 'info',
        route: routes.join(', '),
        message: `${routes.length} routes share the title ${code(title)}.`,
        fix: 'Give each page a distinct title.',
        angular: 'silent',
      });
    }
  }
  for (const cycle of redirectCycles(config)) {
    findings.push({
      rule: 'redirect-cycle',
      severity: 'error',
      route: cycle[0],
      message: `Redirect cycle: ${cycle.map(code).join(' → ')}.`,
      fix: 'Break the cycle; one of these redirects must point elsewhere.',
      angular: 'throws',
    });
  }
  for (const loop of loopsOf(page)) {
    if (loop.kind === 'config' && findings.some((f) => f.rule === 'redirect-cycle')) continue;
    const hops = loop.hops.map(hopText).join('; ');
    const guards = loop.guards.length ? ` Guards involved: ${list(loop.guards)}.` : '';
    findings.push({
      rule: 'redirect-loop',
      severity: loop.end.startsWith('settled') && loop.bounces < 2 ? 'warning' : 'error',
      route: loop.cycle[0],
      message: `Navigations ${loop.ids.map((id) => `#${id}`).join(', ')} formed a ${loopTitle(loop)}: ${loopChain(loop)} (${loop.end}). ${hops}.${guards}`,
      fix:
        loop.kind === 'config'
          ? 'Point one of these redirectTo entries elsewhere.'
          : 'Make the guards agree on who may see each URL, e.g. a guard on the login page must not send users back to a route whose guard sends them to login; redirect to a page no guard in the chain protects.',
      angular: loop.kind === 'config' ? 'throws' : 'silent',
    });
  }
  for (const link of page.links ?? []) {
    if (link.linkActive !== undefined && link.ariaCurrent === undefined) {
      findings.push({
        rule: 'link-aria-current',
        severity: 'info',
        route: link.href ?? link.text,
        message: `Link ${code(link.text)} uses routerLinkActive without ariaCurrentWhenActive, so screen readers are not told which link is current.`,
        fix: 'Add ariaCurrentWhenActive="page".',
        angular: 'silent',
      });
    }
  }
  const emailed = page.navigations.find((nav) => /[^/?&=]+@[^/?&=]+\.[a-z]{2,}/i.test(nav.url));
  if (emailed) {
    findings.push({
      rule: 'email-in-url',
      severity: 'warning',
      route: emailed.url,
      message: 'An email address appears in a URL; URLs end up in history, logs and referrers.',
      fix: 'Pass it in navigation state or a service instead.',
      angular: 'silent',
    });
  }
  for (const nav of page.navigations) {
    const target = nav.redirectTo ?? nav.url;
    const from = nav.from ?? '';
    const query = from.split('?')[1]?.split('#')[0] ?? '';
    const fromValues = query.split('&').map((pair) => {
      try {
        return decodeURIComponent(pair.split('=')[1] ?? '');
      } catch {
        return '';
      }
    });
    if (
      target.length > 1 &&
      fromValues.includes(target) &&
      /return|redirect|next|url|back/i.test(query)
    ) {
      findings.push({
        rule: 'redirect-from-query',
        severity: 'info',
        route: target,
        message: `Navigation #${nav.id} went to a URL taken from a query param of ${code(from)}.`,
        fix: 'Validate return URLs against an allow list before navigating.',
        angular: 'silent',
      });
      break;
    }
  }
  return findings;
}

export function lintRoutesText(
  state: RouterState,
  args: { page?: string },
  now = Date.now(),
): string {
  const page = pickPage(state, args.page);
  if (!page) return noPage(args.page, state);
  if (!page.config)
    return page.setup?.mode === 'events-only'
      ? `No checks ran: page ${code(page.pageId)} runs in events-only mode (no debug utils, for example a production build), so it cannot report its route config.${freshness(page, now)}`
      : `Page ${code(page.pageId)} has not reported its route config yet.${freshness(page, now)}`;
  const findings = lintRoutes(page);
  if (!findings.length)
    return `${UNTRUSTED}\n\nNo route config problems found (${countNodes(page.config)} routes checked). Lazy routes that have not loaded yet are not checked.${freshness(page, now)}`;
  const order = { error: 0, warning: 1, info: 2 };
  const lines = findings
    .sort((a, b) => order[a.severity] - order[b.severity])
    .map(
      (f) =>
        `- **${f.severity}** ${code(f.rule)} ${code(f.route)}: ${f.message} Fix: ${f.fix} (Angular ${f.angular === 'throws' ? 'throws' : f.angular === 'warns' ? 'warns' : 'does not warn'})`,
    );
  return capped(
    `${UNTRUSTED}\n\n${findings.length} finding(s):\n${lines.join('\n')}${freshness(page, now)}`,
  );
}

function countNodes(nodes: RouteNode[] | undefined): number {
  let count = 0;
  walk(nodes, () => count++);
  return count;
}

export function routerConfigText(
  state: RouterState,
  args: { page?: string },
  now = Date.now(),
): string {
  const page = pickPage(state, args.page);
  if (!page) return noPage(args.page, state);
  const setup = page.setup;
  if (!setup)
    return `Page ${code(page.pageId)} has not reported its router setup yet.${freshness(page, now)}`;
  const lines = [
    `**Mode** ${setup.mode === 'full' ? 'full' : 'events-only (no debug utils: production build or unusual setup; config, lint and actions are limited)'}`,
    `**Set up with** ${setup.setupKind}${setup.routers > 1 ? `, ${setup.routers} routers on the page (showing the first in use)` : ''}`,
  ];
  if (setup.angularVersion) lines.push(`**Angular** ${code(setup.angularVersion)}`);
  if (setup.baseHref)
    lines.push(
      `**Base href** ${code(setup.baseHref)} (deep links 404 on refresh unless the server falls back to index.html)`,
    );
  if (setup.hydrated)
    lines.push(`**Hydration** ${setup.hydrated} component(s) hydrated from server HTML`);
  lines.push('', '**Options** (effective value; "set" means configured, otherwise the default)');
  for (const option of setup.options)
    lines.push(`- ${code(option.name)}: ${code(option.value)}${option.set ? ' (set)' : ''}`);
  lines.push('', '**Features**');
  for (const [name, value] of Object.entries(setup.features))
    lines.push(`- ${code(name)}: ${code(value)}`);
  lines.push('', '**Strategies**');
  for (const [name, value] of Object.entries(setup.strategies))
    lines.push(`- ${code(name)}: ${code(value)}`);
  lines.push(
    '',
    `**Instrumentation** ${page.instrumented ? 'on (each guard and resolver run is recorded)' : 'off'}`,
  );
  return capped(
    `${UNTRUSTED}\n\n${lines.join('\n')}${otherPages(state, page)}${freshness(page, now)}`,
  );
}

export function exportNavigationText(
  state: RouterState,
  args: { page?: string; id?: number },
  now = Date.now(),
): string {
  const page = pickPage(state, args.page);
  if (!page) return noPage(args.page, state);
  const nav: NavigationRecord | undefined =
    args.id !== undefined
      ? page.navigations.find((n) => n.id === args.id)
      : ([...page.navigations]
          .reverse()
          .find((n) => !n.probe && n.outcome !== 'succeeded' && n.outcome !== 'pending') ??
        [...page.navigations].reverse().find((n) => !n.probe));
  if (!nav) return `No navigation to export.${freshness(page, now)}`;
  const chainIds = new Set<number>();
  let cursor: NavigationRecord | undefined = nav;
  while (cursor && !chainIds.has(cursor.id)) {
    chainIds.add(cursor.id);
    cursor = page.navigations.find((n) => n.id === cursor!.redirectedFrom);
  }
  const after = new Set([nav.id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const n of page.navigations) {
      if (n.redirectedFrom !== undefined && after.has(n.redirectedFrom) && !after.has(n.id)) {
        after.add(n.id);
        chainIds.add(n.id);
        grew = true;
      }
    }
  }
  const chain = page.navigations.filter((n) => chainIds.has(n.id));
  const setup = page.setup;
  const lines = [
    `## Router repro: #${nav.id} ${nav.url} (${nav.outcome})`,
    '',
    `- Angular: ${setup?.angularVersion ?? 'unknown'}; router set up with ${setup?.setupKind ?? 'unknown'}`,
  ];
  if (setup) {
    const custom = setup.options.filter((o) => o.set).map((o) => `${o.name}: ${o.value}`);
    if (custom.length) lines.push(`- Options: ${custom.join(', ')}`);
    const on = Object.entries(setup.features)
      .filter(([, v]) => v !== 'off')
      .map(([k, v]) => (v === 'on' ? k : `${k}: ${v}`));
    if (on.length) lines.push(`- Features: ${on.join(', ')}`);
  }
  lines.push(
    `- Started from ${nav.from ?? 'unknown'}${nav.caller ? ` by ${nav.caller}` : ''}${nav.extras?.length ? ` with ${nav.extras.join(', ')}` : ''}`,
  );
  lines.push('', '### Navigation chain');
  for (const item of chain) lines.push(describeNavigation(item, page));
  const loops = loopsOf(page).filter((loop) => loop.ids.some((id) => chainIds.has(id)));
  if (loops.length) lines.push('', '### Redirect loop', loopsText(loops).trim());
  if (page.config) {
    const relevant: RouteNode[] = [];
    const target = segmentsOf(nav.finalUrl ?? nav.url)[0] ?? '';
    walk(page.config, (node) => {
      if (parts(node.fullPath)[0] === target || node.path === '**' || node.fullPath === '/')
        relevant.push(node);
    });
    lines.push('', '### Relevant routes');
    for (const node of relevant.slice(0, 40))
      lines.push(nodeLine(node, 0, new Set(page.activeIds ?? []), []));
  }
  lines.push(
    '',
    '### To reproduce',
    `Navigate to \`${nav.url}\`${nav.from ? ` while on \`${nav.from}\`` : ''}.`,
    '',
    '_Values that looked secret are shown as [redacted]._',
  );
  return capped(`${UNTRUSTED}\n\n${lines.join('\n')}${freshness(page, now)}`);
}

function serverPathMatches(pattern: string, url: string): boolean {
  if (pattern === '**') return true;
  const want = parts(pattern);
  const have = segmentsOf(url);
  for (let i = 0; i < want.length; i++) {
    if (want[i] === '**') return true;
    if (i >= have.length) return false;
    if (want[i] === '*' || want[i].startsWith(':')) continue;
    if (want[i] !== have[i]) return false;
  }
  return want.length === have.length;
}

export function renderModeFor(
  entries: ServerRouteEntry[],
  url: string,
): ServerRouteEntry | undefined {
  const exact = entries.filter((e) => !/[*:]/.test(e.path));
  const dynamic = entries.filter((e) => /[*:]/.test(e.path) && e.path !== '**');
  const wildcard = entries.filter((e) => e.path === '**');
  return [...exact, ...dynamic, ...wildcard].find((entry) => serverPathMatches(entry.path, url));
}

export function explainRenderModeText(
  state: RouterState,
  entries: ServerRouteEntry[],
  args: { page?: string; url?: string },
  now = Date.now(),
): string {
  if (!entries.length)
    return 'No ServerRoute config found (no *.routes.server.ts in the workspace), so every route uses the default server rendering setup.';
  const page = pickPage(state, args.page);
  if (args.page && !page) return noPage(args.page, state);
  const url = args.url ?? page?.snapshot?.url;
  const lines: string[] = [];
  if (url) {
    const hit = renderModeFor(entries, url);
    lines.push(
      hit
        ? `${code(url)} renders with ${code(hit.renderMode)} (ServerRoute ${code(hit.path)} in ${code(hit.file)}).`
        : `${code(url)} matches no ServerRoute entry.`,
    );
    if (hit?.renderMode === 'Prerender' && /[:*]/.test(hit.path)) {
      lines.push('A Prerender route with params needs getPrerenderParams, or the build fails.');
    }
  }
  if (page?.config) {
    const clientPaths: string[] = [];
    const unloaded: string[] = [];
    walk(page.config, (node) => {
      if (!node.children?.length && node.redirectTo === undefined) clientPaths.push(node.fullPath);
      if (node.kind === 'lazy' && node.lazy === 'unloaded') unloaded.push(node.fullPath);
    });
    const unknown = entries.filter(
      (entry) =>
        entry.path !== '**' &&
        !page.configTruncated &&
        !unloaded.some((prefix) =>
          serverPathMatches(`${prefix.replace(/^\//, '')}/**`, `/${entry.path}`),
        ) &&
        !clientPaths.some(
          (path) =>
            serverPathMatches(entry.path, path) ||
            serverPathMatches(path.replace(/^\//, ''), `/${entry.path}`),
        ),
    );
    if (unknown.length) {
      lines.push(
        `ServerRoute entries with no matching client route: ${list(unknown.map((e) => e.path))} (Angular fails the build for these).`,
      );
    }
    const modes = new Map<string, string[]>();
    for (const path of clientPaths.slice(0, 200)) {
      const hit = renderModeFor(entries, path);
      const mode = hit?.renderMode ?? 'none';
      modes.set(mode, [...(modes.get(mode) ?? []), path]);
    }
    for (const [mode, paths] of modes)
      lines.push(
        `- ${code(mode)}: ${list(paths.slice(0, 20))}${paths.length > 20 ? ` and ${paths.length - 20} more` : ''}`,
      );
  }
  return capped(`${UNTRUSTED}\n\n${lines.join('\n')}${page ? freshness(page, now) : ''}`);
}
