---
title: Angular CLI and Express
description: Mount the devtools hub in the Express server of an Angular SSR app.
---

<ngmd-hero title="Angular CLI and Express" logo="https://cdn.simpleicons.org/express/71717A" gradient>
  Mount the devtools hub in your <code>server.ts</code>, load the overlay in <code>main.ts</code>, and open the panel from a button on your page.
</ngmd-hero>

# Angular CLI and Express

In an *Angular app with server-side rendering, the devtools run inside your Express server. You add a middleware on the server and load the overlay in the browser.

<ngmd-callout type="info" title="You need an SSR app">
  This setup mounts the devtools in the Express <code>server.ts</code> that Angular SSR generates. For an Analog app, follow <a href="./vite.md">Vite and Analog</a> instead. For a server on Hono, h3 or Fastify, follow <a href="./other-servers.md">Hono, h3 and Fastify</a>.
</ngmd-callout>

## Setup at a glance

<ngmd-workflow>
  <ngmd-step title="Install the package">
    Add <code>&#64;pangular-inspector/devtools</code> as a dependency, because <code>server.ts</code> imports it. See <a href="./installation.md#dependency-or-dev-dependency">Installation</a>.
  </ngmd-step>
  <ngmd-step title="Mount the hub">
    Add <code>initPangularHub()</code> to <code>server.ts</code>, before your other routes.
  </ngmd-step>
  <ngmd-step title="Load the overlay">
    Import the overlay in <code>main.ts</code>, in development only.
  </ngmd-step>
  <ngmd-step title="Open the devtools">
    Start the app in development mode and click the Pangular Inspector button in the corner of the page.
  </ngmd-step>
</ngmd-workflow>

## Mount the hub

### Add the middleware

```ts {3,6-7}
// src/server.ts
import express from 'express';
import {initPangularHub} from '@pangular-inspector/devtools/hub';

const app = express();
const devtools = initPangularHub({ws: false});
app.use(devtools.nodeMiddleware);
```

