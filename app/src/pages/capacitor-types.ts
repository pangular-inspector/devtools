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
