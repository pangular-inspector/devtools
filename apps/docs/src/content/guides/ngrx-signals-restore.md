---
title: Restore NgRx signal state
description: Register patchState so that restoring a signal store also notifies watchState listeners.
---

<ngmd-hero title="Restore NgRx signal state" logo="https://cdn.simpleicons.org/ngrx/BA2BD2" gradient>
  Put a signal store back to any state in its change log. Register patchState once, and your watchState listeners run too.
</ngmd-hero>

# Restore NgRx signal state

The [NgRx Store tab](../inspectors/ngrx-store.md) can put a signal store back to its state after any change in the log. By default it writes the state signals directly. That updates your components, but `watchState` listeners do not run.

Register `patchState` once, and restore goes through it instead. Then `watchState` listeners run as they would for any other change.

## Why it matters

A `watchState` listener runs on every state change made through `patchState`. Stores often use one to save state or sync it somewhere else:

```ts {9-11}
// travel.store.ts
import {signalStore, watchState, withHooks, withState} from '@ngrx/signals';

export const TravelStore = signalStore(
  {providedIn: 'root'},
  withState({query: '', saved: [] as string[]}),
  withHooks({
    onInit(store) {
      watchState(store, (state) => {
        localStorage.setItem('travel', JSON.stringify(state));
      });
    },
  }),
);
```

Without `registerNgrxSignals`, a restore changes the store but skips this listener. With it, the listener runs.

## Register patchState and watchState

Call `registerNgrxSignals({ patchState, watchState })` from `@pangular-inspector/devtools/overlay` once, after the app starts. Load both modules with dynamic imports in development only, so production bundles do not include the devtools.

```ts group="register" name="Angular CLI" active
// src/main.ts
import {bootstrapApplication} from '@angular/platform-browser';
import {appConfig} from './app/app.config';
import {App} from './app/app';

bootstrapApplication(App, appConfig)
  .then((ref) => {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      return ref
        .whenStable()
        .then(() =>
          Promise.all([import('@pangular-inspector/devtools/overlay'), import('@ngrx/signals')]),
        )
        .then(([devtools, {patchState, watchState}]) =>
          devtools.registerNgrxSignals({patchState, watchState}),
        );
    }
    return undefined;
  })
  .catch((err) => console.error(err));
```

```ts group="register" name="Vite and Analog"
// src/main.ts
import {bootstrapApplication} from '@angular/platform-browser';
import {App} from './app/app';
import {appConfig} from './app/app.config';

bootstrapApplication(App, appConfig).then(async () => {
  if (import.meta.env.DEV) {
    const [devtools, {patchState, watchState}] = await Promise.all([
      import('@pangular-inspector/devtools/overlay'),
      import('@ngrx/signals'),
    ]);
    devtools.registerNgrxSignals({patchState, watchState});
  }
});
```

The Angular CLI version is the demo app's `src/main.ts`. It loads the overlay and registers both functions in the same step.

Registering `watchState` gives you one log entry per `patchState` call, including several calls in the same tick. Without it, the overlay batches writes per microtask into one entry.

## Restore a state

<ngmd-workflow>
  <ngmd-step title="Open the Store tab">
    With the hub, it is the <strong>NgRx</strong> dock.
  </ngmd-step>
  <ngmd-step title="Pick a change">
    Select a store, then open an entry in its change log.
  </ngmd-step>
  <ngmd-step title="Restore it">
    Click <strong>Restore this state</strong>, then <strong>Restore</strong>.
  </ngmd-step>
</ngmd-workflow>

### What happens

Every state key of the store goes back to its value right after that change. Components that read the store update at once. The log gets a **Restore** entry.

<ngmd-callout type="info" title="Without registerNgrxSignals">
  Restore still works. Without <code>patchState</code> registered, the log entry says that <code>watchState</code> listeners were not notified.
</ngmd-callout>

## Limits

### Signal stores

- Restore needs every state key to be writable. It can't restore a read-only store state.
- The log keeps the last 200 entries per page. You can't restore older changes.

### @ngrx/store

For `@ngrx/store`, restore uses Store DevTools instead. Add `provideStoreDevtools()` to enable it.

```ts {6}
// src/app/app.config.ts
import {ApplicationConfig} from '@angular/core';
import {provideStoreDevtools} from '@ngrx/store-devtools';

export const appConfig: ApplicationConfig = {
  providers: [provideStoreDevtools()],
};
```

<ngmd-alert severity="warning">
  Without <code>provideStoreDevtools()</code>, action log entries cannot be restored.
</ngmd-alert>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/inspectors/ngrx-store" title="NgRx Store inspector"></ngmd-pill>
  <ngmd-pill href="/getting-started/overlay" title="Browser overlay"></ngmd-pill>
  <ngmd-pill href="/agents/tools" title="NgRx agent tools"></ngmd-pill>
</ngmd-pill-row>
