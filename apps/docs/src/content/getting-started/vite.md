---
title: Vite and Analog
description: Add the devtools Vite plugin to an Analog app or another Vite-based Angular app. It mounts the hub and loads the overlay.
---

<ngmd-hero title="Vite and Analog" logo="/logos/vite-mark.svg" gradient>
  One plugin next to <code>analog()</code>. It mounts the hub on the Vite dev server and loads the overlay into your pages.
</ngmd-hero>

# Vite and Analog

For *Analog apps, add the *Vite plugin next to `analog()`. The plugin mounts the devtools hub on the Vite dev server and adds the overlay to the pages it serves, so there is nothing to import in `main.ts`. It works the same in any Angular app built with its own `vite.config.ts`, not only in Analog. If you serve your app with `ng serve`, this plugin does not apply, because the Angular CLI dev server does not accept Vite plugins. See [Angular CLI apps](#angular-cli-apps).

## Setup at a glance

<ngmd-workflow>
  <ngmd-step title="Install the package">
    Add <code>&#64;pangular-inspector/devtools</code> as a dev dependency. See <a href="./installation.md">Installation</a>.
  </ngmd-step>
  <ngmd-step title="Add the plugin">
    Register <code>pangular()</code> after <code>analog()</code> in <code>vite.config.ts</code>.
  </ngmd-step>
  <ngmd-step title="Open the devtools">
    Start the dev server and click the amber button, or open <code>/__devframes/</code>.
  </ngmd-step>
</ngmd-workflow>

## Add the plugin

### Register it in `vite.config.ts`

```ts {3,7}
// vite.config.ts
import analog from '@analogjs/platform';
import pangular from '@pangular-inspector/devtools/vite';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [analog(), pangular()],
});
```

### The overlay loads itself

The plugin adds a module script to every HTML page the dev server transforms, at the end of `<body>`. The script imports `@pangular-inspector/devtools/overlay`, which adds the floating button, and starts the overlay with the hub's path (`/__devframes/pangular/` by default), so the overlay connects there without trying the other default paths first. `vite build` skips the plugin, so the overlay stays out of your production bundle. See [Load the overlay yourself](#load-the-overlay-yourself) to turn it off.

### Where to find it

| What              | Where                                  |
| ----------------- | -------------------------------------- |
| Floating button   | Bottom-right corner of your page       |
| Full-page viewer  | `/__devframes/` on the Vite dev server |
| HTTP MCP endpoint | `/__devframes/__mcp`                   |

When the dev server starts, Vite prints the full-page viewer URL under its own URLs, on a line labeled `Pangular Inspector`.

## What the plugin does

### Dev server only

The plugin applies to `vite serve` only. `vite build` is not affected, so nothing from the plugin reaches your production output.

### Loads the overlay

It adds the overlay to the HTML that Vite transforms, including the template an Analog SSR render starts from. It works under a Vite `base`. A page whose HTML already imports `@pangular-inspector/devtools/overlay` gets no second script.

An app that still imports the overlay in `main.ts` gets one overlay, not two: Vite resolves both imports to the same module, and starting the overlay with the hub's path replaces any overlay that is already running.

### Mounts the hub

It mounts the devtools hub on the Vite dev server. The WebSocket shares the dev server's port, over HTTP or HTTPS (`server.https` or `@vitejs/plugin-basic-ssl`). In middleware mode, where Vite has no server of its own, the WebSocket runs on its own port.

The hub keeps working after a dev server restart, for example after a config or `.env` change.

### Records Analog server activity

It records Analog page renders, `load()` fetches, server functions and API calls for the [Analog inspector](../inspectors/analog.md). The `apiPrefix` option tells it which requests are API calls.

### Answers only your machine

The plugin only answers requests from a loopback address (any `127.x.x.x` address or `::1`) that were sent to a loopback host, or to a host in `server.allowedHosts` or `allowedOrigins`. Other requests to the devtools get `403` with the message "Pangular Inspector only answers requests from this machine." A request from another machine also gets the fix: set `allowLan: true` and list its origin in `allowedOrigins`. WebSocket upgrades follow the same rules.

The plugin also asks for the one-time code, and the HTTP MCP endpoint for a token, unless you pass `auth: false`. See [`auth`](#auth). [Access and redaction](../security.md) covers every check.

## Options

```ts
// vite.config.ts
pangular({
  base: '/__devframes/',
  apiPrefix: 'api',
  allowedOrigins: ['https://tunnel.example'],
});
```

| Option           | Default                          | What it does                                                                       |
| ---------------- | -------------------------------- | ---------------------------------------------------------------------------------- |
| `base`           | `'/__devframes/'`                | Where the hub is mounted.                                                          |
| `apiPrefix`      | Analog's `apiPrefix`, or `'api'` | The prefix of your server routes, used to classify API calls.                      |
| `allowedOrigins` | none                             | Extra exact origins allowed to reach the devtools, for example a tunnel.           |
| `auth`           | on                               | Whether the devtools ask for the one-time code, and its pairing tokens.            |
| `allowLan`       | `false`                          | Answer other machines, such as a phone on Wi-Fi, from listed origins.              |
| `overlay`        | `true`                           | Add the overlay to the pages the dev server serves.                                |
| `terminals`      | `false`                          | Add a dock that runs the build and test commands. See [Terminals](./terminals.md). |

The plugin also takes the devtools options, such as `inspectors`, `agent`, `actions`, `redaction` and `limits`. See [Configuration](./configuration.md).

### `base`

Change `base` if `/__devframes/` clashes with a route of your own. The leading and trailing slashes are optional: `'devtools'`, `'/devtools'` and `'/devtools/'` all mount the hub at `/devtools/`, and the loopback checks cover the whole path. The overlay the plugin adds connects to `<base>pangular/` on its own, and the floating button follows that path. If you load the overlay yourself, pass `<base>pangular/` to `initOverlay`. See [A custom mount path](./overlay.md#a-custom-mount-path).

### `apiPrefix`

The plugin reads `apiPrefix` from your Analog config. Set it here only when the detection is wrong.

### `allowedOrigins`

Each entry is an origin, such as `https://tunnel.example` or `chrome-extension://<id>`. The request itself must still come from a loopback address. The plugin trusts the [Chrome extension](./chrome-extension.md#server-origin) by its fixed ID with no entry, and refuses every other extension that is not listed. Add an entry only for a build of the extension with another ID. A Capacitor app on iOS sends `capacitor://localhost`, which works as an entry too. See [Capacitor](../guides/capacitor.md).

The plugin reads each entry the way a browser sends an origin: it drops a path or a trailing slash and lowercases the host, so `'https://Tunnel.example/app/'` allows `https://tunnel.example`. It prints a warning in the terminal when it changes an entry, and it ignores an entry that is not a URL, such as `'tunnel.example'`. The first request from each origin that the check refuses also prints a warning that names the origin.

### `auth`

The plugin asks for the one-time code by default. The server prints the code in the terminal, and a browser reads data only after it exchanges that code. A tunnel forwards other people's requests to your machine, and those requests arrive from a loopback address, so the loopback check alone does not keep them out.

| Value             | Effect                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| not set, `true`   | The code is on.                                                                                              |
| `false`           | The code is always off. The loopback and origin checks still apply.                                          |
| `{tokens: [...]}` | The code is on, and a client that sends one of the [pairing tokens](../security.md#pairing-tokens) skips it. |

While the code is on, the HTTP MCP endpoint also asks for a bearer token, which the server writes to a file only you can read. See [Send a token](../agents/mcp-server.md#send-a-token).

To turn the code and the MCP token off on a machine only you use, pass `auth: false`. The loopback, `Host` and origin checks still apply. Keep the code on whenever a tunnel or another device can reach the dev server:

```ts
// vite.config.ts
pangular({auth: false});
```

### `overlay`

Pass `overlay: false` when you start the overlay yourself, for example to give `initOverlay` a pairing token. See [Load the overlay yourself](#load-the-overlay-yourself).

## Load the overlay yourself

Turn the injected script off in `vite.config.ts`:

```ts
// vite.config.ts
pangular({overlay: false});
```

Then import the overlay in `main.ts`, in development only:

```ts {7}
// src/main.ts
import {bootstrapApplication} from '@angular/platform-browser';
import {App} from './app/app';
import {appConfig} from './app/app.config';

bootstrapApplication(App, appConfig).then(() => {
  if (import.meta.env.DEV) void import('@pangular-inspector/devtools/overlay');
});
```

`import.meta.env.DEV` is false in `vite build`, so the import stays out of your production bundle. Use the same import when your framework renders HTML without passing it through Vite's `transformIndexHtml`, which is where the plugin adds the script.

## Hostnames other than localhost

### Local hostnames

If you open the dev server through another hostname that points to your machine (for example `myapp.test`), list it in Vite's `server.allowedHosts`. The devtools trust it too.

```ts {7}
// vite.config.ts
import analog from '@analogjs/platform';
import pangular from '@pangular-inspector/devtools/vite';
import {defineConfig} from 'vite';

export default defineConfig({
  server: {allowedHosts: ['myapp.test']},
  plugins: [analog(), pangular()],
});
```

### Tunnels and other origins

Add other origins with `allowedOrigins`:

```ts
// vite.config.ts
pangular({allowedOrigins: ['https://tunnel.example']});
```

Keep the one-time code on while a tunnel is allowed. See [`auth`](#auth).

### Other devices on your network

The plugin answers only your machine. To reach the devtools from a phone on Wi-Fi, for example a [Capacitor](../guides/capacitor.md) app under live reload, set `allowLan` and list the page's origin:

```ts
// vite.config.ts
pangular({allowLan: true, allowedOrigins: ['http://192.168.1.20:5173']});
```

Start Vite on every interface too, with `server.host: true`. A request from another machine then passes only when its origin is in `allowedOrigins`. A same-origin request without an `Origin` header passes when the `Host` it was sent to is listed. The one-time code stays on: with `auth: false`, the plugin ignores `allowLan` and prints a warning.

<ngmd-alert severity="warning" label="Your network can reach the devtools">
  With <code>allowLan</code>, any device on the network can send requests that claim a listed origin. Only the one-time code, or a pairing token, keeps it from reading your app's data. Use it on a trusted network, and turn it off when you're done.
</ngmd-alert>

## Angular CLI apps

<ngmd-alert severity="important">
  The Angular CLI dev server does not accept Vite plugins. For an Angular CLI app, mount the hub in your Express server instead. See <a href="./express.md">Angular CLI and Express</a>.
</ngmd-alert>

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Does the plugin change my production build?" open>
    No. It applies to the dev server only, so the overlay script it adds is not part of a build.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why do I get a 403 from the devtools?">
    The request did not come from your machine, or its origin or the host it was sent to is not trusted. The terminal names a refused origin or host. Open the app on <code>localhost</code>, list your hostname in <code>server.allowedHosts</code>, or add the origin to <code>allowedOrigins</code>.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why does vite build fail with an h3 error under pnpm?">
    <code>&#64;analogjs/vite-plugin-nitro</code> imports <code>h3</code> without declaring it, so pnpm can resolve it to the <code>h3</code> 2 that this package brings instead of the <code>h3</code> 1 Analog needs. The build stops with <code>The requested module 'h3' does not provide an export named 'createEvent'</code>. Declare <code>h3</code> for the plugin with <code>packageExtensions</code>, as <a href="../guides/analog.md#if-the-build-fails-under-pnpm">Set up Analog</a> shows.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The Analog tab shows no server calls">
    The plugin records server calls made through the Vite dev server. Check that the plugin is registered and that <code>apiPrefix</code> matches your server routes. The <a href="../guides/analog.md">Analog guide</a> walks through a full setup.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-card-grid columns="2">
  <ngmd-card icon="rocket" title="Set up Analog" link="/guides/analog" cta="Read the guide">
    A full Analog setup, including the demo in this repository.
  </ngmd-card>
  <ngmd-card icon="layers" title="Analog inspector" link="/inspectors/analog" cta="Inspector">
    File routes, server calls, render modes, content and lint.
  </ngmd-card>
  <ngmd-card icon="zap" title="Browser overlay" link="/getting-started/overlay" cta="How it connects">
    What the overlay sends, and how it finds the server.
  </ngmd-card>
  <ngmd-card icon="shield" title="Access and redaction" link="/security" cta="Security">
    The loopback check and the origin rules in detail.
  </ngmd-card>
</ngmd-card-grid>
