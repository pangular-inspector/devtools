---
title: Set up Capacitor
description: Inspect an Ionic or Capacitor Angular app on a simulator, an emulator or a device, step by step.
---

<ngmd-hero title="Set up Capacitor" logo="https://cdn.simpleicons.org/capacitor/119EFF" gradient>
  An Ionic or Capacitor app runs the browser overlay in its WebView and reports to a devtools server on your machine.
</ngmd-hero>

# Set up Capacitor

This guide adds the devtools to an Ionic or Capacitor *Angular app. The app runs in a WebView, so the [browser overlay](../getting-started/overlay.md) works there as it does in a browser. What changes is how it reaches the devtools server. The WebView serves the app from `capacitor://localhost` on iOS and from `https://localhost` on Android, not from the server. So you start the overlay yourself, tell it where the server is, and let the WebView reach your machine.

<ngmd-callout type="warning" title="Development builds only">
  Every setting on this page, in the app and on the server, is for development builds. Keep them out of the builds you release.
</ngmd-callout>

## What you get

<ngmd-card-grid columns="2">
  <ngmd-card icon="layers" title="Every browser inspector">
    Components, signals, injectors, router, forms, pipes, HTTP and NgRx, as for a page in a browser.
  </ngmd-card>
  <ngmd-card icon="search" title="Highlight">
    Hovering a row in the devtools outlines the element in the WebView.
  </ngmd-card>
  <ngmd-card icon="compass" title="One more page">
    The app reports with its own page id, so it shows up next to your browser tabs.
  </ngmd-card>
  <ngmd-card icon="terminal" title="MCP endpoint">
    Agents read the app through the server's MCP endpoint, as for any other page.
  </ngmd-card>
</ngmd-card-grid>

## The flow

<ngmd-workflow>
  <ngmd-step title="Pick a server">
    The standalone CLI, the Express hub or the Vite plugin. Each one reaches different devices.
  </ngmd-step>
  <ngmd-step title="Start the overlay">
    Call <code>initOverlay()</code> from <code>&#64;pangular-inspector/devtools/overlay-manual</code> in <code>src/main.ts</code>, with the server's address and connection info.
  </ngmd-step>
  <ngmd-step title="Let the app reach your machine">
    Allow plain HTTP in the Android and iOS projects of a development build.
  </ngmd-step>
  <ngmd-step title="Run the server and the app">
    Start the server where the device can reach it, run the app, and enter the one-time code once.
  </ngmd-step>
</ngmd-workflow>

## Step 1: Pick a server

An Ionic app usually has no server of its own, so the [standalone CLI](../getting-started/cli.md) is the usual choice. If the app already mounts the [Express hub](../getting-started/express.md) or the [Vite plugin](../getting-started/vite.md), you can keep it, within these limits:

| Server                       | iOS simulator | Android emulator, USB device | Device over Wi-Fi |
| ---------------------------- | ------------- | ---------------------------- | ----------------- |
| Standalone CLI               | Yes           | Yes                          | Yes               |
| Express hub with `ws: false` | Yes           | Yes                          | Yes               |
| Vite plugin                  | No            | Yes, through `adb reverse`   | No                |

The Vite plugin answers only requests from your machine, and only from `http:` and `https:` origins. An Android emulator or a USB device reaches it through `adb reverse`, which arrives from your machine. A device on Wi-Fi does not, and the iOS origin `capacitor://localhost` is never accepted, even in `allowedOrigins`. For those, run the standalone CLI next to your Vite dev server.

Install the package in the app:

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

## Step 2: Start the overlay

Import `initOverlay` from `@pangular-inspector/devtools/overlay-manual` after bootstrap, in development only. This example reports to the standalone CLI on a machine at `192.168.1.20`:

```ts {6-12}
// src/main.ts
import {bootstrapApplication} from '@angular/platform-browser';
import {App} from './app/app';
import {appConfig} from './app/app.config';

bootstrapApplication(App, appConfig)
  .then(async () => {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      const {initOverlay} = await import('@pangular-inspector/devtools/overlay-manual');
      await initOverlay({
        baseURL: 'http://192.168.1.20:9999/',
        connectionMeta: {backend: 'websocket', websocket: {path: '__ws'}},
      });
    }
  })
  .catch((err) => console.error(err));
```

