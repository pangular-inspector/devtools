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
      return import('@pangular-inspector/devtools/overlay');
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
  if (import.meta.env.DEV) void import('@pangular-inspector/devtools/overlay');
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

1. `/__pangular/`
2. `/__devframes/pangular/`

It also adds the [floating button](./popup-and-hub.md). With the hub mounted, the button opens the whole hub, with every dock in a side rail.

### Snapshots and events

On Angular 20 and later, the overlay reads the page about 250 ms after Angular runs change detection. It also reads it every 4 seconds as a heartbeat. Until the app bootstraps, it reads the page every 3 seconds instead. Change that interval with [`limits.refreshMs`](./configuration.md#limits).

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
    const {initOverlay} = await import('@pangular-inspector/devtools/overlay');
    const dispose = await initOverlay({baseURL: '/__my-devtools/'});
  }
});
```

`baseURL` takes one path or a list of paths to try in order. `initOverlay` resolves to a function that stops the overlay it started and removes its hooks.

The floating button follows the path the overlay connected to. If that path is `<base>pangular/` and a hub answers at `<base>`, the button opens the hub. Otherwise it opens the devtools panel at that path.

### One overlay per page

Only one overlay runs on a page. Importing `@pangular-inspector/devtools/overlay` already starts one on the default URLs. When you call `initOverlay`, it stops the running overlay first, the auto-started one included, and then starts yours. The page never ends up with two connections.

An overlay that was stopped or replaced before it connected does not report its connection error.

### Start it yourself

`@pangular-inspector/devtools/overlay-manual` exports the same functions as `@pangular-inspector/devtools/overlay`, but starts nothing on import. Nothing connects and no floating button appears until you call `initOverlay`, and `initOverlay` never adds the button:

```ts
// src/main.ts
import {bootstrapApplication} from '@angular/platform-browser';
import {App} from './app/app';
import {appConfig} from './app/app.config';

bootstrapApplication(App, appConfig).then(async () => {
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    const {initOverlay} = await import('@pangular-inspector/devtools/overlay-manual');
    await initOverlay({baseURL: '/__my-devtools/'});
  }
});
```

Use it when the default URLs can never answer, so the first connection attempt only logs an error, or when the page has no room for the button. Import one of the two entries, not both.

### Pass the connection info

Before it connects, `initOverlay` fetches `__connection.json` from `baseURL` to learn the server's transport. The devtools servers send that file without CORS headers, so a page on another origin cannot read it. Pass its content as `connectionMeta` and the overlay skips the fetch:

```ts
// src/main.ts
const {initOverlay} = await import('@pangular-inspector/devtools/overlay-manual');
await initOverlay({
  baseURL: 'http://192.168.1.20:4000/__devframes/pangular/',
  connectionMeta: {backend: 'sse', sse: {path: '/__devframes/__sse'}},
});
```

| Field       | What it is                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------- |
| `backend`   | The transport: `'sse'` or `'websocket'`. Copy it from the server's `__connection.json`.        |
| `sse`       | The SSE endpoint. A path that starts with `/` resolves against the origin of `baseURL`.        |
| `websocket` | The WebSocket endpoint. A relative path, such as `'__ws'`, resolves against `baseURL`.         |
| `configs`   | The server's devtools config. Without it, the overlay uses the [defaults](./configuration.md). |

With `connectionMeta`, the overlay resolves paths against one `baseURL`, so pass a single URL. `initOverlay` rejects a list, or no `baseURL`, with an error that says so.

Without `configs`, the page runs every inspector with the default limits and redaction, and the server's `redaction.secretNames` are not applied on the page. The overlay logs a warning once. To use the server's config, pass the whole `__connection.json` of the server as `connectionMeta`.

The endpoints must still accept the page's origin. [Set up Capacitor](../guides/capacitor.md) uses this for an app in a mobile WebView.

### Skip the one-time code

If the server has [pairing tokens](../security.md#pairing-tokens), pass one as `authToken` and the page is trusted without the code:

Commit a stub that holds no token, so every clone builds:

```ts
// src/devtools-token.ts (committed)
export const devtoolsToken: string | undefined = undefined;
```

Keep the real token in a second file that git ignores, and swap it in with a build configuration of your own:

```ts
// src/devtools-token.local.ts (listed in .gitignore)
export const devtoolsToken: string | undefined = 'the value of PANGULAR_AUTH_TOKEN on your machine';
```

```json
// angular.json (excerpt, under projects.my-app.architect.build.configurations)
{
  "device": {
    "fileReplacements": [
      {"replace": "src/devtools-token.ts", "with": "src/devtools-token.local.ts"}
    ]
  }
}
```

```ts
// src/main.ts (excerpt, inside the ngDevMode check)
const {devtoolsToken} = await import('./devtools-token');
await initOverlay({
  baseURL: 'http://192.168.1.20:9999/',
  connectionMeta: {backend: 'websocket', websocket: {path: '__ws'}},
  authToken: devtoolsToken,
});
```

Build with `ng build --configuration development,device`. Without the `device` configuration, as in a clone that has no local file, the stub leaves `authToken` out and the page asks for the code.

The token is a development secret. Keep the local file out of git. The page keeps the token in its `localStorage`, and sends it in the query string of its connection URL. When the connection fails, the browser console prints that whole URL, token included, so don't share console output or device logs from a failed connection. Rotate the token if you did. See [Pairing tokens](../security.md#pairing-tokens).

When the server refuses the token, the overlay logs a warning in the console and asks for the code instead. With `connectionMeta`, it also logs a warning once when it can't reach the server.

## Stop the overlay

Call `disposeOverlay` to turn the overlay off:

```ts
// src/app/devtools-toggle.ts
import {disposeOverlay} from '@pangular-inspector/devtools/overlay';

