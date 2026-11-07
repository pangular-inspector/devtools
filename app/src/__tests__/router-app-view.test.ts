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
});