The `ngDevMode` check keeps the overlay out of production builds, which also have no `ng` debug global to read. So build the app with the development configuration before you run it on a device, for example `ng build --configuration development`.

### Why the manual entry

`@pangular-inspector/devtools/overlay` starts an overlay on import and looks for the server next to the page. In a WebView that page is `capacitor://localhost` or `https://localhost`, so that attempt fails. It also adds the floating button to the app. `@pangular-inspector/devtools/overlay-manual` exports the same functions, starts nothing until you call `initOverlay` and adds no button. You open the devtools in your desktop browser instead.

### Why `connectionMeta`

Without `connectionMeta`, the overlay first fetches `__connection.json` from `baseURL`. The servers send that file without CORS headers, so the WebView blocks the request and the overlay logs `[pangular] No devtools server found`. `connectionMeta` is the content of that file, passed in, so the overlay connects straight to the server's live endpoint.

### Values for each server

| Server                       | `baseURL`                                     | `connectionMeta`                                                 |
| ---------------------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| Standalone CLI               | `http://<address>:9999/`                      | `{backend: 'websocket', websocket: {path: '__ws'}}`              |
| Express hub with `ws: false` | `http://<address>:4000/__devframes/pangular/` | `{backend: 'sse', sse: {path: '/__devframes/__sse'}}`            |
| Vite plugin                  | `http://localhost:5173/__devframes/pangular/` | `{backend: 'websocket', websocket: {path: '/__devframes/__ws'}}` |

Use your server's port in place of `9999`, `4000` or `5173`. The hub's WebSocket side-car (`ws: {sidecar: true}`) listens on `localhost` on a port it picks itself, so a device can't reach it. Use `ws: false` for this setup.

The overlay applies the inspectors, `redaction` and `limits` it finds in `connectionMeta.configs`. Without `configs`, it uses the defaults: every inspector on and only the built-in secret names redacted. If your server has a [config](../getting-started/configuration.md), open its `__connection.json` in your desktop browser, for example `http://localhost:9999/__connection.json`, and pass the whole object as `connectionMeta`.

### The address

| Where the app runs      | `<address>`                                                                 |
| ----------------------- | --------------------------------------------------------------------------- |
| iOS simulator           | `localhost`. The simulator shares your machine's network.                   |
| Android emulator        | `localhost`, after `adb reverse tcp:9999 tcp:9999` with your server's port. |
| Android device over USB | `localhost`, after `adb reverse tcp:9999 tcp:9999` with your server's port. |
| Any device over Wi-Fi   | Your machine's address on the network, such as `192.168.1.20`.              |

Each server accepts the app's origin, `capacitor://localhost` or `https://localhost`, without an `allowedOrigins` entry, because its host is `localhost`. The Vite plugin is the exception for iOS, as Step 1 explains.

## Step 3: Let the app reach your machine

The devtools server speaks plain HTTP. Both platforms block that by default, so allow it in development builds.

### Android

The app's page is `https://localhost` and the server is plain HTTP, so the WebView blocks the connection as mixed content. Android also blocks cleartext traffic to other hosts. Allow both in `capacitor.config.ts`, behind a flag of your own so they stay out of release builds:

```ts {4,10-11}
// capacitor.config.ts
import type {CapacitorConfig} from '@capacitor/cli';

const devtools = process.env['CAPACITOR_DEVTOOLS'] === '1';

const config: CapacitorConfig = {
  appId: 'com.example.trips',
  appName: 'Trips',
  webDir: 'www',
  server: devtools ? {cleartext: true} : undefined,
  android: devtools ? {allowMixedContent: true} : undefined,
};

export default config;
```

Capacitor applies both on `npx cap sync`, which `npx cap run` also runs, so set the flag there: `CAPACITOR_DEVTOOLS=1 npx cap run android`. `server.cleartext` adds `android:usesCleartextTraffic="true"` to the app's manifest. Setting `server.androidScheme` to `'http'` also avoids mixed content, but it changes the app's origin, so the WebView no longer sees the data the app stored under `https://localhost`.

