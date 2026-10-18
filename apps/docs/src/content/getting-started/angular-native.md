---
title: Angular Native
description: Send live components, signals, injectors, stores, change detection, leaks and errors from an Angular Native app on a device to the devtools on your machine.
---

<ngmd-hero title="Angular Native" gradient>
  Inspect an Angular Native app running on a simulator, an emulator or a phone. The app reports to a devtools server on your machine over a WebSocket.
</ngmd-hero>

# Angular Native

[Angular Native](https://ng-native.com) renders *Angular onto React Native's Fabric renderer, so the app has no DOM for the [browser overlay](./overlay.md) to walk. The `@pangular-inspector/devtools/overlay-angular-native` entry point walks Angular Native's own node tree instead and sends the same live data to a devtools server that runs on your machine.

This page describes what the overlay shows and how it works. To add it to an app, follow [Set up Angular Native](../guides/angular-native.md).

## What it shows

| Tab        | On Angular Native                                                                                                                                                                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Components | The component tree, paths and the detail panel. Pointing at a component in the panel outlines it on the device. **Change detection** records cycles with their causes and OnPush hints, and **Leaks** lists effects and subscriptions, with navigations counted from the app's Router. |
| Signals    | The signal graph of the selected component, or of the first component with signals. There is no routed component to pick.                                                                                                                                                              |
| Injectors  | Element injectors, including `<ng-container>` anchors, and environment injectors with their providers. **Show value** reads a created provider's value, and **Startup** shows the Angular version and when the app was first stable.                                                   |
| Store      | Live `@ngrx/signals` and `@ngrx/store` state, the change log, sessions and restore, and NGXS, Elf and MiniRx stores. See [Other stores on a device](#other-stores-on-a-device).                                                                                                        |
| Queries    | The TanStack Query clients the app injected, with their queries and mutations.                                                                                                                                                                                                         |
| Pipes      | The pipes in use, with their instances and the components that use them. Recording pipe calls works as in the browser.                                                                                                                                                                 |
| Errors     | Errors from Angular's `ErrorHandler` and React Native's global error handler, the console, and the NG0100 and missing provider explainers.                                                                                                                                             |
| Audit      | The findings of change detection, leaks and errors, and before and after sessions. axe has no DOM to check.                                                                                                                                                                            |
| Plugins    | The views of [page plugins](../guides/write-a-plugin.md) the app registers.                                                                                                                                                                                                            |

The source scans (routes, pipes, NgRx declarations) come from the server, so they work as with the [Standalone CLI](./cli.md). There is no in-app popup.

### What needs a browser

These features read or draw the DOM, or run in the browser, so an Angular Native app has none of them. The panel hides the picker and the live views for the app, **Run axe** says the app has no DOM, and the agent tools answer the same instead of asking another tab.

| Feature                                                           | Why it is missing                                                                                                                                                                 |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pick component on page**                                        | Picking listens for a click on a DOM element.                                                                                                                                     |
| **Flash checks**, **Performance track** and **Angular profiling** | They draw over DOM elements or into the browser's Performance panel.                                                                                                              |
| Checks that changed nothing                                       | The recording counts them by watching DOM updates.                                                                                                                                |
| Destroyed and retained instances in **Leaks**                     | A development build keeps every destroyed instance in Angular's DI debug data, so only a detached view would show a leak, and telling one apart asks Angular about a DOM element. |
| Provider construction times in **Startup**                        | They need the startup hook, which loads before *Angular in a browser.                                                                                                             |
| axe, `screenshot-component`, hydration and the console handles    | They read or copy the DOM.                                                                                                                                                        |
| Router, Forms and SSR & HTTP tabs                                 | The Angular Native overlay does not collect them.                                                                                                                                 |

The controls stay for browser pages. Hovering a row still outlines the component on the device.

## Where it shows in the panel

The **Angular Native** view shows only the tabs an app on a device fills: **Components**, **Signals**, **Injectors**, **Store**, **Queries**, **Pipes** and **Errors**, scoped to that app. The **Audit** and **Plugins** tabs show the app in the panel without `?view`.

| Server                             | How to open the view                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Standalone CLI](./cli.md)         | Open the **Angular Native apps** URL the CLI prints, `http://localhost:9999/?view=angular-native`. |
| A hub (Express or the Vite plugin) | Pick the **Angular Native** dock in the side rail.                                                 |

The panel without `?view` also shows the app, in the same tabs as a browser page.

The overlay marks its component reports with `platform: 'angular-native'`, and the view follows the newest app that sends them. It keeps the app it shows while that app reports, and the app keeps its page id when it reconnects. With no app connected, the view says **No Angular Native app is connected** and links to this page. In the hub, the dock's tooltip in the rail then reads **Angular Native: no app connected**. The view reads the component reports, so turning off the `components` inspector hides the dock and leaves the view empty.

`list-pages` gives each page's platform, so an agent can tell an Angular Native app from a browser tab. See [Agent tools](../agents/tools.md#list-pages).

## Requirements

- A development build. Angular publishes its debug API on `globalThis.ng` only when `ngDevMode` is on, which is the default in a Metro development build.
- An app started with `mount()` from `@ng-native/platform`. The overlay needs the root node it returns. The demo uses `@ng-native/*` 0.2.0, the version the overlay is written against.
- A `WebSocket` global and a standards-compliant `URL`. React Native provides `WebSocket`. Expo provides `URL`. React Native's own `URL` is read-only, and the client sets the `protocol` of the socket URL, so a bare React Native app needs a polyfill such as `react-native-url-polyfill`.

## Set up

[Set up Angular Native](../guides/angular-native.md) walks through it: install the package, start the overlay after `mount()`, run the server with `--no-auth` and open the panel. It also covers how the app reaches the server from a simulator, an emulator or a device, and how to run the [Angular Native demo](../contributing/demo-apps.md#angular-native-demo).

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
- **Highlight**: when the panel or the `highlight` agent tool points at a component, the overlay sets `outlineWidth`, `outlineStyle` and `outlineColor` in the view's inline style, and restores the previous values when the panel clears it.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="The live tabs stay empty" open>
    Check the Metro log for a <code>[pangular]</code> line. A warning about <code>--no-auth</code> means the server asked for a code. A warning about reaching the server means the address is wrong for where the app runs. See <a href="../guides/angular-native.md#where-the-overlay-connects">where the overlay connects</a>. A release build has no <code>ng</code> global, so nothing is collected there.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The Providers list of an injector is empty">
    Angular records providers only when a <code>window</code> global exists as <code>mount()</code> creates the platform. If the list stays empty, check that <code>window</code> is defined before <code>mount()</code> runs.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/guides/angular-native" title="Set up Angular Native"></ngmd-pill>
  <ngmd-pill href="/getting-started/cli" title="Standalone CLI"></ngmd-pill>
  <ngmd-pill href="/getting-started/configuration" title="Configuration"></ngmd-pill>
  <ngmd-pill href="/inspectors/components" title="Components"></ngmd-pill>
  <ngmd-pill href="/security" title="Access and redaction"></ngmd-pill>
</ngmd-pill-row>
