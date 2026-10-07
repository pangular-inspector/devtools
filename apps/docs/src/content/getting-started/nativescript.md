---
title: NativeScript
description: Send live components, signals, injectors and NgRx stores from a NativeScript Angular app on a simulator or device to the devtools on your machine.
---

<ngmd-hero title="NativeScript" logo="https://cdn.simpleicons.org/nativescript/3C5AFD" gradient>
  Inspect a NativeScript Angular app running on a simulator, an emulator or a phone. The app reports to a devtools server on your machine over a WebSocket.
</ngmd-hero>

# NativeScript

A NativeScript Angular app renders into `@nativescript/core` views, so it has no DOM for the [browser overlay](./overlay.md) to walk. The `@pangular-inspector/devtools/overlay-nativescript` entry point walks the NativeScript view tree instead and sends live data to a devtools server that runs on your machine.

This page describes what the overlay shows and how it works. To add it to an app, follow [Set up NativeScript](../guides/nativescript.md).

## What it shows

| Tab        | On NativeScript                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Components | The component tree, paths and the detail panel. Pointing at a component in the panel outlines it on the device.                                 |
| Signals    | The signal graph of the selected component, with its write history.                                                                             |
| Injectors  | Element injectors and environment injectors with their providers.                                                                               |
| NgRx       | Live `@ngrx/signals` and `@ngrx/store` state and the change log. The store list names the app `NativeScript (iOS)` or `NativeScript (Android)`. |

The source scans (routes, pipes, NgRx declarations) come from the server, so they work as with the [Standalone CLI](./cli.md). The Pipes, Router, Forms, SSR & HTTP and change detection tabs show no live data for a NativeScript app, and there is no in-app popup.

### Controls without an effect

The panel treats a NativeScript app like a browser page and hides none of its controls. Two of them have nothing to work with:

| Control                    | Why it does nothing                                               |
| -------------------------- | ----------------------------------------------------------------- |
| **Pick component on page** | The NativeScript overlay does not listen for a pick.              |
| **Change detection** block | The NativeScript overlay does not record change detection cycles. |

Hovering a row still outlines the component on the device.

## Where it shows in the panel

The live data shows in the same tabs as a browser page.

| Server                             | Where the app shows                                     |
| ---------------------------------- | ------------------------------------------------------- |
| [Standalone CLI](./cli.md)         | The panel at `http://localhost:9999/`, without `?view`. |
| A hub (Express or the Vite plugin) | The **Angular** dock in the side rail.                  |

The **NativeScript** dock (`?view=nativescript`) shows no live data. It is a setup card, **Inspect NativeScript apps**, with the setup steps and a link to the [setup guide](../guides/nativescript.md).

The overlay sends no platform marker, so `list-pages` lists a NativeScript app with the `browser` platform. See [Agent tools](../agents/tools.md#list-pages).

## Requirements

- A development build. Angular publishes its debug API on `globalThis.ng` only when `ngDevMode` is on. Start the overlay inside an `if (__DEV__)` check.
- `@nativescript/core`, an optional peer dependency of the package. The overlay reads the root view and the platform from it.
- A `WebSocket` global. The NativeScript runtime has none, so import `@valor/nativescript-websockets` first in `src/polyfills.ts`. Without it, the overlay logs a warning that names the package and does not start.
- `initNativeScriptOverlay()` called before `runNativeScriptAngularApp()`, so the injector inspector gets its provider lists. See [How it works](#how-it-works).
- A server started with `--no-auth`, since the app cannot enter the one-time code the panel asks for.

## Set up

[Set up NativeScript](../guides/nativescript.md) walks through it: install the packages, add the WebSocket global, start the overlay and run the server. It also covers where the overlay connects from a simulator, an emulator or a device, and how to run the demo in `examples/nativescript`.

## Options

`initNativeScriptOverlay()` takes an optional object:

| Option       | Default                    | What it does                                                                  |
| ------------ | -------------------------- | ----------------------------------------------------------------------------- |
| `baseURL`    | `defaultDevtoolsBaseURL()` | Absolute URL of the devtools server.                                          |
| `intervalMs` | `3000`                     | How often the app reports, in milliseconds.                                   |
| `retryMs`    | `5000`                     | How long to wait before connecting again after a failure or a dropped socket. |

`defaultDevtoolsBaseURL(port = 9999)` is exported from the same entry point and picks the address by platform:

| Platform | Default `baseURL`        |
| -------- | ------------------------ |
| iOS      | `http://localhost:9999/` |
| Android  | `http://10.0.2.2:9999/`  |

`10.0.2.2` is how the Android emulator reaches its host. A physical device needs your machine's LAN address as `baseURL`.

`initNativeScriptOverlay()` returns a function that stops the overlay and tells the server to forget the app's component, injector and NgRx reports.

## How it works

- **Host tree**: the overlay walks the `@nativescript/core` views under the app's root view with the same collectors as the browser overlay. It starts at the host of the root component, found through *Angular's debug API, and looks the root up again on every walk, since NativeScript replaces the root view on some navigations. A host is named by its component's selector.
- **Injector profiler**: *Angular wires the profiler that backs the provider lists only when a `window` global exists as the platform is created. The overlay defines `window` until *Angular publishes `ng.getComponent`, then removes it. If `window` or `ng` already exist, it leaves them alone.
- **Web shims**: the devframe client reads `location` and `navigator`. The overlay defines them from `baseURL` when the runtime has none, and leaves them in place.
- **Transport**: the overlay connects over a WebSocket only, since the NativeScript `fetch` has no streaming body.
- **Reporting**: the app collects every `intervalMs` and sends a report when it changed, or on every fourth tick as a keepalive. When the connection fails or drops, it logs one warning and tries again every `retryMs`. Each new connection reports under a new page id.
- **Highlight**: when the panel or the `highlight` agent tool points at a component, the overlay sets a 2 px `#68b6ff` border on the first view under the host that draws something, and restores the previous border after two seconds.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="The live tabs stay empty" open>
    Check the app log for a <code>[pangular]</code> line. A warning about a missing <code>WebSocket</code> global means <code>&#64;valor/nativescript-websockets</code> is not imported first in <code>src/polyfills.ts</code>. A warning about reaching the server means the address is wrong for where the app runs; see <a href="../guides/nativescript.md#where-the-overlay-connects">where the overlay connects</a>. A release build has no <code>ng</code> global, so nothing is collected there.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The Providers list of an injector is empty">
    The overlay has to start before <code>runNativeScriptAngularApp()</code> creates the platform. Call <code>initNativeScriptOverlay()</code> above it in <code>src/main.ts</code>.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The NativeScript dock shows no data">
    The dock is a setup card. The app's data shows in the <strong>Angular</strong> dock, or in the panel without <code>?view</code> on the standalone CLI.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/guides/nativescript" title="Set up NativeScript"></ngmd-pill>
  <ngmd-pill href="/getting-started/cli" title="Standalone CLI"></ngmd-pill>
  <ngmd-pill href="/inspectors/components" title="Components"></ngmd-pill>
  <ngmd-pill href="/security" title="Access and redaction"></ngmd-pill>
</ngmd-pill-row>
