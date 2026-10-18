// @vitest-environment jsdom
import { MutationObserver, QueryClient, QueryObserver } from '@tanstack/query-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HostTree } from '../host-tree.ts';
import {
  attachTanstackQuery,
  createQueryCollector,
  findQueryClients,
  type QueryDebugNg,
} from '../query-collector.ts';
import type { QueryPageReport } from '../query-shared.ts';

/** Angular's `NOT_YET` record value: the provider was never injected. */
const NOT_YET = {};

interface Host {
  name: string;
  children: Host[];
  component?: object;
  injector?: object;
}

function treeOf(roots: Host[]): HostTree<Host> {
  return {
    roots: () => roots,
    children: (host) => host.children,
    parent: () => null,
    tag: (host) => host.name,
    connected: () => true,
    isHost: (value): value is Host => !!value && typeof value === 'object' && 'children' in value,
  };
}

/** An R3Injector as the debug API returns it on a resolution path. */
function environment(records: [unknown, unknown][], scopes: string[] = []) {
  return {
    records: new Map(records.map(([token, value]) => [token, { factory: () => value, value }])),
    scopes: new Set(scopes),
    destroyed: false,
  };
}

function fakeNg(paths: Map<object, object[]>): QueryDebugNg<Host> {
  return {
    getComponent: (host) => host.component ?? null,
    getInjector: (host) => host.injector,
    ɵgetInjectorResolutionPath: (injector) => paths.get(injector as object) ?? [],
    ɵgetInjectorMetadata: () => ({ source: 'TripsRoutes' }),
  };
}

const clients: QueryClient[] = [];
function client() {
  const created = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  created.mount();
  clients.push(created);
  return created;
}

afterEach(() => {
  for (const created of clients.splice(0)) {
    created.clear();
    created.unmount();
  }
  vi.useRealTimers();
});

function page(queryClient: unknown, scopes = ['root']) {
  const env = environment(
    [
      [class QueryClient {}, queryClient],
      [class Router {}, {}],
    ],
    scopes,
  );
  const injector = {};
  const root: Host = { name: 'app-root', children: [], component: {}, injector };
  const ng = fakeNg(new Map([[injector, [injector, env]]]));
  return { env, ng, tree: treeOf([root]) };
}

describe('findQueryClients', () => {
  it('finds a client the app created and never one it did not', () => {
    const notCreated = page(NOT_YET);
    expect(findQueryClients(notCreated.ng, notCreated.tree)).toEqual([]);
    const queryClient = client();
    const created = page(queryClient);
    const found = findQueryClients(created.ng, created.tree);
    expect(found).toHaveLength(1);
    expect(found[0].client).toBe(queryClient);
    expect(found[0].scope).toBe('root');
  });

  it('names a route injector by its source', () => {
    const { ng, tree } = page(client(), []);
    expect(findQueryClients(ng, tree)[0].scope).toBe('TripsRoutes');
  });
});

