// @vitest-environment jsdom
import '@angular/compiler';
import { Component, inject } from '@angular/core';
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
import { captureDiagnostics, instrument } from '../router-actions.ts';
import type { RouteNode } from '../router-config.ts';
import { lintRoutes } from '../rpc/router-config-tools.ts';
import { detectLoops, redirectCycles } from '../rpc/router-loops.ts';
import { describeNavigation, type RouterPage } from '../rpc/router-tools.ts';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

function nav(id: number, extra: Partial<NavigationRecord> = {}): NavigationRecord {
  return {
    id,
    url: `/n${id}`,
    trigger: 'imperative',
    startedAt: id * 10,
    endedAt: id * 10 + 2,
    outcome: 'succeeded',
    ...extra,
  };
}

function redirect(id: number, url: string, to: string, guard: string, from?: number) {
  return nav(id, {
    url,
    outcome: 'redirected',
    code: 'Redirect',
    redirectTo: to,
    redirectKind: 'guard',
    redirectedFrom: from,
    guards: { names: [guard], passed: false },
    runs: [{ guard, kind: 'canActivate', route: url, result: `UrlTree ${to}`, ms: 1 }],
  });
}

function page(navigations: NavigationRecord[], config: RouteNode[] = []): RouterPage {
  return { pageId: 'p', snapshot: null, navigations, config, reportedAt: 1, changedAt: 1 };
}

