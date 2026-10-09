// @vitest-environment jsdom
import '@angular/compiler';
import { HashLocationStrategy, PlatformNavigation } from '@angular/common';
import {
  Component,
  provideZonelessChangeDetection,
  type EnvironmentProviders,
  type Provider,
} from '@angular/core';
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

const optionalRouter: Partial<typeof router> = router;
const withExperimentalAutoCleanupInjectors = optionalRouter.withExperimentalAutoCleanupInjectors;
const withExperimentalPlatformNavigation = optionalRouter.withExperimentalPlatformNavigation;
const withRouterResources = optionalRouter.ɵwithRouterResources;

class Root {}
Component({ selector: 'app-root', template: '' })(Root);

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
    providers: [provideZonelessChangeDetection(), provideRouter(routes, ...features), ...extra],
  });
  destroy = () => app.destroy();
  const ng = (globalThis as { ng?: RouterDebugApi }).ng!;
  const root = document.querySelector('app-root');
  return detectSetup(ng, app.injector.get(Router) as never, 1, root);
}

const option = (setup: RouterSetup, name: string) => setup.options.find((o) => o.name === name);

describe('detectSetup on a real provideRouter app', () => {
  it('reports defaults when no feature is used', async () => {
    const setup = await setupWith([]);
    expect(setup.setupKind).toBe('provideRouter');
    expect(setup.mode).toBe('full');
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
    expect(option(setup, 'initialNavigation')).toMatchObject({
      value: 'enabledBlocking',
      set: true,
    });
  });

  it('reads the initial navigation mode of withDisabledInitialNavigation()', async () => {
    const setup = await setupWith([withDisabledInitialNavigation()]);
    expect(option(setup, 'initialNavigation')).toMatchObject({ value: 'disabled', set: true });
  });

  it('detects withDebugTracing()', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    const setup = await setupWith([withDebugTracing()]);
    expect(setup.features['debugTracing']).toBe('on');
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
    expect(setup.features[name]).toBe(value);
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
    expect(values).toMatchObject({
      onSameUrlNavigation: ['reload', true],
      paramsInheritanceStrategy: ['always', true],
      urlUpdateStrategy: ['eager', true],
      canceledNavigationResolution: ['computed', true],
      defaultQueryParamsHandling: ['merge', true],
      resolveNavigationPromiseOnError: ['true', true],
      scrollPositionRestoration: ['top', false],
      anchorScrolling: ['enabled', false],
    });
  });

  it('names the location strategy of withHashLocation()', async () => {
    const setup = await setupWith([withHashLocation()]);
    expect(setup.strategies['locationStrategy']).toBe(HashLocationStrategy.name);
  });
});
