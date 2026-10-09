// @vitest-environment jsdom
import '@angular/compiler';
import { Component, importProvidersFrom, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { PreloadAllModules, Router, RouterModule, type ExtraOptions } from '@angular/router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { routerOf } from '../analog-runtime.ts';
import { findRouter, type RouterDebugApi } from '../router.ts';
import { detectSetup, publishesRouterUtil } from '../router-setup.ts';

class Root {}
Component({ selector: 'app-root', template: '' })(Root);

let app: Awaited<ReturnType<typeof bootstrapApplication>>;
let ng: RouterDebugApi;

async function boot(options?: ExtraOptions) {
  document.body.innerHTML = '<app-root></app-root>';
  app = await bootstrapApplication(Root, {
    providers: [
      provideZonelessChangeDetection(),
      importProvidersFrom(RouterModule.forRoot([{ path: '', component: Root }], options)),
    ],
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

it('finds the router of a RouterModule.forRoot app through the injector chain', () => {
  expect((globalThis as { ng?: RouterDebugApi }).ng!.ɵgetRouterInstance).toBeUndefined();
  expect(findRouter(ng, [document.querySelector('app-root')!])).toBe(app.injector.get(Router));
});

it('finds the router for the Analog report without ng.ɵgetRouterInstance', () => {
  expect(routerOf(ng as never)).toBe(app.injector.get(Router));
});

it('reports forRoot from its guard token on every version, with or without the router util', () => {
  const root = document.querySelector('app-root')!;
  const setupOn = (version: string) => {
    root.setAttribute('ng-version', version);
    return detectSetup(ng, app.injector.get(Router) as never, 1, root).setupKind;
  };
  expect(setupOn('22.1.7')).toBe('forRoot or other');
  expect(setupOn('20.3.5')).toBe('forRoot or other');
  expect(setupOn('20.3.4')).toBe('forRoot or other');
  expect(setupOn('20.0.0')).toBe('forRoot or other');
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
  expect(values).toMatchObject({
    initialNavigation: ['enabledBlocking', true],
    scrollPositionRestoration: ['top', true],
    anchorScrolling: ['enabled', true],
    onSameUrlNavigation: ['reload', true],
    paramsInheritanceStrategy: ['always', true],
  });
  expect(setup.features).toMatchObject({
    componentInputBinding: 'on',
    viewTransitions: 'on',
    preloading: 'PreloadAllModules',
    scroller: 'on',
    debugTracing: 'on',
    platformNavigation: 'off',
  });
  expect(setup.strategies['locationStrategy']).toBe('HashLocationStrategy');
});
