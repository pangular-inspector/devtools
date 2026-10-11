import {
  applyRouterEvent,
  eventsOf,
  read,
  type AnyRecord,
  type NavigationRecord,
  type RouterDebugApi,
} from './router.ts';
import { ssrRegistry } from './ssr-registry.ts';

const MAX_NAVIGATIONS = 5;

export interface SsrNavigation {
  url: string;
  finalUrl?: string;
  outcome: NavigationRecord['outcome'];
  reason?: string;
  durationMs?: number;
  guards?: { names: string[]; passed?: boolean; ms?: number };
  resolvers?: { names: string[]; ms?: number };
  lazyLoaded?: string[];
}

export function toSsrNavigation(nav: NavigationRecord): SsrNavigation {
  return {
    url: nav.url,
    ...(nav.finalUrl && nav.finalUrl !== nav.url ? { finalUrl: nav.finalUrl } : {}),
    outcome: nav.outcome,
    ...(nav.reason ? { reason: nav.reason } : {}),
    ...(nav.endedAt !== undefined ? { durationMs: Math.round(nav.endedAt - nav.startedAt) } : {}),
    ...(nav.guards ? { guards: nav.guards } : {}),
    ...(nav.resolvers ? { resolvers: nav.resolvers } : {}),
    ...(nav.lazyLoaded?.length ? { lazyLoaded: nav.lazyLoaded } : {}),
  };
}

/**
 * Records the router's navigations during one server render on the traced
 * request, through the dev-mode `ng.ɵgetRouterInstance` util, so this package
 * does not import `@angular/router`. Returns the cleanup.
 */
export function watchSsrNavigations(requestId: string, injector: unknown): () => void {
  const active = ssrRegistry().active.get(requestId);
  const ng = (globalThis as { ng?: RouterDebugApi }).ng;
  const router = read(() => ng?.ɵgetRouterInstance?.(injector) as AnyRecord | null, null);
  const events = router ? eventsOf(router) : null;
  if (!active || !router || !events) return () => {};
  const navigations: NavigationRecord[] = [];
  const subscription = read(
    () =>
      events['subscribe']((event: AnyRecord) => {
        if (!applyRouterEvent(navigations, event, Date.now(), router)) return;
        navigations.splice(0, navigations.length - MAX_NAVIGATIONS);
        active.navigations = navigations.map(toSsrNavigation);
      }) as { unsubscribe(): void } | undefined,
    undefined,
  );
  return () => subscription?.unsubscribe();
}
