// @vitest-environment jsdom
import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it } from 'vitest';
import pangular from '../devframe.ts';
import { RouterApps, appIdOf, type RouterAppReport } from '../router-apps.ts';
import { findRouters, type RouterDebugApi } from '../router.ts';
import { routerStateForApp } from '../rpc/router-apps.ts';
import { isRouterReport, type RouterPage } from '../rpc/router-tools.ts';
import { answerText } from './tool-answer.ts';

type Listener = (event: Record<string, unknown>) => void;

/** A Router as the overlay reads it: routes, state, events. */
function fakeRouter(url: string, paths: string[]) {
  const listeners = new Set<Listener>();
  const root = {
    url: [],
    params: {},
    data: {},
    queryParams: {},
    fragment: null,
    outlet: 'primary',
    routeConfig: null,
    children: [],
  };
  return {
    listeners,
    url,
    navigated: true,
    config: paths.map((path) => ({ path })),
    routerState: { snapshot: { root } },
    navigateByUrl: () => Promise.resolve(true),
    events: {
      subscribe(listener: Listener) {
        listeners.add(listener);
        return { unsubscribe: () => listeners.delete(listener) };
      },
    },
    emit(event: Record<string, unknown>) {
      for (const listener of listeners) listener(event);
    },
  };
}

class ShellApp {}
class CartWidget {}

