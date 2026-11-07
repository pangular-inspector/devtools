import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import pangular from '../devframe.ts';
import type { RouteNode } from '../router-config.ts';
import {
  previewNavigation,
  previewNavigationText,
  redirectTarget,
  type RoutePreview,
} from '../rpc/router-preview.ts';
import type { RouterPage } from '../rpc/router-tools.ts';
import { answerText, toolAnswer } from './tool-answer.ts';

const config: RouteNode[] = [
  { id: '0', path: '', fullPath: '/', kind: 'redirect', redirectTo: 'home', pathMatch: 'full' },
  { id: '1', path: 'home', fullPath: '/home', kind: 'component', component: 'Home', title: 'Home' },
  {
    id: '2',
    path: 'account',
    fullPath: '/account',
    kind: 'children',
    guards: { canMatch: ['loggedIn'], canActivateChild: ['authGuard'] },
    children: [
      {
        id: '2.0',
        path: ':id',
        fullPath: '/account/:id',
        kind: 'component',
        component: 'AccountPage',
        lazy: 'unloaded',
        guards: { canActivate: ['ownerGuard'] },
        resolvers: ['account: accountResolver'],
        title: 'Account',
      },
      {
        id: '2.1',
        path: 'old/:id',
        fullPath: '/account/old/:id',
        kind: 'redirect',
        redirectTo: ':id',
      },
    ],
  },
  { id: '3', path: 'admin', fullPath: '/admin', kind: 'lazy', lazy: 'unloaded' },
  { id: '4', path: 'a', fullPath: '/a', kind: 'redirect', redirectTo: '/b', pathMatch: 'full' },
  { id: '5', path: 'b', fullPath: '/b', kind: 'redirect', redirectTo: '/a', pathMatch: 'full' },
  {
    id: '6',
    path: 'edit',
    fullPath: '/edit',
    kind: 'component',
    component: 'Editor',
    guards: { canDeactivate: ['unsavedGuard'] },
  },
  { id: '7', path: 'fn', fullPath: '/fn', kind: 'redirect', redirectTo: 'function pick' },
];

function page(extra: Partial<RouterPage> = {}): RouterPage {
  return {
    pageId: 'p1',
    snapshot: null,
    navigations: [],
    config,
    activeIds: ['6'],
    reportedAt: Date.now(),
    changedAt: Date.now(),
    ...extra,
  };
}

function preview(url: string, extra?: Partial<RouterPage>): RoutePreview {
  const result = previewNavigation(page(extra), url, [
    {
      path: ':id',
      fullPath: '/account/:id',
      component: 'AccountPage',
      file: 'src/app/app.routes.ts',
      line: 12,
    },
  ]);
  if ('error' in result) throw new Error(result.error);
  return result;
}

describe('redirectTarget', () => {
  it('fills params into a relative redirect under its parent and keeps the query', () => {
    const chain = [config[2], config[2].children![1]];
    expect(redirectTarget('/account/old/7?tab=a', chain, { id: '7' })).toBe('/account/7?tab=a');
  });
});

describe('previewNavigation', () => {
  it('lists the guards, lazy chunks, resolvers and components in the order the router runs them', () => {
    const result = preview('/account/old/42?tab=orders');
    expect(result.hops).toEqual([
      {
        from: '/account/old/42?tab=orders',
        to: '/account/42?tab=orders',
        route: '/account/old/:id',
      },
    ]);
    expect(result.matched).toBe(true);
    expect(result.params).toEqual({ id: '42' });
    expect(result.chain.map((r) => r.path)).toEqual(['/account', '/account/:id']);
    expect(result.chain[1].source).toBe('src/app/app.routes.ts:12');
    expect(result.steps.map((s) => s.phase.split(' (')[0])).toEqual([
      'canMatch',
      'canDeactivate',
      'canActivateChild and canActivate',
      'Lazy component download',
      'Resolvers',
      'Renders',
      'Title',
    ]);
    expect(result.steps[1].items).toEqual(['unsavedGuard @ /edit']);
    expect(result.steps[2].items).toEqual([
      'canActivateChild authGuard @ /account',
      'canActivate ownerGuard @ /account/:id',
    ]);
    expect(result.steps[3].items).toEqual(['AccountPage (downloads now)']);
  });

  it('stops at a lazy route that has not loaded, a function redirect or a loop', () => {
    expect(preview('/admin/users').stopped).toMatch(/loads its children lazily/);
    expect(preview('/fn').stopped).toMatch(/redirects with a function/);
    expect(preview('/a').stopped).toMatch(/loop back to \/a/);
  });

  it('names the nearest routes when nothing matches', () => {
    const result = preview('/hom');
    expect(result.matched).toBe(false);
    expect(result.nearest.length).toBeGreaterThan(0);
  });

  it('says why there is no preview without a config', () => {
    expect(previewNavigation(page({ config: undefined }), '/home')).toEqual({
      error: 'The page has not reported its route config yet.',
    });
  });

  it('adds the render mode from the ServerRoute entries', () => {
    const result = previewNavigation(
      page(),
      '/',
      [],
      [{ path: 'home', renderMode: 'Prerender', file: 'src/app/app.routes.server.ts' }],
    );
    expect(result).toMatchObject({
      finalUrl: '/home',
      renderMode: { mode: 'Prerender', path: 'home' },
    });
  });

  it('answers agents in markdown', () => {
    const text = previewNavigationText({ pages: [page()] }, { url: '/account/42' });
    expect(text).toContain('**Going to `/account/42`**');
    expect(text).toContain('**In order**');
    expect(text).toContain('`canActivate ownerGuard @ /account/:id`');
  });
});

describe('pangular:preview-navigation', () => {
  it('previews a URL on a live page and backs the router-preview RPC', async () => {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await pangular.setup(ctx as never);
    const invoke = (name: string, payload: unknown) =>
      ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
    await invoke('push-router', {
      pageId: 'page-v',
      snapshot: null,
      navigations: [],
      generation: 1,
      config,
    });
    const text = await answerText(
      ctx.agent.invoke('pangular:preview-navigation', { url: '/account/7' }),
    );
    expect(text).toContain('matches `/account` → `/account/:id`');
    const rpc = (await invoke('router-preview', {
      pageId: 'page-v',
      url: '/home',
    })) as RoutePreview;
    expect(rpc.chain.map((r) => r.component)).toEqual(['Home']);
  });

  it('says a page it does not know is unknown, with no preview from another page', async () => {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await pangular.setup(ctx as never);
    await ctx.rpc.invokeLocal(
      'pangular:push-router' as never,
      ...([{ pageId: 'page-w', snapshot: null, navigations: [], generation: 1, config }] as never),
    );
    const answer = await toolAnswer(
      ctx.agent.invoke('pangular:preview-navigation', { page: 'zz-no-such-page', url: '/home' }),
    );
    expect(answer.isError).toBe(true);
    expect(answer.markdown).toContain('No page `zz-no-such-page` is reporting router state');
    expect(answer.markdown).not.toContain('Going to');
  });
});
