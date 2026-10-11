---
title: Vite and Analog
description: Add the devtools Vite plugin to an Analog app or another Vite-based Angular app.
---

<ngmd-hero title="Vite and Analog" logo="/logos/vite-mark.svg" gradient>
  One plugin next to <code>analog()</code>, one import in <code>main.ts</code>. The hub mounts on the Vite dev server.
</ngmd-hero>

# Vite and Analog

For *Analog apps, add the *Vite plugin next to `analog()` and load the overlay in `main.ts`. The plugin mounts the devtools hub on the Vite dev server. It works the same in any Angular app built with its own `vite.config.ts`, not only in Analog. If you serve your app with `ng serve`, this plugin does not apply, because the Angular CLI dev server does not accept Vite plugins. See [Angular CLI apps](#angular-cli-apps).

## Setup at a glance

<ngmd-workflow>
  <ngmd-step title="Install the package">
    Add <code>&#64;pangular-inspector/devtools</code> as a dev dependency. See <a href="./installation.md">Installation</a>.
  </ngmd-step>
  <ngmd-step title="Add the plugin">
    Register <code>pangular()</code> after <code>analog()</code> in <code>vite.config.ts</code>.
  </ngmd-step>
  <ngmd-step title="Load the overlay">
    Import the overlay in <code>src/main.ts</code> when <code>import.meta.env.DEV</code> is true.
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

### Load the overlay

The plugin does not inject the overlay. Your app imports it in `main.ts`:

```ts {7}
// src/main.ts
import {bootstrapApplication} from '@angular/platform-browser';
import {App} from './app/app';
import {appConfig} from './app/app.config';

bootstrapApplication(App, appConfig).then(() => {
  if (import.meta.env.DEV) void import('@pangular-inspector/devtools/overlay');
});
```

`import.meta.env.DEV` is false in `vite build`, so the overlay stays out of your production bundle.

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

### Mounts the hub

It mounts the devtools hub on the Vite dev server. The WebSocket shares the dev server's port, over HTTP or HTTPS (`server.https` or `@vitejs/plugin-basic-ssl`). In middleware mode, where Vite has no server of its own, the WebSocket runs on its own port.

The hub keeps working after a dev server restart, for example after a config or `.env` change.

### Records Analog server activity

It records Analog page renders, `load()` fetches, server functions and API calls for the [Analog inspector](../inspectors/analog.md). The `apiPrefix` option tells it which requests are API calls.

### Answers only your machine

The plugin only answers requests from a loopback address (any `127.x.x.x` address or `::1`). Other requests to the devtools get `403` with the message "Pangular Inspector only answers requests from this machine." A request from another machine also gets the fix: set `allowLan: true` and list its origin in `allowedOrigins`. WebSocket upgrades follow the same rules.

By default the plugin leaves the one-time code off, and the loopback and origin checks take its place. If `server.allowedHosts` or `allowedOrigins` allows a host that is not a loopback host, the plugin also asks for the code. See [`auth`](#auth). [Access and redaction](../security.md) covers every check.

## Options

```ts
// vite.config.ts
pangular({
  base: '/__devframes/',
  apiPrefix: 'api',
  allowedOrigins: ['https://tunnel.example'],
});
```

| Option           | Default                                                       | What it does                                                             |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `base`           | `'/__devframes/'`                                             | Where the hub is mounted.                                                |
| `apiPrefix`      | Analog's `apiPrefix`, or `'api'`                              | The prefix of your server routes, used to classify API calls.            |
| `allowedOrigins` | none                                                          | Extra exact origins allowed to reach the devtools, for example a tunnel. |
| `auth`           | on if a non-loopback host or origin is allowed, otherwise off | Whether the devtools ask for the one-time code, and its pairing tokens.  |
| `allowLan`       | `false`                                                       | Answer other machines, such as a phone on Wi-Fi, from listed origins.    |

The plugin also takes the devtools options, such as `inspectors`, `agent`, `actions`, `redaction` and `limits`. See [Configuration](./configuration.md).

### `base`

Change `base` if `/__devframes/` clashes with a route of your own. The leading and trailing slashes are optional: `'devtools'`, `'/devtools'` and `'/devtools/'` all mount the hub at `/devtools/`, and the loopback checks cover the whole path. The overlay looks for `/__devframes/pangular/` and `/__pangular/` by default, so a custom base also needs a custom overlay path: pass `<base>pangular/` to `initOverlay`. The floating button follows that path. See [A custom mount path](./overlay.md#a-custom-mount-path).

### `apiPrefix`

The plugin reads `apiPrefix` from your Analog config. Set it here only when the detection is wrong.

### `allowedOrigins`

Each entry is an origin, such as `https://tunnel.example` or `chrome-extension://<id>`. The request itself must still come from a loopback address. The plugin trusts the [Chrome extension](./chrome-extension.md#server-origin) by its fixed ID with no entry, and refuses every other extension that is not listed. Add an entry only for a build of the extension with another ID. An extension entry does not turn the one-time code on. A Capacitor app on iOS sends `capacitor://localhost`, which works as an entry too and turns the one-time code on. See [Capacitor](../guides/capacitor.md).

The plugin reads each entry the way a browser sends an origin: it drops a path or a trailing slash and lowercases the host, so `'https://Tunnel.example/app/'` allows `https://tunnel.example`. It prints a warning in the terminal when it changes an entry, and it ignores an entry that is not a URL, such as `'tunnel.example'`. The first request from each origin that the check refuses also prints a warning that names the origin.

### `auth`

A tunnel forwards other people's requests to your machine, and those requests arrive from a loopback address. So the plugin turns the one-time code on when Vite's `server.allowedHosts` or `allowedOrigins` allows anything other than `localhost` or a loopback address (`allowedHosts: true` counts too). The server prints the code in the terminal, and a browser reads data only after it exchanges that code.

| Value             | Effect                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| not set           | The code is on only if a non-loopback host or origin is allowed.                                             |
| `true`            | The code is always on.                                                                                       |
| `false`           | The code is always off. The loopback and origin checks still apply.                                          |
| `{tokens: [...]}` | The code is on, and a client that sends one of the [pairing tokens](../security.md#pairing-tokens) skips it. |

While the code is on, the HTTP MCP endpoint also asks for a bearer token. See [Send a token](../agents/mcp-server.md#send-a-token).

If your tunnel rewrites the `Host` header to `localhost`, you don't list it in `server.allowedHosts`, so the plugin leaves the code off. Pass `auth: true`:

```ts
// vite.config.ts
pangular({auth: true});
```

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

A non-loopback entry in `server.allowedHosts` or `allowedOrigins` turns the one-time code on. See [`auth`](#auth).

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
    No. It applies to the dev server only, and the overlay import is guarded by <code>import.meta.env.DEV</code>.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Why do I get a 403 from the devtools?">
    The request did not come from your machine, or its origin is not trusted. The terminal names a refused origin. Open the app on <code>localhost</code>, list your hostname in <code>server.allowedHosts</code>, or add the origin to <code>allowedOrigins</code>.
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
