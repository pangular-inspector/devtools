// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PANGULAR_INSPECTORS } from '../config.ts';

const reports: Record<string, unknown>[] = [];
const actions: unknown[] = [];
let routerAction: ((message: unknown) => void) | undefined;

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
          if (name === 'push-router') reports.push(JSON.parse(JSON.stringify(arg)));
          if (name === 'router-action-result') actions.push(arg);
          return undefined;
        },
        register: (definition: { name: string; handler: (message: unknown) => void }) => {
          if (definition.name === 'router-action') routerAction = definition.handler;
        },
      },
    }),
  }),
}));

type Listener = (event: Record<string, unknown>) => void;

function fakeRouter(url: string, paths: string[]) {
  const listeners = new Set<Listener>();
  const navigated: string[] = [];
  return {
    listeners,
    navigated,
    url,
    config: paths.map((path) => ({ path })),
    routerState: {
      snapshot: {
        root: { url: [], params: {}, data: {}, queryParams: {}, fragment: null, children: [] },
      },
    },
    navigateByUrl: (next: string) => {
      navigated.push(next);
      return Promise.resolve(true);
    },
    events: {
      subscribe(listener: Listener) {
        listeners.add(listener);
        return { unsubscribe: () => listeners.delete(listener) };
      },
    },
  };
}

function emit(router: ReturnType<typeof fakeRouter>, event: Record<string, unknown>) {
  for (const listener of router.listeners) listener(event);
}

function install(routers: Map<string, ReturnType<typeof fakeRouter>>) {
  (window as { ng?: unknown }).ng = {
    getComponent: () => ({}),
    getInjector: (el: Element) => ({ tag: el.localName }),
    ɵgetRouterInstance: (injector: { tag: string }) => routers.get(injector.tag) ?? null,
  };
}

describe('overlay router report with several apps', () => {
  beforeEach(() => {
    reports.length = 0;
    actions.length = 0;
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (window as { ng?: unknown }).ng;
    document.body.innerHTML = '';
  });

  it('reports each app with a stable id and runs actions on the app they name', async () => {
    document.body.innerHTML =
      '<app-root ng-version="22.0.0"></app-root><cart-widget ng-version="22.0.0"></cart-widget>';
    const shell = fakeRouter('/home', ['home']);
    const cart = fakeRouter('/cart', ['cart', 'checkout']);
    install(
      new Map([
        ['app-root', shell],
        ['cart-widget', cart],
      ]),
    );
    const { initOverlay } = await import('../overlay.ts');
    const dispose = await initOverlay();
    try {
      await vi.advanceTimersByTimeAsync(2_000);
      emit(cart, { type: 0, id: 1, url: '/checkout' });
      emit(cart, { type: 1, id: 1, url: '/checkout', urlAfterRedirects: '/checkout' });
      await vi.advanceTimersByTimeAsync(2_000);
      const last = reports.at(-1)! as {
        pageId: string;
        snapshot: { url: string };
        navigations: unknown[];
        apps: {
          id: string;
          primary?: boolean;
          snapshot?: { url: string };
          navigations?: { url: string }[];
        }[];
      };
      expect(last.pageId).toEqual(expect.any(String));
      expect(last.snapshot.url).toBe('/home');
      expect(last.navigations).toEqual([]);
      expect(last.apps.map((app) => [app.id, app.primary ?? false])).toEqual([
        ['app-root', true],
        ['cart-widget', false],
      ]);
      expect(last.apps[1].snapshot?.url).toBe('/cart');
      expect(last.apps[1].navigations?.map((nav) => nav.url)).toEqual(['/checkout']);

      routerAction?.({
        requestId: 'r1',
        pageId: last.pageId,
        app: 'cart-widget',
        request: { action: 'navigate', url: '/cart' },
      });
      routerAction?.({
        requestId: 'r2',
        pageId: last.pageId,
        app: 'nope',
        request: { action: 'navigate', url: '/x' },
      });
      await vi.advanceTimersByTimeAsync(100);
      expect(cart.navigated).toEqual(['/cart']);
      expect(shell.navigated).toEqual([]);
      expect(actions).toContainEqual(
        expect.objectContaining({
          requestId: 'r2',
          result: { error: expect.stringContaining('no app') },
        }),
      );
    } finally {
      dispose();
    }
  });

  it('keeps the report of a page with one app as it was', async () => {
    document.body.innerHTML = '<app-root ng-version="22.0.0"></app-root>';
    install(new Map([['app-root', fakeRouter('/home', ['home'])]]));
    const { initOverlay } = await import('../overlay.ts');
    const dispose = await initOverlay();
    try {
      await vi.advanceTimersByTimeAsync(2_000);
      expect(reports.length).toBeGreaterThan(0);
      for (const report of reports) expect(report).not.toHaveProperty('apps');
      expect(Object.keys(reports[0]).sort()).toEqual(
        [
          'activeIds',
          'config',
          'generation',
          'instrumented',
          'links',
          'navigations',
          'outlets',
          'pageId',
          'preloads',
          'setup',
          'snapshot',
        ].sort(),
      );
    } finally {
      dispose();
    }
  });
});
