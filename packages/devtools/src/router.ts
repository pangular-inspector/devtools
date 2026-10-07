import { REDACTED, isSensitive, serializeFormValue } from './forms.ts';
import { clip } from './text.ts';

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
}

export interface RouterDebugApi {
  getInjector?(el: Element): unknown;
  getComponent?(el: Element): unknown;
  getDirectives?(el: Element): unknown[];
  ɵgetRouterInstance?(injector: unknown): unknown;
  ɵgetInjectorProviders?(injector: unknown): { token: unknown }[];
  ɵgetInjectorResolutionPath?(injector: unknown): unknown[];
}

export type AnyRecord = Record<string, any>;

export const MAX_DEPTH = 12;
const MAX_REASON = 300;
const MAX_URL = 2000;
const URL_SECRET_KEY =
  /^(code|key|sig|signature|session|session_?id|sid|auth|authorization|jwt|credentials?|x-amz-(signature|credential|security-token)|x-goog-(signature|credential))$/i;
const GUARD_KINDS = [
  'canActivate',
  'canActivateChild',
  'canDeactivate',
  'canMatch',
  'canLoad',
] as const;
const CANCEL_CODES = [
  'Redirect',
  'SupersededByNewNavigation',
  'NoDataFromResolver',
  'GuardRejected',
  'Aborted',
];
const SKIP_CODES = ['IgnoredSameUrlNavigation', 'IgnoredByUrlHandlingStrategy'];
const JWT = /eyJ[\w-]{4,}\.[\w-]{4,}\.[\w-]{4,}/g;
const BEARER = /Bearer\s+[\w.~+/-]+=*/gi;
const LONG_TOKEN = /(?<=[/=])[A-Za-z0-9_-]{32,}(?=[/?#&;]|$)/g;

function isOpaqueToken(token: string): boolean {
  if (UUID_OR_ULID.test(token)) return false;
  if (/^[0-9a-f]{32,}$/i.test(token)) return true;
  return (
    /\d/.test(token) &&
    /[a-z]/.test(token) &&
    /[A-Z]/.test(token) &&
    (token.match(/-/g) ?? []).length <= 2
  );
}
const UUID_OR_ULID =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9A-HJKMNP-TV-Z]{26})$/i;

export const EventType = {
  NavigationStart: 0,
  NavigationEnd: 1,
  NavigationCancel: 2,
  NavigationError: 3,
  RoutesRecognized: 4,
  ResolveStart: 5,
  ResolveEnd: 6,
  GuardsCheckStart: 7,
  GuardsCheckEnd: 8,
  RouteConfigLoadStart: 9,
  RouteConfigLoadEnd: 10,
  ChildActivationStart: 11,
  ActivationStart: 13,
  Scroll: 15,
  NavigationSkipped: 16,
} as const;

interface NavState {
  secrets: string[];
  guardsAt?: number;
  resolveAt?: number;
  recognizedAt?: number;
  activateAt?: number;
  startedPerf: number;
  checkedResolvers: string[];
  lazyConfigs: object[];
  handled?: { reason: string; redirected: boolean };
}

const navState = new WeakMap<NavigationRecord, NavState>();
const knownSecrets = new Set<string>();
const seenRoutes = new WeakSet<object>();

let pendingCaller: { text: string; at: number; sticky?: boolean } | null = null;
let pendingRedirect: { from: number; kind: string } | null = null;
let configGeneration = 0;
let navigationLimit = 50;

export function setCaller(text: string, sticky = false) {
  if (!sticky && pendingCaller?.sticky && Date.now() - pendingCaller.at < 50) return;
  pendingCaller = { text: clip(redactText(text, knownSecrets), 200), at: Date.now(), sticky };
}

export function setGeneration(generation: number) {
  configGeneration = generation;
}

/** How many navigations a page keeps (`limits.navigations`). */
export function setNavigationLimit(limit: number) {
  navigationLimit = limit;
}

export function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export { clip };

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function nameOf(value: unknown): string {
  if (typeof value === 'function') return value.name || 'anonymous function';
  if (value && typeof value === 'object') {
    const ctor = read(() => (value as AnyRecord)['constructor'] as { name?: string }, undefined);
    if (ctor?.name && ctor.name !== 'Object') return ctor.name;
  }
  return String(value);
}

export function isSecretKey(key: string): boolean {
  return isSensitive(key) || URL_SECRET_KEY.test(key);
}

function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

