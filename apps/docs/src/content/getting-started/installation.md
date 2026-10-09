---
title: Installation
description: Install the devtools package and choose where it runs.
---

<ngmd-hero title="Installation" gradient>
  One package, two parts. A server part that hosts the devtools, and a browser part that sends live data from your page.
</ngmd-hero>

# Installation

The devtools ship as one npm package, `@pangular-inspector/devtools`. It contains the Node side, the browser overlay, the in-page popup, the CLI and the built UI.

## Prerequisites

<ngmd-card-grid columns="3">
  <ngmd-card icon="terminal" title="Node.js 22 or later">
    The package declares <code>node &gt;=22</code> in its <code>engines</code> field. CI tests Node.js 22 and 24.
  </ngmd-card>
  <ngmd-card icon="code" title="Angular 20 or later">
    <code>&#64;angular/core</code> and <code>&#64;angular/common</code> 20 and newer are supported, with no upper bound. See <a href="#tested-versions">Tested versions</a>.
  </ngmd-card>
  <ngmd-card icon="box" title="Package manager">
    pnpm, npm, yarn or bun. Any of the four.
  </ngmd-card>
</ngmd-card-grid>

<ngmd-callout type="warning" title="Development builds only">
  Live data comes from Angular's debug API (<code>window.ng</code>). Production builds remove it, so the live tabs stay empty there. Run your app in development mode while you inspect it.
</ngmd-callout>

### Tested versions

The peer range is `@angular/* >=20` with no upper bound. CI tests these versions:

| Angular                 | Node.js | What runs                                                                 | When                                  |
| ----------------------- | ------- | ------------------------------------------------------------------------- | ------------------------------------- |
| 20.0 (lowest supported) | 22      | The page-side tests against a real Angular app                            | Every push to `main`, and weekly      |
| 21 (latest 21.x)        | 22      | The page-side tests against a real Angular app                            | Every push to `main`, and weekly      |
| 22 (latest 22.x)        | 22      | The page-side tests, including Signal Forms                               | Every push to `main`, and weekly      |
| 22 (repository version) | 24      | Every package and panel test, the type checks and axe                     | Every pull request and push to `main` |
| Newest the ranges allow | 24      | A fresh Angular CLI app and a fresh Analog app with the package installed | Weekly                                |

