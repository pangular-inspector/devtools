// Stands in for `@angular/core/primitives/signals` on Angular before 17.0,
// which has no such entry: the Vite plugin points the overlay's import here,
// and the signal write hook (signal-history.ts) then falls back to samples.
export const setPostSignalSetFn = undefined;
