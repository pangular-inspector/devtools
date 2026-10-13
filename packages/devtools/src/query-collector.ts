import { documentTree, type HostTree } from './host-tree.ts';
import { serialize } from './ngrx-shared.ts';
import { redactText } from './serialize.ts';
import { redactMessage, redactUrl } from './router.ts';
import { createScanBackoff } from './router-attach.ts';
import {
  QUERY_WRITE_REQUESTS,
  toQueryRequest,
  type MutationInfo,
  type MutationStatus,
  type QueryClientInfo,
  type QueryDetail,
  type QueryFetchStatus,
  type QueryInfo,
  type QueryPageReport,
  type QueryRequestResult,
  type QueryStatus,
} from './query-shared.ts';

type AnyRecord = Record<string, any>;

/** The parts of `window.ng` the collector reads. */
export interface QueryDebugNg<H extends object = Element> {
  getComponent?(host: H): unknown;
  getInjector?(host: H): unknown;
  ɵgetInjectorResolutionPath?(injector: unknown): unknown[];
  ɵgetInjectorMetadata?(injector: unknown): { source?: unknown } | null;
}

export const MAX_QUERIES = 300;
export const MAX_MUTATIONS = 100;
/** How often the injectors are walked again for a client provided later, such as on a lazy route. */
const RESCAN_MS = 10_000;
const KEY = { depth: 4, maxKeys: 10, maxString: 200, budget: 120 };
const PREVIEW = { depth: 2, maxKeys: 6, maxString: 80, budget: 40 };
const FULL = { depth: 8, maxKeys: 100, maxString: 2000, budget: 20_000 };
const QUERY_STATUSES = new Set(['pending', 'error', 'success']);
const FETCH_STATUSES = new Set(['fetching', 'paused', 'idle']);
const MUTATION_STATUSES = new Set(['idle', 'pending', 'success', 'error']);

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** A `QueryClient` from `@tanstack/query-core`, which `@tanstack/angular-query-experimental` provides. */
function isQueryClient(value: unknown): value is AnyRecord {
  return (
    !!value &&
    typeof value === 'object' &&
    read(
      () =>
        typeof (value as AnyRecord)['getQueryCache'] === 'function' &&
        typeof (value as AnyRecord)['getMutationCache'] === 'function' &&
        typeof (value as AnyRecord)['invalidateQueries'] === 'function',
      false,
    )
  );
}

function scopeOf<H extends object>(ng: QueryDebugNg<H>, injector: AnyRecord): string {
  if (read(() => injector['scopes']?.has?.('root'), false)) return 'root';
  if (read(() => injector['scopes']?.has?.('platform'), false)) return 'platform';
  const source = read(() => ng.ɵgetInjectorMetadata?.(injector)?.source, undefined);
  return typeof source === 'string' && source ? redactMessage(source).slice(0, 100) : 'environment';
}

/**
 * The `QueryClient`s the app already created, read from the records of the
 * environment injectors on the components' resolution paths. A record holds
 * its value only once something injected it, so this never creates a client.
 */
export function findQueryClients<H extends object>(
  ng: QueryDebugNg<H>,
  tree: HostTree<H>,
): { client: AnyRecord; scope: string; injector: AnyRecord }[] {
  const out: { client: AnyRecord; scope: string; injector: AnyRecord }[] = [];
  if (!ng?.getInjector || !ng.ɵgetInjectorResolutionPath) return out;
  const seen = new Set<unknown>();
  const clients = new Set<unknown>();
  const stack = [...tree.roots()].reverse();
  while (stack.length) {
    const host = stack.pop()!;
    stack.push(...[...tree.children(host)].reverse());
    if (!read(() => !!ng.getComponent?.(host), false)) continue;
    const injector = read(() => ng.getInjector!(host), null);
    if (!injector) continue;
    for (const candidate of read(() => ng.ɵgetInjectorResolutionPath!(injector) ?? [], [])) {
      const env = candidate as AnyRecord | null;
      if (!env || seen.has(env)) continue;
      seen.add(env);
      if (read(() => env['destroyed'] === true, false)) continue;
      const records = read(() => env['records'], undefined);
      if (!(records instanceof Map)) continue;
      for (const record of read(() => [...records.values()], [] as unknown[])) {
        const value = read(() => (record as AnyRecord | undefined)?.['value'], undefined);
        if (!isQueryClient(value) || clients.has(value)) continue;
        clients.add(value);
        out.push({ client: value, scope: scopeOf(ng, env), injector: env });
      }
    }
  }
  return out;
}

