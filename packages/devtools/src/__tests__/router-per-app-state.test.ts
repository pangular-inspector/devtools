// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyRouterEvent,
  noteFailedCall,
  setCaller,
  setGeneration,
  WRAPPED,
  type NavigationRecord,
} from '../router.ts';
import { captureCallers, instrument } from '../router-actions.ts';

/** The parts of a Router the per-router state reads. */
function fakeRouter(url: string) {
  return { url, config: [] as Record<string, unknown>[] };
}

const start = (id: number, url: string) => ({ type: 0, id, url });

describe('router state kept per Router', () => {
  it('gives the caller to the app whose navigation starts, not to another app', () => {
    const shell = fakeRouter('/');
    const cart = fakeRouter('/cart');
    const shellNavs: NavigationRecord[] = [];
    const cartNavs: NavigationRecord[] = [];
    setCaller('navigateByUrl() from CartPage.buy', false, cart);
    applyRouterEvent(shellNavs, start(1, '/home'), Date.now(), shell);
    applyRouterEvent(cartNavs, start(1, '/checkout'), Date.now(), cart);
    expect(shellNavs[0].caller).toBeUndefined();
    expect(cartNavs[0].caller).toBe('navigateByUrl() from CartPage.buy');
  });

  it('links a redirect to the next navigation of the same app only', () => {
    const shell = fakeRouter('/');
    const cart = fakeRouter('/cart');
    const shellNavs: NavigationRecord[] = [];
    const cartNavs: NavigationRecord[] = [];
    applyRouterEvent(cartNavs, start(1, '/checkout'), 0, cart);
    applyRouterEvent(cartNavs, { type: 2, id: 1, code: 0, reason: 'Redirecting' }, 1, cart);
    // The redirect request comes before the navigation it starts.
    applyRouterEvent(cartNavs, { url: '/login', navigationBehaviorOptions: {} }, 2, cart);
    applyRouterEvent(shellNavs, start(5, '/home'), 3, shell);
    applyRouterEvent(cartNavs, start(2, '/login'), 4, cart);
    expect(shellNavs[0].redirectedFrom).toBeUndefined();
    expect(cartNavs[1]).toMatchObject({ url: '/login', redirectedFrom: 1 });
  });

  it('stamps each app with its own config generation and numbers failed calls per app', () => {
    const shell = fakeRouter('/');
    const cart = fakeRouter('/cart');
    setGeneration(4, shell);
    setGeneration(9, cart);
    const shellNavs: NavigationRecord[] = [];
    const cartNavs: NavigationRecord[] = [];
    applyRouterEvent(shellNavs, start(1, '/a'), 0, shell);
    applyRouterEvent(cartNavs, start(1, '/b'), 0, cart);
    expect(shellNavs[0].generation).toBe(4);
    expect(cartNavs[0].generation).toBe(9);

    noteFailedCall(shellNavs, '/x', new Error('nope'), 1, shell);
    noteFailedCall(cartNavs, '/y', new Error('nope'), 1, cart);
    noteFailedCall(cartNavs, '/z', new Error('nope'), 2, cart);
    expect(shellNavs.at(-1)).toMatchObject({ id: -1, generation: 4 });
    expect(cartNavs.slice(-2).map((nav) => nav.id)).toEqual([-1, -2]);
  });
});

