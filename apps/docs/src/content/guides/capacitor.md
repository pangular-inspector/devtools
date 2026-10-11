---
title: Set up Capacitor
description: Inspect an Ionic or Capacitor Angular app on a simulator, an emulator or a device, step by step.
---

<ngmd-hero title="Set up Capacitor" logo="https://cdn.simpleicons.org/capacitor/119EFF" gradient>
  An Ionic or Capacitor app runs the browser overlay in its WebView and reports to a devtools server on your machine.
</ngmd-hero>

# Set up Capacitor

This guide adds the devtools to an Ionic or Capacitor *Angular app. The app runs in a WebView, so the [browser overlay](../getting-started/overlay.md) works there as it does in a browser. What changes is how it reaches the devtools server, and that depends on where the WebView loads the app from:

- With live reload, the WebView loads the app from your dev server. If the devtools are mounted in that server, the overlay finds them like in a browser.
- A bundled build loads the app from `capacitor://localhost` on iOS and `https://localhost` on Android. The devtools server is on another origin, so you start the overlay yourself and pass the connection info.

<ngmd-callout type="warning" title="Development builds only">
  Every setting on this page, in the app and on the server, is for development builds. Keep them out of the builds you release.
</ngmd-callout>

## Which setup you need

| Your devtools server             | iOS simulator, Android emulator, USB device           | Phone over Wi-Fi                                                           |
| -------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| Express hub in `server.ts`       | [Live reload on localhost](#live-reload-on-localhost) | [Live reload over Wi-Fi](#live-reload-over-wi-fi), with `allowedOrigins`   |
| Vite plugin (Analog)             | [Live reload on localhost](#live-reload-on-localhost) | [Live reload over Wi-Fi](#live-reload-over-wi-fi), with `allowLan`         |
| Standalone CLI behind `ng serve` | [Live reload on localhost](#live-reload-on-localhost) | [Live reload over Wi-Fi](#live-reload-over-wi-fi), with `--allowed-origin` |
| Standalone CLI on its own        | [A bundled build](#a-bundled-build)                   | [A bundled build](#a-bundled-build)                                        |

Over Wi-Fi, the page's origin is your machine's network address, not `localhost`, so the server has to allow that origin. A bundled build works with any server that the phone can reach.

## Live reload on localhost

`npx cap run <platform> --live-reload` points the WebView at your dev server by setting `server.url` for that run. It does not start the dev server. Start it yourself, then pass its port and `--host localhost`. Without `--host`, Capacitor uses your machine's network address, and the port defaults to 3000.

The page is then on `http://localhost:<port>`, the same origin as the devtools in that server. Load the overlay the usual way, as in [Browser overlay](../getting-started/overlay.md), with `@pangular-inspector/devtools/overlay`. It finds the server next to the page and adds the floating button inside the app.

<ngmd-workflow>
  <ngmd-step title="Mount the devtools in the dev server">
    The <a href="../getting-started/express.md">Express hub</a> in <code>server.ts</code>, the <a href="../getting-started/vite.md">Vite plugin</a>, or the standalone CLI behind the <code>ng serve</code> proxy, as in <a href="../getting-started/installation.md#client-only-angular-cli-app">Client-only Angular CLI app</a>.
  </ngmd-step>
  <ngmd-step title="Start the dev server">
    For example <code>ng serve --port 4200</code>.
  </ngmd-step>
  <ngmd-step title="Forward the port on Android">
    For the Android emulator or a USB device, run <code>adb reverse tcp:4200 tcp:4200</code>. The iOS simulator shares your machine's <code>localhost</code>.
  </ngmd-step>
  <ngmd-step title="Run the app">
    <code>npx cap run ios --live-reload --host localhost --port 4200</code>, or the same with <code>android</code>.
  </ngmd-step>
</ngmd-workflow>

On Android, live reload also allows cleartext traffic for that run, and puts both settings back when you stop it with Ctrl+C.

## Live reload over Wi-Fi

A phone on Wi-Fi loads the app from your machine's network address, such as `http://192.168.1.20:4200`. Allow that origin on your devtools server:

| Server                           | Allow the page's origin                                                                                                                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Express hub                      | `initPangularHub({ws: false, allowedOrigins: ['http://192.168.1.20:4200']})`                                                                                                                                |
| Vite plugin                      | `pangular({allowLan: true, allowedOrigins: ['http://192.168.1.20:5173']})`, with Vite's `server.host: true`. See [Other devices on your network](../getting-started/vite.md#other-devices-on-your-network). |
| Standalone CLI behind `ng serve` | `npx @pangular-inspector/devtools dev --allowed-origin http://192.168.1.20:4200`                                                                                                                            |

Then start the dev server on every interface, for example `ng serve --host 0.0.0.0 --port 4200`, and run `npx cap run ios --live-reload --host 192.168.1.20 --port 4200`. The overlay loads as in a browser, through `@pangular-inspector/devtools/overlay`.

<ngmd-alert severity="warning" label="Keep the one-time code on">
  On a network address, anyone on the network can reach the server, and the origin check alone does not stop a client that sends an allowed <code>Origin</code>. The one-time code keeps them out. Don't pass <code>auth: false</code> in this setup, and use a trusted network.
</ngmd-alert>

## A bundled build

A bundled build loads the app from `capacitor://localhost` on iOS and from `https://localhost` on Android. Start the overlay yourself with `@pangular-inspector/devtools/overlay-manual`, and pass the server's address and its connection info.

### Start the overlay

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

Started with `--host 0.0.0.0`, the standalone CLI prints this call with your network address and its whole connection info, config included, ready to paste.

The `ngDevMode` check keeps the overlay out of production builds, which also have no `ng` debug global to read. So build the app with the development configuration before you sync it, for example `ng build --configuration development`.

`@pangular-inspector/devtools/overlay` would start an overlay on import and look for the server next to the page, which fails here, and it would add the floating button to the app. `overlay-manual` starts nothing until you call `initOverlay` and adds no button, so you open the devtools in your desktop browser.

### The connection info

Without `connectionMeta`, the overlay first fetches `__connection.json` from `baseURL`. The servers send that file without CORS headers, so the WebView blocks it and the overlay logs `[pangular] No devtools server found`. `connectionMeta` is the content of that file, passed in.

| Server                       | `baseURL`                                     | `connectionMeta`                                                 |
| ---------------------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| Standalone CLI               | `http://<address>:9999/`                      | `{backend: 'websocket', websocket: {path: '__ws'}}`              |
| Express hub with `ws: false` | `http://<address>:4000/__devframes/pangular/` | `{backend: 'sse', sse: {path: '/__devframes/__sse'}}`            |
| Vite plugin                  | `http://localhost:5173/__devframes/pangular/` | `{backend: 'websocket', websocket: {path: '/__devframes/__ws'}}` |

- Pass one `baseURL`, not a list. `initOverlay` refuses a list with `connectionMeta`.
- Use your server's port in place of `9999`, `4000` or `5173`.
- The hub's WebSocket side-car (`ws: {sidecar: true}`) listens on `localhost` on a port it picks, so a device can't reach it. Use `ws: false`.
- The Vite plugin works here only for Android through `adb reverse`. It refuses the iOS origin `capacitor://localhost`, which `allowedOrigins` can't add.

The short forms above carry no `configs`, so the overlay uses the default inspectors, limits and redaction, and logs a warning. The server's `redaction.secretNames` are then not applied on the page. If your server has a [config](../getting-started/configuration.md), open its `__connection.json` in your desktop browser, for example `http://localhost:9999/__connection.json`, and pass the whole object as `connectionMeta`.

| Where the app runs      | `<address>`                                                                |
| ----------------------- | -------------------------------------------------------------------------- |
| iOS simulator           | `localhost`                                                                |
| Android emulator or USB | `localhost`, after `adb reverse tcp:9999 tcp:9999` with your server's port |
| Phone over Wi-Fi        | Your machine's network address, such as `192.168.1.20`                     |

Each server accepts `capacitor://localhost` and `https://localhost` without an `allowedOrigins` entry, because their host is `localhost`. The Vite plugin is the exception for iOS.

### Let the app reach your machine

The page is `https://localhost` on Android and the server is plain HTTP, so the Android WebView blocks the connection as mixed content. Android also blocks cleartext traffic. Allow both in a development build:

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

Capacitor applies both on `npx cap sync`, which `npx cap run` also runs, so set the flag there: `CAPACITOR_DEVTOOLS=1 npx cap run android`. `server.cleartext` sets `android:usesCleartextTraffic` in the manifest of the `capacitor-cordova-android-plugins` module, which Android merges into the app. Setting `server.androidScheme` to `'http'` also avoids mixed content, but it changes the app's origin, so the WebView no longer sees the data the app stored under `https://localhost`.

On iOS, App Transport Security can block plain HTTP to a network address. If it does, allow local networking in a development build's `ios/App/App/Info.plist`:

```html
<!-- ios/App/App/Info.plist (excerpt) -->
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsLocalNetworking</key>
  <true />
</dict>
```

### Run the server where the device reaches it

The simulator, the emulator and `adb reverse` reach your machine's `localhost`. A phone on Wi-Fi needs the server on your network address:

| Server         | How                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Standalone CLI | `npx @pangular-inspector/devtools dev --host 0.0.0.0` listens on every interface, `localhost` included. |
| Express hub    | `app.listen(port)` listens on every interface by default. Under `ng serve`, pass `--host 0.0.0.0`.      |
| Vite plugin    | Not for a bundled build: `allowLan` needs a network origin, and the app's origin is `localhost`.        |

Keep `localhost` in what the CLI listens on. With `--host 192.168.1.20` alone, the panel is only on that address, and the server refuses the panel's own origin there. Run the CLI in the app's folder, so the source scanners read its `src/`.

## The one-time code on a device

The standalone CLI and the Express hub ask for a one-time code by default. When the app connects, it shows a dialog asking for the code, and the server prints the code in its terminal. Type the code in the app. The link the server prints next to it opens the server, not the app, so it doesn't help on a phone.

The app keeps the token it gets in the WebView's storage for that origin. It asks again when that storage is cleared, and under live reload over Wi-Fi when your machine's address changes, since the origin changes with it. The Vite plugin leaves the code off while it only allows your machine, so it never asks.

To skip the dialog, give the server a [pairing token](../security.md#pairing-tokens) and pass it to `initOverlay` as `authToken`. See [Skip the one-time code](../getting-started/overlay.md#skip-the-one-time-code). A wrong token falls back to the dialog.

## CapacitorHttp

With `plugins.CapacitorHttp.enabled`, Capacitor sends `fetch` through the native layer. The overlay then streams the hub's server-sent events through the browser's own fetch, which Capacitor keeps as `window.CapacitorWebFetch`. You don't change anything. WebSockets are not affected.

## Plugin calls

The **Capacitor** tab shows the app's plugins, its plugin calls with their arguments and outcome, and its listeners. Native calls show up once the overlay connects. To also log the calls the app makes at startup, and the calls a web implementation answers, load `@pangular-inspector/devtools/capacitor-hook` from the polyfills of your development configuration. See [Capacitor](../inspectors/capacitor.md#web-calls).

## Configuration keys

These keys are the same in Capacitor 6, 7 and 8. Keep the development ones out of release builds.

| Key                             | Default       | What it does here                                                             |
| ------------------------------- | ------------- | ----------------------------------------------------------------------------- |
| `server.url`                    | none          | Loads the app from a dev server. `npx cap run --live-reload` sets it.         |
| `server.cleartext`              | `false`       | Allows plain HTTP on Android. Development only.                               |
| `server.androidScheme`          | `'https'`     | The scheme of the bundled app on Android.                                     |
| `server.iosScheme`              | `'capacitor'` | The scheme of the bundled app on iOS. It can't be `http` or `https`.          |
| `android.allowMixedContent`     | `false`       | Lets an `https://localhost` page reach a plain HTTP server. Development only. |
| `plugins.CapacitorHttp.enabled` | `false`       | Sends `fetch` through the native layer. See [CapacitorHttp](#capacitorhttp).  |

## Troubleshooting

<ngmd-accordion>
  <ngmd-accordion-item title="The panel never shows the app" open>
    Inspect the WebView, with Safari's <strong>Develop</strong> menu for iOS or <code>chrome://inspect</code> for Android, and read the console. <code>[pangular] No devtools server found</code> in a bundled build means <code>connectionMeta</code> is missing. A <strong>Mixed Content</strong> message means <code>allowMixedContent</code> is off, and the overlay sends nothing. A failed connection to the address means the server is not running, listens only on <code>localhost</code>, or the address is wrong for where the app runs. A <code>403</code> under live reload over Wi-Fi means the page's origin is missing from <code>allowedOrigins</code>.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The code dialog keeps coming back">
    The app's origin changed, its storage was cleared, or the code expired before you typed it. Under live reload over Wi-Fi, another network address is another origin. Type the newest code the server printed.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Plugin calls are empty on the web">
    On the web, plugins don't use the native bridge, so only the Capacitor hook sees their calls, and only when it loads before <code>&#64;capacitor/core</code>. See <a href="../inspectors/capacitor.md#web-calls">Web calls</a>.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The overlay connects but stays empty">
    The app is a production build, which has no <code>ng</code> debug global. Build it with the development configuration.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Does it ship in a release build?">
    No. The dynamic import runs only while <code>ngDevMode</code> is on, so the overlay stays out of production bundles. The Android, iOS and server settings on this page are yours to keep out of release builds.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/overlay" title="Browser overlay"></ngmd-pill>
  <ngmd-pill href="/getting-started/cli" title="Standalone CLI"></ngmd-pill>
  <ngmd-pill href="/security" title="Access and redaction"></ngmd-pill>
</ngmd-pill-row>
