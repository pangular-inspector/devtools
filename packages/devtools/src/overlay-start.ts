/**
 * Counts `initOverlay()` calls, so the default `overlay` entry can tell whether
 * the script that imported it started the overlay itself, such as the tag the
 * Vite plugin injects with the hub's `baseURL`.
 */
export const overlayStarts = { count: 0 };
