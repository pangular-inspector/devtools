// @vitest-environment jsdom
import '@angular/compiler';
import { Component, Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, type Routes } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { watchRouter, type NavigationRecord } from '../router.ts';
import { instrument } from '../router-actions.ts';
import { angularAtLeast, initAngularTestBed, STANDALONE } from './angular-version.ts';
import { routerTestModule } from './router-testing.ts';

initAngularTestBed();

class Page {}
Component({ ...STANDALONE, selector: 'app-page', template: '' })(Page);

class AuthGuard {
  canActivate() {
    return true;
  }
  canActivateChild() {
    return true;
  }
  canMatch() {
    return true;
  }
}
Injectable({ providedIn: 'root' })(AuthGuard);

class UserResolver {
  resolve() {
    return 'user';
  }
}
Injectable({ providedIn: 'root' })(UserResolver);

const routes: Routes = [
  { path: '', component: Page },
  { path: 'a', component: Page, canActivate: [AuthGuard], resolve: { user: UserResolver } },
  { path: 'b', component: Page, canActivate: [AuthGuard], resolve: { owner: UserResolver } },
  { path: 'm1', component: Page, canMatch: [AuthGuard] },
  { path: 'm2', component: Page, canMatch: [AuthGuard] },
  {
    path: 'p1',
    canActivateChild: [AuthGuard],
    children: [{ path: 'c', component: Page }],
  },
  {
    path: 'p2',
    canActivateChild: [AuthGuard],
    children: [{ path: 'c', component: Page }],
  },
];

describe('instrumented class guards and resolvers shared by several routes', () => {
  let router: Router;
  let navigations: NavigationRecord[];
  let cleanup: (() => void)[];
  const last = () => navigations[navigations.length - 1];

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule(routerTestModule(routes));
    router = TestBed.inject(Router);
    navigations = [];
    cleanup = [];
    const stop = watchRouter(router as never, navigations, () => {});
    if (stop) cleanup.push(stop);
    cleanup.push(instrument(router as never, navigations));
    await router.navigateByUrl('/');
  });

  afterEach(() => {
    for (const fn of cleanup.reverse()) fn();
  });

  it('names the route and resolve key each run was for', async () => {
    await router.navigateByUrl('/b');
    expect(last().runs).toEqual([
      expect.objectContaining({ guard: 'AuthGuard', kind: 'canActivate', route: '/b' }),
      expect.objectContaining({ guard: 'owner: UserResolver', kind: 'resolve', route: '/b' }),
    ]);
    await router.navigateByUrl('/a');
    expect(last().runs).toEqual([
      expect.objectContaining({ guard: 'AuthGuard', kind: 'canActivate', route: '/a' }),
      expect.objectContaining({ guard: 'user: UserResolver', kind: 'resolve', route: '/a' }),
    ]);
  });

  // canMatch exists from 14.1.
  it.runIf(angularAtLeast('14.1'))(
    'names the route for canMatch and canActivateChild runs',
    async () => {
      await router.navigateByUrl('/m2');
      // Before 16.0 Angular matches routes twice (redirects, then recognition), running canMatch in each pass.
      const run = expect.objectContaining({ kind: 'canMatch', route: '/m2' });
      expect(last().runs).toEqual(angularAtLeast('16.0') ? [run] : [run, run]);
      await router.navigateByUrl('/p2/c');
      expect(last().runs).toEqual([
        expect.objectContaining({ kind: 'canActivateChild', route: '/p2' }),
      ]);
    },
  );
});

class DenyGuard {
  canActivate() {
    return false;
  }
}
Injectable({ providedIn: 'root' })(DenyGuard);

class FailingResolver {
  resolve(): never {
    throw new Error('user service is down');
  }
}
Injectable({ providedIn: 'root' })(FailingResolver);

// Class guards work on every version, so this is the router coverage for 12.0 to
// 14.1, which have neither functional guards nor provideRouter.
describe('navigation records from class guards and resolvers', () => {
  let router: Router;
  let navigations: NavigationRecord[];
  let stop: (() => void) | null;
  const last = () => navigations[navigations.length - 1]!;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule(
      routerTestModule([
        { path: '', component: Page },
        { path: 'a', component: Page, canActivate: [AuthGuard], resolve: { user: UserResolver } },
        { path: 'blocked', component: Page, canActivate: [DenyGuard] },
        { path: 'broken', component: Page, resolve: { user: FailingResolver } },
        { path: 'old', redirectTo: 'a' },
      ]),
    );
    router = TestBed.inject(Router);
    navigations = [];
    stop = watchRouter(router as never, navigations, () => {});
    await router.navigateByUrl('/');
  });

  afterEach(() => stop?.());

  it('records a navigation with its guards and resolvers', async () => {
    await router.navigateByUrl('/old');
    expect(last()).toMatchObject({
      url: '/old',
      finalUrl: '/a',
      outcome: 'succeeded',
      guards: { names: ['AuthGuard'], passed: true },
      resolvers: { names: ['user: UserResolver'] },
    });
  });

  it('records a guard that blocks and a resolver that fails', async () => {
    await router.navigateByUrl('/blocked');
    expect(last()).toMatchObject({
      url: '/blocked',
      outcome: 'cancelled',
      guards: { names: ['DenyGuard'], passed: false },
    });
    await router.navigateByUrl('/broken').catch(() => {});
    expect(last()).toMatchObject({ url: '/broken', outcome: 'failed' });
    expect(last().reason).toContain('user service is down');
  });
});