/** A fake `ng` whose roots each have their own injector and Router. */
function fakeNg(routers: Map<Element, unknown>, components = new Map<Element, unknown>()) {
  return {
    getInjector: (el: Element) => ({ el }),
    getComponent: (el: Element) => components.get(el) ?? null,
    ɵgetRouterInstance: (injector: unknown) => routers.get((injector as { el: Element }).el),
  } as RouterDebugApi;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('router apps on one page', () => {
  it('reports each app with its own route and navigations, keyed by a stable id', () => {
    document.body.innerHTML =
      '<app-root ng-version="22.0.0"></app-root><cart-widget ng-version="22.0.0"></cart-widget>';
    const [shell, cart] = Array.from(document.querySelectorAll('[ng-version]'));
    const shellRouter = fakeRouter('/home', ['home', 'about']);
    const cartRouter = fakeRouter('/cart', ['cart', 'checkout']);
    const ng = fakeNg(
      new Map<Element, unknown>([
        [shell, shellRouter],
        [cart, cartRouter],
      ]),
      new Map<Element, unknown>([
        [shell, new ShellApp()],
        [cart, new CartWidget()],
      ]),
    );
    const roots = [shell, cart];
    const primary = findRouters(ng, roots)[0];
    expect(primary).toBe(shellRouter);

    let changes = 0;
    const apps = new RouterApps(() => changes++);
    apps.scan(ng, roots, primary);
    expect(apps.count).toBe(2);
    expect(apps.primaryRoot(null)).toBe(shell);
    expect(cartRouter.listeners.size).toBe(1);
    expect(shellRouter.listeners.size).toBe(0);

    cartRouter.emit({ type: 0, id: 1, url: '/checkout' });
    cartRouter.emit({ type: 1, id: 1, url: '/checkout', urlAfterRedirects: '/checkout' });
    expect(changes).toBeGreaterThan(0);

    const report = apps.report(ng, 2)!;
    expect(
      report.map(({ id, name, selector, primary }) => ({ id, name, selector, primary })),
    ).toEqual([
      { id: 'app-root', name: 'ShellApp', selector: 'app-root', primary: true },
      { id: 'cart-widget', name: 'CartWidget', selector: 'cart-widget', primary: undefined },
    ]);
    const other = report[1];
    expect(other.snapshot?.url).toBe('/cart');
    expect(other.config?.map((node) => node.path)).toEqual(['cart', 'checkout']);
    expect(other.navigations?.map(({ id, url, outcome }) => ({ id, url, outcome }))).toEqual([
      { id: 1, url: '/checkout', outcome: 'succeeded' },
    ]);
    // The first app's entry carries no data of its own: the report's top level has it.
    expect(report[0].navigations).toBeUndefined();

    // The same root keeps its id; a scan with the same roots does not look again.
    apps.scan(ng, roots, primary);
    expect(apps.report(ng, 2)!.map((app) => app.id)).toEqual(['app-root', 'cart-widget']);
    expect(cartRouter.listeners.size).toBe(1);
    expect(apps.target('cart-widget')?.router).toBe(cartRouter);
    expect(apps.target('app-root')).toBeNull();
    expect(apps.isPrimary('app-root')).toBe(true);
    expect(apps.isPrimary(undefined)).toBe(true);
    expect(apps.isPrimary('nope')).toBe(false);

    apps.reset();
    expect(cartRouter.listeners.size).toBe(0);
  });

  it('finds a second app that bootstraps into a root already on the page when forced', () => {
    document.body.innerHTML =
      '<app-root ng-version="22.0.0"></app-root><cart-widget ng-version="22.0.0"></cart-widget>';
    const [shell, cart] = Array.from(document.querySelectorAll('[ng-version]'));
    const shellRouter = fakeRouter('/home', ['home']);
    const routers = new Map<Element, unknown>([[shell, shellRouter]]);
    const ng = fakeNg(
      routers,
      new Map<Element, unknown>([
        [shell, new ShellApp()],
        [cart, new CartWidget()],
      ]),
    );
    const apps = new RouterApps(() => undefined);
    apps.scan(ng, [shell, cart], shellRouter);
    expect(apps.count).toBe(1);
    // The cart app bootstraps later, into the same root element.
    routers.set(cart, fakeRouter('/cart', ['cart']));
    apps.scan(ng, [shell, cart], shellRouter);
    expect(apps.count).toBe(1);
    apps.scan(ng, [shell, cart], shellRouter, true);
    expect(apps.count).toBe(2);
    apps.reset();
  });

  it('reports no app list on a page with one app', () => {
    document.body.innerHTML = '<app-root ng-version="22.0.0"></app-root><aside></aside>';
    const shell = document.querySelector('app-root')!;
    const router = fakeRouter('/home', ['home']);
    const ng = fakeNg(new Map<Element, unknown>([[shell, router]]));
    const apps = new RouterApps(() => {});
    apps.scan(ng, [shell], router);
    expect(apps.report(ng, 1)).toBeUndefined();
    expect(apps.primaryRoot(shell)).toBe(shell);
    expect(router.listeners.size).toBe(0);
  });

  it('counts two roots that share one Router as one app', () => {
    document.body.innerHTML =
      '<app-root ng-version="22.0.0"></app-root><app-dialog ng-version="22.0.0"></app-dialog>';
    const roots = Array.from(document.querySelectorAll('[ng-version]'));
    const router = fakeRouter('/', ['home']);
    const ng = fakeNg(new Map<Element, unknown>(roots.map((root) => [root, router])));
    const apps = new RouterApps(() => {});
    apps.scan(ng, roots, router);
    expect(apps.report(ng, 1)).toBeUndefined();
  });

  it('drops an app whose root left the page and gives a replacement root the same id', () => {
    document.body.innerHTML =
      '<app-root ng-version="22.0.0"></app-root><cart-widget ng-version="22.0.0"></cart-widget>';
    const [shell, cart] = Array.from(document.querySelectorAll('[ng-version]'));
    const shellRouter = fakeRouter('/home', ['home']);
    const cartRouter = fakeRouter('/cart', ['cart']);
    const routers = new Map<Element, unknown>([
      [shell, shellRouter],
      [cart, cartRouter],
    ]);
    const ng = fakeNg(routers);
    const apps = new RouterApps(() => {});
    apps.scan(ng, [shell, cart], shellRouter);
    expect(apps.count).toBe(2);
    cart.remove();
    expect(apps.report(ng, 2)).toBeUndefined();
    expect(cartRouter.listeners.size).toBe(0);

    const again = document.createElement('cart-widget');
    document.body.append(again);
    const nextRouter = fakeRouter('/cart', ['cart']);
    routers.set(again, nextRouter);
    apps.scan(ng, [shell, again], shellRouter);
    expect(appIdOf(again)).toBe('cart-widget');
    expect(apps.report(ng, 2)!.map((app) => app.id)).toEqual(['app-root', 'cart-widget']);
  });

  it('numbers two live roots with the same tag', () => {
    document.body.innerHTML = '<mfe-root></mfe-root><mfe-root></mfe-root>';
    const [a, b] = Array.from(document.querySelectorAll('mfe-root'));
    expect(appIdOf(a)).toBe('mfe-root');
    expect(appIdOf(b)).toBe('mfe-root-2');
    expect(appIdOf(a)).toBe('mfe-root');
  });
});

const appsList: RouterAppReport[] = [
  { id: 'app-root', name: 'ShellApp', selector: 'app-root', primary: true },
  {
    id: 'cart-widget',
    name: 'CartWidget',
    selector: 'cart-widget',
    snapshot: {
      url: '/checkout',
      queryParams: {},
      fragment: null,
      root: { path: '', url: '', outlet: 'primary', params: {}, data: {}, children: [] },
    },
    navigations: [
      {
        id: 1,
        url: '/checkout',
        trigger: 'imperative',
        startedAt: 1,
        endedAt: 2,
        outcome: 'succeeded',
      },
    ],
    generation: 1,
    config: [
      {
        id: '0',
        path: 'checkout',
        fullPath: '/checkout',
        kind: 'component',
        component: 'Checkout',
      },
    ],
    activeIds: ['0'],
  },
];

function routerReport(extra: Record<string, unknown> = {}) {
  return {
    pageId: 'p1',
    generation: 1,
    config: [{ id: '0', path: 'home', fullPath: '/home', kind: 'component', component: 'Home' }],
    activeIds: ['0'],
    snapshot: {
      url: '/home',
      queryParams: {},
      fragment: null,
      root: { path: '', url: '', outlet: 'primary', params: {}, data: {}, children: [] },
    },
    navigations: [
      {
        id: 1,
        url: '/home',
        trigger: 'imperative',
        startedAt: 1,
        endedAt: 2,
        outcome: 'succeeded',
      },
    ],
    ...extra,
  };
}

describe('router apps on the server', () => {
  it('accepts a report with an app list and refuses a malformed one', () => {
    expect(isRouterReport(routerReport({ apps: appsList }))).toBe(true);
    expect(isRouterReport(routerReport({ apps: [{ id: 3 }] }))).toBe(false);
    expect(isRouterReport(routerReport({ apps: new Array(9).fill(appsList[0]) }))).toBe(false);
  });

  it('shows the page as the asked-for app and leaves single-app pages alone', () => {
    const page = { ...routerReport({ apps: appsList }), reportedAt: 1, changedAt: 1 } as RouterPage;
    const single = { ...routerReport({ pageId: 'p2' }), reportedAt: 1, changedAt: 1 } as RouterPage;
    const state = { pages: [page, single] };

    const cart = routerStateForApp(state, { page: 'p1', app: 'CartWidget' });
    expect('error' in cart).toBe(false);
    if ('error' in cart) return;
    const view = cart.state.pages.find((p) => p.pageId === 'p1')!;
    expect(view.appId).toBe('cart-widget');
    expect(view.snapshot?.url).toBe('/checkout');
    expect(view.config?.[0].component).toBe('Checkout');
    expect(cart.note).toContain('`app-root`');

    const plain = routerStateForApp(state, { page: 'p2' });
    expect(plain).toEqual({ state, note: '' });
    expect(routerStateForApp(state, { page: 'p2', app: 'x' })).toHaveProperty('error');
    expect(routerStateForApp(state, { page: 'p1', app: 'nope' })).toHaveProperty('error');
  });
});

describe('router agent tools with several apps', () => {
  async function boot() {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await pangular.setup(ctx as never);
    const push = (name: string, payload: unknown) =>
      ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
    const call = async (tool: string, args: Record<string, unknown> = {}) =>
      await answerText(ctx.agent.invoke(`pangular:${tool}`, args));
    return { push, call, ctx };
  }

  it('answers for the app named by `app` and names the others', async () => {
    const { push, call } = await boot();
    await push('push-router', routerReport({ apps: appsList }));
    const first = await call('inspect-route');
    expect(first).toContain('/home');
    expect(first).toContain('Pass `app` to read another');
    const cart = await call('inspect-route', { app: 'cart-widget' });
    expect(cart).toContain('/checkout');
    expect(cart).toContain('**URL** `/checkout`');
    expect(cart).not.toContain('**URL** `/home`');
    const routes = await call('list-routes', { app: 'cart-widget' });
    expect(routes).toContain('Checkout');
    expect(await call('list-routes', { app: 'nope' })).toContain('has no app');
  });

  it('shows the panel no data for an app the page does not have', async () => {
    const { push, ctx } = await boot();
    await push('push-router', routerReport({ apps: appsList }));
    const lint = (app: string) =>
      ctx.rpc.invokeLocal('pangular:router-lint' as never, ...([{ pageId: 'p1', app }] as never));
    expect(await lint('cart-widget')).toMatchObject({ checked: true });
    expect(await lint('nope')).toEqual({ checked: false, reason: 'no-page' });
  });

  it('answers a single-app page exactly as before', async () => {
    const { push, call } = await boot();
    await push('push-router', routerReport());
    const text = await call('inspect-route');
    expect(text).not.toContain('Pass `app`');
    expect(await call('inspect-route', { app: 'x' })).toContain('one Angular app');
  });
});
