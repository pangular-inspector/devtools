import { describe, expect, it } from 'vitest';
import {
  noteFailedCall,
  redactText,
  setNavigationLimit,
  type NavigationRecord,
} from '../router.ts';
import { walkConfig, type RouteNode } from '../router-config.ts';
import { lintRoutes, listRoutesText, matchUrl, renderModeFor } from '../rpc/router-config-tools.ts';
import {
  describeNavigation,
  explainNavigationText,
  isRouterReport,
  plainReason,
  type RouterPage,
} from '../rpc/router-tools.ts';
import { parseServerRoutes } from '../rpc/server-routes.ts';

function node(fullPath: string, extra: Partial<RouteNode> = {}): RouteNode {
  const path = extra.path ?? fullPath.split('/').pop() ?? '';
  return { id: fullPath, path, fullPath, kind: 'component', component: 'C', ...extra };
}

function page(extra: Partial<RouterPage> = {}): RouterPage {
  return { pageId: 'p', snapshot: null, navigations: [], reportedAt: 1, changedAt: 1, ...extra };
}

function nav(id: number, extra: Partial<NavigationRecord> = {}): NavigationRecord {
  return {
    id,
    url: `/n${id}`,
    trigger: 'imperative',
    startedAt: id,
    outcome: 'succeeded',
    ...extra,
  };
}

describe('URL hygiene', () => {
  it('hides JWTs, bearer tokens and long opaque tokens, but not slugs or UUIDs', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    expect(redactText(`/cb/${jwt}`, [], 'url')).toBe('/cb/[redacted]');
    expect(redactText('Authorization failed: Bearer abc.def-123', [])).toBe(
      'Authorization failed: Bearer [redacted]',
    );
    expect(redactText('/reset/Ab3dEf7hIj9kLm1nOp5qRs7tUv9wXy2z', [], 'url')).toBe(
      '/reset/[redacted]',
    );
    expect(redactText('/blog/a-very-long-article-title-that-is-just-words', [], 'url')).toBe(
      '/blog/a-very-long-article-title-that-is-just-words',
    );
    expect(redactText('/users/550e8400-e29b-41d4-a716-446655440000', [], 'url')).toBe(
      '/users/550e8400-e29b-41d4-a716-446655440000',
    );
  });
});

describe('lint rules', () => {
  it('flags ordering, duplicates, redirects, guards and titles', () => {
    const config: RouteNode[] = [
      node('/', { path: '', kind: 'redirect', component: undefined, redirectTo: 'home' }),
      node('/home', { title: 'Home' }),
      node('/home', { title: 'Home' }),
      node('/old', {
        kind: 'lazy',
        lazy: 'unloaded',
        component: undefined,
        guards: { canLoad: ['legacyGuard'] },
      }),
      node('/about', { title: 'Home' }),
      node('/untitled'),
    ];
    const rules = lintRoutes(page({ config })).map((f) => f.rule);
    expect(rules).toEqual(
      expect.arrayContaining([
        'empty-redirect-prefix',
        'duplicate-path',
        'can-load',
        'missing-title',
        'duplicate-title',
      ]),
    );
    const missing = lintRoutes(page({ config })).find((f) => f.rule === 'missing-title')!;
    expect(missing.route).toContain('/untitled');
    expect(lintRoutes(page({ config })).filter((f) => f.rule === 'missing-title')).toHaveLength(1);
  });

  it('flags emails in URLs and return URLs taken from query params', () => {
    const navigations = [
      nav(1, { url: '/invite/ada@example.com' }),
      nav(2, { url: '/account', from: '/login?returnUrl=%2Faccount' }),
    ];
    const rules = lintRoutes(page({ config: [node('/x', { title: 'X' })], navigations })).map(
      (f) => f.rule,
    );
    expect(rules).toEqual(expect.arrayContaining(['email-in-url', 'redirect-from-query']));
  });

  it('only warns about chunks loaded before guards for loadChildren routes', () => {
    const config = [
      node('/admin', {
        kind: 'lazy',
        lazy: 'unloaded',
        component: undefined,
        title: 'Admin',
        guards: { canActivate: ['g'] },
      }),
      node('/settings', { lazy: 'unloaded', title: 'Settings', guards: { canActivate: ['g'] } }),
    ];
    const hits = lintRoutes(page({ config })).filter((f) => f.rule === 'chunk-before-guard');
    expect(hits.map((f) => f.route)).toEqual(['/admin']);
  });

  it('stays quiet on a clean config', () => {
    const config = [
      node('/', { path: '', title: 'Home' }),
      node('/a', { title: 'A' }),
      node('/**', { path: '**', title: 'Not found' }),
    ];
    expect(lintRoutes(page({ config }))).toEqual([]);
  });
});

