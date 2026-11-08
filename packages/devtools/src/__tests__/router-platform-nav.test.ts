// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureDiagnostics } from '../router-actions.ts';
import {
  MAX_PLATFORM_NAVIGATIONS,
  capturePlatformNavigations,
  navigationApi,
  type PlatformNavigation,
} from '../router-platform-nav.ts';
import type { NavigationRecord } from '../router.ts';
import {
  explainNavigationText,
  inspectRouteText,
  isRouterReport,
  type RouterPage,
} from '../rpc/router-tools.ts';

/** A stand-in for `window.navigation`: an EventTarget that fires NavigateEvent-like objects. */
function fakeNavigation() {
  const target = new EventTarget();
  const fire = (name: string, fields: Record<string, unknown> = {}) => {
    const event = Object.assign(new Event(name), fields);
    target.dispatchEvent(event);
  };
  return { api: target as unknown as Parameters<typeof capturePlatformNavigations>[0], fire };
}

function nav(id: number, extra: Partial<NavigationRecord> = {}): NavigationRecord {
  return {
    id,
    url: `/p${id}`,
    trigger: 'imperative',
    startedAt: Date.now(),
    outcome: 'pending',
    ...extra,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Navigation API events', () => {
  it('finds no Navigation API in jsdom and then listens to nothing', () => {
    expect(navigationApi()).toBeNull();
    expect(capturePlatformNavigations(null, [], [], () => {})).toBeTypeOf('function');
  });

  it('links an event to the pending router navigation and records its result', () => {
    const { api, fire } = fakeNavigation();
    const navigations = [nav(3)];
    const entries: PlatformNavigation[] = [];
    const onChange = vi.fn();
    const stop = capturePlatformNavigations(api, navigations, entries, onChange);
    fire('navigate', {
      navigationType: 'push',
      destination: { url: `${location.origin}/orders?token=abc12345` },
      userInitiated: false,
    });
    fire('navigatesuccess');
    expect(entries).toEqual([
      {
        at: expect.any(Number),
        type: 'push',
        url: '/orders?token=[redacted]',
        navigationId: 3,
        result: 'succeeded',
      },
    ]);
    expect(navigations[0].platform).toEqual({ type: 'push' });
    expect(onChange).toHaveBeenCalled();
    stop();
    fire('navigate', { navigationType: 'push', destination: { url: '/x' } });
    expect(entries).toHaveLength(1);
  });

  it('links back and forward to the router navigation that starts right after', () => {
    vi.useFakeTimers();
    const { api, fire } = fakeNavigation();
    const navigations: NavigationRecord[] = [];
    const entries: PlatformNavigation[] = [];
    capturePlatformNavigations(api, navigations, entries, () => {});
    fire('navigate', {
      navigationType: 'traverse',
      destination: { url: '/back' },
      userInitiated: true,
    });
    navigations.push(nav(8, { trigger: 'popstate' }));
    vi.advanceTimersByTime(150);
    expect(entries[0].navigationId).toBe(8);
    expect(navigations[0].platform).toEqual({ type: 'traverse', userInitiated: true });
  });

  it('keeps history changes the router did not make, capped, with failures', () => {
    vi.useFakeTimers();
    const { api, fire } = fakeNavigation();
    const entries: PlatformNavigation[] = [];
    capturePlatformNavigations(api, [], entries, () => {});
    for (let i = 0; i < MAX_PLATFORM_NAVIGATIONS + 5; i++) {
      fire('navigate', {
        navigationType: 'replace',
        destination: { url: `/h${i}` },
        hashChange: true,
      });
    }
    fire('navigateerror', { message: 'AbortError: aborted' });
    vi.advanceTimersByTime(150);
    expect(entries).toHaveLength(MAX_PLATFORM_NAVIGATIONS);
    expect(entries[0].url).toBe('/h5');
    expect(entries.at(-1)).toMatchObject({ result: 'failed', error: 'AbortError: aborted' });
    expect(entries.every((e) => e.navigationId === undefined)).toBe(true);
  });
});

describe('server answers', () => {
  const page: RouterPage = {
    pageId: 'p1',
    snapshot: {
      url: '/a',
      queryParams: {},
      fragment: null,
      root: { path: '', url: '', outlet: 'primary', params: {}, data: {}, children: [] },
      browserUrl: '/a#tab',
      urlDrift: true,
    },
    navigations: [nav(1, { outcome: 'succeeded', platform: { type: 'push' } })],
    platformNavigations: [
      { at: 1, type: 'push', url: '/a', navigationId: 1 },
      { at: 2, type: 'replace', url: '/a#tab', hashChange: true },
    ],
    reportedAt: Date.now(),
    changedAt: Date.now(),
  };

  it('accepts the events in a report', () => {
    const { reportedAt: _r, changedAt: _c, ...report } = page;
    expect(isRouterReport(report)).toBe(true);
  });

  it('lists history changes outside the router in inspect-route and explain-navigation', () => {
    const state = { pages: [page] };
    expect(inspectRouteText(state, {})).toContain('**History changes outside the router**');
    expect(inspectRouteText(state, {})).toContain('- `replace` to `/a#tab` (hash change)');
    const explained = explainNavigationText(state, {});
    expect(explained).toContain('browser Navigation API: `push`');
    expect(explained).toContain('History changes outside the router');
  });
});

describe('navigation error handler', () => {
  it('records a handler that throws and rethrows the error', () => {
    const handler = () => {
      throw new Error('handler broke');
    };
    const transitions: Record<string, unknown> = { navigationErrorHandler: handler };
    const router = { navigationTransitions: transitions, serializeUrl: String };
    const navigations = [nav(1)];
    const stop = captureDiagnostics(router, navigations);
    const wrapped = transitions['navigationErrorHandler'] as (e: unknown) => unknown;
    expect(() => wrapped({ id: 1, error: new Error('NG04002: no match') })).toThrow(
      'handler broke',
    );
    expect(navigations[0].errorHandler).toBe('error handler threw handler broke');
    expect(navigations[0].errorCode).toBe('NG04002');
    stop();
    expect(transitions['navigationErrorHandler']).toBe(handler);
  });
});
