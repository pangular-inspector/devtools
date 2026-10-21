import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';
import { createPageHeartbeats } from '../rpc/page-heartbeats.ts';
import { PAGE_TTL_MS, createPageVisibility } from '../rpc/page-ttl.ts';
import { PAGE_HEARTBEAT_MS } from '../page-heartbeat.ts';
import { expirePages, mergePageReport } from '../rpc/forms-tools.ts';
import { expireRouterPages } from '../rpc/router-tools.ts';

// The page heartbeat on the server: while a page beats, none of its reports
// expire, however long ago it sent them. Without beats they expire as before.

const STATES = [
  'component-tree',
  'signal-graph',
  'http',
  'errors',
  'forms',
  'router',
  'ngrx-store',
  'page-angular',
] as const;

async function boot() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await pangular.setup(ctx as never);
  const call = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never)) as Promise<unknown>;
  const state = async (key: string) =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: { get: (key: string) => Promise<{ value: () => unknown }> };
        }
      ).sharedState.get(`pangular:${key}`)
    ).value();
  /** The shared states that still hold the page. */
  const holding = async (pageId: string) => {
    const held: string[] = [];
    for (const key of STATES) {
      if (JSON.stringify(await state(key)).includes(pageId)) held.push(key);
    }
    return held;
  };
  return { call, holding };
}

async function reportEverything(call: (name: string, payload: unknown) => Promise<unknown>) {
  const pageId = 'tab1';
  await call('claim-page', { pageId, key: 'secret' });
  await call('push-component-tree', {
    pageId,
    url: 'http://localhost:4200/',
    title: 'Home',
    roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
    count: 1,
    detail: null,
  });
  await call('push-signal-graph', { pageId, nodes: [], edges: [] });
  await call('push-http', { pageId, url: '/', payload: null, calls: [] });
  await call('push-errors', {
    pageId,
    full: true,
    url: '/',
    title: 'Home',
    handler: 'wrapped',
    errors: [],
    console: [],
    dropped: { errors: 0, console: 0 },
  });
  await call('push-forms', { pageId, forms: [], events: [] });
  await call('push-router', {
    pageId,
    generation: 1,
    snapshot: {
      url: '/',
      queryParams: {},
      fragment: null,
      root: { path: '', url: '', outlet: 'primary', params: {}, data: {}, children: [] },
    },
    navigations: [
      { id: 1, url: '/', trigger: 'imperative', startedAt: 1, endedAt: 2, outcome: 'succeeded' },
    ],
  });
  await call('push-ngrx-state', {
    pageId,
    session: 's1',
    url: '/',
    stores: [],
    classic: { state: { cart: 1 }, devtools: false, scope: 'root' },
    log: [],
  });
  await call('report-page-angular', { pageId, version: '22.0.0', api: {} });
}

describe('page heartbeat on the server', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps every report of a page that beats, and drops them once it stops', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const { call, holding } = await boot();
    await reportEverything(call);
    const reported = await holding('tab1');
    expect(reported).toEqual([...STATES]);

    // Several times the page expiry, which every store shares.
    const idleMs = 5 * PAGE_TTL_MS;
    for (let at = 0; at < idleMs; at += PAGE_HEARTBEAT_MS) {
      vi.advanceTimersByTime(PAGE_HEARTBEAT_MS);
      expect(await call('page-heartbeat', { pageId: 'tab1' })).toMatchObject({ known: true });
    }
    expect(await holding('tab1')).toEqual(reported);

    // The tab died without a word (#422): every report, the forms timeline and
    // the router history included, goes with the one expiry, counted from the
    // last beat, plus one 5 s sweep.
    vi.advanceTimersByTime(PAGE_TTL_MS - 1000);
    expect(await holding('tab1')).toEqual(reported);
    vi.advanceTimersByTime(6000);
    expect(await holding('tab1')).toEqual([]);
    // Its next beat says the server lost it, so it sends everything again.
    expect(await call('page-heartbeat', { pageId: 'tab1' })).toMatchObject({ known: false });
  });

  it('answers with the activity lease, so an idle page needs no other call', async () => {
    const { call } = await boot();
    const answer = (await call('page-heartbeat', { pageId: 'tab1' })) as Record<string, unknown>;
    expect(typeof answer['watching']).toBe('boolean');
    // A page the server never heard from is not known.
    expect(answer['known']).toBe(false);
    expect(await call('page-heartbeat', { pageId: '' })).toBeUndefined();
  });

  it('expires reports by heartbeat age, not report age', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(0);
    const beats = createPageHeartbeats(PAGE_TTL_MS);
    const visibility = createPageVisibility((pageId) => beats.alive(pageId));
    const ttl = visibility.ttl(PAGE_TTL_MS);
    expect(beats.beat('p1', 0)).toBe(false);
    expect(ttl('p1')).toBe(Infinity);
    expect(ttl('p2')).toBe(PAGE_TTL_MS);
    vi.setSystemTime(PAGE_TTL_MS + 1);
    expect(ttl('p1')).toBe(PAGE_TTL_MS);
    // Dropped in the sweep, unless the tab is in the background.
    beats.expire(PAGE_TTL_MS + 1, (pageId) => pageId === 'p1');
    expect(beats.beat('p1', PAGE_TTL_MS + 2, (pageId) => pageId === 'p1')).toBe(true);
    beats.expire(3 * PAGE_TTL_MS);
    expect(beats.beat('p1', 3 * PAGE_TTL_MS)).toBe(false);
    // A visibility report refreshes a known page and never adds one.
    beats.touch('p3', 0);
    expect(beats.seenAt('p3')).toBeUndefined();
  });
});

describe('one page expiry for every store (#422)', () => {
  it('leaves room for two late or lost heartbeats', () => {
    expect(PAGE_TTL_MS).toBeGreaterThanOrEqual(3 * PAGE_HEARTBEAT_MS);
  });

  it('expires forms and router pages after the shared expiry by default', () => {
    const forms = new Map();
    mergePageReport(forms, { pageId: 'p1', forms: [], events: [] }, 0);
    expect(expirePages(forms, PAGE_TTL_MS)).toBeNull();
    expect(expirePages(forms, PAGE_TTL_MS + 1)).not.toBeNull();
    expect(forms.size).toBe(0);

    const router = new Map([['p1', { pageId: 'p1', reportedAt: 0 }]]);
    expect(expireRouterPages(router as never, PAGE_TTL_MS)).toBeNull();
    expect(expireRouterPages(router as never, PAGE_TTL_MS + 1)).not.toBeNull();
    expect(router.size).toBe(0);
  });
});
