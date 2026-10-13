import type { NgrxDiffEntry } from './ngrx-shared.ts';

/**
 * A store that reports through the Redux DevTools extension API
 * (`redux-devtools-hook.ts`), such as NGXS, Elf or MiniRx.
 */
export interface ReduxStoreInfo {
  /** Stable for the page's life: `r1`, `r2`, ... */
  id: string;
  name: string;
  /** `NGXS`, `Elf`, `MiniRx`, or `Redux DevTools` for another library. */
  library: string;
  /** The last state the store sent, serialized and redacted. */
  state: unknown;
  /** Actions and initial states the store sent since the page loaded. */
  actions: number;
}

export interface ReduxLogEntry {
  seq: number;
  storeId: string;
  type: string;
  /** The action as the store sent it, serialized and redacted. Missing for `@@INIT`. */
  action?: unknown;
  timestamp: number;
  diff: NgrxDiffEntry[];
  /** How many changes past `diff` (it keeps at most 50), as in the NgRx log. */
  diffTruncated?: number;
}

export interface ReduxStoresReport {
  pageId: string;
  url: string;
  title: string;
  stores: ReduxStoreInfo[];
  /** Entries after `since`, oldest first. */
  log: ReduxLogEntry[];
  /** The newest seq the server confirmed before this report. */
  since: number;
}

export interface ReduxStoresPage extends Omit<ReduxStoresReport, 'since'> {
  reportedAt: number;
  /** Older entries removed at `limits.changeLog`. */
  dropped?: number;
}

export interface ReduxStoresState {
  pages: Record<string, ReduxStoresPage>;
}