const ids = new WeakMap<object, string>();
const counters = { c: 0, q: 0, m: 0 };

function idOf(value: object, prefix: 'c' | 'q' | 'm'): string {
  let id = ids.get(value);
  if (!id) {
    id = `${prefix}${++counters[prefix]}`;
    ids.set(value, id);
  }
  return id;
}

function errorText(error: unknown): string | undefined {
  if (error === null || error === undefined) return undefined;
  const message = read(
    () =>
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : typeof (error as AnyRecord)?.['message'] === 'string'
          ? String((error as AnyRecord)['message'])
          : String(error),
    'Error',
  );
  return redactText(message).slice(0, 300);
}

function keyText(key: unknown): string {
  const text = read(() => JSON.stringify(key) ?? '', '');
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function staleTimeOf(query: AnyRecord): number | 'static' | undefined {
  let smallest: number | 'static' | undefined;
  for (const observer of read(() => (query['observers'] as AnyRecord[]) ?? [], [])) {
    const value = read(() => observer?.['options']?.['staleTime'], undefined);
    if (value === 'static') smallest ??= 'static';
    else if (typeof value === 'number' && Number.isFinite(value)) {
      smallest =
        smallest === undefined || smallest === 'static' ? value : Math.min(smallest, value);
    }
  }
  return smallest;
}

function describeQuery(query: AnyRecord, clientId: string): QueryInfo {
  const state = read(() => (query['state'] as AnyRecord) ?? {}, {} as AnyRecord);
  const key = read(() => query['queryKey'], undefined);
  const shownKey = serialize(key, KEY);
  const call = <T>(name: string, fallback: T): T =>
    read(() => (typeof query[name] === 'function' ? (query[name]() as T) : fallback), fallback);
  const status = String(state['status']);
  const fetchStatus = String(state['fetchStatus']);
  const hasData = state['data'] !== undefined;
  const gc = read(() => query['gcTime'], undefined);
  const staleTime = staleTimeOf(query);
  const error = errorText(state['error']);
  return {
    id: idOf(query, 'q'),
    clientId,
    key: shownKey,
    keyText: keyText(shownKey),
    status: (QUERY_STATUSES.has(status) ? status : 'pending') as QueryStatus,
    fetchStatus: (FETCH_STATUSES.has(fetchStatus) ? fetchStatus : 'idle') as QueryFetchStatus,
    stale: call('isStale', true),
    invalidated: state['isInvalidated'] === true,
    observers: call('getObserversCount', 0),
    active: call('isActive', false),
    disabled: call('isDisabled', false),
    dataUpdatedAt: number(state['dataUpdatedAt']),
    errorUpdatedAt: number(state['errorUpdatedAt']),
    dataUpdateCount: number(state['dataUpdateCount']),
    failureCount: number(state['fetchFailureCount']),
    ...(staleTime !== undefined ? { staleTime } : {}),
    ...(typeof gc === 'number' ? { gcTime: Number.isFinite(gc) ? gc : null } : {}),
    ...(error ? { error } : {}),
    hasData,
    ...(hasData ? { preview: serialize(state['data'], PREVIEW) } : {}),
  };
}

function describeMutation(mutation: AnyRecord, clientId: string): MutationInfo {
  const state = read(() => (mutation['state'] as AnyRecord) ?? {}, {} as AnyRecord);
  const key = read(() => mutation['options']?.['mutationKey'], undefined);
  const status = String(state['status']);
  const error = errorText(state['error']);
  const shownKey = key === undefined ? undefined : serialize(key, KEY);
  return {
    id: idOf(mutation, 'm'),
    clientId,
    ...(shownKey !== undefined ? { key: shownKey, keyText: keyText(shownKey) } : {}),
    status: (MUTATION_STATUSES.has(status) ? status : 'idle') as MutationStatus,
    isPaused: state['isPaused'] === true,
    submittedAt: number(state['submittedAt']),
    failureCount: number(state['failureCount']),
    ...(error ? { error } : {}),
    ...(state['variables'] !== undefined
      ? { variables: serialize(state['variables'], PREVIEW) }
      : {}),
  };
}

function all(cache: unknown): AnyRecord[] {
  return read(() => {
    const list = (cache as AnyRecord)['getAll']();
    return Array.isArray(list) ? (list as AnyRecord[]) : [];
  }, []);
}

/** Keeps the `max` newest items, in cache order, and says how many it left out. */
function newest<T>(
  items: T[],
  max: number,
  time: (item: T) => number,
): { kept: T[]; more: number } {
  if (items.length <= max) return { kept: items, more: 0 };
  const keep = new Set([...items].sort((a, b) => time(b) - time(a)).slice(0, max));
  return { kept: items.filter((item) => keep.has(item)), more: items.length - max };
}

export interface QueryCollectorOptions<H extends object> {
  tree?: HostTree<H>;
  /** Called when a cache reports a change. */
  changed?: () => void;
  now?: () => number;
}

/**
 * Reads the app's `QueryClient`s: their queries and mutations, and on
 * request the full data of one of them, or an invalidate or refetch.
 */
export function createQueryCollector<H extends object = Element>(
  getNg: () => QueryDebugNg<H> | undefined,
  options: QueryCollectorOptions<H> = {},
) {
  const tree = options.tree ?? documentTree<H>();
  const now = options.now ?? Date.now;
  const backoff = createScanBackoff();
  let clients: { client: AnyRecord; scope: string; injector: AnyRecord; stop: () => void }[] = [];
  let scannedAt = 0;

  const listen = (client: AnyRecord) => {
    const stops: (() => void)[] = [];
    for (const cache of [
      read(() => client['getQueryCache'](), null),
      read(() => client['getMutationCache'](), null),
    ]) {
      const stop = read(() => cache?.['subscribe']?.(() => options.changed?.()), undefined);
      if (typeof stop === 'function') stops.push(stop);
    }
    return () => {
      for (const stop of stops) read(stop, undefined);
    };
  };

  const scan = () => {
    // A client whose injector was destroyed (a route left, the app torn down) goes.
    for (const entry of clients) {
      if (read(() => entry.injector['destroyed'] === true, false)) entry.stop();
    }
    clients = clients.filter((entry) => !read(() => entry.injector['destroyed'] === true, false));
    const due = clients.length ? now() - scannedAt >= RESCAN_MS : backoff.due();
    if (!due) return;
    scannedAt = now();
    const ng = getNg();
    const found = ng ? findQueryClients(ng, tree) : [];
    if (!found.length && !clients.length) {
      backoff.miss();
      return;
    }
    backoff.reset();
    for (const entry of found) {
      if (clients.some((known) => known.client === entry.client)) continue;
      clients.push({ ...entry, stop: listen(entry.client) });
    }
  };

  const collect = (): Omit<QueryPageReport, 'pageId' | 'url' | 'title'> => {
    scan();
    const infos: QueryClientInfo[] = [];
    let queries: QueryInfo[] = [];
    let mutations: MutationInfo[] = [];
    for (const { client, scope } of clients) {
      const clientId = idOf(client, 'c');
      const cachedQueries = all(read(() => client['getQueryCache'](), null));
      const cachedMutations = all(read(() => client['getMutationCache'](), null));
      infos.push({
        id: clientId,
        scope,
        queries: cachedQueries.length,
        mutations: cachedMutations.length,
      });
      queries.push(...cachedQueries.map((query) => describeQuery(query, clientId)));
      mutations.push(...cachedMutations.map((mutation) => describeMutation(mutation, clientId)));
    }
    const shownQueries = newest(queries, MAX_QUERIES, (q) =>
      Math.max(q.dataUpdatedAt, q.errorUpdatedAt),
    );
    const shownMutations = newest(mutations, MAX_MUTATIONS, (m) => m.submittedAt);
    queries = shownQueries.kept;
    mutations = shownMutations.kept;
    const more =
      shownQueries.more || shownMutations.more
        ? { more: { queries: shownQueries.more, mutations: shownMutations.more } }
        : {};
    return { at: now(), clients: infos, queries, mutations, ...more };
  };

  const find = (id: string): { client: AnyRecord; item: AnyRecord } | null => {
    const prefix = id[0] as 'q' | 'm';
    for (const { client } of clients) {
      const cache = read(
        () => (prefix === 'q' ? client['getQueryCache']() : client['getMutationCache']()),
        null,
      );
      const item = all(cache).find((entry) => ids.get(entry) === id);
      if (item) return { client, item };
    }
    return null;
  };

  /** Answers a request from the panel or an agent. `allowWrites` is the `actions.tanstackQuery` option. */
  const run = (value: unknown, allowWrites: boolean): QueryRequestResult => {
    const request = toQueryRequest(value);
    if (!request) return { error: 'Unknown request.' };
    if (QUERY_WRITE_REQUESTS.includes(request.type) && !allowWrites) {
      return { error: 'Query actions are turned off (actions.tanstackQuery).' };
    }
    const found = find(request.id);
    if (!found) {
      return {
        error: `No query or mutation ${request.id} on this page. It may have been removed.`,
      };
    }
    const { client, item } = found;
    if (request.type === 'detail') {
      const state = read(() => (item['state'] as AnyRecord) ?? {}, {} as AnyRecord);
      const mutation = request.id.startsWith('m');
      const key = mutation
        ? read(() => item['options']?.['mutationKey'], undefined)
        : read(() => item['queryKey'], undefined);
      const detail: QueryDetail = {
        id: request.id,
        kind: mutation ? 'mutation' : 'query',
        ...(key !== undefined ? { key: serialize(key, KEY) } : {}),
        ...(state['data'] !== undefined ? { data: serialize(state['data'], FULL) } : {}),
        ...(mutation && state['variables'] !== undefined
          ? { variables: serialize(state['variables'], FULL) }
          : {}),
        ...(state['error'] !== null && state['error'] !== undefined
          ? { error: serialize(state['error'], { ...FULL, budget: 2000 }) }
          : {}),
      };
      return { ok: true, detail };
    }
    const predicate = (query: unknown) => query === item;
    const label = keyText(
      serialize(
        read(() => item['queryKey'], undefined),
        KEY,
      ),
    );
    if (request.type === 'invalidate') {
      void read(() => client['invalidateQueries']({ predicate }), undefined)?.catch?.(() => {});
      return {
        ok: true,
        message: `Invalidated ${label}. A query with an active observer refetches now.`,
      };
    }
    void read(() => client['refetchQueries']({ predicate }), undefined)?.catch?.(() => {});
    return { ok: true, message: `Refetching ${label}.` };
  };

  return {
    collect,
    run,
    stop: () => {
      for (const entry of clients) entry.stop();
      clients = [];
    },
  };
}

interface RpcScope {
  rpc: {
    call(name: string, ...args: unknown[]): Promise<unknown>;
    register(definition: {
      name: string;
      type: 'event';
      jsonSerializable: boolean;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: (...args: any[]) => unknown;
    }): void;
  };
}

const HEARTBEAT_MS = 5000;
/** Caches change several times per fetch; pushes wait this long to send them together. */
const SETTLE_MS = 250;

export interface TanstackQueryOptions<H extends object> {
  tree?: HostTree<H>;
  /** `actions.tanstackQuery`. */
  allowWrites: boolean;
  describe?: () => { url: string; title: string };
}

/**
 * The page side of the TanStack Query inspector: pushes `push-tanstack-query`
 * when a cache changes and as a keepalive, and answers `tanstack-query-request`.
 */
export function attachTanstackQuery<H extends object = Element>(
  my: RpcScope,
  pageId: string,
  getNg: () => QueryDebugNg<H> | undefined,
  options: TanstackQueryOptions<H>,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastBody = '';
  let lastPushAt = 0;
  let pushing = false;
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      void push();
    }, SETTLE_MS);
  };
  const collector = createQueryCollector(getNg, {
    ...(options.tree ? { tree: options.tree } : {}),
    changed: schedule,
  });

  const push = async () => {
    if (pushing) return schedule();
    pushing = true;
    try {
      const { at, ...rest } = collector.collect();
      if (!rest.clients.length && !lastBody) return;
      const body = JSON.stringify(rest);
      if (body === lastBody && Date.now() - lastPushAt < HEARTBEAT_MS) return;
      lastBody = body;
      lastPushAt = Date.now();
      const page = options.describe?.() ?? {
        url: redactUrl(location.pathname + location.search),
        title: redactMessage(document.title),
      };
      const report: QueryPageReport = { pageId, ...page, at, ...rest };
      await my.rpc.call('push-tanstack-query', report);
    } catch {
      lastBody = '';
    } finally {
      pushing = false;
    }
  };

  my.rpc.register({
    name: 'tanstack-query-request',
    type: 'event',
    jsonSerializable: true,
    handler: (message: { requestId?: unknown; pageId?: unknown; request?: unknown } | null) => {
      if (!message || typeof message.requestId !== 'string') return;
      // The server always names the page; a request without one is for no page.
      if (message.pageId !== pageId) return;
      let result: QueryRequestResult;
      try {
        result = collector.run(message.request, options.allowWrites);
      } catch (error) {
        result = { error: redactText(String((error as Error)?.message ?? error)) };
      }
      void my.rpc
        .call('tanstack-query-result', { requestId: message.requestId, pageId, result })
        .catch(() => {});
      schedule();
    },
  });

  return {
    push,
    leave: () => {
      lastBody = '';
      void my.rpc.call('forget-tanstack-query-page', pageId).catch(() => {});
    },
    stop: () => {
      clearTimeout(timer);
      timer = undefined;
      collector.stop();
    },
  };
}
