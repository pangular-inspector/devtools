import { describe, expect, it } from 'vitest';
import { routerAppView, type RouterPage } from '../pages/router-types';

describe('routerAppView', () => {
  it('carries the loops of a secondary app into its view', () => {
    const loop = {
      kind: 'redirect' as const,
      ids: [1, 2],
      cycle: ['/a', '/b'],
      hops: [],
      guards: [],
      bounces: 1,
      end: '/b',
    };
    const page = {
      pageId: 'p',
      reportedAt: 1,
      changedAt: 1,
      snapshot: null,
      navigations: [],
      apps: [
        { id: 'app-root', name: 'Shell', selector: 'app-root', primary: true },
        { id: 'cart', name: 'Cart', selector: 'cart-widget', navigations: [], loops: [loop] },
      ],
    } as unknown as RouterPage;
    expect(routerAppView(page, 'cart').loops).toEqual([loop]);
    expect(routerAppView(page, 'app-root').loops).toBeUndefined();
  });

  it("shows a secondary app's own outlets, links and preloads, and the page's guard recording", () => {
    const outlet = { outlet: 'primary', activated: true, component: 'Cart' };
    const link = { text: 'Basket', element: 'a', devtoolsId: 'd1', href: '/basket' };
    const preload = { path: 'checkout', startedAt: 1, ms: 4 };
    const page = {
      pageId: 'p',
      reportedAt: 1,
      changedAt: 1,
      snapshot: null,
      navigations: [],
      outlets: [{ outlet: 'primary', activated: true, component: 'Shell' }],
      links: [{ text: 'Home', element: 'a', devtoolsId: 'd0', href: '/' }],
      preloads: [],
      instrumented: true,
      apps: [
        { id: 'app-root', name: 'Shell', selector: 'app-root', primary: true },
        {
          id: 'cart',
          name: 'Cart',
          selector: 'cart-widget',
          navigations: [],
          outlets: [outlet],
          links: [link],
          linksTruncated: 2,
          preloads: [preload],
        },
      ],
    } as unknown as RouterPage;
    const cart = routerAppView(page, 'cart');
    expect(cart.outlets).toEqual([outlet]);
    expect(cart.links).toEqual([link]);
    expect(cart.linksTruncated).toBe(2);
    expect(cart.preloads).toEqual([preload]);
    expect(cart.instrumented).toBe(true);
    expect(routerAppView(page, 'app-root').links?.[0].text).toBe('Home');
  });
});
