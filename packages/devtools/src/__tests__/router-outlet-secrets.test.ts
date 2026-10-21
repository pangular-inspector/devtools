// @vitest-environment jsdom
import '@angular/compiler';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, type Routes } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectAnalog } from '../analog-runtime.ts';
import {
  chainOf,
  configSecretsFor,
  secretParamsOf,
  snapshotRouter,
  watchRouter,
  type NavigationRecord,
} from '../router.ts';
import { initAngularTestBed, STANDALONE } from './angular-version.ts';
import { functionalRouter } from './router-testing.ts';

type Node = Record<string, unknown>;

/** An ActivatedRouteSnapshot as Angular builds it: primary child first, then named outlets. */
function snapshot(
  path: string | null,
  params: Node = {},
  children: Node[] = [],
  outlet = 'primary',
) {
  const url = (path ?? '')
    .split('/')
    .filter(Boolean)
    .map((part) => ({ path: part.startsWith(':') ? String(params[part.slice(1)]) : part }));
  return {
    routeConfig: path === null ? null : { path },
    params,
    data: {},
    url,
    outlet,
    queryParams: {},
    fragment: null,
    children,
    firstChild: children[0] ?? null,
  } as Node;
}

describe('secret params in named outlets (fake ng)', () => {
  const tree = () =>
    snapshot(null, {}, [
      snapshot('inbox', {}, [
        snapshot(':id', { id: '7' }),
        snapshot('reset/:token', { token: 'NESTEDFAKE41' }, [], 'detail'),
      ]),
      snapshot('reset/:token', { token: 'SIDEFAKE42' }, [], 'side'),
    ]);

  it('collects the secret params of every outlet, not only the primary chain', () => {
    expect(secretParamsOf(tree())).toEqual(['NESTEDFAKE41', 'SIDEFAKE42']);
  });

  it('masks them in the router snapshot and the Analog report', () => {
    document.body.innerHTML = '<app-root ng-version="22"></app-root>';
    const router = {
      url: '/inbox/(7//detail:reset/NESTEDFAKE41)(side:reset/SIDEFAKE42)',
      config: [],
      routerState: { snapshot: { root: tree() } },
    };
    const routerSnapshot = snapshotRouter(router)!;
    expect(routerSnapshot.url).toBe('/inbox/(7//detail:reset/[redacted])(side:reset/[redacted])');
    const side = routerSnapshot.root.children[1];
    expect(side).toMatchObject({ outlet: 'side', url: 'reset/[redacted]' });
    expect(side.params).toEqual({ token: '[redacted]' });
    const ng = { getInjector: () => ({}), ɵgetRouterInstance: () => router };
    const report = collectAnalog(ng, 'p1', [])!;
    expect(report.url).toBe('/inbox/(7//detail:reset/[redacted])(side:reset/[redacted])');
    expect(JSON.stringify({ routerSnapshot, report })).not.toMatch(/NESTEDFAKE41|SIDEFAKE42/);
  });

  it('walks firstChild when children is missing, and stops on a cyclic tree', () => {
    const leaf = snapshot('reset/:token', { token: 'FIRSTCHILD43' });
    const parent: Node = { ...snapshot('a'), children: undefined, firstChild: leaf };
    expect(secretParamsOf(parent)).toEqual(['FIRSTCHILD43']);
    const loop = snapshot('loop');
    loop['children'] = [loop, loop, { ...loop, outlet: 'side' }];
    expect(chainOf(loop).length).toBeLessThanOrEqual(200);
  });
});

initAngularTestBed();

class Page {}
Component({ ...STANDALONE, selector: 'app-outlet-page', template: '' })(Page);

const routes: Routes = [
  { path: '', component: Page },
  { path: 'login', component: Page },
  {
    path: 'inbox',
    component: Page,
    children: [
      { path: ':id', component: Page },
      { path: 'reset/:token', component: Page, outlet: 'detail' },
    ],
  },
  { path: 'vault/:apiKey', component: Page, outlet: 'side' },
  {
    path: 'reset/:token',
    component: Page,
    outlet: 'side',
    canMatch: [() => inject(Router).parseUrl('/login')],
  },
];

describe.runIf(functionalRouter)('secret params in named outlets (real Router)', () => {
  let router: Router;
  let navigations: NavigationRecord[];
  let stop: (() => void) | null;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    router = TestBed.inject(Router);
    navigations = [];
    stop = watchRouter(router as never, navigations, () => {});
    await router.navigateByUrl('/');
  });

  afterEach(() => stop?.());

  it('finds secret path params of named outlets in the router config', () => {
    expect(configSecretsFor(router as never, '/(side:reset/CONFIGSIDE51)')).toEqual([
      'CONFIGSIDE51',
    ]);
    expect(configSecretsFor(router as never, '/inbox/(7//detail:reset/CONFIGNEST52)')).toEqual([
      'CONFIGNEST52',
    ]);
    expect(configSecretsFor(router as never, '/(detail:reset/WRONGOUTLET53)')).toEqual([]);
  });

  it('masks a named outlet param in the snapshot and the navigation', async () => {
    await router.navigateByUrl('/(side:vault/OUTLETKEY54)');
    const routerSnapshot = snapshotRouter(router as never)!;
    expect(routerSnapshot.url).toBe('/(side:vault/[redacted])');
    const side = routerSnapshot.root.children.find((child) => child.outlet === 'side');
    expect(side?.params).toEqual({ apiKey: '[redacted]' });
    expect(navigations.at(-1)).toMatchObject({ url: '/(side:vault/[redacted])' });
    expect(JSON.stringify({ routerSnapshot, navigations })).not.toContain('OUTLETKEY54');
  });

  it('masks a named outlet param before the route is recognized', async () => {
    // canMatch redirects, so the route never activates and only the config match can mask it.
    await router.navigateByUrl('/(side:reset/UNRECOGNIZED55)');
    expect(JSON.stringify(navigations)).not.toContain('UNRECOGNIZED55');
  });
});

class Shell {}
Component({ ...STANDALONE, selector: 'app-outlet-shell', template: '' })(Shell);

/** A layout route with an empty path whose children hold a named outlet. */
const shellRoutes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: 'home', component: Page },
      { path: 'reset/:token', component: Page, outlet: 'side' },
    ],
  },
  {
    path: 'admin',
    component: Shell,
    children: [{ path: 'key/:apiKey', component: Page, outlet: 'side' }],
  },
];

describe.runIf(functionalRouter)('secret params under an empty-path layout (real Router)', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(shellRoutes)] });
    router = TestBed.inject(Router);
  });

  /** The params of every activated route, so the test proves Angular matched the URL too. */
  const activeParams = () =>
    chainOf(router.routerState.snapshot.root as never).map((route) => ({ ...route['params'] }));

  it.each([
    ['/(side:reset/SHELLSIDE61)', 'SHELLSIDE61'],
    ['/home(side:reset/SHELLSIDE62)', 'SHELLSIDE62'],
  ])('matches %s like the router does', async (url, secret) => {
    expect(await router.navigateByUrl(url)).toBe(true);
    expect(activeParams()).toContainEqual({ token: secret });
    expect(configSecretsFor(router as never, url)).toEqual([secret]);
  });

  it('does not let a named outlet through a route with a path', async () => {
    // Angular only lets an empty-path route match for another outlet.
    await expect(router.navigateByUrl('/(side:key/NOMATCH63)')).rejects.toThrow();
    expect(configSecretsFor(router as never, '/(side:key/NOMATCH63)')).toEqual([]);
  });
});
