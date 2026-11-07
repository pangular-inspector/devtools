---
title: NativeScript
description: Add the devtools to a NativeScript Angular app and send live components, signals, injectors, stores, change detection, leaks and errors from a simulator or device to your machine.
---

<ngmd-hero title="NativeScript" logo="https://cdn.simpleicons.org/nativescript/3C5AFD" gradient>
  Inspect a NativeScript Angular app running on a simulator, an emulator or a phone. The app reports to a devtools server on your machine over a WebSocket.
</ngmd-hero>

# NativeScript

A NativeScript Angular app renders into `@nativescript/core` views, so it has no DOM for the [browser overlay](./overlay.md) to walk. The `@pangular-inspector/devtools/overlay-nativescript` entry point walks the NativeScript view tree through *Angular's debug API instead, and sends live data to the [standalone devtools server](./cli.md) on your machine.

This page sets the overlay up, then describes what it shows and how it works.

## Requirements

- A development build. Angular publishes its debug API on `globalThis.ng` only when `ngDevMode` is on. Start the overlay inside an `if (__DEV__)` check.
- `@nativescript/core`, an optional peer dependency of the package. The overlay reads the root view and the platform from it.
- A `WebSocket` global. The NativeScript runtime has none, so import `@valor/nativescript-websockets` first in `src/polyfills.ts`. Without it, the overlay logs a warning that names the package and does not start.
- `initNativeScriptOverlay()` called before `runNativeScriptAngularApp()`, so the injector inspector gets its provider lists. See [How it works](#how-it-works).
- A server started with `--no-auth`, since the app cannot enter the one-time code the panel asks for. Against a server with auth on, the overlay logs a warning that says to start it with `--no-auth`, and tries again every `retryMs`.

## Set up

<ngmd-workflow>
  <ngmd-step title="Install the packages">
    Add <code>&#64;pangular-inspector/devtools</code> and <code>&#64;valor/nativescript-websockets</code>.
  </ngmd-step>
  <ngmd-step title="Add a WebSocket global">
    Import <code>&#64;valor/nativescript-websockets</code> first in <code>src/polyfills.ts</code>.
  </ngmd-step>
  <ngmd-step title="Start the overlay">
    Call <code>initNativeScriptOverlay()</code> in <code>src/main.ts</code>, before the app bootstraps.
  </ngmd-step>
  <ngmd-step title="Run the devtools server">
    Start <code>pangular dev --no-auth</code> in the app's folder and open the panel.
  </ngmd-step>
</ngmd-workflow>

### Install

```bash group="install" name="pnpm" image="https://cdn.simpleicons.org/pnpm/F69220" active
pnpm add @pangular-inspector/devtools @valor/nativescript-websockets
```

```bash group="install" name="npm" image="https://cdn.simpleicons.org/npm/CB3837"
npm install @pangular-inspector/devtools @valor/nativescript-websockets
```

```bash group="install" name="yarn" image="https://cdn.simpleicons.org/yarn/2C8EBB"
yarn add @pangular-inspector/devtools @valor/nativescript-websockets
```

```bash group="install" name="bun" image="https://bun.sh/logo.svg"
bun add @pangular-inspector/devtools @valor/nativescript-websockets
```

### Add a WebSocket global

The overlay talks to the server over a WebSocket, and the NativeScript runtime has no `WebSocket` global. Import the polyfill first:

```ts
// src/polyfills.ts
import '@valor/nativescript-websockets';
```

### Start the overlay

```ts {2,4-6}
// src/main.ts
import {initNativeScriptOverlay} from '@pangular-inspector/devtools/overlay-nativescript';

if (__DEV__) {
  initNativeScriptOverlay();
}
```

Call it before `runNativeScriptAngularApp()`. The injector inspector relies on *Angular's injector profiler, which *Angular only wires while it creates the platform. See [Options](#options) for `baseURL`, `intervalMs` and `retryMs`.

### Where the overlay connects

| Target           | Default URL              |
| ---------------- | ------------------------ |
| iOS simulator    | `http://localhost:9999/` |
| Android emulator | `http://10.0.2.2:9999/`  |
| Physical device  | Pass `{ baseURL }`       |

For a physical device, pass the address of your machine as `baseURL`. Android 9 and later and iOS App Transport Security block plain `http` to a LAN address, so allow it for development builds: set `android:usesCleartextTraffic="true"` in `AndroidManifest.xml`, and add an `NSAppTransportSecurity` exception for the address in `Info.plist`.

### Run the devtools server

Run the server in the app's folder, so the source scanners read its `src/`:

```bash
cd my-nativescript-app
npx @pangular-inspector/devtools dev --no-auth
```

The server listens on `localhost` only, which the iOS simulator and the Android emulator reach. `--no-auth` is needed because the app cannot enter the one-time code the panel asks for.

| What         | Where                         |
| ------------ | ----------------------------- |
| Devtools UI  | `http://localhost:9999/`      |
| MCP endpoint | `http://localhost:9999/__mcp` |

A physical device reaches your machine over the network, so the server has to listen on an interface the device can reach:

```bash
npx @pangular-inspector/devtools dev --host 192.168.1.20 --allowed-origin http://192.168.1.20:9999 --no-auth
```

The server then listens on that address only, not on `localhost`, so open the panel at `http://192.168.1.20:9999/`. `--allowed-origin` lets the panel's own origin through there. Use your machine's address and the server's port.

<ngmd-alert severity="warning" label="Trusted networks only">
  With <code>--host</code> and <code>--no-auth</code>, every host that can reach that address can call the devtools RPC and MCP endpoints without a code. Use it on a trusted network only. Binding to the one address the device uses, as above, keeps the server off your other interfaces, which <code>0.0.0.0</code> would not.
</ngmd-alert>

See [Standalone CLI](./cli.md) for the other server options and [Security](../security.md) for what `--no-auth` turns off.

## What it shows

| Tab        | On NativeScript                                                                                                                                                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Components | The component tree, paths and the detail panel. Pointing at a component in the panel outlines it on the device. **Change detection** records cycles with their causes and OnPush hints, and **Leaks** lists effects and subscriptions, with navigations counted from the app's Router. |
| Signals    | The signal graph of the selected component, with its write history.                                                                                                                                                                                                                    |
| Injectors  | Element injectors and environment injectors with their providers. **Show value** reads a created provider's value, and **Startup** shows the Angular version and when the app was first stable.                                                                                        |
| Store      | Live `@ngrx/signals` and `@ngrx/store` state, the change log, sessions and restore, and NGXS stores. The store list names the app `NativeScript (iOS)` or `NativeScript (Android)`.                                                                                                    |
| Queries    | The TanStack Query clients the app injected, with their queries and mutations.                                                                                                                                                                                                         |
| Pipes      | The pipes in use, with their instances and the components that use them.                                                                                                                                                                                                               |
| Errors     | Errors from Angular's `ErrorHandler` and the `Application` `uncaughtError` and `discardedError` events, the console, and the NG0100 and missing provider explainers.                                                                                                                   |
| Audit      | The findings of change detection, leaks and errors, and before and after sessions. axe has no DOM to check.                                                                                                                                                                            |
| Plugins    | The views of [page plugins](../guides/write-a-plugin.md) the app registers.                                                                                                                                                                                                            |

The source scans (routes, pipes, NgRx declarations) come from the server, so they work as with the [Standalone CLI](./cli.md). There is no in-app popup.

The server's [configuration](./configuration.md) applies to the app: inspectors you turn off there are not collected, and `redaction.secretNames` masks values before they leave the device.

### What needs a browser

These features read or draw the DOM, or run in the browser, so a NativeScript app has none of them. The panel hides the picker and the live views for the app, **Run axe** says the app has no DOM, and the agent tools answer the same instead of asking another tab.

| Feature                                                           | Why it is missing                                                                                                                                                                 |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pick component on page**                                        | Picking listens for a click on a DOM element.                                                                                                                                     |
| **Flash checks**, **Performance track** and **Angular profiling** | They draw over DOM elements or into the browser's Performance panel.                                                                                                              |
| Checks that changed nothing                                       | The recording counts them by watching DOM updates.                                                                                                                                |
| Destroyed and retained instances in **Leaks**                     | A development build keeps every destroyed instance in Angular's DI debug data, so only a detached view would show a leak, and telling one apart asks Angular about a DOM element. |
| Provider construction times in **Startup**                        | They need the startup hook, which loads before *Angular in a browser.                                                                                                             |
| axe, `screenshot-component`, hydration and the console handles    | They read or copy the DOM.                                                                                                                                                        |
| Router, Forms and SSR & HTTP tabs                                 | The NativeScript overlay does not collect them.                                                                                                                                   |

Hovering a row still outlines the component on the device.

## Where it shows in the panel

The live data shows in the same tabs as a browser page.

| Server                             | Where the app shows                                     |
| ---------------------------------- | ------------------------------------------------------- |
| [Standalone CLI](./cli.md)         | The panel at `http://localhost:9999/`, without `?view`. |
| A hub (Express or the Vite plugin) | The **Angular** dock in the side rail.                  |

The **NativeScript** dock (`?view=nativescript`) shows no live data. It is a setup card, **Inspect NativeScript apps**, with the setup steps and a link to this page.

The overlay marks its component reports with `platform: 'nativescript'`, the URL `/` and the title `NativeScript (iOS)` or `NativeScript (Android)`. `list-pages` lists the app with the `NativeScript` platform. See [Agent tools](../agents/tools.md#list-pages).

## Options

`initNativeScriptOverlay()` takes an optional object:

| Option       | Default                         | What it does                                                                  |
| ------------ | ------------------------------- | ----------------------------------------------------------------------------- |
| `baseURL`    | `defaultDevtoolsBaseURL()`      | Absolute URL of the devtools server.                                          |
| `intervalMs` | The server's `limits.refreshMs` | How often the app reports, in milliseconds.                                   |
| `retryMs`    | `5000`                          | How long to wait before connecting again after a failure or a dropped socket. |

`defaultDevtoolsBaseURL(port = 9999)` is exported from the same entry point and picks the address by platform:

| Platform | Default `baseURL`        |
| -------- | ------------------------ |
| iOS      | `http://localhost:9999/` |
| Android  | `http://10.0.2.2:9999/`  |

`10.0.2.2` is how the Android emulator reaches its host. The devtools server answers requests sent to it (and to `10.0.3.2`, Genymotion's address for the host) from the emulator without any option, as it does `localhost`. A physical device needs your machine's LAN address as `baseURL`.

`initNativeScriptOverlay()` returns a function that stops the overlay and tells the server to forget every report the app sent.

## How it works

- **Host tree**: the overlay walks the `@nativescript/core` views under the app's root view with the same collectors as the browser overlay. It starts at the host of the root component, found through *Angular's debug API, and looks the root up again on every walk, since NativeScript replaces the root view on some navigations. A host is named by its component's selector.
- **Injector profiler**: *Angular wires the profiler that backs the provider lists only when a `window` global exists as the platform is created. The overlay defines `window` until *Angular publishes `ng.getComponent`, then removes it. If `window` or `ng` already exist, it leaves them alone.
- **Web shims**: the devframe client reads `location` and `navigator`. The overlay defines them from `baseURL` when the runtime has none, and leaves them in place.
- **Transport**: the overlay connects over a WebSocket only, since the NativeScript `fetch` has no streaming body.
- **Store stand-in**: `initNativeScriptOverlay()` puts the [Redux DevTools stand-in](../inspectors/ngrx-store.md#other-stores) in place before the app starts, so NGXS stores report without the `store-hook` entry. A store library that looks for the extension on `window` finds nothing there, since a NativeScript app has no `window` once it started. When the server turns the `ngrx` inspector off, the overlay removes it again.
- **Angular version**: change detection recording and **Startup** read the version from the `ng-version` value *Angular sets on the root view. When the renderer keeps none, recording stays off and the **Change detection** section says the page has no profiler, as in a browser, since taking Angular's profiler without knowing the version could evict another one for good.
- **Reporting**: the app collects every `intervalMs` and sends a report when it changed. The **Leaks** scan walks the views again when the component tree changed, and at least every 30 seconds. When a report has not changed for a while, the app asks the server whether it still holds it, and sends it again only if not. When the connection fails or drops, it logs one warning and tries again every `retryMs`. The app keeps one page id for as long as the overlay runs, so a reconnect does not show it as a new page.
- **Highlight**: when the panel or the `highlight` agent tool points at a component, the overlay sets a 2 px `#68b6ff` border on the first view under the host that draws something. It restores the previous border when the pointer leaves the row, after the duration the `highlight` tool asks for, or after two seconds.

## Try the demo

`examples/nativescript` is a `ns create --ng` project wired up this way, with a small showcase component (signals, a computed, an effect and a component-level provider). It is tested on the iOS simulator. Android is untested.

The demo maps `@pangular-inspector/devtools/*` to the package's build output in `packages/devtools/dist`, so build the package first:

```bash
pnpm devtools:build-pkg
pnpm devtools:nativescript
cd examples/nativescript && npm install && ns debug ios --no-hmr
```

`pnpm devtools:nativescript` starts the devtools server on `localhost`, scanning `examples/nativescript/src`. For a physical device, `pnpm devtools:nativescript:device` listens on every interface instead, with the same warning as above.

## Troubleshooting

The [troubleshooting page](./troubleshooting.md) lists the problems every setup shares, by symptom.

<ngmd-accordion>
  <ngmd-accordion-item title="The live tabs stay empty" open>
    Check the app log for a <code>[pangular]</code> line. A warning about a missing <code>WebSocket</code> global means <code>&#64;valor/nativescript-websockets</code> is not imported first in <code>src/polyfills.ts</code>. A warning about reaching the server means the address is wrong for where the app runs; see <a href="#where-the-overlay-connects">where the overlay connects</a>. A release build has no <code>ng</code> global, so nothing is collected there.
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
  <ngmd-pill href="/getting-started/cli" title="Standalone CLI"></ngmd-pill>
  <ngmd-pill href="/getting-started/troubleshooting" title="Troubleshooting"></ngmd-pill>
  <ngmd-pill href="/inspectors/components" title="Components"></ngmd-pill>
  <ngmd-pill href="/agents/mcp-server" title="MCP server"></ngmd-pill>
</ngmd-pill-row>
