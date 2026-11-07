import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import pangular, { createPangular } from '../devframe.ts';
import { stalePerfPages, toPerfPage, webVitalsText, type PerfState } from '../rpc/perf-register.ts';
import { answerText } from './tool-answer.ts';

const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');

const report = (extra: Record<string, unknown> = {}) => ({
  pageId: 'tab1',
  url: '/trips',
  title: 'Trips',
  metrics: {
    LCP: {
      value: 3100,
      rating: 'good',
      target: 'img#hero',
      owner: { id: 'c1-2', name: 'TripCard' },
      at: 3100,
    },
    CLS: { value: 0.02, rating: 'good' },
    INP: { value: 240, rating: 'needs-improvement', event: 'click', target: 'button#book' },
  },
  interactions: [{ event: 'click', durationMs: 240, at: 5000, target: 'button#book' }],
  longTasks: [{ at: 100, durationMs: 120, kind: 'longtask' }],
  longTaskCount: 1,
  totalBlockingMs: 70,
  supported: ['largest-contentful-paint', 'layout-shift', 'event', 'longtask', 'bogus'],
  ...extra,
});

describe('toPerfPage', () => {
  it('keeps a valid report, rates it on the server and masks text', () => {
    const page = toPerfPage(report({ url: `/trips?token=${JWT}` }), 42)!;
    // The page said good; 3.1 s is not.
    expect(page.metrics.LCP!.rating).toBe('needs-improvement');
    expect(page.url).not.toContain(JWT);
    expect(page.supported).toEqual([
      'largest-contentful-paint',
      'layout-shift',
      'event',
      'longtask',
    ]);
    expect(page.reportedAt).toBe(42);
  });

  it('drops bad values and refuses a report without a page id', () => {
    expect(toPerfPage({})).toBeNull();
    expect(toPerfPage(report({ pageId: 'x'.repeat(60) }))).toBeNull();
    const page = toPerfPage(
      report({
        metrics: { LCP: { value: -5 }, CLS: { value: 'big' }, FCP: { value: 900 } },
        interactions: [null, { event: 'click' }],
        longTasks: 'none',
        longTaskCount: -1,
      }),
    )!;
    expect(Object.keys(page.metrics)).toEqual(['FCP']);
    expect(page.interactions).toEqual([]);
    expect(page.longTasks).toEqual([]);
    expect(page.longTaskCount).toBe(0);
  });

  it('expires pages past their TTL', () => {
    const state: PerfState = { pages: { tab1: toPerfPage(report(), 1000)! } };
    expect(stalePerfPages(state, 20_000, () => 30_000)).toEqual([]);
    expect(stalePerfPages(state, 40_000, () => 30_000)).toEqual(['tab1']);
  });
});

describe('web-vitals text', () => {
  it('lists each metric with rating and where it happened', () => {
    const state: PerfState = { pages: { tab1: toPerfPage(report())! } };
    const text = webVitalsText(state);
    expect(text).toContain('| Largest Contentful Paint (LCP) | 3.10 s | needs improvement |');
    expect(text).toContain('`TripCard`');
    expect(text).toContain('| First Contentful Paint (FCP) | none yet |');
    expect(text).toContain('Long tasks: 1, total blocking time 70 ms.');
    expect(webVitalsText({ pages: {} })).toMatch(/^No page reports web vitals/);
    expect(webVitalsText(state, { page: 'gone' })).toContain('gone');
  });
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
    (ctx.rpc.invokeLocal as (name: string, payload: unknown) => Promise<unknown>)(
      `pangular:${name}`,
      payload,
    );
  const invoke = async (id: string, args: Record<string, unknown> = {}) =>
    await answerText(ctx.agent.invoke(`pangular:${id}`, args));
  const state = async () =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: { get: (key: string) => Promise<{ value: () => PerfState }> };
        }
      ).sharedState.get('pangular:performance')
    ).value();
  return { ctx, call, invoke, state };
}

describe('performance on the devframe server', () => {
  it('keeps one entry per page, answers web-vitals and forgets a page', async () => {
    const { call, invoke, state } = await boot();
    await call('push-performance', report());
    await call('push-performance', report({ pageId: 'tab2', url: '/other' }));
    expect(Object.keys((await state()).pages).sort()).toEqual(['tab1', 'tab2']);
    expect(await invoke('web-vitals', { page: 'tab2' })).toContain('/other');
    await call('forget-performance-page', 'tab1');
    expect(Object.keys((await state()).pages)).toEqual(['tab2']);
  });

  it('is a read tool that disappears with the performance inspector', async () => {
    const { ctx } = await boot();
    expect(ctx.agent.list().tools.find((t) => t.id === 'pangular:web-vitals')?.safety).toBe('read');
    const off = await boot(createPangular({ inspectors: { performance: false } }));
    expect(off.ctx.agent.list().tools.map((t) => t.id)).not.toContain('pangular:web-vitals');
    await expect(off.call('push-performance', report())).rejects.toThrow();
  });
});
