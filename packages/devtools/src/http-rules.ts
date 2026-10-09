import { isHttpRuleStatus } from './config.ts';

export type HttpSide = 'client' | 'server';

export interface HttpRule {
  id: string;
  /** Substring of the request URL, or a glob where `*` matches anything. */
  pattern: string;
  method?: string;
  enabled: boolean;
  target: HttpSide | 'both';
  /** A status >= 400 fails the request; below that it returns `body`. A body alone returns 200. */
  status?: number;
  delayMs?: number;
  /** JSON text, returned as the response body. */
  body?: string;
}

export interface HttpCall {
  id: string;
  url: string;
  method: string;
  status: number;
  durationMs: number;
  side: HttpSide;
  cacheHit: boolean;
  /** A rule failed the request with a status >= 400. */
  faulted: boolean;
  /** A rule answered with a status below 400. */
  mocked?: boolean;
  /** A rule held the request back this long. */
  delayMs?: number;
  /** Unsubscribed before a response, such as by `switchMap` or a destroy. */
  cancelled?: boolean;
  ruleId?: string;
  rulePattern?: string;
  pageUrl?: string;
  at: number;
  error?: string;
  preview?: string;
}

export interface HttpRegistry {
  rules?: HttpRule[];
  calls?: HttpCall[];
  warnings?: string[];
  /** Set by the devframe server so SSR calls reach the timeline. */
  record?: (call: HttpCall) => void;
  /** How many calls to keep (`limits.httpCalls`). */
  maxCalls?: number;
  /** Calls removed from `calls` at `maxCalls` since the last clear. */
  dropped?: number;
  dispose?: () => void;
  /** The hub context whose setup installed `record` and `dispose`. */
  owner?: unknown;
  rulesOff?: boolean;
}

export const MAX_CALLS = 200;
export const MAX_DELAY_MS = 10_000;
export const MAX_RULES = 50;

export function httpRegistry(): HttpRegistry {
  const g = globalThis as { __PANGULAR_HTTP__?: HttpRegistry };
  return (g.__PANGULAR_HTTP__ ??= {});
}

export const RULES_STORAGE_KEY = 'pangular:http-rules';

/**
 * Keeps client rules in sessionStorage so they apply to requests made on the
 * next load, before the overlay connects.
 */
export function storeRules(rules: HttpRule[]) {
  const registry = httpRegistry();
  if (registry.rulesOff) rules = [];
  registry.rules = rules;
  try {
    if (rules.length) sessionStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
    else sessionStorage.removeItem(RULES_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (SSR, privacy mode, sandboxed frames).
  }
}

export function allowClientRules(allowed: boolean) {
  httpRegistry().rulesOff = !allowed;
  if (!allowed) storeRules([]);
}

export function clientRules(): HttpRule[] {
  const registry = httpRegistry();
  if (registry.rulesOff) return [];
  if (!registry.rules) {
    try {
      registry.rules = sanitizeRules(JSON.parse(sessionStorage.getItem(RULES_STORAGE_KEY) ?? '[]'));
    } catch {
      registry.rules = [];
    }
  }
  return registry.rules;
}

/**
 * Unanchored match: `*` spans any characters, and the pattern may appear
 * anywhere, so `/api/*` matches both relative (client) and absolute (SSR) URLs.
 */
function globMatch(text: string, pattern: string): boolean {
  let at = 0;
  for (const part of pattern.split('*')) {
    if (!part) continue;
    const found = text.indexOf(part, at);
    if (found < 0) return false;
    at = found + part.length;
  }
  return true;
}

/** The status a rule answers with, or undefined when it lets the request through. */
export function ruleStatus(rule: HttpRule): number | undefined {
  return rule.status ?? (rule.body ? 200 : undefined);
}

/** False for a rule that neither answers nor delays, so it changes nothing. */
export function ruleHasEffect(rule: HttpRule): boolean {
  return ruleStatus(rule) !== undefined || !!rule.delayMs;
}

export function matchRule(
  url: string,
  method: string,
  rules: readonly HttpRule[] | undefined,
  side: HttpSide,
): HttpRule | undefined {
  return rules?.find(
    (rule) =>
      rule.enabled &&
      !!rule.pattern &&
      ruleHasEffect(rule) &&
      (rule.target === 'both' || rule.target === side) &&
      (!rule.method || rule.method.toUpperCase() === method.toUpperCase()) &&
      globMatch(url, rule.pattern),
  );
}

const str = (value: unknown, max: number) =>
  typeof value === 'string' ? value.slice(0, max) : undefined;

const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** Validates calls reported over RPC; drops anything malformed. */
export function sanitizeCalls(input: unknown, max = MAX_CALLS): HttpCall[] {
  if (!Array.isArray(input)) return [];
  const calls: HttpCall[] = [];
  for (const raw of input.slice(-max)) {
    if (!raw || typeof raw !== 'object') continue;
    const c = raw as { [K in keyof HttpCall]?: unknown };
    const id = str(c.id, 40);
    const url = str(c.url, 2000);
    const method = str(c.method, 10);
    if (!id || url === undefined || !method) continue;
    calls.push({
      id,
      url,
      method,
      status: num(c.status) ?? 0,
      durationMs: num(c.durationMs) ?? 0,
      side: c.side === 'server' ? 'server' : 'client',
      cacheHit: c.cacheHit === true,
      faulted: c.faulted === true,
      ...(c.mocked === true ? { mocked: true } : {}),
      ...(num(c.delayMs) ? { delayMs: num(c.delayMs) } : {}),
      ...(c.cancelled === true ? { cancelled: true } : {}),
      ruleId: str(c.ruleId, 40),
      rulePattern: str(c.rulePattern, 500),
      pageUrl: str(c.pageUrl, 2000),
      at: num(c.at) ?? 0,
      error: str(c.error, 500),
      preview: str(c.preview, 2001),
    });
  }
  return calls;
}

/** Validates rules coming over RPC; drops anything malformed. */
export function sanitizeRules(input: unknown): HttpRule[] {
  if (!Array.isArray(input)) return [];
  const rules: HttpRule[] = [];
  for (const raw of input.slice(0, MAX_RULES)) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as { [K in keyof HttpRule]?: unknown };
    const pattern = str(r.pattern, 500)?.trim();
    if (!pattern) continue;
    const target = r.target === 'client' || r.target === 'server' ? r.target : 'both';
    const status = isHttpRuleStatus(r.status) ? r.status : undefined;
    const delayMs =
      typeof r.delayMs === 'number' && Number.isFinite(r.delayMs)
        ? Math.min(Math.max(Math.round(r.delayMs), 0), MAX_DELAY_MS)
        : undefined;
    const method = str(r.method, 10)?.trim().toUpperCase();
    const body = str(r.body, 100_000)?.trim() || undefined;
    const rule: HttpRule = {
      id: str(r.id, 40) || `r${rules.length + 1}`,
      pattern,
      method: method && /^[A-Z]+$/.test(method) ? method : undefined,
      enabled: r.enabled !== false,
      target,
      status: status ?? (body !== undefined ? 200 : undefined),
      delayMs: delayMs || undefined,
      body,
    };
    if (ruleHasEffect(rule)) rules.push(rule);
  }
  return rules;
}
