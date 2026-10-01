import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import ngDevtools, { createNgDevtools } from '../devframe.ts';
import type { NgDevtoolsConfig } from '../config.ts';
import type { NavigationRecord } from '../router.ts';
import type { RouteNode } from '../router-config.ts';

async function boot(options?: NgDevtoolsConfig) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await (options ? createNgDevtools(options) : ngDevtools).setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`ng-devtools:${name}` as never, ...([payload] as never));
  const call = async (tool: string, args: Record<string, unknown> = {}) =>
    ((await ctx.agent.invoke(`ng-devtools:${tool}`, args)) as { markdown: string }).markdown;
  return { ctx, push, call };
}

const config: RouteNode[] = [
  { id: '0', path: '', fullPath: '/', kind: 'component', component: 'Home', title: 'Home' },
  {
    id: '1',
    path: 'users',
    fullPath: '/users',
    kind: 'children',
    guards: { canActivateChild: ['authGuard'] },
    children: [
      {
        id: '1.0',
        path: ':id',
        fullPath: '/users/:id',
        kind: 'component',
        component: 'UserPage',
        resolvers: ['user: loadUser'],
        inputs: ['ID'],
      },
      { id: '1.1', path: 'new', fullPath: '/users/new', kind: 'component', component: 'NewUser' },
    ],
  },
  {
    id: '2',
    path: 'admin',
    fullPath: '/admin',
    kind: 'lazy',
    lazy: 'unloaded',
    guards: { canActivate: ['adminGuard'] },
    classGuards: ['LegacyGuard'],
  },
  { id: '3', path: 'a', fullPath: '/a', kind: 'redirect', redirectTo: 'b', pathMatch: 'full' },
  { id: '4', path: 'b', fullPath: '/b', kind: 'redirect', redirectTo: 'a', pathMatch: 'full' },
  { id: '5', path: '**', fullPath: '/**', kind: 'component', component: 'NotFound' },
  { id: '6', path: 'late', fullPath: '/late', kind: 'component', component: 'Late', title: 'Late' },
];

const navigations: NavigationRecord[] = [
  {
    id: 3,
    url: '/admin',
    from: '/users/7',
    trigger: 'imperative',
    caller: 'RouterLink a "Admin"',
    startedAt: 1000,
    endedAt: 1012,
    outcome: 'redirected',
    code: 'Redirect',
    reason: 'Redirecting to "/login"',
    redirectTo: '/login',
    redirectKind: 'guard',
    guards: { names: ['adminGuard'], passed: false, ms: 3 },
    runs: [
      {
        guard: 'adminGuard',
        kind: 'canActivate',
        route: '/admin',
        result: 'UrlTree /login',
        ms: 3,
      },
    ],
    phases: { recognize: 2, guards: 3, total: 12 },
    generation: 1,
  },
  {
    id: 4,
    url: '/login',
    trigger: 'imperative',
    startedAt: 1013,
    endedAt: 1020,
    outcome: 'succeeded',
    redirectedFrom: 3,
    phases: { total: 7 },
    generation: 1,
  },
  {
    id: 5,
    url: '/nope',
    trigger: 'imperative',
    startedAt: 1100,
    endedAt: 1101,
    outcome: 'failed',
    reason: "Error: NG04002: Cannot match any routes. URL Segment: 'nope'",
    errorCode: 'NG04002',
    generation: 1,
  },
];

function report(extra: Record<string, unknown> = {}) {
  return {
    pageId: 'p1',
    generation: 1,
    config,
    activeIds: ['1', '1.0'],
    snapshot: {
      url: '/users/7',
      browserUrl: '/users/8',
      urlDrift: true,
      title: 'User',
      queryParams: {},
      fragment: null,
      root: {
        path: '',
        url: '',
        outlet: 'primary',
        params: {},
        data: {},
        children: [
          {
            path: 'users',
            url: 'users',
            outlet: 'primary',
            params: {},
            data: {},
            guards: { canActivateChild: ['authGuard'] },
            children: [
              {
                path: ':id',
                url: '7',
                outlet: 'primary',
                component: 'UserPage',
                params: { id: '7' },
                paramSources: { id: 'own' },
                data: { user: { name: 'Ada' }, section: 'users' },
                dataSources: { user: 'resolved', section: 'inherited' },
                title: 'Users',
                ownTitle: false,
                children: [],
              },
            ],
          },
        ],
      },
    },
    navigations,
    setup: {
      mode: 'full',
      setupKind: 'provideRouter',
      routers: 1,
      angularVersion: '22.1.7',
      options: [
        { name: 'onSameUrlNavigation', value: 'ignore', set: false },
        { name: 'paramsInheritanceStrategy', value: 'always', set: false },
      ],
      features: { componentInputBinding: 'on', preloading: 'PreloadAllModules' },
      strategies: { titleStrategy: 'DefaultTitleStrategy' },
    },
    outlets: [
      {
        outlet: 'primary',
        activated: true,
        route: '/users/:id',
        component: 'UserPage',
        element: 'app-user',
        inputs: [{ input: 'user', source: 'data' }],
      },
    ],
    links: [{ text: 'Users', href: '/users', active: true, linkActive: false, exact: true }],
    preloads: [{ path: 'admin', startedAt: 900, ms: 40 }],
    instrumented: true,
    ...extra,
  };
}

