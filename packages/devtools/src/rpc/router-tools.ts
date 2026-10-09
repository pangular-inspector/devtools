import type { ActiveRoute, NavigationRecord, RouterSnapshot } from '../router.ts';
import type { RouteNode } from '../router-config.ts';
import type { RouterSetup } from '../router-setup.ts';
import type { LinkInfo, OutletInfo } from '../router-links.ts';
import type { PreloadRecord } from '../router-actions.ts';
import { fixedTtl, type PageTtl } from './page-ttl.ts';
import { code, UNTRUSTED } from './forms-tools.ts';
import { unknownPageText } from './pages.ts';
import { droppedNote } from '../timeline-limits.ts';
import {
  describeLoop,
  detectLoops,
  hopText,
  loopChain,
  loopTitle,
  type NavigationLoop,
} from './router-loops.ts';

export interface RouterReport {
  pageId: string;
  snapshot: RouterSnapshot | null;
  navigations: NavigationRecord[];
  /** Older navigations removed at `limits.navigations`. */
  dropped?: number;
  generation?: number;
  config?: RouteNode[];
  configTruncated?: number;
  activeIds?: string[];
  setup?: RouterSetup;
  outlets?: OutletInfo[];
  links?: LinkInfo[];
  preloads?: PreloadRecord[];
  instrumented?: boolean;
}

export interface RouterPage extends RouterReport {
  reportedAt: number;
  changedAt: number;
  loops?: NavigationLoop[];
}

export interface RouterState {
  pages: RouterPage[];
}

type Pages = Map<string, RouterPage>;

const STALE_AFTER_MS = 10_000;
export const ROUTER_PAGE_TTL_MS = 150_000;
const PAGE_EXPIRES_MS = ROUTER_PAGE_TTL_MS;
const MAX_NAVIGATIONS = 50;
const MAX_PAGES = 20;
const MAX_RESOURCE_CHARS = 100_000;
const MAX_TEXT = 4_000;
const MAX_TOOL_CHARS = 20_000;
const MAX_ROUTES = 1_000;
const MAX_CHILDREN = 200;
const MAX_ROUTE_DEPTH = 13;
const OUTCOMES = ['pending', 'succeeded', 'redirected', 'cancelled', 'failed', 'skipped'];

export const ERROR_CATALOG: Record<string, string> = {
  NG04000:
    'A relative redirectTo used a named outlet; only absolute redirects can target named outlets.',
  NG04001: 'redirectTo points at a :param the source path does not have.',
  NG04002:
    'No route matches the URL. Check spelling, route order, pathMatch and whether a lazy route or canMatch guard hides it (list-routes with `match` shows the nearest candidates).',
  NG04003: 'The root URL segment has matrix parameters, which the router does not allow.',
  NG04004: '{outlets: {...}} has to be the last navigation command.',
  NG04005: 'Too many "../" in a relative navigation for the current route depth.',
  NG04006: 'Two sibling segments target the same outlet name.',
  NG04007:
    'The Router was provided more than once, usually RouterModule.forRoot() in a lazy module instead of forChild().',
  NG04008:
    'A navigation command contains an empty or invalid segment (for example an undefined value in router.navigate([...]).',
  NG04009: 'An empty path URL segment has matrix parameters.',
  NG04010: 'The URL could not be parsed or is nested too deep.',
  NG04011: 'The URL is malformed: the parser expected a different character.',
  NG04012: 'Code read the component or route of a RouterOutlet that is not activated.',
  NG04013:
    'An outlet was activated twice without being deactivated, usually custom reuse strategy or outlet code.',
  NG04014:
    'Invalid route configuration (for example loadComponent with an NgModule, or both component and redirectTo).',
  NG04015: 'The root UrlSegmentGroup of a UrlTree has segments; they belong in children.',
  NG04016: 'A redirect loop was detected in dev mode (the redirect target redirects back).',
  NG04017:
    'A routerLink bound to a UrlTree also sets queryParams or fragment, which is not allowed.',
  NG04018:
    'A URL could not be parsed, so the router fell back to "/" (a warning, not a thrown error).',
  NG0203:
    'inject() ran outside an injection context, often in a guard or resolver that calls inject() after an await.',
  NG0201:
    'A guard, resolver or routed component asked for a provider that no injector has; check route-level providers.',
  NG0950:
    'A required input has no value. With withComponentInputBinding the route must provide it as a param, query param or data key.',
};

function isRecord(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown, max = MAX_TEXT): value is string {
  return typeof value === 'string' && value.length <= max;
}

