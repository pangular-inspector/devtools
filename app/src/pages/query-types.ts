/** The TanStack Query inspector data as the `tanstack-query` shared state holds it. */

export type QueryStatus = 'pending' | 'error' | 'success';
export type QueryFetchStatus = 'fetching' | 'paused' | 'idle';
export type MutationStatus = 'idle' | 'pending' | 'success' | 'error';

export interface QueryClientInfo {
  id: string;
  scope: string;
  queries: number;
  mutations: number;
}

export interface QueryInfo {
  id: string;
  clientId: string;
  key: unknown;
  keyText: string;
  status: QueryStatus;
  fetchStatus: QueryFetchStatus;
  stale: boolean;
  invalidated: boolean;
  observers: number;
  active: boolean;
  disabled: boolean;
  dataUpdatedAt: number;
  errorUpdatedAt: number;
  dataUpdateCount: number;
  failureCount: number;
  staleTime?: number | 'static';
  gcTime?: number | null;
  error?: string;
  hasData: boolean;
  preview?: unknown;
}

export interface MutationInfo {
  id: string;
  clientId: string;
  key?: unknown;
  keyText?: string;
  status: MutationStatus;
  isPaused: boolean;
  submittedAt: number;
  failureCount: number;
  error?: string;
  variables?: unknown;
}

export interface QueryPage {
  pageId: string;
  url: string;
  title: string;
  /** The page's clock when it collected the report. */
  at: number;
  /** The server's clock when the report arrived. */
  reportedAt: number;
  clients: QueryClientInfo[];
  queries: QueryInfo[];
  mutations: MutationInfo[];
  more?: { queries: number; mutations: number };
}

export interface QueryDetail {
  id: string;
  kind: 'query' | 'mutation';
  key?: unknown;
  data?: unknown;
  variables?: unknown;
  error?: unknown;
}

export interface QueryRequestResult {
  ok?: boolean;
  message?: string;
  error?: string;
  detail?: QueryDetail;
}

/** The pages of the shared state, newest first. */
export function queryPagesOf(value: unknown): QueryPage[] {
  const pages = (value as { pages?: unknown } | null | undefined)?.pages;
  if (!pages || typeof pages !== 'object' || Array.isArray(pages)) return [];
  return Object.values(pages as Record<string, unknown>)
    .filter((page): page is QueryPage => {
      const p = page as Partial<QueryPage> | null;
      return (
        !!p &&
        typeof p.pageId === 'string' &&
        Array.isArray(p.clients) &&
        Array.isArray(p.queries) &&
        Array.isArray(p.mutations)
      );
    })
    .sort((a, b) => b.reportedAt - a.reportedAt);
}

/** `fresh`, `stale` or `invalidated`. */
export function freshness(query: Pick<QueryInfo, 'stale' | 'invalidated'>): string {
  if (query.invalidated) return 'invalidated';
  return query.stale ? 'stale' : 'fresh';
}

/** "12 s ago", "4 min ago", "2 h ago", or "never" for a zero time. */
export function ageText(ms: number, when: number): string {
  if (!when) return 'never';
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  return `${Math.round(seconds / 3600)} h ago`;
}

/** "30 s", "5 min", "Infinity", from a duration option in ms. */
export function durationText(ms: number | 'static' | null | undefined): string {
  if (ms === undefined) return 'not set';
  if (ms === null) return 'Infinity';
  if (ms === 'static') return 'static';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${Math.round(ms / 100) / 10} s`;
  return `${Math.round(ms / 6000) / 10} min`;
}

/** The tone of a status pill: the panel's status colors. */
export function statusTone(
  status: string,
  fetchStatus?: string,
): 'ok' | 'warn' | 'danger' | 'accent' | 'plain' {
  if (fetchStatus === 'fetching') return 'accent';
  if (fetchStatus === 'paused') return 'warn';
  if (status === 'error') return 'danger';
  if (status === 'success') return 'ok';
  if (status === 'pending') return 'warn';
  return 'plain';
}

/** The status filters of the Queries view. */
export type QueryFilter =
  'all' | 'fetching' | 'success' | 'error' | 'pending' | 'stale' | 'inactive';

export function matchesQueryFilter(query: QueryInfo, filter: QueryFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'fetching':
      return query.fetchStatus === 'fetching';
    case 'stale':
      return query.stale || query.invalidated;
    case 'inactive':
      return query.observers === 0;
    default:
      return query.status === filter;
  }
}
