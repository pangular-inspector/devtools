// The `@pangular-inspector/devtools/startup-hook` entry. Load it before
// Angular, from the polyfills of the development build, so the Injectors tab
// can show how long each provider took to construct at startup and when the
// app was first stable (`startup-recorder.ts`). Without it the overlay still
// shows what the browser and Angular keep after the fact.
import { installStartupRecorder } from './startup-recorder.ts';

declare const ngDevMode: unknown;

/** Starts recording now. Safe to call more than once. */
export function installStartupHook(): void {
  try {
    installStartupRecorder();
  } catch {
    return;
  }
}

// Production builds set ngDevMode to false; tests import the module to test it.
if (
  typeof window !== 'undefined' &&
  typeof performance !== 'undefined' &&
  (typeof ngDevMode === 'undefined' || !!ngDevMode) &&
  !(typeof process !== 'undefined' && process.env?.['VITEST'])
) {
  installStartupHook();
}