function optional(value: unknown, check: (v: unknown) => boolean): boolean {
  return value === undefined || check(value);
}

function isNames(value: unknown, max = 100, length = 300): boolean {
  return Array.isArray(value) && value.length <= max && value.every((v) => isText(v, length));
}

function isNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBool(value: unknown): boolean {
  return typeof value === 'boolean';
}

function isPlain(value: unknown, budget: { n: number }, depth = 0): boolean {
  if (--budget.n < 0 || depth > 8) return false;
  if (value === null || typeof value === 'boolean' || isNumber(value)) return true;
  if (typeof value === 'string') return value.length <= MAX_TEXT;
  if (Array.isArray(value)) return value.every((item) => isPlain(item, budget, depth + 1));
  return (
    isRecord(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.values(value).every((item) => isPlain(item, budget, depth + 1))
  );
}

function isTextMap(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.keys(value).length <= 200 &&
    Object.values(value).every((v) => isText(v, 300))
  );
}

function isRoute(value: unknown, budget: { n: number }, depth = 0): boolean {
  if (!isRecord(value) || depth >= MAX_ROUTE_DEPTH || ++budget.n > MAX_ROUTES) return false;
  const route: Partial<ActiveRoute> = value;
  return (
    isText(route.path) &&
    isText(route.url) &&
    isText(route.outlet, 300) &&
    optional(route.component, (v) => isText(v, 300)) &&
    optional(route.title, isText) &&
    optional(route.ownTitle, isBool) &&
    optional(route.lazy, isBool) &&
    optional(route.resolvers, (v) => isNames(v)) &&
    optional(route.guards, (v) => isRecord(v) && Object.values(v).every((n) => isNames(n))) &&
    optional(route.paramSources, isTextMap) &&
    optional(route.dataSources, isTextMap) &&
    isRecord(route.params) &&
    isPlain(route.params, { n: 2_000 }) &&
    isRecord(route.data) &&
    isPlain(route.data, { n: 2_000 }) &&
    Array.isArray(route.children) &&
    route.children.length <= MAX_CHILDREN &&
    route.children.every((child) => isRoute(child, budget, depth + 1))
  );
}

function isSnapshot(value: unknown): boolean {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  const snapshot: Partial<RouterSnapshot> = value;
  return (
    isText(snapshot.url) &&
    isRecord(snapshot.queryParams) &&
    isPlain(snapshot.queryParams, { n: 2_000 }) &&
    (snapshot.fragment === null || isText(snapshot.fragment)) &&
    optional(snapshot.browserUrl, isText) &&
    optional(snapshot.urlDrift, isBool) &&
    optional(snapshot.title, isText) &&
    optional(
      snapshot.pending,
      (v) =>
        isRecord(v) && isNumber((v as { id?: unknown }).id) && isText((v as { url?: unknown }).url),
    ) &&
    isRoute(snapshot.root, { n: 0 })
  );
}

function isRun(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const run = value as Record<string, unknown>;
  return (
    isText(run['guard'], 300) &&
    isText(run['kind'], 50) &&
    isText(run['route']) &&
    isText(run['result'], 400) &&
    isNumber(run['ms'])
  );
}

function isNavigation(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const nav: Partial<NavigationRecord> = value;
  return (
    isNumber(nav.id) &&
    isText(nav.url) &&
    isText(nav.trigger, 50) &&
    isNumber(nav.startedAt) &&
    OUTCOMES.includes(nav.outcome as string) &&
    optional(nav.endedAt, isNumber) &&
    optional(nav.finalUrl, isText) &&
    optional(nav.from, isText) &&
    optional(nav.extras, (v) => isNames(v, 20)) &&
    optional(nav.caller, (v) => isText(v, 300)) &&
    optional(
      nav.phases,
      (v) => isRecord(v) && Object.keys(v).length <= 10 && Object.values(v).every(isNumber),
    ) &&
    optional(nav.redirectedFrom, isNumber) &&
    optional(nav.redirectTo, isText) &&
    optional(nav.redirectKind, (v) => isText(v, 50)) &&
    optional(nav.reason, isText) &&
    optional(nav.code, (v) => isText(v, 100)) &&
    optional(nav.errorCode, (v) => isText(v, 20)) &&
    optional(nav.errorHandler, isText) &&
    optional(nav.scroll, (v) => isText(v, 200)) &&
    optional(nav.title, isText) &&
    optional(nav.generation, isNumber) &&
    optional(nav.beforeConnect, isBool) &&
    optional(nav.probe, isBool) &&
    optional(nav.earlier, isNumber) &&
    optional(nav.lazyLoaded, (v) => isNames(v)) &&
    optional(nav.reused, (v) => isNames(v)) &&
    optional(nav.warnings, (v) => isNames(v, 10)) &&
    optional(
      nav.checked,
      (v) =>
        isRecord(v) &&
        isNames((v as { activate?: unknown }).activate) &&
        isNames((v as { deactivate?: unknown }).deactivate),
    ) &&
    optional(
      nav.requests,
      (v) =>
        isRecord(v) &&
        isNumber((v as { count?: unknown }).count) &&
        isNames((v as { urls?: unknown }).urls, 10, 2000),
    ) &&
    optional(nav.runs, (v) => Array.isArray(v) && v.length <= 40 && v.every(isRun)) &&
    optional(
      nav.guards,
      (v) =>
        isRecord(v) &&
        isNames((v as { names?: unknown }).names) &&
        optional((v as { passed?: unknown }).passed, isBool) &&
        optional((v as { ms?: unknown }).ms, isNumber),
    ) &&
    optional(
      nav.resolvers,
      (v) =>
        isRecord(v) &&
        isNames((v as { names?: unknown }).names) &&
        optional((v as { ms?: unknown }).ms, isNumber),
    )
  );
}

