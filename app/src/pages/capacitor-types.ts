// The `capacitor` shared state, as the server publishes it
// (packages/devtools/src/rpc/capacitor-tools.ts).

export interface CapacitorPluginInfo {
  name: string;
  available: boolean;
  /** Whether the app imported it; `null` when the page can't tell. */
  registered: boolean | null;
  native: boolean;
  methods: string[];
}

export interface CapacitorInfo {
  platform: string;
  native: boolean;
  bridge: boolean;
  webCalls: boolean;
  env: {
    serverUrl: string;
    debug: boolean;
    logging: boolean;
    /** `null` when the page can't tell. */
    capacitorHttp: boolean | null;
    userAgent: string;
  };
  plugins: CapacitorPluginInfo[];
}

export interface CapacitorCall {
  id: number;
  plugin: string;
  method: string;
  kind: 'promise' | 'callback';
  via: 'native' | 'web';
  args: unknown;
  status: 'pending' | 'ok' | 'error';
  result?: unknown;
  error?: { message: string; code?: string };
  startedAt: number;
  durationMs?: number;
  callbacks?: number;
}

export interface CapacitorListener {
  id: string;
  plugin: string;
  event: string;
  addedAt: number;
  events: number;
  lastEventAt?: number;
  removed?: boolean;
  /** The payload of the last event, masked like a call result. */
  last?: unknown;
}

/** A page as the panel reads it. On the wire, `calls` is keyed by call id. */
export interface CapacitorPage {
  pageId: string;
  url: string;
  title: string;
  reportedAt: number;
  info: CapacitorInfo;
  calls: CapacitorCall[];
  listeners: CapacitorListener[];
  dropped: number;
}

/**
 * Plugins Capacitor itself registers on every platform. Their web side is a
 * stub, so "not available" says nothing about `npx cap sync`.
 */
export const CORE_PLUGINS: ReadonlySet<string> = new Set([
  'CapacitorCookies',
  'CapacitorHttp',
  'SystemBars',
  'WebView',
]);

/** Yes, No or Unknown. */
export function yesNo(value: boolean | null | undefined): string {
  return value == null ? 'Unknown' : value ? 'Yes' : 'No';
}

/**
 * Orders pages by when the panel first saw them, so a page keeps its place
 * while the others report. `seen` remembers the order across updates, and
 * forgets pages that are gone.
 */
export function inFirstSeenOrder(
  pages: CapacitorPage[],
  seen: Map<string, number>,
): CapacitorPage[] {
  // Newest first, so pages that show up together get the newest first too.
  let next = seen.size ? Math.max(...seen.values()) + 1 : 0;
  for (const page of pages) if (!seen.has(page.pageId)) seen.set(page.pageId, next++);
  const ids = new Set(pages.map((page) => page.pageId));
  for (const id of seen.keys()) if (!ids.has(id)) seen.delete(id);
  return [...pages].sort((a, b) => seen.get(a.pageId)! - seen.get(b.pageId)!);
}

/**
 * The page to show when none is picked, or the picked one went: the panel's
 * own page, else the most recent page with a native bridge, else the most
 * recent page.
 */
export function defaultCapacitorPage(
  pages: CapacitorPage[],
  hostPageId: string | null,
): string | null {
  const byRecency = [...pages].sort((a, b) => b.reportedAt - a.reportedAt);
  return (
    pages.find((page) => page.pageId === hostPageId)?.pageId ??
    byRecency.find((page) => page.info.bridge)?.pageId ??
    byRecency[0]?.pageId ??
    null
  );
}

// The server keys calls by id, so that a push patches one entry. The panel
// reads them as a list, oldest first. The same server page object, which the
// shared state keeps when a push leaves it alone, gives the same list.
const readPages = new WeakMap<object, CapacitorPage>();

function readPage(page: CapacitorPage): CapacitorPage {
  const calls = page.calls as unknown;
  if (Array.isArray(calls)) return page;
  let read = readPages.get(page);
  if (!read) {
    const list = Object.values((calls ?? {}) as Record<string, CapacitorCall>).filter(
      (call) => !!call && typeof call.id === 'number',
    );
    read = { ...page, calls: list.sort((a, b) => a.id - b.id) };
    readPages.set(page, read);
  }
  return read;
}

/** Pages from the shared state, newest first, skipping anything malformed. */
export function capacitorPages(value: unknown): CapacitorPage[] {
  const pages = (value as { pages?: unknown } | null | undefined)?.pages;
  if (!pages || typeof pages !== 'object') return [];
  return Object.values(pages as Record<string, CapacitorPage>)
    .filter((page) => page && typeof page.pageId === 'string' && !!page.info)
    .map(readPage)
    .sort((a, b) => b.reportedAt - a.reportedAt);
}

export function isUnimplemented(call: CapacitorCall): boolean {
  const error = call.error;
  return !!error && (error.code === 'UNIMPLEMENTED' || /not implemented/i.test(error.message));
}

/** A call that took at least this long, or has waited this long, counts as slow. */
export const SLOW_MS = 500;

