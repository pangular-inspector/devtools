/** The data the Network page shows, as the `http` shared state sends it, and pure helpers for it. */
import {
  CACHE_SKIP_TEXT,
  HTTP_RULE_STATUSES,
  type CacheSkip,
} from '@pangular-inspector/devtools/internal/config';
import { prettyJson } from '../../format';
import type { SelectOption } from '../../ui/select';

export type HttpSide = 'client' | 'server';

export interface HttpRule {
  id: string;
  pattern: string;
  method?: string;
  enabled: boolean;
  target: HttpSide | 'both';
  status?: number;
  delayMs?: number;
  body?: string;
  chance?: number;
}

export interface HttpCall {
  id: string;
  url: string;
  method: string;
  status: number;
  durationMs: number;
  side: HttpSide;
  cacheHit: boolean;
  faulted: boolean;
  mocked?: boolean;
  delayMs?: number;
  cancelled?: boolean;
  ruleId?: string;
  rulePattern?: string;
  pageUrl?: string;
  requestId?: string;
  /** The Angular API that likely started the call, from a stack heuristic. */
  origin?: 'httpResource' | 'resource' | 'defer';
  cacheStored?: boolean;
  cacheSkip?: CacheSkip;
  at: number;
  error?: string;
  preview?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  /** Made with the page's own `fetch()`, not through `HttpClient`. */
  nativeFetch?: true;
}

export interface SsrNavigation {
  url: string;
  finalUrl?: string;
  outcome: string;
  reason?: string;
  durationMs?: number;
  guards?: { names: string[]; passed?: boolean; ms?: number };
  resolvers?: { names: string[]; ms?: number };
}

export interface SsrRequest {
  id: string;
  method: string;
  url: string;
  status: number;
  at: number;
  durationMs: number;
  renderMs: number;
  bytes: number;
  renderMode: 'server' | 'prerender' | 'client' | 'redirect' | 'not-rendered' | 'unknown';
  fetches: number;
  fetchMs: number;
  headers: Record<string, string>;
  navigations?: SsrNavigation[];
  overrides?: { id: string; kind: SsrOverrideKind; applied: boolean; note?: string }[];
  compressedBeforeTrace?: boolean;
  aborted?: boolean;
}

export type SsrOverrideKind = 'render-error' | 'client-render' | 'state-edit';

export interface SsrOverride {
  id: string;
  kind: SsrOverrideKind;
  pattern: string;
  enabled: boolean;
  message?: string;
  key?: string;
  value?: string;
}

export interface OverrideDraft {
  kind: SsrOverrideKind;
  pattern: string;
  message: string;
  key: string;
  value: string;
}

export const EMPTY_OVERRIDE: OverrideDraft = {
  kind: 'render-error',
  pattern: '',
  message: '',
  key: '',
  value: '',
};

export const OVERRIDE_LABEL: Record<SsrOverrideKind, string> = {
  'render-error': 'Render error',
  'client-render': 'Client render',
  'state-edit': 'TransferState edit',
};

export const RENDER_MODE_LABEL: Record<SsrRequest['renderMode'], string> = {
  server: 'Server',
  prerender: 'Prerender',
  client: 'Client',
  redirect: 'Redirect',
  'not-rendered': 'Not rendered',
  unknown: 'Unknown',
};

export interface PayloadEntry {
  key: string;
  http?: { url?: string; status?: number; statusText?: string; responseType?: string };
  source?: 'http' | 'analog' | 'hydration';
  fn?: { id: string; name?: string; file?: string };
  size: number;
  value: unknown;
}

export interface HydrationMismatch {
  component: string;
  /** `component` is a class name (`ProductCard`), not a node name (`app-card`). */
  isClass?: boolean;
  expected?: string;
  actual?: string;
}

export interface HydrationStats {
  enabled: boolean;
  hydratedComponents?: number;
  hydratedNodes?: number;
  componentsSkippedHydration?: number;
  deferBlocksWithIncrementalHydration?: number;
  nodes?: { hydrated: number; skipped: number; mismatched: number };
  mismatches?: HydrationMismatch[];
  skipHydrationHosts: string[];
  warnings: string[];
  warningsCaptured?: boolean;
  stableMs?: number;
}

export interface HttpPayload {
  found: boolean;
  size: number;
  entries: PayloadEntry[];
  error?: string;
  /** Set when the payload came from Refetch, not from the HTML the tab was served with. */
  refetchedAt?: number;
}

export interface HttpPage {
  pageId: string;
  url: string;
  initialUrl?: string;
  title: string;
  hydration: HydrationStats | null;
  calls: HttpCall[];
  dropped?: number;
  ssrRequestId?: string;
  firstSeenAt?: number;
  reportedAt: number;
}

export interface HttpState {
  serverCalls: HttpCall[];
  serverDropped?: number;
  requests?: SsrRequest[];
  pages: HttpPage[];
  rules: HttpRule[];
  ssrOverrides?: SsrOverride[];
}

export interface RuleDraft {
  pattern: string;
  method: string;
  target: HttpRule['target'];
  status: string;
  delayMs: string;
  body: string;
  chance: string;
}

export const EMPTY_DRAFT: RuleDraft = {
  pattern: '',
  method: '',
  target: 'both',
  status: '',
  delayMs: '',
  body: '',
  chance: '',
};