The full-page viewer is at `http://localhost:4000/__devframes/`. The hub is built on [`@devframes/hub`](https://github.com/devframes/devframe), so other devframe tools can join the same dock.

The Angular CLI bundles `server.ts`, but not the hub. `initPangularHub()` loads the hub's server code from `node_modules/@pangular-inspector/devtools` when it starts, so the hub and its dependencies resolve from the package as they do under Vite, with any package manager. This needs Node.js 22.12 or later. When the hub is off, as in production, nothing is loaded.

### Middleware order

Mount the middleware before `express.static` and the Angular SSR handler, so the devtools routes answer first.

```ts
// src/server.ts
const app = express();
const devtools = initPangularHub({ws: false});
app.use(devtools.nodeMiddleware); // devtools first

app.use(express.static(browserDistFolder, {index: false}));
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});
```

The middleware only handles requests under its base path (`/__devframes/` by default). Everything else goes to the next handler.

### Pick a transport

The browser talks to the hub over server-sent events or a WebSocket. Pick one with the `ws` option:

```ts group="transport" name="Server-sent events" active
// src/server.ts
const devtools = initPangularHub({ws: false});
```

```ts group="transport" name="WebSocket side-car"
// src/server.ts
const devtools = initPangularHub({ws: {sidecar: true}});
```

With `ws: false` there is no WebSocket, and the browser connects over SSE on the same port. It is the simplest choice: every request goes through your Express server, including under `ng serve`.

With `ws: {sidecar: true}`, the WebSocket runs on its own port, picked automatically.

### Rebuilds under `ng serve`

`ng serve` runs `server.ts` again after a rebuild that changes the server output. The process keeps one hub per `base`, so each new `initPangularHub()` call closes the hub from the run before, along with its side-car port. The MCP token stays the same: the hub keeps it in a file. See [Send a token](../agents/mcp-server.md#send-a-token).

### Hub options

`initPangularHub()` accepts the options of `initHub()` from `@devframes/hub`, apart from `devframes` and `ui`. These are the ones you are most likely to set:

| Option           | Default                                   | What it does                                                                                                                                                                                                                        |
| ---------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base`           | `'/__devframes/'`                         | Where the hub is mounted. The devtools panel lives at `<base>pangular/`.                                                                                                                                                            |
| `ws`             |                                           | `false` uses server-sent events only. `{ sidecar: true }` runs the WebSocket on its own port.                                                                                                                                       |
| `enabled`        | on unless `NODE_ENV` is `production`      | `false` mounts nothing: the middlewares only call `next()`. `true` mounts the hub in production too, with a warning. See [Production](#production).                                                                                 |
| `auth`           | on                                        | `false` turns off the one-time code. `{tokens: [...]}` keeps it on and trusts clients that send one of the [pairing tokens](../security.md#pairing-tokens).                                                                         |
| `allowedOrigins` | loopback origins and the Chrome extension | Extra origins allowed to reach the hub, such as a tunnel. `false` turns the origin check and the request gate off.                                                                                                                  |
| `allowLan`       | `false`                                   | Answer other machines, such as a phone on Wi-Fi. Needs the one-time code on.                                                                                                                                                        |
| `terminals`      | `false`                                   | Add a dock that runs the project's build and test commands. See [Terminals](./terminals.md).                                                                                                                                        |
| `mcp`            | a bearer token                            | Mounts the MCP endpoint at `<base>__mcp` and asks for a bearer token. With `auth: false` the default is `'auto'`: it mounts once agent tools exist and asks for no token. See [Send a token](../agents/mcp-server.md#send-a-token). |

The hub also takes the devtools options, such as `inspectors`, `agent`, `actions`, `redaction` and `limits`. See [Configuration](./configuration.md). Pass `browserDistFolder`, the folder that holds `index.csr.html`, to let the **Force Client render** override serve it. See [SSR overrides](../inspectors/ssr-http.md#ssr-overrides).

### Access control

The hub answers only requests from this machine, sent to a loopback `Host` such as `localhost:4000`, the same gate as the [Vite plugin](./vite.md#answers-only-your-machine). Other requests to the hub get `403`. Pass `allowLan: true` to also answer other machines, such as a [Capacitor](../guides/capacitor.md) app on Wi-Fi.

The hub protects its connection with a one-time code by default. The server prints the code, and a browser can read data only after it exchanges that code. On a machine only you use, pass `auth: false` to turn the code off.

The origin check is on by default too. Only loopback origins and the [Chrome extension](./chrome-extension.md#server-origin), `chrome-extension://dcogniffeelebaolkkfbopmjcblhblfk`, can open the WebSocket. A list in `allowedOrigins` keeps both and adds its entries. A custom origin registry passed as `allowedOrigins` still accepts the published extension. `allowedOrigins: false` turns the check off and prints a warning once. A build of the extension with another ID needs its own entry, with the ID from `chrome://extensions`:

```ts
// src/server.ts
import {initPangularHub} from '@pangular-inspector/devtools/hub';

const devtools = initPangularHub({
  allowedOrigins: ['https://tunnel.example', 'chrome-extension://<id>'],
});
```

[Access and redaction](../security.md) covers both checks.

The demo app in this repository mounts the hub like this:

```ts
// src/server.ts
const auth = process.env['PANGULAR_AUTH'] === 'true';
const devtools = initPangularHub({
  ws: {sidecar: true},
  auth,
});
if (devtools.enabled) {
  app.use(devtools.nodeMiddleware);
  app.use(devtools.ssrMiddleware);
}
```

It turns the one-time code off unless `PANGULAR_AUTH` is `true`. Don't copy that setting. Keep the one-time code on for your own apps. The demo keeps the default origin check.

### Production

The hub is off when `NODE_ENV` is `production`. `initPangularHub()` then mounts nothing: `nodeMiddleware` and `ssrMiddleware` only call `next()`, and `devtools.enabled` is `false`. Check `enabled` to skip the `app.use()` calls, as the demo does.

Pass `enabled: true` to mount the hub in production anyway, for example on a staging server only you can reach. The hub prints a warning when it starts. Pass `enabled: false` to keep it off in any environment.

<ngmd-alert severity="warning">
  The switch reads <code>NODE_ENV</code> when <code>initPangularHub()</code> runs. If your production server does not set <code>NODE_ENV=production</code>, the hub stays on. Set it, or pass <code>enabled</code> yourself.
</ngmd-alert>

## Load the overlay

### Import it in development

The [overlay](./overlay.md) collects live data from the page. Import it after bootstrap, in development only:

```ts {8-10}
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

`ngDevMode` is false in production builds, so the import never runs there and the overlay stays out of your production bundle.

### The dock entries

A floating button appears on your page. It opens the devtools with one dock entry per tool:

| Dock entry     | Shows                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Angular        | Dashboard, components, routes, signals, injectors, forms, pipes, and SSR & HTTP                                            |
| NgRx           | Store patterns from source, and live state and actions                                                                     |
| Analog         | File routes, server calls, render modes and lint (a notice in non-Analog apps)                                             |
| Angular Native | Components, signals, injectors, stores, queries, pipes and errors of a connected [Angular Native](./angular-native.md) app |
| NativeScript   | Setup steps for [NativeScript apps](../guides/nativescript.md)                                                             |
| Capacitor      | Plugin calls of a connected [Capacitor app](../inspectors/capacitor.md), or setup steps when none is connected             |

[Popup and hub](./popup-and-hub.md) covers the panel, its dock modes and deep links.

## Run the app

### With the dev server

When you run `ng serve`, the Angular dev server runs `server.ts` too, so the hub answers on port 4200 as well.

```bash group="run" name="ng serve" image="https://cdn.simpleicons.org/angular/DD0031" active
ng serve
# open http://localhost:4200 and click the Pangular Inspector button
```

```bash group="run" name="SSR server" image="https://cdn.simpleicons.org/nodedotjs/5FA04E"
ng build --configuration development
NG_ALLOWED_HOSTS=localhost node dist/<your-app>/server/server.mjs
# open http://localhost:4000 and click the Pangular Inspector button
```

### With the built SSR server

To test the real Express process, build with the development configuration and start `server.mjs`. Replace `<your-app>` with your project name.

From Angular 22.2, the built server answers only the hosts in its allowed list, which a new app leaves empty, so every page returns an error. Name the host in the `NG_ALLOWED_HOSTS` environment variable, as above, or in `security.allowedHosts` under the build options in `angular.json`:

```json
// angular.json (projects.<your-app>.architect.build.options)
"security": {
  "allowedHosts": ["localhost"]
}
```

<ngmd-callout type="danger" title="A plain build has no button">
  <code>ng build</code> uses the production configuration by default. <code>ngDevMode</code> is false there, so the overlay is never imported and the button never appears. The live tabs need <code>--configuration development</code>. In this repository, the same applies to <code>pnpm build</code>.
</ngmd-callout>

## Fill the SSR & HTTP tab

### Add the providers

To fill the SSR & HTTP tab, add the interceptor and hydration hooks to your app config:

```ts {5,10-11}
// src/app/app.config.ts
import {provideHttpClient, withFetch} from '@angular/common/http';
import {ApplicationConfig} from '@angular/core';
import {provideClientHydration} from '@angular/platform-browser';
import {providePangularHttp, withPangular} from '@pangular-inspector/devtools/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(),
    provideHttpClient(withFetch(), withPangular()),
    providePangularHttp(),
  ],
};
```

`withPangular()` records requests and applies fault rules. `providePangularHttp()` captures hydration warnings before the overlay loads. In production builds the interceptor passes requests through untouched.

### Put `withPangular` first

Register `withPangular()` before your own interceptors, for example `provideHttpClient(withPangular(), withInterceptors([authInterceptor]))`. It then records requests as the app makes them, and fault rules apply before anything else.

### Trace each server render

To fill the **SSR requests** table, add the hub's `ssrMiddleware` after the hub middleware and before the Angular handler:

```ts {4}
// src/server.ts
const devtools = initPangularHub({ws: false});
app.use(devtools.nodeMiddleware);
app.use(devtools.ssrMiddleware);
```

It is optional. It also adds a `Server-Timing` header to each traced response. If the server uses `compression()`, mount `ssrMiddleware` after it. See [SSR & HTTP](../inspectors/ssr-http.md).

### Run SSR in the same process

SSR and the devtools middleware must run in the same Express process. Otherwise the server-side calls never reach the tab.

The [SSR & HTTP guide](../guides/ssr-http.md) covers interceptor order and fault injection in detail.

## Mount only the panel

To mount only the devtools panel without the dock, use `initDevframe()`. The devframe entry point re-exports it from the Devframe copy the package depends on:

```ts
// src/server.ts
import pangular, {initDevframe} from '@pangular-inspector/devtools/devframe';

