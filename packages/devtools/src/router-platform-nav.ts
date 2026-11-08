import { outsideAngular, setTimeoutOutside } from './outside-angular.ts';
import {
  clip,
  read,
  redactMessage,
  redactUrl,
  type AnyRecord,
  type NavigationRecord,
} from './router.ts';
import type { PlatformNavigation } from './router-types.ts';
export type { PlatformNavigation } from './router-types.ts';

/** Most Navigation API events a page keeps. */
export const MAX_PLATFORM_NAVIGATIONS = 30;
/** How long after the event a router navigation may start and still count as its own. */
const LINK_MS = 100;

/** The page's Navigation API object, or null where the browser has none. */
export function navigationApi(): AnyRecord | null {
  const api = read(
    () => (globalThis as AnyRecord)['navigation'] as AnyRecord | undefined,
    undefined,
  );
  return api && typeof api['addEventListener'] === 'function' ? api : null;
}

function pathOf(url: string): string {
  const origin = read(() => location.origin, '');
  return origin && url.startsWith(origin) ? url.slice(origin.length) || '/' : url;
}

function pending(navigations: NavigationRecord[]): NavigationRecord | undefined {
  for (let i = navigations.length - 1; i >= 0; i--) {
    if (navigations[i].outcome === 'pending') return navigations[i];
  }
  return undefined;
}

function link(entry: PlatformNavigation, nav: NavigationRecord) {
  entry.navigationId = nav.id;
  nav.platform = {
    type: entry.type,
    ...(entry.userInitiated ? { userInitiated: true } : {}),
  };
}

/**
 * Listens to the Navigation API's `navigate`, `navigatesuccess` and
 * `navigateerror` events and records each navigation in `entries` (at most
 * {@link MAX_PLATFORM_NAVIGATIONS}). An event that comes while a router
 * navigation is pending, or just before one starts, is linked to it, and
 * the router navigation gets `platform`. Listens only; it never intercepts.
 * Returns the function that stops listening.
 */
export function capturePlatformNavigations(
  api: AnyRecord | null,
  navigations: NavigationRecord[],
  entries: PlatformNavigation[],
  onChange: () => void,
): () => void {
  if (!api) return () => {};
  let last: PlatformNavigation | undefined;
  const onNavigate = (event: AnyRecord) => {
    const raw = read(() => String(event['destination']?.['url'] ?? ''), '');
    const entry: PlatformNavigation = {
      at: Date.now(),
      type: clip(
        read(() => String(event['navigationType'] ?? 'push'), 'push'),
        20,
      ),
      url: redactUrl(pathOf(raw)),
    };
    if (read(() => event['userInitiated'] === true, false)) entry.userInitiated = true;
    if (read(() => event['hashChange'] === true, false)) entry.hashChange = true;
    entries.push(entry);
    if (entries.length > MAX_PLATFORM_NAVIGATIONS) {
      entries.splice(0, entries.length - MAX_PLATFORM_NAVIGATIONS);
    }
    last = entry;
    const current = pending(navigations);
    if (current) {
      link(entry, current);
    } else {
      // Back, forward and links the router handles start its navigation after the event.
      setTimeoutOutside(() => {
        if (entry.navigationId !== undefined) return;
        const next = navigations.find(
          (nav) =>
            nav.startedAt >= entry.at && nav.startedAt - entry.at <= LINK_MS && !nav.platform,
        );
        if (next) {
          link(entry, next);
          onChange();
        }
      }, LINK_MS);
    }
    onChange();
  };
  const onSuccess = () => {
    if (!last || last.result) return;
    last.result = 'succeeded';
    onChange();
  };
  const onError = (event: AnyRecord) => {
    if (!last || last.result) return;
    last.result = 'failed';
    const message = read(() => String(event['message'] ?? event['error']?.['message'] ?? ''), '');
    if (message) last.error = redactMessage(message);
    onChange();
  };
  const listeners: [string, (event: AnyRecord) => void][] = [
    ['navigate', onNavigate],
    ['navigatesuccess', onSuccess],
    ['navigateerror', onError],
  ];
  outsideAngular(() => {
    for (const [name, listener] of listeners) {
      read(() => api['addEventListener'](name, listener), undefined);
    }
  });
  return () => {
    for (const [name, listener] of listeners) {
      read(() => api['removeEventListener']?.(name, listener), undefined);
    }
  };
}