describe('the TanStack Query collector', () => {
  it('reports queries with status, freshness, observers, error and a redacted preview', async () => {
    const queryClient = client();
    const { ng, tree } = page(queryClient);
    await queryClient.fetchQuery({
      queryKey: ['trips', { token: 'abc' }],
      queryFn: async () => [{ id: 7, apiKey: 'k' }],
      staleTime: 60_000,
    });
    const observer = new QueryObserver(queryClient, {
      queryKey: ['trips', { token: 'abc' }],
      queryFn: async () => [{ id: 7, apiKey: 'k' }],
      staleTime: 60_000,
    });
    const stop = observer.subscribe(() => {});
    await queryClient
      .fetchQuery({
        queryKey: ['profile'],
        queryFn: async () => {
          throw new Error('Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln failed');
        },
      })
      .catch(() => {});

    const collector = createQueryCollector(() => ng, { tree });
    const report = collector.collect();
    expect(report.clients).toEqual([
      { id: expect.stringMatching(/^c\d+$/), scope: 'root', queries: 2, mutations: 0 },
    ]);
    const trips = report.queries.find((q) => q.keyText.includes('trips'))!;
    expect(trips).toMatchObject({
      status: 'success',
      fetchStatus: 'idle',
      stale: false,
      observers: 1,
      active: true,
      hasData: true,
      staleTime: 60_000,
      gcTime: 300_000,
    });
    expect(trips.key).toEqual(['trips', { token: '[redacted]' }]);
    expect(trips.keyText).not.toContain('abc');
    expect(trips.preview).toEqual([{ id: 7, apiKey: '[redacted]' }]);
    expect(trips.dataUpdatedAt).toBeGreaterThan(0);
    const profile = report.queries.find((q) => q.keyText.includes('profile'))!;
    expect(profile.status).toBe('error');
    expect(profile.error).toMatch(/^Error: /);
    expect(profile.error).not.toContain('eyJzdWIiOiIxIn0');
    expect(profile.stale).toBe(true);

    // Ids stay the same between collections.
    expect(collector.collect().queries.map((q) => q.id)).toEqual(report.queries.map((q) => q.id));
    stop();
    collector.stop();
  });

  it('reports mutations with their status and variables', async () => {
    const queryClient = client();
    const { ng, tree } = page(queryClient);
    const mutation = new MutationObserver(queryClient, {
      mutationKey: ['book'],
      mutationFn: async (input: { id: number; password: string }) => input.id,
    });
    await mutation.mutate({ id: 7, password: 'p' });
    const collector = createQueryCollector(() => ng, { tree });
    const [booked] = collector.collect().mutations;
    expect(booked).toMatchObject({
      keyText: '["book"]',
      status: 'success',
      isPaused: false,
      variables: { id: 7, password: '[redacted]' },
    });
    expect(booked.submittedAt).toBeGreaterThan(0);
    const detail = collector.run({ type: 'detail', id: booked.id }, false);
    expect(detail.detail).toMatchObject({ kind: 'mutation', data: 7 });
  });

  it('masks token-like strings in positional keys and variables, and keeps ordinary ones', async () => {
    const queryClient = client();
    const { ng, tree } = page(queryClient);
    const session = 'Xk9fQ2mL7pR4tW8zB3nV6cY1';
    queryClient.setQueryData(['session', session], { ok: true });
    queryClient.setQueryData(['user', 'aB3dE5fG7hJ9kL1mN2pQ'], { ok: true });
    const mutation = new MutationObserver(queryClient, {
      mutationFn: async (input: string[]) => input.length,
    });
    await mutation.mutate(['ada', 'Tr0ub4dor-Secret']);
    const collector = createQueryCollector(() => ng, { tree });
    const report = collector.collect();
    const texts = report.queries.map((query) => query.keyText).sort();
    // A 20-character id stays readable in a key; a longer token does not.
    expect(texts).toEqual(['["session","[redacted]"]', '["user","aB3dE5fG7hJ9kL1mN2pQ"]']);
    expect(report.mutations[0].variables).toEqual(['ada', '[redacted]']);
    const detail = collector.run({ type: 'detail', id: report.mutations[0].id }, false);
    expect(detail.detail).toMatchObject({ variables: ['ada', '[redacted]'] });
    expect(JSON.stringify(report)).not.toContain(session);
  });

  it('reads the full data on request, and invalidates or refetches only when writes are on', async () => {
    const queryClient = client();
    const { ng, tree } = page(queryClient);
    const queryFn = vi.fn(async () => ({ trips: Array.from({ length: 30 }, (_, id) => ({ id })) }));
    await queryClient.fetchQuery({ queryKey: ['trips'], queryFn });
    const collector = createQueryCollector(() => ng, { tree });
    const [trips] = collector.collect().queries;
    expect(JSON.stringify(trips.preview).length).toBeLessThan(400);

    const detail = collector.run({ type: 'detail', id: trips.id }, false);
    expect((detail.detail!.data as { trips: unknown[] }).trips).toHaveLength(30);

    expect(collector.run({ type: 'invalidate', id: trips.id }, false)).toEqual({
      error: expect.stringMatching(/turned off/),
    });
    expect(collector.run({ type: 'invalidate', id: trips.id }, true)).toMatchObject({ ok: true });
    expect(queryClient.getQueryState(['trips'])?.isInvalidated).toBe(true);
    expect(collector.collect().queries[0]).toMatchObject({ invalidated: true, stale: true });

    expect(collector.run({ type: 'refetch', id: trips.id }, true)).toMatchObject({ ok: true });
    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    expect(collector.run({ type: 'detail', id: 'q999999' }, true).error).toMatch(/No query/);
    expect(collector.run({ type: 'drop', id: trips.id }, true).error).toMatch(/Unknown/);
  });

  it('answers a request when a query key getter throws', async () => {
    const queryClient = client();
    const { ng, tree } = page(queryClient);
    await queryClient.fetchQuery({ queryKey: ['trips'], queryFn: async () => [1] });
    const collector = createQueryCollector(() => ng, { tree });
    const [trips] = collector.collect().queries;
    const query = queryClient.getQueryCache().find({ queryKey: ['trips'] })!;
    Object.defineProperty(query, 'queryKey', {
      configurable: true,
      get() {
        throw new Error('hostile key');
      },
    });
    const detail = collector.run({ type: 'detail', id: trips.id }, false);
    expect(detail).toMatchObject({ ok: true, detail: { kind: 'query', data: [1] } });
    expect(detail.detail).not.toHaveProperty('key');
    expect(() => collector.run({ type: 'invalidate', id: trips.id }, true)).not.toThrow();
  });

  it('caps the queries it reports and keeps the newest', async () => {
    const queryClient = client();
    const { ng, tree } = page(queryClient);
    for (let i = 0; i < 310; i++) {
      queryClient.setQueryData(['trip', i], { i }, { updatedAt: 1000 + i });
    }
    const report = createQueryCollector(() => ng, { tree }).collect();
    expect(report.queries).toHaveLength(300);
    expect(report.more).toEqual({ queries: 10, mutations: 0 });
    expect(report.queries.some((q) => q.keyText === '["trip",0]')).toBe(false);
    expect(report.queries.some((q) => q.keyText === '["trip",309]')).toBe(true);
  });

  it('drops a client whose injector was destroyed', () => {
    const queryClient = client();
    const { env, ng, tree } = page(queryClient);
    const collector = createQueryCollector(() => ng, { tree });
    expect(collector.collect().clients).toHaveLength(1);
    env.destroyed = true;
    expect(collector.collect().clients).toHaveLength(0);
  });
});

