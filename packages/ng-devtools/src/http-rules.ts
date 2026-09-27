export type HttpSide = 'client' | 'server';

export interface HttpRule {
  id: string;
  /** Substring of the request URL, or a glob where `*` matches anything. */
  pattern: string;
  method?: string;
  enabled: boolean;
  target: HttpSide | 'both';
  /** A status >= 400 fails the request; below that it returns `body`. */
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
  faulted: boolean;
  ruleId?: string;
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
}

export const MAX_CALLS = 200;
export const MAX_DELAY_MS = 10_000;
export const MAX_RULES = 50;

export function httpRegistry(): HttpRegistry {
  const g = globalThis as { __NG_DEVTOOLS_HTTP__?: HttpRegistry };
  return (g.__NG_DEVTOOLS_HTTP__ ??= {});
}

export const RULES_STORAGE_KEY = 'ng-devtools:http-rules';

/**
 * Keeps client rules in sessionStorage so they apply to requests made on the
 * next load, before the overlay connects.
 */
export function storeRules(rules: HttpRule[]) {
  httpRegistry().rules = rules;
  try {
    if (rules.length) sessionStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
    else sessionStorage.removeItem(RULES_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (SSR, privacy mode, sandboxed frames).
  }
}

export function clientRules(): HttpRule[] {
  const registry = httpRegistry();
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
      (rule.target === 'both' || rule.target === side) &&
      (!rule.method || rule.method.toUpperCase() === method.toUpperCase()) &&
      globMatch(url, rule.pattern),
  );
}

const str = (value: unknown, max: number) =>
  typeof value === 'string' ? value.slice(0, max) : undefined;

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
    const status =
      typeof r.status === 'number' &&
      Number.isInteger(r.status) &&
      r.status >= 100 &&
      r.status <= 599
        ? r.status
        : undefined;
    const delayMs =
      typeof r.delayMs === 'number' && Number.isFinite(r.delayMs)
        ? Math.min(Math.max(Math.round(r.delayMs), 0), MAX_DELAY_MS)
        : undefined;
    const method = str(r.method, 10)?.trim().toUpperCase();
    rules.push({
      id: str(r.id, 40) || `r${rules.length + 1}`,
      pattern,
      method: method && /^[A-Z]+$/.test(method) ? method : undefined,
      enabled: r.enabled !== false,
      target,
      status,
      delayMs: delayMs || undefined,
      body: str(r.body, 100_000),
    });
  }
  return rules;
}