const TEXT_PAIR = /(^|[?&#;])([^=&#;?\s"'/]+)=([^&#;\s"']*)/g;
const URL_PAIR = /(^|[?&#;])([^=&#;?\s/]+)=([^&#;\s]*)/g;

function segmentForm(secret: string): string {
  return encodeURIComponent(secret)
    .replace(/%40/g, '@')
    .replace(/%3A/gi, ':')
    .replace(/%24/g, '$')
    .replace(/%2C/gi, ',')
    .replace(/%26/gi, '&')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

/**
 * Hides the values of secret-looking query, matrix and fragment keys
 * (`?token=…`, `;api_key=…`, `#access_token=…`), JWTs and bearer tokens, and
 * any of the given secret route param values, wherever they appear in a URL or
 * a message. In `url` mode a value runs to the next separator and long opaque
 * tokens (not UUIDs or ULIDs) are hidden too; in messages it also stops at quotes.
 */
export function redactText(
  text: string,
  secrets: Iterable<string> = [],
  mode: 'url' | 'text' = 'text',
  depth = 0,
): string {
  let out = text.replace(
    mode === 'url' ? URL_PAIR : TEXT_PAIR,
    (match, sep: string, key: string, value: string) => {
      if (isSecretKey(decode(key))) return `${sep}${key}=${REDACTED}`;
      const decoded = decode(value);
      if (depth > 1 || decoded === value || !decoded.includes('=')) return match;
      const inner = redactText(decoded, secrets, mode, depth + 1);
      return inner === decoded ? match : `${sep}${key}=${encodeURIComponent(inner)}`;
    },
  );
  out = out.replace(JWT, REDACTED).replace(BEARER, `Bearer ${REDACTED}`);
  if (mode === 'url') {
    out = out.replace(LONG_TOKEN, (token) => (isOpaqueToken(token) ? REDACTED : token));
  }
  for (const secret of secrets) {
    if (secret.length < 3) continue;
    for (const form of new Set([secret, encodeURIComponent(secret), segmentForm(secret)])) {
      out = out.split(form).join(REDACTED);
    }
  }
  return out;
}

function remember(secret: string) {
  knownSecrets.delete(secret);
  knownSecrets.add(secret);
  if (knownSecrets.size > 100) knownSecrets.delete(knownSecrets.values().next().value!);
}

export function secretParamsOf(root: AnyRecord | null): string[] {
  const secrets = chainOf(root).flatMap((route) =>
    Object.entries(read(() => route['params'] as Record<string, unknown>, {}))
      .filter(([key, value]) => isSecretKey(key) && typeof value === 'string')
      .map(([, value]) => value as string),
  );
  for (const secret of secrets) remember(secret);
  return secrets;
}

export function redactUrl(url: string, secrets: string[] = []): string {
  return clip(redactText(url, [...secrets, ...knownSecrets], 'url'), MAX_URL);
}

export function redactMessage(text: string, secrets: string[] = []): string {
  return clip(redactText(text, [...secrets, ...knownSecrets]), MAX_REASON);
}

function redactValue(value: unknown, secrets: string[]): unknown {
  if (typeof value === 'string') return redactText(value, secrets);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, secrets));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      isSecretKey(key) ? REDACTED : redactValue(item, secrets),
    ]),
  );
}

export function redactRecord(value: unknown, secrets: string[] = []): Record<string, unknown> {
  return redactValue(asRecord(value), [...secrets, ...knownSecrets]) as Record<string, unknown>;
}

export function componentName(type: unknown): string {
  const className = read(
    () => (type as AnyRecord)['ɵcmp']?.['debugInfo']?.['className'] as string | undefined,
    undefined,
  );
  return className || nameOf(type).replace(/^_+(?=\w)/, '');
}

function asRecord(value: unknown): Record<string, unknown> {
  const out = serializeFormValue(value);
  return out && typeof out === 'object' && !Array.isArray(out)
    ? (out as Record<string, unknown>)
    : {};
}

function isRouter(value: unknown): value is AnyRecord {
  const v = value as AnyRecord | null;
  return (
    !!v &&
    typeof v === 'object' &&
    typeof read(() => v['navigateByUrl'], undefined) === 'function' &&
    !!read(() => v['events'], undefined) &&
    !!read(() => v['routerState'], undefined)
  );
}

export function providerOf(
  ng: RouterDebugApi,
  injector: unknown,
  className: string,
  accept: (value: unknown) => boolean,
): AnyRecord | null {
  const path = read(() => ng.ɵgetInjectorResolutionPath?.(injector) ?? [injector], [injector]);
  for (const candidate of path) {
    const providers = read(() => ng.ɵgetInjectorProviders?.(candidate) ?? [], []);
    for (const { token } of providers) {
      if (nameOf(token).replace(/^_+/, '') !== className) continue;
      const value = read(() => (injector as AnyRecord)['get'](token, null), null);
      if (accept(value)) return value as AnyRecord;
    }
  }
  return null;
}

function routerOf(ng: RouterDebugApi, injector: unknown): AnyRecord | null {
  const viaUtil = read(() => ng.ɵgetRouterInstance?.(injector), undefined);
  if (isRouter(viaUtil)) return viaUtil;
  return providerOf(ng, injector, 'Router', isRouter);
}

function inUse(router: AnyRecord): boolean {
  return read(
    () => (router['config'] as unknown[]).length > 0 || router['navigated'] === true,
    false,
  );
}

/**
 * Every Router reachable from the given roots, routers that have routes or
 * have navigated first.
 */
