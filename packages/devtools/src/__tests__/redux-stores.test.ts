// @vitest-environment jsdom
import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import pangular, { createPangular } from '../devframe.ts';
import { setRedaction } from '../forms-privacy.ts';
import { installReduxDevtoolsHook, REDUX_EXTENSION_KEY } from '../redux-devtools-hook.ts';
import { attachReduxStores, createReduxStoresCollector } from '../redux-stores-collector.ts';
import type { ReduxStoresReport, ReduxStoresState } from '../redux-stores-shared.ts';
import {
  inspectReduxStoresText,
  mergeReduxStoresReport,
  staleReduxStoresPages,
  toReduxStoresReport,
} from '../rpc/redux-stores-tools.ts';

type Target = Record<PropertyKey, any>;

afterEach(() => {
  vi.useRealTimers();
  setRedaction({});
});

async function boot(definition = pangular) {
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
    ((await ctx.agent.invoke(`pangular:${id}`, args)) as { markdown: string }).markdown;
  const state = async () =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: { get: (key: string) => Promise<{ value: () => ReduxStoresState }> };
        }
      ).sharedState.get('pangular:redux-stores')
    ).value();
  return { ctx, call, invoke, state };
}

const report = (extra: Partial<ReduxStoresReport> = {}): ReduxStoresReport => ({
  pageId: 'tab1',
  url: '/trips',
  title: 'Trips',
  stores: [
    { id: 'r1', name: 'NGXS', library: 'NGXS', state: { trips: { booked: [7] } }, actions: 2 },
  ],
  log: [
    { seq: 1, storeId: 'r1', type: '@@INIT', timestamp: 1, diff: [] },
    {
      seq: 2,
      storeId: 'r1',
      type: '[Trips] Book',
      action: { type: '[Trips] Book', id: 7 },
      timestamp: 2,
      diff: [{ path: 'trips.booked[0]', op: 'add', after: 7 }],
    },
  ],
  since: 0,
  ...extra,
});

