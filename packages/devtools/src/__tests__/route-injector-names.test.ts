// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { injectorRef } from '../injector-tree.ts';
import { noteRouteInjectors, routeInjectorName } from '../route-injector-names.ts';
import { injectorMatches } from '../signal-graph.ts';

describe('route injector names', () => {
  // Angular names a route's environment injector `Route: ${route.path}`.
  const reviewEnv = { records: new Map() };
  const adminEnv = { records: new Map() };
  const topEnv = { records: new Map() };
  const router = {
    config: [
      { path: '', providers: [], _injector: topEnv },
      {
        path: 'review',
        loadChildren: () => [],
        _loadedRoutes: [{ path: '', providers: [], _injector: reviewEnv }],
      },
      { path: 'admin', providers: [], _injector: adminEnv, children: [] },
    ],
  };
  const ng = {
    ɵgetInjectorMetadata: (injector: unknown) => ({
      type: 'environment',
      source: injector === adminEnv ? 'Route: admin' : 'Route: ',
    }),
  };

  it('names an empty-path route injector by the path of its parent routes', () => {
    noteRouteInjectors(router);
    expect(injectorRef(ng as never, reviewEnv)?.name).toBe('Route: review');
    expect(injectorRef(ng as never, topEnv)?.name).toBe('Route: /');
    // Angular's own name stays for a route with a path.
    expect(injectorRef(ng as never, adminEnv)?.name).toBe('Route: admin');
    expect(routeInjectorName({}, 'Route: ')).toBeUndefined();
  });

  it('lets a route path select the injector', () => {
    noteRouteInjectors(router);
    const injector = injectorRef(ng as never, reviewEnv)!;
    expect(injectorMatches(injector, '/review')).toBe(true);
    expect(injectorMatches(injector, 'Route: review')).toBe(true);
  });
});
