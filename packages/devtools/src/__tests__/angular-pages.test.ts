import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import pangular from '../devframe.ts';
import {
  createAngularPages,
  sanitizeAngularReport,
  unsupportedToolText,
} from '../rpc/angular-pages.ts';

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
  const call = async (tool: string, args: Record<string, unknown> = {}) =>
    ((await ctx.agent.invoke(`pangular:${tool}`, args)) as { markdown: string }).markdown;
  const state = async () =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: {
            get: (key: string) => Promise<{ value: () => { pages: Record<string, unknown> } }>;
          };
        }
      ).sharedState.get('pangular:page-angular')
    ).value();
  return { push, call, state };
}

const NONE = {
  debugApi: true,
  injectorProviders: false,
  injectorMetadata: false,
  isSignal: false,
  signalGraph: false,
  deferBlocks: false,
  forBlocks: false,
  profiler: false,
  angularProfiling: false,
  routerInstance: false,
};

const angular15 = (pageId = 'p1') => ({ pageId, version: '15.2.10', capabilities: NONE });

describe('page Angular reports', () => {
  it('keeps each page apart in the page-angular shared state and forgets a page that left', async () => {
    const { push, state } = await boot();
    await push('report-page-angular', angular15('p1'));
    await push('report-page-angular', {
      pageId: 'p2',
      version: '22.1.7',
      capabilities: { ...NONE, signalGraph: true },
    });
    const pages = (await state()).pages;
    expect(Object.keys(pages).sort()).toEqual(['p1', 'p2']);
    expect(pages['p1']).toMatchObject({ version: '15.2.10', capabilities: { signalGraph: false } });
    expect(pages['p2']).toMatchObject({ version: '22.1.7', capabilities: { signalGraph: true } });
    await push('forget-page-angular', 'p1');
    expect(Object.keys((await state()).pages)).toEqual(['p2']);
  });

  it('drops reports without a pageId and fields that are not what the page sends', () => {
    expect(sanitizeAngularReport({ version: '15.2.10', capabilities: NONE })).toBeNull();
    expect(
      sanitizeAngularReport({
        pageId: 'p1',
        version: '<script>',
        capabilities: { debugApi: 'yes', signalGraph: false, madeUp: true },
      }),
    ).toEqual({ pageId: 'p1', capabilities: { signalGraph: false } });
  });

  it('expires a page that stopped reporting and picks the newest page', () => {
    let now = 0;
    const pages = createAngularPages(() => now);
    pages.set(angular15('old'));
    now = 10_000;
    pages.set(angular15('new'));
    expect(pages.pick()?.pageId).toBe('new');
    now = 20_000;
    expect(pages.expire(() => 15_000)).toBe(true);
    expect(pages.get('old')).toBeUndefined();
    expect(pages.get('new')).toBeDefined();
  });

  it('says a stored report changed only when its value did', () => {
    const pages = createAngularPages();
    expect(pages.set(angular15())).toBe(true);
    expect(pages.set(angular15())).toBe(false);
    expect(pages.set({ ...angular15(), version: '15.2.11' })).toBe(true);
  });
});

describe('agent tools on an older Angular', () => {
  it('answer inspect-signals and watch-signal with an unsupported result naming the version', async () => {
    const { push, call } = await boot();
    await push('report-page-angular', angular15());
    const text = await call('inspect-signals', { selector: 'app-root' });
    expect(text).toMatch(/^\*\*Unsupported on this Angular version\.\*\*/);
    expect(text).toContain('The live signal graph needs Angular 20.1 or later');
    expect(text).toContain('this page runs Angular 15.2');
    expect(await call('watch-signal', { node: 'count' })).toMatch(/Unsupported on this Angular/);
  });

  it('say so when the signal graph has no node ids (Angular 19.1 to 20.0)', async () => {
    const { push, call } = await boot();
    await push('report-page-angular', {
      pageId: 'p1',
      version: '19.2.25',
      capabilities: { ...NONE, signalGraph: true },
    });
    await push('push-signal-graph', { pageId: 'p1', nodes: [], edges: [], unsupported: true });
    const text = await call('inspect-signals', { selector: 'app-root' });
    expect(text).toContain('Unsupported on this Angular version');
    expect(text).toContain('this page runs Angular 19.2');
  });

  it('answer defer-blocks and for-blocks per page with the version', async () => {
    const { push, call } = await boot();
    await push('report-page-angular', angular15());
    await push('push-component-tree', {
      pageId: 'p1',
      roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
      count: 1,
      detail: null,
    });
    expect(await call('defer-blocks')).toContain(
      'Listing @defer blocks needs Angular 19.1 or later; this page runs Angular 15.2.',
    );
    expect(await call('for-blocks')).toContain(
      'Listing @for blocks needs Angular 22.0 or later; this page runs Angular 15.2.',
    );
  });

  it('mark the injector tree of Angular 15 as reduced', async () => {
    const { push, call } = await boot();
    await push('report-page-angular', angular15());
    await push('push-injector-tree', {
      pageId: 'p1',
      roots: [
        {
          injector: { id: 'inj-1', type: 'element', name: 'app-root', providerCount: 0 },
          providers: [],
          children: [],
        },
      ],
      environment: [],
    });
    const text = await call('inspect-providers');
    expect(text).toContain('The full injector tree needs Angular 17.0 or later');
    expect(text).toContain('reduced tree');
    expect(text).toContain('app-root');
  });

  it('answer change-detection with the profiler version', async () => {
    const { push, call } = await boot();
    await push('report-page-angular', angular15());
    await push('push-change-detection', {
      pageId: 'p1',
      supported: false,
      recording: false,
      startedAt: 1,
      dropped: 0,
      cycles: [],
      components: [],
      hosts: {},
    });
    expect(await call('change-detection')).toContain(
      'Recording change detection needs Angular 20.0 or later; this page runs Angular 15.2.',
    );
  });

  it('list each page with the Angular version it reported', async () => {
    const { push, call } = await boot();
    await push('report-page-angular', angular15());
    await push('push-component-tree', {
      pageId: 'p1',
      roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
      count: 1,
      detail: null,
    });
    await push('push-component-tree', { pageId: 'p2', roots: [], count: 0, detail: null });
    const text = await call('list-pages');
    expect(text).toMatch(/\| `p1` \|.*\| browser, Angular 15\.2 \|/);
    expect(text).toMatch(/\| `p2` \|.*\| browser \|/);
  });

  it('answer as before when the page never said what it has', async () => {
    const { call } = await boot();
    expect(await call('inspect-signals', { selector: 'app-root' })).toMatch(
      /No signal graph available/,
    );
  });

  it('build the unsupported text only for a capability the page lacks', () => {
    expect(unsupportedToolText(undefined, 'signalGraph')).toBeNull();
    expect(unsupportedToolText({ capabilities: { signalGraph: true } }, 'signalGraph')).toBeNull();
    expect(
      unsupportedToolText({ version: '16.2.12', capabilities: { forBlocks: false } }, 'forBlocks'),
    ).toBe(
      '**Unsupported on this Angular version.** Listing @for blocks needs Angular 22.0 or later; this page runs Angular 16.2.',
    );
  });
});
