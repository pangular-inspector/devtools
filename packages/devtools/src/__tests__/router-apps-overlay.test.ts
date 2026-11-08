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
    config: paths.map((path) => ({ path }) as Record<string, unknown>),
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

function install(
  routers: Map<string, ReturnType<typeof fakeRouter>>,
  extra: Record<string, unknown> = {},
) {
  (window as { ng?: unknown }).ng = {
    getComponent: () => ({}),
    getInjector: (el: Element) => ({ tag: el.localName }),
    ɵgetRouterInstance: (injector: { tag: string }) => routers.get(injector.tag) ?? null,
    ...extra,
  };
}

/** Angular's preloader class, found by name like the overlay finds it. */
class RouterPreloader {}

/** Gives a fake Router an activated primary outlet showing `component`, and RouterLink helpers. */
function withOutlet<T extends ReturnType<typeof fakeRouter>>(router: T, component: string) {
  class Routed {}
  Object.defineProperty(Routed, 'name', { value: component });
  return Object.assign(router, {
    serializeUrl: (tree: unknown) => String(tree),
    isActive: () => false,
    navigationTransitions: {
      rootContexts: {
        contexts: new Map([
          [
            'primary',
            {
              outlet: { isActivated: true, component: new Routed() },
              route: null,
              children: null,
            },
          ],
        ]),
      },
    },
  });
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

  it("files each app's outlets, links, preloads, guard runs and callers under that app", async () => {
    document.body.innerHTML =
      '<app-root ng-version="22.0.0"><a id="home">Home</a></app-root>' +
      '<cart-widget ng-version="22.0.0"><a id="basket">Basket</a></cart-widget>';
    const shell = withOutlet(fakeRouter('/home', ['home']), 'Shell');
    const cart = withOutlet(fakeRouter('/cart', ['cart', 'checkout']), 'CartPage');
    const cartGuard = () => true;
    cart.config[1]['canActivate'] = [cartGuard];
    const strategy = (name: string) => ({
      name,
      preload: (_route: unknown, load: () => unknown) => load(),
    });
    const preloaders = new Map([
      ['app-root', { preloadingStrategy: strategy('shell') }],
      ['cart-widget', { preloadingStrategy: strategy('cart') }],
    ]);
    const links = new Map<Element, unknown>([
      [document.getElementById('home')!, { urlTree: '/home', router: shell }],
      [document.getElementById('basket')!, { urlTree: '/cart', router: cart }],
    ]);
    install(
      new Map([
        ['app-root', shell],
        ['cart-widget', cart],
      ]),
      {
        getDirectives: (el: Element) => (links.has(el) ? [links.get(el)] : []),
        ɵgetInjectorResolutionPath: (injector: unknown) => [injector],
        ɵgetInjectorProviders: () => [{ token: RouterPreloader }],
        getInjector: (el: Element) => ({
          tag: el.localName,
          get: (token: unknown) =>
            token === RouterPreloader ? (preloaders.get(el.localName) ?? null) : null,
        }),
      },
    );
    const { initOverlay } = await import('../overlay.ts');
    const dispose = await initOverlay();
    try {
      await vi.advanceTimersByTimeAsync(2_000);
      // The cart app's code navigates, its guard runs, and its preloader loads a route.
      void cart.navigateByUrl('/checkout');
      emit(cart, { type: 0, id: 1, url: '/checkout' });
      (cart.config[1]['canActivate'] as (() => boolean)[])[0]();
      emit(cart, { type: 1, id: 1, url: '/checkout', urlAfterRedirects: '/checkout' });
      preloaders.get('cart-widget')!.preloadingStrategy.preload({ path: 'orders' }, () => ({}));
      // A navigation of the first app in the same breath gets no caller of the cart's.
      emit(shell, { type: 0, id: 1, url: '/home' });
      emit(shell, { type: 1, id: 1, url: '/home', urlAfterRedirects: '/home' });
      await vi.advanceTimersByTimeAsync(2_000);
      const last = reports.at(-1)! as {
        navigations: { url: string; caller?: string; runs?: unknown[] }[];
        outlets: { component?: string }[];
        links: { text: string; href?: string }[];
        preloads: unknown[];
        apps: {
          id: string;
          navigations?: { url: string; caller?: string; runs?: { guard: string }[] }[];
          outlets?: { component?: string }[];
          links?: { text: string; href?: string }[];
          preloads?: { path: string }[];
        }[];
      };
      expect(last.outlets.map((o) => o.component)).toEqual(['Shell']);
      expect(last.links.map((l) => l.text)).toEqual(['Home']);
      expect(last.preloads).toEqual([]);
      expect(last.navigations.map((n) => [n.url, n.caller, n.runs])).toEqual([
        ['/home', undefined, undefined],
      ]);
      const app = last.apps[1];
      expect(app.id).toBe('cart-widget');
      expect(app.outlets?.map((o) => o.component)).toEqual(['CartPage']);
      expect(app.links?.map((l) => [l.text, l.href])).toEqual([['Basket', '/cart']]);
      expect(app.preloads?.map((p) => p.path)).toEqual(['orders']);
      expect(app.navigations).toEqual([
        expect.objectContaining({
          url: '/checkout',
          caller: expect.stringMatching(/^navigateByUrl\(\)/),
          runs: [expect.objectContaining({ guard: 'cartGuard', route: '/checkout' })],
        }),
      ]);

      // Turning guard recording off from the cart app turns it off on the page.
      routerAction?.({
        requestId: 'r3',
        pageId: (last as unknown as { pageId: string }).pageId,
        app: 'cart-widget',
        request: { action: 'instrument', on: false },
      });
      await vi.advanceTimersByTimeAsync(100);
      expect(actions).toContainEqual(
        expect.objectContaining({ requestId: 'r3', result: { instrumented: false } }),
      );
      expect((cart.config[1]['canActivate'] as unknown[])[0]).toBe(cartGuard);
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
