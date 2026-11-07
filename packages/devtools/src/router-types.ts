/**
 * The router report shapes: what the page pushes (`router.ts` and the
 * `router-*` collectors), what the server keeps and serves to the panel
 * (`rpc/router-tools.ts`), and what the router RPCs return. Types only, so
 * the panel can share them through `./internal/types` (`panel-types.ts`)
 * without pulling package code into its bundle.
 */
import type { HttpCall } from './http-rules.ts';

export interface RouteGuards {
  canActivate?: string[];
  canActivateChild?: string[];
  canDeactivate?: string[];
  canMatch?: string[];
  canLoad?: string[];
}

export interface ActiveRoute {
  path: string;
  url: string;
  outlet: string;
  component?: string;
  title?: string;
  ownTitle?: boolean;
  params: Record<string, unknown>;
  data: Record<string, unknown>;
  paramSources?: Record<string, 'own' | 'inherited'>;
  dataSources?: Record<string, 'static' | 'resolved' | 'inherited'>;
  guards?: RouteGuards;
  resolvers?: string[];
  lazy?: boolean;
  children: ActiveRoute[];
}

export interface RouterSnapshot {
  url: string;
  queryParams: Record<string, unknown>;
  fragment: string | null;
  root: ActiveRoute;
  browserUrl?: string;
  urlDrift?: boolean;
  title?: string;
  pending?: { id: number; url: string };
}

export type NavigationOutcome =
  'pending' | 'succeeded' | 'redirected' | 'cancelled' | 'failed' | 'skipped';

export interface GuardRun {
  guard: string;
  kind: string;
  route: string;
  result: string;
  ms: number;
}

export interface NavigationRecord {
  id: number;
  url: string;
  trigger: string;
  startedAt: number;
  endedAt?: number;
  outcome: NavigationOutcome;
  finalUrl?: string;
  from?: string;
  extras?: string[];
  caller?: string;
  phases?: Record<string, number>;
  redirectedFrom?: number;
  redirectTo?: string;
  redirectKind?: string;
  guards?: { names: string[]; passed?: boolean; ms?: number };
  resolvers?: { names: string[]; ms?: number };
  checked?: { activate: string[]; deactivate: string[] };
  runs?: GuardRun[];
  lazyLoaded?: string[];
  reused?: string[];
  requests?: { count: number; urls: string[] };
  warnings?: string[];
  errorCode?: string;
  errorHandler?: string;
  scroll?: string;
  title?: string;
  generation?: number;
  reason?: string;
  code?: string;
  beforeConnect?: boolean;
  earlier?: number;
  probe?: boolean;
  /** The routes it activated, for comparing two navigations (`router-diff.ts`). */
  routes?: MatchedRoute[];
  /** Its target came from a query param: a possible open redirect (`router-open-redirect.ts`). */
  queryRedirect?: QueryRedirect;
  /** The browser Navigation API event it came with (`router-platform-nav.ts`). */
  platform?: { type: string; userInitiated?: boolean };
}

/**
 * One route a navigation activated, kept on its record so two navigations
 * can be compared later. Params and data are redacted, and each value is
 * short JSON text, so the record stays small and comparable as strings.
 */
export interface MatchedRoute {
  /** Full path of the route config, such as `/users/:id`. */
  path: string;
  /** Left out for the primary outlet. */
  outlet?: string;
  component?: string;
  params?: Record<string, string>;
  data?: Record<string, string>;
}

/**
 * A navigation whose target came from a query param of the URL it was
 * started from or redirected away from, such as a guard that sends
 * `/login?returnUrl=/admin` to `/admin`. A target an attacker can choose is
 * an open redirect risk once the app passes it on without an allow list.
 */
export interface QueryRedirect {
  /** The query param the target was read from. */
  param: string;
  /** Who navigated: the guard or resolver, the error handler, or the calling code. */
  by: string;
}

/**
 * One `navigate` event of the browser's Navigation API (`window.navigation`):
 * a link, a form, back and forward, `history.pushState`, or the router's own
 * history update. Kept next to the router's navigations so history changes
 * the router did not make (the cause of `urlDrift`) show up.
 */
export interface PlatformNavigation {
  at: number;
  /** `push`, `replace`, `reload` or `traverse`. */
  type: string;
  /** The destination as a path, with the origin left out and secrets masked. */
  url: string;
  userInitiated?: boolean;
  hashChange?: boolean;
  /** The router navigation it belongs to; left out when the router was not navigating. */
  navigationId?: number;
  result?: 'succeeded' | 'failed';
  error?: string;
}

export interface OutletInfo {
  outlet: string;
  route?: string;
  component?: string;
  element?: string;
  devtoolsId?: string;
  activated: boolean;
  detached?: boolean;
  inputs?: { input: string; source: string }[];
  data?: string;
  children?: OutletInfo[];
}

export interface LinkInfo {
  text: string;
  href?: string;
  active?: boolean;
  linkActive?: boolean;
  activeClasses?: string[];
  exact?: boolean;
  ariaCurrent?: string;
  element?: string;
  devtoolsId?: string;
}

