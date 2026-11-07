// How an Analog server call is tied to the tab that caused it. Shared by the
// app's HttpClient interceptor (browser and server), the Analog collector and
// the dev server's call log, so it imports nothing from Node.

/** Request header with the page id of the tab that sent a same-origin request (dev builds only). */
export const ANALOG_PAGE_HEADER = 'x-pangular-page';

/** Request header with the render id of the server render that sent an `/_analog` request. */
export const ANALOG_RENDER_HEADER = 'x-pangular-render';

/** Server-Timing metric whose description is the id the Vite plugin gave a page render. */
export const ANALOG_RENDER_TIMING = 'pangular-analog';

const TAG_ID = /^[\w-]{1,49}$/;
const RENDER_ID = /^[a-z0-9]{1,40}$/;

/** A page id as the overlay mints it, short enough for the server's 50-character limit. */
export function isPageTag(value: unknown): value is string {
  return typeof value === 'string' && TAG_ID.test(value);
}

export function isRenderId(value: unknown): value is string {
  return typeof value === 'string' && RENDER_ID.test(value);
}

/** A fresh render id for a page request. */
export function newRenderId(): string {
  try {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return uuid.replace(/-/g, '').slice(0, 20);
  } catch {
    // no Web Crypto: fall back below.
  }
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).slice(0, 20);
}

/** The render id the dev server sent with this document in Server-Timing, if any. */
export function readRenderId(): string | undefined {
  try {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const entry = nav?.serverTiming?.find((t) => t.name === ANALOG_RENDER_TIMING);
    return isRenderId(entry?.description) ? entry.description : undefined;
  } catch {
    return undefined;
  }
}

/** Whether `url` goes to the page's own origin, so a custom header adds no CORS preflight. */
export function sameOrigin(url: string, base: { href: string; origin: string }): boolean {
  try {
    return new URL(url, base.href).origin === base.origin;
  } catch {
    return false;
  }
}

/** Whether a server render's request is one the Analog call log tags: a load(), action or server function. */
export function isAnalogEndpoint(url: string): boolean {
  return url.includes('/_analog/');
}
