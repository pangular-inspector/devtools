// Plain helpers for recorded HttpClient calls and fault rules, shared by the
// devtools server, the agent tools and the panel. The panel imports this file
// through `@pangular-inspector/devtools/internal/http-data`, so it imports
// nothing and only reads the fields it declares below.

/** Where the path starts in a URL: after the origin of an absolute URL, else at 0. */
function pathStart(url: string): number {
  const scheme = /^[a-z][a-z\d+.-]*:\/\/[^/?#]*/i.exec(url);
  if (scheme) return scheme[0].length;
  const protocolRelative = /^\/\/[^/?#]*/.exec(url);
  return protocolRelative ? protocolRelative[0].length : 0;
}

/**
 * Matches the URL patterns of fault rules and SSR overrides. `*` spans any
 * characters and the pattern may appear anywhere, so `/api/*` matches both
 * relative (client) and absolute (SSR) URLs. A leading `^` anchors the
 * pattern at the start of the path, so `^/api` matches `/api/x` and
 * `http://host/api/x` but not `/v1/api` or `/x?next=/api`.
 */
export function urlGlobMatch(url: string, pattern: string): boolean {
  const anchored = pattern.startsWith('^');
  const parts = (anchored ? pattern.slice(1) : pattern).split('*');
  let at = anchored ? pathStart(url) : 0;
  for (const [i, part] of parts.entries()) {
    if (!part) continue;
    const found = url.indexOf(part, at);
    if (found < 0 || (anchored && i === 0 && found !== at)) return false;
    at = found + part.length;
  }
  return true;
}

/** The fields of a recorded call the helpers here read. */
export interface CallLike {
  id: string;
  url: string;
  method: string;
  side: 'client' | 'server';
}

/** The part of a fault rule that decides which requests it applies to. */
export interface RuleScope {
  pattern: string;
  method?: string;
  target: 'client' | 'server' | 'both';
}

/** True when a rule with this pattern, method and target applies to the call. */
export function ruleScopeMatches(
  scope: RuleScope,
  call: Pick<CallLike, 'url' | 'method' | 'side'>,
): boolean {
  const pattern = scope.pattern.trim();
  return (
    !!pattern &&
    (scope.target === 'both' || scope.target === call.side) &&
    (!scope.method || scope.method.toUpperCase() === call.method.toUpperCase()) &&
    urlGlobMatch(call.url, pattern)
  );
}

/**
 * The recorded calls a rule draft would apply to. The panel shows the count
 * while the user types the pattern. Recorded URLs are masked, so a pattern
 * that names a secret query value can match fewer calls here than live.
 */
export function callsMatchingRule<T extends Pick<CallLike, 'url' | 'method' | 'side'>>(
  calls: readonly T[],
  scope: RuleScope,
): T[] {
  if (!scope.pattern.trim()) return [];
  return calls.filter((call) => ruleScopeMatches(scope, call));
}

/** The fields of a fault rule a preset fills in; the rest keep their defaults. */
export interface PresetRule extends RuleScope {
  status?: number;
  delayMs?: number;
  chance?: number;
}

export interface HttpRulePreset {
  id: 'offline' | 'slow-3g' | 'flaky';
  label: string;
  /** What the rules do, for the button's description. */
  description: string;
  rules: readonly PresetRule[];
}

/**
 * Built-in sets of fault rules. Each one adds plain rules that apply to every
 * browser request (`*`, client only); once added, they show, change and
 * remove like any other rule. Rules added before them match first.
 */
export const HTTP_RULE_PRESETS: readonly HttpRulePreset[] = [
  {
    id: 'offline',
    label: 'Offline',
    description: 'Fails every browser request with a network error (status 0).',
    rules: [{ pattern: '*', target: 'client', status: 0 }],
  },
  {
    id: 'slow-3g',
    label: 'Slow 3G',
    description: 'Holds every browser request back 2000 ms before it is sent.',
    rules: [{ pattern: '*', target: 'client', delayMs: 2000 }],
  },
  {
    id: 'flaky',
    label: 'Flaky',
    description: 'Fails 30% of browser requests with 503 Service Unavailable.',
    rules: [{ pattern: '*', target: 'client', status: 503, chance: 30 }],
  },
];

/** The rules of a preset, each with a new id and turned on. */
export function presetRules(
  id: string,
  newId: () => string,
): (PresetRule & { id: string; enabled: true })[] {
  const preset = HTTP_RULE_PRESETS.find((p) => p.id === id);
  return preset ? preset.rules.map((rule) => ({ ...rule, id: newId(), enabled: true })) : [];
}