describe('matching', () => {
  it('honors pathMatch full, redirects and empty paths', () => {
    const config = [
      node('/', {
        path: '',
        kind: 'redirect',
        component: undefined,
        redirectTo: 'home',
        pathMatch: 'full',
      }),
      node('/home'),
      node('/docs', {
        children: [
          node('/docs', { path: '', id: 'docs-index' }),
          node('/docs/:page', { path: ':page' }),
        ],
        kind: 'children',
        component: undefined,
      }),
    ];
    expect(matchUrl(config, '/').chain[0].redirectTo).toBe('home');
    expect(matchUrl(config, '/docs').chain.map((n) => n.id)).toEqual(['/docs', 'docs-index']);
    expect(matchUrl(config, '/docs/intro?x=1#top').params).toEqual({ page: 'intro' });
    expect(matchUrl(config, '/home/extra').matched).toBe(false);
  });
});

describe('server routes', () => {
  it('parses ServerRoute entries in either property order', () => {
    const source = `
      export const serverRoutes: ServerRoute[] = [
        { path: 'products/:id', renderMode: RenderMode.Client },
        // { path: 'commented', renderMode: RenderMode.Server },
        { renderMode: RenderMode.Server, path: 'account' },
        { path: '**', renderMode: RenderMode.Prerender },
      ];`;
    const entries = parseServerRoutes(source, 'app.routes.server.ts');
    expect(entries.map((e) => `${e.path}:${e.renderMode}`)).toEqual([
      'products/:id:Client',
      '**:Prerender',
      'account:Server',
    ]);
    expect(renderModeFor(entries, '/products/7')?.renderMode).toBe('Client');
    expect(renderModeFor(entries, '/account')?.renderMode).toBe('Server');
    expect(renderModeFor(entries, '/anything/else')?.renderMode).toBe('Prerender');
  });

  it('keeps entries that carry a function body or a nested object', () => {
    const source = `
      export const serverRoutes: ServerRoute[] = [
        {
          path: 'post/:id',
          renderMode: RenderMode.Prerender,
          getPrerenderParams: async () => { return [{ id: '1' }]; },
        },
        { renderMode: RenderMode.Server, headers: { 'x-a': 'b' }, status: 200, path: 'account' },
        { path: '**', renderMode: RenderMode.Server },
      ];`;
    const entries = parseServerRoutes(source, 'app.routes.server.ts');
    expect(entries.map((e) => `${e.path}:${e.renderMode}`).sort()).toEqual([
      '**:Server',
      'account:Server',
      'post/:id:Prerender',
    ]);
  });
});

describe('explanations', () => {
  it('explains skips with the deciding setting', () => {
    const setup = {
      mode: 'full' as const,
      setupKind: 'provideRouter' as const,
      routers: 1,
      options: [{ name: 'onSameUrlNavigation', value: 'ignore', set: false }],
      features: {},
      strategies: {},
    };
    expect(
      plainReason(nav(1, { outcome: 'skipped', code: 'IgnoredSameUrlNavigation' }), setup),
    ).toContain("onSameUrlNavigation is `ignore` (the default); set it to 'reload'");
    expect(plainReason(nav(2, { code: 'NoDataFromResolver' }))).toContain(
      'without emitting a value',
    );
  });

  it('follows redirect chains and detects loops', () => {
    const navigations = [
      nav(1, { url: '/a', outcome: 'redirected', redirectTo: '/b' }),
      nav(2, { url: '/b', outcome: 'redirected', redirectedFrom: 1, redirectTo: '/a' }),
      nav(3, { url: '/a', outcome: 'redirected', redirectedFrom: 2 }),
    ];
    const p = page({ navigations });
    expect(describeNavigation(navigations[2], p)).toContain('**redirect loop** `/a` → `/b` → `/a`');
  });

  it('summarizes slow navigations', () => {
    const navigations = [
      nav(1, { phases: { recognize: 5, resolve: 400, total: 420 }, lazyLoaded: ['admin'] }),
      nav(2, { phases: { total: 10 } }),
    ];
    const text = explainNavigationText(
      {
        pages: [
          page({
            navigations,
            snapshot: {
              url: '/',
              queryParams: {},
              fragment: null,
              root: { path: '', url: '', outlet: 'primary', params: {}, data: {}, children: [] },
            },
          }),
        ],
      },
      { perf: true },
      2,
    );
    expect(text).toContain('#1 `/n1` 420ms, mostly resolve (400ms), lazy loaded `admin`');
  });
});

