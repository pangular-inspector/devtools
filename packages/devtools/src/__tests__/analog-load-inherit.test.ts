// @vitest-environment jsdom
import '@angular/compiler';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { Router, RouterOutlet, provideRouter, type Route, type Routes } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { ANALOG_META_DESCRIPTION, chainOf, collectAnalog } from '../analog-runtime.ts';
import { scanAnalog } from '../rpc/analog-scan.ts';
import { resolveAnalogReport } from '../rpc/analog-tools.ts';
import { BASE_FILES, makeProject } from './analog-fixture.ts';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const META = Symbol(ANALOG_META_DESCRIPTION);

function analogRoute(endpoint: string, endpointKey: string, route: Route): Route {
  return Object.assign(route, { [META]: { endpoint, endpointKey } });
}

class ProductsLayout {}
Component({ imports: [RouterOutlet], template: '<router-outlet />' })(ProductsLayout);

class ProductList {}
Component({ template: '<p>list</p>' })(ProductList);

describe('Analog load() of a layout', () => {
  it('stays with the layout when an empty-path child page inherits it', async () => {
    const routes: Routes = [
      {
        path: 'products',
        children: [
          analogRoute('/pages/products', '/src/app/pages/products.server.ts', {
            path: '',
            component: ProductsLayout,
            resolve: { load: () => ({ items: [1, 2] }) },
            children: [
              analogRoute('/pages/products/index', '/src/app/pages/products/index.server.ts', {
                path: '',
                component: ProductList,
              }),
            ],
          }),
        ],
      },
    ];
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/products');

    const { chain, data, loadFrom } = chainOf(
      router.routerState.snapshot.root as unknown as Record<string, any>,
    );
    expect(chain.map((c) => c.serverFile)).toEqual([
      '/src/app/pages/products.server.ts',
      '/src/app/pages/products/index.server.ts',
    ]);
    expect(data).toEqual({ items: [1, 2] });
    // The list page has no .server.ts: its `data.load` is the layout's,
    // inherited by Angular because its path is empty.

    document.body.innerHTML = '<app-root ng-version="22"></app-root>';
    const project = scanAnalog(
      makeProject(BASE_FILES, {
        'src/app/pages/products.server.ts': 'export const load = async () => ({ items: [] });\n',
      }),
    );
    const report = collectAnalog(
      { ɵgetRouterInstance: () => router, getInjector: () => null },
      'p1',
      [],
      () => ({ hydrated: 0 }),
    )!;
    expect(report.load?.keys).toEqual(['items']);
    expect(resolveAnalogReport(project, report).load?.keys).toEqual(['items']);
    expect(loadFrom).toBe(0);
  });

  it('credits the child when it resolves its own load, even to the same object', async () => {
    const cached = { items: [1, 2] };
    const routes: Routes = [
      {
        path: 'products',
        children: [
          analogRoute('/pages/products', '/src/app/pages/products.server.ts', {
            path: '',
            component: ProductsLayout,
            resolve: { load: () => cached },
            children: [
              analogRoute('/pages/products/index', '/src/app/pages/products/index.server.ts', {
                path: '',
                component: ProductList,
                resolve: { load: () => cached },
              }),
            ],
          }),
        ],
      },
    ];
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/products');
    const { loadFrom } = chainOf(
      router.routerState.snapshot.root as unknown as Record<string, any>,
    );
    expect(loadFrom).toBe(1);
  });
});