describe('router MCP tools', () => {
  it('say so when no page has reported', async () => {
    const { call } = await boot();
    for (const tool of [
      'inspect-route',
      'explain-navigation',
      'list-routes',
      'lint-routes',
      'router-config',
      'export-navigation',
    ]) {
      expect(await call(tool)).toMatch(/no router state/i);
    }
    expect(await call('navigate', { action: 'abort' })).toMatch(/no router state/i);
  });

  it('inspect-route shows drift, provenance, title and outlets, and explains a component', async () => {
    const { push, call } = await boot();
    await push('push-router', report());
    const text = await call('inspect-route');
    expect(text).toContain('**Browser URL differs** `/users/8`');
    expect(text).toContain('`section` inherited');
    expect(text).toContain('`user` resolved');
    expect(text).toContain('title: `Users` (inherited)');
    expect(text).toContain('outlet `primary`: `UserPage` for `/users/:id`');
    expect(text).toContain('`user` from data');
    const component = await call('inspect-route', { selector: 'UserPage' });
    expect(component).toContain('`UserPage` is routed');
    const link = await call('inspect-route', { selector: 'Users' });
    expect(link).toContain('router says active, RouterLinkActive says inactive (exact)');
  });

  it('explain-navigation tells the whole story and summarizes performance', async () => {
    const { push, call } = await boot();
    await push('push-router', report());
    const text = await call('explain-navigation', { limit: 5 });
    expect(text).toContain('from `/users/7`');
    expect(text).toContain('started by `RouterLink a "Admin"`');
    expect(text).toContain('guard redirect to `/login`');
    expect(text).toContain(
      'decided by `adminGuard (canActivate on /admin) returned UrlTree /login`',
    );
    expect(text).toContain('redirect from #3');
    expect(text).toContain('error `NG04002`: No route matches the URL');
    expect(text).toContain('Instrumentation is on.');
    expect(await call('explain-navigation', { id: 4 })).not.toContain('#3 `/admin`');
    const perf = await call('explain-navigation', { perf: true });
    expect(perf).toContain('#3 `/admin` 12ms, mostly guards (3ms)');
    expect(perf).toContain('slowest preloads: `admin` 40ms');
  });

  it('list-routes lists the live config, matches URLs and audits protection', async () => {
    const { push, call } = await boot();
    await push('push-router', report());
    const text = await call('list-routes');
    expect(text).toContain('Live route config (generation 1)');
    expect(text).toContain('`/users/:id` `UserPage` · **active**');
    expect(text).toContain('e.g. `/users/1`');
    expect(text).toContain('lazy unloaded');
    const match = await call('list-routes', { match: '/users/42' });
    expect(match).toContain('`/users/42` matches: `/users` → `/users/:id`');
    expect(match).toContain('id=42');
    const lazy = await call('list-routes', { match: '/admin/x' });
    expect(lazy).toContain('has not loaded yet');
    const audit = await call('list-routes', { audit: true });
    expect(audit).toContain('`/users/:id`: `canActivateChild authGuard @ /users`');
    expect(audit).toContain('`/late`: unprotected');
    expect(await call('list-routes', { filter: 'newuser' })).toContain('`/users/new`');
  });

  it('lint-routes finds config mistakes', async () => {
    const { push, call } = await boot();
    await push('push-router', report());
    const text = await call('lint-routes');
    expect(text).toContain('`wildcard-not-last`');
    expect(text).toContain('`param-shadows-literal` `/users/new`');
    expect(text).toContain('`redirect-cycle`');
    expect(text).toContain('`class-guard`');
    expect(text).toContain('`chunk-before-guard` `/admin`');
    expect(text).toContain('`param-input-mismatch`');
    expect(text).toContain('`link-aria-current`');
  });

  it('router-lint says when it could not check instead of returning no findings', async () => {
    const { push } = await boot();
    expect(await push('router-lint', 'p1')).toEqual({ checked: false, reason: 'no-page' });
    await push('push-router', report({ config: undefined }));
    expect(await push('router-lint', 'p1')).toEqual({ checked: false, reason: 'no-config' });
    await push(
      'push-router',
      report({
        pageId: 'p2',
        config: undefined,
        setup: { ...report().setup, mode: 'events-only' },
      }),
    );
    expect(await push('router-lint', 'p2')).toEqual({ checked: false, reason: 'events-only' });
    await push('push-router', report());
    const result = (await push('router-lint', 'p1')) as { checked: boolean; findings: unknown[] };
    expect(result.checked).toBe(true);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('lint-routes says an events-only page was not checked', async () => {
    const { push, call } = await boot();
    await push(
      'push-router',
      report({ config: undefined, setup: { ...report().setup, mode: 'events-only' } }),
    );
    expect(await call('lint-routes')).toMatch(/No checks ran: page `p1` runs in events-only mode/);
  });

  it('explains a redirect loop in explain-navigation, export-navigation and lint-routes', async () => {
    const { push, call } = await boot();
    const hop = (id: number, url: string, to: string, guard: string, from?: number) => ({
      id,
      url,
      trigger: 'imperative',
      startedAt: 2000 + id,
      endedAt: 2000 + id,
      outcome: 'redirected',
      code: 'Redirect',
      redirectTo: to,
      redirectKind: 'guard',
      ...(from === undefined ? {} : { redirectedFrom: from }),
      guards: { names: [guard], passed: false },
      runs: [{ guard, kind: 'canActivate', route: url, result: `UrlTree ${to}`, ms: 1 }],
    });
    await push(
      'push-router',
      report({
        navigations: [
          hop(10, '/account', '/login', 'authGuard'),
          hop(11, '/login', '/account', 'guestGuard', 10),
          hop(12, '/account', '/login', 'authGuard', 11),
          { ...hop(13, '/login', '/account', 'guestGuard', 12), outcome: 'pending' },
        ],
      }),
    );
    const explain = await call('explain-navigation');
    expect(explain).toContain('**Loops**');
    expect(explain).toContain('**redirect loop** `/account` → `/login` → `/account`');
    expect(explain).toContain(
      '`/account` → `/login`: guard redirect `authGuard (canActivate on /account)` in #10',
    );
    expect(explain).toContain('guards involved: `authGuard`, `guestGuard`');
    const exported = await call('export-navigation', { id: 12 });
    expect(exported).toContain('### Redirect loop');
    expect(exported).toContain(
      '`/login` → `/account`: guard redirect `guestGuard (canActivate on /login)` in #11',
    );
    const lint = await call('lint-routes');
    expect(lint).toContain('**error** `redirect-loop` `/account`');
    expect(lint).toContain('Guards involved: `authGuard`, `guestGuard`');
  });

  it('router-config describes the setup', async () => {
    const { push, call } = await boot();
    await push('push-router', report());
    const text = await call('router-config');
    expect(text).toContain('**Set up with** provideRouter');
    expect(text).toContain('`onSameUrlNavigation`: `ignore`');
    expect(text).toContain('`preloading`: `PreloadAllModules`');
    expect(text).toContain('**Instrumentation** on');
  });

  it('export-navigation builds a repro for the latest failure', async () => {
    const { push, call } = await boot();
    await push('push-router', report());
    const text = await call('export-navigation');
    expect(text).toContain('## Router repro: #5 /nope (failed)');
    expect(text).toContain('Angular: 22.1.7');
    expect(text).toContain('### Relevant routes');
    const chain = await call('export-navigation', { id: 4 });
    expect(chain).toContain('#3 `/admin`');
    expect(chain).toContain('#4 `/login`');
    const later = {
      id: 6,
      url: '/welcome',
      trigger: 'imperative',
      startedAt: 1200,
      outcome: 'succeeded' as const,
      redirectedFrom: 4,
    };
    const fresh = await boot();
    await fresh.push('push-router', report({ navigations: [...navigations, later] }));
    const full = await fresh.call('export-navigation', { id: 3 });
    expect(full).toContain('#4 `/login`');
    expect(full).toContain('#6 `/welcome`');
  });

  it('explain-render-mode reads the workspace server routes', async () => {
    const { push, call } = await boot();
    await push('push-router', report({ snapshot: { ...report().snapshot, url: '/book/lisbon' } }));
    const text = await call('explain-render-mode', { url: '/book/lisbon' });
    expect(text).toContain('renders with `Client`');
    expect(text).toContain('app.routes.server.ts');
  });

  it('navigate asks the page and returns its answer', async () => {
    const { ctx, push, call } = await boot();
    await push('push-router', report());
    const broadcast = vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: never) => {
      const [{ requestId, pageId, request }] = (
        options as { args: [{ requestId: string; pageId: string; request: unknown }] }
      ).args;
      expect(pageId).toBe('p1');
      expect(request).toMatchObject({ action: 'navigate', url: '/users/9' });
      await push('router-action-result', { requestId, result: { outcome: 'succeeded', id: 6 } });
      return undefined as never;
    }) as never);
    const text = await call('navigate', { action: 'navigate', url: '/users/9' });
    expect(text).toContain('"outcome": "succeeded"');
    expect(broadcast).toHaveBeenCalledOnce();
  });

  it('sends a panel router action to one page when no page is named', async () => {
    const { ctx, push, call } = await boot();
    await push('push-router', report());
    await push('push-router', { ...report(), pageId: 'other', snapshot: null });
    const seen: unknown[] = [];
    vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: never) => {
      const { requestId, pageId } = (options as { args: [{ requestId: string; pageId?: string }] })
        .args[0];
      seen.push(pageId);
      await push('router-action-result', { requestId, result: { ok: true } });
    }) as never);
    await push('request-router-action', { request: { action: 'probe', url: '/' } });
    await push('request-router-action', { pageId: '', request: { action: 'probe', url: '/' } });
    await call('navigate', { url: '/users/7', page: '' });
    expect(seen).toEqual([report().pageId, report().pageId, report().pageId]);
  });

  it('navigate refuses pages without a router and resolve-lazy without a routeId', async () => {
    const { ctx, push, call } = await boot();
    await push('push-router', report());
    await push('push-router', { ...report(), pageId: 'bare', snapshot: null });
    const broadcast = vi.spyOn(ctx.rpc, 'broadcast');
    expect(await call('navigate', { action: 'probe', url: '/', page: 'bare' })).toMatch(
      /Page `bare` reports no Router/,
    );
    const unknown = await call('navigate', { action: 'probe', url: '/', page: 'gone' });
    expect(unknown).toMatch(/^No page `gone` is reporting router state\. Pages that report/);
    expect(unknown).toContain('`bare`');
    expect(unknown).not.toMatch(/stdio/);
    expect(await call('navigate', { action: 'resolve-lazy' })).toContain('routeId is required');
    expect(broadcast).not.toHaveBeenCalled();
  });

  it('blocks navigate, abort, replay and probe with actions.router off but keeps instrument and resolve-lazy', async () => {
    const { ctx, push, call } = await boot({ actions: { router: false } });
    expect(ctx.agent.list().tools.map((tool) => tool.id)).toContain('ng-devtools:navigate');
    await push('push-router', report());
    const sent: unknown[] = [];
    vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: never) => {
      const { requestId, request } = (
        options as { args: [{ requestId: string; request: unknown }] }
      ).args[0];
      sent.push(request);
      await push('router-action-result', { requestId, result: { ok: true } });
    }) as never);
    for (const action of ['navigate', 'abort', 'replay', 'probe']) {
      expect(await call('navigate', { action, url: '/users/9', id: 3 })).toBe(
        'Navigating is turned off in the devtools config (actions.router).',
      );
    }
    expect(await call('navigate', { action: 'instrument', on: true })).toContain('"ok": true');
    expect(await call('navigate', { action: 'resolve-lazy', routeId: '2' })).toContain(
      '"ok": true',
    );
    expect(sent).toEqual([
      { action: 'instrument', on: true },
      { action: 'resolve-lazy', id: '2' },
    ]);
  });

  it('tells the page whether its route config is stored', async () => {
    const { push } = await boot();
    const bare = { pageId: 'fresh', snapshot: null, navigations: [], generation: 1 };
    expect(await push('push-router', bare)).toEqual({ hasConfig: false });
    expect(await push('push-router', { ...bare, config })).toEqual({ hasConfig: true });
    expect(await push('push-router', bare)).toEqual({ hasConfig: true });
    expect(await push('push-router', { pageId: 1 })).toEqual({ hasConfig: false });
  });

  it('rejects malformed router reports', async () => {
    const { push, call } = await boot();
    await push('push-router', { ...report(), config: [{ id: 1 }] });
    expect(await call('list-routes')).toMatch(/no router state/i);
    await push('push-router', {
      ...report(),
      navigations: [{ ...navigations[0], runs: [{ guard: 1 }] }],
    });
    expect(await call('explain-navigation')).toMatch(/no router state/i);
  });
});