function isNode(value: unknown, budget: { n: number }, depth = 0): boolean {
  if (!isRecord(value) || depth >= MAX_ROUTE_DEPTH || ++budget.n > MAX_ROUTES) return false;
  const node: Partial<RouteNode> = value;
  return (
    isText(node.id, 100) &&
    isText(node.path, 500) &&
    isText(node.fullPath) &&
    isText(node.kind, 30) &&
    optional(node.component, (v) => isText(v, 300)) &&
    optional(node.redirectTo, (v) => isText(v, 500)) &&
    optional(node.pathMatch, (v) => isText(v, 20)) &&
    optional(node.outlet, (v) => isText(v, 100)) &&
    optional(node.lazy, (v) => v === 'loaded' || v === 'unloaded') &&
    optional(node.matcher, (v) => isText(v, 300)) &&
    optional(node.guards, (v) => isRecord(v) && Object.values(v).every((n) => isNames(n))) &&
    optional(node.classGuards, (v) => isNames(v)) &&
    optional(node.resolvers, (v) => isNames(v)) &&
    optional(node.title, (v) => isText(v, 300)) &&
    optional(node.dataKeys, (v) => isNames(v)) &&
    optional(node.inputs, (v) => isNames(v)) &&
    optional(node.providers, isNumber) &&
    optional(node.runGuardsAndResolvers, (v) => isText(v, 50)) &&
    optional(
      node.children,
      (v) =>
        Array.isArray(v) &&
        v.length <= MAX_CHILDREN &&
        v.every((child) => isNode(child, budget, depth + 1)),
    )
  );
}

export function isRouterReport(
  value: unknown,
  maxNavigations = MAX_NAVIGATIONS,
): value is RouterReport {
  if (!isRecord(value)) return false;
  const report: Partial<RouterReport> = value;
  const nodes = { n: 0 };
  return (
    isText(report.pageId, 50) &&
    isSnapshot(report.snapshot) &&
    Array.isArray(report.navigations) &&
    report.navigations.length <= maxNavigations &&
    report.navigations.every(isNavigation) &&
    optional(report.dropped, isNumber) &&
    optional(report.generation, isNumber) &&
    optional(
      report.config,
      (v) => Array.isArray(v) && v.length <= MAX_CHILDREN && v.every((node) => isNode(node, nodes)),
    ) &&
    optional(report.configTruncated, isNumber) &&
    optional(report.activeIds, (v) => isNames(v, MAX_ROUTES)) &&
    optional(report.setup, (v) => isRecord(v) && isPlain(v, { n: 500 })) &&
    optional(report.outlets, (v) => Array.isArray(v) && isPlain(v, { n: 3_000 })) &&
    optional(
      report.links,
      (v) => Array.isArray(v) && v.length <= 100 && isPlain(v, { n: 3_000 }),
    ) &&
    optional(
      report.preloads,
      (v) => Array.isArray(v) && v.length <= 50 && isPlain(v, { n: 500 }),
    ) &&
    optional(report.instrumented, isBool)
  );
}

function stateOf(pages: Pages): RouterState {
  return {
    pages: Array.from(pages.values()).sort(
      (a, b) => b.changedAt - a.changedAt || b.reportedAt - a.reportedAt,
    ),
  };
}

