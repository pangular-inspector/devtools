import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it } from 'vitest';
import { createPangular, type PangularHostOptions } from '../devframe.ts';
import type { PangularConfig } from '../config.ts';
import type { InjectorPage, InjectorTreeNode } from '../types.ts';
import { comparePages, createPageOrder, setPageOrder } from '../rpc/default-page.ts';
import { UNTRUSTED } from '../rpc/forms-tools.ts';
import { withPageLine } from '../rpc/page-read-scope.ts';
import { createLibraryGate, usedLibraries } from '../rpc/library-tools.ts';
import { stateReadTool } from '../rpc/state-read-tool.ts';
import { trimDetail, inspectProvidersText } from '../rpc/injector-tools.ts';
import { injectorResourceText } from '../rpc/injector-resource.ts';
import { nameStoreTokens } from '../rpc/store-tokens.ts';
import { routerActionAnswer } from '../rpc/router-action-answer.ts';
import { refusalOf } from '../rpc/refusal.ts';
import { toolAnswer } from './tool-answer.ts';

async function boot(config: PangularConfig = {}, host: PangularHostOptions = {}) {
  const ctx = await createHostContext({
    cwd: process.cwd(),
    mode: 'dev',
    host: {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    } as never,
  });
  await createPangular(config, host).setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const answer = (tool: string, args: Record<string, unknown> = {}) =>
    toolAnswer(ctx.agent.invoke(`pangular:${tool}`, args));
  return { ctx, push, answer };
}

