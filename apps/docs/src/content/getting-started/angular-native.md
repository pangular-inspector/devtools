---
title: Angular Native
description: Send live components, signals, injectors and NgRx stores from an Angular Native app on a device to the devtools on your machine.
---

<ngmd-hero title="Angular Native" gradient>
  Inspect an Angular Native app running on a simulator, an emulator or a phone. The app reports to a devtools server on your machine over a WebSocket.
</ngmd-hero>

# Angular Native

[Angular Native](https://ng-native.com) renders *Angular onto React Native's Fabric renderer, so the app has no DOM for the [browser overlay](./overlay.md) to walk. The `@pangular-inspector/devtools/overlay-angular-native` entry point walks Angular Native's own node tree instead and sends the same live data to a devtools server that runs on your machine.

## What it shows

| Tab        | On Angular Native                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| Components | The component tree, paths and the detail panel. Pointing at a component in the panel outlines it on the device.           |
| Signals    | The signal graph of the selected component, or of the first component with signals. There is no routed component to pick. |
| Injectors  | Element injectors, including `<ng-container>` anchors, and environment injectors with their providers.                    |
| NgRx       | Live `@ngrx/signals` and `@ngrx/store` state and the change log.                                                          |
| Pipes      | The pipes in use, with their instances and the components that use them. Recording pipe calls works as in the browser.    |

The source scans (routes, pipes, NgRx declarations) come from the server, so they work as with the [Standalone CLI](./cli.md). The Router, Forms, SSR & HTTP and change detection tabs show no live data for an Angular Native app, and there is no in-app popup.

Some controls only work with the [browser overlay](./overlay.md), so the panel hides them while the Components tab shows an Angular Native app, in the **Angular Native** view and in the panel without `?view`:

| Control                    | Why it is hidden                                                    |
| -------------------------- | ------------------------------------------------------------------- |
| **Pick component on page** | Picking listens for a click on a DOM element.                       |
| **Change detection** block | The Angular Native overlay does not record change detection cycles. |

The controls stay for browser pages. Hovering a row still outlines the component on the device.

## Where it shows in the panel

The **Angular Native** view shows only the tabs an app on a device fills: **Components**, **Signals**, **Injectors**, **Store** and **Pipes**, scoped to that app.

| Server                             | How to open the view                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Standalone CLI](./cli.md)         | Open the **Angular Native apps** URL the CLI prints, `http://localhost:9999/?view=angular-native`. |
| A hub (Express or the Vite plugin) | Pick the **Angular Native** dock in the side rail.                                                 |

The panel without `?view` also shows the app, in the same tabs as a browser page.

The overlay marks its component reports with `platform: 'angular-native'`, and the view follows the newest app that sends them. It keeps the app it shows while that app reports, and the app keeps its page id when it reconnects. With no app connected, the view says **No Angular Native app is connected** and links to this page. The view reads the component reports, so turning off the `components` inspector hides the dock and leaves the view empty.

`list-pages` gives each page's platform, so an agent can tell an Angular Native app from a browser tab. See [Agent tools](../agents/tools.md#list-pages).

## Requirements

- A development build. Angular publishes its debug API on `globalThis.ng` only when `ngDevMode` is on, which is the default in a Metro development build.
- An app started with `mount()` from `@ng-native/platform`. The overlay needs the root node it returns.
- A `WebSocket` global and a standards-compliant `URL`. React Native provides `WebSocket`. Expo provides `URL`. React Native's own `URL` is read-only, and the client sets the `protocol` of the socket URL, so a bare React Native app needs a polyfill such as `react-native-url-polyfill`.

## Set up the app

