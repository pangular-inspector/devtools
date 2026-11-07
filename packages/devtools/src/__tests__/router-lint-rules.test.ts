import { describe, expect, it } from 'vitest';
import type { HttpCall } from '../http-rules.ts';
import type { NavigationRecord } from '../router.ts';
import type { RouteNode } from '../router-config.ts';
import { lintRoutes, lintRoutesText } from '../rpc/router-config-tools.ts';
import type { RouterPage } from '../rpc/router-tools.ts';

function page(config: RouteNode[], navigations: NavigationRecord[] = []): RouterPage {
  return { pageId: 'p1', snapshot: null, navigations, config, reportedAt: 1, changedAt: 1 };
}

function rules(found: { rule: string }[], rule: string) {
  return found.filter((f) => f.rule === rule);
}

describe('always-run-parent', () => {
  const child: RouteNode = {
    id: '0.0',
    path: ':id',
    fullPath: '/account/:id',
    kind: 'component',
    component: 'AccountPage',
    title: 'Account',
  };

  it("flags runGuardsAndResolvers: 'always' on a parent with guards or resolvers", () => {
    const found = lintRoutes(
      page([
        {
          id: '0',
          path: 'account',
          fullPath: '/account',
          kind: 'children',
          runGuardsAndResolvers: 'always',
          guards: { canActivate: ['authGuard'] },
          resolvers: ['user: userResolver'],
          children: [child],
        },
      ]),
    );
    expect(rules(found, 'always-run-parent')).toEqual([
      expect.objectContaining({
        severity: 'warning',
        route: '/account',
        message: expect.stringContaining('`authGuard`, `user: userResolver`'),
      }),
    ]);
  });

  it('leaves leaf routes and parents with nothing to run alone', () => {
    const found = lintRoutes(
      page([
        {
          ...child,
          id: '1',
          fullPath: '/leaf',
          runGuardsAndResolvers: 'always',
          resolvers: ['x: r'],
        },
        {
          id: '2',
          path: 'empty',
          fullPath: '/empty',
          kind: 'children',
          runGuardsAndResolvers: 'always',
          children: [{ ...child, id: '2.0', fullPath: '/empty/:id' }],
        },
      ]),
    );
    expect(rules(found, 'always-run-parent')).toEqual([]);
  });
});

describe('lazy-component-eager', () => {
  it('flags a loadComponent route whose component another route imports eagerly', () => {
    const found = lintRoutes(
      page([
        {
          id: '0',
          path: 'help',
          fullPath: '/help',
          kind: 'component',
          component: 'HelpPage',
          title: 'Help',
        },
        {
          id: '1',
          path: 'support',
          fullPath: '/support',
          kind: 'component',
          lazy: 'loaded',
          component: 'HelpPage',
          title: 'Support',
        },
      ]),
    );
    expect(rules(found, 'lazy-component-eager')).toEqual([
      expect.objectContaining({ route: '/support', severity: 'info' }),
    ]);
  });

  it('does not count components inside a lazy loaded route as eager', () => {
    const found = lintRoutes(
      page([
        {
          id: '0',
          path: 'admin',
          fullPath: '/admin',
          kind: 'lazy',
          lazy: 'loaded',
          children: [
            {
              id: '0.0',
              path: '',
              fullPath: '/admin',
              kind: 'component',
              component: 'AdminHome',
              title: 'A',
            },
          ],
        },
        {
          id: '1',
          path: 'dash',
          fullPath: '/dash',
          kind: 'component',
          lazy: 'loaded',
          component: 'AdminHome',
          title: 'D',
        },
      ]),
    );
    expect(rules(found, 'lazy-component-eager')).toEqual([]);
  });
});

describe('resolver-refetch', () => {
  const nav: NavigationRecord = {
    id: 4,
    url: '/users/7',
    finalUrl: '/users/7?tab=a',
    trigger: 'imperative',
    startedAt: 1000,
    endedAt: 1100,
    outcome: 'succeeded',
    resolvers: { names: ['user: userResolver'], ms: 40 },
  };
  const call = (id: string, at: number, method = 'GET'): HttpCall => ({
    id,
    url: '/api/users/7',
    method,
    status: 200,
    durationMs: 10,
    side: 'client',
    cacheHit: false,
    faulted: false,
    at,
  });
  const config: RouteNode[] = [
    {
      id: '0',
      path: 'users/:id',
      fullPath: '/users/:id',
      kind: 'component',
      component: 'U',
      title: 'U',
    },
  ];

  it('flags a GET the resolver made that the page makes again after the navigation', () => {
    const found = lintRoutes(page(config, [nav]), {
      httpFor: () => [call('a', 1050), call('b', 1300)],
    });
    expect(rules(found, 'resolver-refetch')).toEqual([
      expect.objectContaining({
        route: '/users/7',
        message: expect.stringContaining('`GET /api/users/7`'),
      }),
    ]);
  });

  it('needs the HTTP calls and a repeated GET', () => {
    expect(rules(lintRoutes(page(config, [nav])), 'resolver-refetch')).toEqual([]);
    const found = lintRoutes(page(config, [nav]), {
      httpFor: () => [call('a', 1050), call('b', 1300, 'POST')],
    });
    expect(rules(found, 'resolver-refetch')).toEqual([]);
  });

  it('can be turned off with lint.rules', () => {
    const text = lintRoutesText({ pages: [page(config, [nav])] }, {}, 1, {
      rules: { 'resolver-refetch': false },
      httpFor: () => [call('a', 1050), call('b', 1300)],
    });
    expect(text).not.toContain('resolver-refetch');
  });
});
