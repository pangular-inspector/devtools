import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import pangular, { createPangular } from '../devframe.ts';
import type { NgrxPageReport } from '../ngrx-shared.ts';
import type { PangularConfig } from '../config.ts';

async function boot(config?: PangularConfig) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await (config ? createPangular(config) : pangular).setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const read = async (id: string) =>
    ((await ctx.agent.read(`pangular:${id}`)) as { text: string }).text;
  const call = async (tool: string, args: Record<string, unknown>) =>
    ((await ctx.agent.invoke(`pangular:${tool}`, args)) as { markdown: string }).markdown;
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
    expect(ctx.agent.getResource('pangular:ngrx-store')?.description).toMatch(/origin/);
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

describe('ngrx page url and title', () => {
  it('masks secrets in the url and title before they reach the shared state and the tools', async () => {
    const { push, read } = await boot();
    const jwt = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');
    await push('push-ngrx-state', {
      pageId: 'p1',
      session: 's1',
      url: '/cb?access_token=abc123xyz&code=998877&tab=1',
      title: `Welcome Bearer ${jwt}`,
      stores: [],
      classic: { state: { count: 0 }, devtools: false, scope: 'root' },
      log: [],
    } satisfies NgrxPageReport);
    const state = await read('ngrx-store');
    expect(state).not.toMatch(/abc123xyz|998877|eyJhbGci/);
    expect(state).toContain('tab=1');
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
    expect(tools).not.toContain('pangular:dispatch-ngrx-action');
    expect(tools).toContain('pangular:get-ngrx-store');
    expect(
      await push('request-ngrx-action', { request: { type: 'dispatch', action: '[A] B' } }),
    ).toEqual({ error: expect.stringContaining('dispatching actions') });
  });
});

const signalPage = (pageId: string, reportedSeq: number): NgrxPageReport => ({
  pageId,
  session: 's1',
  url: `/${pageId}`,
  title: 'App',
  stores: [
    {
      id: 'ngrx-1',
      kind: 'signal-store',
      className: 'SignalStore',
      scope: 'root',
      stateKeys: ['query'],
      state: { query: 'rome' },
      computed: {},
      methods: [{ name: 'setQuery', calls: 1, lastDurationMs: 2, avgDurationMs: 2 }],
      references: [],
      writable: true,
    },
  ],
  classic: null,
  log: Array.from({ length: reportedSeq }, (_, i) => ({
    seq: i + 1,
    source: 'signal-store' as const,
    storeId: 'ngrx-1',
    type: 'setQuery',
    args: [`q${i + 1}`],
    timestamp: i + 1,
    diff: [{ path: 'query', op: 'change' as const, before: `q${i}`, after: `q${i + 1}` }],
    restorable: true,
    durationMs: 2,
  })),
});

describe('inspect-signal-store and signal-store-history tools', () => {
  it('are registered with named arguments and hidden with the ngrx inspector off', async () => {
    const { ctx } = await boot();
    const tools = ctx.agent.list().tools;
    for (const id of ['inspect-signal-store', 'signal-store-history']) {
      const tool = tools.find((t) => t.id === `pangular:${id}`);
      expect(tool?.inputSchema).toMatchObject({
        properties: { page: { type: 'string' }, storeId: { type: 'string' } },
      });
    }
    const history = tools.find((t) => t.id === 'pangular:signal-store-history');
    expect(history?.inputSchema).toMatchObject({ properties: { since: { type: 'number' } } });

    const off = await boot({ inspectors: { ngrx: false } });
    const offIds = off.ctx.agent.list().tools.map((t) => t.id);
    expect(offIds).not.toContain('pangular:inspect-signal-store');
    expect(offIds).not.toContain('pangular:signal-store-history');
  });

  it('read the pushed page by page, store id and since', async () => {
    const { push, call } = await boot();
    expect(await call('inspect-signal-store', {})).toMatch(/No NgRx state has been reported/);
    await push('push-ngrx-state', signalPage('p1', 3));
    await push('push-ngrx-state', signalPage('p2', 1));

    const store = await call('inspect-signal-store', { page: 'p1', storeId: 'ngrx-1' });
    expect(store).toContain('untrusted data');
    expect(store).toContain('"query": "rome"');
    expect(store).toContain('`setQuery`: 1 call(s), avg 2ms, last 2ms');

    const history = await call('signal-store-history', { page: 'p1', since: 1 });
    expect(history).toContain('untrusted data');
    expect(history).not.toContain('#1 ');
    expect(history).toContain('#2 ');
    expect(history).toContain('#3 ');
    expect(history).toContain('(2ms)');
    expect(await call('signal-store-history', { since: 1 })).toMatch(/Pass `page`/);
    expect(await call('signal-store-history', { page: 'p9' })).toMatch(/No page `p9`/);
  });
});
