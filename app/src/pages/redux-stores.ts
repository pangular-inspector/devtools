import type { LiveStore, NgrxDiffEntry, NgrxLogEntry } from './store-types';

/**
 * Stores that report through the Redux DevTools extension API (NGXS, Elf,
 * MiniRx), from the `redux-stores` shared state. The store inspector lists
 * them next to the NgRx stores and shows their actions in its action log.
 */
export interface ReduxStoreInfo {
  id: string;
  name: string;
  library: string;
  state: unknown;
  actions: number;
}

export interface ReduxLogEntry {
  seq: number;
  storeId: string;
  type: string;
  action?: unknown;
  timestamp: number;
  diff: NgrxDiffEntry[];
  diffTruncated?: number;
}

export interface ReduxStoresPage {
  pageId: string;
  url: string;
  title: string;
  stores: ReduxStoreInfo[];
  log: ReduxLogEntry[];
  dropped?: number;
  reportedAt: number;
}

/** The prefix that keeps these store ids apart from NgRx store ids in one list. */
export const REDUX_ID_PREFIX = 'redux:';

function isStore(value: unknown): value is ReduxStoreInfo {
  const s = value as Partial<ReduxStoreInfo> | null;
  return (
    !!s && typeof s.id === 'string' && typeof s.name === 'string' && typeof s.library === 'string'
  );
}

/** The pages of the shared state, newest first. Anything else reads as no page. */
export function reduxPagesOf(value: unknown): ReduxStoresPage[] {
  const pages = (value as { pages?: unknown } | null | undefined)?.pages;
  if (!pages || typeof pages !== 'object' || Array.isArray(pages)) return [];
  return Object.values(pages as Record<string, unknown>)
    .filter((page): page is ReduxStoresPage => {
      const p = page as Partial<ReduxStoresPage> | null;
      return (
        !!p &&
        typeof p.pageId === 'string' &&
        Array.isArray(p.stores) &&
        p.stores.every(isStore) &&
        Array.isArray(p.log)
      );
    })
    .sort((a, b) => b.reportedAt - a.reportedAt);
}

/** The stores of a page as entries of the store list. */
export function reduxLiveStores(page: ReduxStoresPage | null | undefined): LiveStore[] {
  return (page?.stores ?? []).map((info) => ({
    id: REDUX_ID_PREFIX + info.id,
    label: info.name,
    kind: 'redux',
    scope: info.library,
    redux: info,
  }));
}

/** One store's actions as log entries, oldest first. They cannot be restored. */
export function reduxLog(
  page: ReduxStoresPage | null | undefined,
  storeId: string | undefined,
): NgrxLogEntry[] {
  if (!page || !storeId?.startsWith(REDUX_ID_PREFIX)) return [];
  const id = storeId.slice(REDUX_ID_PREFIX.length);
  return page.log
    .filter((entry) => entry.storeId === id)
    .map((entry) => ({
      seq: entry.seq,
      source: 'redux',
      storeId: storeId,
      type: entry.type,
      ...(entry.action !== undefined ? { action: entry.action } : {}),
      timestamp: entry.timestamp,
      diff: entry.diff,
      restorable: false,
      ...(entry.diffTruncated ? { diffTruncated: entry.diffTruncated } : {}),
    }));
}
