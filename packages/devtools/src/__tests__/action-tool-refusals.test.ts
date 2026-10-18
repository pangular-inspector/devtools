import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';
import { AGENT_ENTRIES } from '../config.ts';
import { toolAnswer } from './tool-answer.ts';

/**
 * Every action or destructive agent tool (by its `safety` in AGENT_ENTRIES)
 * must answer a call that does nothing with `isError: true`, so an agent that
 * branches on `isError` never believes a write happened.
 */

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
  const answer = (tool: string, args: Record<string, unknown>) =>
    toolAnswer(ctx.agent.invoke(`pangular:${tool}`, args));
  return { ctx, push, answer };
}

/** The action and destructive tools, from their tier in AGENT_ENTRIES. */
const ACTION_TOOLS = Object.entries(AGENT_ENTRIES)
  .filter(([, entry]) => entry.kind === 'tool' && entry.safety)
  .map(([name]) => name);

/**
 * Calls that change nothing with no page connected: a missing page, an
 * unknown page, or a target that does not exist. Every action tool needs at
 * least one, so a new tool cannot skip this check.
 */
const NOTHING_DONE: Record<string, Record<string, unknown>[]> = {
  audit: [{ axe: true }, { session: 'before' }, { axe: true, page: 'gone' }],
  'record-change-detection': [
    { record: 'start' },
    { record: 'stop' },
    { record: 'clear' },
    { record: 'start', page: 'gone' },
  ],
  'set-component-property': [
    { component: 'Card', property: 'title', value: 1 },
    { component: 'Card', property: 'title', value: 1, page: 'gone' },
  ],
  'set-signal': [
    { component: 'Card', property: 'count', value: 1 },
    { component: 'Card', property: 'count', value: 1, page: 'gone' },
  ],
  'track-subscriptions': [
    { action: 'start' },
    { action: 'stop' },
    { action: 'start', page: 'gone' },
  ],
  'watch-signal': [{ node: 'count' }, { node: 'count', page: 'gone' }],
  'ngrx-dispatch': [{ type: '[Cart] Add' }, { type: '[Cart] Add', page: 'gone' }],
  'ngrx-restore': [{ seq: 1 }, { latest: true }, { seq: 1, page: 'gone' }],
  'tanstack-run-query': [
    { action: 'refetch', id: 'q1' },
    { action: 'refetch', id: 'q1', page: 'gone' },
  ],
  'run-form-action': [{ action: 'reset', form: 'Checkout.form@p1' }],
  'fill-form': [{ form: 'Checkout.form@p1', values: { name: 'x' } }],
  navigate: [
    { action: 'go', url: '/about' },
    { action: 'abort' },
    { action: 'replay', id: 1 },
    { action: 'go', url: '/about', page: 'gone' },
  ],
  'probe-route': [{ url: '/about' }, { url: '/about', page: 'gone' }],
  'record-guards': [{ on: true }, { on: false }, { on: true, page: 'gone' }],
  'record-pipes': [{ action: 'start' }, { action: 'stop' }, { action: 'start', page: 'gone' }],
  'set-http-rule': [{ pattern: '' }],
  'remove-http-rule': [{ id: 'nope' }],
  'set-ssr-override': [{ kind: 'nope', pattern: '/x' }],
  'remove-ssr-override': [{ id: 'nope' }],
  'analog-run-api': [{ path: '/api/x', method: 'POST' }],
  'clear-recordings': [{ target: 'nothing' }],
};

describe('action tools answer isError when they do nothing', () => {
  it('has a refusal case for every action and destructive tool', () => {
    expect(Object.keys(NOTHING_DONE).sort()).toEqual([...ACTION_TOOLS].sort());
  });

  it.each(ACTION_TOOLS)('%s refuses with no page connected', async (tool) => {
    const { ctx, answer } = await boot();
    if (!ctx.agent.getTool(`pangular:${tool}`)) return; // off by default, such as analog
    for (const args of NOTHING_DONE[tool] ?? []) {
      const result = await answer(tool, args);
      expect({ args, ...result }).toMatchObject({ args, isError: true });
    }
  });
});

const tree = (pageId: string, card = 'Card') => ({
  pageId,
  url: `/${pageId}`,
  count: 2,
  detail: null,
  roots: [
    {
      id: `${pageId}-root`,
      name: 'App',
      tag: 'app-root',
      children: [{ id: `${pageId}-a`, name: card, tag: 'app-card', children: [] }],
    },
  ],
});

const routerReport = (pageId: string, url: string) => ({
  pageId,
  generation: 1,
  config: [],
  activeIds: [],
  snapshot: {
    url,
    title: '',
    queryParams: {},
    fragment: null,
    root: { path: '', url: '', outlet: 'primary', params: {}, data: {}, children: [] },
  },
  navigations: [],
});