/** Which calls the list shows, besides the search. */
export type CallFilter = 'all' | 'failed' | 'slow' | 'pending';

/** How long a call took, or for a pending call how long it has waited so far. */
export function took(call: CapacitorCall, now: number): number {
  if (call.durationMs !== undefined) return call.durationMs;
  return call.status === 'pending' ? Math.max(0, now - call.startedAt) : 0;
}

export function matchesFilter(call: CapacitorCall, filter: CallFilter, now: number): boolean {
  if (filter === 'failed') return call.status === 'error';
  if (filter === 'pending') return call.status === 'pending';
  if (filter === 'slow') return took(call, now) >= SLOW_MS;
  return true;
}

/** "450 ms", "3 s", "2 min" or "1 h". */
export function span(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))} ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`;
}

/** "3 s ago", or "just now" within the first second. */
export function ago(at: number, now: number): string {
  const ms = now - at;
  return ms < 1000 ? 'just now' : `${span(ms)} ago`;
}

/** A hint on a plugin row: text around an optional command to run. */
export interface PluginHint {
  before: string;
  command?: string;
  after?: string;
}

/**
 * What to do about a plugin, or null when nothing is off. Plugins Capacitor
 * registers itself get no hint.
 */
export function pluginHint(plugin: CapacitorPluginInfo, platform: string): PluginHint | null {
  if (CORE_PLUGINS.has(plugin.name)) return null;
  if (plugin.registered === true && !plugin.available) {
    if (platform === 'android' || platform === 'ios') {
      return {
        before: `Not available on ${platform}. Run `,
        command: `npx cap sync ${platform}`,
        after: ', then run the app again.',
      };
    }
    return {
      before: 'Not available here. Run ',
      command: 'npx cap sync',
      after: ' if it should be native.',
    };
  }
  if (plugin.native && plugin.registered === false) {
    return { before: 'Installed, not imported by the app.' };
  }
  return null;
}

/** The counts at the top of the tab. */
export interface CapacitorSummary {
  pageId: string;
  platform: string;
  native: boolean;
  /** Whether this page logs calls at all; without it the call counts mean nothing. */
  logsCalls: boolean;
  calls: number;
  failed: number;
  slow: number;
  pending: number;
  capacitorHttp: 'On' | 'Off' | 'Unknown';
  hints: number;
}

export function summarize(page: CapacitorPage, now: number): CapacitorSummary {
  const info = page.info;
  const count = (filter: CallFilter) =>
    page.calls.filter((call) => matchesFilter(call, filter, now)).length;
  const http = info.env.capacitorHttp;
  return {
    pageId: page.pageId,
    platform: info.platform,
    native: info.native,
    logsCalls: info.bridge || info.webCalls,
    calls: page.calls.length,
    failed: count('failed'),
    slow: count('slow'),
    pending: count('pending'),
    capacitorHttp: http === null ? 'Unknown' : http ? 'On' : 'Off',
    hints: info.plugins.filter((plugin) => pluginHint(plugin, info.platform)).length,
  };
}

/**
 * Active listeners per plugin and event, keyed `plugin event`. More than one
 * for the same event often means a component added one and never removed it.
 */
export function activeListenerCounts(listeners: CapacitorListener[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const listener of listeners) {
    if (listener.removed) continue;
    const key = `${listener.plugin} ${listener.event}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** A value as a JavaScript literal, indented by 2 spaces. Strings stay as JSON strings. */
export function jsLiteral(value: unknown, indent = ''): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? String(value);
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return `[\n${value.map((item) => inner + jsLiteral(item, inner)).join(',\n')},\n${indent}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return '{}';
  const lines = entries.map(
    ([key, item]) =>
      `${inner}${IDENTIFIER.test(key) ? key : JSON.stringify(key)}: ${jsLiteral(item, inner)}`,
  );
  return `{\n${lines.join(',\n')},\n${indent}}`;
}

/**
 * The call as code to paste into the app, such as
 * `await Camera.getPhoto({quality: 90});`. It uses the masked arguments the
 * panel holds, so a masked value stays masked.
 */
export function callAsCode(call: CapacitorCall): string {
  const plugin = IDENTIFIER.test(call.plugin)
    ? call.plugin
    : `Capacitor.Plugins[${JSON.stringify(call.plugin)}]`;
  const method = IDENTIFIER.test(call.method)
    ? `.${call.method}`
    : `[${JSON.stringify(call.method)}]`;
  const args = call.args === undefined ? [] : [jsLiteral(call.args)];
  if (call.kind === 'callback') {
    if (!args.length) args.push('{}');
    args.push('(result, error) => {}');
  }
  return `await ${plugin}${method}(${args.join(', ')});`;
}

/** Pretty JSON, or `undefined` for a missing value. */
export function json(value: unknown): string {
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value, null, 2) ?? 'undefined';
  } catch {
    return String(value);
  }
}

/** One-line JSON, cut to `max` characters. */
export function preview(value: unknown, max = 120): string {
  let text: string;
  try {
    text = JSON.stringify(value) ?? 'undefined';
  } catch {
    text = String(value);
  }
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
