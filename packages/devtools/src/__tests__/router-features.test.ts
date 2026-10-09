// @vitest-environment jsdom
import '@angular/compiler';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import {
  PreloadAllModules,
  RedirectCommand,
  Router,
  RouterOutlet,
  RouterPreloader,
  provideRouter,
  withNavigationErrorHandler,
  withPreloading,
  type Routes,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { watchRouter, type NavigationRecord } from '../router.ts';
import { ConfigTracker, activeIds, walkConfig } from '../router-config.ts';
import { outletsOf } from '../router-links.ts';
import {
  captureCallers,
  captureDiagnostics,
  capturePreloads,
  fillPattern,
  instrument,
  isSafeUrl,
  runAction,
  type PreloadRecord,
} from '../router-actions.ts';
import { matchUrl } from '../rpc/router-config-tools.ts';
import { angularAtLeast } from './angular-version.ts';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

class Page {}
Component({ selector: 'app-page', template: '' })(Page);

class UserPage {
  id?: string;
  user?: unknown;
}
Component({ selector: 'app-user', template: '', inputs: ['id', 'user'] })(UserPage);

const authGuard = () => inject(Router).parseUrl('/login');
const slowResolver = () => new Promise((resolve) => setTimeout(() => resolve('late'), 40));
function throwingResolver(): never {
  throw new Error('db down');
}
function codedResolver(): never {
  throw new Error('NG04002: db down');
}

const routes: Routes = [
  { path: '', component: Page, title: 'Home' },
  { path: 'login', component: Page, title: 'Login' },
  {
    path: 'users',
    children: [
      {
        path: ':id',
        component: UserPage,
        resolve: { user: () => ({ name: 'Ada' }) },
        title: 'User',
      },
    ],
  },
  { path: 'admin', component: Page, canActivate: [authGuard] },
  { path: 'slow', component: Page, resolve: { x: slowResolver } },
  { path: 'broken', component: Page, resolve: { x: throwingResolver } },
  {
    path: 'lazy',
    loadChildren: () =>
      Promise.resolve([
        { path: '', component: Page },
        { path: 'deep', component: Page },
      ]),
  },
  { path: 'coded', component: Page, resolve: { x: codedResolver } },
  { path: '**', component: Page },
];

describe('router features on a real Router', () => {
  let router: Router;
  let navigations: NavigationRecord[];
  let cleanup: (() => void)[];

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          routes,
          withNavigationErrorHandler((error) =>
            String((error as { error?: Error }).error?.message ?? '').includes('db down')
              ? new RedirectCommand(inject(Router).parseUrl('/login'))
              : undefined,
          ),
        ),
      ],
    });
    router = TestBed.inject(Router);
    navigations = [];
    cleanup = [];
    const stop = watchRouter(router as never, navigations, () => {});
    if (stop) cleanup.push(stop);
    cleanup.push(captureCallers(router as never, navigations));
    cleanup.push(captureDiagnostics(router as never, navigations));
    await router.navigateByUrl('/');
  });

  afterEach(() => {
    for (const fn of cleanup) fn();
  });

  const last = () => navigations[navigations.length - 1];

  it('walks the live config, merges lazy children once loaded and tracks generations', async () => {
    const tracker = new ConfigTracker();
    expect(tracker.update(router as never)).toBe(true);
    expect(tracker.update(router as never)).toBe(false);
    let tree = walkConfig(router as never);
    const lazy = tree.find((node) => node.path === 'lazy')!;
    expect(lazy).toMatchObject({ kind: 'lazy', lazy: 'unloaded', fullPath: '/lazy' });
    expect(tree.find((n) => n.path === 'admin')?.guards).toEqual({ canActivate: ['authGuard'] });
    expect(tree.find((n) => n.path === 'users')?.children?.[0]).toMatchObject({
      fullPath: '/users/:id',
      component: 'UserPage',
      inputs: ['id', 'user'],
      title: 'User',
      resolvers: ['user: user'],
    });
    await router.navigateByUrl('/lazy/deep');
    expect(tracker.update(router as never)).toBe(true);
    tree = walkConfig(router as never);
    const loaded = tree.find((node) => node.path === 'lazy')!;
    expect(loaded.lazy).toBe('loaded');
    expect(loaded.children?.map((c) => c.fullPath)).toEqual(['/lazy', '/lazy/deep']);
    expect(activeIds(router as never)).toEqual(['6', '6.1']);
  });

  it('records from, caller, phases, reuse and title on each navigation', async () => {
    await router.navigateByUrl('/users/1');
    await router.navigateByUrl('/users/2', { replaceUrl: true, state: { from: 'test' } });
    await new Promise((resolve) => setTimeout(resolve));
    expect(last()).toMatchObject({
      url: '/users/2',
      from: '/users/1',
      outcome: 'succeeded',
      extras: ['replaceUrl', 'state: from'],
      reused: ['/users/:id'],
      title: 'User',
    });
    expect(last().caller).toMatch(/^navigateByUrl\(\)/);
    expect(last().phases).toMatchObject({
      total: expect.any(Number),
      recognize: expect.any(Number),
    });
    expect(last().checked?.activate).toEqual(['/users/:id']);
  });

  it('links a guard redirect to the navigation it starts', async () => {
    await router.navigateByUrl('/admin');
    const [admin, login] = navigations.slice(-2);
    expect(admin).toMatchObject({
      url: '/admin',
      outcome: 'redirected',
      redirectTo: '/login',
      redirectKind: 'guard',
    });
    expect(login).toMatchObject({ url: '/login', redirectedFrom: admin.id });
  });

  it('keeps what the navigation error handler did', async () => {
    await router.navigateByUrl('/broken').catch(() => {});
    const broken = navigations.find((n) => n.url === '/broken')!;
    expect(broken.errorHandler).toMatch(/redirected to \/login/);
    expect(broken).toMatchObject({
      outcome: 'redirected',
      code: 'Redirect',
      redirectTo: '/login',
      redirectKind: 'error handler',
      reason: 'Error: db down',
    });
    expect(broken.errorCode).toBeUndefined();
    expect(last()).toMatchObject({ url: '/login', redirectedFrom: broken.id });
  });

  it('keeps the error code of an error the handler redirected away from', async () => {
    await router.navigateByUrl('/coded').catch(() => {});
    const coded = navigations.find((n) => n.url === '/coded')!;
    expect(coded).toMatchObject({
      outcome: 'redirected',
      redirectKind: 'error handler',
      reason: 'Error: NG04002: db down',
      errorCode: 'NG04002',
    });
  });

  it('records calls that throw before a navigation starts', () => {
    expect(() =>
      router.navigate([''] as never, { relativeTo: undefined, queryParams: {} }).catch(() => {}),
    ).not.toThrow();
    expect(() => router.navigate(['a', undefined as never, 'b'])).toThrow();
    expect(last()).toMatchObject({ outcome: 'failed', errorCode: 'NG04008' });
  });

  it('records each guard and resolver run when instrumented, and restores them after', async () => {
    const stop = instrument(router as never, navigations);
    await router.navigateByUrl('/admin');
    const admin = navigations.find((n) => n.url === '/admin')!;
    expect(admin.runs).toEqual([
      expect.objectContaining({
        guard: 'authGuard',
        kind: 'canActivate',
        route: '/admin',
        result: 'UrlTree /login',
      }),
    ]);
    await router.navigateByUrl('/users/3');
    expect(last().runs?.[0]).toMatchObject({
      guard: 'user: user',
      kind: 'resolve',
      result: 'object',
    });
    stop();
    await router.navigateByUrl('/users/4');
    expect(last().runs).toBeUndefined();
    expect(router.config.find((r) => r.path === 'admin')!.canActivate![0]).toBe(authGuard);
  });

  it.skipIf(!angularAtLeast('20.2.0'))(
    'navigates, replays, probes and resolves lazy routes on request',
    async () => {
      let instrumented = false;
      const set = (on: boolean) => (instrumented = on);
      const nav = (await runAction(
        router as never,
        navigations,
        { action: 'navigate', pattern: '/users/:id', params: { id: '5' } },
        set,
      )) as Record<string, unknown>;
      expect(nav).toMatchObject({ outcome: 'succeeded', url: '/users/5' });
      expect(last().caller).toBe('navigate from DevTools');

      const unsafe = (await runAction(
        router as never,
        navigations,
        { action: 'navigate', url: 'https://evil.test/' },
        set,
      )) as Record<string, unknown>;
      expect(unsafe['error']).toMatch(/same-origin/);

      await router.navigateByUrl('/admin');
      const redirected = navigations.find((n) => n.url === '/admin')!;
      const replay = (await runAction(
        router as never,
        navigations,
        { action: 'replay', id: redirected.id },
        set,
      )) as Record<string, unknown>;
      expect(replay).toMatchObject({ same: true, replay: { outcome: 'redirected' } });

      const probe = (await runAction(
        router as never,
        navigations,
        { action: 'probe', url: '/users/77' },
        set,
      )) as Record<string, unknown>;
      expect(probe).toMatchObject({ matched: true });
      expect(router.url).not.toBe('/users/77');
      expect(navigations.some((n) => n.probe && n.url === '/users/77')).toBe(true);

      const lazy = (await runAction(
        router as never,
        navigations,
        { action: 'resolve-lazy', id: '6' },
        set,
      )) as Record<string, unknown>;
      expect(lazy).toMatchObject({ routes: [{ path: '' }, { path: 'deep' }] });
      expect((router.config[6] as { _loadedRoutes?: unknown })._loadedRoutes).toBeUndefined();

      await runAction(router as never, navigations, { action: 'instrument', on: true }, set);
      expect(instrumented).toBe(true);
    },
  );

  it.skipIf(!angularAtLeast('20.2.0'))('aborts the navigation in flight', async () => {
    const pending = router.navigateByUrl('/slow');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const result = (await runAction(
      router as never,
      navigations,
      { action: 'abort' },
      () => {},
    )) as Record<string, unknown>;
    expect(result['aborted']).toBeDefined();
    await pending.catch(() => {});
    expect(navigations.find((n) => n.url === '/slow')).toMatchObject({
      outcome: 'cancelled',
      code: 'Aborted',
    });
  });

  it('maps outlets to routed components and their router-bound inputs', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, (await import('@angular/router')).withComponentInputBinding()),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/users/9');
    const outlets = outletsOf(TestBed.inject(Router) as never);
    expect(outlets[0]).toMatchObject({ outlet: 'primary', activated: true });
    const leaf = outlets[0].children?.[0] ?? outlets[0];
    expect(leaf).toMatchObject({ component: 'UserPage', route: '/users/:id' });
    expect(leaf.inputs).toEqual([
      { input: 'id', source: 'param' },
      { input: 'user', source: 'data' },
    ]);
  });
});