function contentOf(report: RouterReport): string {
  return JSON.stringify([report.snapshot, report.navigations]);
}

export function currentRouter(pages: Pages): RouterState {
  return stateOf(pages);
}

export function expireRouterPages(
  pages: Pages,
  now = Date.now(),
  ttl: PageTtl = fixedTtl(PAGE_EXPIRES_MS),
): RouterState | null {
  let expired = false;
  for (const [id, page] of pages) {
    if (now - page.reportedAt > ttl(id)) {
      pages.delete(id);
      expired = true;
    }
  }
  return expired ? stateOf(pages) : null;
}

export function touchRouterPage(pages: Pages, pageId: unknown, now = Date.now()): boolean {
  const page = typeof pageId === 'string' ? pages.get(pageId) : undefined;
  if (!page) return false;
  pages.set(page.pageId, { ...page, reportedAt: now });
  return true;
}

export function mergeRouterReport(
  pages: Pages,
  report: RouterReport,
  now = Date.now(),
  ttl: PageTtl = fixedTtl(PAGE_EXPIRES_MS),
) {
  const previous = pages.get(report.pageId);
  const changedAt =
    previous && contentOf(previous) === contentOf(report) ? previous.changedAt : now;
  const next: RouterPage = { ...report, reportedAt: now, changedAt };
  if (!report.config && previous?.config && previous.generation === report.generation) {
    next.config = previous.config;
  }
  next.loops = detectLoops(next.navigations, next.config);
  pages.set(report.pageId, next);
  expireRouterPages(pages, now, ttl);
  if (pages.size > MAX_PAGES) {
    const oldest = [...pages.values()].sort((a, b) => a.reportedAt - b.reportedAt);
    for (const page of oldest.slice(0, pages.size - MAX_PAGES)) pages.delete(page.pageId);
  }
  return stateOf(pages);
}

export function freshness(page: RouterPage, now: number): string {
  const age = now - page.reportedAt;
  return age > STALE_AFTER_MS
    ? `\n\n_Last reported ${Math.round(age / 1000)}s ago. The page may have closed or navigated away._`
    : '';
}

export function pickPage(state: RouterState, pageId?: string): RouterPage | undefined {
  if (pageId) return state.pages.find((p) => p.pageId === pageId);
  return state.pages.find((p) => p.snapshot) ?? state.pages[0];
}

export function otherPages(state: RouterState, page: RouterPage): string {
  const others = state.pages.filter((p) => p !== page);
  if (!others.length) return '';
  const list = others.map((p) => `${code(p.pageId)} (${code(p.snapshot?.url ?? '?')})`).join(', ');
  return `\n\n${others.length} other page(s) report too: ${list}. Pass \`page\` to see one.`;
}

export function noPage(pageId: string | undefined, state: RouterState): string {
  const pages = state.pages.map((page) => ({
    pageId: page.pageId,
    url: page.snapshot?.url,
    reportedAt: page.reportedAt,
  }));
  return unknownPageText(pageId ?? '', pages, 'router state');
}

export function json(value: unknown): string {
  const text = JSON.stringify(value);
  return code(text.length > 500 ? `${text.slice(0, 500)}…` : text);
}

export function capped(text: string): string {
  return text.length > MAX_TOOL_CHARS
    ? `${text.slice(0, MAX_TOOL_CHARS)}… (truncated; pass \`page\`, \`url\` or a smaller \`limit\`)`
    : text;
}

export function list(names: string[]): string {
  return names.map(code).join(', ');
}

function sourcesText(sources: Record<string, string> | undefined, kind: string): string {
  if (!sources) return '';
  const notOwn = Object.entries(sources).filter(([, source]) => source !== 'own');
  if (!notOwn.length) return '';
  return ` (${kind}: ${notOwn.map(([key, source]) => `${code(key)} ${source}`).join(', ')})`;
}

function routeLines(route: ActiveRoute, depth: number, out: string[]) {
  const pad = '  '.repeat(depth);
  const name = route.path === '' && depth === 0 ? '(root)' : `/${route.path}`;
  const parts = [code(name)];
  if (route.component) parts.push(`→ ${code(route.component)}`);
  if (route.outlet !== 'primary') parts.push(`(outlet ${code(route.outlet)})`);
  if (route.lazy) parts.push('(lazy)');
  out.push(`${pad}- ${parts.join(' ')}`);
  if (Object.keys(route.params).length) {
    out.push(
      `${pad}  - params: ${json(route.params)}${sourcesText(route.paramSources, 'sources')}`,
    );
  }
  if (Object.keys(route.data).length) {
    out.push(`${pad}  - data: ${json(route.data)}${sourcesText(route.dataSources, 'sources')}`);
  }
  if (route.title) {
    out.push(
      `${pad}  - title: ${code(route.title)}${route.ownTitle === false ? ' (inherited)' : ''}`,
    );
  }
  for (const [kind, names] of Object.entries(route.guards ?? {})) {
    out.push(`${pad}  - ${kind}: ${list(names)}`);
  }
  if (route.resolvers) out.push(`${pad}  - resolve: ${list(route.resolvers)}`);
  for (const child of route.children) routeLines(child, depth + 1, out);
}

