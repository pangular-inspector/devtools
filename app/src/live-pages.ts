export interface ReportedPage {
  pageId: string;
  reportedAt: number;
}

/**
 * The page a view shows: the one picked in the view, else the host page (even
 * before it reports), else the page shown before, else the newest. A page that
 * reports again never takes over from the one the user is looking at.
 */
export function pickPage(
  pages: Record<string, ReportedPage>,
  ids: { chosen: string | null; host: string | null; previous: string | null },
): string | null {
  if (ids.chosen && pages[ids.chosen]) return ids.chosen;
  if (ids.host) return ids.host;
  if (ids.previous && pages[ids.previous]) return ids.previous;
  let latest: ReportedPage | null = null;
  for (const page of Object.values(pages)) {
    if (!latest || page.reportedAt > latest.reportedAt) latest = page;
  }
  return latest?.pageId ?? null;
}

/** The injector tree of the host page when one is known, else the newest one. */
export function injectorTreeFor<T>(
  state: ({ pages?: Record<string, T> } & T) | null,
  hostPageId: string | null,
): T | null {
  if (!state) return null;
  return hostPageId ? (state.pages?.[hostPageId] ?? null) : state;
}

/** The signal graph of the host page when one is known, else the newest one. */
export function signalGraphFor<T>(
  state: { graph?: T | null; pages?: Record<string, T> } | null,
  hostPageId: string | null,
): T | null {
  if (!state) return null;
  return hostPageId ? (state.pages?.[hostPageId] ?? null) : (state.graph ?? null);
}
