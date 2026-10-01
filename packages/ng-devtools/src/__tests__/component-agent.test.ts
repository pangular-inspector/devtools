import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import ngDevtools from '../devframe.ts';
import type { ComponentDetail, LiveComponentNode } from '../types.ts';

async function boot() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await ngDevtools.setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`ng-devtools:${name}` as never, ...([payload] as never));
  const call = async (tool: string, args: Record<string, unknown>) =>
    ((await ctx.agent.invoke(`ng-devtools:${tool}`, args)) as { markdown: string }).markdown;
  const selectedId = async () =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: { get: (key: string) => Promise<{ value: () => { selectedId: unknown } }> };
        }
      ).sharedState.get('ng-devtools:component-tree')
    ).value().selectedId;
  return { ctx, push, call, selectedId };
}

const card = (id: string): LiveComponentNode => ({
  id,
  name: 'Card',
  tag: 'app-card',
  children: [],
});
const roots = [{ id: 'c1', name: 'App', tag: 'app-root', children: [card('c2'), card('c3')] }];
const detailOf = (id: string): ComponentDetail => ({
  id,
  name: 'Card',
  tag: 'app-card',
  path: 'app-root > app-card',
  inputs: [{ name: 'title', prop: 'title', value: 'Rome' }],
  outputs: [],
  properties: [{ name: 'loading', prop: 'loading', value: false, kind: 'signal' }],
  listeners: [],
  directives: [],
  dependencies: [],
});

type Broadcast = { method: string; args: [Record<string, unknown>] };

describe('component agent tools', () => {
  it('highlight selects the instance it found and lists every match', async () => {
    const { ctx, push, call, selectedId } = await boot();
    await push('push-component-tree', { pageId: 'p1', roots, count: 3, detail: null });
    const sent: Broadcast[] = [];
    vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: Broadcast) => {
      sent.push(options);
    }) as never);

    const text = await call('highlight', { selector: 'Card' });
    expect(text).toMatch(/instance `c2` on page `p1`\) and selected it/);
    expect(text).toContain('2 instances match `Card`: `c2`, `c3`');
    expect(sent.find((b) => b.method.endsWith('inspect-component-in-page'))?.args[0]).toEqual({
      pageId: 'p1',
      id: 'c2',
    });
    expect(await selectedId()).toBe('c2');

    expect(await call('highlight', { selector: 'c3' })).not.toMatch(/instances match/);
    expect(await selectedId()).toBe('c3');

    sent.length = 0;
    expect(await call('highlight', { selector: '.promo' })).toMatch(/selection did not change/);
    expect(sent.some((b) => b.method.endsWith('inspect-component-in-page'))).toBe(false);
    expect(await selectedId()).toBe('c3');
  });

  it('inspect-component selects the instance and answers with the detail the page reports', async () => {
    const { ctx, push, call } = await boot();
    await push('push-component-tree', { pageId: 'p1', roots, count: 3, detail: null });
    vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: Broadcast) => {
      if (!options.method.endsWith('inspect-component-in-page')) return;
      const { pageId, id } = options.args[0] as { pageId: string; id: string };
      setTimeout(
        () => void push('push-component-tree', { pageId, roots, count: 3, detail: detailOf(id) }),
        10,
      );
    }) as never);

    const text = await call('inspect-component', { selector: 'c3' });
    const json = JSON.parse(text.slice(text.indexOf('{')));
    expect(json).toMatchObject({ id: 'c3', properties: [{ name: 'loading', kind: 'signal' }] });
    expect(text).not.toMatch(/instances match/);

    const again = await call('inspect-component', { selector: 'app-card' });
    expect(again).toContain('instance `c2`');
    expect(again).toContain('2 instances match `app-card`');
  });

  it('inspect-component says when nothing matches or the page does not answer', async () => {
    const { ctx, push, call } = await boot();
    expect(await call('inspect-component', { selector: 'Card' })).toMatch(
      /no component tree has been reported/i,
    );
    await push('push-component-tree', { pageId: 'p1', roots, count: 3, detail: null });
    vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async () => {}) as never);
    expect(await call('inspect-component', { selector: 'Missing' })).toMatch(
      /no component instance matches `Missing`/i,
    );
    vi.useFakeTimers();
    try {
      const pending = call('inspect-component', { selector: 'c2' });
      await vi.advanceTimersByTimeAsync(3100);
      expect(await pending).toMatch(/did not report its detail/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('says a component may be past the cap when the tree is truncated', async () => {
    const { ctx, push, call } = await boot();
    vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async () => {}) as never);
    await push('push-component-tree', {
      pageId: 'p1',
      roots,
      count: 2000,
      truncated: true,
      truncatedBy: { components: 2000, depth: 'x' },
      detail: null,
    });
    const state = (
      await (
        ctx.rpc as unknown as {
          sharedState: { get: (key: string) => Promise<{ value: () => unknown }> };
        }
      ).sharedState.get('ng-devtools:component-tree')
    ).value() as { pages: Record<string, unknown> };
    expect(state.pages['p1']).toMatchObject({ truncated: true, truncatedBy: { components: 2000 } });
    expect(state.pages['p1']).not.toHaveProperty('truncatedBy.depth');
    const note =
      'stops at the first 2000 component instances, so instances past it are not listed or searchable';
    expect(await call('inspect-component', { selector: 'Missing' })).toContain(note);
    expect(await call('highlight', { selector: '.missing' })).toContain(note);
    expect(await call('inspect-component', { selector: 'c2', page: 'p1' })).not.toContain(note);
  });

  it('inspect-component and highlight narrow the search to one page', async () => {
    const { ctx, push, call } = await boot();
    await push('push-component-tree', { pageId: 'p1', roots, count: 3, detail: null });
    await push('push-component-tree', {
      pageId: 'p2',
      roots: [{ ...card('d9'), children: [] }],
      count: 1,
      detail: null,
    });
    vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async () => {}) as never);
    const everywhere = await call('highlight', { selector: 'Card' });
    expect(everywhere).toContain('3 instances match `Card`');
    expect(everywhere).toContain('`d9` (page `p2`)');
    expect(await call('highlight', { selector: 'Card', pageId: 'p2' })).toContain(
      'instance `d9` on page `p2`',
    );
    expect(await call('inspect-component', { selector: 'Card', page: 'gone' })).toMatch(
      /^No page `gone` is reporting a component tree\..*`p1`/,
    );
  });
});

