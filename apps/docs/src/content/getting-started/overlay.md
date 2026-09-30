---
title: Browser overlay
description: The script that runs in your page and sends live data to the devtools.
---

<ngmd-hero title="Browser overlay" gradient>
  The script that runs inside your page. It reads Angular's debug API and sends live data to the devtools server.
</ngmd-hero>

# Browser overlay

The overlay runs inside your *Angular page. It reads Angular's debug API and sends live data to the devtools server. Importing the module starts it, so in most apps one dynamic import in `main.ts` is all you need.

## Load it in development

### Pick your build tool

Load the overlay after bootstrap, with a dynamic import that only runs in development:

```ts group="overlay" name="Angular CLI" image="https://cdn.simpleicons.org/angular/DD0031" active
// src/main.ts
import {bootstrapApplication} from '@angular/platform-browser';
import {App} from './app/app';
import {appConfig} from './app/app.config';

bootstrapApplication(App, appConfig)
  .then(() => {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      return import('@santoshyadavdev/ng-devtools/overlay');
    }
    return undefined;
  })
  .catch((err) => console.error(err));
```

```ts group="overlay" name="Analog (Vite)" image="https://cdn.simpleicons.org/vite/646CFF"
// src/main.ts
import {bootstrapApplication} from '@angular/platform-browser';
import {App} from './app/app';
import {appConfig} from './app/app.config';

bootstrapApplication(App, appConfig).then(() => {
  if (import.meta.env.DEV) void import('@santoshyadavdev/ng-devtools/overlay');
});
```

### Why development only

The overlay reads `window.ng`, Angular's debug API. Production builds remove it, so the overlay has nothing to read there. The dynamic import keeps the overlay out of your production bundle.

## What it sends

<ngmd-card-grid columns="3">
  <ngmd-card icon="layers" title="Component tree">
    Components, inputs, outputs and injected services.
  </ngmd-card>
  <ngmd-card icon="zap" title="Signal graph">
    Signal, computed, linkedSignal and effect nodes.
  </ngmd-card>
  <ngmd-card icon="box" title="Injector tree">
    Element and environment injectors with their providers.
  </ngmd-card>
  <ngmd-card icon="settings" title="NgRx stores">
    Signal stores and the global store.
  </ngmd-card>
  <ngmd-card icon="file" title="Forms and pipes">
    Every form on the page, and pipe instances.
  </ngmd-card>
  <ngmd-card icon="compass" title="Router, HTTP and Analog">
    Navigations, HTTP calls and Analog page data.
  </ngmd-card>
</ngmd-card-grid>

## How it connects

### Where it looks

The overlay looks for the devframe connection next to the page first. Then it tries these paths in order:

1. `/__ng-devtools/`
2. `/__devframes/ng-devtools/`

It also adds the [floating button](./popup-and-hub.md). With the hub mounted, the button opens the whole hub, with every dock in a side rail.

### Snapshots and events

On Angular 20 and later, the overlay reads the page about 250 ms after Angular runs change detection. It also reads it every 4 seconds as a heartbeat. On older versions, it reads the page every 3 seconds instead. Change that interval with [`limits.refreshMs`](./configuration.md#limits).

Each read skips data that did not change. Router events are sent as they happen.

### One id per tab

Each browser tab gets its own page id, kept in `sessionStorage`. The devtools use it to tell tabs apart. When a tab closes, its data is dropped.

## A custom mount path

### Call `initOverlay`

If you mount the devtools somewhere else, call `initOverlay` with that path:

```ts
// src/main.ts
import {bootstrapApplication} from '@angular/platform-browser';
import {App} from './app/app';
import {appConfig} from './app/app.config';

bootstrapApplication(App, appConfig).then(async () => {
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    const {initOverlay} = await import('@santoshyadavdev/ng-devtools/overlay');
    const dispose = await initOverlay({baseURL: '/__my-devtools/'});
  }
});
```

`baseURL` takes one path or a list of paths to try in order. `initOverlay` resolves to a function that stops the overlay it started and removes its hooks.

### One overlay per page

Only one overlay runs on a page. Importing the module already starts one on the default URLs. When you call `initOverlay`, it stops the running overlay first, the auto-started one included, and then starts yours. The page never ends up with two connections.

## Stop the overlay

Call `disposeOverlay` to turn the overlay off:

```ts
// src/app/devtools-toggle.ts
import {disposeOverlay} from '@santoshyadavdev/ng-devtools/overlay';

export async function stopDevtools() {
  await disposeOverlay();
}
```

`disposeOverlay` stops whichever overlay is running, including the one that importing the module started. It closes the connection, clears its timers, listeners and observers, and removes the floating button.

To send data again, call `initOverlay`. It does not add the floating button back.

## NgRx signal stores

The overlay also exports `registerNgrxSignals`. Call it once with `patchState` so that restoring a store's state also notifies `watchState` listeners:

```ts {8-11}
// src/main.ts
import {bootstrapApplication} from '@angular/platform-browser';
import {App} from './app/app';
import {appConfig} from './app/app.config';

bootstrapApplication(App, appConfig).then(() => {
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    return Promise.all([
      import('@santoshyadavdev/ng-devtools/overlay'),
      import('@ngrx/signals'),
    ]).then(([devtools, {patchState}]) => devtools.registerNgrxSignals({patchState}));
  }
  return undefined;
});
```

See [Restore NgRx signal state](../guides/ngrx-signals-restore.md).

## Highlighting

When you hover a component in the devtools, the overlay draws an amber box around its element in the page. The box follows the element and clears after 2 seconds.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Do I need to call createDevtoolsPopup too?" open>
    No. The overlay adds the floating button itself. See <a href="./popup-and-hub.md">Popup and hub</a>.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Does it slow down my app?">
    It reads the page after change detection, at most once every 250 ms, plus a heartbeat every 4 seconds. It only sends data that changed. With the dynamic import above, it never loads in production builds.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Which values leave the page?">
    Live values are sent to the devtools server. Secret-looking values are redacted first. See <a href="../security.md">Access and redaction</a>.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/popup-and-hub" title="Popup and hub"></ngmd-pill>
  <ngmd-pill href="/getting-started/express" title="Angular CLI and Express"></ngmd-pill>
  <ngmd-pill href="/getting-started/vite" title="Vite and Analog"></ngmd-pill>
  <ngmd-pill href="/guides/ngrx-signals-restore" title="Restore NgRx signal state"></ngmd-pill>
</ngmd-pill-row>
