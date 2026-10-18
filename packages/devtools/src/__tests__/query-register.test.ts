import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import { createPangular } from '../devframe.ts';
import type { QueryPageReport, QueryState } from '../query-shared.ts';
import { ageText, staleQueryPages, toQueryReport } from '../rpc/query-tools.ts';
import { answerText } from './tool-answer.ts';

const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');

// The demo project does not depend on TanStack Query, so the tools are turned on here.
async function boot(definition = createPangular({ inspectors: { tanstackQuery: true } })) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await definition.setup(ctx as never);
  const call = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const invoke = async (id: string, args: Record<string, unknown> = {}) =>
    await answerText(ctx.agent.invoke(`pangular:${id}`, args));
  const state = async () =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: { get: (key: string) => Promise<{ value: () => QueryState }> };
        }
      ).sharedState.get('pangular:tanstack-query')
    ).value();
  /** Answers each page request the way the overlay would. */
  const answerAs = (result: (request: { type: string; id: string }) => unknown) => {
    const broadcast = vi.spyOn(ctx.rpc, 'broadcast');
    broadcast.mockImplementation(((options: { method: string; args: unknown[] }) => {
      if (options.method !== 'pangular:tanstack-query-request') return Promise.resolve();
      const message = options.args[0] as {
        requestId: string;
        pageId: string;
        request: { type: string; id: string };
      };
      queueMicrotask(
        () =>
          void call('tanstack-query-result', {
            requestId: message.requestId,
            pageId: message.pageId,
            result: result(message.request),
          }),
      );
      return Promise.resolve();
    }) as never);
    return broadcast;
  };
  return { ctx, call, invoke, state, answerAs };
}

const report = (extra: Partial<QueryPageReport> = {}): QueryPageReport => ({
  pageId: 'tab1',
  url: '/trips',
  title: 'Trips',
  at: 100_000,
  clients: [{ id: 'c1', scope: 'root', queries: 1, mutations: 1 }],
  queries: [
    {
      id: 'q1',
      clientId: 'c1',
      key: ['trips'],
      keyText: '["trips"]',
      status: 'success',
      fetchStatus: 'idle',
      stale: true,
      invalidated: false,
      observers: 2,
      active: true,
      disabled: false,
      dataUpdatedAt: 88_000,
      errorUpdatedAt: 0,
      dataUpdateCount: 1,
      failureCount: 0,
      staleTime: 0,
      gcTime: 300_000,
      hasData: true,
      preview: [{ id: 7 }],
    },
  ],
  mutations: [
    {
      id: 'm1',
      clientId: 'c1',
      keyText: '["book"]',
      status: 'error',
      isPaused: false,
      submittedAt: 99_000,
      failureCount: 1,
      error: 'Error: 500',
    },
  ],
  ...extra,
});