const devtools = initDevframe(pangular, {base: '/__pangular/'});
app.use(devtools.nodeMiddleware);
```

The overlay looks for `/__pangular/` too. Without the hub, every tab sits in one tab bar.

## Troubleshooting

<ngmd-accordion>
  <ngmd-accordion-item title="The button does not appear" open>
    The app is probably a production build. Run <code>ng serve</code>, or build with <code>--configuration development</code>. Then check that <code>main.ts</code> imports the overlay.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The panel says No devtools server found">
    The page could not reach the hub. Check that the hub middleware is mounted before <code>express.static</code> and the SSR handler, and that <code>base</code> matches the path the overlay uses. See <a href="./overlay.md#no-devtools-server-found">No devtools server found</a>.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The panel says Disconnected">
    Check that the server is running and that the hub middleware is mounted before <code>express.static</code> and the SSR handler. The panel keeps trying to connect; click <strong>Retry now</strong> to try at once.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The hub answers 403">
    The request did not come from this machine, was sent to a host other than a loopback host, or came from an origin the hub does not trust. The terminal names a refused origin or host. Open the app on <code>localhost</code>, add the origin to <code>allowedOrigins</code>, or pass <code>allowLan: true</code> for another device.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The panel connects but shows no data">
    With <code>auth</code> on, a browser reads data only after it exchanges the one-time code the server printed. On a machine only you use, pass <code>auth: false</code>.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The SSR & HTTP tab shows no server calls">
    Add <code>withPangular()</code> and <code>providePangularHttp()</code>, and run SSR in the same Express process as the hub. Prerendered routes make no requests at runtime.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-card-grid columns="2">
  <ngmd-card icon="zap" title="Browser overlay" link="/getting-started/overlay" cta="How it connects">
    What the overlay sends, and how to point it at a custom mount path.
  </ngmd-card>
  <ngmd-card icon="layers" title="Popup and hub" link="/getting-started/popup-and-hub" cta="Use the panel">
    Dock modes, the hub rail, deep links and connection status.
  </ngmd-card>
  <ngmd-card icon="search" title="SSR & HTTP guide" link="/guides/ssr-http" cta="Set it up">
    Interceptor order, fault rules and hydration warnings.
  </ngmd-card>
  <ngmd-card icon="shield" title="Access and redaction" link="/security" cta="Security">
    Who can reach the hub, and what is redacted.
  </ngmd-card>
</ngmd-card-grid>
