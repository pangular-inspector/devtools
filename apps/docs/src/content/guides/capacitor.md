---
title: Set up Capacitor
description: Inspect an Ionic or Capacitor Angular app from the simulator, the emulator or a device, step by step.
---

<ngmd-hero title="Set up Capacitor" logo="https://cdn.simpleicons.org/capacitor/119EFF" gradient>
  An Ionic or Capacitor app runs the browser overlay in its WebView and reports to a devtools server on your machine.
</ngmd-hero>

# Set up Capacitor

This guide adds the devtools to an Ionic or Capacitor *Angular app. The app runs in a WebView, so the [browser overlay](../getting-started/overlay.md) works there as it does in a browser. The only difference is how it finds the devtools server: the app loads from `capacitor://localhost` or `https://localhost`, not from the server, so you start the overlay yourself and tell it where the server is.

## What you get

<ngmd-card-grid columns="2">
  <ngmd-card icon="layers" title="Every browser inspector">
    Components, signals, injectors, router, forms, pipes, HTTP and NgRx, as for a page in a browser.
  </ngmd-card>
  <ngmd-card icon="search" title="Highlight">
    Hovering a row in the devtools outlines the element in the WebView.
  </ngmd-card>
  <ngmd-card icon="compass" title="Angular dock">
    The app shows up as one more page in the Angular dock, with its own page id.
  </ngmd-card>
  <ngmd-card icon="terminal" title="MCP endpoint">
    <code>/__mcp</code> on the devtools server. The source scanners read the app's <code>src/</code>.
  </ngmd-card>
</ngmd-card-grid>

## The flow

<ngmd-workflow>
  <ngmd-step title="Install the package">
    Add <code>&#64;pangular-inspector/devtools</code> to the app.
  </ngmd-step>
  <ngmd-step title="Start the overlay">
    Call <code>initOverlay()</code> from <code>&#64;pangular-inspector/devtools/overlay-manual</code> in <code>src/main.ts</code>, with the server's address and connection info.
  </ngmd-step>
  <ngmd-step title="Run the devtools server">
    Start <code>npx &#64;pangular-inspector/devtools dev --no-auth</code> in the app's folder.
  </ngmd-step>
  <ngmd-step title="Run the app">
    Run the app on the simulator, the emulator or a device, and open the devtools UI in your desktop browser.
  </ngmd-step>
</ngmd-workflow>

## Step 1: Install

```bash group="install" name="npm" image="https://cdn.simpleicons.org/npm/CB3837" active
npm install -D @pangular-inspector/devtools
```

```bash group="install" name="pnpm" image="https://cdn.simpleicons.org/pnpm/F69220"
pnpm add -D @pangular-inspector/devtools
```

```bash group="install" name="yarn" image="https://cdn.simpleicons.org/yarn/2C8EBB"
yarn add -D @pangular-inspector/devtools
```

```bash group="install" name="bun" image="https://bun.sh/logo.svg"
bun add -d @pangular-inspector/devtools
```

## Step 2: Start the overlay

Import `initOverlay` from `@pangular-inspector/devtools/overlay-manual` after bootstrap, in development only:

```ts {7-13}
// src/main.ts
import {bootstrapApplication} from '@angular/platform-browser';
import {App} from './app/app';
import {appConfig} from './app/app.config';

bootstrapApplication(App, appConfig)
  .then(async () => {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      const {initOverlay} = await import('@pangular-inspector/devtools/overlay-manual');
      await initOverlay({
        baseURL: 'http://localhost:9999/',
        connectionMeta: {backend: 'websocket', websocket: {path: '__ws'}},
      });
    }
  })
  .catch((err) => console.error(err));
```

### Why the manual entry

`@pangular-inspector/devtools/overlay` starts an overlay on import and looks for the server next to the page. In a WebView that page is `capacitor://localhost` or `https://localhost`, so that attempt fails, and it also adds the floating button to the app. `@pangular-inspector/devtools/overlay-manual` exports the same functions and starts nothing until you call `initOverlay`. It adds no floating button, so you open the devtools in your desktop browser instead.

### Why `connectionMeta`

Without `connectionMeta`, the overlay first fetches `__connection.json` from `baseURL`. The app runs on another origin, and that file is served without CORS headers, so the WebView blocks the request. `connectionMeta` is the content of that file, passed in, so the overlay connects straight to the WebSocket.

