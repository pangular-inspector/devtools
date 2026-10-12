/** The Errors inspector data as the `errors` shared state holds it. */

export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

export const CONSOLE_LEVELS: readonly ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug'];

export interface ErrorOwner {
  /** The host element id the Components tab selects. */
  id: string;
  name: string;
}

export interface ErrorGroup {
  id: string;
  message: string;
  name?: string;
  code?: string;
  docUrl?: string;
  count: number;
  firstAt: number;
  lastAt: number;
  sources: ('handler' | 'window' | 'promise')[];
  stack?: string;
  owner?: ErrorOwner;
}

export interface ConsoleEntry {
  id: number;
  level: ConsoleLevel;
  text: string;
  at: number;
  count: number;
  code?: string;
  docUrl?: string;
}

export interface ErrorsPage {
  pageId: string;
  url: string;
  title: string;
  reportedAt: number;
  handler: 'wrapped' | 'none';
  errors: ErrorGroup[];
  console: ConsoleEntry[];
  dropped: { errors: number; console: number };
}

/** An error group with the page it comes from, for the list across pages. */
export interface PageError extends ErrorGroup {
  pageId: string;
}

export interface PageConsoleEntry extends ConsoleEntry {
  pageId: string;
}

export const ALL_PAGES = 'all';

export const SOURCE_LABELS: Record<ErrorGroup['sources'][number], string> = {
  handler: 'ErrorHandler',
  window: 'Uncaught',
  promise: 'Unhandled rejection',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

/**
 * The pages in the shared state, newest report first. The server keys groups
 * and console entries by id, so one push patches one entry; the panel reads
 * them as lists.
 */
export function errorsPages(value: unknown): ErrorsPage[] {
  const pages = isRecord(value) ? value['pages'] : undefined;
  if (!isRecord(pages)) return [];
  return Object.values(pages)
    .filter(
      (page): page is Record<string, unknown> =>
        isRecord(page) && typeof page['pageId'] === 'string',
    )
    .map((page) => ({
      pageId: page['pageId'] as string,
      url: typeof page['url'] === 'string' ? page['url'] : '',
      title: typeof page['title'] === 'string' ? page['title'] : '',
      reportedAt: typeof page['reportedAt'] === 'number' ? page['reportedAt'] : 0,
      handler: page['handler'] === 'wrapped' ? ('wrapped' as const) : ('none' as const),
      errors: isRecord(page['errors']) ? (Object.values(page['errors']) as ErrorGroup[]) : [],
      console: isRecord(page['console'])
        ? (Object.values(page['console']) as ConsoleEntry[]).sort((a, b) => a.id - b.id)
        : [],
      dropped: isRecord(page['dropped'])
        ? {
            errors: Number(page['dropped']['errors']) || 0,
            console: Number(page['dropped']['console']) || 0,
          }
        : { errors: 0, console: 0 },
    }))
    .sort((a, b) => b.reportedAt - a.reportedAt);
}

/** The page to show first: the panel's own page, else the newest. */
export function defaultErrorsPage(pages: ErrorsPage[], hostPageId: string | null): string {
  if (hostPageId && pages.some((page) => page.pageId === hostPageId)) return hostPageId;
  return pages.length > 1 ? ALL_PAGES : (pages[0]?.pageId ?? ALL_PAGES);
}

/** The error groups of one page or of every page, most recent first. */
export function errorsOf(pages: ErrorsPage[], pageId: string): PageError[] {
  return pages
    .filter((page) => pageId === ALL_PAGES || page.pageId === pageId)
    .flatMap((page) => page.errors.map((group) => ({ ...group, pageId: page.pageId })))
    .sort((a, b) => b.lastAt - a.lastAt);
}

/** The console entries of one page or of every page, newest first. */
export function consoleOf(pages: ErrorsPage[], pageId: string): PageConsoleEntry[] {
  return pages
    .filter((page) => pageId === ALL_PAGES || page.pageId === pageId)
    .flatMap((page) => page.console.map((entry) => ({ ...entry, pageId: page.pageId })))
    .sort((a, b) => b.at - a.at || b.id - a.id);
}

/** `NG0100` and its reference page, or just the code when the reference has none. */
export function codeLink(code: string, docUrl?: string): { code: string; href?: string } {
  return docUrl?.startsWith('https://angular.dev/errors/') ? { code, href: docUrl } : { code };
}
