/** Longest injector id a refresh request takes. */
const MAX_ID = 100;

export type InjectorRefreshResult = { ok: true } | { ok: false; error: string };

/**
 * The panel's `request-injector-refresh`: asks one page to read an element
 * injector again (`injectorId`, the one the panel selected), or every injector
 * (no id, the Refresh button). The page answers with a fresh injector tree
 * push, so this only checks the request and sends `injector-refresh`.
 */
export function requestInjectorRefresh(
  message: { pageId?: unknown; injectorId?: unknown } | null,
  pages: Iterable<string>,
  broadcast: (method: string, message: { pageId: string; injectorId?: string }) => void,
): InjectorRefreshResult {
  const pageId = message?.pageId;
  if (typeof pageId !== 'string' || !pageId) {
    return { ok: false, error: 'Pass the page id of the injector tree.' };
  }
  if (![...pages].includes(pageId)) {
    return { ok: false, error: `Page ${pageId.slice(0, 100)} has not reported an injector tree.` };
  }
  const id = message?.injectorId;
  if (id !== undefined && id !== null && (typeof id !== 'string' || !id || id.length > MAX_ID)) {
    return { ok: false, error: 'Pass an injector id from the injector tree.' };
  }
  broadcast('injector-refresh', typeof id === 'string' ? { pageId, injectorId: id } : { pageId });
  return { ok: true };
}
