import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ngDevtools from '../devframe.ts';

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
  const call = async (tool: string, selector: string, extra: Record<string, unknown> = {}) =>
    (
      (await ctx.agent.invoke(`ng-devtools:${tool}`, { selector, ...extra })) as {
        markdown: string;
      }
    ).markdown;
  const injectorState = async () =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: {
            get: (key: string) => Promise<{ value: () => Record<string, unknown> }>;
          };
        }
      ).sharedState.get('ng-devtools:injector-tree')
    ).value();
  return { ctx, push, call, injectorState };
}

const injectorRoot = (name: string) => ({
  injector: { id: 'inj-1', type: 'element', name, providerCount: 0 },
  providers: [],
  children: [],
});

const elementInjectors = (markdown: string) =>
  JSON.parse(markdown.split(/Element injectors:|Environment injectors:/)[1]!);

describe('agent tools', () => {
  afterEach(() => vi.useRealTimers());

  it('record change detection through the page and report what it pushed', async () => {
    const { push, call } = await boot();
    expect(await call('change-detection', '')).toMatch(/No change detection recording yet/);
    expect(await call('change-detection', '', { record: 'start' })).toMatch(/Recording started/);
    await push('push-change-detection', {
      pageId: 'p1',
      supported: true,
      recording: true,
      startedAt: 1,
      dropped: 0,
      cycles: [{ id: 1, at: 1, ms: 2, passes: 1, checks: 1, components: [] }],
      components: [{ name: 'Cart', checks: 1, ms: 2, maxMs: 2, cycles: 1 }],
      hosts: {},
    });
    expect(await call('change-detection', '')).toContain('`Cart`: 1 check(s)');
    expect(await push('ping-change-detection', 'p1')).toEqual({ known: true });
    await push('forget-change-detection-page', 'p1');
    expect(await push('ping-change-detection', 'p1')).toEqual({ known: false });
  });

  it('report the change detection mode and what services inject', async () => {
    const { push, call, injectorState } = await boot();
    const rootEnv = {
      injector: { id: 'root-1', type: 'environment', name: 'Root', providerCount: 1 },
      providers: [{ token: 'HttpClient', type: 'class', isViewProvider: false }],
      children: [],
      dependencies: [{ from: 'Api', token: 'HttpClient', flags: [], providedBy: 'root-1' }],
    };
    await push('push-injector-tree', {
      pageId: 'p1',
      roots: [injectorRoot('app-root')],
      environment: [rootEnv],
      zone: 'zone-unused',
    });
    expect(await injectorState()).toMatchObject({ zone: 'zone-unused' });
    expect(await call('change-detection', '')).toMatch(
      /^Page `p1` runs zoneless change detection, but zone\.js is still loaded\./,
    );
    const tree = await call('inspect-providers', '');
    expect(tree).toContain('Page `p1` runs zoneless change detection');
    expect(tree).toContain('"from":"Api"');
    expect(await call('inspect-providers', '', { token: 'HttpClient' })).toContain(
      '"injectedBy":[{"id":"root-1","name":"Root","from":"Api"',
    );

    await push('push-injector-tree', {
      pageId: 'p1',
      roots: [injectorRoot('app-root')],
      environment: [],
      zone: 'bogus',
    });
    expect(await injectorState()).toMatchObject({ zone: null });
    expect(await call('change-detection', '')).toMatch(/^No change detection recording yet/);
  });

  it('say so when nothing has been reported', async () => {
    const { call } = await boot();
    // Worded after the data, not the connection: an empty tree is what both a
    // page that never connected and a page with no readable components send.
    expect(await call('highlight', 'app-root')).toMatch(/no component tree has been reported/i);
    expect(await call('inspect-signals', 'app-root')).toMatch(/no signal graph/i);
    expect(await call('inspect-providers', '')).toMatch(/no injector data/i);
  });

  it('answer from the data the page pushed', async () => {
    const { push, call } = await boot();
    await push('push-component-tree', {
      pageId: 'p1',
      roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
      count: 1,
      detail: null,
    });
    await push('push-signal-graph', {
      nodes: [{ id: 'a', kind: 'signal', label: 'count' }],
      edges: [],
      componentSelector: 'app-root',
    });
    await push('push-injector-tree', {
      pageId: 'p1',
      roots: [
        {
          injector: { id: 'i1', type: 'element', name: 'App', providerCount: 0 },
          providers: [],
          children: [],
        },
      ],
      environment: [],
    });

    expect(await call('highlight', 'app-root')).toMatch(/highlight request/i);

    // The payload matters, not how it is worded around.
    const signals = await call('inspect-signals', 'app-root');
    expect(JSON.parse(signals)).toMatchObject({ nodes: [{ label: 'count' }] });

    const other = await call('inspect-signals', 'app-other');
    expect(other).toMatch(/app-other/);
    expect(other).toMatch(/app-root/);

    // The answer carries the whole injector tree, whatever it is worded like.
    const providers = await call('inspect-providers', '');
    const [elements, environment] = providers
      .split(/Element injectors:|Environment injectors:/)
      .slice(1)
      .map((part) => JSON.parse(part));
    expect(elements).toMatchObject([{ injector: { name: 'App' } }]);
    expect(environment).toEqual([]);
  });

  it('keeps component trees per page and resolves a class name to one instance', async () => {
    const { push, call } = await boot();
    const card = (id: string) => ({ id, name: 'Card', tag: 'app-card', children: [] });
    await push('push-component-tree', {
      pageId: 'p1',
      roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [card('c2'), card('c3')] }],
      count: 3,
      detail: null,
    });
    await push('push-component-tree', { pageId: 'bad' });
    expect(await call('highlight', 'Card')).toMatch(/instance `c2` on page `p1`/);
    expect(await call('highlight', 'c3')).toMatch(/instance `c3`/);
    expect(await call('highlight', '.promo')).toMatch(/only shows if the selector matches/);
    await push('forget-component-page', 'p1');
    expect(await call('highlight', 'Card')).toMatch(/no component tree has been reported/i);
  });

  it('matches inspect-signals on the class name of the graph component', async () => {
    const { push, call } = await boot();
    await push('push-signal-graph', {
      pageId: 'p1',
      nodes: [{ id: 'a', kind: 'signal', label: 'count', epoch: 0 }],
      edges: [],
      componentSelector: 'app-card',
      component: { id: 'c2', name: 'Card', tag: 'app-card', path: 'app-root > app-card' },
    });
    expect(JSON.parse(await call('inspect-signals', 'Card'))).toMatchObject({
      component: { name: 'Card' },
    });
  });

  it('prefers a per-page signal graph that matches the selector over the last pushed graph', async () => {
    const { push, call } = await boot();
    await push('push-signal-graph', {
      pageId: 'p1',
      nodes: [{ id: 'a', kind: 'signal', label: 'open', epoch: 0 }],
      edges: [],
      componentSelector: 'app-card',
      component: { id: 'c2', name: 'Card', tag: 'app-card', path: 'app-root > app-card' },
    });
    await push('push-signal-graph', {
      pageId: 'p2',
      nodes: [{ id: 'b', kind: 'signal', label: 'count', epoch: 0 }],
      edges: [],
      componentSelector: 'app-x',
      component: { id: 'c9', name: 'X', tag: 'app-x', path: 'app-root > app-x' },
    });
    expect(JSON.parse(await call('inspect-signals', 'Card'))).toMatchObject({
      pageId: 'p1',
      nodes: [{ label: 'open' }],
    });
    expect(JSON.parse(await call('inspect-signals', 'c9'))).toMatchObject({ pageId: 'p2' });
    const missing = await call('inspect-signals', 'app-none');
    expect(missing).toMatch(/No signal graph for `app-none`/);
    expect(missing).toMatch(/app-x/);
  });

  it('switches inspect-signals to the root injector and waits for its graph', async () => {
    const { push, call } = await boot();
    const card = {
      pageId: 'p1',
      nodes: [{ id: 'a', kind: 'signal', label: 'open', epoch: 0 }],
      edges: [],
      componentSelector: 'app-card',
      component: { id: 'c2', name: 'Card', tag: 'app-card', path: 'app-root > app-card' },
      environments: [
        { id: 'inj-1', name: 'Root' },
        { id: 'inj-4', name: 'Route: admin' },
      ],
    };
    await push('push-signal-graph', card);
    const answer = call('inspect-signals', 'root');
    await new Promise((resolve) => setTimeout(resolve, 20));
    await push('push-signal-graph', {
      pageId: 'p1',
      nodes: [{ id: 'e', kind: 'effect', label: 'persistTrips', epoch: 1 }],
      edges: [],
      injector: { id: 'inj-1', name: 'Root' },
      environments: card.environments,
      source: 'selected',
    });
    expect(JSON.parse(await answer)).toMatchObject({
      injector: { name: 'Root' },
      nodes: [{ label: 'persistTrips' }],
    });
    expect(JSON.parse(await call('inspect-signals', 'inj-1'))).toMatchObject({
      injector: { id: 'inj-1' },
    });
  });

  it('names the known injectors when a route path matches none', async () => {
    const { push, call } = await boot();
    await push('push-signal-graph', {
      pageId: 'p1',
      nodes: [],
      edges: [],
      componentSelector: 'app-card',
      environments: [{ id: 'inj-1', name: 'Root' }],
    });
    const missing = await call('inspect-signals', '/nope');
    expect(missing).toMatch(
      /No environment injector on the page matches it; the page knows `Root`/,
    );
  }, 10_000);

  it('says the live graph needs Angular 20.1 when the page cannot report one', async () => {
    const { push, call } = await boot();
    await push('push-signal-graph', { pageId: 'p1', nodes: [], edges: [], unsupported: true });
    expect(await call('inspect-signals', 'app-root')).toMatch(/needs Angular 20\.1 or later/);
  });

  it('keeps resource status history across delta pushes', async () => {
    const { push, call } = await boot();
    const base = {
      pageId: 'p1',
      nodes: [{ id: '3', kind: 'computed', label: 'Resource#trips.value', epoch: 1 }],
      edges: [],
      componentSelector: 'app-root',
      resources: [{ id: 'resource:3', name: 'trips', named: true, epoch: 1, nodeIds: ['3'] }],
    };
    await push('push-signal-graph', {
      ...base,
      history: { 'resource:3': [{ epoch: 1, value: 'loading', at: 1, source: 'initial' }] },
    });
    await push('push-signal-graph', {
      ...base,
      historyDelta: { 'resource:3': [{ epoch: 2, value: 'resolved', at: 2, source: 'sample' }] },
    });
    const graph = JSON.parse(await call('inspect-signals', 'app-root'));
    expect(graph.history['resource:3'].map((c: { value: string }) => c.value)).toEqual([
      'loading',
      'resolved',
    ]);
  });

  it('forgets a signal page on request and moves the shown graph to the latest remaining page', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { ctx, push, call } = await boot();
    const signalState = async () =>
      (
        await (
          ctx.rpc as unknown as {
            sharedState: {
              get: (key: string) => Promise<{ value: () => Record<string, unknown> }>;
            };
          }
        ).sharedState.get('ng-devtools:signal-graph')
      ).value();
    const graph = (pageId: string, label: string) => ({
      pageId,
      componentSelector: 'app-root',
      nodes: [{ id: 'a', kind: 'signal', label, epoch: 0 }],
      edges: [],
    });
    vi.setSystemTime(1000);
    await push('push-signal-graph', graph('p1', 'first'));
    vi.setSystemTime(2000);
    await push('push-signal-graph', graph('p2', 'second'));
    vi.setSystemTime(3000);
    await push('push-signal-graph', graph('p3', 'third'));

    await push('forget-signal-page', 'p1');
    expect(Object.keys((await signalState())['pages'] as object).sort()).toEqual(['p2', 'p3']);
    expect(await signalState()).toMatchObject({ graph: { pageId: 'p3' } });

    await push('forget-signal-page', 'p3');
    expect(Object.keys((await signalState())['pages'] as object)).toEqual(['p2']);
    expect(await signalState()).toMatchObject({ graph: { pageId: 'p2' } });
    expect(await push('ping-signal-graph', 'p3')).toEqual({ known: false });
    expect(JSON.parse(await call('inspect-signals', 'app-root'))).toMatchObject({
      nodes: [{ label: 'second' }],
    });

    await push('forget-signal-page', 'p2');
    expect(await signalState()).toMatchObject({ graph: null, pages: {} });
    expect(await call('inspect-signals', 'app-root')).toMatch(/no signal graph/i);
  });

  it('keeps injector trees per page, forgets a page on request and ignores reports without a page', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { push, call, injectorState } = await boot();
    vi.setSystemTime(1000);
    await push('push-injector-tree', { pageId: 'p1', roots: [injectorRoot('A')], environment: [] });
    vi.setSystemTime(2000);
    await push('push-injector-tree', { pageId: 'p2', roots: [injectorRoot('B')], environment: [] });
    await push('push-injector-tree', { roots: [injectorRoot('C')], environment: [] });

    expect(Object.keys((await injectorState())['pages'] as object).sort()).toEqual(['p1', 'p2']);
    expect(await injectorState()).toMatchObject({ roots: [{ injector: { name: 'B' } }] });
    expect(elementInjectors(await call('inspect-providers', ''))).toMatchObject([
      { injector: { name: 'B' } },
    ]);
    const first = await call('inspect-providers', '', { pageId: 'p1' });
    expect(first).toMatch(/`p1`/);
    expect(elementInjectors(first)).toMatchObject([{ injector: { name: 'A' } }]);

    await push('forget-injector-page', 'p2');
    expect(elementInjectors(await call('inspect-providers', ''))).toMatchObject([
      { injector: { name: 'A' } },
    ]);
    await push('forget-injector-page', 'p1');
    expect(await call('inspect-providers', '')).toMatch(/no injector data/i);
    expect(await injectorState()).toMatchObject({ roots: [], environment: [], pages: {} });
  });

  it('narrows inspect-providers to a selector or a token and resolves the lookup path', async () => {
    const { push, call } = await boot();
    const card = (id: string) => ({
      injector: {
        id,
        type: 'element',
        name: 'app-card',
        component: 'Card',
        providerCount: 1,
        path: [id, 'root-1', 'inj-null'],
      },
      providers: [{ token: 'Logger', type: 'class', isViewProvider: false }],
      children: [],
      dependencies: [
        { from: 'Card', token: 'HttpClient', flags: [], providedBy: 'root-1' },
        { from: 'Card', token: 'Theme', flags: ['optional'], providedBy: null },
      ],
    });
    await push('push-injector-tree', {
      pageId: 'p1',
      roots: [
        {
          injector: { id: 'app-1', type: 'element', name: 'app-root', providerCount: 0 },
          providers: [],
          children: [card('card-1'), card('card-2')],
        },
      ],
      environment: [
        {
          injector: { id: 'root-1', type: 'environment', name: 'Root', providerCount: 1 },
          providers: [{ token: 'HttpClient', type: 'class', isViewProvider: false }],
          children: [],
        },
      ],
    });

    const bySelector = await call('inspect-providers', 'Card');
    const matched = JSON.parse(bySelector.slice(bySelector.indexOf('[')));
    expect(matched.map((m: { injector: { id: string } }) => m.injector.id)).toEqual([
      'card-1',
      'card-2',
    ]);
    expect(matched[0].lookupPath).toEqual([
      { id: 'card-1', name: 'app-card', provides: ['Logger'] },
      { id: 'root-1', name: 'Root', provides: ['HttpClient'] },
      { id: 'inj-null', name: 'Null injector', provides: [] },
    ]);
    expect(matched[0].dependencies[0]).toMatchObject({ providedByName: 'Root' });
    expect(bySelector).not.toMatch(/app-root/);
    expect(await call('inspect-providers', 'app-none')).toMatch(/No element injector.*app-none/);

    const byToken = await call('inspect-providers', '', { token: 'httpclient' });
    const answer = JSON.parse(byToken.slice(byToken.indexOf('{"')));
    expect(answer.providedBy).toEqual([
      expect.objectContaining({ id: 'root-1', name: 'Root', type: 'environment' }),
    ]);
    expect(answer.injectedBy.map((hit: { id: string }) => hit.id)).toEqual(['card-1', 'card-2']);
    expect(await call('inspect-providers', '', { token: 'Http' })).toMatch(
      /Similar tokens: `HttpClient`/,
    );
  });

  it('caps the whole injector tree and says how to narrow it', async () => {
    const { push, call } = await boot();
    const roots = Array.from({ length: 400 }, (_, i) => ({
      injector: { id: `inj-${i}`, type: 'element', name: `app-item-${i}`, providerCount: 0 },
      providers: [],
      children: [],
    }));
    await push('push-injector-tree', { pageId: 'p1', roots, environment: [] });
    const answer = await call('inspect-providers', '');
    expect(answer.length).toBeLessThan(20_500);
    expect(answer).toMatch(/truncated at 20000 characters; pass `selector` or `token`/);
  });

  it('keeps the truncated flag of a large page and says so', async () => {
    const { push, call, injectorState } = await boot();
    await push('push-injector-tree', {
      pageId: 'p1',
      roots: [injectorRoot('A')],
      environment: [],
      truncated: true,
    });
    const state = await injectorState();
    expect(state).toMatchObject({ truncated: true, pages: { p1: { truncated: true } } });
    expect(await call('inspect-providers', '')).toMatch(/more than 2000 element injectors/);
    expect(await call('inspect-providers', 'A')).toMatch(/more than 2000 element injectors/);
    await push('push-injector-tree', { pageId: 'p1', roots: [injectorRoot('A')], environment: [] });
    expect(await injectorState()).toMatchObject({ truncated: false });
    expect(await call('inspect-providers', '')).not.toMatch(/more than 2000/);
  });

  it('resolves a class name on the most recent tab and names the other tabs', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { push, call } = await boot();
    const tree = (pageId: string, id: string) => ({
      pageId,
      roots: [{ id, name: 'Card', tag: 'app-card', children: [] }],
      count: 1,
      detail: null,
    });
    vi.setSystemTime(1000);
    await push('push-component-tree', tree('old', 'c1'));
    vi.setSystemTime(2000);
    await push('push-component-tree', tree('new', 'c7'));

    const latest = await call('highlight', 'Card');
    expect(latest).toMatch(/instance `c7` on page `new`/);
    expect(latest).toMatch(/also matches on `old`/);
    expect(await call('highlight', 'Card', { page: 'old' })).toMatch(/instance `c1` on page `old`/);
    expect(await call('highlight', '.promo', { page: 'old' })).toMatch(/to page `old`/);

    const unknown = await call('highlight', 'Card', { page: 'gone' });
    expect(unknown).toMatch(/^No page `gone` is reporting a component tree\./);
    expect(unknown.indexOf('`new`')).toBeLessThan(unknown.indexOf('`old`'));
  });

  it('sends a page-scoped CSS selector only to the named page', async () => {
    const { ctx, push, call } = await boot();
    await push('push-component-tree', {
      pageId: 'p1',
      roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
      count: 1,
      detail: null,
    });
    const broadcast = vi.spyOn(ctx.rpc, 'broadcast');
    await call('highlight', '.promo', { page: 'p1' });
    expect(broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'ng-devtools:highlight-in-page',
        args: [{ pageId: 'p1', selector: '.promo', reveal: true, durationMs: 2000 }],
      }),
    );
  });

  it('picks a page for inspect-signals and inspect-providers and refuses an unknown one', async () => {
    const { push, call } = await boot();
    const graph = (pageId: string, name: string) => ({
      pageId,
      nodes: [{ id: 'a', kind: 'signal', label: name, epoch: 0 }],
      edges: [],
      componentSelector: 'app-card',
      component: { id: 'c2', name: 'Card', tag: 'app-card', path: 'app-card' },
    });
    await push('push-signal-graph', graph('p1', 'first'));
    await push('push-signal-graph', graph('p2', 'second'));
    expect(JSON.parse(await call('inspect-signals', 'Card', { page: 'p1' }))).toMatchObject({
      pageId: 'p1',
      nodes: [{ label: 'first' }],
    });
    expect(await call('inspect-signals', 'Card', { page: 'gone' })).toMatch(
      /^No page `gone` is reporting a signal graph\. Pages that report a signal graph: `p\d`/,
    );

    await push('push-injector-tree', { pageId: 'p1', roots: [injectorRoot('A')], environment: [] });
    expect(await call('inspect-providers', 'app-root', { page: 'p1' })).toMatch(/`p1`/);
    expect(await call('inspect-providers', 'app-root', { pageId: 'p1' })).toMatch(/`p1`/);
    for (const args of [{ page: 'gone' }, { pageId: 'gone' }]) {
      const text = await call('inspect-providers', 'app-root', args);
      expect(text).toMatch(/^No page `gone` is reporting an injector tree\./);
      expect(text).toContain('`p1`');
      expect(text).not.toContain('Element injectors');
    }
  });

  it('lists the reporting pages with their URL and inspectors', async () => {
    const { push, call } = await boot();
    expect(await call('list-pages', '')).toMatch(/No page is reporting/);
    await push('push-component-tree', {
      pageId: 'p1',
      roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
      count: 1,
      detail: null,
    });
    await push('push-injector-tree', { pageId: 'p1', roots: [injectorRoot('A')], environment: [] });
    const text = await call('list-pages', '');
    expect(text).toMatch(/1 page\(s\) report/);
    expect(text).toMatch(/\| `p1` \| unknown \| \d+s ago \| components, injectors \|/);
  });

  it('expires injector trees a page stopped reporting', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const { push, call } = await boot();
    await push('push-injector-tree', { pageId: 'p1', roots: [injectorRoot('A')], environment: [] });
    vi.advanceTimersByTime(10_000);
    expect(await call('inspect-providers', '')).toMatch(/`p1`/);
    vi.advanceTimersByTime(10_000);
    expect(await call('inspect-providers', '')).toMatch(/no injector data/i);
  });
});