Some features need a later Angular release than 20.0. The inspector pages list them, for example [abort and probe](../inspectors/router.md#abort-and-probe-need-angular-20-2) (20.2) and the live [signal graph](../inspectors/signals.md#debug-apis) (20.1). The Signal Forms tests run on Angular 22 and later, where Signal Forms are stable.

## Install the package

```bash group="install" name="pnpm" image="https://cdn.simpleicons.org/pnpm/F69220" active
pnpm add @pangular-inspector/devtools devframe
```

```bash group="install" name="npm" image="https://cdn.simpleicons.org/npm/CB3837"
npm install @pangular-inspector/devtools devframe
```

```bash group="install" name="yarn" image="https://cdn.simpleicons.org/yarn/2C8EBB"
yarn add @pangular-inspector/devtools devframe
```

```bash group="install" name="bun" image="https://bun.sh/logo.svg"
bun add @pangular-inspector/devtools devframe
```

MCP agent support (`@devframes/agentic`) is included. You don't install it separately.

### Entry points

| Import                                                | Use it for                                                                                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `@pangular-inspector/devtools/hub`                    | `initPangularHub()`, the server middleware for an Express app.                                       |
| `@pangular-inspector/devtools/vite`                   | The Vite plugin for Analog apps.                                                                     |
| `@pangular-inspector/devtools/overlay`                | The browser script that collects live data from your page.                                           |
| `@pangular-inspector/devtools/overlay-manual`         | The same overlay, started only when you call `initOverlay`. See [Capacitor](../guides/capacitor.md). |
| `@pangular-inspector/devtools/overlay-angular-native` | The overlay for an Angular Native app. See [Angular Native](./angular-native.md).                    |
| `@pangular-inspector/devtools/overlay-nativescript`   | The overlay for a NativeScript Angular app. See [NativeScript](./nativescript.md).                   |
| `@pangular-inspector/devtools/popup`                  | The floating button and panel on your page.                                                          |
| `@pangular-inspector/devtools/http`                   | The HTTP interceptor and hydration hooks for the SSR & HTTP tab.                                     |
| `@pangular-inspector/devtools/config`                 | The `PangularConfig` type and its defaults. See [Configuration](./configuration.md).                 |
| `@pangular-inspector/devtools/devframe`               | The devframe definition, for custom hosts.                                                           |

### The CLI binary

The package also installs a `pangular` binary. It runs the devtools without your app: a local server, a static report or an MCP server. See [Standalone CLI](./cli.md).

## Pick a setup

Every setup has two parts:

- **Server part**: serves the devtools UI and receives data.
- **Browser part**: the [overlay](./overlay.md). It runs in your page and sends live data to the server.

### Server part

Pick the tab that matches your app:

```ts group="setup" name="Angular CLI + Express" image="https://cdn.simpleicons.org/express/71717A" active
// src/server.ts
import express from 'express';
import {initPangularHub} from '@pangular-inspector/devtools/hub';

const app = express();
const devtools = initPangularHub({ws: false});
app.use(devtools.nodeMiddleware);
```

```ts group="setup" name="Analog (Vite)" image="https://cdn.simpleicons.org/vite/646CFF"
// vite.config.ts
import analog from '@analogjs/platform';
import pangular from '@pangular-inspector/devtools/vite';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [analog(), pangular()],
});
```

```bash group="setup" name="Standalone CLI" image="https://cdn.simpleicons.org/gnubash/4EAA25"
# Run from the root of your Angular workspace
npx @pangular-inspector/devtools
```

```json group="setup" name="Client-only Angular CLI" image="https://cdn.simpleicons.org/angular/DD0031"
// proxy.conf.json
{
  "/__pangular": {
    "target": "http://localhost:9999",
    "pathRewrite": {"^/__pangular": ""},
    "ws": true
  }
}
```

A client-only app (no SSR) has no server of its own to mount the devtools in. See [Client-only Angular CLI app](#client-only-angular-cli-app).

### Browser part

Load the overlay after bootstrap, in development only. The check depends on your build tool:

```ts group="overlay" name="Angular CLI" image="https://cdn.simpleicons.org/angular/DD0031" active
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

```ts group="overlay" name="Analog (Vite)" image="https://cdn.simpleicons.org/vite/646CFF"
// src/main.ts
import {bootstrapApplication} from '@angular/platform-browser';
import {App} from './app/app';
import {appConfig} from './app/app.config';

bootstrapApplication(App, appConfig).then(() => {
  if (import.meta.env.DEV) void import('@pangular-inspector/devtools/overlay');
});
```

The standalone CLI on its own has no page connected, so it needs no browser part. Behind the `ng serve` proxy of a client-only app it does, like any other setup.

### Client-only Angular CLI app

An app created with `ng new --ssr=false` only runs `ng serve`. Run the standalone CLI next to it, and let `ng serve` forward `/__pangular/` to the CLI. The overlay and the popup look for the devtools at `/__pangular/` on the page's own origin, so they find the CLI there.

<ngmd-workflow>
  <ngmd-step title="Start the devtools server">
    Run <code>npx pangular dev --port 9999</code> from the root of your workspace. It serves the panel, the connection and the WebSocket at the root of port 9999.
  </ngmd-step>
  <ngmd-step title="Add the proxy config">
    Save the <code>proxy.conf.json</code> above next to <code>angular.json</code>. It strips the <code>/__pangular</code> prefix, and <code>"ws": true</code> forwards the WebSocket the overlay and the panel connect over.
  </ngmd-step>
  <ngmd-step title="Point ng serve at it">
    Set <code>proxyConfig</code> in the <code>serve</code> options of <code>angular.json</code>, or run <code>ng serve --proxy-config proxy.conf.json</code>.
  </ngmd-step>
  <ngmd-step title="Load the overlay">
    Import the overlay in <code>main.ts</code>, as in the <strong>Angular CLI</strong> tab above.
  </ngmd-step>
  <ngmd-step title="Enter the one-time code">
    When your app connects, the CLI prints a code and a link like <code>http://localhost:9999/#devframe_otp=123456</code>. That link only trusts port 9999. Open the same code on your app's origin instead, <code>http://localhost:4200/__pangular/#devframe_otp=123456</code>. If the panel was already open, reload your app.
  </ngmd-step>
</ngmd-workflow>

```json
// angular.json (excerpt)
{
  "projects": {
    "my-app": {
      "architect": {
        "serve": {
          "builder": "@angular/build:dev-server",
          "options": {
            "proxyConfig": "proxy.conf.json"
          }
        }
      }
    }
  }
}
```

The full-page panel is at `/__pangular/` on your app's origin.

### Configure the devtools

Everything is on by default. To turn inspectors, agent tools or actions off, or to change redaction and limits, pass options to the server part. See [Configuration](./configuration.md).

### Add the Chrome extension

The [Chrome extension](./chrome-extension.md) adds a panel to Chrome DevTools. It sits on top of the Express or Vite setup. It does not replace the server part or the overlay.

## Check that it works

<ngmd-workflow>
  <ngmd-step title="Start your app in development mode">
    Run <code>ng serve</code> for an Angular CLI app, or the Vite dev server for an Analog app.
  </ngmd-step>
  <ngmd-step title="Look for the button">
    An amber button appears in the bottom-right corner of the page. The overlay adds it.
  </ngmd-step>
  <ngmd-step title="Open the panel">
    Click the button. The header shows <strong>Live</strong> once the panel is connected.
  </ngmd-step>
  <ngmd-step title="Open the full-page viewer">
    Go to <code>/__devframes/</code> on the same server to see the devtools on their own page.
  </ngmd-step>
</ngmd-workflow>

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Why install devframe next to the package?" open>
    The devtools are built on Devframe. Some setups import from <code>devframe</code> directly, for example <code>initDevframe</code> from <code>devframe/initiate</code> to <a href="./express.md#mount-only-the-panel">mount only the panel</a>. Package managers like pnpm only resolve imports of direct dependencies.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="Where does the package need to be installed?">
    Wherever your server part runs. An Express app imports the hub in <code>server.ts</code>, so the package must be installed where that server starts. The overlay import in <code>main.ts</code> only runs in development builds.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The button does not appear">
    Check that the app runs as a development build and that <code>main.ts</code> imports the overlay. A production build skips the import, so there is no button.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/express" title="Angular CLI and Express"></ngmd-pill>
  <ngmd-pill href="/getting-started/vite" title="Vite and Analog"></ngmd-pill>
  <ngmd-pill href="/getting-started/cli" title="Standalone CLI"></ngmd-pill>
  <ngmd-pill href="/getting-started/overlay" title="Browser overlay"></ngmd-pill>
  <ngmd-pill href="/getting-started/configuration" title="Configuration"></ngmd-pill>
</ngmd-pill-row>
