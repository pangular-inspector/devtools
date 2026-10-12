---
title: Quick start
description: Add the devtools to an Angular CLI app with server-side rendering and open the panel on your page.
---

<ngmd-hero title="Quick start" gradient>
  From install to a live panel on your page, in an Angular CLI app with server-side rendering.
</ngmd-hero>

# Quick start

This page takes one path: an *Angular CLI app with SSR, run with `ng serve`. Four steps take you from install to a live panel. The devtools mount in the Express server that the CLI generated, so there is one process to run and nothing to proxy. If your app is set up another way, see [Other ways to set it up](#other-ways-to-set-it-up).

## Before you start

You need an Angular CLI app with SSR, on Angular 20 or later, and Node.js 22 or later. An SSR app has a `src/server.ts`. To create one, run `ng new my-app --ssr`.

<ngmd-callout type="info" title="No server.ts?">
  A client-only app has no server to mount the devtools in. Follow <a href="./installation.md#client-only-angular-cli-app">Client-only Angular CLI app</a> instead.
</ngmd-callout>

## Install the package

Install it as a dependency, not a dev dependency, because `server.ts` imports it when the server starts.

```bash group="install" name="pnpm" image="https://cdn.simpleicons.org/pnpm/F69220" active
pnpm add @pangular-inspector/devtools
```

```bash group="install" name="npm" image="https://cdn.simpleicons.org/npm/CB3837"
npm install @pangular-inspector/devtools
```

```bash group="install" name="yarn" image="https://cdn.simpleicons.org/yarn/2C8EBB"
yarn add @pangular-inspector/devtools
```

```bash group="install" name="bun" image="https://bun.sh/logo.svg"
bun add @pangular-inspector/devtools
```

## Mount the hub

Open `src/server.ts`. Import `initPangularHub` and mount its middleware right after `const app = express()`, before the generated `express.static` and Angular handlers:

```ts {10,16-18}
// src/server.ts
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';
import {initPangularHub} from '@pangular-inspector/devtools/hub';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();
// Before express.static and the Angular handler, so the devtools routes answer first.
const devtools = initPangularHub({ws: false});
app.use(devtools.nodeMiddleware);
```

Leave the rest of the file as it is. `ws: false` connects the browser over server-sent events on the same port, which works under `ng serve`. When `NODE_ENV` is `production`, the hub is off and the middleware only calls `next()`.

## Load the overlay

The [overlay](./overlay.md) reads the running page and adds the button that opens the panel. Import it after bootstrap, in development only:

```ts {7-12}
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

## Open the panel

### Start the app

```bash
ng serve
```

Open `http://localhost:4200`. A round button with the Pangular Inspector logo appears in the bottom-right corner of the page. Click it, or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>.

### Enter the one-time code

The first time the panel opens, it shows **Authorize Pangular Inspector** and asks for a 6-digit code. The terminal that runs `ng serve` prints the code in a **Pangular Inspector** box, next to **auth code**. Type it and click **Authorize**.

<ngmd-image src="/images/panel/authorize.png" alt="The Pangular Inspector panel floating over an Angular app, asking for the 6-digit code printed in the terminal, with six empty boxes and an Authorize button"></ngmd-image>

The hub asks for the code by default. [Access and redaction](../security.md) covers what it protects.

### Check that it works

The panel opens on the [Dashboard](../inspectors/dashboard.md), and the header shows **Live**. The tabs now read your running app.

<ngmd-image src="/images/panel/popup.png" alt="The Pangular Inspector panel floating over the demo app, showing the Dashboard with the Angular and TypeScript versions, SSR on, zoneless change detection and counts of components, routes and signals, with the header status Live"></ngmd-image>

To see the panel on a page of its own, open `http://localhost:4200/__devframes/`.

## Troubleshooting

<ngmd-accordion>
  <ngmd-accordion-item title="The button does not appear" open>
    The app is probably a production build. <code>ng build</code> uses the production configuration by default, and the overlay import never runs there. Use <code>ng serve</code>, or build with <code>--configuration development</code>. Then check that <code>main.ts</code> imports the overlay.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The panel says No devtools server found">
    The page could not reach the hub. Check that <code>app.use(devtools.nodeMiddleware)</code> comes before <code>express.static</code> and the Angular handler in <code>server.ts</code>.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The tabs stay empty">
    Check that you entered the code from the terminal, and that the header shows <strong>Live</strong>. A browser reads data only after it exchanges the code.
  </ngmd-accordion-item>
</ngmd-accordion>

## Other ways to set it up

| Your app or goal                                 | Follow                                                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| An Angular CLI app without SSR                   | [Client-only Angular CLI app](./installation.md#client-only-angular-cli-app)                                         |
| An Analog app or another Vite-based app          | [Vite and Analog](./vite.md)                                                                                         |
| SSR on Hono, h3 or Fastify                       | [Hono, h3 and Fastify](./other-servers.md)                                                                           |
| More hub options, SSR tracing and production     | [Angular CLI and Express](./express.md)                                                                              |
| Your source files only, with no app running      | [Standalone CLI](./cli.md)                                                                                           |
| The panel inside Chrome DevTools                 | [Chrome extension](./chrome-extension.md)                                                                            |
| A coding agent                                   | [MCP server](../agents/mcp-server.md)                                                                                |
| An Angular Native, NativeScript or Capacitor app | [Angular Native](./angular-native.md), [NativeScript](./nativescript.md), [Set up Capacitor](../guides/capacitor.md) |

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/popup-and-hub" title="Popup and hub"></ngmd-pill>
  <ngmd-pill href="/getting-started/configuration" title="Configuration"></ngmd-pill>
  <ngmd-pill href="/inspectors/components" title="Components"></ngmd-pill>
  <ngmd-pill href="/agents/mcp-server" title="MCP server"></ngmd-pill>
</ngmd-pill-row>
