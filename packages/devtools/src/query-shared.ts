/** Types shared by the TanStack Query collector, the server and the panel. */

export type QueryStatus = 'pending' | 'error' | 'success';
export type QueryFetchStatus = 'fetching' | 'paused' | 'idle';
export type MutationStatus = 'idle' | 'pending' | 'success' | 'error';

/** One `QueryClient` the app provides, found in an environment injector. */
export interface QueryClientInfo {
  /** Stable for the page's life: `c1`, `c2`, ... */
  id: string;
  /** The environment injector that holds it: `root`, or the route or module that provides it. */
  scope: string;
  queries: number;
  mutations: number;
}

export interface QueryInfo {
  /** Stable for the query's life: `q1`, `q2`, ... */
  id: string;
  clientId: string;
  /** The query key, serialized and redacted. */
  key: unknown;
  /** The key as one line of text, for lists and search. */
  keyText: string;
  status: QueryStatus;
  fetchStatus: QueryFetchStatus;
  /** `query.isStale()`: with observers, whether any observer's result is stale. */
  stale: boolean;
  invalidated: boolean;
  observers: number;
  /** Has an observer with `enabled` not false. */
  active: boolean;
  disabled: boolean;
  /** When the data was last updated, in ms since the epoch on the page's clock (0 when never). */
  dataUpdatedAt: number;
  errorUpdatedAt: number;
  dataUpdateCount: number;
  failureCount: number;
  /** The smallest number `staleTime` of its observers, or `static`. Missing when none sets one. */
  staleTime?: number | 'static';
  /** How long the query stays cached once unused, in ms. `null` for Infinity. */
  gcTime?: number | null;
  /** The error message, redacted. */
  error?: string;
  hasData: boolean;
  /** A small, redacted preview of the data. The full value is read on request. */
  preview?: unknown;
}

export interface MutationInfo {
  /** Stable for the mutation's life: `m1`, `m2`, ... */
  id: string;
  clientId: string;
  key?: unknown;
  keyText?: string;
  status: MutationStatus;
  isPaused: boolean;
  /** When `mutate` was called, in ms since the epoch on the page's clock (0 when never). */
  submittedAt: number;
  failureCount: number;
  error?: string;
  /** A small, redacted preview of the variables. */
  variables?: unknown;
}

export interface QueryPageReport {
  pageId: string;
  url: string;
  title: string;
  /** The page's clock when it collected the report, to age `dataUpdatedAt` without clock skew. */
  at: number;
  clients: QueryClientInfo[];
  queries: QueryInfo[];
  mutations: MutationInfo[];
  /** Queries and mutations left out past the caps, newest kept. */
  more?: { queries: number; mutations: number };
}

export interface QueryPage extends QueryPageReport {
  reportedAt: number;
}

export interface QueryState {
  pages: Record<string, QueryPage>;
}

/** What the panel or an agent asks a page for. `detail` reads; the others are actions. */
export type QueryRequest =
  | { type: 'detail'; id: string }
  | { type: 'invalidate'; id: string }
  | { type: 'refetch'; id: string };

export interface QueryDetail {
  id: string;
  kind: 'query' | 'mutation';
  key?: unknown;
  /** The data, serialized and redacted, up to a size budget. */
  data?: unknown;
  /** Mutations: the variables. */
  variables?: unknown;
  error?: unknown;
}

export interface QueryRequestResult {
  ok?: boolean;
  message?: string;
  error?: string;
  detail?: QueryDetail;
}

export const QUERY_WRITE_REQUESTS: readonly string[] = ['invalidate', 'refetch'];

/** The request, or null when it is not one the page understands. */
export function toQueryRequest(value: unknown): QueryRequest | null {
  const r = value as { type?: unknown; id?: unknown } | null;
  if (!r || typeof r.id !== 'string' || !/^[qm]\d{1,9}$/.test(r.id)) return null;
  if (r.type !== 'detail' && r.type !== 'invalidate' && r.type !== 'refetch') return null;
  if (r.type !== 'detail' && !r.id.startsWith('q')) return null;
  return { type: r.type, id: r.id };
}
