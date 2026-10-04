export type PatchState = (store: object, ...updaters: unknown[]) => void;
/**
 * Mirrors `@ngrx/signals`' `watchState` without importing it (the overlay
 * cannot assume `@ngrx/signals` is in the user's deps). `callback` receives
 * the current state; `destroy()` unsubscribes.
 */
export type WatchState = (
  stateSource: object,
  callback: (state: unknown) => void,
  config?: { injector?: unknown; manualCleanup?: boolean },
) => { destroy(): void };

const SIGNALS_KEY = '__PANGULAR_NGRX_SIGNALS__';

interface Registration {
  patchState?: PatchState;
  watchState?: WatchState;
}

/**
 * Lets an app share `@ngrx/signals` functions with the devtools overlay. Both
 * fields are optional and merge with earlier registrations, so calling it
 * twice (once for `patchState` and once for `watchState`) keeps both.
 *
 * - `patchState`: makes a restore from the change log go through `patchState`
 *   so `watchState` listeners run (otherwise restore writes state signals
 *   directly, components still update, but `watchState` is bypassed).
 * - `watchState`: lets the overlay record every state change individually,
 *   including several patchState calls in the same tick, instead of merging
 *   them into one entry per microtask.
 */
export function registerNgrxSignals(api: {
  // `never[]` on inputs lets the caller pass the real `@ngrx/signals` exports
  // (whose stricter `WritableStateSource` input is contravariant with
  // `PatchState`'s plain `object`) without a cast.
  patchState?: (...args: never[]) => unknown;
  watchState?: (...args: never[]) => unknown;
}): void {
  const existing =
    ((globalThis as Record<string, unknown>)[SIGNALS_KEY] as Registration | undefined) ?? {};
  (globalThis as Record<string, unknown>)[SIGNALS_KEY] = {
    patchState: (api.patchState as PatchState | undefined) ?? existing.patchState,
    watchState: (api.watchState as WatchState | undefined) ?? existing.watchState,
  };
}

function registration(): Registration | undefined {
  return (globalThis as Record<string, unknown>)[SIGNALS_KEY] as Registration | undefined;
}

export function registeredPatchState(): PatchState | null {
  const value = registration()?.patchState;
  return typeof value === 'function' ? value : null;
}

export function registeredWatchState(): WatchState | null {
  const value = registration()?.watchState;
  return typeof value === 'function' ? value : null;
}
