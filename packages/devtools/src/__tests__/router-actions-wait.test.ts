// @vitest-environment jsdom
import '@angular/compiler';
import * as core from '@angular/core';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
import { angularAtLeast, initAngularTestBed, STANDALONE } from './angular-version.ts';
import { functionalRouter } from './router-testing.ts';

initAngularTestBed();

class Page {}
Component({ ...STANDALONE, selector: 'app-page', template: '' })(Page);

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

/** The Router holds the root pending tasks from 16.0. */
const routerTasks = angularAtLeast('16.0');

/**
 * Adds a pending task and returns its remover: through the public
 * `PendingTasks` from 19.0, through the root tasks the Router holds before.
 */
function addPendingTask(router: Router): () => void {
  const publicTasks = (core as unknown as Record<string, unknown>)['PendingTasks'];
  if (publicTasks && angularAtLeast('19.0')) {
    return TestBed.inject(publicTasks as core.Type<{ add(): () => void }>).add();
  }
  const tasks = (router as unknown as { pendingTasks: { add(): number; remove(id: number): void } })
    .pendingTasks;
  const id = tasks.add();
  return () => tasks.remove(id);
}

// provideRouter and functional guards exist from 14.2.
describe.runIf(functionalRouter)('router actions that wait on the app', () => {
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

  it.runIf(routerTasks)(
    'waitFor "navigation" returns when the navigation ends, without waiting for pending tasks',
    async () => {
      const done = addPendingTask(router);
      const result = await act({ action: 'navigate', url: '/plain', waitFor: 'navigation' });
      expect(result).toMatchObject({ outcome: 'succeeded', url: '/plain' });
      expect(result['stable']).toBeUndefined();
      done();
    },
  );

  it.runIf(routerTasks)('waitFor "stable" waits until the app has no pending tasks', async () => {
    const done = addPendingTask(router);
    setTimeout(done, 400);
    const started = Date.now();
    const result = await act({ action: 'navigate', url: '/plain', waitFor: 'stable' });
    expect(Date.now() - started).toBeGreaterThanOrEqual(390);
    expect(result).toMatchObject({ outcome: 'succeeded', stable: true });
  });

  it.runIf(routerTasks)('says when the app did not become stable in time', async () => {
    const done = addPendingTask(router);
    expect(await waitForStable(router as never, 30)).toBe(false);
    done();
    expect(await waitForStable(router as never, 30)).toBe(true);
  });

  it('reports an unknown stability when the router has no pending tasks', async () => {
    expect(await waitForStable({} as never, 30)).toBeNull();
  });

  it.skipIf(routerTasks)(
    'reports an unknown stability before 16.0, whose Router has no pending tasks',
    async () => {
      expect(await waitForStable(router as never, 30)).toBeNull();
      const result = await act({ action: 'navigate', url: '/plain', waitFor: 'stable' });
      expect(result).toMatchObject({ outcome: 'succeeded', url: '/plain' });
    },
  );

  it.skipIf(!angularAtLeast('20.2.0')).each([
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