describe('routerOutletData', () => {
  class Shell {}
  Component({
    selector: 'app-shell',
    imports: [RouterOutlet],
    template: `<router-outlet />
      <router-outlet name="side" [routerOutletData]="{ panel: 'filters', apiToken: 'abc123' }" />`,
  })(Shell);

  it('previews the data the primary and a named outlet pass, redacted', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'shell',
            component: Shell,
            children: [
              { path: '', component: Page },
              { path: 'side', component: Page, outlet: 'side' },
            ],
          },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    harness.fixture.componentInstance.routerOutletData.set({ user: 'Ada', ids: [1, 2] });
    await harness.navigateByUrl('/shell/(side:side)');
    harness.detectChanges();
    const outlets = outletsOf(TestBed.inject(Router) as never);
    expect(outlets[0]).toMatchObject({
      outlet: 'primary',
      component: 'Shell',
      data: '{"user":"Ada","ids":[1,2]}',
    });
    const side = outlets[0].children?.find((outlet) => outlet.outlet === 'side');
    expect(side).toMatchObject({ activated: true, component: 'Page' });
    expect(side?.data).toContain('"panel":"filters"');
    expect(side?.data).not.toContain('abc123');
    const primary = outlets[0].children?.find((outlet) => outlet.outlet === 'primary');
    expect(primary?.data).toBeUndefined();
  });

  it('caps a large preview', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '', component: Page }])] });
    const harness = await RouterTestingHarness.create();
    harness.fixture.componentInstance.routerOutletData.set(
      Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`key${i}`, 'x'.repeat(100)])),
    );
    await harness.navigateByUrl('/');
    const data = outletsOf(TestBed.inject(Router) as never)[0].data ?? '';
    expect(data.length).toBeLessThanOrEqual(301);
    expect(data.endsWith('…')).toBe(true);
  });
});