export function findRouters(ng: RouterDebugApi, roots: Iterable<Element>): AnyRecord[] {
  const candidates: AnyRecord[] = [];
  for (const el of roots) {
    const injector = read(() => ng.getInjector?.(el), undefined);
    const router = injector ? routerOf(ng, injector) : null;
    if (router && !candidates.includes(router)) candidates.push(router);
  }
  return [...candidates.filter(inUse), ...candidates.filter((r) => !inUse(r))];
}

/**
 * The app's Router, through the debug util `provideRouter()` publishes on
 * `ng`, or through the root injector's providers for apps that use
 * `RouterModule.forRoot()`. With several roots, a router that has routes or
 * has navigated wins over an empty one a router-less root created.
 */
export function findRouter(ng: RouterDebugApi, roots: Iterable<Element>): AnyRecord | null {
  return findRouters(ng, roots)[0] ?? null;
}

export function guardsOf(config: AnyRecord | null): RouteGuards | undefined {
  if (!config) return undefined;
  const out: RouteGuards = {};
  for (const kind of GUARD_KINDS) {
    const list = read(() => config[kind] as unknown[] | undefined, undefined);
    if (Array.isArray(list) && list.length) out[kind] = list.map(nameOf);
  }
  return Object.keys(out).length ? out : undefined;
}

export function resolveKeys(resolve: unknown): (string | symbol)[] {
  if (!resolve || typeof resolve !== 'object') return [];
  return read(() => Reflect.ownKeys(resolve), []);
}

export function keyName(key: string | symbol): string {
  return typeof key === 'symbol' ? 'title' : key;
}

export function resolversOf(config: AnyRecord | null): string[] | undefined {
  const resolve = read(() => config?.['resolve'] as AnyRecord | undefined, undefined);
  const keys = resolveKeys(resolve).map(
    (key) => `${keyName(key)}: ${nameOf((resolve as AnyRecord)[key as string])}`,
  );
  return keys.length ? keys : undefined;
}

function pathParams(config: AnyRecord | null): Set<string> {
  const path = read(() => String(config?.['path'] ?? ''), '');
  return new Set(
    path
      .split('/')
      .filter((part) => part.startsWith(':'))
      .map((part) => part.slice(1)),
  );
}

export function serializeRoute(route: AnyRecord, depth = 0): ActiveRoute {
  const config = read(() => route['routeConfig'] as AnyRecord | null, null);
  const component = read(() => route['component'] ?? config?.['component'], undefined);
  const title = read(() => route['title'] as unknown, undefined);
  const segments = read(() => route['url'] as { path: string }[], []);
  const children = depth >= MAX_DEPTH ? [] : read(() => route['children'] as AnyRecord[], []);
  const secrets = secretParamsOf(route);
  const out: ActiveRoute = {
    path: read(() => (config?.['path'] as string | undefined) ?? '', ''),
    url: redactUrl(segments.map((s) => s.path).join('/'), secrets),
    outlet: read(() => route['outlet'] as string, 'primary'),
    params: redactRecord(
      read(() => route['params'], {}),
      secrets,
    ),
    data: redactRecord(
      read(() => route['data'], {}),
      secrets,
    ),
    children: children.map((child) => serializeRoute(child, depth + 1)),
  };
  if (component) out.component = componentName(component);
  if (typeof title === 'string') {
    out.title = clip(redactText(title, [...secrets, ...knownSecrets]), MAX_REASON);
    out.ownTitle = read(() => config?.['title'] !== undefined, false);
  }
  const own = pathParams(config);
  const paramKeys = Object.keys(out.params);
  if (paramKeys.length) {
    out.paramSources = Object.fromEntries(
      paramKeys.map((key) => [key, own.has(key) ? 'own' : 'inherited']),
    );
  }
  const staticKeys = new Set(Object.keys(read(() => config?.['data'] ?? {}, {})));
  const resolvedKeys = new Set(
    resolveKeys(read(() => config?.['resolve'], undefined)).map(keyName),
  );
  const dataKeys = Object.keys(out.data);
  if (dataKeys.length) {
    out.dataSources = Object.fromEntries(
      dataKeys.map((key) => [
        key,
        resolvedKeys.has(key) ? 'resolved' : staticKeys.has(key) ? 'static' : 'inherited',
      ]),
    );
  }
  const guards = guardsOf(config);
  if (guards) out.guards = guards;
  const resolvers = resolversOf(config);
  if (resolvers) out.resolvers = resolvers;
  if (config && (config['loadChildren'] || config['loadComponent'])) out.lazy = true;
  return out;
}

function browserUrlOf(router: AnyRecord): string | undefined {
  if (typeof location === 'undefined') return undefined;
  const path = read(() => String(router['location']['path'](true)), '');
  return path ? path : undefined;
}

