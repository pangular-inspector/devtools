/** The Errors inspector data as the `errors` shared state holds it. */

export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

export const CONSOLE_LEVELS: readonly ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug'];

export interface ErrorOwner {
  /** The host element id the Components tab selects. */
  id: string;
  name: string;
}

/** One line of the server vs client DOM diff the server builds for a hydration mismatch. */
export interface DiffLine {
  op: 'same' | 'expected' | 'actual';
  text: string;
}

/** What the page read about an NG0100, a hydration mismatch or a missing provider. */
export type ErrorExplain =
  | {
      kind: 'expression-changed';
      binding?: string;
      template?: string;
      previous: string;
      current: string;
      masked?: boolean;
      creation?: boolean;
      members?: string[];
      writes?: { signal: string; at: number; stack?: string[] }[];
      writesKnown?: boolean;
    }
  | {
      kind: 'hydration-mismatch';
      summary?: string;
      expected?: string;
      actual?: string;
      external?: boolean;
      diff?: DiffLine[];
    }
  | { kind: 'missing-provider'; token: string; path?: string[]; source?: string };

/** One injector of an `explain-injection` answer. */
export interface InjectionStep {
  id: string;
  name: string;
  type: 'element' | 'environment' | 'null';
  component?: string;
  status: 'provides' | 'missing' | 'hidden' | 'skipped' | 'not-asked' | 'unknown';
  reason: string;
}

/** The `explain-injection` RPC answer: the lookup path of a token, step by step. */
export interface InjectionExplanation {
  pageId: string;
  token: string;
  flags: string[];
  steps: InjectionStep[];
  outcome: 'resolved' | 'null' | 'error' | 'unknown';
  summary: string;
  approximate?: boolean;
}

/** Text with `code` spans, split so a template can render them as `<code>`. */
export function codeSegments(text: string): { code: boolean; text: string }[] {
  return text
    .split('`')
    .map((part, index) => ({ code: index % 2 === 1, text: part }))
    .filter((part) => part.text);
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
  explain?: ErrorExplain;
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