describe('RouterLink clicks on a page with several apps', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('notes the click as the caller of the app whose link it is', () => {
    document.body.innerHTML = '<a id="shell">Home</a><a id="cart">Basket</a>';
    const shell = { ...fakeRouter('/'), navigate: () => true, navigateByUrl: () => true };
    const cart = { ...fakeRouter('/cart'), navigate: () => true, navigateByUrl: () => true };
    const links = new Map<Element, unknown>([
      [document.getElementById('shell')!, { urlTree: {}, router: shell }],
      [document.getElementById('cart')!, { urlTree: {}, router: cart }],
    ]);
    const ng = { getDirectives: (el: Element) => (links.has(el) ? [links.get(el)] : []) };
    const shellNavs: NavigationRecord[] = [];
    const cartNavs: NavigationRecord[] = [];
    const stops = [captureCallers(shell, shellNavs, ng), captureCallers(cart, cartNavs, ng)];
    try {
      document.getElementById('cart')!.click();
      applyRouterEvent(shellNavs, start(1, '/home'), Date.now(), shell);
      applyRouterEvent(cartNavs, start(1, '/basket'), Date.now(), cart);
      expect(shellNavs[0].caller).toBeUndefined();
      expect(cartNavs[0].caller).toBe('RouterLink a "Basket"');
    } finally {
      for (const stop of stops) stop();
    }
  });
});

describe('guard recording on a page with several apps', () => {
  function appWith(routes: Record<string, unknown>[]) {
    let current: object | null = null;
    return {
      config: routes,
      serializeUrl: String,
      currentNavigation: () => current,
      navigating(on: boolean) {
        current = on ? {} : null;
      },
    };
  }
  const pending = (id: number, url: string): NavigationRecord => ({
    id,
    url,
    trigger: 'imperative',
    startedAt: 0,
    outcome: 'pending',
  });

  it('records a guard each app has into that app', () => {
    const shellGuard = () => true;
    const cartGuard = () => false;
    const shell = appWith([{ path: 'a', canActivate: [shellGuard] }]);
    const cart = appWith([{ path: 'b', canActivate: [cartGuard] }]);
    const shellNavs = [pending(1, '/a')];
    const cartNavs = [pending(1, '/b')];
    const stops = [instrument(shell, shellNavs), instrument(cart, cartNavs)];
    (shell.config[0]['canActivate'] as (() => boolean)[])[0]();
    (cart.config[0]['canActivate'] as (() => boolean)[])[0]();
    expect(shellNavs[0].runs).toEqual([expect.objectContaining({ route: '/a', result: 'true' })]);
    expect(cartNavs[0].runs).toEqual([expect.objectContaining({ route: '/b', result: 'false' })]);
    for (const stop of stops) stop();
    expect((shell.config[0]['canActivate'] as unknown[])[0]).toBe(shellGuard);
  });

  it('records a guard two apps share into the app that is navigating, and unwraps after both', () => {
    class AuthGuard {
      canActivate() {
        return true;
      }
    }
    const own = AuthGuard.prototype.canActivate;
    const routes = (path: string) => [{ path, canActivate: [AuthGuard] }];
    const shell = appWith(routes('a'));
    const cart = appWith(routes('b'));
    const shellNavs: NavigationRecord[] = [];
    const cartNavs = [pending(3, '/b')];
    const stopShell = instrument(shell, shellNavs);
    const stopCart = instrument(cart, cartNavs);
    expect((AuthGuard.prototype.canActivate as unknown as Record<string, unknown>)[WRAPPED]).toBe(
      own,
    );
    cart.navigating(true);
    new AuthGuard().canActivate();
    expect(shellNavs).toEqual([]);
    expect(cartNavs[0].runs).toEqual([expect.objectContaining({ guard: 'AuthGuard' })]);

    // Both apps navigating: the run goes to the one whose Router is busy now.
    shellNavs.push(pending(7, '/a'));
    cart.navigating(false);
    shell.navigating(true);
    new AuthGuard().canActivate();
    expect(shellNavs[0].runs).toHaveLength(1);
    expect(cartNavs[0].runs).toHaveLength(1);

    // The shell app lets go first: the cart app still records.
    stopShell();
    expect(AuthGuard.prototype.canActivate).not.toBe(own);
    shell.navigating(false);
    cart.navigating(true);
    new AuthGuard().canActivate();
    expect(cartNavs[0].runs).toHaveLength(2);
    stopCart();
    expect(AuthGuard.prototype.canActivate).toBe(own);
  });
});