const tree = (pageId: string, name: string) => ({
  pageId,
  url: `/${pageId}`,
  count: 1,
  detail: null,
  roots: [{ id: `${pageId}-root`, name, tag: 'app-root', children: [] }],
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

const injectorNode = (
  id: string,
  name: string,
  providers: InjectorTreeNode['providers'],
  extra: Partial<InjectorTreeNode> = {},
): InjectorTreeNode => ({
  injector: { id, type: 'environment', name, providerCount: providers.length },
  providers,
  children: [],
  ...extra,
});

describe('one default page for every tool (M1)', () => {
  afterEach(() => setPageOrder(() => undefined));

  it('reads the tab that connected last from every tool, and names it', async () => {
    const { push, answer } = await boot();
    // tab-a reports first; tab-b connects later. tab-a keeps reporting afterwards.
    await push('push-component-tree', tree('tab-a', 'BookingPage'));
    await push('push-router', routerReport('tab-a', '/book/kyoto'));
    await push('push-component-tree', tree('tab-b', 'FormsExample'));
    await push('push-router', routerReport('tab-b', '/examples/forms'));
    await push('push-component-tree', tree('tab-a', 'BookingPage'));
    await push('push-router', routerReport('tab-a', '/book/kyoto'));

    const pages = await answer('list-pages');
    const rows = [...pages.markdown.matchAll(/^\| `(tab-[ab])` /gm)].map((m) => m[1]);
    expect(rows).toEqual(['tab-b', 'tab-a']);

    const components = await answer('list-components');
    expect(components.markdown).toContain('FormsExample');
    expect(components.markdown).not.toContain('BookingPage');
    const route = await answer('inspect-route');
    // The route of tab-b, which then names tab-a as another page that reports.
    expect(route.markdown).toMatch(/\/examples\/forms[\s\S]*other page\(s\) report too: `tab-a`/);
  });

  it('puts a tab in the foreground before one in the background', () => {
    const hidden = new Set<string>();
    const order = createPageOrder(() => hidden);
    order.seen('old');
    order.seen('new');
    setPageOrder(order.rank);
    const ranked = () =>
      [{ pageId: 'old' }, { pageId: 'new' }].sort(comparePages).map((page) => page.pageId);
    expect(ranked()).toEqual(['new', 'old']);
    hidden.add('new');
    expect(ranked()).toEqual(['old', 'new']);
  });

  it('names the page on the first line, after the notice, and leaves JSON and named answers alone', () => {
    expect(withPageLine({ markdown: 'Two forms.' }, 'p1', '/x')).toEqual({
      markdown: 'Page `p1`.\n\nTwo forms.',
    });
    expect(withPageLine({ markdown: `${UNTRUSTED}\n\nTwo forms.` }, 'p1', '/x')).toEqual({
      markdown: `${UNTRUSTED}\n\nPage \`p1\` (\`/x\`).\n\nTwo forms.`,
    });
    const json = { markdown: `${UNTRUSTED}\n\n{"a":1}` };
    expect(withPageLine(json, 'p1', '/x')).toBe(json);
    const named = { markdown: 'Page `p1` has no recording.' };
    expect(withPageLine(named, 'p1', '/x')).toBe(named);
  });
});

describe('library tools only for apps that use them (M5)', () => {
  const project = (pkg: object) => {
    const dir = mkdtempSync(join(tmpdir(), 'pangular-libs-'));
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
    return dir;
  };

  it('reads the libraries from package.json, and holds back nothing when it has none', () => {
    const all = ['analog', 'capacitor', 'tanstackQuery'] as const;
    const uses = project({
      dependencies: { '@capacitor/core': '8', '@tanstack/angular-query-experimental': '5' },
    });
    expect([...usedLibraries(all, [uses], () => false)!].sort()).toEqual([
      'capacitor',
      'tanstackQuery',
    ]);
    expect(usedLibraries(all, [project({})], () => true)).toEqual(new Set(['analog']));
    expect(usedLibraries(all, [mkdtempSync(join(tmpdir(), 'pangular-none-'))], () => false)).toBe(
      undefined,
    );
  });

  it('registers a held tool once a page reports the library', () => {
    let reporting = false;
    const registered: string[] = [];
    const gate = createLibraryGate<{ id: string }>({
      auto: ['capacitor'],
      used: new Set(),
      reporting: { capacitor: () => reporting },
      register: (tool) => registered.push(tool.id),
    });
    expect(gate.hold({ id: 'pangular:capacitor-list-calls' })).toBe(true);
    expect(gate.hold({ id: 'pangular:list-errors' })).toBe(false);
    gate.check();
    expect(registered).toEqual([]);
    reporting = true;
    gate.check();
    expect(registered).toEqual(['pangular:capacitor-list-calls']);
    gate.stop();
  });

  it('keeps the tools the config turns on', async () => {
    const { ctx } = await boot({ inspectors: { capacitor: true } });
    const ids = ctx.agent.list().tools.map((tool) => tool.id);
    expect(ids).toContain('pangular:capacitor-list-calls');
    expect(ids).not.toContain('pangular:tanstack-list-queries');
  });
});

describe('devframe_state_read (M6)', () => {
  const host = (value: unknown) =>
    stateReadTool({
      keys: () => ['pangular:http', 'pangular:forms', 'devframe:docks'],
      value: async () => value,
      exposed: (key) => key === 'pangular:http',
      readBy: () => 'pangular:list-http-calls',
    });

  it('lists the keys agents may read, with their size and tool', async () => {
    const { markdown } = await host({ calls: [] }).handler({});
    expect(markdown).toContain('| `pangular:http` | 12 | pangular:list-http-calls |');
    expect(markdown).not.toContain('pangular:forms');
    expect(markdown).not.toContain('devframe:docks');
  });

  it('answers a capped part and says where the next starts', async () => {
    const tool = host({ big: 'x'.repeat(30_000) });
    expect(tool.description).not.toMatch(/freely/i);
    const first = await tool.handler({ key: 'pangular:http' });
    expect(first.markdown).toContain('characters 0 to 20,000 of 30,010');
    expect(first.markdown).toContain('Pass `offset: 20000`');
    const last = await tool.handler({ key: 'pangular:http', offset: 20_000 });
    expect(last.markdown).toContain('This is the last part.');
    expect(refusalOf(await tool.handler({ key: 'pangular:forms' }))).toBeDefined();
  });
});

describe('injectors (M3)', () => {
  const providers = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      token: `SomeVeryLongServiceNameNumber${i}`,
      type: 'class' as const,
      isViewProvider: false,
    }));
  const dependencies = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      from: `SomeVeryLongServiceNameNumber${i}`,
      token: `AnotherInjectedTokenWithALongName${i}`,
      flags: [],
      providedBy: 'root',
    }));
  const page = (): InjectorPage => ({
    pageId: 'p1',
    roots: [],
    environment: [
      injectorNode('platform', 'Platform', providers(5), {
        children: [
          injectorNode('root', 'Root', providers(400), { dependencies: dependencies(400) }),
        ],
      }),
    ],
    reportedAt: 1,
  });

  it('shows a Root injector too large for the answer, cut inside with counts', () => {
    const text = inspectProvidersText(page(), { injector: 'Root' });
    expect(text.length).toBeLessThanOrEqual(20_000);
    expect(text).not.toContain('Showing 0 of 1');
    expect(text).toContain('"providersTotal":400');
    expect(text).toContain('SomeVeryLongServiceNameNumber0');
  });

  it('cuts one detail to its budget', () => {
    const detail = { providers: providers(400), dependencies: dependencies(400) };
    const cut = trimDetail(detail, 5000);
    expect(JSON.stringify(cut).length).toBeLessThanOrEqual(5000);
    expect(cut).toMatchObject({ providersTotal: 400, dependenciesTotal: 400 });
  });

  it('serves an outline instead of a stub when the tree is too large for the resource', () => {
    const big = page();
    big.environment[0]!.children[0]!.providers = providers(3000);
    const json = JSON.parse(injectorResourceText({ pages: { p1: big } }, { p1: big }));
    expect(json.truncated).toBeUndefined();
    expect(json.outline).toBe(true);
    expect(json.pages.p1.environment[0].name).toBe('Platform');
    expect(json.pages.p1.environment[0].children[0]).toMatchObject({
      name: 'Root',
      providers: 3000,
    });
  });
});

