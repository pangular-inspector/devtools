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
  <ngmd-card icon="code" title="Angular 12.2 or later">
    <code>&#64;angular/core</code> and <code>&#64;angular/common</code> 12.2 and newer are supported, with no upper bound. Older versions show less data. See <a href="#supported-angular-versions">Supported Angular versions</a>.
  </ngmd-card>
  <ngmd-card icon="box" title="Package manager">
    pnpm, npm, yarn or bun. Any of the four.
  </ngmd-card>
</ngmd-card-grid>

<ngmd-callout type="warning" title="Development builds only">
  Live data comes from Angular's debug API (<code>window.ng</code>). Production builds remove it, so the live tabs stay empty there. Run your app in development mode while you inspect it.
</ngmd-callout>

## Supported Angular versions

The peer range covers Angular 12.2 and later, and CI tests it (see [Tested versions](#tested-versions)). The overlay checks each debug API on the page and sends what it finds with the page's Angular version, so each tab shows the data that version provides. Only the profiler also looks at the version: the overlay uses `ɵsetProfiler` from Angular 20.0, because before that it holds a single profiler.

When a tab needs a debug API the page doesn't have, it says which Angular version the feature needs and which one the page runs, for example "The live signal graph needs Angular 20.1 or later; this page runs Angular 15.2." The agent tools answer **Unsupported on this Angular version** with the same sentence, and `list-pages` shows each page's Angular version next to its platform.

| Feature                                                | Needs Angular |
| ------------------------------------------------------ | ------------- |
| Live component tree, detail and values                 | 12.0          |
| Telling detached components from destroyed ones        | 14.0          |
| Injected services, providers and environment injectors | 16.2          |
| Full injector tree with lookup paths                   | 17.0          |
| Signal values in the component detail (`ng.isSignal`)  | 17.1          |
| Form events from `AbstractControl.events`              | 18.0          |
| The `@pangular-inspector/devtools/http` entry          | 19.0          |
| **Defer blocks** list                                  | 19.1          |
| Change detection recording and Angular profiling       | 20.0          |
| Subscriptions tied to component instances              | 20.0          |
| Live signal graph and effect counts in **Leaks**       | 20.1          |
| **&#64;for blocks** list                               | 22.0          |

All of them need a development build, since production builds leave out `window.ng`.

### Angular 12 to 19

On Angular 12 to 19 the overlay degrades as the table above shows:

- The **Injectors** tab shows the element injectors with their components and directives. From 16.2 it adds providers, dependencies and environment injectors.
- Before 16.2, the overlay finds the `Router` through a router link, the component an outlet renders or the root component, whichever holds it. A page where none of them injects the `Router` shows no router data. The router setup is then read in `events-only` mode, so the setup kind shows `unknown` and features found through providers (preloading, the scroller, `withDebugTracing()`) show `off`.
- Before 16.2, the **NgRx** tab can't find the `@ngrx/store` `Store` or signal stores that components provide.
- Before 16.2, the errors collector can't wrap the app's `ErrorHandler`. It counts the errors Angular's default handler logs instead, so errors a custom handler swallows don't show.
- Before 18.0, the **Forms** tab builds its event timeline by comparing snapshots, since controls have no `events` stream.

### Setup on Angular 12 to 19

| Setup                                    | Angular 12 to 16                                                                                                                                                      | Angular 17 to 19                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Overlay import in `main.ts`              | Works with the webpack-based `@angular-devkit/build-angular:browser` builder. Signal history uses samples, since `@angular/core/primitives/signals` exists from 17.0. | Works with `browser` and `application`. Under webpack, signal history uses samples. |
| Vite plugin (Analog)                     | Works. The plugin points `@angular/core/primitives/signals` at a stub before 17.0.                                                                                    | Works.                                                                              |
| `initPangularHub()` in an Express server | Works when the server runs on Node.js 22 or later. If the server must stay on an older Node.js, run the standalone CLI on Node.js 22 or later beside it instead.      | Works.                                                                              |
| Standalone CLI next to `ng serve`        | Works. Run `npx pangular dev` with Node.js 22 or later, and the app's own CLI with the Node.js version it supports.                                                   | Works.                                                                              |
| Chrome extension                         | Works on top of any of the setups above.                                                                                                                              | Works.                                                                              |
| `@pangular-inspector/devtools/http`      | Not available. It imports `REQUEST` and `provideEnvironmentInitializer`, so the build fails. Leave it out; the HTTP timeline and fault rules need it.                 | Not available before 19.0, for the same reason.                                     |

With the webpack-based `browser` builder, use the standalone CLI next to `ng serve`, as in [Client-only Angular CLI app](#client-only-angular-cli-app), or the Express hub for an SSR app.

TypeScript before 4.7 (Angular 12 and 13) can't read the package's `.d.mts` types, so `import('@pangular-inspector/devtools/overlay')` fails the type check. Declare the module in a typings file:

```ts
// src/typings.d.ts
declare module '@pangular-inspector/devtools/overlay';
```

### Tested versions

The peer range is `@angular/core` and `@angular/common` `>=12.2` with no upper bound. CI tests these versions:

| Angular                 | Node.js | What runs                                                                 | When                                  |
| ----------------------- | ------- | ------------------------------------------------------------------------- | ------------------------------------- |
| 12.2 (lowest supported) | 22      | The page-side tests against a real Angular app, after ngcc                | Every push to `main`, and weekly      |
| 15.2                    | 22      | The page-side tests against a real Angular app                            | Every push to `main`, and weekly      |
| 17.3                    | 22      | The page-side tests against a real Angular app                            | Every push to `main`, and weekly      |
| 19.2                    | 22      | The page-side tests against a real Angular app                            | Every push to `main`, and weekly      |
| 20.0                    | 22      | The page-side tests against a real Angular app                            | Every push to `main`, and weekly      |
| 21 (latest 21.x)        | 22      | The page-side tests against a real Angular app                            | Every push to `main`, and weekly      |
| 22 (latest 22.x)        | 22      | The page-side tests, including Signal Forms                               | Every push to `main`, and weekly      |
| 22 (repository version) | 24      | Every package and panel test, the type checks and axe                     | Every pull request and push to `main` |
| Newest the ranges allow | 24      | A fresh Angular CLI app and a fresh Analog app with the package installed | Weekly                                |

The page-side tests run in Node.js 22 for every Angular version, since they load Angular in jsdom rather than through its CLI. Tests of a feature a version lacks check the unavailable state on that version instead. Angular 13, 14, 16 and 18 are in the peer range but not tested. Some features need a later Angular release than 20.0. The inspector pages list them, for example [abort and probe](../inspectors/router.md#abort-and-probe-need-angular-20-2) (20.2) and the live [signal graph](../inspectors/signals.md#debug-apis) (20.1). The Signal Forms tests run on Angular 22 and later, where Signal Forms are stable.

## Install the package

```bash group="install" name="pnpm" image="https://cdn.simpleicons.org/pnpm/F69220" active
pnpm add -D @pangular-inspector/devtools
```

```bash group="install" name="npm" image="https://cdn.simpleicons.org/npm/CB3837"
npm install -D @pangular-inspector/devtools
```

```bash group="install" name="yarn" image="https://cdn.simpleicons.org/yarn/2C8EBB"
yarn add -D @pangular-inspector/devtools
```

```bash group="install" name="bun" image="https://bun.sh/logo.svg"
bun add -D @pangular-inspector/devtools
```

MCP agent support (`@devframes/agentic`) and Devframe itself are included. You don't install them separately.

### Dependency or dev dependency

| Setup                                      | Install it as                                                                                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vite or Analog                             | A dev dependency. The Vite plugin only runs in the dev server.                                                                                                                                         |
| Client-only Angular CLI app                | A dev dependency. The CLI runs next to `ng serve`, and the overlay import only runs in development builds.                                                                                             |
| Standalone CLI                             | A dev dependency, or no install at all with `npx`.                                                                                                                                                     |
| Angular SSR with Express or another server | A dependency, because `server.ts` imports the hub when the production server starts. To keep it a dev dependency, import the hub only in development, with a dynamic `import()` behind your own check. |

### Entry points

| Import                                                | Use it for                                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `@pangular-inspector/devtools/hub`                    | `initPangularHub()`, the server middleware for an Express app.                                             |
| `@pangular-inspector/devtools/vite`                   | The Vite plugin for a Vite-based Angular app, such as an Analog app.                                       |
| `@pangular-inspector/devtools/overlay`                | The browser script that collects live data from your page.                                                 |
| `@pangular-inspector/devtools/overlay-manual`         | The same script, started only when you call `initOverlay`. See [Set up Capacitor](../guides/capacitor.md). |
| `@pangular-inspector/devtools/capacitor-hook`         | Logs Capacitor plugin calls from app start. See [Capacitor](../inspectors/capacitor.md#web-calls).         |
| `@pangular-inspector/devtools/startup-hook`           | Times provider construction at startup. See [Injectors](../inspectors/injectors.md#startup-timing).        |
| `@pangular-inspector/devtools/plugin`                 | The plugin API for a library's own tab and agent tools. See [Write a plugin](../guides/write-a-plugin.md). |
| `@pangular-inspector/devtools/overlay-angular-native` | The overlay for an Angular Native app. See [Angular Native](./angular-native.md).                          |
| `@pangular-inspector/devtools/overlay-nativescript`   | The overlay for a NativeScript Angular app. See [NativeScript](./nativescript.md).                         |
| `@pangular-inspector/devtools/popup`                  | The floating button and panel on your page.                                                                |
| `@pangular-inspector/devtools/http`                   | The HTTP interceptor and hydration hooks for the SSR & HTTP tab.                                           |
| `@pangular-inspector/devtools/config`                 | The `PangularConfig` type and its defaults. See [Configuration](./configuration.md).                       |
| `@pangular-inspector/devtools/devframe`               | The devframe definition and `initDevframe()`, for custom hosts.                                            |

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

Load the overlay after bootstrap, in development only:

```ts
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

With the [Vite plugin](./vite.md), skip this step: the plugin adds the overlay to the pages the dev server serves. To load it yourself, see [Load the overlay yourself](./vite.md#load-the-overlay-yourself).

The standalone CLI on its own has no page connected, so it needs no browser part. Behind the `ng serve` proxy of a client-only app it does, like any other setup.

### Client-only Angular CLI app

An app created with `ng new --ssr=false` only runs `ng serve`. Run the standalone CLI next to it, and let `ng serve` forward `/__pangular/` to the CLI. The overlay and the popup look for the devtools at `/__pangular/` on the page's own origin, so they find the CLI there.

<ngmd-workflow>
  <ngmd-step title="Start the devtools server">
    Run <code>npx pangular dev --port 9999 --proxy-origin http://localhost:4200</code> from the root of your workspace. It serves the panel, the connection and the WebSocket at the root of port 9999. <code>--proxy-origin</code> names the origin of <code>ng serve</code>, so the CLI prints its links for <code>http://localhost:4200/__pangular/</code>.
  </ngmd-step>
  <ngmd-step title="Add the proxy config">
    Save the <code>proxy.conf.json</code> above next to <code>angular.json</code>. It strips the <code>/__pangular</code> prefix, and <code>"ws": true</code> forwards the WebSocket the overlay and the panel connect over.
  </ngmd-step>
  <ngmd-step title="Point ng serve at it">
    Set <code>proxyConfig</code> in the <code>serve</code> options of <code>angular.json</code>, or run <code>ng serve --proxy-config proxy.conf.json</code>.
  </ngmd-step>
  <ngmd-step title="Load the overlay">
    Import the overlay in <code>main.ts</code>, as in the <a href="#browser-part">browser part</a> above.
  </ngmd-step>
  <ngmd-step title="Enter the one-time code">
    When your app connects, the CLI prints a code and a link like <code>http://localhost:4200/__pangular/#devframe_otp=123456</code>. Open the link, then reload your app if the panel was already open. Without <code>--proxy-origin</code>, the link points at port 9999, which only trusts port 9999. Then open the same code on your app's origin instead.
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
    Run <code>ng serve</code> for an Angular CLI app, or the Vite dev server for an Analog app. For a client-only app, keep <code>pangular dev</code> running next to <code>ng serve</code>.
  </ngmd-step>
  <ngmd-step title="Look for the button">
    The Pangular Inspector button appears in the bottom-right corner of the page. The overlay adds it.
  </ngmd-step>
  <ngmd-step title="Open the panel">
    Click the button. The header shows <strong>Live</strong> once the panel is connected.
  </ngmd-step>
  <ngmd-step title="Open the full-page viewer">
    Go to <code>/__devframes/</code> on the same server to see the devtools on their own page. For a client-only app, the full-page viewer is at <code>/__pangular/</code> on your app's origin.
  </ngmd-step>
</ngmd-workflow>

## FAQ

<ngmd-accordion>
  <ngmd-accordion-item title="Do I need to install devframe?" open>
    No. The package depends on Devframe and re-exports <code>initDevframe</code> from <code>&#64;pangular-inspector/devtools/devframe</code>, for example to <a href="./express.md#mount-only-the-panel">mount only the panel</a>. Import it from there, so the panel and the devframe definition come from the same Devframe copy.
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