### iOS

App Transport Security also covers the WebView's requests. To let a development build reach your machine over plain HTTP, allow local networking in `ios/App/App/Info.plist`:

```html
<!-- ios/App/App/Info.plist (excerpt) -->
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsLocalNetworking</key>
  <true />
</dict>
```

Remove it, or keep it in a debug-only `Info.plist`, before you release.

## Step 4: Run the server and the app

### Listen where the device can reach

The iOS simulator, the Android emulator and `adb reverse` all reach your machine's `localhost`, so the default listen address works. A device on Wi-Fi needs the server to listen on your network address:

| Server         | How                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Standalone CLI | `npx @pangular-inspector/devtools dev --host 0.0.0.0` listens on every interface, `localhost` included. |
| Express hub    | `app.listen(port)` listens on every interface by default. Under `ng serve`, pass `--host 0.0.0.0`.      |
| Vite plugin    | Not possible. It refuses requests that do not come from your machine.                                   |

Run the standalone CLI in the app's folder, so the source scanners read its `src/`:

```bash
cd my-ionic-app
npx @pangular-inspector/devtools dev --host 0.0.0.0
```

Keep `localhost` in what the CLI listens on. With `--host 192.168.1.20` alone, the panel is only on that address, and the server refuses the panel's own origin there.

<ngmd-alert severity="warning" label="Keep the one-time code on">
  On a network address, any host on the network can reach the server, and the origin check alone does not stop a client that sends <code>Origin: https://localhost</code>. The one-time code is what keeps them out. Don't pass <code>--no-auth</code> to the CLI or <code>auth: false</code> to the hub in this setup, and use a trusted network.
</ngmd-alert>

### Enter the one-time code

The CLI and the Express hub ask for a one-time code by default. When the app connects, it shows a dialog that asks for the code, and the server prints the code in its terminal. Type it in the app. The app keeps the token it gets in the WebView's storage, so it asks again only after that storage is cleared.

The Vite plugin leaves the code off while it only allows your machine, so the app connects without a dialog.

### Run the app

Build the web app in development mode and run it with your usual Capacitor command, for example `CAPACITOR_DEVTOOLS=1 npx cap run android` or `npx cap run ios`. Then open the devtools in your desktop browser:

| Server         | Where                                                      |
| -------------- | ---------------------------------------------------------- |
| Standalone CLI | `http://localhost:9999/`                                   |
| Express hub    | `http://localhost:4000/__devframes/`, the **Angular** dock |
| Vite plugin    | `http://localhost:5173/__devframes/`, the **Angular** dock |

The app reports as one more page, and the tabs fill as soon as it does. The **Capacitor** dock in the hub links back to this guide.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="The devtools show no data from the app" open>
    Inspect the WebView, with Safari's <strong>Develop</strong> menu for iOS or <code>chrome://inspect</code> for Android, and read the console. <code>[pangular] No devtools server found</code> means <code>connectionMeta</code> is missing. A <strong>Mixed Content</strong> message means <code>allowMixedContent</code> is off, and the overlay sends nothing. A failed connection to the address means the server is not running, listens only on <code>localhost</code>, or the address is wrong for where the app runs.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Does it work with live reload?">
    With live reload, the WebView loads the app from your dev server, so the page's origin is that server's network address, such as <code>http://192.168.1.20:8100</code>, not <code>localhost</code>. The Express hub accepts it once you add it to <code>allowedOrigins</code>. The standalone CLI has no <code>allowedOrigins</code> option and refuses that origin.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Does it ship in a release build?">
    No. The dynamic import runs only while <code>ngDevMode</code> is on, so the overlay stays out of production bundles. The Android and iOS settings in Step 3 are yours to keep out of release builds.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/overlay" title="Browser overlay"></ngmd-pill>
  <ngmd-pill href="/getting-started/cli" title="Standalone CLI"></ngmd-pill>
  <ngmd-pill href="/security" title="Access and redaction"></ngmd-pill>
</ngmd-pill-row>
