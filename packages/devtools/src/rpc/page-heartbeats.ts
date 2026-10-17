import { PAGE_TTL_MS } from './page-ttl.ts';

/**
 * The page heartbeat, on the server: when each page last said it is there.
 * While a page beats, none of its reports expire (`createPageVisibility`
 * asks `alive`), so an idle page sends no report at all. A page whose beats
 * stopped for {@link PAGE_TTL_MS} is dropped here in the same sweep that
 * drops its reports, and its next beat answers `known: false`, so it sends
 * everything again.
 */
export function createPageHeartbeats(ttlMs = PAGE_TTL_MS) {
  const beats = new Map<string, number>();
  return {
    /**
     * Records a beat. Returns whether the server still had the page: false for
     * a page it never heard from, or whose data expired since its last beat.
     * That is judged the way the stores judge it, before this beat counts: the
     * last beat is within the expiry, or `held` (a tab in the background) keeps
     * it. So a page the sweep has not dropped from here yet is still unknown.
     */
    beat(
      pageId: string,
      now = Date.now(),
      held: (pageId: string) => boolean = () => false,
    ): boolean {
      const at = beats.get(pageId);
      const known = at !== undefined && (now - at <= ttlMs || held(pageId));
      beats.set(pageId, now);
      return known;
    },
    /** Another sign of life (a claim, a visibility report) refreshes a page the server knows. */
    touch(pageId: string, now = Date.now()) {
      if (beats.has(pageId)) beats.set(pageId, now);
    },
    /** Whether the page beat within the expiry, so its reports stay. */
    alive(pageId: string, now = Date.now()): boolean {
      const at = beats.get(pageId);
      return at !== undefined && now - at <= ttlMs;
    },
    /** When the page last beat, for the recency `list-pages` shows. */
    seenAt: (pageId: string): number | undefined => beats.get(pageId),
    /** Drops pages that stopped beating, except those `keep` holds (tabs in the background). */
    expire(now = Date.now(), keep: (pageId: string) => boolean = () => false) {
      for (const [pageId, at] of beats) {
        if (now - at > ttlMs && !keep(pageId)) beats.delete(pageId);
      }
    },
  };
}

export type PageHeartbeats = ReturnType<typeof createPageHeartbeats>;
