---
title: Set up Analog
description: Add the devtools to an Analog app, step by step.
---

<ngmd-hero title="Set up Analog" logo="https://analogjs.org/img/logos/analog-logo.svg" gradient>
  One Vite plugin and one dynamic import. You get the Angular inspectors, the NgRx dock, the Analog dock and an MCP endpoint on the Vite dev server.
</ngmd-hero>

# Set up Analog

This guide adds the devtools to an *Analog app. Everything runs on the *Vite dev server, so there is no separate server to start.

## What you get

<ngmd-card-grid columns="2">
  <ngmd-card icon="layers" title="Angular inspectors">
    Components, injectors, signals, forms, router and pipes, reading the live page.
  </ngmd-card>
  <ngmd-card icon="compass" title="Analog dock">
    File routes, server calls, render modes, content and lint.
  </ngmd-card>
  <ngmd-card icon="box" title="NgRx dock">
    Signal stores and the change log, when your app uses NgRx.
  </ngmd-card>
  <ngmd-card icon="terminal" title="MCP endpoint">
    <code>/__devframes/__mcp</code> on the Vite dev server, with the Analog tools.
  </ngmd-card>
</ngmd-card-grid>

## The flow

<ngmd-workflow>
  <ngmd-step title="Install the package">
    Add <code>@santoshyadavdev/ng-devtools</code> and <code>devframe</code>.
  </ngmd-step>
  <ngmd-step title="Add the Vite plugin">
    Register it next to <code>analog()</code> in <code>vite.config.ts</code>.
  </ngmd-step>
  <ngmd-step title="Load the overlay">
    Import the overlay in <code>src/main.ts</code>, in development only.
  </ngmd-step>
  <ngmd-step title="Open the devtools">
    Start the dev server and click the floating button.
  </ngmd-step>
</ngmd-workflow>

## Step 1: Install

```bash group="install" name="pnpm" image="https://cdn.simpleicons.org/pnpm/F69220" active
pnpm add @santoshyadavdev/ng-devtools devframe
```

```bash group="install" name="npm" image="https://cdn.simpleicons.org/npm/CB3837"
npm install @santoshyadavdev/ng-devtools devframe
```

```bash group="install" name="yarn" image="https://cdn.simpleicons.org/yarn/2C8EBB"
yarn add @santoshyadavdev/ng-devtools devframe
```

```bash group="install" name="bun" image="https://bun.sh/logo.svg"
bun add @santoshyadavdev/ng-devtools devframe
```

## Step 2: Add the Vite plugin

Add the plugin after `analog()`:

```ts {3,7}
// vite.config.ts
import analog from '@analogjs/platform';
import ngDevtools from '@santoshyadavdev/ng-devtools/vite';
import {defineConfig} from 'vite';

export default defineConfig(() => ({
  plugins: [analog(), ngDevtools()],
}));
```

The plugin runs on the dev server only (`apply: 'serve'`). Production builds do not include it.

### Plugin options

All four are optional.

| Option           | Default                                        | What it does                                           |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------ |
| `base`           | `/__devframes/`                                | Where the hub is mounted.                              |
| `apiPrefix`      | Read from your Analog config                   | The API prefix used to tell API calls from page calls. |
| `allowedOrigins` | none                                           | Extra page origins accepted next to localhost.         |
| `auth`           | on if a non-loopback host or origin is allowed | Whether the devtools ask for the one-time code.        |

The plugin also takes the devtools options. See [Vite and Analog](../getting-started/vite.md#options) and [Configuration](../getting-started/configuration.md).

### Custom hostnames

The devtools only answer requests from this machine. If you open the dev server through another hostname, add it to Vite's `server.allowedHosts`. See [Security](../security.md).

## Step 3: Load the overlay

```ts {7}
// src/main.ts
import {bootstrapApplication} from '@angular/platform-browser';
import {App} from './app/app';
import {appConfig} from './app/app.config';

bootstrapApplication(App, appConfig).then(() => {
  if (import.meta.env.DEV) void import('@santoshyadavdev/ng-devtools/overlay');
});
```

The import is dynamic and guarded by `import.meta.env.DEV`, so production bundles do not include it.

## Step 4: Open the devtools

Start the dev server as usual. Then:

| What            | Where                                       |
| --------------- | ------------------------------------------- |
| Floating button | On every page of your app                   |
| Full viewer     | `/__devframes/` on the Vite dev server      |
| MCP endpoint    | `/__devframes/__mcp` on the Vite dev server |

Open the **Analog** dock to see file routes, server calls, render modes, content and lint. See [the Analog inspector](../inspectors/analog.md) for each view.

<ngmd-callout type="tip" title="Connect your agent">
  Point your MCP client at <code>http://localhost:5173/__devframes/__mcp</code> with an <code>Origin</code> header. See <a href="../agents/mcp-server.md">MCP server</a>. The <code>analog-server-calls</code> and <code>analog-call-api</code> tools only work through the Vite plugin.
</ngmd-callout>

## Optional: record HttpClient calls

Analog's own `load()` fetches and API calls show in the Analog dock without extra setup. To also record `HttpClient` calls in the **SSR & HTTP** tab, add the devtools providers to your app config:

```ts {5,10-11}
// src/app/app.config.ts
import {provideHttpClient, withFetch} from '@angular/common/http';
import {ApplicationConfig} from '@angular/core';
import {provideFileRouter} from '@analogjs/router';
import {provideNgDevtoolsHttp, withNgDevtools} from '@santoshyadavdev/ng-devtools/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideFileRouter(),
    provideHttpClient(withFetch(), withNgDevtools()),
    provideNgDevtoolsHttp(),
  ],
};
```

See [Set up SSR & HTTP](./ssr-http.md) for the interceptor order.

## Try the demo

The repository has an Analog demo in `examples/analog`. It has file routes with route groups, `.server.ts` loads, API routes under `src/server/routes/api/v1`, markdown content, prerendered pages and a client-only `/dashboard`.

```bash
pnpm install
pnpm analog:dev
```

The script builds the devtools package first, then starts the Vite dev server.

<ngmd-alert severity="helpful">
  The demo aliases <code>@santoshyadavdev/ng-devtools/overlay</code> to the built package in its <code>vite.config.ts</code>. Your app does not need that alias.
</ngmd-alert>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/inspectors/analog" title="Analog inspector"></ngmd-pill>
  <ngmd-pill href="/getting-started/vite" title="Vite and Analog"></ngmd-pill>
  <ngmd-pill href="/agents/tools" title="Analog tools"></ngmd-pill>
</ngmd-pill-row>
