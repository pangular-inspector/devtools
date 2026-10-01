import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import ngDevtools, { createNgDevtools } from '../devframe.ts';
import type { NgrxPageReport } from '../ngrx-shared.ts';
import type { NgDevtoolsConfig } from '../config.ts';

async function boot(config?: NgDevtoolsConfig) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await (config ? createNgDevtools(config) : ngDevtools).setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`ng-devtools:${name}` as never, ...([payload] as never));
  const read = async (id: string) =>
    ((await ctx.agent.read(`ng-devtools:${id}`)) as { text: string }).text;
  const call = async (tool: string, args: Record<string, unknown>) =>
    ((await ctx.agent.invoke(`ng-devtools:${tool}`, args)) as { markdown: string }).markdown;
  return { ctx, push, read, call };
}

const entry = (seq: number, type: string, origin: 'dispatch' | 'effect' | 'reactive') => ({
  seq,
  source: 'store' as const,
  storeId: 'store',
  type,
  action: { type },
  origin,
  timestamp: seq,
  diff: [],
  restorable: false,
});

describe('ngrx-store resource', () => {
  it('lists where each classic store action came from', async () => {
    const { push, read, ctx } = await boot();
    expect(ctx.agent.getResource('ng-devtools:ngrx-store')?.description).toMatch(/origin/);
    const report: NgrxPageReport = {
      pageId: 'p1',
      session: 's1',
      url: '/',
      title: 'App',
      stores: [],
      classic: { state: { count: 0 }, devtools: false, scope: 'root' },
      log: [
        entry(1, '[Todos] Load', 'dispatch'),
        entry(2, '[Todos] Loaded', 'effect'),
        entry(3, '[Todos] Filter', 'reactive'),
      ],
    };
    await push('push-ngrx-state', report);
    const state = JSON.parse(await read('ngrx-store'));
    expect(
      state.pages[0].log.map((e: { type: string; origin: string }) => [e.type, e.origin]),
    ).toEqual([
      ['[Todos] Load', 'dispatch'],
      ['[Todos] Loaded', 'effect'],
      ['[Todos] Filter', 'reactive'],
    ]);
  });
});

type Broadcast = {
  method: string;
  args: [{ requestId: string; pageId: string; request: unknown }];
};

const page = (pageId: string, classic: boolean): NgrxPageReport => ({
  pageId,
  session: 's1',
  url: '/',
  title: 'App',
  stores: [],
  classic: classic ? { state: { count: 0 }, devtools: false, scope: 'root' } : null,
  log: [],
});

describe('dispatch-ngrx-action tool', () => {
  it('sends the action to the page with a Store and returns the log entry', async () => {
    const { ctx, push, call } = await boot();
    await push('push-ngrx-state', page('p1', true));
    await push('push-ngrx-state', page('p2', false));
    const sent: Broadcast[] = [];
    vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: Broadcast) => {
      if (!options.method.endsWith('ngrx-action')) return;
      sent.push(options);
      const { requestId } = options.args[0];
      const result = {
        ok: true,
        message: 'Dispatched [Cart] Add Item as #4.',
        entry: {
          ...entry(4, '[Cart] Add Item', 'dispatch'),
          action: { type: '[Cart] Add Item', id: 7 },
        },
      };
      setTimeout(() => void push('ngrx-action-result', { requestId, result }), 5);
    }) as never);

    const text = await call('dispatch-ngrx-action', {
      type: '[Cart] Add Item',
      payload: { id: 7 },
    });
    expect(sent[0].args[0]).toMatchObject({
      pageId: 'p1',
      request: { type: 'dispatch', action: '[Cart] Add Item', payload: { id: 7 } },
    });
    expect(text).toContain('Dispatched [Cart] Add Item as #4.');
    expect(text).toContain('untrusted data');
    expect(text).toContain('"id": 7');

    await call('dispatch-ngrx-action', { seq: 4 });
    expect(sent[1].args[0].request).toEqual({ type: 'dispatch-again', seq: 4 });
  });

  it('checks the page, the Store and the action before it sends anything', async () => {
    const { ctx, push, call } = await boot();
    const broadcast = vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async () => {}) as never);
    expect(await call('dispatch-ngrx-action', { type: '[A] B' })).toMatch(
      /No connected page has an @ngrx\/store Store/,
    );
    await push('push-ngrx-state', page('p1', true));
    await push('push-ngrx-state', page('p2', false));
    expect(await call('dispatch-ngrx-action', { page: 'p2', type: '[A] B' })).toMatch(
      /`p2` has no @ngrx\/store Store/,
    );
    expect(await call('dispatch-ngrx-action', { page: 'p9', type: '[A] B' })).toMatch(
      /No page `p9`/,
    );
    expect(await call('dispatch-ngrx-action', { type: '' })).toMatch(/non-empty string/);
    expect(await call('dispatch-ngrx-action', { type: '[A] B', payload: { type: 'x' } })).toMatch(
      /"type" key/,
    );
    expect(await call('dispatch-ngrx-action', { seq: 'x' })).toMatch(/log entry number/);
    expect(
      broadcast.mock.calls.filter(([o]) =>
        (o as unknown as Broadcast).method.endsWith('ngrx-action'),
      ),
    ).toEqual([]);
  });

  it('is left out when the ngrx write action is off, and the RPC refuses dispatches', async () => {
    const { ctx, push } = await boot({ actions: { ngrx: false } });
    const tools = ctx.agent.list().tools.map((tool) => tool.id);
    expect(tools).not.toContain('ng-devtools:dispatch-ngrx-action');
    expect(tools).toContain('ng-devtools:get-ngrx-store');
    expect(
      await push('request-ngrx-action', { request: { type: 'dispatch', action: '[A] B' } }),
    ).toEqual({ error: expect.stringContaining('dispatching actions') });
  });
});
