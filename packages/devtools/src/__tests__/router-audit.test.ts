// @vitest-environment jsdom
import '@angular/compiler';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { Router, RouterLink, RouterLinkActive, provideRouter, type Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { watchRouter, type NavigationRecord, type RouterDebugApi } from '../router.ts';
import { ConfigTracker } from '../router-config.ts';
import { linksOf, matchOptionsOf } from '../router-links.ts';
import {
  captureCallers,
  instrument,
  onGuardsCheckStart,
  routerLinkOf,
  runAction,
  storeInstrumented,
  storedInstrumented,
} from '../router-actions.ts';
import { touchRouterPage } from '../rpc/router-tools.ts';
import { angularAtLeast } from './angular-version.ts';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

class Nav {
  readonly router = inject(Router);
  readonly nullOptions = angularAtLeast('22.0.0');
  go() {
    void this.router.navigateByUrl('/b');
  }
}
Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <a
      id="link"
      routerLink="/a"
      routerLinkActive="on"
      [routerLinkActiveOptions]="{
        paths: 'exact',
        queryParams: 'ignored',
        fragment: 'ignored',
        matrixParams: 'ignored',
      }"
      ><span id="inner">A</span></a
    >
    <button id="button" type="button" (click)="go()">Go</button>
    <a routerLink="/b" routerLinkActive="on" [routerLinkActiveOptions]="{ queryParams: 'exact' }"
      >Partial</a
    >
    @if (nullOptions) {
      <a routerLink="/b" routerLinkActive="on" [routerLinkActiveOptions]="$any(null)">Never</a>
    }
  `,
})(Nav);

const lazyGuard = () => true;
const lazyResolver = () => 'loaded';

const routes: Routes = [
  { path: 'a', component: Nav },
  { path: 'a/child', component: Nav },
  { path: 'b', component: Nav },
  {
    path: 'lazy',
    loadChildren: () =>
      Promise.resolve([
        {
          path: 'guarded',
          component: Nav,
          canActivate: [lazyGuard],
          resolve: { value: lazyResolver },
        },
      ]),
  },
];

describe('router audit fixes on a real Router', () => {
  let router: Router;
  let navigations: NavigationRecord[];
  let cleanup: (() => void)[];
  const ng = () => (globalThis as { ng?: RouterDebugApi }).ng!;
  const last = () => navigations[navigations.length - 1];

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    router = TestBed.inject(Router);
    navigations = [];
    cleanup = [];
    const stop = watchRouter(router as never, navigations, () => {});
    if (stop) cleanup.push(stop);
  });

  afterEach(() => {
    for (const fn of cleanup) fn();
  });

  it('checks a link against the IsActiveMatchOptions of its RouterLinkActive', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/a/child');
    harness.detectChanges();
    const link = linksOf(ng(), router as never).find((l) => l.href === '/a')!;
    expect(link).toMatchObject({ active: false, linkActive: false, exact: true });
    expect(matchOptionsOf({ exact: true })).toBe(true);
    expect(matchOptionsOf(undefined)).toBe(false);
    expect(matchOptionsOf({ paths: 'subset', queryParams: 'exact' })).toEqual({
      paths: 'subset',
      matrixParams: 'ignored',
      queryParams: 'exact',
      fragment: 'ignored',
    });
    expect(matchOptionsOf({ queryParams: 'exact' })).toEqual({
      paths: 'subset',
      matrixParams: 'ignored',
      queryParams: 'exact',
      fragment: 'ignored',
    });
    expect(matchOptionsOf({ fragment: 'exact' })).toMatchObject({ fragment: 'exact' });
    expect(matchOptionsOf(null)).toBeNull();
  });

  it.skipIf(!angularAtLeast('22.0.0'))(
    'agrees with RouterLinkActive for partial match options and null options',
    async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/b?tab=1');
      harness.detectChanges();
      const links = linksOf(ng(), router as never);
      const partial = links.find((l) => l.text === 'Partial')!;
      const never = links.find((l) => l.text === 'Never')!;
      expect(partial).toMatchObject({ active: false, linkActive: false });
      expect(never).toMatchObject({ active: false, linkActive: false });
    },
  );

  it('only credits a click to RouterLink when the element carries the directive', async () => {
    cleanup.push(captureCallers(router as never, navigations, ng()));
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/a');
    harness.detectChanges();
    const anchor = document.getElementById('link')!;
    const button = document.getElementById('button')!;
    expect(routerLinkOf(document.getElementById('inner'), ng())).toBe(anchor);
    expect(routerLinkOf(button, ng())).toBeNull();

    button.click();
    await harness.fixture.whenStable();
    expect(last().url).toBe('/b');
    expect(last().caller).toMatch(/^navigateByUrl\(\)/);

    document.getElementById('inner')!.click();
    await harness.fixture.whenStable();
    expect(last().url).toBe('/a');
    expect(last().caller).toBe('RouterLink a "A"');
  });

  it('records guards and resolvers of lazy routes on the first navigation into them', async () => {
    const tracker = new ConfigTracker();
    tracker.update(router as never);
    let stop = instrument(router as never, navigations);
    cleanup.push(() => stop());
    cleanup.push(
      onGuardsCheckStart(router as never, () => {
        if (!tracker.update(router as never)) return;
        const previous = stop;
        const next = instrument(router as never, navigations);
        stop = () => {
          next();
          previous();
        };
      }),
    );
    await router.navigateByUrl('/lazy/guarded');
    expect(last().runs?.map((run) => [run.kind, run.guard])).toEqual([
      ['canActivate', 'lazyGuard'],
      ['resolve', 'value: lazyResolver'],
    ]);
  });

  it.skipIf(!angularAtLeast('20.2.0'))('says what a probe did and did not run', async () => {
    const probe = (await runAction(
      router as never,
      navigations,
      { action: 'probe', url: '/b' },
      () => {},
    )) as Record<string, unknown>;
    expect(probe).toMatchObject({ matched: true });
    expect(String(probe['note'])).toMatch(/canActivate.*resolvers did not run/);
  });
});

describe('router instrumentation flag', () => {
  it('is on by default and survives a reload through sessionStorage', () => {
    sessionStorage.clear();
    expect(storedInstrumented()).toBe(true);
    storeInstrumented(true);
    expect(storedInstrumented()).toBe(true);
    storeInstrumented(false);
    expect(storedInstrumented()).toBe(false);
  });
});

describe('router heartbeat', () => {
  it('bumps reportedAt without touching the rest of the page', () => {
    const page = {
      pageId: 'p1',
      snapshot: null,
      navigations: [],
      reportedAt: 1,
      changedAt: 1,
    };
    const pages = new Map([['p1', page]]);
    expect(touchRouterPage(pages as never, 'p1', 50)).toBe(true);
    expect(pages.get('p1')).toEqual({ ...page, reportedAt: 50 });
    expect(page.reportedAt).toBe(1);
    expect(touchRouterPage(pages as never, 'missing', 60)).toBe(false);
    expect(touchRouterPage(pages as never, 42, 60)).toBe(false);
  });
});