| Field       | Value for the standalone server | What it does                              |
| ----------- | ------------------------------- | ----------------------------------------- |
| `backend`   | `'websocket'`                   | The transport to use                      |
| `websocket` | `{path: '__ws'}`                | The WebSocket path, relative to `baseURL` |
| `configs`   | Not set                         | The devtools config the overlay applies   |

The overlay reads its config (inspectors, `redaction` and `limits`) from `connectionMeta.configs`. With the short form above, the app uses the defaults: every inspector on and only the built-in secret names redacted. If your server has a [config](../getting-started/configuration.md), open `http://localhost:9999/__connection.json` in a browser and pass that whole object as `connectionMeta` instead, so the app applies the same config.

### Where the overlay connects

| Where the app runs           | `baseURL`                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| iOS simulator                | `http://localhost:9999/`                                                                   |
| Android emulator             | `http://localhost:9999/` after `adb reverse tcp:9999 tcp:9999`, or `http://10.0.2.2:9999/` |
| Android device               | `http://localhost:9999/` after `adb reverse tcp:9999 tcp:9999` over USB                    |
| Any physical device on Wi-Fi | Your machine's address, for example `http://192.168.1.20:9999/`                            |

Android blocks plain HTTP by default. Allow it for development in `capacitor.config.ts`:

```ts {7-9}
// capacitor.config.ts
import type {CapacitorConfig} from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.trips',
  appName: 'Trips',
  server: {
    cleartext: true,
  },
  webDir: 'www',
};

export default config;
```

On a device that reaches your machine over Wi-Fi, the app also connects to a non-loopback address from an `https://localhost` page, which the Android WebView treats as mixed content. Set `android.allowMixedContent: true` in the same file for that setup, and remove it before a release build.

## Step 3: Run the devtools server

Run the server in the app's folder, so the source scanners read its `src/`:

```bash
cd my-ionic-app
npx @pangular-inspector/devtools dev --no-auth
```

The server listens on `localhost` only, which the iOS simulator reaches, and the Android emulator reaches through `adb reverse` or `10.0.2.2`. `--no-auth` is needed because the app cannot enter the one-time code the server asks for.

| What         | Where                         |
| ------------ | ----------------------------- |
| Devtools UI  | `http://localhost:9999/`      |
| MCP endpoint | `http://localhost:9999/__mcp` |

A device on Wi-Fi reaches your machine over the network, so the server has to listen on an interface the device can reach:

```bash
npx @pangular-inspector/devtools dev --host 192.168.1.20 --no-auth
```

<ngmd-alert severity="warning" label="Trusted networks only">
  With <code>--host</code> and <code>--no-auth</code>, every host that can reach that address can call the devtools RPC and MCP endpoints without a code. Use it on a trusted network only, and bind to the one interface the device uses rather than <code>0.0.0.0</code>.
</ngmd-alert>

See [Standalone CLI](../getting-started/cli.md) for the other server options and [Security](../security.md) for what `--no-auth` turns off.

## Step 4: Run the app

Build and run the app as usual, for example with `npx cap run ios` or `npx cap run android`. Then open `http://localhost:9999/` in your desktop browser and pick the **Angular** dock. The app is listed as a page like any browser tab, and the tabs fill as soon as it reports.

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="The app shows no data in the devtools" open>
    Inspect the WebView (Safari's <strong>Develop</strong> menu for iOS, <code>chrome://inspect</code> for Android) and look for a <code>[pangular]</code> error in the console. <strong>No devtools server found</strong> means the address is wrong for where the app runs, or the server is not running. A blocked <code>__connection.json</code> request means <code>connectionMeta</code> is missing.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Does the WebSocket pass the server's origin check?">
    Yes. The app's origin is <code>capacitor://localhost</code> or <code>https://localhost</code>, and the server accepts loopback origins by default.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Does it ship in a release build?">
    No. The dynamic import runs only while <code>ngDevMode</code> is on, so the overlay stays out of production bundles.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/overlay" title="Browser overlay"></ngmd-pill>
  <ngmd-pill href="/getting-started/cli" title="Standalone CLI"></ngmd-pill>
  <ngmd-pill href="/guides/nativescript" title="Set up NativeScript"></ngmd-pill>
</ngmd-pill-row>
