// @vitest-environment jsdom
import '@angular/compiler';
import { HashLocationStrategy, PlatformNavigation } from '@angular/common';
import { Component, type EnvironmentProviders, type Provider } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  PreloadAllModules,
  Router,
  provideRouter,
  withComponentInputBinding,
  withDebugTracing,
  withDisabledInitialNavigation,
  withEnabledBlockingInitialNavigation,
  withHashLocation,
  withInMemoryScrolling,
  withNavigationErrorHandler,
  withPreloading,
  withRouterConfig,
  withViewTransitions,
  type RouterFeatures,
} from '@angular/router';
import * as router from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RouterDebugApi } from '../router.ts';
import { detectSetup, type RouterSetup } from '../router-setup.ts';
import { angularAtLeast, zonelessProviders, STANDALONE } from './angular-version.ts';
import { functionalRouter, injectorProviders } from './router-testing.ts';

const optionalRouter: Partial<typeof router> = router;
const withExperimentalAutoCleanupInjectors = optionalRouter.withExperimentalAutoCleanupInjectors;
const withExperimentalPlatformNavigation = optionalRouter.withExperimentalPlatformNavigation;
const withRouterResources = optionalRouter.ɵwithRouterResources;

class Root {}
Component({ ...STANDALONE, selector: 'app-root', template: '' })(Root);

const routes = [{ path: '', component: Root }];
let destroy: (() => void) | null = null;

afterEach(() => {
  destroy?.();
  destroy = null;
});

async function setupWith(
  features: RouterFeatures[],
  extra: (Provider | EnvironmentProviders)[] = [],
): Promise<RouterSetup> {
  document.body.innerHTML = '<app-root></app-root>';
  const app = await bootstrapApplication(Root, {
    providers: [...zonelessProviders(), provideRouter(routes, ...features), ...extra],
  });
  destroy = () => app.destroy();
  const ng = (globalThis as { ng?: RouterDebugApi }).ng!;
  const root = document.querySelector('app-root');
  return detectSetup(ng, app.injector.get(Router) as never, 1, root);
}

const option = (setup: RouterSetup, name: string) => setup.options.find((o) => o.name === name);

/**
 * What the overlay reads for each feature, and the first version it can: from
 * the Router's own fields once the feature stores one there, else from the
 * providers (`ɵgetInjectorProviders`, 16.2). Before that the feature reads `off`.
 */
const READABLE_FROM: Record<string, string> = {
  componentInputBinding: '16.0',
  viewTransitions: '17.0',
  // Before 18.0 the handler is an environment initializer the Router does not hold.
  navigationErrorHandler: '18.0',
  routerResources: '20.0',
  injectorCleanup: '20.0',
  preloading: '16.2',
  scroller: '16.2',
};

