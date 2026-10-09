// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  ANALOG_META_DESCRIPTION,
  attachAnalog,
  analogMetaOf,
  chainOf,
  collectAnalog,
  configPathsOf,
  fileOfEndpoint,
  hasAnalogMeta,
  hydrationErrorOf,
  loadSummary,
  mergeHydrationErrors,
} from '../analog-runtime.ts';
import { httpRegistry } from '../http-rules.ts';

const META = Symbol(ANALOG_META_DESCRIPTION);

function analogRoute(path: string, endpointKey: string, extra: Record<string, unknown> = {}) {
  return {
    path,
    component: class {},
    ...extra,
    [META]: { endpoint: `/pages/${path}`, endpointKey },
  };
}

describe('Analog runtime reader', () => {
  it('masks JWTs and bearer tokens held in string values of the load preview', () => {
    const summary = loadSummary({
      header: 'Bearer abc.def123',
      note: 'eyJhbGciOiJI.eyJzdWIiOiIx.SflKxwRJSMeK',
      password: 'x',
    })!;
    expect(summary.preview).not.toMatch(/abc\.def123|eyJhbGci/);
    expect(loadSummary('Bearer abc.def123')!.preview).not.toContain('abc.def123');
  });

  it('finds the hidden route metadata and maps it to files', () => {
    const route = analogRoute('', '/src/app/pages/products/[id].server.ts');
    expect(analogMetaOf(route)?.endpointKey).toBe('/src/app/pages/products/[id].server.ts');
    expect(analogMetaOf({ path: 'x' })).toBeNull();
    expect(fileOfEndpoint('/src/app/pages/products/[id].server.ts')).toEqual({
      file: '/src/app/pages/products/[id].page.ts',
      serverFile: '/src/app/pages/products/[id].server.ts',
    });
    expect(fileOfEndpoint('/src/app/pages/about.md')).toEqual({ file: '/src/app/pages/about.md' });
  });

  it('walks the active snapshot and picks up load data', () => {
    const leaf = {
      routeConfig: analogRoute('', '/src/app/pages/products/[id].server.ts'),
      data: { load: { id: '1', token: 'abc' } },
      firstChild: null,
    };
    const param = { routeConfig: { path: ':id' }, data: {}, firstChild: leaf };
    const layout = {
      routeConfig: analogRoute('', '/src/app/pages/products.server.ts'),
      data: {},
      firstChild: param,
    };
    const top = { routeConfig: { path: 'products' }, data: {}, firstChild: layout };
    const root = { routeConfig: null, data: {}, firstChild: top };
    const { chain, data, loadFrom } = chainOf(root);
    expect(loadFrom).toBe(1);
    expect(chain.map((c) => `${c.path} ${c.file}`)).toEqual([
      '/products /src/app/pages/products.page.ts',
      '/products/:id /src/app/pages/products/[id].page.ts',
    ]);
    const summary = loadSummary(data)!;
    expect(summary.keys).toEqual(['id', 'token']);
    expect(summary.preview).toBe('{"id":"1","token":"[redacted]"}');
  });

  it('redacts load data by whole words, not substrings', () => {
    const visible = {
      author: 'Ada',
      authorId: 3,
      compassHeading: 'N',
      passengers: 2,
      footprint: 'x',
      discardReason: 'y',
      cardinality: 1,
      title: 't',
    };
    const hidden = { token: 'a', password: 'b', sessionId: 'c', apiKey: 'd', cardNumber: 'e' };
    const preview = JSON.parse(loadSummary({ ...visible, ...hidden })!.preview);
    expect(preview).toEqual({
      ...visible,
      token: '[redacted]',
      password: '[redacted]',
      sessionId: '[redacted]',
      apiKey: '[redacted]',
      cardNumber: '[redacted]',
    });
  });

  it('replaces load data nested past the depth limit instead of keeping it raw', () => {
    const summary = loadSummary({
      a: { b: { c: { d: { e: { f: { g: { password: 'hunter2' } } } } } } },
    })!;
    expect(summary.preview).not.toContain('hunter2');
    expect(summary.preview).toContain('[Truncated]');
  });

  it('lists router paths including loaded children', () => {
    const config = [
      {
        path: '',
        loadChildren: () => null,
        _loadedRoutes: [analogRoute('', '/src/app/pages/index.server.ts')],
      },
      { path: 'products', children: [{ path: ':id' }] },
    ];
    expect(configPathsOf(config)).toEqual(['/', '/products', '/products/:id']);
  });

  it('recognises hydration errors', () => {
    expect(
      hydrationErrorOf([new Error('NG0500: During hydration Angular expected <div>')]),
    ).toContain('NG0500');
    expect(hydrationErrorOf(['NG04002: Cannot match any routes'])).toBeNull();
    expect(hydrationErrorOf(['NG05104: Root element was not found'])).toBeNull();
    expect(hydrationErrorOf(['NG0505: no hydration info in server response'])).toContain('NG0505');
  });

  it('builds a report from the router behind window.ng', () => {
    document.body.innerHTML =
      '<app-root ng-version="22" ng-server-context="ssr-analog"><p ngh="0"></p><span></span></app-root><script id="shop-state" type="application/json">{}</script>';
    const p = document.querySelector('p') as unknown as Record<string, unknown>;
    p['__ngDebugHydrationInfo__'] = { status: 'hydrated' };
    (document.querySelector('span') as unknown as Record<string, unknown>)[
      '__ngDebugHydrationInfo__'
    ] = { status: 'hydrated' };
    const leaf = {
      routeConfig: analogRoute('', '/src/app/pages/about.md'),
      data: {},
      firstChild: null,
    };
    const router = {
      url: '/about',
      config: [{ path: 'about', loadChildren: () => null }],
      routerState: {
        snapshot: {
          root: {
            routeConfig: null,
            data: {},
            firstChild: { routeConfig: { path: 'about' }, data: {}, firstChild: leaf },
          },
        },
      },
    };
    const ng = { getInjector: () => ({}), ɵgetRouterInstance: () => router };
    const report = collectAnalog(ng, 'p1', ['NG0500: x'])!;
    expect(report).toMatchObject({
      pageId: 'p1',
      url: '/about',
      analog: true,
      serverContext: 'ssr-analog',
      hydrated: 2,
      transferState: true,
      hydrationErrors: ['NG0500: x'],
      configPaths: ['/about'],
    });
    expect(report.chain[0].file).toBe('/src/app/pages/about.md');
    expect(collectAnalog({}, 'p', [])).toBeNull();
  });

  it('masks secret route params in the url and hydration errors on the page', () => {
    document.body.innerHTML = '<app-root ng-version="22"></app-root>';
    const leaf = {
      routeConfig: analogRoute('', '/src/app/pages/reset/[token].page.ts'),
      data: {},
      params: {},
      children: [],
      firstChild: null,
    };
    const middle = {
      routeConfig: { path: 'reset/:token' },
      data: {},
      params: { token: 'q8w2e' },
      children: [leaf],
      firstChild: leaf,
    };
    const router = {
      url: '/reset/q8w2e',
      config: [analogRoute('reset/:token', '/src/app/pages/reset/[token].page.ts')],
      routerState: {
        snapshot: {
          root: {
            routeConfig: null,
            data: {},
            params: {},
            children: [middle],
            firstChild: middle,
          },
        },
      },
    };
    const ng = { getInjector: () => ({}), ɵgetRouterInstance: () => router };
    const report = collectAnalog(ng, 'p1', ['NG0500: text "q8w2e" differs'])!;
    expect(report.url).toBe('/reset/[redacted]');
    expect(JSON.stringify(report.hydrationErrors)).not.toContain('q8w2e');
  });

  it('does not mistake a plain Angular app with lazy routes for Analog', () => {
    document.body.innerHTML = '<app-root ng-version="22"></app-root>';
    const router = {
      url: '/admin',
      config: [{ path: 'admin', loadChildren: () => null, _loadedRoutes: [{ path: '' }] }],
      routerState: { snapshot: { root: { routeConfig: null, data: {}, firstChild: null } } },
    };
    const ng = { getInjector: () => ({}), ɵgetRouterInstance: () => router };
    const scanner = vi.fn(() => ({ hydrated: 5 }));
    expect(collectAnalog(ng, 'p', [], scanner)).toMatchObject({ analog: false, hydrated: 0 });
    expect(scanner).not.toHaveBeenCalled();
    router.config.push(analogRoute('x', '/src/app/pages/x.page.ts') as never);
    expect(collectAnalog(ng, 'p', [], scanner)).toMatchObject({ analog: true, hydrated: 5 });
    expect(scanner).toHaveBeenCalledTimes(1);
    expect(
      hasAnalogMeta([{ path: 'x', _loadedRoutes: [analogRoute('', '/src/app/pages/x.page.ts')] }]),
    ).toBe(true);
  });

  it('reports hydration errors logged before it attached and through console.warn', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<app-root ng-version="22"></app-root>';
    const router = {
      url: '/',
      config: [analogRoute('', '/src/app/pages/index.page.ts')],
      routerState: { snapshot: { root: { routeConfig: null, data: {}, firstChild: null } } },
    };
    const ng = { getInjector: () => ({}), ɵgetRouterInstance: () => router };
    const registry = httpRegistry();
    const saved = registry.warnings;
    registry.warnings = [
      'Error: NG0500: During hydration Angular expected <div> but found <span>.',
      'NG0503: During serialization, Angular detected DOM nodes created outside of Angular.',
    ];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reports: { hydrationErrors: string[] }[] = [];
    const call = async (_name: string, report: unknown) =>
      void reports.push(report as { hydrationErrors: string[] });
    const detach = attachAnalog({ rpc: { call } } as never, 'p1', () => ng, 1000);
    try {
      expect(reports.at(-1)?.hydrationErrors).toEqual([
        'NG0500: During hydration Angular expected <div> but found <span>.',
        'NG0503: During serialization, Angular detected DOM nodes created outside of Angular.',
      ]);
      console.warn('NG0505: Angular hydration was requested on the client, but there was no info.');
      console.error(new Error('NG0500: During hydration Angular expected <div> but found <span>.'));
      vi.advanceTimersByTime(1000);
      expect(reports.at(-1)?.hydrationErrors).toEqual([
        'NG0500: During hydration Angular expected <div> but found <span>.',
        'NG0503: During serialization, Angular detected DOM nodes created outside of Angular.',
        'NG0505: Angular hydration was requested on the client, but there was no info.',
      ]);
    } finally {
      detach();
      registry.warnings = saved;
      warn.mockRestore();
      error.mockRestore();
      vi.useRealTimers();
    }
    expect(mergeHydrationErrors(undefined, ['NG0501: x', 'NG0501: x'])).toEqual(['NG0501: x']);
  });
});
