import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import pangular from '../devframe.ts';
import { toComponentPage } from '../rpc/component-tools.ts';
import { answerText } from './tool-answer.ts';

async function boot() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await pangular.setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const tool = (name: string, args: Record<string, unknown> = {}) =>
    answerText(ctx.agent.invoke(`pangular:${name}`, args));
  return { push, tool };
}

const good = {
  pageId: 'good',
  roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
  count: 1,
  detail: null,
  deferBlocks: [
    {
      id: 'd1',
      owner: { id: 'c1', name: 'App', tag: 'app-root' },
      state: 'complete',
      hydration: 'not-configured',
      triggers: ['on idle'],
      hasErrorBlock: false,
      rootIds: [],
      since: 1,
    },
  ],
  forBlocks: [
    {
      id: 'f1',
      owner: { id: 'c1', name: 'App', tag: 'app-root' },
      count: 2,
      track: '$index',
      hasEmptyBlock: false,
      showingEmpty: false,
      rootIds: [],
    },
  ],
};

const malformed: [string, Record<string, unknown>][] = [
  ['a null root', { roots: [null] }],
  ['a number root', { roots: [1] }],
  ['an empty root', { roots: [{}] }],
  [
    'a child that is not a node',
    { roots: [{ id: 'x', name: 'X', tag: 'x', children: [null, 3] }] },
  ],
  ['children that are not a list', { roots: [{ id: 'x', name: 'X', tag: 'x', children: 'no' }] }],
  ['a broken detail', { roots: [], detail: { id: 'x', inputs: 'no', directives: [null] } }],
  [
    'broken defer blocks',
    { roots: [], deferBlocks: [null, { id: 'd', triggers: 'no', owner: null }] },
  ],
  ['broken for blocks', { roots: [], forBlocks: [null, { id: 'f', owner: 3, rootIds: null }] }],
];

describe('malformed component reports', () => {
  it.each(malformed)('one page with %s breaks no tool for the other pages', async (_, bad) => {
    const { push, tool } = await boot();
    await push('push-component-tree', good);
    await push('push-component-tree', { pageId: 'bad', count: 0, detail: null, ...bad });
    for (const name of ['list-components', 'snapshot', 'defer-blocks', 'for-blocks']) {
      await expect(tool(name), name).resolves.toEqual(expect.any(String));
      await expect(tool(name, { page: 'good' }), name).resolves.toEqual(expect.any(String));
      await expect(tool(name, { page: 'bad' }), name).resolves.toEqual(expect.any(String));
    }
    expect(await tool('list-components', { page: 'good' })).toMatch(/App/);
  });

  it('keeps the good nodes of a tree and drops the bad ones', () => {
    const page = toComponentPage({
      pageId: 'p',
      count: 2,
      detail: null,
      roots: [
        null,
        {
          id: 'c1',
          name: 'App',
          tag: 'app-root',
          children: [7, { id: 'c2', name: 'Card', tag: 'app-card' }],
        },
      ] as never,
      deferBlocks: [null, good.deferBlocks[0], { id: 'd2', triggers: 'x' }] as never,
      forBlocks: [{ id: 'f2', owner: 'App', count: 'many', track: 'oops' }] as never,
    });
    expect(page.roots).toEqual([
      {
        id: 'c1',
        name: 'App',
        tag: 'app-root',
        children: [{ id: 'c2', name: 'Card', tag: 'app-card', children: [] }],
      },
    ]);
    expect(page.deferBlocks?.map((block) => block.id)).toEqual(['d1', 'd2']);
    expect(page.deferBlocks?.[1]).toMatchObject({ triggers: [], rootIds: [], state: 'unknown' });
    expect(page.forBlocks).toEqual([
      {
        id: 'f2',
        count: 0,
        track: null,
        hasEmptyBlock: false,
        showingEmpty: false,
        rootIds: [],
      },
    ]);
  });
});

describe('page requests with no page to answer', () => {
  it('answer at once instead of waiting for a page', async () => {
    const { push } = await boot();
    const started = Date.now();
    const router = (await push('request-router-action', {
      request: { action: 'navigate', url: '/x' },
    })) as {
      error?: string;
    };
    expect(router.error).toMatch(/No page is connected/);
    const named = (await push('request-router-action', {
      pageId: 'gone',
      request: { action: 'navigate', url: '/x' },
    })) as { error?: string };
    expect(named.error).toMatch(/Page `gone` is not connected/);
    const ngrx = (await push('request-ngrx-action', {
      pageId: 'gone',
      request: { type: 'dispatch', action: { type: 'x' } },
    })) as { error?: string };
    expect(ngrx.error).toMatch(/Page `gone` reports no NgRx state/);
    const pick = (await push('request-component-pick', { pageId: 'gone' })) as { error?: string };
    expect(pick.error).toMatch(/No page is connected/);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
