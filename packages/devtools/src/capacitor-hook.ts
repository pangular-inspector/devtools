// The `@pangular-inspector/devtools/capacitor-hook` entry. Importing it starts
// logging Capacitor plugin calls at once, in development builds, so calls the
// app makes at startup (SplashScreen, StatusBar) are in the log when the
// overlay connects later. Loaded before @capacitor/core, it also logs the calls
// a plugin's web implementation answers.
import { capacitorHook, type CapacitorHookOptions } from './capacitor-collector.ts';

declare const ngDevMode: unknown;

/** Starts logging plugin calls now. Safe to call more than once. */
export function installCapacitorHook(options: Pick<CapacitorHookOptions, 'maxCalls'> = {}): void {
  try {
    capacitorHook(globalThis as Parameters<typeof capacitorHook>[0], { ...options, early: true });
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
  installCapacitorHook();
}
