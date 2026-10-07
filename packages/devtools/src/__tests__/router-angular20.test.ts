// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyRouterEvent, type NavigationRecord, type RouterDebugApi } from '../router.ts';
import { detectSetup } from '../router-setup.ts';

class RouterScroller {
  constructor(readonly options: Record<string, unknown>) {}
}

class InjectionToken {
  constructor(readonly _desc: string) {}
}

function startWith(currentNavigation: unknown): NavigationRecord | undefined {
  const navigations: NavigationRecord[] = [];
  const router = { url: '/', navigationTransitions: { currentNavigation } };
  applyRouterEvent(
    navigations,
    { type: 0, id: 1, url: '/users/2', navigationTrigger: 'imperative' },
    0,
    router,
  );
  return navigations[0];
}

describe('router collector on Angular 20.0 internals', () => {
  const extras = { replaceUrl: true, state: { from: 'list' } };

  it('lists the extras when currentNavigation is a plain field, as on Angular 20.0 and 20.1', () => {
    expect(startWith({ extras })?.extras).toEqual(['replaceUrl', 'state: from']);
  });

  it('lists the extras when currentNavigation is a signal', () => {
    expect(startWith(() => ({ extras }))?.extras).toEqual(['replaceUrl', 'state: from']);
  });

  it('finds the forRoot scroller behind a token without a description', () => {
    const root = document.createElement('app-root');
    const token = new InjectionToken('');
    const scroller = new RouterScroller({ anchorScrolling: 'enabled' });
    const injector = { get: (wanted: unknown) => (wanted === token ? scroller : null) };
    const provider = {
      provide: token,
      useFactory: function () {
        return new RouterScroller({});
      },
    };
    const ng: RouterDebugApi = {
      getInjector: () => injector,
      ɵgetInjectorResolutionPath: () => [injector],
      ɵgetInjectorProviders: () => [{ token, provider }] as never,
    };
    const setup = detectSetup(ng, { options: {} }, 1, root);
    expect(setup.features['scroller']).toBe('on');
  });

  it('leaves the scroller off when no provider creates one', () => {
    const root = document.createElement('app-root');
    const token = new InjectionToken('');
    const injector = { get: () => ({ options: {} }) };
    const ng: RouterDebugApi = {
      getInjector: () => injector,
      ɵgetInjectorResolutionPath: () => [injector],
      ɵgetInjectorProviders: () => [{ token, provider: { provide: token, useValue: 1 } }] as never,
    };
    expect(detectSetup(ng, { options: {} }, 1, root).features['scroller']).toBe('off');
  });
});