function outletLines(outlets: OutletInfo[], depth: number, out: string[]) {
  for (const outlet of outlets) {
    const pad = '  '.repeat(depth);
    const shows = outlet.activated
      ? `${code(outlet.component ?? '?')} for ${code(outlet.route ?? '?')}`
      : 'nothing (not activated)';
    out.push(
      `${pad}- outlet ${code(outlet.outlet)}: ${shows}${outlet.detached ? ' (detached by the reuse strategy)' : ''}`,
    );
    const bound = outlet.inputs?.filter((input) => input.source !== 'unset');
    if (bound?.length) {
      out.push(
        `${pad}  - router-bound inputs: ${bound.map((i) => `${code(i.input)} from ${i.source}`).join(', ')}`,
      );
    }
    if (outlet.data !== undefined) {
      out.push(`${pad}  - routerOutletData (ROUTER_OUTLET_DATA): ${code(outlet.data)}`);
    }
    if (outlet.children) outletLines(outlet.children, depth + 1, out);
  }
}

function findOutlet(outlets: OutletInfo[] | undefined, needle: string): OutletInfo | undefined {
  for (const outlet of outlets ?? []) {
    if (
      outlet.component?.toLowerCase() === needle.toLowerCase() ||
      outlet.element?.toLowerCase() === needle.toLowerCase() ||
      outlet.devtoolsId === needle
    ) {
      return outlet;
    }
    const nested = findOutlet(outlet.children, needle);
    if (nested) return nested;
  }
  return undefined;
}

export function inspectRouteText(
  state: RouterState,
  args: { page?: string; selector?: string },
  now = Date.now(),
): string {
  const page = pickPage(state, args.page);
  if (!page) return noPage(args.page, state);
  if (!page.snapshot) {
    return `${UNTRUSTED}\n\nPage ${code(page.pageId)} reports no Router. The app may not use the Angular router, or it is not a development build.${otherPages(state, page)}${freshness(page, now)}`;
  }
  const { snapshot } = page;
  if (args.selector) {
    const outlet = findOutlet(page.outlets, args.selector);
    const links = (page.links ?? []).filter(
      (link) =>
        link.text.toLowerCase().includes(args.selector!.toLowerCase()) ||
        link.href === args.selector,
    );
    const lines: string[] = [];
    if (outlet) {
      lines.push(`${code(args.selector)} is routed:`);
      outletLines([outlet], 0, lines);
    }
    for (const link of links.slice(0, 5)) {
      lines.push(
        `- link ${code(link.text)} → ${code(link.href ?? '?')}: router says ${link.active ? 'active' : 'inactive'}${link.linkActive !== undefined ? `, RouterLinkActive says ${link.linkActive ? 'active' : 'inactive'}${link.exact ? ' (exact)' : ''}` : ''}`,
      );
    }
    return capped(
      `${UNTRUSTED}\n\n${lines.length ? lines.join('\n') : `No routed component or link matches ${code(args.selector)}.`}${freshness(page, now)}`,
    );
  }
  const lines = [`**URL** ${code(snapshot.url)}`];
  if (snapshot.urlDrift && snapshot.browserUrl) {
    lines.push(
      `**Browser URL differs** ${code(snapshot.browserUrl)} (skipLocationChange, browserUrl, a failed navigation or code that changed history directly)`,
    );
  }
  if (Object.keys(snapshot.queryParams).length) {
    lines.push(`**Query params** ${json(snapshot.queryParams)}`);
  }
  if (snapshot.fragment) lines.push(`**Fragment** ${code(snapshot.fragment)}`);
  if (snapshot.title) lines.push(`**Document title** ${code(snapshot.title)}`);
  if (snapshot.pending) {
    lines.push(`**In flight** #${snapshot.pending.id} to ${code(snapshot.pending.url)}`);
  }
  lines.push('', '**Active routes**');
  routeLines(snapshot.root, 0, lines);
  if (page.outlets?.length) {
    lines.push('', '**Outlets**');
    outletLines(page.outlets, 0, lines);
  }
  return capped(
    `${UNTRUSTED}\n\n${lines.join('\n')}${otherPages(state, page)}${freshness(page, now)}`,
  );
}