describe('defer-blocks tool', () => {
  it('lists the defer blocks each page reported and narrows to one page', async () => {
    const { push, call } = await boot();
    const deferBlock = {
      id: 'd1',
      owner: { id: 'c2', name: 'Card', tag: 'app-card' },
      state: 'error',
      hydration: 'not-configured',
      triggers: ['on viewport'],
      hasErrorBlock: true,
      rootIds: [],
      since: Date.now(),
    };
    await push('push-component-tree', {
      pageId: 'p1',
      roots,
      count: 3,
      detail: null,
      url: 'http://localhost/examples/defer',
      deferBlocks: [deferBlock],
    });
    await push('push-component-tree', { pageId: 'p2', roots, count: 3, detail: null });
    const all = await call('defer-blocks', {});
    expect(all).toContain('Page `p1` (http://localhost/examples/defer): 1 defer block.');
    expect(all).toContain('`d1` in Card (`c2`): failed to load');
    expect(all).toContain('Page `p2`: this page');
    expect(await call('defer-blocks', { pageId: 'p2' })).not.toContain('`p1`');
    expect(await call('defer-blocks', { page: 'p2' })).not.toContain('`p1`');
    expect(await call('defer-blocks', { page: 'gone' })).toMatch(
      /^No page `gone` is reporting a component tree\./,
    );
  });
});

describe('component pick', () => {
  it('refuses to pick when no page is connected', async () => {
    const { push } = await boot();
    expect(await push('request-component-pick', {})).toMatchObject({
      ok: false,
      error: expect.stringMatching(/no page is connected/i),
    });
  });

  it('asks one page to pick and selects what it picked', async () => {
    const { ctx, push, selectedId } = await boot();
    await push('push-component-tree', { pageId: 'p1', roots, count: 3, detail: null });
    await push('push-component-tree', { pageId: 'p2', roots, count: 3, detail: null });
    const asked: unknown[] = [];
    vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: Broadcast) => {
      if (!options.method.endsWith('component-pick')) return;
      const { requestId, pageId } = options.args[0];
      asked.push(pageId);
      await push('component-pick-result', {
        requestId,
        pageId,
        result: { ok: true, id: 'c3', name: 'Card', tag: 'app-card' },
      });
    }) as never);
    expect(await push('request-component-pick', { pageId: 'p1' })).toEqual({
      ok: true,
      id: 'c3',
      name: 'Card',
      tag: 'app-card',
      pageId: 'p1',
    });
    expect(asked).toEqual(['p1']);
    expect(await selectedId()).toBe('c3');
  });

  it('passes a cancel to the page and returns its answer', async () => {
    const { ctx, push } = await boot();
    await push('push-component-tree', { pageId: 'p1', roots, count: 3, detail: null });
    let requestId = '';
    const sent: Broadcast[] = [];
    vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: Broadcast) => {
      sent.push(options);
      if (!options.method.endsWith('component-pick')) return;
      if (options.args[0]['cancel']) {
        await push('component-pick-result', {
          requestId,
          result: { ok: false, error: 'Picking cancelled.' },
        });
      } else {
        requestId = options.args[0]['requestId'] as string;
      }
    }) as never);
    const pending = push('request-component-pick', { pageId: 'p1' });
    await push('cancel-component-pick', { pageId: 'p1' });
    expect(await pending).toMatchObject({ ok: false, error: 'Picking cancelled.' });
    expect(sent.map((b) => b.args[0])).toEqual([
      { requestId, pageId: 'p1' },
      { pageId: 'p1', cancel: true },
    ]);
  });
});
