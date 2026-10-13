// The `@pangular-inspector/devtools/store-hook` entry. Importing it puts the
// Redux DevTools stand-in on the page at once, in development builds, so
// stores that look for the Redux DevTools extension when the app starts
// (NGXS, Elf, MiniRx) find it and report to the store inspector once the
// overlay connects. The real extension, when installed, keeps getting every
// call. The overlay removes the stand-in again when the store inspector is off.
import { installReduxDevtoolsHook } from './redux-devtools-hook.ts';

declare const ngDevMode: unknown;

/** Puts the Redux DevTools stand-in on the page now. Safe to call more than once. */
export function installStoreHook(): void {
  try {
    installReduxDevtoolsHook();
  } catch {
    return;
  }
}

// Production builds set ngDevMode to false; tests import the module to test it.
if (
  typeof window !== 'undefined' &&
  (typeof ngDevMode === 'undefined' || !!ngDevMode) &&
  !(typeof process !== 'undefined' && process.env?.['VITEST'])
) {
  installStoreHook();
}
