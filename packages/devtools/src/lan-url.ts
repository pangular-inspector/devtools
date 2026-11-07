// The devtools server's LAN address, injected into an app's development build
// by the Vite plugin's `lanAddress` option or the define `pangular dev
// --lan-address` prints. A phone app (Capacitor, NativeScript) has no
// `localhost` to reach the server on, so it connects there instead.

/** The global constant a build defines with the devtools URL on the LAN. */
export const LAN_URL_DEFINE = '__PANGULAR_LAN_URL__';

declare const __PANGULAR_LAN_URL__: unknown;

/**
 * The devtools server URL on the LAN that the build injected, or `undefined`
 * when it injected none. Bundlers replace the constant at build time; Vite's
 * dev server may define it on `globalThis` instead, so both are read.
 */
export function lanDevtoolsURL(): string | undefined {
  let value: unknown;
  try {
    value = typeof __PANGULAR_LAN_URL__ === 'undefined' ? undefined : __PANGULAR_LAN_URL__;
  } catch {
    value = undefined;
  }
  if (value === undefined) value = (globalThis as Record<string, unknown>)[LAN_URL_DEFINE];
  return typeof value === 'string' && /^https?:\/\//.test(value) ? value : undefined;
}