describe('the TanStack Query report on the server', () => {
  it('masks what the page sends and drops malformed rows', () => {
    const checked = toQueryReport({
      ...report(),
      url: `/trips?token=${JWT}`,
      queries: [
        ...report().queries,
        { id: 'x1' },
        { ...report().queries[0], id: 'q2', keyText: `["user","${JWT}"]`, error: `Bearer ${JWT}` },
      ],
    })!;
    expect(checked.url).not.toContain(JWT);
    expect(checked.queries.map((q) => q.id)).toEqual(['q1', 'q2']);
    expect(checked.queries[1].keyText).not.toContain(JWT);
    expect(checked.queries[1].error).not.toContain(JWT);
    expect(toQueryReport({ pageId: 'tab1', clients: [] })).toBeNull();
  });

  it('ages times on the page clock', () => {
    expect(ageText(100_000, 88_000)).toBe('12 s ago');
    expect(ageText(100_000, 0)).toBe('never');
    expect(ageText(10_000_000, 0 + 1)).toBe('3 h ago');
  });

  it('keeps one entry per page, forgets a page, and expires a silent one', async () => {
    const { call, state } = await boot();
    await call('push-tanstack-query', report());
    await call('push-tanstack-query', report({ pageId: 'tab2' }));
    expect(Object.keys((await state()).pages).sort()).toEqual(['tab1', 'tab2']);
    await call('forget-tanstack-query-page', 'tab2');
    expect(Object.keys((await state()).pages)).toEqual(['tab1']);
    expect(staleQueryPages(await state(), Date.now() + 20_000, () => 15_000)).toEqual(['tab1']);
  });

  it('lists queries and mutations, filtered by status and key', async () => {
    const { call, invoke } = await boot();
    expect(await invoke('tanstack-list-queries')).toMatch(/No page reports a TanStack Query/);
    await call('push-tanstack-query', report());
    const text = await invoke('tanstack-list-queries');
    expect(text).toMatch(/come from the running page/);
    expect(text).toMatch(/`c1` in root \(1 queries, 1 mutations\)/);
    expect(text).toMatch(
      /\| `q1` \| `\["trips"\]` \| success \| idle \| stale \| 12 s ago \| 2 \|/,
    );
    expect(text).toMatch(/\| `m1` \| `\["book"\]` \| error \| 1 s ago \| Error: 500 \|/);
    expect(await invoke('tanstack-list-queries', { status: 'error' })).toMatch(
      /Queries \(0 of 0\)/,
    );
    expect(await invoke('tanstack-list-queries', { search: 'TRIPS' })).toMatch(
      /Mutations \(0 of 0\)/,
    );
    expect(await invoke('tanstack-list-queries', { page: 'nope' })).toMatch(/No page `nope`/);
  });

  it('reads the data from the page for tanstack-inspect-query', async () => {
    const { call, invoke, answerAs } = await boot();
    await call('push-tanstack-query', report());
    const broadcast = answerAs((request) => ({
      ok: true,
      detail: {
        id: request.id,
        kind: 'query',
        key: ['trips'],
        data: [{ id: 7, apiKey: '[redacted]' }],
      },
    }));
    const text = await invoke('tanstack-inspect-query', { key: 'trips' });
    expect(broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'pangular:tanstack-query-request',
        args: [expect.objectContaining({ pageId: 'tab1', request: { type: 'detail', id: 'q1' } })],
      }),
    );
    expect(text).toMatch(/# Query `q1` `\["trips"\]`/);
    expect(text).toMatch(/freshness: stale \(staleTime 0 ms\)/);
    expect(text).toMatch(/"apiKey": "\[redacted\]"/);
    expect(await invoke('tanstack-inspect-query', { id: 'q9' })).toMatch(
      /No query or mutation `q9`/,
    );
    expect(await invoke('tanstack-inspect-query')).toMatch(/Pass `id`/);
  });

  it('invalidates through the page, and refuses when the action is blocked', async () => {
    const { call, invoke, answerAs } = await boot();
    await call('push-tanstack-query', report());
    answerAs((request) => ({ ok: true, message: `Invalidated ${request.id}.` }));
    expect(await invoke('tanstack-run-query', { action: 'invalidate', id: 'q1' })).toMatch(
      /Invalidated q1\./,
    );
    expect(await invoke('tanstack-run-query', { action: 'refetch', id: 'm1' })).toMatch(
      /is a mutation/,
    );
    expect(await invoke('tanstack-run-query', { action: 'drop', id: 'q1' })).toMatch(
      /^`action` must be one of `invalidate`, `refetch`/,
    );
    await call('push-tanstack-query', report({ pageId: 'tab2' }));
    expect(await invoke('tanstack-run-query', { action: 'refetch', id: 'q1' })).toMatch(
      /2 pages report TanStack Query/,
    );

    const blocked = await boot(
      createPangular({ inspectors: { tanstackQuery: true }, actions: { tanstackQuery: false } }),
    );
    await blocked.call('push-tanstack-query', report());
    expect(
      await blocked.call('request-tanstack-query', {
        pageId: 'tab1',
        request: { type: 'refetch', id: 'q1' },
      }),
    ).toEqual({ error: expect.stringMatching(/actions\.tanstackQuery/) });
    const tools = blocked.ctx.agent.list().tools.map((tool: { id: string }) => tool.id);
    expect(tools).not.toContain('pangular:tanstack-run-query');
    expect(tools).toContain('pangular:tanstack-inspect-query');
  });

  it('goes away with its inspector', async () => {
    const { ctx } = await boot(createPangular({ inspectors: { tanstackQuery: false } }));
    const tools = ctx.agent.list().tools.map((tool: { id: string }) => tool.id);
    expect(tools).not.toContain('pangular:tanstack-list-queries');
    await expect(
      ctx.rpc.invokeLocal('pangular:push-tanstack-query' as never, ...([report()] as never)),
    ).rejects.toThrow();
  });
});