describe('signal store names in the DI tools (M2)', () => {
  const declarations = [
    {
      name: 'TravelStore',
      kind: 'signal-store',
      file: 'src/app/travel.store.ts',
      line: 3,
      members: { state: ['trips', 'query'] },
    },
  ] as never;

  it('names a SignalStore provider and what injects it from the declaration with its keys', () => {
    const page: InjectorPage = {
      pageId: 'p1',
      roots: [
        {
          injector: { id: 'el-1', type: 'element', name: 'app-root', providerCount: 0 },
          providers: [],
          children: [],
          dependencies: [{ from: 'App', token: 'SignalStore', flags: [], providedBy: 'root' }],
        },
      ],
      environment: [
        injectorNode('root', 'Root', [
          {
            token: 'SignalStore',
            type: 'class',
            isViewProvider: false,
            stateKeys: ['trips', 'query'],
          },
        ]),
      ],
      reportedAt: 1,
    };
    const named = nameStoreTokens(page, declarations);
    expect(named.environment[0]!.providers[0]).toEqual({
      token: 'TravelStore',
      tokenClass: 'SignalStore',
      type: 'class',
      isViewProvider: false,
    });
    expect(named.roots[0]!.dependencies![0]!.token).toBe('TravelStore');
    const text = inspectProvidersText(named, { token: 'TravelStore' });
    expect(text).toContain('"token":"TravelStore"');
    expect(text).not.toContain('No injector');
  });
});

describe('a wrong project folder (M9)', () => {
  it('makes every source scan refuse and name the folder', async () => {
    const { ctx, answer } = await boot({}, { pageTools: false, notAProject: '/tmp' });
    const scan = await answer('scan-pipe-usage');
    expect(scan.isError).toBe(true);
    expect(scan.markdown).toContain('`/tmp`');
    expect(scan.markdown).toContain('--root');
    await expect(ctx.agent.invoke('pangular:scan-routes', {})).rejects.toThrow(/--root/);
  });
});

describe('navigate results (m1, B2)', () => {
  it('names the guard that redirected, and refuses a navigation that did not happen', () => {
    const navigations = [
      {
        id: 4,
        url: '/trips',
        trigger: 'imperative',
        startedAt: 1,
        outcome: 'redirected' as const,
        runs: [
          {
            guard: 'signedInGuard',
            kind: 'canActivate',
            route: '/trips',
            result: 'UrlTree /sign-in',
            ms: 1,
          },
        ],
      },
    ];
    const redirected = routerActionAnswer(
      'navigate',
      'p1',
      { id: 4, outcome: 'redirected', url: '/trips', finalUrl: '/sign-in?returnUrl=%2Ftrips' },
      navigations,
    );
    expect(refusalOf(redirected)).toBeUndefined();
    expect(redirected).toContain('"page": "p1"');
    expect(redirected).toContain('"finalUrl": "/sign-in?returnUrl=%2Ftrips"');
    expect(redirected).toContain('signedInGuard (canActivate on /trips) returned UrlTree /sign-in');
    expect(
      refusalOf(routerActionAnswer('navigate', 'p1', { id: 5, outcome: 'cancelled' })),
    ).toBeDefined();
    expect(
      refusalOf(routerActionAnswer('replay', 'p1', { replay: { outcome: 'failed' } })),
    ).toBeDefined();
    expect(refusalOf(routerActionAnswer('abort', 'p1', { aborted: 3 }))).toBeUndefined();
  });
});