export function snapshotRouter(router: AnyRecord): RouterSnapshot | null {
  const root = read(() => router['routerState']['snapshot']['root'] as AnyRecord, null);
  if (!root) return null;
  const fragment = read(() => root['fragment'] as string | null, null);
  const secrets = secretParamsOf(root);
  const snapshot: RouterSnapshot = {
    url: redactUrl(
      read(() => String(router['url']), ''),
      secrets,
    ),
    queryParams: redactRecord(read(() => root['queryParams'], {})),
    fragment: typeof fragment === 'string' ? redactUrl(fragment) : null,
    root: serializeRoute(root),
  };
  const browser = browserUrlOf(router);
  if (browser !== undefined) {
    snapshot.browserUrl = redactUrl(browser, secrets);
    const routerUrl = read(() => String(router['url']), '');
    snapshot.urlDrift = normalize(browser) !== normalize(routerUrl);
  }
  if (typeof document !== 'undefined') snapshot.title = clip(document.title, MAX_REASON);
  const current = currentNavigationOf(router, Date.now());
  if (current) snapshot.pending = { id: current.id, url: current.url };
  return snapshot;
}

function normalize(url: string): string {
  const [path, rest = ''] = url.split(/(?=[?#])/);
  return `${path.replace(/\/+$/, '') || '/'}${rest}`;
}

export function chainOf(root: AnyRecord | null): AnyRecord[] {
  const out: AnyRecord[] = [];
  const visit = (route: AnyRecord, depth: number) => {
    out.push(route);
    if (depth >= MAX_DEPTH) return;
    for (const child of read(() => route['children'] as AnyRecord[], [])) visit(child, depth + 1);
  };
  if (root) visit(root, 0);
  return out;
}

export function configsOf(state: unknown): AnyRecord[] {
  const root = read(() => (state as AnyRecord)['root'] as AnyRecord, null);
  return chainOf(root)
    .map((route) => read(() => route['routeConfig'] as AnyRecord | null, null))
    .filter((config): config is AnyRecord => !!config);
}

function leavingGuardsOf(target: unknown, leaving: unknown): string[] {
  const staying = new Set(configsOf(target));
  const names = configsOf(leaving)
    .filter((config) => !staying.has(config))
    .flatMap((config) => (guardsOf(config)?.canDeactivate ?? []).map((n) => `${n} (leaving)`));
  return Array.from(new Set(names));
}

function checkedGuardsOf(snapshot: AnyRecord): string[] {
  const path = read(() => snapshot['pathFromRoot'] as AnyRecord[], [snapshot]);
  const config = read(() => snapshot['routeConfig'] as AnyRecord | null, null);
  const ancestors = path
    .slice(0, -1)
    .flatMap((route) => guardsOf(read(() => route['routeConfig'], null))?.canActivateChild ?? []);
  return [...ancestors, ...(guardsOf(config)?.canActivate ?? [])];
}

export function fullPathOf(snapshot: AnyRecord): string {
  const path = read(() => snapshot['pathFromRoot'] as AnyRecord[], [snapshot]);
  const parts = path
    .map((route) => read(() => String(route['routeConfig']?.['path'] ?? ''), ''))
    .filter(Boolean);
  return `/${parts.join('/')}`;
}

function configSecretsFor(router: AnyRecord | undefined, url: string): string[] {
  if (!router) return [];
  const segments = url
    .split(/[?#(]/)[0]
    .split('/')
    .filter(Boolean)
    .map((segment) => decode(segment.split(';')[0]));
  const out: string[] = [];
  const walk = (routes: AnyRecord[], at: number, depth: number) => {
    if (depth > MAX_DEPTH || !Array.isArray(routes)) return;
    for (const route of routes) {
      const parts = read(() => String(route['path'] ?? ''), '')
        .split('/')
        .filter(Boolean);
      if (at + parts.length > segments.length) continue;
      const found: string[] = [];
      const matches = parts.every((part, i) => {
        if (!part.startsWith(':')) return part === segments[at + i];
        if (isSecretKey(part.slice(1))) found.push(segments[at + i]);
        return true;
      });
      if (!matches) continue;
      out.push(...found);
      const children = [
        ...read(() => (route['children'] as AnyRecord[]) ?? [], []),
        ...read(() => (route['_loadedRoutes'] as AnyRecord[]) ?? [], []),
      ];
      walk(children, at + parts.length, depth + 1);
    }
  };
  walk(
    read(() => router['config'] as AnyRecord[], []),
    0,
    0,
  );
  const secrets = out.filter((secret) => secret.length >= 3);
  for (const secret of secrets) remember(secret);
  return secrets;
}

export function errorCodeOf(error: unknown): string | undefined {
  const code = read(() => (error as AnyRecord)?.['code'] as unknown, undefined);
  if (typeof code === 'number') return `NG0${Math.abs(code)}`;
  const message = read(() => String((error as AnyRecord)?.['message'] ?? error ?? ''), '');
  return message.match(/NG0\d{3,4}/)?.[0];
}

function errorText(error: unknown, secrets?: string[]): string {
  const text =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : nameOf(error);
  return redactMessage(text, secrets);
}

function stateOf(nav: NavigationRecord): NavState {
  let state = navState.get(nav);
  if (!state) {
    state = { secrets: [], startedPerf: now(), checkedResolvers: [], lazyConfigs: [] };
    navState.set(nav, state);
  }
  return state;
}

function phase(nav: NavigationRecord, name: string, from: number | undefined, to: number) {
  if (from === undefined) return;
  nav.phases = { ...nav.phases, [name]: Math.round(to - from) };
}

function isRedirectRequest(event: AnyRecord): boolean {
  return (
    event['type'] === undefined &&
    'navigationBehaviorOptions' in event &&
    read(() => event['url'] !== undefined, false)
  );
}

function isBeforeActivate(event: AnyRecord, nav: NavigationRecord | undefined): boolean {
  if (event['type'] !== undefined || 'url' in event) return false;
  const name = nameOf(event).replace(/^_+/, '');
  if (name === 'BeforeActivateRoutes') return true;
  if (name === 'BeforeRoutesRecognized') return false;
  return !!nav && stateOf(nav).recognizedAt !== undefined;
}

function redirectKindOf(nav: NavigationRecord): string {
  const state = stateOf(nav);
  if (state.resolveAt !== undefined) return 'resolver';
  if (state.guardsAt !== undefined) return 'guard';
  if (state.recognizedAt === undefined) return 'canMatch';
  return 'router';
}

function extrasOf(extras: AnyRecord | null | undefined, restored: unknown): string[] | undefined {
  const out: string[] = [];
  if (extras) {
    if (extras['skipLocationChange']) out.push('skipLocationChange');
    if (extras['replaceUrl']) out.push('replaceUrl');
    if (extras['onSameUrlNavigation'])
      out.push(`onSameUrlNavigation: ${extras['onSameUrlNavigation']}`);
    if (extras['browserUrl']) out.push('browserUrl');
    if (extras['info'] !== undefined) out.push('info');
    const state = extras['state'];
    if (state && typeof state === 'object') {
      const keys = Object.keys(state).filter((key) => key !== 'navigationId');
      if (keys.length) out.push(`state: ${keys.slice(0, 8).join(', ')}`);
    }
  }
  if (restored) out.push('restoredState');
  return out.length ? out : undefined;
}

function findPending(navigations: NavigationRecord[]): NavigationRecord | undefined {
  for (let i = navigations.length - 1; i >= 0; i--) {
    if (navigations[i].outcome === 'pending') return navigations[i];
  }
  return undefined;
}

function checksOf(router: AnyRecord | undefined): NavigationRecord['checked'] | undefined {
  const guards = read(
    () => router?.['navigationTransitions']?.['currentTransition']?.['guards'] as AnyRecord,
    null,
  );
  if (!guards) return undefined;
  const activate = read(() => guards['canActivateChecks'] as AnyRecord[], []).map((check) =>
    fullPathOf(check['route']),
  );
  const deactivate = read(() => guards['canDeactivateChecks'] as AnyRecord[], []).map((check) => {
    const component = read(() => check['component'], null);
    return `${fullPathOf(check['route'])}${component ? ` (${componentName(component)})` : ''}`;
  });
  return { activate, deactivate };
}

function reusedOf(router: AnyRecord): string[] {
  const routes = chainOf(read(() => router['routerState']['root'] as AnyRecord, null));
  const reused: string[] = [];
  for (const route of routes) {
    if (seenRoutes.has(route)) {
      const snapshot = read(() => route['snapshot'] as AnyRecord, null);
      const hasComponent = read(() => !!route['component'], false);
      const configured = read(() => !!snapshot?.['routeConfig'], false);
      if (snapshot && hasComponent && configured) reused.push(fullPathOf(snapshot));
    } else {
      seenRoutes.add(route);
    }
  }
  return reused;
}

function requestsDuring(nav: NavigationRecord): NavigationRecord['requests'] {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) return undefined;
  const start = stateOf(nav).startedPerf;
  const end = now();
  const entries = read(
    () => performance.getEntriesByType('resource') as PerformanceResourceTiming[],
    [],
  ).filter(
    (entry) =>
      (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') &&
      !/\/__pangular\/|\/__devframe|__connection\.json/.test(entry.name) &&
      entry.startTime >= start &&
      entry.startTime <= end,
  );
  if (!entries.length) return undefined;
  return {
    count: entries.length,
    urls: entries.slice(0, 5).map((entry) => redactUrl(entry.name, stateOf(nav).secrets)),
  };
}

function timestamp(nav: NavigationRecord) {
  const stamp = (console as unknown as AnyRecord)['timeStamp'];
  if (typeof stamp !== 'function') return;
  read(() => {
    stamp.call(
      console,
      `${nav.outcome} ${nav.url}`,
      stateOf(nav).startedPerf,
      now(),
      'Router',
      'Pangular Inspector',
      nav.outcome === 'succeeded' ? 'primary' : 'error',
    );
    return true;
  }, false);
}

function finish(nav: NavigationRecord, at: number, router?: AnyRecord) {
  nav.endedAt = at;
  const state = stateOf(nav);
  phase(nav, 'activate', state.activateAt, now());
  phase(nav, 'total', state.startedPerf, now());
  const requests = requestsDuring(nav);
  if (requests) nav.requests = requests;
  if (router) timestamp(nav);
}

export function noteWarning(navigations: NavigationRecord[], message: string) {
  const nav = findPending(navigations) ?? navigations[navigations.length - 1];
  if (!nav) return;
  nav.warnings = [...(nav.warnings ?? []), redactMessage(message, stateOf(nav).secrets)].slice(-5);
}

export function noteErrorHandler(
  navigations: NavigationRecord[],
  text: string,
  navigationError?: unknown,
  redirected = false,
) {
  const id = read(() => (navigationError as AnyRecord)?.['id'] as number | undefined, undefined);
  const nav =
    (id === undefined ? undefined : navigations.find((n) => n.id === id)) ??
    findPending(navigations) ??
    navigations[navigations.length - 1];
  if (!nav) return;
  const state = stateOf(nav);
  nav.errorHandler = redactMessage(text, state.secrets);
  if (navigationError === undefined) return;
  const error = read(() => (navigationError as AnyRecord)?.['error'], undefined);
  state.handled = { reason: errorText(error, state.secrets), redirected };
  const code = errorCodeOf(error);
  if (code) nav.errorCode = code;
}

export function noteRun(navigations: NavigationRecord[], run: GuardRun) {
  const nav = findPending(navigations);
  if (!nav) return;
  nav.runs = [...(nav.runs ?? []), { ...run, result: redactMessage(run.result) }].slice(-40);
}

let failedCalls = 0;

export function noteFailedCall(
  navigations: NavigationRecord[],
  url: string,
  error: unknown,
  at: number,
) {
  navigations.push({
    id: -++failedCalls,
    url: redactUrl(url),
    trigger: 'imperative',
    startedAt: at,
    endedAt: at,
    outcome: 'failed',
    reason: errorText(error),
    errorCode: errorCodeOf(error),
    caller: pendingCaller?.text,
    generation: configGeneration,
  });
  trimNavigations(navigations, navigationLimit);
}

const droppedNavigationCounts = new WeakMap<NavigationRecord[], number>();

/** Removes the oldest navigations past `max` and counts them. */
export function trimNavigations(navigations: NavigationRecord[], max: number) {
  const extra = navigations.length - max;
  if (extra <= 0) return;
  navigations.splice(0, extra);
  droppedNavigationCounts.set(navigations, droppedNavigations(navigations) + extra);
}

/** How many navigations `trimNavigations` removed from this list. */
export function droppedNavigations(navigations: NavigationRecord[]): number {
  return droppedNavigationCounts.get(navigations) ?? 0;
}

/**
 * Folds one router event into the navigation it belongs to. Returns true when
 * something changed.
 */
export function applyRouterEvent(
  navigations: NavigationRecord[],
  event: AnyRecord,
  at: number,
  router?: AnyRecord,
): boolean {
  const type = read(() => event['type'] as number | undefined, undefined);
  const id = read(() => event['id'] as number, -1);
  const current = findPending(navigations);
  if (type === undefined) {
    if (isRedirectRequest(event)) {
      let source: NavigationRecord | undefined;
      for (let k = navigations.length - 1; k >= 0 && !source; k--) {
        const nav = navigations[k];
        if (
          nav.redirectTo === undefined &&
          (nav.outcome === 'redirected' || nav.outcome === 'failed')
        ) {
          source = nav;
        }
      }
      if (!source) return false;
      const target = read(() => String(router?.['serializeUrl'](event['url']) ?? event['url']), '');
      source.redirectTo = redactUrl(target, stateOf(source).secrets);
      source.redirectKind =
        source.outcome === 'failed' || stateOf(source).handled?.redirected
          ? 'error handler'
          : redirectKindOf(source);
      const follower = navigations.find(
        (nav) =>
          nav.id > source!.id && nav.outcome === 'pending' && nav.redirectedFrom === undefined,
      );
      if (follower) follower.redirectedFrom = source.id;
      else pendingRedirect = { from: source.id, kind: source.redirectKind };
      return true;
    }
    if (!current) return false;
    if (isBeforeActivate(event, current)) {
      stateOf(current).activateAt = now();
      return false;
    }
    return false;
  }
  if (type === EventType.NavigationStart) {
    const url = String(event['url']);
    const nav: NavigationRecord = {
      id,
      url: '',
      trigger: String(event['navigationTrigger'] ?? 'imperative'),
      startedAt: at,
      outcome: 'pending',
      generation: configGeneration,
    };
    const state = stateOf(nav);
    state.secrets = configSecretsFor(router, url);
    nav.url = redactUrl(url, state.secrets);
    const from = read(() => String(router?.['url'] ?? ''), '');
    if (router && from) nav.from = redactUrl(from);
    const extras = read(() => {
      const current = router?.['navigationTransitions']?.['currentNavigation'];
      return (typeof current === 'function' ? current() : current)?.['extras'] as AnyRecord;
    }, null);
    const listed = extrasOf(extras, event['restoredState']);
    if (listed) nav.extras = listed;
    if (pendingCaller && at - pendingCaller.at < 2000 && nav.trigger === 'imperative') {
      nav.caller = pendingCaller.text;
    }
    pendingCaller = null;
    if (pendingRedirect) {
      nav.redirectedFrom = pendingRedirect.from;
      pendingRedirect = null;
    }
    navigations.push(nav);
    return true;
  }
  if (type === EventType.RouteConfigLoadStart) {
    if (!current) return false;
    const config = read(() => event['route'] as object, null);
    const path = read(() => String((config as AnyRecord)['path'] ?? ''), '');
    current.lazyLoaded = [...(current.lazyLoaded ?? []), path || '(root)'];
    stateOf(current).lazyConfigs.push(config ?? {});
    return true;
  }
  if (type === EventType.ActivationStart) {
    const snapshot = read(() => event['snapshot'] as AnyRecord, null);
    if (!current?.guards || !snapshot) return false;
    const names = checkedGuardsOf(snapshot);
    current.guards = {
      ...current.guards,
      names: [...new Set([...current.guards.names, ...names])],
    };
    const resolvers = resolversOf(read(() => snapshot['routeConfig'], null)) ?? [];
    stateOf(current).checkedResolvers.push(...resolvers);
    if (!current.checked) {
      const checked = checksOf(router);
      if (checked) current.checked = checked;
    }
    return names.length > 0;
  }
  if (type === EventType.Scroll) {
    const routerEvent = read(() => event['routerEvent'] as AnyRecord, null);
    const target = navigations.find((n) => n.id === read(() => routerEvent?.['id'], -2));
    if (!target) return false;
    const anchor = read(() => event['anchor'] as string | null, null);
    const position = read(() => event['position'] as number[] | null, null);
    target.scroll = anchor
      ? `anchor #${anchor}`
      : position
        ? `restored to ${position.join(', ')}`
        : 'top';
    return true;
  }
  if (type === EventType.NavigationSkipped && !navigations.some((n) => n.id === id)) {
    const nav: NavigationRecord = {
      id,
      url: redactUrl(String(event['url'])),
      trigger: 'imperative',
      startedAt: at,
      outcome: 'pending',
      generation: configGeneration,
    };
    if (pendingCaller && at - pendingCaller.at < 2000) nav.caller = pendingCaller.text;
    pendingCaller = null;
    navigations.push(nav);
  }
  const nav = navigations.find((n) => n.id === id);
  if (!nav) return false;
  const state = stateOf(nav);
  switch (type) {
    case EventType.RoutesRecognized: {
      const secrets = [
        ...state.secrets,
        ...secretParamsOf(read(() => event['state']['root'] as AnyRecord, null)),
      ];
      state.secrets = secrets;
      state.recognizedAt = now();
      phase(nav, 'recognize', state.startedPerf, state.recognizedAt);
      nav.url = redactUrl(nav.url, secrets);
      nav.finalUrl = redactUrl(String(event['urlAfterRedirects']), secrets);
      return true;
    }
    case EventType.GuardsCheckStart: {
      state.guardsAt = now();
      const leaving = read(() => router?.['routerState']['snapshot'], undefined);
      nav.guards = { names: leavingGuardsOf(event['state'], leaving) };
      return true;
    }
    case EventType.GuardsCheckEnd: {
      const end = now();
      nav.guards = {
        names: nav.guards?.names ?? [],
        passed: !!event['shouldActivate'],
        ms: state.guardsAt === undefined ? undefined : Math.round(end - state.guardsAt),
      };
      phase(nav, 'guards', state.guardsAt, end);
      if (!nav.checked) {
        const checked = checksOf(router);
        if (checked) nav.checked = checked;
      }
      return true;
    }
    case EventType.ResolveStart:
      state.resolveAt = now();
      nav.resolvers = { names: state.checkedResolvers };
      return true;
    case EventType.ResolveEnd: {
      const end = now();
      nav.resolvers = {
        names: nav.resolvers?.names ?? [],
        ms: state.resolveAt === undefined ? undefined : Math.round(end - state.resolveAt),
      };
      phase(nav, 'resolve', state.resolveAt, end);
      state.activateAt = end;
      return true;
    }
    case EventType.NavigationEnd: {
      nav.outcome = 'succeeded';
      nav.finalUrl = redactUrl(String(event['urlAfterRedirects']), state.secrets);
      const snapshotState = read(() => router?.['routerState']['snapshot'], null);
      const active = router && new Set(configsOf(snapshotState));
      if (active && nav.lazyLoaded) {
        nav.lazyLoaded = nav.lazyLoaded.filter((_, i) =>
          active.has(state.lazyConfigs[i] as AnyRecord),
        );
        if (!nav.lazyLoaded.length) delete nav.lazyLoaded;
      }
      if (router) {
        const reused = reusedOf(router);
        if (reused.length) nav.reused = reused;
        Promise.resolve().then(() => {
          if (typeof document !== 'undefined') nav.title = clip(document.title, MAX_REASON);
        });
      }
      finish(nav, at, router);
      return true;
    }
    case EventType.NavigationCancel: {
      const code = read(() => event['code'] as number | undefined, undefined);
      nav.code = code === undefined ? undefined : (CANCEL_CODES[code] ?? String(code));
      nav.outcome = nav.code === 'Redirect' ? 'redirected' : 'cancelled';
      const byGuard = nav.code === 'Redirect' || nav.code === 'GuardRejected';
      if (byGuard && nav.guards && nav.guards.passed === undefined) {
        const end = now();
        nav.guards = {
          ...nav.guards,
          passed: false,
          ms: state.guardsAt === undefined ? undefined : Math.round(end - state.guardsAt),
        };
      }
      nav.reason =
        nav.code === 'Redirect' && state.handled?.redirected
          ? state.handled.reason
          : errorText(
              String(event['reason'] ?? '').replace(/^NavigationCancelingError: /, ''),
              state.secrets,
            );
      finish(nav, at, router);
      return true;
    }
    case EventType.NavigationError: {
      nav.outcome = 'failed';
      const error = read(() => event['error'], undefined);
      nav.reason = errorText(error, state.secrets);
      const code = errorCodeOf(error);
      if (code) nav.errorCode = code;
      finish(nav, at, router);
      return true;
    }
    case EventType.NavigationSkipped: {
      const code = read(() => event['code'] as number | undefined, undefined);
      nav.code = code === undefined ? undefined : (SKIP_CODES[code] ?? String(code));
      nav.outcome = 'skipped';
      nav.reason = errorText(String(event['reason'] ?? ''));
      finish(nav, at);
      return true;
    }
    default:
      return false;
  }
}

function urlOf(router: AnyRecord, tree: unknown): string | undefined {
  if (!tree) return undefined;
  return read(() => String(router['serializeUrl'](tree)), undefined);
}

/**
 * The navigation that finished before the overlay subscribed, from
 * `router.lastSuccessfulNavigation` (a signal since Angular 20, a property
 * before). It has no timing or guard details.
 */
export function lastNavigationOf(router: AnyRecord, at: number): NavigationRecord | null {
  const raw = read(() => router['lastSuccessfulNavigation'], null);
  const last = read(() => (typeof raw === 'function' ? raw() : raw) as AnyRecord | null, null);
  if (!last) return null;
  const rawUrl = urlOf(router, last['extractedUrl']) ?? urlOf(router, last['initialUrl']);
  if (!rawUrl) return null;
  const secrets = secretParamsOf(
    read(() => router['routerState']['snapshot']['root'] as AnyRecord, null),
  );
  const url = redactUrl(rawUrl, secrets);
  return {
    id: read(() => Number(last['id']), 0),
    url,
    finalUrl: redactUrl(urlOf(router, last['finalUrl']) ?? rawUrl, secrets),
    trigger: read(() => String(last['trigger'] ?? 'imperative'), 'imperative'),
    startedAt: at,
    outcome: 'succeeded',
    beforeConnect: true,
    generation: configGeneration,
  };
}

/**
 * The navigation in flight when the overlay subscribed, from
 * `router.currentNavigation()` (Angular 20+) or `getCurrentNavigation()`, so
 * its remaining events are not dropped.
 */
export function currentNavigationOf(router: AnyRecord, at: number): NavigationRecord | null {
  const current = read(
    () =>
      (typeof router['currentNavigation'] === 'function'
        ? router['currentNavigation']()
        : router['getCurrentNavigation']?.()) as AnyRecord | null,
    null,
  );
  if (!current) return null;
  const url = urlOf(router, current['extractedUrl']) ?? urlOf(router, current['initialUrl']);
  if (!url) return null;
  return {
    id: read(() => Number(current['id']), 0),
    url: redactUrl(url),
    trigger: read(() => String(current['trigger'] ?? 'imperative'), 'imperative'),
    startedAt: at,
    outcome: 'pending',
    beforeConnect: true,
    generation: configGeneration,
  };
}

export function eventsOf(router: AnyRecord): AnyRecord | null {
  const internal = read(() => router['navigationTransitions']?.['events'] as AnyRecord, null);
  if (internal && typeof internal['subscribe'] === 'function') return internal;
  const events = read(() => router['events'] as AnyRecord, null);
  return events && typeof events['subscribe'] === 'function' ? events : null;
}

/**
 * Subscribes to the router's transition events (including the internal
 * redirect and pre-activation events), falling back to `router.events`.
 * `onChange` runs after each event that changed a navigation. Returns the
 * unsubscribe function, or null when the router has no subscribable events.
 */
export function watchRouter(
  router: AnyRecord,
  navigations: NavigationRecord[],
  onChange: () => void,
  max = navigationLimit,
): (() => void) | null {
  const events = eventsOf(router);
  if (!events) return null;
  if (!navigations.length) {
    const last = lastNavigationOf(router, Date.now());
    if (last) {
      if (last.id > 1) last.earlier = last.id - 1;
      navigations.push(last);
    }
    const current = currentNavigationOf(router, Date.now());
    if (current && current.id !== last?.id) navigations.push(current);
    reusedOf(router);
  }
  const subscription = read(
    () =>
      events['subscribe']((event: AnyRecord) => {
        if (!applyRouterEvent(navigations, event, Date.now(), router)) return;
        trimNavigations(navigations, max);
        onChange();
      }) as { unsubscribe(): void },
    null,
  );
  return subscription ? () => subscription.unsubscribe() : null;
}
