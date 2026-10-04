// @vitest-environment jsdom
import '@angular/compiler';
import { Component, PendingTasks, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import {
  RedirectCommand,
  Router,
  provideRouter,
  withNavigationErrorHandler,
  type Routes,
} from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { watchRouter, type NavigationRecord } from '../router.ts';
import { runAction, waitForStable } from '../router-actions.ts';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

class Page {}
Component({ selector: 'app-page', template: '' })(Page);

let landingGuardRuns = 0;
let landingResolverRuns = 0;
const landingGuard = () => {
  landingGuardRuns++;
  return true;
};
const landingResolver = () => {
  landingResolverRuns++;
  return 'x';
};

const routes: Routes = [
  { path: '', component: Page },
  { path: 'plain', component: Page },
  {
    path: 'landing',
    component: Page,
    canActivate: [landingGuard],
    resolve: { x: landingResolver },
  },
  {
    path: 'members',
    component: Page,
    canMatch: [() => inject(Router).parseUrl('/landing')],
  },
  {
    path: 'vip',
    component: Page,
    canMatch: [() => new RedirectCommand(inject(Router).parseUrl('/landing'))],
  },
  {
    path: 'crash',
    component: Page,
    canMatch: [
      () => {
        throw new Error('matcher down');
      },
    ],
  },
];

describe('router actions that wait on the app', () => {
  let router: Router;
  let navigations: NavigationRecord[];
  let stop: (() => void) | null;
  const act = (request: Parameters<typeof runAction>[2]) =>
    runAction(router as never, navigations, request, () => {}) as Promise<Record<string, unknown>>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          routes,
          withNavigationErrorHandler(
            () => new RedirectCommand(inject(Router).parseUrl('/landing')),
          ),
        ),
      ],
    });
    router = TestBed.inject(Router);
    navigations = [];
    stop = watchRouter(router as never, navigations, () => {});
    await router.navigateByUrl('/');
    landingGuardRuns = 0;
    landingResolverRuns = 0;
  });

  afterEach(() => stop?.());

  it('waitFor "navigation" returns when the navigation ends, without waiting for pending tasks', async () => {
    const done = TestBed.inject(PendingTasks).add();
    const result = await act({ action: 'navigate', url: '/plain', waitFor: 'navigation' });
    expect(result).toMatchObject({ outcome: 'succeeded', url: '/plain' });
    expect(result['stable']).toBeUndefined();
    done();
  });

  it('waitFor "stable" waits until the app has no pending tasks', async () => {
    const done = TestBed.inject(PendingTasks).add();
    setTimeout(done, 400);
    const started = Date.now();
    const result = await act({ action: 'navigate', url: '/plain', waitFor: 'stable' });
    expect(Date.now() - started).toBeGreaterThanOrEqual(390);
    expect(result).toMatchObject({ outcome: 'succeeded', stable: true });
  });

  it('says when the app did not become stable in time', async () => {
    const done = TestBed.inject(PendingTasks).add();
    expect(await waitForStable(router as never, 30)).toBe(false);
    done();
    expect(await waitForStable(router as never, 30)).toBe(true);
  });

  it('reports an unknown stability when the router has no pending tasks', async () => {
    expect(await waitForStable({} as never, 30)).toBeNull();
  });

  it.each([
    ['a UrlTree', '/members'],
    ['a RedirectCommand', '/vip'],
    ['an error the error handler redirects', '/crash'],
  ])('stops the redirect when canMatch returns %s', async (_, url) => {
    const result = await act({ action: 'probe', url });
    expect(result).toMatchObject({ matched: false, redirectedTo: '/landing' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(router.url).toBe('/');
    expect(landingGuardRuns).toBe(0);
    expect(landingResolverRuns).toBe(0);
    expect(navigations.filter((n) => n.probe).map((n) => n.outcome)).toEqual([
      'redirected',
      'cancelled',
    ]);
  });
});
