/**
 * Which page a live agent tool reads or writes when the call leaves out
 * `page`. Every tool uses the same rule, so answers an agent combines all
 * come from one tab:
 *
 * 1. a tab in the foreground before one the user switched away from;
 * 2. then the page that connected most recently (its first report is the
 *    newest), so a tab the user just opened wins and the choice does not flip
 *    each time an older tab sends a heartbeat;
 * 3. then the page that reported last.
 *
 * `pangular:list-pages` lists pages in this order, so its first row is the
 * default page. A tool picks among the pages that report its own data, so a
 * tab without a router never becomes the default of a router tool.
 *
 * This module has no Node imports: tool text helpers that page code also
 * imports call it. The server installs the order ({@link setPageOrder}) and
 * the read notes ({@link setPageReadNote}); without them, pages are ranked by
 * their last report and nothing is noted.
 */

/** What the order needs to know of a page. */
export interface RankedPage {
  pageId: string;
  reportedAt?: number;
}

/** Sort keys of a page, larger first: [foreground, first seen]. Undefined for a page the server never saw. */
export type PageRank = (pageId: string) => readonly [number, number] | undefined;

let rankOf: PageRank = () => undefined;
let note: (pageId: string) => void = () => {};

/** Installs how pages are ranked (see the rule above). */
export function setPageOrder(rank: PageRank): void {
  rankOf = rank;
}

/** Installs what records the page a tool call read, so its answer can name it. */
export function setPageReadNote(record: (pageId: string) => void): void {
  note = record;
}

/** Records that the current tool call read `pageId`. */
export function notePageRead(pageId: string | undefined): void {
  if (pageId) note(pageId);
}

/** Compares two pages by the default-page rule; the default sorts first. */
export function comparePages(a: RankedPage, b: RankedPage): number {
  const ra = rankOf(a.pageId);
  const rb = rankOf(b.pageId);
  for (let i = 0; i < 2; i++) {
    const diff = (rb?.[i] ?? 0) - (ra?.[i] ?? 0);
    if (diff) return diff;
  }
  return (b.reportedAt ?? 0) - (a.reportedAt ?? 0);
}

/** `pages` in default-page order: the page a tool picks without `page` comes first. */
export function rankPages<T extends RankedPage>(pages: Iterable<T>): T[] {
  return [...pages].sort(comparePages);
}

/**
 * The page a tool reads without `page`: the first of `pages` (the pages that
 * report the tool's data) by the rule above. Notes it, so the answer names it.
 */
export function defaultPage<T extends RankedPage>(pages: Iterable<T>): T | undefined {
  const page = rankPages(pages)[0];
  notePageRead(page?.pageId);
  return page;
}

/** Most pages the order remembers; the oldest is dropped first. */
const MAX_PAGES = 500;

/**
 * The server's page order: when each page was first seen, and which tabs
 * are in the background. Install it with `setPageOrder(order.rank)`.
 */
export function createPageOrder(hidden: () => Iterable<string>) {
  const firstSeen = new Map<string, number>();
  let seq = 0;
  return {
    /** Call on every report: only the first one counts. */
    seen(pageId: string): void {
      if (firstSeen.has(pageId)) return;
      // A counter, not a clock, so two pages that connect in the same millisecond still rank.
      firstSeen.set(pageId, ++seq);
      if (firstSeen.size > MAX_PAGES) firstSeen.delete(firstSeen.keys().next().value as string);
    },
    forget(pageId: string): void {
      firstSeen.delete(pageId);
    },
    rank: ((pageId: string) => {
      const first = firstSeen.get(pageId);
      if (first === undefined) return undefined;
      const back = new Set(hidden());
      return [back.has(pageId) ? 0 : 1, first] as const;
    }) satisfies PageRank,
  };
}
