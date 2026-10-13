// @vitest-environment jsdom
import '@angular/compiler';
import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { routerOf } from '../analog-runtime.ts';
import { findRouter, type RouterDebugApi } from '../router.ts';
import { detectSetup } from '../router-setup.ts';
import { zonelessProviders, STANDALONE } from './angular-version.ts';
import { functionalRouter, injectorProviders } from './router-testing.ts';

class Root {}
Component({ ...STANDALONE, selector: 'app-root', template: '' })(Root);

// provideRouter exists from 14.2.
describe.runIf(functionalRouter)('a provideRouter app without the router util', () => {
  let app: Awaited<ReturnType<typeof bootstrapApplication>>;
  let ng: RouterDebugApi;
  let util: unknown;

  beforeEach(async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(Root, {
      providers: [...zonelessProviders(), provideRouter([{ path: '', component: Root }])],
    });
    const published = (globalThis as { ng?: RouterDebugApi & Record<string, unknown> }).ng!;
    util = published['ɵgetRouterInstance'];
    delete published['ɵgetRouterInstance'];
    ng = {
      getInjector: published.getInjector,
      ɵgetInjectorResolutionPath: published.ɵgetInjectorResolutionPath,
      ɵgetInjectorProviders: published.ɵgetInjectorProviders,
    };
  });

  afterEach(() => {
    (globalThis as { ng?: Record<string, unknown> }).ng!['ɵgetRouterInstance'] = util;
    app.destroy();
  });

  it('finds the router of a provideRouter app without ng.ɵgetRouterInstance', () => {
    const roots = [document.querySelector('app-root')!];
    // Before 16.2 only a component or link holding the Router finds it; this root holds none.
    const expected = injectorProviders ? app.injector.get(Router) : null;
    expect(findRouter(ng, roots)).toBe(expected);
    expect(routerOf(ng as never)).toBe(expected);
  });

  it.each(['20.3.4', '20.3.5'])(
    'reports provideRouter from the root ROUTES when the router util is missing on %s',
    (version) => {
      const root = document.querySelector('app-root')!;
      root.setAttribute('ng-version', version);
      // ROUTES is a provider (16.2+). Before, 20.3.5 and later tell the setup
      // apart by the router util, and an older version can't.
      const expected = injectorProviders
        ? 'provideRouter'
        : version === '20.3.5'
          ? 'forRoot or other'
          : 'unknown';
      expect(detectSetup(ng, app.injector.get(Router) as never, 1, root).setupKind).toBe(expected);
    },
  );

  it('reports unknown when neither the util nor the providers tell the setup apart', () => {
    const root = document.querySelector('app-root')!;
    root.setAttribute('ng-version', '20.3.4');
    const bare: RouterDebugApi = { ...ng, ɵgetInjectorProviders: () => [] };
    expect(detectSetup(bare, app.injector.get(Router) as never, 1, root).setupKind).toBe('unknown');
  });
});
