// @vitest-environment jsdom
import '@angular/compiler';
import { Component, Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { Router, provideRouter, type Routes } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { watchRouter, type NavigationRecord } from '../router.ts';
import { instrument } from '../router-actions.ts';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

class Page {}
Component({ selector: 'app-page', template: '' })(Page);

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
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
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

  it('names the route for canMatch and canActivateChild runs', async () => {
    await router.navigateByUrl('/m2');
    expect(last().runs).toEqual([expect.objectContaining({ kind: 'canMatch', route: '/m2' })]);
    await router.navigateByUrl('/p2/c');
    expect(last().runs).toEqual([
      expect.objectContaining({ kind: 'canActivateChild', route: '/p2' }),
    ]);
  });
});
