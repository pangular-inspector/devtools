// @vitest-environment jsdom
import '@angular/compiler';
import { APP_BASE_HREF } from '@angular/common';
import { Component } from '@angular/core';
import { PreloadAllModules, Router, RouterModule, type ExtraOptions } from '@angular/router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { routerOf } from '../analog-runtime.ts';
import { findRouter, type RouterDebugApi } from '../router.ts';
import { detectSetup, publishesRouterUtil } from '../router-setup.ts';
import { angularAtLeast, bootstrapRoot, STANDALONE, type BootedApp } from './angular-version.ts';
import { injectorProviders } from './router-testing.ts';

class Root {}
Component({ ...STANDALONE, selector: 'app-root', template: '' })(Root);

let app: BootedApp;
let ng: RouterDebugApi;

async function boot(options?: ExtraOptions) {
  document.body.innerHTML = '<app-root></app-root>';
  app = await bootstrapRoot(Root, {
    providers: [{ provide: APP_BASE_HREF, useValue: '/' }],
    modules: [RouterModule.forRoot([{ path: '', component: Root }], options)],
  });
  const published = (globalThis as { ng?: RouterDebugApi }).ng!;
  ng = {
    getInjector: published.getInjector,
    ɵgetInjectorResolutionPath: published.ɵgetInjectorResolutionPath,
    ɵgetInjectorProviders: published.ɵgetInjectorProviders,
  };
}

beforeEach(() => boot());

afterEach(() => app.destroy());

// Before 16.2 the Router is only found when a component or router link holds
// it (router-fallback.ts); this root holds nothing, so there is no router data.
const found = () => (injectorProviders ? app.injector.get(Router) : null);

it('finds the router of a RouterModule.forRoot app through the injector chain', () => {
  expect((globalThis as { ng?: RouterDebugApi }).ng!.ɵgetRouterInstance).toBeUndefined();
  expect(findRouter(ng, [document.querySelector('app-root')!])).toBe(found());
});

it('finds the router for the Analog report without ng.ɵgetRouterInstance', () => {
  expect(routerOf(ng as never)).toBe(found());
});

it('finds the router a root component holds on every version', async () => {
  app.destroy();
  class Holder {
    constructor(readonly router: Router) {}
  }
  Component({ ...STANDALONE, selector: 'app-root', template: '' })(Holder);
  (Holder as unknown as { ctorParameters: () => unknown[] }).ctorParameters = () => [
    { type: Router },
  ];
  document.body.innerHTML = '<app-root></app-root>';
  app = await bootstrapRoot(Holder, {
    providers: [{ provide: APP_BASE_HREF, useValue: '/' }],
    modules: [RouterModule.forRoot([])],
  });
  const published = (globalThis as { ng?: RouterDebugApi }).ng!;
  expect(findRouter(published, [document.querySelector('app-root')!])).toBe(
    app.injector.get(Router),
  );
});

it('reports forRoot from its guard token on every version, with or without the router util', () => {
  const root = document.querySelector('app-root')!;
  const setupOn = (version: string) => {
    root.setAttribute('ng-version', version);
    return detectSetup(ng, app.injector.get(Router) as never, 1, root).setupKind;
  };
  // The guard token is a provider, read through ɵgetInjectorProviders (16.2+).
  // Without it, a version that publishes the router util tells forRoot apart
  // by the util's absence; an older one can't tell.
  expect(setupOn('22.1.7')).toBe('forRoot or other');
  expect(setupOn('20.3.5')).toBe('forRoot or other');
  expect(setupOn('20.3.4')).toBe(injectorProviders ? 'forRoot or other' : 'unknown');
  expect(setupOn('20.0.0')).toBe(injectorProviders ? 'forRoot or other' : 'unknown');
});

it('knows which versions publish the router util', () => {
  expect(publishesRouterUtil('20.3.5')).toBe(true);
  expect(publishesRouterUtil('21.0.0-next.1')).toBe(true);
  expect(publishesRouterUtil('20.3.4')).toBe(false);
  expect(publishesRouterUtil(undefined)).toBe(false);
});

it('reads the RouterModule.forRoot options on a real Router', async () => {
  app.destroy();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'group').mockImplementation(() => {});
  vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  await boot({
    initialNavigation: 'enabledBlocking',
    enableTracing: true,
    useHash: true,
    bindToComponentInputs: true,
    enableViewTransitions: true,
    preloadingStrategy: PreloadAllModules,
    scrollPositionRestoration: 'top',
    anchorScrolling: 'enabled',
    onSameUrlNavigation: 'reload',
    paramsInheritanceStrategy: 'always',
  });
  const root = document.querySelector('app-root')!;
  const setup = detectSetup(ng, app.injector.get(Router) as never, 1, root);
  vi.restoreAllMocks();
  const values = Object.fromEntries(setup.options.map((o) => [o.name, [o.value, o.set]]));
  if (angularAtLeast('15.0')) {
    expect(values).toMatchObject({
      initialNavigation: ['enabledBlocking', true],
      scrollPositionRestoration: ['top', true],
      anchorScrolling: ['enabled', true],
      onSameUrlNavigation: ['reload', true],
      paramsInheritanceStrategy: ['always', true],
    });
  } else {
    // Router.options holds the forRoot options from 15.0. Before, only the
    // options the Router keeps as fields are read, and none shows as set.
    expect(values).toMatchObject({
      initialNavigation: ['enabledNonBlocking', false],
      scrollPositionRestoration: ['disabled', false],
      anchorScrolling: ['disabled', false],
      onSameUrlNavigation: ['reload', false],
      paramsInheritanceStrategy: ['always', false],
    });
  }
  // Each option exists from the version named; preloading and the scroller are
  // found through their providers (16.2).
  const on = (since: string, value = 'on') => (angularAtLeast(since) ? value : 'off');
  expect(setup.features).toMatchObject({
    componentInputBinding: on('16.0'),
    viewTransitions: on('17.0'),
    preloading: on('16.2', 'PreloadAllModules'),
    scroller: on('16.2'),
    debugTracing: on('15.0'),
    platformNavigation: 'off',
  });
  expect(setup.strategies['locationStrategy']).toBe('HashLocationStrategy');
});