/** A new fault rule id, unique enough for one rule list. */
export function newRuleId(): string {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** The chance field as a whole percent, null when it is not one from 1 to 99, undefined when empty. */
export function chanceOf(text: string): number | null | undefined {
  if (!text.trim()) return undefined;
  const chance = Number(text);
  return Number.isInteger(chance) && chance >= 1 && chance <= 99 ? chance : null;
}

export function pathOf(url: string): string {
  try {
    const parsed = new URL(url, 'http://x');
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

const REDACTED_IN_URL = /\[redacted\]|%5Bredacted%5D/gi;

/**
 * A rule pattern for a recorded call: its path and query, without the origin, so it
 * matches the relative client URL and the absolute SSR URL. A relative URL stays as
 * recorded, since `api/x` never contains `/api/x`. A redacted value becomes `*`,
 * because the real request carries the secret.
 */
export function mockPattern(url: string): string {
  const absolute = /^([a-z][a-z\d+.-]*:|\/\/)/i.test(url);
  return (absolute ? pathOf(url) : url).replace(REDACTED_IN_URL, '*');
}

/** The preview as a mock body, when it is complete JSON (the rule form takes JSON only). */
export function jsonBody(preview: string): string | null {
  const pretty = prettyJson(preview);
  if (pretty !== null) return pretty;
  try {
    JSON.parse(preview);
    return preview.trim();
  } catch {
    return null;
  }
}

export const STANDARD_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * The path of a page, as an SSR override pattern. The query is left out because the panel only
 * has a redacted copy of it, which would not match the real request.
 */
function pagePath(url: string): string {
  try {
    return new URL(url, 'http://x').pathname;
  } catch {
    return '';
  }
}

/**
 * The page path as a prefilled override pattern. Patterns match anywhere in the URL, so the site
 * root (`/`) would match every page; it is left empty for the user to fill in.
 */
export function pagePattern(url: string): string {
  const path = pagePath(url);
  return path === '/' ? '' : path;
}

/** A part the server masked in a payload key, plain or URL-encoded. */
export const REDACTED_PART = /\[redacted\]|%5Bredacted%5D/i;

/** The longest TransferState key `set-ssr-overrides` keeps (see `sanitizeSsrOverrides`). */
export const MAX_OVERRIDE_KEY = 200;
export const MAX_RULES = 50;
export const MAX_PATTERN = 500;
export const MAX_BODY = 100_000;

export const HTTP_STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'None' },
  ...HTTP_RULE_STATUSES.map(([status, reason]) => ({
    value: String(status),
    label: `${status} ${reason}`,
  })),
];

export function statusTone(status: number | undefined): 'ok' | 'redirect' | 'bad' | 'neutral' {
  if (status === undefined) return 'neutral';
  if (status === 0 || status >= 400) return 'bad';
  if (status >= 300) return 'redirect';
  if (status >= 200) return 'ok';
  return 'neutral';
}

export function statusLabel(call: HttpCall): string {
  if (call.cancelled) return 'cancelled';
  return call.status ? String(call.status) : 'ERR';
}

export function callTone(call: HttpCall): 'ok' | 'redirect' | 'bad' | 'neutral' {
  return call.cancelled ? 'neutral' : statusTone(call.status);
}

/** A failed call has a status of 400 or more, no status (ERR) or was cancelled. */
export function isFailed(call: HttpCall): boolean {
  return !!call.cancelled || !call.status || call.status >= 400;
}

/** The preview as shown: JSON indented by 2 spaces, other text as recorded (both already redacted). */
export function previewText(call: HttpCall): string | undefined {
  if (call.preview === undefined) return undefined;
  return prettyJson(call.preview) ?? call.preview;
}

export function mocksOnServer(rule: Pick<HttpRule, 'target' | 'status'>): boolean {
  return (
    rule.target !== 'client' && rule.status !== undefined && rule.status > 0 && rule.status < 400
  );
}

export function targetLabel(target: HttpRule['target']): string {
  return target === 'both' ? 'SSR + client' : target === 'server' ? 'SSR only' : 'Client only';
}

export function overrideLabel(kind: SsrOverrideKind): string {
  return OVERRIDE_LABEL[kind] ?? kind;
}

export function renderModeLabel(mode: SsrRequest['renderMode']): string {
  return RENDER_MODE_LABEL[mode] ?? 'Unknown';
}

export function skipText(skip: CacheSkip): string {
  return CACHE_SKIP_TEXT[skip] ?? '';
}

export function msLabel(ms: number | undefined): string {
  return ms === undefined ? 'n/a' : `${ms} ms`;
}

/** A guard that returns a UrlTree reports shouldActivate false, so a redirect is not a rejection. */
export function guardVerdict(nav: SsrNavigation): 'redirected' | 'rejected' | '' {
  if (nav.guards?.passed !== false) return '';
  return nav.outcome === 'redirected' ? 'redirected' : 'rejected';
}

/** The response encoding when a compression middleware ran before `ssrMiddleware` saw the body. */
export function compressedWith(req: SsrRequest): string | undefined {
  // The final Content-Encoding is also set when compression runs after ssrMiddleware, as it should.
  if (!req.compressedBeforeTrace) return undefined;
  return req.headers['content-encoding'] ?? 'unknown encoding';
}

export function payloadLabel(entry: PayloadEntry): string | null {
  if (entry.source === 'hydration') return 'hydration annotations';
  if (entry.fn) return `Analog server function ${entry.fn.name ?? entry.fn.id}`;
  if (entry.source === 'analog') return 'Analog';
  return null;
}
