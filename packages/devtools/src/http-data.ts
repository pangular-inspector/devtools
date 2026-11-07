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

/** A recorded call as the HAR export and the copy snippets read it. Its values are already masked. */
export interface RecordedCall extends CallLike {
  status: number;
  durationMs: number;
  at: number;
  cacheHit: boolean;
  faulted: boolean;
  mocked?: boolean;
  cancelled?: boolean;
  delayMs?: number;
  redirectedTo?: string;
  pageUrl?: string;
  requestId?: string;
  ruleId?: string;
  error?: string;
  preview?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
}

/** The SSR document request a HAR export can start with. */
export interface RecordedSsrRequest {
  id: string;
  method: string;
  url: string;
  status: number;
  at: number;
  durationMs: number;
  renderMs: number;
  headers: Record<string, string>;
}

export interface HarInput {
  calls: readonly RecordedCall[];
  /** The SSR request that served the page, written first. */
  ssrRequest?: RecordedSsrRequest | null;
  /** The page's title, for the HAR page entry. */
  title?: string;
  /** Resolves relative URLs, such as `http://localhost:4200`. Relative URLs stay as recorded without it. */
  origin?: string;
  creator?: { name: string; version: string };
}

interface HarHeader {
  name: string;
  value: string;
}

/** The parts of HAR 1.2 the export writes. */
export interface HarLog {
  log: {
    version: '1.2';
    creator: { name: string; version: string };
    pages: { startedDateTime: string; id: string; title: string; pageTimings: object }[];
    entries: HarEntry[];
    comment: string;
  };
}

export interface HarEntry {
  pageref: string;
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    httpVersion: string;
    cookies: [];
    headers: HarHeader[];
    queryString: HarHeader[];
    headersSize: -1;
    bodySize: -1;
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    cookies: [];
    headers: HarHeader[];
    content: { size: number; mimeType: string; text?: string; comment?: string };
    redirectURL: string;
    headersSize: -1;
    bodySize: -1;
  };
  cache: Record<string, never>;
  timings: { send: number; wait: number; receive: number };
  comment?: string;
  /** Where the call ran: `client`, `server`, or `document` for the SSR request itself. */
  _side: 'client' | 'server' | 'document';
  _notes?: string[];
}

const HAR_PAGE = 'page_1';
const HAR_CLIP = 2000;

function harHeaders(headers: Record<string, string> | undefined): HarHeader[] {
  return Object.entries(headers ?? {}).map(([name, value]) => ({ name, value }));
}

function absoluteUrl(url: string, origin: string | undefined): string {
  if (!origin || /^[a-z][a-z\d+.-]*:/i.test(url)) return url;
  try {
    return new URL(url, origin).href;
  } catch {
    return url;
  }
}

function queryOf(url: string): HarHeader[] {
  try {
    return [...new URL(url, 'http://x').searchParams].map(([name, value]) => ({ name, value }));
  } catch {
    return [];
  }
}