The [Angular Native demo](../contributing/demo-apps.md#angular-native-demo) (`examples/angular-native`) is this setup, with a store, a service and signals to inspect. Its README runs it on iOS and Android.

<ngmd-workflow>
  <ngmd-step title="Install the package">
    Add <code>&#64;pangular-inspector/devtools</code> and <code>devframe</code> to the app, as on the <a href="./installation.md">installation</a> page.
  </ngmd-step>
  <ngmd-step title="Start the overlay after mount()">
    Pass the root node of the mounted app. The check keeps the overlay out of release builds.
  </ngmd-step>
  <ngmd-step title="Start the devtools server">
    Run the CLI from the root of the app, so the source scans read its <code>src</code> folder.
  </ngmd-step>
  <ngmd-step title="Open the panel">
    Open the <strong>Angular Native apps</strong> URL the server prints, <code>http://localhost:9999/?view=angular-native</code>, on your machine. The live tabs fill once the app connects.
  </ngmd-step>
</ngmd-workflow>

### Start the overlay

```ts
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

`initAngularNativeOverlay()` returns a function that stops the overlay and tells the server to forget the app.

### Start the server

```bash
npx @pangular-inspector/devtools dev --no-auth
```

When it is ready, the server prints the Angular Native view on its own line:

```text
  pangular v0.0.7
  Panel: http://localhost:9999/
  Angular Native apps: http://localhost:9999/?view=angular-native
  MCP:   http://localhost:9999/__mcp
```

The app can't answer the one-time code the server asks for, so the server needs `--no-auth`. Without it, the overlay logs a warning that names the flag and keeps retrying.

<ngmd-callout type="warning" title="Keep the server on a trusted network">
  <code>--no-auth</code> lets anything that reaches the server use its RPC and MCP endpoints. Keep the default <code>localhost</code> bind when you can, and see <a href="../security.md">Access and redaction</a>.
</ngmd-callout>

## Reach the server from a device

The overlay connects to `http://localhost:9999/` unless you pass `baseURL`.

| Where the app runs                     | What to do                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| iOS simulator                          | Nothing. The simulator shares your machine's `localhost`.                                                                                  |
| Android emulator or USB Android device | Run `adb reverse tcp:9999 tcp:9999`, the same forwarding Metro uses for its own port.                                                      |
| Physical device over Wi-Fi             | Start the server with `--host` set to your machine's LAN address, and pass that address as `baseURL`, such as `http://192.168.1.20:9999/`. |

A device that reaches the server over plain HTTP may need a cleartext exception for that address in `Info.plist` or the Android network security config.

## Options

| Option       | Default                         | What it does                                                                   |
| ------------ | ------------------------------- | ------------------------------------------------------------------------------ |
| `root`       | (required)                      | The node `mount()` created (`app.engine.root`), or a function that returns it. |
| `baseURL`    | `http://localhost:9999/`        | Absolute URL of the devtools server.                                           |
| `intervalMs` | The server's `limits.refreshMs` | How often the app reports.                                                     |
| `retryMs`    | `5000`                          | How long to wait before connecting again after a failure or a dropped socket.  |

The server's [configuration](./configuration.md) applies to the app: inspectors you turn off there are not collected, and `redaction.secretNames` masks values before they leave the device.

## How it works

- **Host tree**: the overlay walks the engine nodes under `app.engine.root` with the same collectors as the browser overlay. Text runs are skipped, and the anchors of `@if`, `@for` and `<ng-container>` show as `ng-container`.
- **Reporting**: the app polls every `intervalMs`, sends a report only when it changed (with a keepalive), and reconnects after `retryMs` when the server restarts or the socket drops. It keeps one page id until the overlay stops.
- **Highlight**: when the panel or the `highlight` agent tool points at a component, the overlay sets `outlineWidth`, `outlineStyle` and `outlineColor` in the view's inline style, and restores the previous values when the panel clears it.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="The live tabs stay empty" open>
    Check the Metro log for a <code>[pangular]</code> line. A warning about <code>--no-auth</code> means the server asked for a code. A warning about reaching the server means the address is wrong for where the app runs. A release build has no <code>ng</code> global, so nothing is collected there.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The Providers list of an injector is empty">
    Angular records providers only when a <code>window</code> global exists as <code>mount()</code> creates the platform. If the list stays empty, check that <code>window</code> is defined before <code>mount()</code> runs.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/cli" title="Standalone CLI"></ngmd-pill>
  <ngmd-pill href="/getting-started/configuration" title="Configuration"></ngmd-pill>
  <ngmd-pill href="/inspectors/components" title="Components"></ngmd-pill>
  <ngmd-pill href="/security" title="Access and redaction"></ngmd-pill>
</ngmd-pill-row>
