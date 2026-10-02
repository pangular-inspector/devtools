const PAGE_ID_KEY = 'ng-devtools-page-id';

let scopedPageId: string | null = null;

export function scopeToPage(pageId: string | null) {
  scopedPageId = pageId;
}

export function hostPageId(): string | null {
  if (scopedPageId) return scopedPageId;
  try {
    const fromQuery = new URLSearchParams(location.search).get('pageId');
    if (fromQuery) return fromQuery;
    if (window.top === window) return null;
    return sessionStorage.getItem(PAGE_ID_KEY) || null;
  } catch {
    return null;
  }
}