describe('report validation', () => {
  const base = { pageId: 'p', snapshot: null, navigations: [] };
  it('rejects malformed new fields', () => {
    for (const bad of [
      { ...base, config: [{ id: '0', path: 1 }] },
      { ...base, activeIds: [1] },
      { ...base, setup: 'x' },
      { ...base, links: Array.from({ length: 101 }, () => ({ text: 'x' })) },
      { ...base, navigations: [nav(1, { phases: { total: 'fast' as never } })] },
      { ...base, navigations: [nav(1, { checked: { activate: 'x' as never, deactivate: [] } })] },
      { ...base, navigations: [nav(1, { requests: { count: 1, urls: [1 as never] } })] },
      { ...base, instrumented: 'yes' },
    ]) {
      expect(isRouterReport(bad)).toBe(false);
    }
    expect(
      isRouterReport({ ...base, config: [node('/a')], activeIds: ['/a'], instrumented: true }),
    ).toBe(true);
  });

  it('accepts the config the page walks when a level has more than 200 routes', () => {
    const routes = (n: number, prefix: string) =>
      Array.from({ length: n }, (_, i) => ({ path: `${prefix}${i}` }));
    for (const config of [
      routes(201, 'r'),
      [{ path: 'admin', children: routes(150, 'c'), _loadedRoutes: routes(60, 'l') }],
    ]) {
      const cut = { routes: 0 };
      const tree = walkConfig({ config }, cut);
      expect(cut.routes).toBe(config.length === 1 ? 10 : 1);
      expect(isRouterReport({ ...base, config: tree, configTruncated: cut.routes })).toBe(true);
    }
    const deep = { routes: 0 };
    walkConfig(
      {
        config: [
          ...routes(200, 'r'),
          { path: 'shop', children: routes(50, 'c') },
          {
            path: 'admin',
            loadChildren: () => [],
            _loadedRoutes: [{ path: 'x', children: routes(3, 'y') }],
          },
        ],
      },
      deep,
    );
    expect(deep.routes).toBe(51 + 5);
    const cut = { routes: 0 };
    walkConfig({ config: routes(200, 'r') }, cut);
    expect(cut.routes).toBe(0);
    expect(isRouterReport({ ...base, configTruncated: 'many' })).toBe(false);
  });

  it('says how many routes the page left out', () => {
    const text = listRoutesText(
      { pages: [page({ config: [node('/a')], configTruncated: 12 })] },
      {},
    );
    expect(text).toContain('12 route(s) were left out');
    expect(listRoutesText({ pages: [page({ config: [node('/a')] })] }, {})).not.toContain(
      'left out',
    );
  });

  it('warns about left-out routes when matching a URL and auditing', () => {
    const state = { pages: [page({ config: [node('/a')], configTruncated: 12 })] };
    const miss = listRoutesText(state, { match: '/b' });
    expect(miss).toContain('12 route(s) were left out');
    expect(miss).toContain('matches no route in the reported part of the config');
    expect(miss).not.toContain('NG04002');
    expect(listRoutesText(state, { match: '/a' })).toContain('12 route(s) were left out');
    expect(listRoutesText(state, { audit: true })).toContain('12 route(s) were left out');
    const full = listRoutesText({ pages: [page({ config: [node('/a')] })] }, { match: '/b' });
    expect(full).toContain('NG04002');
    expect(full).not.toContain('left out');
  });

  it('accepts as many navigations as the configured limit', () => {
    const report = { ...base, navigations: Array.from({ length: 60 }, (_, i) => nav(i + 1)) };
    expect(isRouterReport(report)).toBe(false);
    expect(isRouterReport(report, 100)).toBe(true);
  });
});

describe('failed calls', () => {
  it('get unique ids even after the list is capped', () => {
    const list: NavigationRecord[] = [];
    for (let i = 0; i < 60; i++) noteFailedCall(list, `/x/${i}`, new Error('nope'), i);
    expect(list).toHaveLength(50);
    expect(new Set(list.map((n) => n.id)).size).toBe(50);
    expect(list.every((n) => n.id < 0)).toBe(true);
  });

  it('follow the configured navigation limit', () => {
    const list: NavigationRecord[] = [];
    setNavigationLimit(10);
    try {
      for (let i = 0; i < 20; i++) noteFailedCall(list, `/x/${i}`, new Error('nope'), i);
    } finally {
      setNavigationLimit(50);
    }
    expect(list).toHaveLength(10);
  });
});

describe('route sources', () => {
  it('cites the child, not its componentless parent, when both share a full path', () => {
    const child = node('/admin', { id: '0.0', path: '', component: 'AdminHome' });
    const parent = node('/admin', {
      id: '0',
      path: 'admin',
      kind: 'children',
      component: undefined,
      children: [child],
    });
    const text = listRoutesText({ pages: [page({ config: [parent] })] }, {}, [
      { path: 'admin', fullPath: '/admin', file: 'app.routes.ts', line: 3 },
      { path: '', fullPath: '/admin', component: 'AdminHome', file: 'app.routes.ts', line: 6 },
    ]);
    const lines = text.split('\n');
    expect(lines.find((l) => l.includes('AdminHome'))).toContain('app.routes.ts:6');
    expect(lines.find((l) => l.includes('/admin') && !l.includes('AdminHome'))).toContain(
      'app.routes.ts:3',
    );
  });
});