describe('detectLoops', () => {
  it('finds a guard-to-guard loop and names the guard behind each hop', () => {
    const navigations = [
      redirect(1, '/account', '/login', 'authGuard'),
      redirect(2, '/login', '/account', 'guestGuard', 1),
      redirect(3, '/account', '/login', 'authGuard', 2),
      nav(4, { url: '/login', redirectedFrom: 3 }),
    ];
    const [loop] = detectLoops(navigations);
    expect(loop).toMatchObject({
      kind: 'redirect',
      ids: [1, 2, 3, 4],
      cycle: ['/account', '/login', '/account'],
      guards: ['authGuard', 'guestGuard'],
      bounces: 1,
      end: 'settled on /login',
    });
    expect(loop.hops).toEqual([
      {
        id: 1,
        from: '/account',
        to: '/login',
        via: 'guard',
        by: 'authGuard (canActivate on /account)',
      },
      {
        id: 2,
        from: '/login',
        to: '/account',
        via: 'guard',
        by: 'guestGuard (canActivate on /login)',
      },
    ]);
    expect(describeNavigation(navigations[1], page(navigations))).toContain(
      '**redirect loop** `/account` → `/login` → `/account`; here: `/login` → `/account`: guard redirect `guestGuard (canActivate on /login)` in #2',
    );
  });

  it('only lists guards from navigations inside the cycle', () => {
    const navigations = [
      redirect(1, '/account', '/login', 'authGuard'),
      redirect(2, '/login', '/account', 'guestGuard', 1),
      redirect(3, '/account', '/onboarding', 'authGuard', 2),
      redirect(4, '/onboarding', '/welcome', 'onboardingGuard', 3),
      nav(5, { url: '/welcome', redirectedFrom: 4 }),
    ];
    const [loop] = detectLoops(navigations);
    expect(loop.ids).toEqual([1, 2, 3, 4, 5]);
    expect(loop.cycle).toEqual(['/account', '/login', '/account']);
    expect(loop.guards).toEqual(['authGuard', 'guestGuard']);
  });

  it('finds a loop through a config redirectTo inside a navigation', () => {
    const config: RouteNode[] = [
      { id: '0', path: 'home', fullPath: '/home', kind: 'redirect', redirectTo: '/start' },
    ];
    const navigations = [
      nav(1, {
        url: '/home',
        finalUrl: '/start',
        outcome: 'redirected',
        redirectTo: '/home',
        redirectKind: 'guard',
        guards: { names: ['setupGuard'], passed: false },
      }),
      nav(2, { url: '/home', finalUrl: '/start', redirectedFrom: 1, outcome: 'pending' }),
    ];
    const [loop] = detectLoops(navigations, config);
    expect(loop.cycle).toEqual(['/home', '/start', '/home']);
    expect(loop.hops.map((hop) => [hop.via, hop.by])).toEqual([
      ['redirectTo', "redirectTo: '/start' on /home"],
      ['guard', 'setupGuard'],
    ]);
    expect(loop.end).toBe('still running');
  });

  it('turns an NG04016 failure into a redirectTo loop from the config', () => {
    const config: RouteNode[] = [
      { id: '0', path: 'a', fullPath: '/a', kind: 'redirect', redirectTo: '/b' },
      { id: '1', path: 'b', fullPath: '/b', kind: 'redirect', redirectTo: '/a' },
    ];
    expect(redirectCycles(config)).toEqual([['/a', '/b', '/a']]);
    const navigations = [
      nav(1, {
        url: '/b',
        outcome: 'failed',
        errorCode: 'NG04016',
        reason:
          "Error: NG04016: Detected possible infinite redirect when redirecting from '/a' to '/b'.",
      }),
    ];
    const [loop] = detectLoops(navigations, config);
    expect(loop).toMatchObject({
      kind: 'config',
      cycle: ['/b', '/a', '/b'],
      end: 'failed with NG04016',
    });
    expect(loop.hops[0].by).toBe("redirectTo: '/a' on /b");
  });

  it('does not flag a long redirect chain that never comes back', () => {
    const urls = ['/a', '/b', '/c', '/d', '/e', '/f'];
    const navigations = urls.map((url, i) =>
      i < urls.length - 1
        ? redirect(i + 1, url, urls[i + 1], `guard${i}`, i ? i : undefined)
        : nav(i + 1, { url, redirectedFrom: i }),
    );
    expect(detectLoops(navigations)).toEqual([]);
    expect(lintRoutes(page(navigations)).map((f) => f.rule)).not.toContain('redirect-loop');
  });

  it('finds a burst of code-started navigations bouncing between two pages', () => {
    const navigations = [
      nav(1, { url: '/a', caller: 'RouterLink a "A"' }),
      nav(2, { url: '/b', caller: 'navigate() from APage.ngOnInit' }),
      nav(3, { url: '/a', caller: 'navigate() from BPage.ngOnInit' }),
      nav(4, { url: '/b', caller: 'navigate() from APage.ngOnInit' }),
    ];
    const [loop] = detectLoops(navigations);
    expect(loop).toMatchObject({
      kind: 'burst',
      ids: [1, 2, 3, 4],
      cycle: ['/a', '/b', '/a'],
      bounces: 1,
    });
    expect(loop.hops[1]).toMatchObject({ via: 'navigate', by: 'navigate() from BPage.ngOnInit' });
  });

  it('ignores the user going back and forth, and slow code-started navigations', () => {
    const clicks = [
      nav(1, { url: '/a', caller: 'RouterLink a "A"' }),
      nav(2, { url: '/b', caller: 'RouterLink a "B"' }),
      nav(3, { url: '/a', trigger: 'popstate' }),
    ];
    expect(detectLoops(clicks)).toEqual([]);
    const slow = [
      nav(1, { url: '/a', startedAt: 0, endedAt: 5 }),
      nav(2, { url: '/b', startedAt: 2000, endedAt: 2005, caller: 'navigate() from X' }),
      nav(3, { url: '/a', startedAt: 4000, endedAt: 4005, caller: 'navigate() from Y' }),
    ];
    expect(detectLoops(slow)).toEqual([]);
  });

  it('reports each loop as a redirect-loop lint finding with the guards involved', () => {
    const navigations = [
      redirect(1, '/account', '/login', 'authGuard'),
      redirect(2, '/login', '/account', 'guestGuard', 1),
      redirect(3, '/account', '/login', 'authGuard', 2),
      redirect(4, '/login', '/account', 'guestGuard', 3),
      nav(5, { url: '/account', redirectedFrom: 4, outcome: 'pending' }),
    ];
    const finding = lintRoutes(page(navigations)).find((f) => f.rule === 'redirect-loop')!;
    expect(finding).toMatchObject({ severity: 'error', route: '/account', angular: 'silent' });
    expect(finding.message).toContain('`/account` → `/login` → `/account`');
    expect(finding.message).toContain('Guards involved: `authGuard`, `guestGuard`');
  });
});

class Page {}
Component({ selector: 'app-page', template: '' })(Page);

let signedIn = false;
let bounces = 0;
const authGuard = () => signedIn || inject(Router).parseUrl('/login');
const guestGuard = () => {
  if (++bounces >= 3) signedIn = true;
  return inject(Router).parseUrl('/account');
};
const toStep = (n: number) => () => inject(Router).parseUrl(`/step/${n + 1}`);