export function guardResult(nav: NavigationRecord): string {
  const passed = nav.guards?.passed;
  if (passed === true) return 'passed';
  if (passed === false) return nav.outcome === 'redirected' ? 'redirected' : 'blocked';
  return nav.outcome === 'pending' ? 'still running' : `did not finish, navigation ${nav.outcome}`;
}

export function decisiveRun(nav: NavigationRecord): string | undefined {
  const run = nav.runs?.find(
    (r) =>
      r.kind !== 'resolve' &&
      (r.result === 'false' || /^(UrlTree|RedirectCommand|threw)/.test(r.result)),
  );
  if (run) return `${run.guard} (${run.kind} on ${run.route}) returned ${run.result}`;
  const failedResolver = nav.runs?.find(
    (r) => r.kind === 'resolve' && /^(threw|RedirectCommand)/.test(r.result),
  );
  if (failedResolver)
    return `resolver ${failedResolver.guard} on ${failedResolver.route} ${failedResolver.result}`;
  return undefined;
}

export function plainReason(nav: NavigationRecord, setup?: RouterSetup): string | undefined {
  const option = (name: string) => setup?.options.find((o) => o.name === name);
  switch (nav.code) {
    case 'IgnoredSameUrlNavigation': {
      const same = option('onSameUrlNavigation');
      return `The URL did not change and onSameUrlNavigation is ${code(same?.value ?? 'ignore')}${same?.set ? '' : ' (the default)'}; set it to 'reload' (globally or per navigation) to re-run guards and resolvers.`;
    }
    case 'IgnoredByUrlHandlingStrategy':
      return `The UrlHandlingStrategy (${code(setup?.strategies['urlHandlingStrategy'] ?? '?')}) said neither URL should be processed.`;
    case 'SupersededByNewNavigation':
      return 'A newer navigation started before this one finished.';
    case 'GuardRejected':
      return 'A guard returned false.';
    case 'NoDataFromResolver':
      return 'A resolver completed without emitting a value, which cancels the navigation.';
    case 'Aborted':
      return 'The navigation was aborted (abort() on the current navigation or the Navigation API).';
    case 'Redirect':
      return `${nav.redirectKind === 'error handler' ? 'The navigation error handler' : `A ${nav.redirectKind ?? 'guard or resolver'}`} redirected${nav.redirectTo ? ` to ${code(nav.redirectTo)}` : ''}.`;
    default:
      return undefined;
  }
}

export function loopsOf(page: RouterPage): NavigationLoop[] {
  return page.loops ?? detectLoops(page.navigations, page.config);
}

export function loopsText(loops: NavigationLoop[]): string {
  return loops.length
    ? `**Loops** (a URL visited twice in one chain of redirects or code-started navigations)\n${loops.map(describeLoop).join('\n')}\n\n`
    : '';
}