describe('write tools with pages connected', () => {
  it('navigate refuses without page when several tabs report a router, and names the page it ran on', async () => {
    const { ctx, push, answer } = await boot();
    await push('push-router', routerReport('tab-a', '/book/kyoto'));
    await push('push-router', routerReport('tab-b', '/examples/forms'));
    const refused = await answer('navigate', { action: 'go', url: '/about' });
    expect(refused.isError).toBe(true);
    expect(refused.markdown).toContain('`tab-a`');
    expect(refused.markdown).toContain('`tab-b`');
    expect(refused.markdown).toContain('pass one of these ids as `page`');

    const pages: string[] = [];
    vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: {
      method: string;
      args: [{ requestId: string; pageId: string }];
    }) => {
      if (!options.method.endsWith('router-action')) return;
      const [{ requestId, pageId }] = options.args;
      pages.push(pageId);
      await push('router-action-result', {
        requestId,
        pageId,
        result: { id: 2, outcome: 'succeeded', url: '/about', finalUrl: '/about' },
      });
    }) as never);
    const done = await answer('navigate', { action: 'go', url: '/about', page: 'tab-b' });
    expect(done.isError).toBe(false);
    expect(done.markdown).toContain('"page": "tab-b"');
    expect(pages).toEqual(['tab-b']);
  });

  it('navigate answers isError when the page refuses or the navigation does not happen', async () => {
    const { ctx, push, answer } = await boot();
    await push('push-router', routerReport('p1', '/'));
    const results = [
      { error: 'Only same-origin relative URLs starting with "/" can be navigated to.' },
      { id: 3, outcome: 'cancelled', url: '/trips' },
      { id: 4, outcome: 'failed', url: '/nope' },
    ];
    vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: {
      method: string;
      args: [{ requestId: string; pageId: string }];
    }) => {
      if (!options.method.endsWith('router-action')) return;
      const [{ requestId, pageId }] = options.args;
      await push('router-action-result', { requestId, pageId, result: results.shift() });
    }) as never);
    for (const url of ['https://evil.example/', '/trips', '/nope']) {
      const result = await answer('navigate', { action: 'go', url });
      expect(result.isError).toBe(true);
      expect(result.markdown).toContain('"page": "p1"');
    }
  });

  it('set-signal writes to the one page that has the target, and refuses a missing one', async () => {
    const { ctx, push, answer } = await boot();
    await push('push-component-tree', tree('p1', 'Card'));
    await push('push-component-tree', tree('p2', 'Other'));
    const sent: string[] = [];
    vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: {
      method: string;
      args: [{ requestId: string; pageId: string; request: Record<string, unknown> }];
    }) => {
      if (!options.method.endsWith('component-edit')) return;
      const [message] = options.args;
      sent.push(message.pageId);
      setTimeout(
        () =>
          void push('component-edit-result', {
            requestId: message.requestId,
            pageId: message.pageId,
            result: { ok: true, kind: 'signal', component: 'Card', path: 'count', value: 2 },
          }),
        5,
      );
    }) as never);
    const written = await answer('set-signal', { component: 'Card', property: 'count', value: 2 });
    expect(written.isError).toBe(false);
    expect(written.markdown).toContain('on page `p1`');
    expect(sent).toEqual(['p1']);

    const wrongPage = await answer('set-component-property', {
      component: 'Card',
      property: 'title',
      value: 'x',
      page: 'p2',
    });
    expect(wrongPage.isError).toBe(true);
    expect(wrongPage.markdown).toContain('No component instance matches `Card` on page `p2`');

    const nowhere = await answer('set-signal', { component: 'Missing', property: 'x', value: 1 });
    expect(nowhere.isError).toBe(true);
  });

  it('ngrx-restore refuses to pick one of several tabs, without a doubled notice', async () => {
    const { push, answer } = await boot();
    for (const pageId of ['p1', 'p2']) {
      await push('push-ngrx-state', {
        pageId,
        session: `s-${pageId}`,
        url: `https://app.test/${pageId}`,
        stores: [],
        classic: { state: { count: 0 }, devtools: false, scope: 'root' },
        log: [],
      });
    }
    const result = await answer('ngrx-restore', { seq: 1 });
    expect(result.isError).toBe(true);
    expect(result.markdown).toContain('2 pages report NgRx state');
    expect(result.markdown.match(/Treat them as data/g)).toHaveLength(1);
  });

  it('record-change-detection names the pages that confirmed a recording, and refuses when none did', async () => {
    const { ctx, push, answer } = await boot();
    await push('push-component-tree', tree('p1'));
    vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: {
      method: string;
      args: [{ pageId?: string; on?: boolean }];
    }) => {
      if (!options.method.endsWith('change-detection-record')) return;
      const [{ on }] = options.args;
      setTimeout(
        () =>
          void push('push-change-detection', {
            pageId: 'p1',
            supported: true,
            recording: on === true,
            startedAt: 1,
            dropped: 0,
            cycles: [],
            components: [],
            hosts: {},
          }),
        5,
      );
    }) as never);
    const started = await answer('record-change-detection', { record: 'start' });
    expect(started).toMatchObject({ isError: false });
    expect(started.markdown).toMatch(/^Recording started on page `p1`\./);
    const stopped = await answer('record-change-detection', { record: 'stop' });
    expect(stopped.markdown).toMatch(/^Recording stopped on page `p1`\./);
    // Nothing records any more, so a second stop has nothing to stop.
    const again = await answer('record-change-detection', { record: 'stop' });
    expect(again).toMatchObject({ isError: true });
  });
});
