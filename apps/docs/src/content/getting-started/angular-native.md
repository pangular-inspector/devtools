---
title: Angular Native
description: Add the devtools to an Angular Native app and send live components, signals, injectors, stores, change detection, leaks and errors from a device to your machine.
---

<ngmd-hero title="Angular Native" gradient>
  Inspect an Angular Native app running on a simulator, an emulator or a phone. The app reports to a devtools server on your machine over a WebSocket.
</ngmd-hero>

# Angular Native

[Angular Native](https://ng-native.com) renders *Angular onto React Native's Fabric renderer, so the app has no DOM for the [browser overlay](./overlay.md) to walk. The `@pangular-inspector/devtools/overlay-angular-native` entry point walks Angular Native's own node tree instead, and sends the same live data to the [standalone devtools server](./cli.md) on your machine.

This page sets the overlay up, then describes what it shows and how it works.

## Requirements

- A development build. Angular publishes its debug API on `globalThis.ng` only when `ngDevMode` is on, which is the default in a Metro development build.
- An app started with `mount()` from `@ng-native/platform`. The overlay needs the root node it returns. The demo uses `@ng-native/*` 0.2.0, the version the overlay is written against.
- A `WebSocket` global and a standards-compliant `URL`. React Native provides `WebSocket`. Expo provides `URL`. React Native's own `URL` is read-only, and the client sets the `protocol` of the socket URL, so a bare React Native app needs a polyfill such as `react-native-url-polyfill`.

## Set up

<ngmd-workflow>
  <ngmd-step title="Install the package">
    Add <code>&#64;pangular-inspector/devtools</code>. A bare React Native app also needs a <code>URL</code> polyfill.
  </ngmd-step>
  <ngmd-step title="Start the overlay">
    Call <code>initAngularNativeOverlay()</code> in <code>src/main.ts</code>, after <code>mount()</code>, with the root node it returns.
  </ngmd-step>
  <ngmd-step title="Run the devtools server">
    Start <code>pangular dev --no-auth</code> in the app's folder.
  </ngmd-step>
  <ngmd-step title="Open the panel">
    Open the <strong>Angular Native apps</strong> URL the server prints. The live tabs fill once the app connects.
  </ngmd-step>
</ngmd-workflow>

### Install

```bash group="install" name="pnpm" image="https://cdn.simpleicons.org/pnpm/F69220" active
pnpm add @pangular-inspector/devtools
```

```bash group="install" name="npm" image="https://cdn.simpleicons.org/npm/CB3837"
npm install @pangular-inspector/devtools
```

```bash group="install" name="yarn" image="https://cdn.simpleicons.org/yarn/2C8EBB"
yarn add @pangular-inspector/devtools
```

```bash group="install" name="bun" image="https://bun.sh/logo.svg"
bun add @pangular-inspector/devtools
```

### WebSocket and URL

The overlay needs a `WebSocket` global and a standards-compliant `URL`. React Native provides `WebSocket`, and Expo provides `URL`, so an Expo app needs nothing more.

React Native's own `URL` is read-only, and the client sets the `protocol` of the socket URL. In a bare React Native app, install a polyfill such as `react-native-url-polyfill`:

```bash group="url-polyfill" name="pnpm" image="https://cdn.simpleicons.org/pnpm/F69220" active
pnpm add react-native-url-polyfill
```

```bash group="url-polyfill" name="npm" image="https://cdn.simpleicons.org/npm/CB3837"
npm install react-native-url-polyfill
```

```bash group="url-polyfill" name="yarn" image="https://cdn.simpleicons.org/yarn/2C8EBB"
yarn add react-native-url-polyfill
```

```bash group="url-polyfill" name="bun" image="https://bun.sh/logo.svg"
bun add react-native-url-polyfill
```

Then import it first in `src/main.ts`, above the imports of the next sample:

```ts
// src/main.ts
import 'react-native-url-polyfill/auto';
```

### Start the overlay

Start the overlay after `mount()` from `@ng-native/platform`, and pass the root node of the mounted app:

```ts {5,15}
// src/main.ts
import {AppRegistry, Image, Platform, processColor} from 'react-native';
import {mount} from '@ng-native/platform';
import {getFabricUIManager, registerPlatformComponents} from '@ng-native/fabric';
import {initAngularNativeOverlay} from '@pangular-inspector/devtools/overlay-angular-native';
import {App} from './app/app.ts';

registerPlatformComponents(Platform.OS);

AppRegistry.registerRunnable('main', ({rootTag}) => {
  const app = mount(Number(rootTag), App, getFabricUIManager(), {
    processColor,
    resolveAssetSource: (value) => Image.resolveAssetSource(value as never),
  });
  if (__DEV__) initAngularNativeOverlay({root: app.engine.root});
});
```

The `__DEV__` check keeps the overlay out of release builds, which have no `ng` debug global to read. `initAngularNativeOverlay()` returns a function that stops the overlay and tells the server to forget the app. See [Options](#options) for `baseURL`, `intervalMs` and `retryMs`.

### Where the overlay connects

The overlay connects to `http://localhost:9999/` unless you pass `baseURL`.

| Where the app runs                     | What to do                                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| iOS simulator                          | Nothing. The simulator shares your machine's `localhost`.                                       |
| Android emulator or USB Android device | Run `adb reverse tcp:9999 tcp:9999`, the same forwarding Metro uses for its own port.           |
| Physical device over Wi-Fi             | Pass your machine's LAN address as `baseURL`, such as `{baseURL: 'http://192.168.1.20:9999/'}`. |

A device that reaches the server over plain HTTP may need a cleartext exception for that address in `Info.plist` or the Android network security config.

### Run the devtools server

Run the server in the app's folder, so the source scanners read its `src/`:

```bash
cd my-angular-native-app
npx @pangular-inspector/devtools dev --no-auth
```

The server listens on `localhost` only, which the iOS simulator reaches directly and an Android emulator reaches through `adb reverse`. `--no-auth` is needed because the app cannot enter the one-time code the panel asks for. Without it, the overlay logs a warning in the Metro log that names the flag and keeps retrying.

When it is ready, the server prints the Angular Native view on its own line, next to the NativeScript setup view:

```text
  pangular v<version>
  Panel: http://localhost:9999/
  Angular Native apps: http://localhost:9999/?view=angular-native
  NativeScript setup: http://localhost:9999/?view=nativescript
  MCP:   http://localhost:9999/__mcp
```

A physical device over Wi-Fi reaches your machine over the network, so the server has to listen on an interface the device can reach:

```bash
npx @pangular-inspector/devtools dev --host 192.168.1.20 --allowed-origin http://192.168.1.20:9999 --no-auth
```

The server then listens on that address only, not on `localhost`, so open the panel at `http://192.168.1.20:9999/`. `--allowed-origin` lets the panel's own origin through there. Use your machine's address and the server's port.

<ngmd-alert severity="warning" label="Trusted networks only">
  With <code>--host</code> and <code>--no-auth</code>, every host that can reach that address can call the devtools RPC and MCP endpoints without a code. Use it on a trusted network only. Binding to the one address the device uses, as above, keeps the server off your other interfaces, which <code>0.0.0.0</code> would not.
</ngmd-alert>

See [Standalone CLI](./cli.md) for the other server options and [Security](../security.md) for what `--no-auth` turns off.

### Open the panel

Open `http://localhost:9999/?view=angular-native` on your machine. The **Angular Native** view shows the tabs an app on a device fills: **Components**, **Signals**, **Injectors**, **Store**, **Queries**, **Pipes** and **Errors**. With no app connected, it says **No Angular Native app is connected**.

When the app connects, the Metro log shows `[pangular] Connected to the devtools server at http://localhost:9999/` and the tabs fill. Hover a component in the tree to outline its view on the device.

If the app reports to a hub (Express or the Vite plugin) instead, pick the **Angular Native** dock in the side rail. See [Where it shows in the panel](#where-it-shows-in-the-panel).

## What it shows

| Tab        | On Angular Native                                                                                                                                                                                                                                                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Components | The component tree, paths and the detail panel. Pointing at a component in the panel draws a box over it on the device, and **Pick component on device** selects the component you tap. **Change detection** records cycles with their causes and OnPush hints, and **Leaks** lists effects and subscriptions, with navigations counted from the app's Router. |
| Signals    | The signal graph of the selected component, or of the first component with signals. There is no routed component to pick.                                                                                                                                                                                                                                      |
| Injectors  | Element injectors, including `<ng-container>` anchors, and environment injectors with their providers. **Show value** reads a created provider's value, and **Startup** shows the Angular version and when the app was first stable.                                                                                                                           |
| Store      | Live `@ngrx/signals` and `@ngrx/store` state, the change log, sessions and restore, and NGXS, Elf and MiniRx stores. See [Other stores on a device](#other-stores-on-a-device).                                                                                                                                                                                |
| Queries    | The TanStack Query clients the app injected, with their queries and mutations.                                                                                                                                                                                                                                                                                 |
| Pipes      | The pipes in use, with their instances and the components that use them. Recording pipe calls works as in the browser.                                                                                                                                                                                                                                         |
| Errors     | Errors from Angular's `ErrorHandler` and React Native's global error handler, the console, and the NG0100 and missing provider explainers.                                                                                                                                                                                                                     |
| Audit      | The findings of change detection, leaks and errors, and before and after sessions. axe has no DOM to check.                                                                                                                                                                                                                                                    |
| Plugins    | The views of [page plugins](../guides/write-a-plugin.md) the app registers.                                                                                                                                                                                                                                                                                    |

The source scans (routes, pipes, NgRx declarations) come from the server, so they work as with the [Standalone CLI](./cli.md). There is no in-app popup.

### What needs a browser

These features read or draw the DOM, or run in the browser, so an Angular Native app has none of them. The panel hides the live views for the app, **Run axe** says the app has no DOM, and the agent tools answer the same instead of asking another tab.

| Feature                                                           | Why it is missing                                                                                                                                                                 |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Flash checks**, **Performance track** and **Angular profiling** | They draw over DOM elements or into the browser's Performance panel.                                                                                                              |
| Checks that changed nothing                                       | The recording counts them by watching DOM updates.                                                                                                                                |
| Destroyed and retained instances in **Leaks**                     | A development build keeps every destroyed instance in Angular's DI debug data, so only a detached view would show a leak, and telling one apart asks Angular about a DOM element. |
| Provider construction times in **Startup**                        | They need the startup hook, which loads before *Angular in a browser.                                                                                                             |
| axe, `screenshot-component`, hydration and the console handles    | They read or copy the DOM.                                                                                                                                                        |
| Router, Forms and SSR & HTTP tabs                                 | The Angular Native overlay does not collect them.                                                                                                                                 |

The controls stay for browser pages. Hovering a row still draws a box over the component on the device.

## Where it shows in the panel

The **Angular Native** view shows only the tabs an app on a device fills: **Components**, **Signals**, **Injectors**, **Store**, **Queries**, **Pipes** and **Errors**, scoped to that app. The **Audit** and **Plugins** tabs show the app in the panel without `?view`.

| Server                             | How to open the view                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Standalone CLI](./cli.md)         | Open the **Angular Native apps** URL the CLI prints, `http://localhost:9999/?view=angular-native`. |
| A hub (Express or the Vite plugin) | Pick the **Angular Native** dock in the side rail.                                                 |

The panel without `?view` also shows the app, in the same tabs as a browser page.

The overlay marks its component reports with `platform: 'angular-native'`, and the view follows the newest app that sends them. It keeps the app it shows while that app reports, and the app keeps its page id when it reconnects. With no app connected, the view says **No Angular Native app is connected** and links to this page. In the hub, the dock's tooltip in the rail then reads **Angular Native: no app connected**. The view reads the component reports, so turning off the `components` inspector hides the dock and leaves the view empty.

`list-pages` gives each page's platform, so an agent can tell an Angular Native app from a browser tab. See [Agent tools](../agents/tools.md#list-pages).

## Options

| Option       | Default                         | What it does                                                                   |
| ------------ | ------------------------------- | ------------------------------------------------------------------------------ |
| `root`       | (required)                      | The node `mount()` created (`app.engine.root`), or a function that returns it. |
| `baseURL`    | `http://localhost:9999/`        | Absolute URL of the devtools server.                                           |
| `intervalMs` | The server's `limits.refreshMs` | How often the app reports.                                                     |
| `retryMs`    | `5000`                          | How long to wait before connecting again after a failure or a dropped socket.  |

The server's [configuration](./configuration.md) applies to the app: inspectors you turn off there are not collected, and `redaction.secretNames` masks values before they leave the device.

## Other stores on a device

NGXS, Elf and MiniRx look for the Redux DevTools extension once, when the app starts, and the overlay starts after `mount()`. Import `@pangular-inspector/devtools/store-hook` first in `src/main.ts`, so these stores find the [stand-in](../inspectors/ngrx-store.md#other-stores) as they are created:

```ts
// src/main.ts
import '@pangular-inspector/devtools/store-hook';
import {AppRegistry, Image, Platform, processColor} from 'react-native';
```

The hook does nothing when `ngDevMode` is off. Without it, only stores created after the overlay connects report.

## How it works

- **Host tree**: the overlay walks the engine nodes under `app.engine.root` with the same collectors as the browser overlay. Text runs are skipped, and the anchors of `@if`, `@for` and `<ng-container>` show as `ng-container`.
- **Reporting**: the app polls every `intervalMs`, sends a report only when it changed (with a keepalive), and reconnects after `retryMs` when the server restarts or the socket drops. It keeps one page id until the overlay stops. The **Leaks** scan walks the tree again when the component tree changed, and at least every 30 seconds.
- **Angular version**: change detection recording and **Startup** read the version from the `ng-version` value *Angular sets on the root host. When the renderer keeps none, recording stays off and the **Change detection** section says the page has no profiler, as in a browser, since taking Angular's profiler without knowing the version could evict another one for good.
- **Errors**: the overlay wraps the app's `ErrorHandler`, listens to the console, and hears React Native's global error handler (`ErrorUtils`), which it calls on with every error and puts back when the overlay stops.
- **Highlight**: when the panel or the `highlight` agent tool points at a component, the overlay measures the view with the engine and adds a `view` node of its own to the root, with a 2 px `#68b6ff` border and `pointerEvents: 'none'`, so no view of the app changes. The collectors leave the box out of the tree. It goes away when the panel clears it. If the engine can't create or measure nodes, the overlay sets `outlineWidth`, `outlineStyle` and `outlineColor` in the view's inline style instead, and restores the previous values afterwards.
- **Pick**: **Pick component on device** sets a capturing responder on the root, so the root takes the next touch before the app's own responders. The overlay selects the component that hosts the node the touch landed on, and removes the responder. The arrow keys in the panel move between components as in a browser. A pick ends after 15 seconds without a tap.

## Try the demo

`examples/angular-native` is an Expo app wired up this way, with a root service, an `@ngrx/signals` store and components with signals to inspect. It is outside the pnpm workspace and installs with npm, using a tarball of the devtools package built from this repository. It uses `@ng-native/*` 0.2.0. The overlay's tests run against a simulated view tree and connection, and no automated test runs the demo on a simulator or device:

```bash
cd examples/angular-native
npm run devtools:pack
npm install
npm run devtools
```

`npm run devtools` starts the devtools server with `--no-auth` on `http://localhost:9999/`, scanning the demo's `src`. In a second terminal, build and start the app:

```bash
npm run ios
```

On Android, forward the devtools port first:

```bash
adb reverse tcp:9999 tcp:9999
npm run android
```

After a change in `packages/devtools`, run `npm run devtools:pack` and then `npm install ./pangular-inspector-devtools.tgz`, since a plain `npm install` keeps the tarball its lockfile pins. See [Angular Native demo](../contributing/demo-apps.md#angular-native-demo) for what each file covers.

## Troubleshooting

The [troubleshooting page](./troubleshooting.md) lists the problems every setup shares, by symptom.

<ngmd-accordion>
  <ngmd-accordion-item title="The live tabs stay empty" open>
    Check the Metro log for a <code>[pangular]</code> line. A warning about <code>--no-auth</code> means the server asked for a code. A warning about reaching the server means the address is wrong for where the app runs. See <a href="#where-the-overlay-connects">where the overlay connects</a>. A release build has no <code>ng</code> global, so nothing is collected there.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The Providers list of an injector is empty">
    Angular records providers only when a <code>window</code> global exists as <code>mount()</code> creates the platform. When <code>__DEV__</code> is <code>true</code> and no <code>window</code> exists, importing <code>&#64;pangular-inspector/devtools/overlay-angular-native</code> defines one until Angular publishes its debug utilities, then removes it. Keep the import at the top of <code>src/main.ts</code>, so it runs before <code>mount()</code>. If the list stays empty, check that <code>window</code> is defined before <code>mount()</code> runs.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/cli" title="Standalone CLI"></ngmd-pill>
  <ngmd-pill href="/getting-started/configuration" title="Configuration"></ngmd-pill>
  <ngmd-pill href="/getting-started/troubleshooting" title="Troubleshooting"></ngmd-pill>
  <ngmd-pill href="/inspectors/components" title="Components"></ngmd-pill>
  <ngmd-pill href="/security" title="Access and redaction"></ngmd-pill>
</ngmd-pill-row>