describe('preloads', () => {
  it('records preloads that run between navigations', async () => {
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
    const router = TestBed.inject(Router);
    const preloader = TestBed.inject(RouterPreloader);
    const preloads: PreloadRecord[] = [];
    const stop = capturePreloads(preloader as never, preloads, () => {});
    preloader.setUpPreloading();
    await router.navigateByUrl('/');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(preloads).toEqual([expect.objectContaining({ path: 'pre', ms: expect.any(Number) })]);
    stop();
  });
});

describe('helpers', () => {
  it('only accepts same-origin relative URLs', () => {
    expect(isSafeUrl('/users/1?x=2')).toBe(true);
    for (const bad of [
      '//evil.test',
      'https://x',
      '/javascript:alert(1)',
      'users',
      '/a/[redacted]',
    ]) {
      expect(isSafeUrl(bad)).toBe(false);
    }
  });

  it('fills route patterns and refuses missing params', () => {
    expect(fillPattern('/users/:id/posts/:post', { id: '1', post: 'a b' })).toBe(
      '/users/1/posts/a%20b',
    );
    expect(fillPattern('/users/:id', {})).toBeNull();
  });

  it('predicts matches like the default matcher', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const tree = walkConfig(TestBed.inject(Router) as never);
    expect(matchUrl(tree, '/users/3').chain.map((n) => n.fullPath)).toEqual([
      '/users',
      '/users/:id',
    ]);
    expect(matchUrl(tree, '/zzz').chain.map((n) => n.fullPath)).toEqual(['/**']);
    expect(matchUrl(tree, '/lazy/deep').notes.join(' ')).toMatch(/has not loaded yet/);
    expect(
      matchUrl(
        tree.filter((n) => n.path !== '**'),
        '/userz/1',
      ),
    ).toMatchObject({ matched: false, nearest: expect.arrayContaining(['/users/:id']) });
  });
});
