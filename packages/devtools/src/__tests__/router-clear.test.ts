// @vitest-environment jsdom
import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PANGULAR_INSPECTORS, type PangularConfig } from '../config.ts';
import pangular, { createPangular } from '../devframe.ts';
import { clearNavigations, droppedNavigations, trimNavigations } from '../router.ts';
import type { NavigationRecord } from '../router.ts';
import type { RouterState } from '../rpc/router-tools.ts';

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

const looping = [
  redirect(1, '/account', '/login', 'authGuard'),
  redirect(2, '/login', '/account', 'guestGuard', 1),
  redirect(3, '/account', '/login', 'authGuard', 2),
  nav(4, { url: '/login', redirectedFrom: 3 }),
];

async function boot(config?: PangularConfig) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await (config ? createPangular(config) : pangular).setup(ctx as never);
  const invoke = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never)) as Promise<unknown>;
  const router = async () =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: { get: (key: string) => Promise<{ value: () => RouterState }> };
        }
      ).sharedState.get('pangular:router')
    ).value();
  return { ctx, invoke, router };
}

const report = (pageId: string, navigations: NavigationRecord[], extra = {}) => ({
  pageId,
  generation: 1,
  snapshot: null,
  navigations,
  ...extra,
});

describe('clear-router-navigations', () => {
  it("drops only the given page's navigations, loops and dropped count, and tells that page", async () => {
    const { ctx, invoke, router } = await boot();
    const broadcast = vi.spyOn(ctx.rpc, 'broadcast');
    const pending = nav(5, { url: '/slow', outcome: 'pending', endedAt: undefined });
    await invoke('push-router', report('p1', [...looping, pending], { dropped: 3 }));
    await invoke('push-router', report('p2', looping));
    const before = (await router()).pages.find((p) => p.pageId === 'p1')!;
    expect(before.loops).toHaveLength(1);
    expect(before.dropped).toBe(3);

    await invoke('clear-router-navigations', 'p1');

    const pages = (await router()).pages;
    const p1 = pages.find((p) => p.pageId === 'p1')!;
    expect(p1.navigations.map((n) => n.id)).toEqual([5]);
    expect(p1.loops).toEqual([]);
    expect(p1.dropped).toBeUndefined();
    const p2 = pages.find((p) => p.pageId === 'p2')!;
    expect(p2.navigations).toHaveLength(4);
    expect(p2.loops).toHaveLength(1);
    expect(broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'pangular:router-clear',
        args: [{ pageId: 'p1' }],
      }),
    );
  });

  it('keeps the list empty when the page reports after clearing', async () => {
    const { invoke, router } = await boot();
    await invoke('push-router', report('p1', looping));
    await invoke('clear-router-navigations', 'p1');
    await invoke('push-router', report('p1', [nav(6, { url: '/fresh' })]));
    const p1 = (await router()).pages.find((p) => p.pageId === 'p1')!;
    expect(p1.navigations.map((n) => n.url)).toEqual(['/fresh']);
    expect(p1.loops).toEqual([]);
  });

  it('refuses without a page id and when router actions are off', async () => {
    const { invoke } = await boot();
    await expect(invoke('clear-router-navigations', undefined)).rejects.toThrow('page');
    const off = await boot({ actions: { router: false } });
    await off.invoke('push-router', report('p1', looping));
    await expect(off.invoke('clear-router-navigations', 'p1')).rejects.toThrow('actions.router');
    expect((await off.router()).pages[0].navigations).toHaveLength(4);
  });
});

describe('clearNavigations in the page', () => {
  it('empties the list and the dropped count, keeping a navigation in progress', () => {
    const navigations = [nav(1), nav(2), nav(3), nav(4, { outcome: 'pending' })];
    trimNavigations(navigations, 3);
    expect(droppedNavigations(navigations)).toBe(1);
    clearNavigations(navigations);
    expect(navigations.map((n) => n.id)).toEqual([4]);
    expect(droppedNavigations(navigations)).toBe(0);
  });
});

const handlers = new Map<string, (arg: unknown) => void>();
const pushes: { pageId: string; navigations: unknown[] }[] = [];

vi.mock('devframe/client', () => ({
  connectDevframe: async () => ({
    connectionMeta: {
      backend: 'websocket',
      configs: {
        pangular: {
          inspectors: Object.fromEntries(PANGULAR_INSPECTORS.map((key) => [key, key === 'router'])),
          limits: { refreshMs: 500 },
        },
      },
    },
    scope: () => ({
      rpc: {
        call: async (name: string, arg: unknown) => {
          if (name === 'push-router') pushes.push(arg as never);
          return undefined;
        },
        register: (fn: { name: string; handler: (arg: unknown) => void }) =>
          handlers.set(fn.name, fn.handler),
      },
    }),
  }),
}));

describe('router-clear in the overlay', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    handlers.clear();
    pushes.length = 0;
  });

  it('reports again only for its own page', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    const { initOverlay } = await import('../overlay.ts');
    const dispose = await initOverlay();
    try {
      await vi.advanceTimersByTimeAsync(100);
      const pageId = pushes[0]!.pageId;
      const clear = handlers.get('router-clear')!;
      pushes.length = 0;
      clear({ pageId: 'someone-else' });
      await vi.advanceTimersByTimeAsync(100);
      expect(pushes).toEqual([]);
      clear({ pageId });
      await vi.advanceTimersByTimeAsync(100);
      expect(pushes).toHaveLength(1);
      expect(pushes[0]).toMatchObject({ pageId, navigations: [] });
    } finally {
      dispose();
    }
  });
});