function isoTime(at: number): string {
  const date = new Date(Number.isFinite(at) ? at : 0);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function callNotes(call: RecordedCall): string[] {
  const notes: string[] = [];
  if (call.cacheHit) notes.push('transfer cache');
  if (call.mocked) notes.push('mocked by a fault rule');
  if (call.faulted) notes.push('failed by a fault rule');
  if (call.delayMs) notes.push(`delayed ${call.delayMs} ms by a fault rule`);
  if (call.cancelled) notes.push('cancelled');
  if (call.requestId) notes.push(`SSR request ${call.requestId}`);
  return notes;
}

function callEntry(call: RecordedCall, origin: string | undefined): HarEntry {
  const url = absoluteUrl(call.url, call.side === 'client' ? origin : undefined);
  const mimeType = call.responseHeaders?.['content-type'] ?? 'x-unknown';
  const notes = callNotes(call);
  const text = call.error && !call.preview ? undefined : call.preview;
  const time = Math.max(0, call.durationMs);
  return {
    pageref: HAR_PAGE,
    startedDateTime: isoTime(call.at),
    time,
    request: {
      method: call.method,
      url,
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: harHeaders(call.requestHeaders),
      queryString: queryOf(url),
      headersSize: -1,
      bodySize: -1,
    },
    response: {
      status: call.status,
      statusText: call.cancelled ? 'cancelled' : (call.error ?? ''),
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: harHeaders(call.responseHeaders),
      content: {
        size: text?.length ?? 0,
        mimeType,
        ...(text === undefined ? {} : { text }),
        ...(text !== undefined && text.length >= HAR_CLIP
          ? { comment: `Clipped at ${HAR_CLIP} characters.` }
          : {}),
      },
      redirectURL: call.redirectedTo ?? '',
      headersSize: -1,
      bodySize: -1,
    },
    cache: {},
    timings: { send: 0, wait: time, receive: 0 },
    ...(notes.length ? { comment: notes.join(', ') } : {}),
    _side: call.side,
    ...(notes.length ? { _notes: notes } : {}),
  };
}

function documentEntry(request: RecordedSsrRequest, origin: string | undefined): HarEntry {
  const url = absoluteUrl(request.url, origin);
  const wait = Math.max(0, request.renderMs);
  return {
    pageref: HAR_PAGE,
    startedDateTime: isoTime(request.at),
    time: Math.max(0, request.durationMs),
    request: {
      method: request.method,
      url,
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: [],
      queryString: queryOf(url),
      headersSize: -1,
      bodySize: -1,
    },
    response: {
      status: request.status,
      statusText: '',
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: harHeaders(request.headers),
      content: { size: 0, mimeType: request.headers['content-type'] ?? 'text/html' },
      redirectURL: request.headers['location'] ?? '',
      headersSize: -1,
      bodySize: -1,
    },
    cache: {},
    timings: { send: 0, wait, receive: Math.max(0, request.durationMs - wait) },
    comment: `SSR request ${request.id}: the server render that served the page`,
    _side: 'document',
  };
}

/**
 * A HAR 1.2 log of recorded calls, oldest first: the SSR document request
 * when given, then the server and browser HttpClient calls. Values are
 * written as the panel holds them, already masked, so `[redacted]` stands
 * where a secret was. Request bodies are not recorded, and response bodies
 * are the clipped previews.
 */
export function harLog(input: HarInput): HarLog {
  const entries = [
    ...(input.ssrRequest ? [documentEntry(input.ssrRequest, input.origin)] : []),
    ...input.calls.map((call) => callEntry(call, input.origin)),
  ].sort((a, b) => a.startedDateTime.localeCompare(b.startedDateTime));
  const first = entries[0]?.startedDateTime ?? isoTime(Date.now());
  return {
    log: {
      version: '1.2',
      creator: input.creator ?? { name: 'Pangular Inspector', version: 'unknown' },
      pages: [{ startedDateTime: first, id: HAR_PAGE, title: input.title ?? '', pageTimings: {} }],
      entries,
      comment:
        'Exported by Pangular Inspector. Secrets are masked as [redacted]. Request bodies are not recorded and response bodies are clipped previews.',
    },
  };
}

/** The fields of a recorded call the copy snippets read. */
export type SnippetCall = Pick<RecordedCall, 'url' | 'method' | 'side' | 'requestHeaders'>;

/** Methods whose request usually has a body, which the interceptor does not record. */
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function snippetNotes(call: SnippetCall, url: string, comment: string): string[] {
  const notes: string[] = [];
  const masked = /\[redacted\]|%5Bredacted%5D/i;
  if (masked.test(url) || Object.values(call.requestHeaders ?? {}).some((v) => masked.test(v))) {
    notes.push(`${comment} Masked values ([redacted]) must be filled in before it runs.`);
  }
  if (BODY_METHODS.has(call.method.toUpperCase())) {
    notes.push(`${comment} The request body was not recorded.`);
  }
  return notes;
}

/**
 * The call as a `fetch()` statement: method, URL and the request headers it
 * had at `withPangular()`, all as recorded, so masked values stay
 * `[redacted]`. It is text to read or edit; nothing runs it.
 */
export function fetchSnippet(call: SnippetCall, origin?: string): string {
  const url = absoluteUrl(call.url, call.side === 'client' ? origin : undefined);
  const method = call.method.toUpperCase();
  const headers = call.requestHeaders ?? {};
  const options: Record<string, unknown> = {
    ...(method === 'GET' ? {} : { method }),
    ...(Object.keys(headers).length ? { headers } : {}),
  };
  const args = Object.keys(options).length
    ? `${JSON.stringify(url)}, ${JSON.stringify(options, null, 2)}`
    : JSON.stringify(url);
  return [...snippetNotes(call, url, '//'), `await fetch(${args});`].join('\n');
}

/** Quotes a value for a POSIX shell. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * The call as a `curl` command, built like {@link fetchSnippet}: masked
 * values stay `[redacted]`, and nothing runs it.
 */
export function curlSnippet(call: SnippetCall, origin?: string): string {
  const url = absoluteUrl(call.url, call.side === 'client' ? origin : undefined);
  const method = call.method.toUpperCase();
  const parts = [`curl ${shellQuote(url)}`];
  if (method === 'HEAD') parts.push('--head');
  else if (method !== 'GET') parts.push(`-X ${shellQuote(method)}`);
  for (const [name, value] of Object.entries(call.requestHeaders ?? {})) {
    parts.push(`-H ${shellQuote(`${name}: ${value}`)}`);
  }
  return [...snippetNotes(call, url, '#'), parts.join(' \\\n  ')].join('\n');
}

/** The fields of a TransferState entry the payload views read. */
export interface PayloadEntryLike {
  key: string;
  size: number;
  http?: { url?: string };
}

/** A TransferState script over this many bytes gets a budget warning: it is inlined in the HTML. */
export const PAYLOAD_BUDGET_BYTES = 100 * 1024;

export interface PayloadInsights {
  size: number;
  budget: number;
  overBudget: boolean;
  /** The biggest entries, largest first, each with its share of all entries in percent. */
  largest: { key: string; label: string; size: number; share: number }[];
  /** HttpClient entries that cached the same URL under more than one key. */
  sameUrl: { url: string; keys: string[]; size: number }[];
}

/**
 * Size and repeat checks for a page's TransferState payload: whether it is
 * over the budget, its largest entries, and URLs the transfer cache stored
 * more than once (other headers, params or bodies give other keys). Only
 * reads what the page reported; nothing is fetched.
 */
export function payloadInsights(
  payload: { size: number; entries: readonly PayloadEntryLike[] },
  options: { budget?: number; top?: number } = {},
): PayloadInsights {
  const budget = options.budget ?? PAYLOAD_BUDGET_BYTES;
  const total = payload.entries.reduce((sum, e) => sum + Math.max(e.size, 0), 0);
  const largest = [...payload.entries]
    .filter((e) => e.size > 0)
    .sort((a, b) => b.size - a.size)
    .slice(0, options.top ?? 5)
    .map((e) => ({
      key: e.key,
      label: e.http?.url ?? e.key,
      size: e.size,
      share: total ? Math.round((e.size / total) * 1000) / 10 : 0,
    }));
  const byUrl = new Map<string, PayloadEntryLike[]>();
  for (const entry of payload.entries) {
    const url = entry.http?.url;
    if (!url) continue;
    byUrl.set(url, [...(byUrl.get(url) ?? []), entry]);
  }
  const sameUrl = [...byUrl]
    .filter(([, entries]) => entries.length > 1)
    .map(([url, entries]) => ({
      url,
      keys: entries.map((e) => e.key),
      size: entries.reduce((sum, e) => sum + e.size, 0),
    }))
    .sort((a, b) => b.size - a.size);
  return { size: payload.size, budget, overBudget: payload.size > budget, largest, sameUrl };
}

/** A byte count for people: `812 B`, `14.2 KB`, `1.3 MB`. */
export function byteText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Number((bytes / 1024).toFixed(1))} KB`;
  return `${Number((bytes / 1024 / 1024).toFixed(1))} MB`;
}