describe('attachTanstackQuery', () => {
  it('pushes when a cache changes, with the page id, and skips unchanged reports', async () => {
    vi.useFakeTimers();
    const queryClient = client();
    const { ng, tree } = page(queryClient);
    const reports: QueryPageReport[] = [];
    const handlers: Record<string, (message: unknown) => void> = {};
    const my = {
      rpc: {
        call: vi.fn(async (name: string, value: unknown) => {
          if (name === 'push-tanstack-query') reports.push(value as QueryPageReport);
          return undefined;
        }),
        register: (definition: { name: string; handler: (message: unknown) => void }) => {
          handlers[definition.name] = definition.handler;
        },
      },
    };
    const queries = attachTanstackQuery(my, 'tab1', () => ng, {
      tree,
      allowWrites: false,
      describe: () => ({ url: '/trips', title: 'Trips' }),
    });
    await queries.push();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ pageId: 'tab1', url: '/trips', queries: [] });
    await queries.push();
    expect(reports).toHaveLength(1);

    queryClient.setQueryData(['trips'], [1]);
    await vi.advanceTimersByTimeAsync(300);
    expect(reports).toHaveLength(2);
    expect(reports[1].queries[0].keyText).toBe('["trips"]');

    handlers['tanstack-query-request']({
      requestId: 'r1',
      pageId: 'tab1',
      request: { type: 'invalidate', id: reports[1].queries[0].id },
    });
    expect(my.rpc.call).toHaveBeenCalledWith('tanstack-query-result', {
      requestId: 'r1',
      pageId: 'tab1',
      result: { error: expect.stringMatching(/turned off/) },
    });
    handlers['tanstack-query-request']({ requestId: 'r2', pageId: 'other', request: {} });
    expect(my.rpc.call).not.toHaveBeenCalledWith(
      'tanstack-query-result',
      expect.objectContaining({ requestId: 'r2' }),
    );
    // A request that names no page is for no page, not for every page.
    handlers['tanstack-query-request']({ requestId: 'r3', request: { type: 'detail', id: 'q1' } });
    expect(my.rpc.call).not.toHaveBeenCalledWith(
      'tanstack-query-result',
      expect.objectContaining({ requestId: 'r3' }),
    );

    queries.leave();
    expect(my.rpc.call).toHaveBeenCalledWith('forget-tanstack-query-page', 'tab1');
    queries.stop();
  });
});
