import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ngDevtools from '../devframe.ts';
import { HIDDEN_PAGE_TTL_MS, createPageVisibility } from '../rpc/page-ttl.ts';

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
  const state = async (key: string) =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: {
            get: (key: string) => Promise<{ value: () => Record<string, unknown> }>;
          };
        }
      ).sharedState.get(`ng-devtools:${key}`)
    ).value();
  const report = async () => {
    await push('push-http', { pageId: 'p1', url: '/', payload: null, calls: [] });
    await push('push-signal-graph', { pageId: 'p1', nodes: [], edges: [] });
    await push('push-component-tree', { pageId: 'p1', roots: [], count: 0, detail: null });
  };
  const shown = async () => ({
    http: ((await state('http'))['pages'] as { pageId: string }[]).map((p) => p.pageId),
    signals: Object.keys((await state('signal-graph'))['pages'] as object),
    components: Object.keys((await state('component-tree'))['pages'] as object),
  });
  return { push, state, report, shown };
}

const all = { http: ['p1'], signals: ['p1'], components: ['p1'] };
const none = { http: [], signals: [], components: [] };

describe('pages in a background tab', () => {
  afterEach(() => vi.useRealTimers());

  it('drop a visible page that stopped reporting', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const { report, shown } = await boot();
    await report();
    expect(await shown()).toEqual(all);
    vi.advanceTimersByTime(20_000);
    expect(await shown()).toEqual(none);
  });

  it('keep the last data of a hidden tab and list it as hidden', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const { push, state, report, shown } = await boot();
    await report();
    await push('report-page-visibility', { pageId: 'p1', hidden: true });
    expect(await state('page-visibility')).toEqual({ hidden: ['p1'] });

    for (let minute = 0; minute < 10; minute++) {
      vi.advanceTimersByTime(60_000);
      await push('report-page-visibility', { pageId: 'p1', hidden: true });
    }
    expect(await shown()).toEqual(all);

    await push('report-page-visibility', { pageId: 'p1', hidden: false });
    expect(await state('page-visibility')).toEqual({ hidden: [] });
    await report();
    vi.advanceTimersByTime(20_000);
    expect(await shown()).toEqual(none);
  });

  it('drop a hidden tab that stopped saying it is there', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const { push, state, report, shown } = await boot();
    await report();
    await push('report-page-visibility', { pageId: 'p1', hidden: true });
    vi.advanceTimersByTime(HIDDEN_PAGE_TTL_MS + 10_000);
    expect(await state('page-visibility')).toEqual({ hidden: [] });
    expect(await shown()).toEqual(none);
  });

  it('track hidden marks by page', () => {
    const visibility = createPageVisibility();
    expect(visibility.set('p1', true, 0)).toBe(true);
    expect(visibility.set('p1', true, 10)).toBe(false);
    expect(visibility.ttl(15_000)('p1')).toBe(Infinity);
    expect(visibility.ttl(15_000)('p2')).toBe(15_000);
    expect(visibility.expire(HIDDEN_PAGE_TTL_MS + 11)).toBe(true);
    expect(visibility.list()).toEqual([]);
  });
});