export function describeNavigation(nav: NavigationRecord, page?: RouterPage): string {
  const took =
    nav.beforeConnect && nav.endedAt === undefined && nav.outcome !== 'pending'
      ? ' (before Pangular Inspector connected, no details)'
      : nav.beforeConnect
        ? ' (started before Pangular Inspector connected)'
        : nav.endedAt === undefined
          ? ''
          : ` in ${nav.endedAt - nav.startedAt}ms`;
  const target =
    nav.finalUrl && nav.finalUrl !== nav.url ? ` (redirected to ${code(nav.finalUrl)})` : '';
  const lines = [
    `- #${nav.id} ${code(nav.url)}${target}: **${nav.outcome}**${took}, trigger ${code(nav.trigger)}${nav.probe ? ' (Pangular Inspector probe)' : ''}`,
  ];
  if (nav.from) lines.push(`  - from ${code(nav.from)}`);
  if (nav.caller) lines.push(`  - started by ${code(nav.caller)}`);
  if (nav.extras?.length) lines.push(`  - extras: ${list(nav.extras)}`);
  if (nav.earlier) {
    lines.push(
      `  - ${nav.earlier} earlier navigation(s) happened before Pangular Inspector connected`,
    );
  }
  if (nav.redirectedFrom !== undefined) {
    lines.push(`  - redirect from #${nav.redirectedFrom}`);
  }
  if (nav.redirectTo) {
    lines.push(`  - ${nav.redirectKind ?? 'router'} redirect to ${code(nav.redirectTo)}`);
  }
  const loop = page && loopsOf(page).find((l) => l.ids.includes(nav.id));
  if (loop) {
    const hops = loop.hops.filter((hop) => hop.id === nav.id).map(hopText);
    lines.push(
      `  - **${loopTitle(loop)}** ${loopChain(loop)}${hops.length ? `; here: ${hops.join('; ')}` : ''}`,
    );
  }
  if (nav.guards && (nav.guards.names.length || nav.guards.passed === false)) {
    const names = nav.guards.names.length ? list(nav.guards.names) : 'none on the route';
    const result = guardResult(nav);
    const ms = nav.guards.ms === undefined ? '' : ` (${nav.guards.ms}ms)`;
    lines.push(`  - guards: ${names}: ${result}${ms}`);
  }
  if (nav.checked && (nav.checked.activate.length || nav.checked.deactivate.length)) {
    const parts = [];
    if (nav.checked.deactivate.length) parts.push(`leaving ${list(nav.checked.deactivate)}`);
    if (nav.checked.activate.length) parts.push(`entering ${list(nav.checked.activate)}`);
    lines.push(`  - routes the router checked: ${parts.join('; ')}`);
  }
  if (nav.resolvers?.names.length) {
    const ms =
      nav.resolvers.ms !== undefined
        ? ` (${nav.resolvers.ms}ms)`
        : nav.outcome === 'pending'
          ? ' (still running)'
          : ` (did not finish, navigation ${nav.outcome})`;
    lines.push(`  - resolvers: ${list(nav.resolvers.names)}${ms}`);
  }
  if (nav.runs?.length) {
    lines.push(
      `  - runs: ${nav.runs.map((r) => `${code(r.guard)} ${r.kind} ${r.result} ${r.ms}ms`).join('; ')}`,
    );
  }
  const decisive = decisiveRun(nav);
  if (decisive) lines.push(`  - decided by ${code(decisive)}`);
  if (nav.phases) {
    lines.push(
      `  - phases: ${Object.entries(nav.phases)
        .map(([name, ms]) => `${name} ${ms}ms`)
        .join(', ')}`,
    );
  }
  if (nav.lazyLoaded?.length) lines.push(`  - lazy loaded: ${list(nav.lazyLoaded)}`);
  if (nav.reused?.length) lines.push(`  - reused (component kept): ${list(nav.reused)}`);
  if (nav.requests) {
    lines.push(`  - ${nav.requests.count} HTTP request(s) during it: ${list(nav.requests.urls)}`);
  }
  if (nav.scroll) lines.push(`  - scroll: ${nav.scroll}`);
  if (nav.title) lines.push(`  - document title after: ${code(nav.title)}`);
  if (nav.warnings?.length) lines.push(`  - router warnings: ${list(nav.warnings)}`);
  if (nav.code || nav.reason) {
    const why = [nav.code, nav.reason].filter(Boolean).join(': ');
    lines.push(`  - reason: ${code(why)}`);
  }
  const plain = plainReason(nav, page?.setup);
  if (plain) lines.push(`  - meaning: ${plain}`);
  if (nav.errorCode) {
    const meaning = ERROR_CATALOG[nav.errorCode];
    lines.push(`  - error ${code(nav.errorCode)}${meaning ? `: ${meaning}` : ''}`);
  }
  if (nav.errorHandler) lines.push(`  - ${nav.errorHandler}`);
  if (
    nav.generation !== undefined &&
    page?.generation !== undefined &&
    nav.generation !== page.generation
  ) {
    lines.push(
      `  - route config changed since (generation ${nav.generation} → ${page.generation})`,
    );
  }
  return lines.join('\n');
}

function perfSummary(navigations: NavigationRecord[], preloads: PreloadRecord[] = []): string {
  const done = navigations.filter((n) => n.phases?.['total'] !== undefined);
  if (!done.length) return 'No timed navigations yet.';
  const slowest = [...done]
    .sort((a, b) => (b.phases!['total'] ?? 0) - (a.phases!['total'] ?? 0))
    .slice(0, 5);
  const lines = slowest.map((nav) => {
    const phases = Object.entries(nav.phases ?? {})
      .filter(([name]) => name !== 'total')
      .sort((a, b) => b[1] - a[1]);
    const top = phases[0];
    return `- #${nav.id} ${code(nav.url)} ${nav.phases!['total']}ms${top ? `, mostly ${top[0]} (${top[1]}ms)` : ''}${nav.lazyLoaded?.length ? `, lazy loaded ${list(nav.lazyLoaded)}` : ''}${nav.requests ? `, ${nav.requests.count} request(s)` : ''}`;
  });
  const slowPreloads = preloads
    .filter((p) => (p.ms ?? 0) > 0)
    .sort((a, b) => (b.ms ?? 0) - (a.ms ?? 0))
    .slice(0, 3);
  if (slowPreloads.length) {
    lines.push(
      `- slowest preloads: ${slowPreloads.map((p) => `${code(p.path)} ${p.ms}ms${p.failed ? ' (failed)' : ''}`).join(', ')}`,
    );
  }
  return `Slowest navigations:\n${lines.join('\n')}`;
}

