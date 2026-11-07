import { describe, expect, it } from 'vitest';
import { applyRouterEvent, type NavigationRecord } from '../router.ts';
import { matchedRoutesOf } from '../router-matched.ts';
import {
  diffNavigations,
  diffNavigationsText,
  navigationDiffResult,
  pickNavigations,
} from '../rpc/router-diff.ts';
import { isRouterReport, type RouterPage } from '../rpc/router-tools.ts';

class UserPage {}
class SidePanel {}

function snapshotTree(id: string, tab: string) {
  const root: Record<string, unknown> = { routeConfig: null, params: {}, data: {}, children: [] };
  const user: Record<string, unknown> = {
    routeConfig: { path: 'users/:id', component: UserPage },
    component: UserPage,
    outlet: 'primary',
    params: { id, token: 'abc123secret' },
    data: { tab },
    children: [],
  };
  const side: Record<string, unknown> = {
    routeConfig: { path: 'help', outlet: 'side', component: SidePanel },
    component: SidePanel,
    outlet: 'side',
    params: {},
    data: {},
    children: [],
  };
  user['pathFromRoot'] = [root, user];
  side['pathFromRoot'] = [root, side];
  root['children'] = [user, side];
  return root;
}

function nav(id: number, extra: Partial<NavigationRecord> = {}): NavigationRecord {
  return {
    id,
    url: `/users/${id}`,
    trigger: 'imperative',
    startedAt: 1000 * id,
    endedAt: 1000 * id + 10,
    outcome: 'succeeded',
    ...extra,
  };
}

function page(navigations: NavigationRecord[]): { pages: RouterPage[] } {
  return {
    pages: [
      {
        pageId: 'p1',
        snapshot: null,
        navigations,
        reportedAt: Date.now(),
        changedAt: Date.now(),
      },
    ],
  };
}

describe('matched routes on a navigation', () => {
  it('records each activated route with its outlet, component, params and data', () => {
    const routes = matchedRoutesOf(snapshotTree('42', 'posts'));
    expect(routes).toEqual([
      {
        path: '/users/:id',
        component: 'UserPage',
        params: { id: '"42"', token: '"[redacted]"' },
        data: { tab: '"posts"' },
      },
      { path: '/help', outlet: 'side', component: 'SidePanel' },
    ]);
  });

  it('keeps the routes on the record when the navigation ends', () => {
    const tree = snapshotTree('7', 'about');
    const router = { url: '/', routerState: { snapshot: { root: tree }, root: null } };
    const navigations: NavigationRecord[] = [];
    applyRouterEvent(navigations, { type: 0, id: 1, url: '/users/7' }, 1, router);
    applyRouterEvent(navigations, { type: 1, id: 1, urlAfterRedirects: '/users/7' }, 2, router);
    expect(navigations[0].routes?.[0]).toMatchObject({
      path: '/users/:id',
      params: { id: '"7"' },
    });
    expect(isRouterReport({ pageId: 'p1', snapshot: null, navigations: navigations.slice() })).toBe(
      true,
    );
  });
});

describe('diffNavigations', () => {
  const a = nav(1, {
    finalUrl: '/users/1?tab=posts',
    guards: { names: ['authGuard'], passed: true },
    phases: { guards: 3, total: 10 },
    runs: [{ guard: 'authGuard', kind: 'canActivate', route: '/users/:id', result: 'true', ms: 1 }],
    routes: [
      { path: '/users/:id', component: 'UserPage', params: { id: '"1"' }, data: { tab: '"a"' } },
    ],
  });
  const b = nav(2, {
    finalUrl: '/users/2?tab=likes',
    guards: { names: ['authGuard'], passed: true },
    phases: { guards: 30, total: 40 },
    runs: [
      { guard: 'authGuard', kind: 'canActivate', route: '/users/:id', result: 'false', ms: 1 },
    ],
    routes: [
      { path: '/users/:id', component: 'UserPage', params: { id: '"2"' }, data: { tab: '"a"' } },
      { path: '/help', outlet: 'side', component: 'SidePanel' },
    ],
  });

  it('lists params, query params, outlets, verdicts and timing that changed', () => {
    const diff = diffNavigations(a, b);
    const section = (title: string) => diff.sections.find((s) => s.title === title)?.changes;
    expect(section('Query params')).toEqual([{ field: 'tab', before: 'posts', after: 'likes' }]);
    expect(section('Route params')).toEqual([
      { field: '/users/:id id', before: '"1"', after: '"2"' },
    ]);
    expect(section('Outlets and components')).toEqual([
      { field: '/help (outlet side)', before: undefined, after: 'SidePanel' },
    ]);
    expect(section('Guards')).toEqual([
      { field: 'canActivate authGuard @ /users/:id', before: 'true', after: 'false' },
    ]);
    expect(section('Phase timing')).toContainEqual({
      field: 'guards',
      before: '3ms',
      after: '30ms',
    });
    expect(diff.same).toContain('Route data');
  });

  it('says when a navigation has no route data to compare', () => {
    const diff = diffNavigations(nav(1, { outcome: 'cancelled' }), b);
    expect(diff.notes[0]).toMatch(/#1 has no route data/);
  });
});

describe('pickNavigations', () => {
  it('defaults to the newest finished navigation and the last one to the same path', () => {
    const list = [
      nav(1, { url: '/a' }),
      nav(2, { url: '/b' }),
      nav(3, { url: '/a?x=1' }),
      nav(4, { url: '/c', probe: true }),
      nav(5, { url: '/d', outcome: 'pending', endedAt: undefined }),
    ];
    const picked = pickNavigations(list);
    expect('error' in picked ? picked : [picked.a.id, picked.b.id]).toEqual([1, 3]);
  });

  it('answers why when a navigation is missing', () => {
    expect(pickNavigations([nav(1)], undefined, 9)).toEqual({
      error: 'No navigation #9 in the recent list.',
    });
    expect(pickNavigations([nav(1)])).toEqual({
      error: 'No navigation before #1 to compare it with.',
    });
  });
});

describe('diff texts', () => {
  it('answers the panel with a structured diff', () => {
    const result = navigationDiffResult(page([nav(1), nav(2)]), { a: 1, b: 2 });
    expect(result).toMatchObject({ a: 1, b: 2 });
  });

  it('answers agents in markdown with the untrusted notice', () => {
    const text = diffNavigationsText(page([nav(1), nav(2)]), { a: 1, b: 2 });
    expect(text).toContain('Comparing #1');
    expect(text).toContain('**Navigation**');
    expect(text).toContain('- url: `/users/1` → `/users/2`');
  });
});
