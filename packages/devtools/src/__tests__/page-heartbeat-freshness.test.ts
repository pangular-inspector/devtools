import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';
import { PAGE_HEARTBEAT_MS } from '../page-heartbeat.ts';
import { createPageHeartbeats } from '../rpc/page-heartbeats.ts';
import { HIDDEN_PAGE_TTL_MS, PAGE_TTL_MS } from '../rpc/page-ttl.ts';
import { answerText } from './tool-answer.ts';

// A live page that only beats must read as live everywhere an agent or the
// panel looks: the shared states, the staleness notes and the report ages.

const STALE = 'The page may have closed';

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
  const state = async <T>(key: string) =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: { get: (key: string) => Promise<{ value: () => unknown }> };
        }
      ).sharedState.get(`pangular:${key}`)
    ).value() as T;
  const invoke = (id: string, args: Record<string, unknown> = {}) =>
    answerText(ctx.agent.invoke(`pangular:${id}`, args));
  return { call, state, invoke };
}

const form = (pageId: string) => ({
  id: `form-1@${pageId}`,
  kind: 'reactive',
  owner: 'Signup',
  label: 'Signup.form',
  root: {
    key: '',
    path: '',
    type: 'group',
    status: 'VALID',
    touched: false,
    dirty: false,
    bound: false,
    errors: [],
    children: [],
  },
});

const router = (pageId: string) => ({
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

const plugins = (pageId: string) => ({
  pageId,
  url: 'http://localhost/',
  title: 'Home',
  plugins: [
    {
      id: 'travel',
      version: '1.0.0',
      title: 'Travel store',
      apiVersion: 1,
      status: 'running',
      view: null,
      actions: [],
    },
  ],
});

interface RouterPageState {
  pageId: string;
  reportedAt: number;
}

describe('a page that only beats', () => {
  afterEach(() => vi.useRealTimers());

  it('stays fresh in the router, forms and plugins answers', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const { call, state, invoke } = await boot();
    await call('claim-page', { pageId: 'tab1', key: 'secret' });
    await call('push-router', router('tab1'));
    await call('push-forms', { pageId: 'tab1', forms: [form('tab1')], events: [] });
    await call('push-plugins', plugins('tab1'));

    // A minute of beats and nothing else.
    for (let at = 0; at < 60_000; at += PAGE_HEARTBEAT_MS) {
      vi.advanceTimersByTime(PAGE_HEARTBEAT_MS);
      expect(await call('page-heartbeat', { pageId: 'tab1' })).toMatchObject({ known: true });
    }
    const now = Date.now();

    const routerState = await state<{ pages: RouterPageState[] }>('router');
    expect(routerState.pages.find((p) => p.pageId === 'tab1')?.reportedAt).toBe(now);
    const formsState = await state<{ reportedAt: number; pagesReportedAt: Record<string, number> }>(
      'forms',
    );
    expect(formsState.pagesReportedAt['tab1']).toBe(now);
    expect(formsState.reportedAt).toBe(now);

    expect(await invoke('inspect-route', { page: 'tab1' })).not.toContain(STALE);
    expect(await invoke('inspect-forms', { page: 'tab1' })).not.toContain(STALE);
    const list = await invoke('list-plugins');
    expect(list).toContain('(0 s ago)');
    expect(await invoke('inspect-plugin', { plugin: 'travel' })).toContain('reported 0 s ago');
  });

  it('is unknown once its data expired as a background tab', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const { call, state } = await boot();
    await call('claim-page', { pageId: 'tab1', key: 'secret' });
    await call('push-signal-graph', { pageId: 'tab1', nodes: [], edges: [] });
    await call('report-page-visibility', { pageId: 'tab1', hidden: true });
    // A tab in the background pauses its heartbeat and its visibility reports stop.
    const held = async () =>
      JSON.stringify(await state('signal-graph')).includes('tab1') ? true : false;
    let at = 0;
    while (await held()) {
      vi.advanceTimersByTime(1000);
      at += 1000;
      expect(at).toBeLessThan(HIDDEN_PAGE_TTL_MS + 2 * PAGE_TTL_MS);
    }
    // The first beat after the stores dropped the page says so, so it sends everything.
    expect(await call('page-heartbeat', { pageId: 'tab1' })).toMatchObject({ known: false });
  });
});

describe('page heartbeats', () => {
  it('knows a page only while the stores still hold it', () => {
    const beats = createPageHeartbeats(PAGE_TTL_MS);
    expect(beats.beat('p1', 0)).toBe(false);
    expect(beats.beat('p1', PAGE_TTL_MS)).toBe(true);
    // Not swept yet, but past the expiry: the stores no longer keep it.
    expect(beats.beat('p1', 2 * PAGE_TTL_MS + 1)).toBe(false);
    // A tab in the background is kept by the stores, however old its beat.
    beats.beat('p2', 0);
    expect(beats.beat('p2', HIDDEN_PAGE_TTL_MS, () => true)).toBe(true);
  });
});
