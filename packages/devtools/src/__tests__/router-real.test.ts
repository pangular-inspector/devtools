// @vitest-environment jsdom
import '@angular/compiler';
import { Component, Injector, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import {
  PreloadAllModules,
  Router,
  RouterPreloader,
  provideRouter,
  withPreloading,
  type Routes,
} from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  findRouter,
  snapshotRouter,
  watchRouter,
  type NavigationRecord,
  type RouterDebugApi,
} from '../router.ts';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

class Page {}
Component({ selector: 'app-page', template: '' })(Page);

const authGuard = () => inject(Router).parseUrl('/login');
const denyGuard = () => false;
const allowGuard = () => true;
const loadUser = () => ({ name: 'Ada', apiToken: 'abc123' });
const noLeave = () => false;
function throwingGuard(): boolean {
  throw new Error('guard crashed');
}
const slowResolver = () => new Promise((resolve) => setTimeout(() => resolve(1), 30));
const failingResolver = () => {
  throw new Error('user service is down');
};

const routes: Routes = [
  { path: '', component: Page },
  { path: 'login', component: Page },
  {
    path: 'users',
    canActivateChild: [allowGuard],
    children: [
      {
        path: ':id',
        component: Page,
        title: 'User',
        data: { section: 'users' },
        resolve: { user: loadUser },
      },
    ],
  },
  { path: 'admin', component: Page, canActivate: [authGuard] },
  { path: 'blocked', component: Page, canActivate: [denyGuard] },
  { path: 'broken', component: Page, resolve: { user: failingResolver } },
  { path: 'old', redirectTo: 'users/1' },
  { path: 'reset/:token', component: Page },
  { path: 'form', component: Page, canDeactivate: [noLeave] },
  { path: 'throws', component: Page, canActivate: [throwingGuard] },
  { path: 'slow', component: Page, resolve: { x: slowResolver } },
  { path: 'n/:i', component: Page },
  {
    path: 'verify/:code',
    component: Page,
    title: 'Verify',
    resolve: { info: () => ({ jwt: 'jwtvalue1', returnUrl: '/cb?access_token=XYZ1' }) },
  },
  { path: 'reset2/:token', component: Page, canMatch: [() => inject(Router).parseUrl('/login')] },
  { path: 'lazy', loadChildren: () => Promise.resolve([{ path: '', component: Page }]) },
];