describe('the other stores collector', () => {
  it('diffs each action against the state before it, with the configured secret names', () => {
    setRedaction({ secretNames: ['passport'] });
    const target: Target = {};
    const hook = installReduxDevtoolsHook(target)!;
    const devtools = target[REDUX_EXTENSION_KEY].connect({ name: 'Travel' });
    const before = { traveler: { name: 'Ada', passport: 'X1' }, trips: [1] };
    devtools.init(before);
    devtools.send({ type: 'rename' }, { ...before, traveler: { name: 'Bo', passport: 'X2' } });
    const collector = createReduxStoresCollector(hook, 200);
    collector.read();
    expect(collector.stores()[0].state).toEqual({
      traveler: { name: 'Bo', passport: '[redacted]' },
      trips: [1],
    });
    const [init, rename] = collector.logSince(0);
    expect(init).toMatchObject({ seq: 1, storeId: 'r1', type: '@@INIT', diff: [] });
    expect(init.action).toBeUndefined();
    expect(rename.diff).toEqual([
      { path: 'traveler.name', op: 'change', before: 'Ada', after: 'Bo' },
      { path: 'traveler.passport', op: 'change', before: '[redacted]', after: '[redacted]' },
    ]);
    // Read entries leave the hook, so raw states are not held twice.
    expect(hook.connections[0].pending).toEqual([]);
  });

  it('keeps the last maxLog entries', () => {
    const target: Target = {};
    const hook = installReduxDevtoolsHook(target)!;
    const devtools = target[REDUX_EXTENSION_KEY].connect({});
    for (let i = 0; i < 12; i++) devtools.send({ type: `t${i}` }, { i });
    const collector = createReduxStoresCollector(hook, 10);
    collector.read();
    expect(collector.logSince(0).map((e) => e.seq)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('pushes with the page id, skips unchanged reports and sends the log again when the server forgot it', async () => {
    vi.useFakeTimers();
    const target: Target = {};
    const reports: ReduxStoresReport[] = [];
    let answer = (r: ReduxStoresReport) => r.log.at(-1)?.seq ?? r.since;
    const my = {
      rpc: {
        call: vi.fn(async (name: string, value: unknown) => {
          if (name !== 'push-redux-stores') return undefined;
          reports.push(value as ReduxStoresReport);
          return { seq: answer(value as ReduxStoresReport) };
        }),
      },
    };
    const stores = attachReduxStores(my, 'tab1', {
      maxLog: 200,
      target,
      describe: () => ({ url: '/trips', title: 'Trips' }),
    })!;
    await stores.push();
    expect(reports).toEqual([]);

    const devtools = target[REDUX_EXTENSION_KEY].connect({ name: 'Elf' });
    devtools.send({ type: '[Trips] - @Init' }, { trips: [] });
    await vi.advanceTimersByTimeAsync(60);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ pageId: 'tab1', url: '/trips', since: 0 });
    expect(reports[0].log.map((e) => e.seq)).toEqual([1]);

    await stores.push();
    expect(reports).toHaveLength(1);

    // The server lost the page: it answers 0, and the page sends its log again.
    answer = () => 0;
    devtools.send({ type: '[Trips] - Update' }, { trips: [1] });
    await vi.advanceTimersByTimeAsync(60);
    answer = (r) => r.log.at(-1)?.seq ?? r.since;
    await vi.advanceTimersByTimeAsync(60);
    expect(reports.at(-1)).toMatchObject({ since: 0 });
    expect(reports.at(-1)!.log.map((e) => e.seq)).toEqual([1, 2]);

    stores.leave();
    expect(my.rpc.call).toHaveBeenCalledWith('forget-redux-stores-page', 'tab1');
    stores.stop();
  });
});

describe('the other stores on the server', () => {
  it('masks what the page sends and drops malformed stores and entries', () => {
    const jwt = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxIn0', 'c2lnbmF0dXJl'].join('.');
    const checked = toReduxStoresReport({
      ...report(),
      url: `/trips?token=${jwt}`,
      stores: [...report().stores, { id: 5 }],
      log: [...report().log, { seq: 'x' }, { ...report().log[1], seq: 3, type: `Bearer ${jwt}` }],
    })!;
    expect(checked.url).not.toContain(jwt);
    expect(checked.stores).toHaveLength(1);
    expect(checked.log.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(checked.log[2].type).not.toContain(jwt);
    expect(toReduxStoresReport({ pageId: 'tab1' })).toBeNull();
  });

  it('appends only new entries, asks a forgotten page for its log, and starts over after a reload', () => {
    const state: ReduxStoresState = { pages: {} };
    expect(mergeReduxStoresReport(state, report({ since: 2, log: [] }), 200)).toBe(0);
    expect(mergeReduxStoresReport(state, report(), 200)).toBe(2);
    const next = report({
      since: 2,
      log: [{ seq: 3, storeId: 'r1', type: 'x', timestamp: 3, diff: [] }],
    });
    expect(mergeReduxStoresReport(state, next, 2)).toBe(3);
    expect(state.pages['tab1'].log.map((e) => e.seq)).toEqual([2, 3]);
    expect(state.pages['tab1'].dropped).toBe(1);
    // A reload starts at seq 1 with since 0.
    mergeReduxStoresReport(state, report({ log: [report().log[0]] }), 200);
    expect(state.pages['tab1'].log.map((e) => e.seq)).toEqual([1]);
    expect(staleReduxStoresPages(state, Date.now() + 20_000, () => 15_000)).toEqual(['tab1']);
  });

  it('keeps one entry per page, forgets a page, and answers inspect-redux-stores', async () => {
    const { call, invoke, state } = await boot();
    expect(await invoke('inspect-redux-stores')).toMatch(/No page reports a store/);
    expect(await call('push-redux-stores', report())).toEqual({ seq: 2 });
    await call('push-redux-stores', report({ pageId: 'tab2', url: '/about' }));
    expect(Object.keys((await state()).pages).sort()).toEqual(['tab1', 'tab2']);
    await call('forget-redux-stores-page', 'tab2');
    expect(Object.keys((await state()).pages)).toEqual(['tab1']);

    const text = await invoke('inspect-redux-stores');
    expect(text).toMatch(/come from the running page/);
    expect(text).toMatch(/## NGXS \(`r1`, NGXS\)/);
    expect(text).toMatch(/#2 `\[Trips\] Book`/);
    expect(text).toMatch(/add `trips.booked\[0\]` → 7/);
    expect(await invoke('inspect-redux-stores', { store: 'nope' })).toMatch(/No store `nope`/);
    expect(await invoke('inspect-redux-stores', { page: 'nope' })).toMatch(/No page `nope`/);
    expect(await invoke('list-pages')).toMatch(/ngrx/);
  });

  it('lists several stores as a table', () => {
    const two = report({
      stores: [
        ...report().stores,
        { id: 'r2', name: 'Travel | Elf', library: 'Elf', state: {}, actions: 1 },
      ],
    });
    const text = inspectReduxStoresText({ pages: { tab1: { ...two, reportedAt: 1 } } });
    expect(text).toMatch(/\| Travel \\\| Elf \| `r2` \| Elf \| 1 \|/);
    expect(text).toMatch(/Pass `store`/);
  });

  it('goes away with the NgRx inspector', async () => {
    const { ctx } = await boot(createPangular({ inspectors: { ngrx: false } }));
    const tools = ctx.agent.list().tools.map((tool: { id: string }) => tool.id);
    expect(tools).not.toContain('pangular:inspect-redux-stores');
    await expect(
      ctx.rpc.invokeLocal('pangular:push-redux-stores' as never, ...([report()] as never)),
    ).rejects.toThrow();
  });
});