// `provideRouter` and its features exist from 14.2.
describe.runIf(functionalRouter)('detectSetup on a real provideRouter app', () => {
  it('reports defaults when no feature is used', async () => {
    const setup = await setupWith([]);
    // Before 16.2 nothing tells provideRouter apart, and only router events are read.
    expect(setup.setupKind).toBe(injectorProviders ? 'provideRouter' : 'unknown');
    expect(setup.mode).toBe(injectorProviders ? 'full' : 'events-only');
    expect(option(setup, 'initialNavigation')).toEqual({
      name: 'initialNavigation',
      value: 'enabledNonBlocking',
      set: false,
    });
    expect(setup.features).toEqual({
      componentInputBinding: 'off',
      viewTransitions: 'off',
      navigationErrorHandler: 'off',
      routerResources: 'off',
      injectorCleanup: 'off',
      preloading: 'off',
      scroller: 'off',
      debugTracing: 'off',
      platformNavigation: 'off',
    });
    expect(setup.strategies['locationStrategy']).toBe('PathLocationStrategy');
  });

  it('reads the initial navigation mode of withEnabledBlockingInitialNavigation()', async () => {
    const setup = await setupWith([withEnabledBlockingInitialNavigation()]);
    // The mode is read from a provider, so before 16.2 the default shows.
    expect(option(setup, 'initialNavigation')).toMatchObject(
      injectorProviders
        ? { value: 'enabledBlocking', set: true }
        : { value: 'enabledNonBlocking', set: false },
    );
  });

  it('reads the initial navigation mode of withDisabledInitialNavigation()', async () => {
    const setup = await setupWith([withDisabledInitialNavigation()]);
    expect(option(setup, 'initialNavigation')).toMatchObject(
      injectorProviders
        ? { value: 'disabled', set: true }
        : { value: 'enabledNonBlocking', set: false },
    );
  });

  it('detects withDebugTracing()', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    const setup = await setupWith([withDebugTracing()]);
    // withDebugTracing() is found in the injector records on the resolution path (16.2).
    expect(setup.features['debugTracing']).toBe(injectorProviders ? 'on' : 'off');
    vi.restoreAllMocks();
  });

  it.each(
    (
      [
        ['componentInputBinding', withComponentInputBinding, 'on'],
        ['viewTransitions', withViewTransitions, 'on'],
        ['navigationErrorHandler', () => withNavigationErrorHandler(() => {}), 'on'],
        ['routerResources', withRouterResources, 'on'],
        ['injectorCleanup', withExperimentalAutoCleanupInjectors, 'on'],
        ['preloading', () => withPreloading(PreloadAllModules), 'PreloadAllModules'],
        ['scroller', () => withInMemoryScrolling({ anchorScrolling: 'enabled' }), 'on'],
      ] as const
    ).filter(([, feature]) => typeof feature === 'function'),
  )('detects the %s feature', async (name, feature, value) => {
    const setup = await setupWith([(feature as () => unknown)() as RouterFeatures]);
    expect(setup.features[name]).toBe(angularAtLeast(READABLE_FROM[name]!) ? value : 'off');
  });

  it.skipIf(typeof withExperimentalPlatformNavigation !== 'function')(
    'detects withExperimentalPlatformNavigation()',
    async () => {
      const navigation = Object.assign(new EventTarget(), {
        currentEntry: {
          url: 'http://localhost/',
          key: '0',
          id: '0',
          index: 0,
          getState: () => null,
        },
        entries: () => [],
        transition: null,
        navigate: () => ({ committed: Promise.resolve(), finished: Promise.resolve() }),
      });
      const setup = await setupWith(
        [withExperimentalPlatformNavigation!()],
        [{ provide: PlatformNavigation, useValue: navigation }],
      );
      expect(setup.features['platformNavigation']).toBe('on');
    },
  );

  it('reads scrolling options and withRouterConfig() options', async () => {
    const setup = await setupWith([
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      withRouterConfig({
        onSameUrlNavigation: 'reload',
        paramsInheritanceStrategy: 'always',
        urlUpdateStrategy: 'eager',
        canceledNavigationResolution: 'computed',
        defaultQueryParamsHandling: 'merge',
        resolveNavigationPromiseOnError: true,
      }),
    ]);
    const values = Object.fromEntries(setup.options.map((o) => [o.name, [o.value, o.set]]));
    // The scroll options come from the RouterScroller, found through its provider (16.2).
    const scroll = (value: string, fallback: string) =>
      injectorProviders ? [value, false] : [fallback, false];
    expect(values).toMatchObject({
      onSameUrlNavigation: ['reload', true],
      paramsInheritanceStrategy: ['always', true],
      urlUpdateStrategy: ['eager', true],
      canceledNavigationResolution: ['computed', true],
      defaultQueryParamsHandling: ['merge', true],
      resolveNavigationPromiseOnError: ['true', true],
      scrollPositionRestoration: scroll('top', 'disabled'),
      anchorScrolling: scroll('enabled', 'disabled'),
    });
  });

  it('names the location strategy of withHashLocation()', async () => {
    const setup = await setupWith([withHashLocation()]);
    expect(setup.strategies['locationStrategy']).toBe(HashLocationStrategy.name);
  });
});
