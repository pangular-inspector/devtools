---
title: Set up Angular Native
description: Inspect an Angular Native app from a simulator, an emulator or a device, step by step.
---

<ngmd-hero title="Set up Angular Native" gradient>
  An Angular Native overlay walks the app's node tree and reports over a WebSocket to a devtools server on your machine.
</ngmd-hero>

# Set up Angular Native

This guide adds the devtools to an [Angular Native](https://ng-native.com) app. The app renders through React Native's Fabric renderer and has no DOM, so a separate overlay walks Angular Native's node tree through *Angular's debug API and reports to the standalone devtools server. For what each tab shows and the overlay options, see [Angular Native](../getting-started/angular-native.md).

## What you get

<ngmd-card-grid columns="2">
  <ngmd-card icon="layers" title="Angular inspectors">
    The component tree, the signal graph, the injector tree and the pipes in use.
  </ngmd-card>
  <ngmd-card icon="box" title="NgRx stores">
    Live <code>&#64;ngrx/signals</code> and <code>&#64;ngrx/store</code> state and the change log, when your app uses NgRx.
  </ngmd-card>
  <ngmd-card icon="search" title="Highlight">
    Hovering a component in the panel outlines its view on the simulator or device.
  </ngmd-card>
  <ngmd-card icon="terminal" title="MCP endpoint">
    <code>/__mcp</code> on the devtools server. The source scanners read the app's <code>src/</code>.
  </ngmd-card>
</ngmd-card-grid>

## The flow

<ngmd-workflow>
  <ngmd-step title="Install the packages">
    Add <code>&#64;pangular-inspector/devtools</code> and <code>devframe</code>. A bare React Native app also needs a <code>URL</code> polyfill.
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

## Step 1: Install

```bash group="install" name="npm" image="https://cdn.simpleicons.org/npm/CB3837" active
npm install @pangular-inspector/devtools devframe
```

```bash group="install" name="pnpm" image="https://cdn.simpleicons.org/pnpm/F69220"
pnpm add @pangular-inspector/devtools devframe
```

```bash group="install" name="yarn" image="https://cdn.simpleicons.org/yarn/2C8EBB"
yarn add @pangular-inspector/devtools devframe
```

```bash group="install" name="bun" image="https://bun.sh/logo.svg"
bun add @pangular-inspector/devtools devframe
```

### WebSocket and URL

The overlay needs a `WebSocket` global and a standards-compliant `URL`. React Native provides `WebSocket`, and Expo provides `URL`, so an Expo app needs nothing more.

React Native's own `URL` is read-only, and the client sets the `protocol` of the socket URL. In a bare React Native app, add a polyfill such as `react-native-url-polyfill` and import it first in `src/main.ts`.

## Step 2: Start the overlay

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

The `__DEV__` check keeps the overlay out of release builds, which have no `ng` debug global to read. `initAngularNativeOverlay()` returns a function that stops the overlay and tells the server to forget the app. See [Options](../getting-started/angular-native.md#options) for `baseURL`, `intervalMs` and `retryMs`.

### Where the overlay connects

The overlay connects to `http://localhost:9999/` unless you pass `baseURL`.

| Where the app runs                     | What to do                                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| iOS simulator                          | Nothing. The simulator shares your machine's `localhost`.                                       |
| Android emulator or USB Android device | Run `adb reverse tcp:9999 tcp:9999`, the same forwarding Metro uses for its own port.           |
| Physical device over Wi-Fi             | Pass your machine's LAN address as `baseURL`, such as `{baseURL: 'http://192.168.1.20:9999/'}`. |

A device that reaches the server over plain HTTP may need a cleartext exception for that address in `Info.plist` or the Android network security config.

## Step 3: Run the devtools server

Run the server in the app's folder, so the source scanners read its `src/`:

```bash
cd my-angular-native-app
npx @pangular-inspector/devtools dev --no-auth
```

The server listens on `localhost` only, which the iOS simulator reaches directly and an Android emulator reaches through `adb reverse`. `--no-auth` is needed because the app cannot enter the one-time code the panel asks for. Without it, the overlay logs a warning in the Metro log that names the flag and keeps retrying.

When it is ready, the server prints the Angular Native view on its own line:

```text
  pangular v0.0.7
  Panel: http://localhost:9999/
  Angular Native apps: http://localhost:9999/?view=angular-native
  MCP:   http://localhost:9999/__mcp
```

A physical device over Wi-Fi reaches your machine over the network, so the server has to listen on an interface the device can reach:

```bash
npx @pangular-inspector/devtools dev --host 192.168.1.20 --no-auth
```

<ngmd-alert severity="warning" label="Trusted networks only">
  With <code>--host</code> and <code>--no-auth</code>, every host that can reach that address can call the devtools RPC and MCP endpoints without a code. Use it on a trusted network only, and bind to the one interface the device uses rather than <code>0.0.0.0</code>.
</ngmd-alert>

See [Standalone CLI](../getting-started/cli.md) for the other server options and [Security](../security.md) for what `--no-auth` turns off.

## Step 4: Open the panel

Open `http://localhost:9999/?view=angular-native` on your machine. The **Angular Native** view shows the tabs an app on a device fills: **Components**, **Signals**, **Injectors**, **Store** and **Pipes**. With no app connected, it says **No Angular Native app is connected**.

When the app connects, the Metro log shows `[pangular] Connected to the devtools server at http://localhost:9999/` and the tabs fill. Hover a component in the tree to outline its view on the device.

If the app reports to a hub (Express or the Vite plugin) instead, pick the **Angular Native** dock in the side rail. See [Where it shows in the panel](../getting-started/angular-native.md#where-it-shows-in-the-panel).

## Try the demo

`examples/angular-native` is an Expo app wired up this way, with a root service, an `@ngrx/signals` store and components with signals to inspect. It is outside the pnpm workspace and installs with npm, using a tarball of the devtools package built from this repository:

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

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/angular-native" title="Angular Native"></ngmd-pill>
  <ngmd-pill href="/getting-started/cli" title="Standalone CLI"></ngmd-pill>
  <ngmd-pill href="/inspectors/components" title="Components inspector"></ngmd-pill>
  <ngmd-pill href="/agents/mcp-server" title="MCP server"></ngmd-pill>
</ngmd-pill-row>
