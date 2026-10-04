/** How long a page may go without a report before its data is dropped. */
export const PAGE_TTL_MS = 15_000;

/**
 * How long a tab in the background may go without saying it is still there.
 * Browsers run its timers about once a minute, so this leaves room for a few.
 */
export const HIDDEN_PAGE_TTL_MS = 5 * 60_000;

/** The time a page may go without a report, by page id. */
export type PageTtl = (pageId: string) => number;

export const fixedTtl =
  (ms: number): PageTtl =>
  () =>
    ms;

/**
 * Tabs that said they are in the background. They stop reporting to save work,
 * so their last data is kept for as long as they keep saying so.
 */
export function createPageVisibility() {
  const hidden = new Map<string, number>();
  return {
    /** Records a report and returns whether the list of hidden pages changed. */
    set(pageId: string, isHidden: boolean, now = Date.now()): boolean {
      const was = hidden.has(pageId);
      if (isHidden) hidden.set(pageId, now);
      else hidden.delete(pageId);
      return was !== isHidden;
    },
    has: (pageId: string) => hidden.has(pageId),
    list: () => [...hidden.keys()],
    /** `base` for visible pages; hidden pages never expire while their mark lives. */
    ttl:
      (base = PAGE_TTL_MS): PageTtl =>
      (pageId) =>
        hidden.has(pageId) ? Infinity : base,
    /** Drops tabs that stopped saying they are hidden, and returns whether any went. */
    expire(now = Date.now()): boolean {
      let changed = false;
      for (const [pageId, at] of hidden) {
        if (now - at > HIDDEN_PAGE_TTL_MS) {
          hidden.delete(pageId);
          changed = true;
        }
      }
      return changed;
    },
  };
}

export type PageVisibility = ReturnType<typeof createPageVisibility>;
