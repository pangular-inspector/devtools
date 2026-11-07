import { describe, expect, it } from 'vitest';
import { applyRouterEvent, noteRun, setCaller, type NavigationRecord } from '../router.ts';
import { navigationFromQuery, queryParamFor, redirectFromQuery } from '../router-open-redirect.ts';
import { describeNavigation, type RouterPage } from '../rpc/router-tools.ts';
import { lintRoutes } from '../rpc/router-config-tools.ts';
import { isRouterReport } from '../rpc/router-tools.ts';

function routerAt(url: string) {
  return {
    url,
    routerState: { snapshot: { root: null }, root: null },
    serializeUrl: (tree: unknown) => String(tree),
  };
}

describe('queryParamFor', () => {
  it('finds the query param whose value is the target, encoded or not', () => {
    expect(queryParamFor('/login?returnUrl=%2Fadmin%2Fusers', '/admin/users')).toBe('returnUrl');
    expect(queryParamFor('/login?next=admin', '/admin')).toBe('next');
    expect(queryParamFor('/login?r=https://evil.example/admin', '/admin')).toBe('r');
  });

  it('ignores the root path, redacted values and unrelated params', () => {
    expect(queryParamFor('/login?returnUrl=/', '/')).toBeUndefined();
    expect(queryParamFor('/login?tab=/admin', '/admin', true)).toBeUndefined();
    expect(queryParamFor('/a?token=[redacted]', '/[redacted]')).toBeUndefined();
  });

  it('names the guard that returned the redirect', () => {
    const runs = [
      {
        guard: 'loginGuard',
        kind: 'canActivate',
        route: '/login',
        result: 'UrlTree /admin',
        ms: 1,
      },
    ];
    expect(redirectFromQuery('/login?returnUrl=/admin', '/admin', 'guard', runs)).toEqual({
      param: 'returnUrl',
      by: 'loginGuard (canActivate)',
    });
  });

  it('leaves clicked links out of the code check', () => {
    expect(navigationFromQuery('/login?next=/a', '/a', 'RouterLink a "A"')).toBeUndefined();
    expect(navigationFromQuery('/login?next=/a', '/a', 'navigateByUrl() from submit')).toEqual({
      param: 'next',
      by: 'navigateByUrl() from submit',
    });
  });
});

describe('live redirect-from-query check', () => {
  it('flags a guard redirect to a query param value as it happens', () => {
    const router = routerAt('/');
    const navigations: NavigationRecord[] = [];
    applyRouterEvent(navigations, { type: 0, id: 1, url: '/login?returnUrl=%2Fadmin' }, 1, router);
    applyRouterEvent(navigations, { type: 7, id: 1, state: {} }, 2, router);
    noteRun(navigations, {
      guard: 'loginGuard',
      kind: 'canActivate',
      route: '/login',
      result: 'UrlTree /admin',
      ms: 1,
    });
    applyRouterEvent(navigations, { type: 2, id: 1, code: 0, reason: 'redirect' }, 3, router);
    applyRouterEvent(navigations, { url: '/admin', navigationBehaviorOptions: {} }, 4, router);
    // The router then starts the navigation to the target, which is not flagged again.
    applyRouterEvent(navigations, { type: 0, id: 2, url: '/admin' }, 5, router);
    expect(navigations[1].redirectedFrom).toBe(1);
    expect(navigations[1].queryRedirect).toBeUndefined();
    expect(navigations[0].queryRedirect).toEqual({
      param: 'returnUrl',
      by: 'loginGuard (canActivate)',
    });
    expect(isRouterReport({ pageId: 'p', snapshot: null, navigations })).toBe(true);
  });

  it('flags code that navigates to a return URL from the current query', () => {
    const router = routerAt('/login?returnUrl=%2Forders%2F7');
    const navigations: NavigationRecord[] = [];
    setCaller('navigateByUrl() from LoginPage.submit', true);
    applyRouterEvent(navigations, { type: 0, id: 4, url: '/orders/7' }, Date.now(), router);
    expect(navigations[0].queryRedirect).toEqual({
      param: 'returnUrl',
      by: 'navigateByUrl() from LoginPage.submit',
    });
  });

  it('reports the flag in explain-navigation and as a lint warning', () => {
    const nav: NavigationRecord = {
      id: 2,
      url: '/orders/7',
      from: '/login?returnUrl=%2Forders%2F7',
      trigger: 'imperative',
      startedAt: 1,
      outcome: 'succeeded',
      queryRedirect: { param: 'returnUrl', by: 'navigateByUrl()' },
    };
    expect(describeNavigation(nav)).toContain('**possible open redirect**');
    const page: RouterPage = {
      pageId: 'p',
      snapshot: null,
      navigations: [nav],
      config: [],
      reportedAt: 1,
      changedAt: 1,
    };
    expect(lintRoutes(page)).toContainEqual(
      expect.objectContaining({ rule: 'redirect-from-query', severity: 'warning' }),
    );
  });
});