export interface RouteNode {
  id: string;
  path: string;
  fullPath: string;
  kind: 'component' | 'redirect' | 'children' | 'lazy' | 'componentless';
  component?: string;
  redirectTo?: string;
  pathMatch?: string;
  outlet?: string;
  lazy?: 'unloaded' | 'loaded';
  matcher?: string;
  guards?: RouteGuards;
  resolvers?: string[];
  title?: string;
  dataKeys?: string[];
  providers?: number;
  runGuardsAndResolvers?: string;
  inputs?: string[];
  classGuards?: string[];
  children?: RouteNode[];
}

export interface RouterOption {
  name: string;
  value: string;
  set: boolean;
}

export interface RouterSetup {
  mode: 'full' | 'events-only';
  setupKind: 'provideRouter' | 'forRoot or other' | 'unknown';
  routers: number;
  angularVersion?: string;
  options: RouterOption[];
  features: Record<string, string>;
  strategies: Record<string, string>;
  baseHref?: string;
  hydrated?: number;
}

export interface PreloadRecord {
  path: string;
  startedAt: number;
  ms?: number;
  failed?: boolean;
}

export interface LoopHop {
  id: number;
  from: string;
  to: string;
  via: string;
  by?: string;
}

export interface NavigationLoop {
  kind: 'redirect' | 'burst' | 'config';
  ids: number[];
  cycle: string[];
  hops: LoopHop[];
  guards: string[];
  bounces: number;
  end: string;
}

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
  /** Links past the first 100 that the page found but did not list. */
  linksTruncated?: number;
  /**
   * Elements that could hold a link but were past the page's check limit, so
   * `linksTruncated` is a lower bound.
   */
  linksUnchecked?: number;
  preloads?: PreloadRecord[];
  instrumented?: boolean;
  /** The browser Navigation API's `navigate` events, newest last. */
  platformNavigations?: PlatformNavigation[];
  /**
   * Every Angular app on the page with a Router, when there is more than one
   * (`router-apps.ts`). The rest of the report describes the `primary` one.
   */
  apps?: RouterAppReport[];
}

export interface RouterPage extends RouterReport {
  reportedAt: number;
  changedAt: number;
  loops?: NavigationLoop[];
  /** Set on the view of one app of a page that runs several (`rpc/router-apps.ts`). */
  appId?: string;
}

export interface RouterState {
  pages: RouterPage[];
}

export interface LintFinding {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  route: string;
  message: string;
  fix: string;
  angular: 'throws' | 'warns' | 'silent';
}

export type RouterLintResult =
  | { checked: true; findings: LintFinding[] }
  | { checked: false; reason: 'no-page' | 'events-only' | 'no-config' };

/** One field that differs between two navigations. A missing side did not have it. */
export interface DiffChange {
  field: string;
  before?: string;
  after?: string;
}

export interface DiffSection {
  title: string;
  changes: DiffChange[];
}

export interface NavigationDiff {
  a: number;
  b: number;
  /** Sections with at least one change, in a fixed order. */
  sections: DiffSection[];
  /** Titles of the sections that are the same in both. */
  same: string[];
  /** What could not be compared, such as a navigation with no route data. */
  notes: string[];
}

export type NavigationDiffResult = NavigationDiff | { error: string };

/**
 * The HttpClient calls of one navigation, joined from the HTTP inspector's
 * report of the same page: the ones that started while it ran (guards,
 * resolvers, lazy loads) and the ones that started after it ended, before
 * the next navigation or `AFTER_MS` in `rpc/router-http.ts` (the components it
 * rendered).
 */
export interface NavigationCalls {
  during: HttpCall[];
  after: HttpCall[];
}

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

/**
 * A route the source scan found in a `*.routes.ts` or routing module file, or
 * in an Analog `pages` folder (`get-routes` RPC). Read from source, so it is
 * there before any page connects.
 */
export interface ScannedRoute {
  path: string;
  fullPath: string;
  kind: 'page' | 'group' | 'redirect' | 'wildcard';
  component?: string;
  redirectTo?: string;
  title?: string;
  guards?: Record<string, string[]>;
  resolvers?: string[];
  hasChildren: boolean;
  file: string;
  line?: number;
}

/**
 * One Angular app on the page with its own Router, as the router report
 * lists it when a page bootstraps more than one (several
 * `bootstrapApplication` roots or micro-frontends). The first app, the one
 * the rest of the report describes, has only its id and name; every other
 * app carries its own route, navigations and config.
 */
export interface RouterAppReport {
  /** Stable for the life of its root element: its tag, with `-2`, `-3` ... for repeats. */
  id: string;
  /** The root component's class name, else the tag. */
  name: string;
  /** The root element's tag, such as `app-root`. */
  selector: string;
  /** The app the top level of the router report describes. */
  primary?: true;
  snapshot?: RouterSnapshot | null;
  navigations?: NavigationRecord[];
  dropped?: number;
  generation?: number;
  config?: RouteNode[];
  configTruncated?: number;
  activeIds?: string[];
  setup?: RouterSetup;
  /** Navigation loops in this app's history; the server adds them, the page never sends them. */
  loops?: NavigationLoop[];
}