export function explainNavigationText(
  state: RouterState,
  args: { page?: string; url?: string; limit?: number; perf?: boolean; id?: number },
  now = Date.now(),
): string {
  const page = pickPage(state, args.page);
  if (!page) return noPage(args.page, state);
  if (args.perf) {
    return capped(
      `${UNTRUSTED}\n\n${perfSummary(page.navigations, page.preloads)}${otherPages(state, page)}${freshness(page, now)}`,
    );
  }
  const requested = Number.isFinite(args.limit) ? Math.floor(args.limit as number) : 5;
  const limit = Math.max(1, Math.min(requested, MAX_NAVIGATIONS));
  const needle = args.url?.toLowerCase();
  const matching = page.navigations.filter(
    (nav) =>
      (args.id === undefined || nav.id === args.id) &&
      (!needle ||
        nav.url.toLowerCase().includes(needle) ||
        !!nav.finalUrl?.toLowerCase().includes(needle)),
  );
  if (!matching.length) {
    return needle || args.id !== undefined
      ? `No recent navigation matches ${code(args.url ?? `#${args.id}`)}.${otherPages(state, page)}${freshness(page, now)}`
      : `No navigations recorded since Pangular Inspector connected on page ${code(page.pageId)}; earlier ones are not visible.${otherPages(state, page)}${freshness(page, now)}`;
  }
  const recent = matching.slice(-limit).reverse();
  const loops = loopsOf(page).filter((loop) => recent.some((nav) => loop.ids.includes(nav.id)));
  const header = `Most recent ${recent.length} of ${matching.length} navigation(s), newest first. Guards lists the candidates: canDeactivate guards of the page being left (marked "leaving") and canActivate/canActivateChild guards of the target; without per-guard instrumentation the router reports one result for all of them. Turn instrumentation on (navigate tool, action "instrument") to see each guard's verdict.${page.instrumented ? ' Instrumentation is on.' : ''}`;
  return capped(
    `${UNTRUSTED}\n\n${header}\n\n${loopsText(loops)}${recent.map((nav) => describeNavigation(nav, page)).join('\n')}${droppedNote(page.dropped, 'navigations', 'navigations')}${otherPages(state, page)}${freshness(page, now)}`,
  );
}

function slim(nav: NavigationRecord) {
  const clipUrl = (url?: string) => (url && url.length > 300 ? `${url.slice(0, 300)}…` : url);
  return {
    id: nav.id,
    url: clipUrl(nav.url),
    finalUrl: clipUrl(nav.finalUrl),
    outcome: nav.outcome,
    code: nav.code,
    startedAt: nav.startedAt,
    endedAt: nav.endedAt,
  };
}

export function routerResourceText(state: RouterState): string {
  const json = JSON.stringify(state);
  if (json.length <= MAX_RESOURCE_CHARS) return json;
  const out = {
    truncated: true,
    note: 'The router state is too large for this resource. Use inspect-route, explain-navigation and list-routes instead.',
    pages: [] as {
      pageId: string;
      url: string | null;
      reportedAt: number;
      navigations: ReturnType<typeof slim>[];
    }[],
  };
  let size = JSON.stringify(out).length;
  for (const page of state.pages) {
    const url = page.snapshot?.url ?? null;
    const entry = {
      pageId: page.pageId,
      url: url && url.length > 300 ? `${url.slice(0, 300)}…` : url,
      reportedAt: page.reportedAt,
      navigations: [] as ReturnType<typeof slim>[],
    };
    size += JSON.stringify(entry).length + 1;
    if (size > MAX_RESOURCE_CHARS) break;
    out.pages.push(entry);
    for (const nav of page.navigations.slice(-10).reverse()) {
      const item = slim(nav);
      size += JSON.stringify(item).length + 1;
      if (size > MAX_RESOURCE_CHARS) return JSON.stringify(out);
      entry.navigations.push(item);
    }
  }
  return JSON.stringify(out);
}
