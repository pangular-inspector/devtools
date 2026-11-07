import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import pangular from '../devframe.ts';
import { answerText } from './tool-answer.ts';

async function boot() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await pangular.setup(ctx as never);
  const invoke = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const call = async (tool: string, args: Record<string, unknown> = {}) =>
    await answerText(ctx.agent.invoke(`pangular:${tool}`, args));
  return { ctx, invoke, call };
}

const root = { path: '', url: '', outlet: 'primary', params: {}, data: {}, children: [] };

function routerReport(pageId: string, navigations: unknown[], extra: object = {}) {
  return {
    pageId,
    generation: 1,
    snapshot: { url: '/', queryParams: {}, fragment: null, root },
    navigations,
    ...extra,
  };
}

function nav(id: number, startedAt: number, extra: object = {}) {
  return {
    id,
    url: `/users/${id}`,
    trigger: 'imperative',
    startedAt,
    endedAt: startedAt + 100,
    outcome: 'succeeded',
    ...extra,
  };
}

describe('router tools on a live page', () => {
  it('joins the HTTP inspector calls of a navigation for the panel and agents', async () => {
    const { invoke, call } = await boot();
    const now = Date.now();
    await invoke('push-router', routerReport('page-h', [nav(1, now), nav(2, now + 60_000)]));
    await invoke('push-http', {
      pageId: 'page-h',
      url: 'http://localhost:4200/users/1',
      payload: { entries: [] },
      calls: [
        {
          id: 'c1',
          url: '/api/users/1',
          method: 'GET',
          status: 200,
          durationMs: 30,
          side: 'client',
          at: now + 10,
        },
        {
          id: 'c2',
          url: '/api/users/1/posts',
          method: 'GET',
          status: 500,
          durationMs: 8,
          side: 'client',
          at: now + 300,
        },
      ],
    });
    const joined = (await invoke('router-http', { pageId: 'page-h', id: 1 })) as {
      during: { id: string }[];
      after: { id: string }[];
    };
    expect(joined.during.map((c) => c.id)).toEqual(['c1']);
    expect(joined.after.map((c) => c.id)).toEqual(['c2']);
    expect(await invoke('router-http', { pageId: 'page-h', id: 99 })).toBeNull();
    const text = await call('explain-navigation', { page: 'page-h', id: 1 });
    expect(text).toContain(
      'HTTP calls while it ran (1, from the HTTP inspector): GET `/api/users/1` 200 30ms',
    );
    expect(text).toContain('`/api/users/1/posts` 500 8ms');
  });

  it('diffs two navigations of a page', async () => {
    const { invoke, call } = await boot();
    const now = Date.now();
    await invoke(
      'push-router',
      routerReport('page-d', [
        nav(1, now, { routes: [{ path: '/users/:id', params: { id: '"1"' } }] }),
        nav(2, now + 1000, { routes: [{ path: '/users/:id', params: { id: '"2"' } }] }),
      ]),
    );
    const text = await call('diff-navigations', { page: 'page-d' });
    expect(text).toContain('Comparing #1');
    expect(text).toContain('- /users/:id id: `"1"` → `"2"`');
    const diff = (await invoke('router-diff', { pageId: 'page-d', a: 1, b: 2 })) as {
      sections: { title: string }[];
    };
    expect(diff.sections.map((s) => s.title)).toContain('Route params');
  });
});
