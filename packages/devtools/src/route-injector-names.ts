// Names for the environment injectors of empty-path routes.
//
// The router creates a route's environment injector with the source
// `Route: ${route.path}` (`@angular/router/fesm2022/_router-chunk.mjs`,
// `_router_module-chunk.mjs`), so a `path: ''` route with `providers` is
// named `Route: ` and can't be told apart or matched by its URL. The router
// collector notes every route's `_injector` with the path of its parent
// routes, and the injector tree names an empty-path one by that path.

type AnyRecord = Record<string, unknown>;

/** Route depth walked at most, against a config that refers to itself. */
const MAX_DEPTH = 30;
const fullPaths = new WeakMap<object, string>();

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn() ?? fallback;
  } catch {
    return fallback;
  }
}

/** Notes the full path of every route that has its own environment injector. */
export function noteRouteInjectors(router: unknown): void {
  routeInjectors(router);
}

/**
 * The environment injectors the router created for its routes, in config
 * order: a route's `providers` injector (`_injector`) and the injector of the
 * module or routes a `loadChildren` loaded (`_loadedInjector`). Both are set
 * by `@angular/router` on the route objects of `router.config`, and stay
 * there once the user navigates away. Notes the full path of each route's
 * `_injector` on the way, for {@link routeInjectorName}.
 */
export function routeInjectors(router: unknown): object[] {
  const config = read(() => (router as AnyRecord)['config'] as AnyRecord[] | undefined, undefined);
  if (!Array.isArray(config)) return [];
  const seen = new Set<object>();
  const out = new Set<object>();
  const visit = (routes: unknown, parent: string, depth: number) => {
    if (!Array.isArray(routes) || depth > MAX_DEPTH) return;
    for (const route of routes as AnyRecord[]) {
      if (!route || typeof route !== 'object' || seen.has(route)) continue;
      seen.add(route);
      const path = read(() => (typeof route['path'] === 'string' ? route['path'] : ''), '');
      const full = [parent, path].filter(Boolean).join('/');
      const injector = read(() => route['_injector'], undefined);
      if (injector && typeof injector === 'object') {
        fullPaths.set(injector, full);
        out.add(injector);
      }
      const loaded = read(() => route['_loadedInjector'], undefined);
      if (loaded && typeof loaded === 'object') out.add(loaded);
      visit(
        read(() => route['children'], undefined),
        full,
        depth + 1,
      );
      visit(
        read(() => route['_loadedRoutes'], undefined),
        full,
        depth + 1,
      );
    }
  };
  visit(config, '', 0);
  return [...out];
}

/**
 * The name for a route's environment injector: Angular's own, except for an
 * empty-path route, which gets the path of its parent routes (`Route: review`,
 * or `Route: /` at the top). Undefined when the injector is not a known route's.
 */
export function routeInjectorName(injector: unknown, source: string): string | undefined {
  if (source.trim() !== 'Route:' || !injector || typeof injector !== 'object') return undefined;
  const full = fullPaths.get(injector);
  if (full === undefined) return undefined;
  return `Route: ${full || '/'}`;
}