describe('real Router', () => {
  let router: Router;
  let navigations: NavigationRecord[];
  let stop: (() => void) | null;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    router = TestBed.inject(Router);
    navigations = [];
    stop = watchRouter(router as never, navigations, () => {});
    await router.navigateByUrl('/');
  });

  afterEach(() => stop?.());

  const last = () => navigations[navigations.length - 1];

  it('finds the router through the debug util that provideRouter publishes', () => {
    const published = (globalThis as { ng?: RouterDebugApi }).ng;
    expect(typeof published?.ɵgetRouterInstance).toBe('function');
    const injector = TestBed.inject(Injector);
    const ng: RouterDebugApi = {
      getInjector: () => injector,
      ɵgetRouterInstance: published!.ɵgetRouterInstance,
    };
    expect(findRouter(ng, [document.createElement('div')])).toBe(router);
  });

  it('reports the active route with params, resolved data, guards and redacted secrets', async () => {
    await router.navigateByUrl('/users/42?tab=posts&token=xyz#bio');
    const snapshot = snapshotRouter(router as never)!;
    expect(snapshot.url).toBe('/users/42?tab=posts&token=[redacted]#bio');
    expect(snapshot.queryParams).toEqual({ tab: 'posts', token: '[redacted]' });
    expect(snapshot.fragment).toBe('bio');
    const users = snapshot.root.children[0];
    expect(users.path).toBe('users');
    expect(users.guards).toEqual({ canActivateChild: ['allowGuard'] });
    const user = users.children[0];
    expect(user).toMatchObject({
      path: ':id',
      url: '42',
      component: 'Page',
      title: 'User',
      params: { id: '42' },
      resolvers: ['user: loadUser'],
    });
    expect(user.data).toEqual({
      section: 'users',
      user: { name: 'Ada', apiToken: '[redacted]' },
    });
  });

  it('redacts secret params, query keys and fragment keys everywhere a URL appears', async () => {
    await router.navigateByUrl('/reset/abc123?next=%2Fhome&api_key=k1#access_token=zzz&state=1');
    const snapshot = snapshotRouter(router as never)!;
    const expected =
      '/reset/[redacted]?next=%2Fhome&api_key=[redacted]#access_token=[redacted]&state=1';
    expect(snapshot.url).toBe(expected);
    expect(snapshot.fragment).toBe('access_token=[redacted]&state=1');
    const reset = snapshot.root.children[0];
    expect(reset.url).toBe('reset/[redacted]');
    expect(reset.params).toEqual({ token: '[redacted]' });
    expect(last()).toMatchObject({ url: expected, finalUrl: expected });
    expect(JSON.stringify({ snapshot, navigations })).not.toMatch(/abc123|k1|zzz/);
  });

  it('records a successful navigation with its guards and resolvers', async () => {
    await router.navigateByUrl('/users/7');
    expect(last()).toMatchObject({
      url: '/users/7',
      outcome: 'succeeded',
      finalUrl: '/users/7',
      trigger: 'imperative',
      guards: { names: ['allowGuard'], passed: true },
      resolvers: { names: ['user: loadUser'] },
    });
    expect(last().endedAt).toBeGreaterThanOrEqual(last().startedAt);
  });

  it('records a guard redirect and the navigation it starts', async () => {
    await router.navigateByUrl('/admin');
    const [admin, login] = navigations.slice(-2);
    expect(admin).toMatchObject({
      url: '/admin',
      outcome: 'redirected',
      code: 'Redirect',
      guards: { names: ['authGuard'], passed: false },
    });
    expect(admin.reason).toBe('Redirecting to "/login"');
    expect(login).toMatchObject({ url: '/login', outcome: 'succeeded' });
  });

  it('records a guard that blocks', async () => {
    await router.navigateByUrl('/blocked');
    expect(last()).toMatchObject({
      url: '/blocked',
      outcome: 'cancelled',
      code: 'GuardRejected',
      guards: { names: ['denyGuard'], passed: false },
    });
  });

  it('records a resolver error', async () => {
    await router.navigateByUrl('/broken').catch(() => {});
    expect(last()).toMatchObject({ url: '/broken', outcome: 'failed' });
    expect(last().reason).toContain('user service is down');
  });

  it('records a config redirect, a lazy load and a skipped navigation', async () => {
    await router.navigateByUrl('/old');
    expect(last()).toMatchObject({ url: '/old', finalUrl: '/users/1', outcome: 'succeeded' });

    await router.navigateByUrl('/lazy');
    expect(last()).toMatchObject({ url: '/lazy', outcome: 'succeeded', lazyLoaded: ['lazy'] });

    await router.navigateByUrl('/lazy');
    expect(last()).toMatchObject({
      url: '/lazy',
      outcome: 'skipped',
      code: 'IgnoredSameUrlNavigation',
    });
  });

  it('starts with the navigation that finished before it subscribed', async () => {
    await router.navigateByUrl('/old');
    const early: NavigationRecord[] = [];
    const stopEarly = watchRouter(router as never, early, () => {});
    expect(early).toEqual([
      expect.objectContaining({
        url: '/old',
        finalUrl: '/users/1',
        outcome: 'succeeded',
        beforeConnect: true,
        earlier: 1,
      }),
    ]);
    stopEarly?.();
  });

  it('names the canDeactivate guard of the page being left', async () => {
    await router.navigateByUrl('/form');
    await router.navigateByUrl('/login');
    expect(last()).toMatchObject({
      url: '/login',
      outcome: 'cancelled',
      code: 'GuardRejected',
      guards: { names: ['noLeave (leaving)'], passed: false },
    });
  });

  it('leaves the guard result open when a guard throws', async () => {
    await router.navigateByUrl('/throws').catch(() => {});
    expect(last()).toMatchObject({ url: '/throws', outcome: 'failed' });
    expect(last().guards).toEqual({ names: ['throwingGuard'] });
    expect(last().reason).toContain('guard crashed');
  });

  it('records a navigation replaced by a newer one while its resolver runs', async () => {
    const slow = router.navigateByUrl('/slow');
    await new Promise((resolve) => setTimeout(resolve, 5));
    await router.navigateByUrl('/login');
    await slow;
    const replaced = navigations.find((n) => n.url === '/slow')!;
    expect(replaced).toMatchObject({ outcome: 'cancelled', code: 'SupersededByNewNavigation' });
    expect(replaced.resolvers).toEqual({ names: ['x: slowResolver'] });
    expect(replaced.guards?.passed).toBe(true);
  });

  it('keeps the last 50 navigations', async () => {
    for (let i = 0; i < 55; i++) await router.navigateByUrl(`/n/${i}`);
    expect(navigations).toHaveLength(50);
    expect(last().url).toBe('/n/54');
  });

  it('picks up a navigation that was in flight when it subscribed', async () => {
    const slow = router.navigateByUrl('/slow');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const late: NavigationRecord[] = [];
    const stopLate = watchRouter(router as never, late, () => {});
    await slow;
    expect(late[late.length - 1]).toMatchObject({
      url: '/slow',
      outcome: 'succeeded',
      beforeConnect: true,
    });
    stopLate?.();
  });

  it('redacts URL-style secret keys and secrets inside encoded return URLs', async () => {
    await router.navigateByUrl('/login?code=abc&returnUrl=%2Freset%3Ftoken%3Dxyz&tab=1');
    const snapshot = snapshotRouter(router as never)!;
    expect(snapshot.queryParams).toEqual({
      code: '[redacted]',
      returnUrl: '/reset?token=[redacted]',
      tab: '1',
    });
    expect(snapshot.url).toContain('code=[redacted]');
    expect(snapshot.url).toContain(`returnUrl=${encodeURIComponent('/reset?token=[redacted]')}`);
    expect(JSON.stringify({ snapshot, navigations })).not.toMatch(/abc|xyz/);
  });

  it('redacts secret-named params, data, titles and repeated query params', async () => {
    await router.navigateByUrl('/verify/SECRETCODE1?next=%2Fcb%3Fcode%3DARRAY1&next=y');
    const snapshot = snapshotRouter(router as never)!;
    const verify = snapshot.root.children[0];
    expect(verify.params).toEqual({ code: '[redacted]' });
    expect(verify.data).toEqual({
      info: { jwt: '[redacted]', returnUrl: '/cb?access_token=[redacted]' },
    });
    expect(snapshot.queryParams).toEqual({ next: ['/cb?code=[redacted]', 'y'] });
    expect(JSON.stringify({ snapshot, navigations })).not.toMatch(
      /SECRETCODE1|jwtvalue1|XYZ1|ARRAY1/,
    );
  });

  it('redacts secret path params before the route is recognized, in any encoding', async () => {
    await router.navigateByUrl('/reset2/RAWTOKEN9');
    await router.navigate(['reset', 'a&b c1']);
    await router.navigateByUrl("/login?code=ab'SECRET9");
    const text = JSON.stringify({ snapshot: snapshotRouter(router as never), navigations });
    expect(text).not.toMatch(/RAWTOKEN9|a&b|SECRET9/);
  });

  it('lists only the guards and resolvers the router actually ran', async () => {
    await router.navigateByUrl('/users/8');
    await router.navigateByUrl('/users/8?tab=2');
    expect(last()).toMatchObject({ url: '/users/8?tab=2', outcome: 'succeeded' });
    expect(last().guards?.names).toEqual([]);
    expect(last().resolvers?.names ?? []).toEqual([]);
  });

  it('does not credit preloaded lazy routes to a navigation', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: '', component: Page },
            { path: 'pre', loadChildren: () => Promise.resolve([{ path: '', component: Page }]) },
          ],
          withPreloading(PreloadAllModules),
        ),
      ],
    });
    const preloading = TestBed.inject(Router);
    TestBed.inject(RouterPreloader).setUpPreloading();
    const records: NavigationRecord[] = [];
    const stopPre = watchRouter(preloading as never, records, () => {});
    await preloading.navigateByUrl('/');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(records[records.length - 1]).toMatchObject({ url: '/', outcome: 'succeeded' });
    expect(records[records.length - 1].lazyLoaded).toBeUndefined();
    stopPre?.();
  });

  it('stops recording after unsubscribing', async () => {
    stop?.();
    stop = null;
    const count = navigations.length;
    await router.navigateByUrl('/login');
    expect(navigations.length).toBe(count);
  });
});