export async function stopDevtools() {
  await disposeOverlay();
}
```

`disposeOverlay` stops whichever overlay is running, including the one that importing `@pangular-inspector/devtools/overlay` started. It closes the connection, clears its timers, listeners and observers, and removes the floating button.

To send data again, call `initOverlay`. It does not add the floating button back.

## NgRx signal stores

The overlay also exports `registerNgrxSignals`. Call it once with `patchState` and `watchState`. Restoring a store's state then notifies `watchState` listeners, and the change log gets one entry per `patchState` call:

```ts {8-13}
// src/main.ts
import {bootstrapApplication} from '@angular/platform-browser';
import {App} from './app/app';
import {appConfig} from './app/app.config';

bootstrapApplication(App, appConfig).then(() => {
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    return Promise.all([
      import('@pangular-inspector/devtools/overlay'),
      import('@ngrx/signals'),
    ]).then(([devtools, {patchState, watchState}]) =>
      devtools.registerNgrxSignals({patchState, watchState}),
    );
  }
  return undefined;
});
```

See [Restore NgRx signal state](../guides/ngrx-signals-restore.md).

## No devtools server found

If no path answers, the overlay logs an error that starts with `[pangular] No devtools server found` and lists the paths it tried. Without a `baseURL`, it tries next to the page, then `/__pangular/`, `/__devframes/pangular/` and `/__devframe/`. The floating button still appears, and its panel says **No devtools server found** with a **Try again** button and a link to the setup guide.

Common causes:

- No server part is mounted, for example plain `ng serve` without `initPangularHub()` in `server.ts`.
- The hub is mounted after `express.static` or the SSR handler, so the app answers first.
- The hub runs on a custom `base`, and the overlay still uses the default paths. Pass the path to [`initOverlay`](#a-custom-mount-path).

The overlay and the button do not start inside the devtools panel frame, so a misconfigured panel never shows a second button.

## Highlighting

When you hover or focus a row in the devtools, the overlay draws an amber box around its element in the page. The box follows the element and stays until the pointer or focus leaves the row. The box also clears when the panel closes, reloads or loses its connection to the dev server. If that clear never reaches the page, the box clears after 60 seconds. A box drawn by the [`highlight` agent tool](../agents/tools.md) clears after 2 seconds.

While you pick an element on the page, the box follows the pointer and clears when the pointer leaves the page or picking ends.

- The box also works for SVG hosts, like `g[app-bar]` in a chart.
- A host with `display: contents` has no box of its own, so the box goes around its children.
- A hidden host (`display: none`, an inactive tab panel) gets no box.
- The box is shown in the browser top layer, so it stays visible over an open `<dialog>`, a popover or a CDK overlay.
- The `highlight` agent tool and a click on a component chip in the Pipes tab also scroll the element into view.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Do I need to call createDevtoolsPopup too?" open>
    No. The overlay adds the floating button itself. See <a href="./popup-and-hub.md">Popup and hub</a>.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Does it slow down my app?">
    It reads the page after change detection, at most once every 250 ms, plus a heartbeat every 4 seconds. It sends an inspector's data only when it changed. The HTTP inspector sends only the calls made since its last report. When the data of the components, signals, injectors, router or HTTP inspector stays the same for 5 to 8 seconds, the page sends a short ping instead, so the server keeps the page. With the dynamic import above, it never loads in production builds.
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
