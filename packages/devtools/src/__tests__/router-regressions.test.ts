// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { EventType, applyRouterEvent, type NavigationRecord } from '../router.ts';
import { configSignature, type RouteNode } from '../router-config.ts';
import { runAction } from '../router-actions.ts';
import { lintRoutes } from '../rpc/router-config-tools.ts';
import { explainNavigationText, type RouterPage, type RouterState } from '../rpc/router-tools.ts';

function node(fullPath: string, extra: Partial<RouteNode> = {}): RouteNode {
  const path = extra.path ?? fullPath.split('/').pop() ?? '';
  return { id: fullPath, path, fullPath, kind: 'component', component: 'C', ...extra };
}

function page(extra: Partial<RouterPage> = {}): RouterPage {
  return { pageId: 'p', snapshot: null, navigations: [], reportedAt: 1, changedAt: 1, ...extra };
}

function events() {
  const listeners: ((event: Record<string, unknown>) => void)[] = [];
  return {
    subscribe(listener: (event: Record<string, unknown>) => void) {
      listeners.push(listener);
      return { unsubscribe: () => listeners.splice(listeners.indexOf(listener), 1) };
    },
  };
}

describe('router config signature', () => {
  it('changes when a route is edited in place with the same route count', () => {
    const routes: Record<string, unknown>[] = [{ path: 'a' }, { path: 'b', canActivate: [] }];
    const router = { config: routes };
    const before = configSignature(router);
    routes[0]['path'] = 'renamed';
    const renamed = configSignature(router);
    expect(renamed).not.toBe(before);
    (routes[1]['canActivate'] as unknown[]).push(() => true);
    expect(configSignature(router)).not.toBe(renamed);
    expect(configSignature(router)).toBe(configSignature(router));
  });
});

describe('router lint', () => {
  it('flags a param route with children only when it can end on its own segment', () => {
    const rules = (config: RouteNode[]) =>
      lintRoutes(page({ config })).filter((f) => f.rule === 'param-shadows-literal');
    const withChildren = node('/:id', {
      kind: 'children',
      component: undefined,
      children: [node('/:id/edit', { path: 'edit' })],
    });
    expect(rules([withChildren, node('/new')])).toHaveLength(0);
    const withEmptyChild = {
      ...withChildren,
      children: [node('/:id', { path: '' }), node('/:id/edit', { path: 'edit' })],
    };
    expect(rules([withEmptyChild, node('/new')])).toHaveLength(1);
    expect(rules([node('/:id'), node('/new')])).toHaveLength(1);
  });

  it('says Angular stays silent about an empty-path prefix redirect', () => {
    const config = [
      node('/', { path: '', kind: 'redirect', redirectTo: 'home', pathMatch: 'prefix' }),
      node('/home'),
    ];
    const finding = lintRoutes(page({ config })).find((f) => f.rule === 'empty-redirect-prefix');
    expect(finding).toMatchObject({ angular: 'silent' });
    expect(finding?.message).toContain("pathMatch 'prefix'");
  });
});

describe('router events', () => {
  it('takes a skipped navigation trigger from the current navigation', () => {
    const navigations: NavigationRecord[] = [];
    const router = {
      navigationTransitions: { currentNavigation: () => ({ id: 4, trigger: 'popstate' }) },
    };
    applyRouterEvent(
      navigations,
      { type: EventType.NavigationSkipped, id: 4, url: '/x' },
      1,
      router,
    );
    applyRouterEvent(
      navigations,
      { type: EventType.NavigationSkipped, id: 5, url: '/y' },
      2,
      router,
    );
    expect(navigations.map((nav) => nav.trigger)).toEqual(['popstate', 'unknown']);
  });

  it('reports the title set after NavigationEnd', async () => {
    const navigations: NavigationRecord[] = [];
    const router = { url: '/', routerState: { snapshot: null } };
    let late = 0;
    applyRouterEvent(navigations, { type: EventType.NavigationStart, id: 1, url: '/a' }, 0, router);
    document.title = 'Before';
    applyRouterEvent(
      navigations,
      { type: EventType.NavigationEnd, id: 1, urlAfterRedirects: '/a' },
      1,
      router,
      () => late++,
    );
    document.title = 'Page A';
    await Promise.resolve();
    expect(navigations[0].title).toBe('Page A');
    expect(late).toBe(1);
  });
});

describe('router probe', () => {
  it('answers at once when navigateByUrl throws', async () => {
    const router = {
      navigationTransitions: { events: events() },
      currentNavigation: () => null,
      navigationId: 1,
      navigateByUrl: () => {
        throw new Error('bad url');
      },
    };
    const started = Date.now();
    const result = await runAction(router, [], { action: 'probe', url: '/x' }, () => {});
    expect(Date.now() - started).toBeLessThan(1000);
    expect(result).toEqual({ error: expect.stringContaining('bad url') });
  });
});

describe('explain-navigation', () => {
  const navs: NavigationRecord[] = Array.from({ length: 80 }, (_, i) => ({
    id: i + 1,
    url: `/n${i + 1}`,
    trigger: 'imperative',
    startedAt: i + 1,
    outcome: 'succeeded',
  }));

  it('allows up to the configured navigation limit', () => {
    const state: RouterState = { pages: [page({ navigations: navs })] } as RouterState;
    const text = explainNavigationText(state, { limit: 80 }, 1, 200);
    expect(text).toContain('Most recent 80 of 80');
    expect(explainNavigationText(state, { limit: 80 }, 1)).toContain('Most recent 50 of 80');
  });

  it('only asks to turn instrumentation on when it is off', () => {
    const off = explainNavigationText({ pages: [page({ navigations: navs })] } as RouterState, {});
    expect(off).toContain('Instrumentation is off');
    const on = explainNavigationText(
      { pages: [page({ navigations: navs, instrumented: true })] } as RouterState,
      {},
    );
    expect(on).not.toContain('turn it on');
  });
});
