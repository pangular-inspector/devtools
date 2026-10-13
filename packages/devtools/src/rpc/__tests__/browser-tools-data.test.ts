import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import { createPangular } from '../../devframe.ts';
import type { BrowserTool } from '../browser-tools.ts';
import { PAGE_TOOL_SESSION_TEXT } from '../ngrx-session-tools.ts';

/** The data inspectors' tools (queries, Redux stores, NgRx history, waterfall, provider values) as page tools. */

async function boot() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await createPangular({ agent: { browserTools: true } }).setup(ctx as never);
  const invoke = ctx.rpc.invokeLocal.bind(ctx.rpc) as unknown as (
    name: string,
    ...args: unknown[]
  ) => Promise<any>;
  const rpc = (name: string, ...args: unknown[]) => invoke(`pangular:${name}`, ...args);
  return { ctx, rpc };
}

const queryReport = (pageId: string, keyText: string) => ({
  pageId,
  url: `/${pageId}`,
  title: pageId,
  at: 100_000,
  clients: [{ id: 'c1', scope: 'root', queries: 1, mutations: 0 }],
  queries: [
    {
      id: 'q1',
      clientId: 'c1',
      key: [keyText],
      keyText,
      status: 'success',
      fetchStatus: 'idle',
      stale: true,
      invalidated: false,
      observers: 1,
      active: true,
      disabled: false,
      dataUpdatedAt: 90_000,
      errorUpdatedAt: 0,
      dataUpdateCount: 1,
      failureCount: 0,
      staleTime: 0,
      gcTime: 300_000,
      hasData: true,
    },
  ],
  mutations: [],
});

describe('data inspector page tools', () => {
  it('lists the page scoped read tools and keeps NgRx session export and import off the page', async () => {
    const { rpc } = await boot();
    const list = ((await rpc('list-browser-tools')) as BrowserTool[]).map((tool) => tool.name);
    expect(list).toEqual(
      expect.arrayContaining([
        'pangular_list-queries',
        'pangular_inspect-query',
        'pangular_inspect-redux-stores',
        'pangular_http-waterfall',
        'pangular_read-provider-value',
        'pangular_inspect-ngrx-entry',
        'pangular_generate-ngrx-test',
      ]),
    );
    for (const name of [
      'pangular_export-ngrx-session',
      'pangular_import-ngrx-session',
      'pangular_restore-ngrx-state',
      'pangular_query-action',
    ]) {
      expect(list).not.toContain(name);
    }
  });

  it('answers list-queries for the calling page only', async () => {
    const { rpc } = await boot();
    await rpc('push-tanstack-query', queryReport('p1', '["mine"]'));
    await rpc('push-tanstack-query', queryReport('p2', '["theirs"]'));
    const mine = await rpc('call-browser-tool', {
      pageId: 'p1',
      name: 'pangular_list-queries',
      args: { page: 'p2' },
    });
    expect(mine.text).toContain('mine');
    expect(mine.text).not.toMatch(/theirs|p2/);
    // A page that reports no queries is told so, without naming the pages that do.
    const none = await rpc('call-browser-tool', {
      pageId: 'p3',
      name: 'pangular_list-queries',
      args: {},
    });
    expect(none.text).toMatch(/This page is not reporting TanStack Query/);
    expect(none.text).not.toMatch(/p1|p2/);
  });

  it('refuses an imported NgRx session from a page tool, and reads it over MCP', async () => {
    const { ctx, rpc } = await boot();
    for (const name of ['pangular_inspect-ngrx-entry', 'pangular_generate-ngrx-test']) {
      const answer = await rpc('call-browser-tool', {
        pageId: 'p1',
        name,
        args: { seq: 1, session: 'session-1' },
      });
      expect(answer.text).toBe(PAGE_TOOL_SESSION_TEXT);
    }
    const mcp = (await ctx.agent.invoke('pangular:inspect-ngrx-entry', {
      seq: 1,
      session: 'session-1',
    })) as { markdown: string };
    expect(mcp.markdown).not.toBe(PAGE_TOOL_SESSION_TEXT);
    expect(mcp.markdown).toMatch(/no longer kept/);
  });
});