const routes: Routes = [
  { path: '', component: Page },
  { path: 'account', component: Page, canActivate: [authGuard] },
  { path: 'login', component: Page, canActivate: [guestGuard] },
  { path: 'x', redirectTo: '/y' },
  { path: 'y', redirectTo: '/x' },
  { path: 'step/1', component: Page, canActivate: [toStep(1)] },
  { path: 'step/2', component: Page, canActivate: [toStep(2)] },
  { path: 'step/3', component: Page, canActivate: [toStep(3)] },
  { path: 'step/4', component: Page },
];

describe('detectLoops on a real Router', () => {
  let router: Router;
  let navigations: NavigationRecord[];
  let cleanup: (() => void)[];

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
    signedIn = false;
    bounces = 0;
  });

  afterEach(() => {
    for (const fn of cleanup) fn();
  });

  it('flags two guards that send each other the user until one gives in', async () => {
    await router.navigateByUrl('/account');
    expect(router.url).toBe('/account');
    const loops = detectLoops(navigations);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toMatchObject({
      kind: 'redirect',
      cycle: ['/account', '/login', '/account'],
      guards: ['authGuard', 'guestGuard'],
      bounces: 3,
      end: 'settled on /account',
    });
    expect(loops[0].hops.map((hop) => hop.by)).toEqual([
      'authGuard (canActivate on /account)',
      'guestGuard (canActivate on /login)',
    ]);
  });

  it('flags a redirectTo loop that Angular stops with NG04016', async () => {
    await router.navigateByUrl('/x').catch(() => {});
    const failed = navigations[navigations.length - 1];
    expect(failed).toMatchObject({ url: '/x', outcome: 'failed', errorCode: 'NG04016' });
    const config: RouteNode[] = [
      { id: '3', path: 'x', fullPath: '/x', kind: 'redirect', redirectTo: '/y' },
      { id: '4', path: 'y', fullPath: '/y', kind: 'redirect', redirectTo: '/x' },
    ];
    expect(detectLoops(navigations, config)).toEqual([
      expect.objectContaining({ kind: 'config', ids: [failed.id], cycle: ['/x', '/y', '/x'] }),
    ]);
  });

  it('does not flag a chain of guard redirects that ends somewhere new', async () => {
    await router.navigateByUrl('/step/1');
    expect(router.url).toBe('/step/4');
    expect(navigations.filter((n) => n.redirectedFrom !== undefined)).toHaveLength(3);
    expect(detectLoops(navigations)).toEqual([]);
  });
});

let failures = 0;
function flakyResolver() {
  if (++failures <= 2) throw new Error('report service down');
  return 'ok';
}
const backToReport = () => inject(Router).parseUrl('/report');

describe('detectLoops through the navigation error handler', () => {
  let router: Router;
  let navigations: NavigationRecord[];
  let cleanup: (() => void)[];

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: '', component: Page },
            { path: 'report', component: Page, resolve: { x: flakyResolver } },
            { path: 'retry', component: Page, canActivate: [backToReport] },
          ],
          withNavigationErrorHandler(() => new RedirectCommand(inject(Router).parseUrl('/retry'))),
        ),
      ],
    });
    router = TestBed.inject(Router);
    navigations = [];
    cleanup = [];
    const stop = watchRouter(router as never, navigations, () => {});
    if (stop) cleanup.push(stop);
    cleanup.push(captureDiagnostics(router as never, navigations));
    await router.navigateByUrl('/');
    failures = 0;
  });

  afterEach(() => {
    for (const fn of cleanup) fn();
  });

  it('names the error handler as the cause of its hops', async () => {
    await router.navigateByUrl('/report');
    expect(router.url).toBe('/report');
    const [loop] = detectLoops(navigations);
    expect(loop).toMatchObject({
      kind: 'redirect',
      cycle: ['/report', '/retry', '/report'],
      end: 'settled on /report',
    });
    expect(loop.hops[0]).toMatchObject({
      from: '/report',
      to: '/retry',
      via: 'error handler',
      by: 'the navigation error handler',
    });
    expect(describeNavigation(navigations.find((n) => n.id === loop.hops[0].id)!)).toContain(
      'The navigation error handler redirected to `/retry`.',
    );
  });
});
