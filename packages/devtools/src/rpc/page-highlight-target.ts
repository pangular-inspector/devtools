/** The most elements one highlight request draws a box around. */
export const MAX_HIGHLIGHT_IDS = 50;

export type PageHighlightTarget =
  | string
  | { ids: string[]; pageId?: string; reveal?: true }
  | { id: string; pageId?: string; reveal?: true }
  | { selector: string; pageId?: string };

/**
 * What `request-page-highlight` broadcasts to the pages: a selector string,
 * one element `id`, several `ids` (one box around all of them, such as the
 * root elements of a `@defer` block) or a `selector` object. Anything else
 * clears the box (`''`).
 */
export function pageHighlightTarget(raw: unknown): PageHighlightTarget {
  if (typeof raw === 'string') return raw;
  if (!raw || typeof raw !== 'object') return '';
  const value = raw as Record<string, unknown>;
  const page = typeof value['pageId'] === 'string' ? { pageId: value['pageId'] } : {};
  const reveal = value['reveal'] === true ? { reveal: true as const } : {};
  if (Array.isArray(value['ids'])) {
    const ids = value['ids']
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
      .slice(0, MAX_HIGHLIGHT_IDS)
      .map((id) => id.slice(0, 50));
    if (ids.length) return { ids, ...page, ...reveal };
  }
  if (typeof value['id'] === 'string') return { id: value['id'].slice(0, 50), ...page, ...reveal };
  if (typeof value['selector'] === 'string') {
    return { selector: value['selector'].slice(0, 500), ...page };
  }
  return '';
}
