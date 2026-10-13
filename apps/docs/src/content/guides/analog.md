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
    Add <code>@pangular-inspector/devtools</code> as a dev dependency.
  </ngmd-step>
  <ngmd-step title="Add the Vite plugin">
    Register it next to <code>analog()</code> in <code>vite.config.ts</code>. It also loads the overlay into your pages.
  </ngmd-step>
  <ngmd-step title="Open the devtools">
    Start the dev server and click the floating button.
  </ngmd-step>
</ngmd-workflow>

## Step 1: Install

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

## Step 2: Add the Vite plugin

Add the plugin after `analog()`:

```ts {3,7}
// vite.config.ts
import analog from '@analogjs/platform';
import pangular from '@pangular-inspector/devtools/vite';
import {defineConfig} from 'vite';

export default defineConfig(() => ({
  plugins: [analog(), pangular()],
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

### The overlay

The plugin adds the overlay to the pages the dev server serves, so `src/main.ts` needs no import. A production build does not include it. To load it yourself instead, see [Load the overlay yourself](../getting-started/vite.md#load-the-overlay-yourself).

## Step 3: Open the devtools

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

## Catch hydration errors from the first load

The overlay can connect after the first render, so it can miss hydration errors (`NG0500` to `NG0506`) logged during the first load. `providePangularHttp()` starts listening for them when the app starts. The Analog dock lists them under **Hydration error** in **Lint**, and the `analog-current-page` tool returns them.

Analog's own `load()` fetches and API calls show in the Analog dock without extra setup. `withPangular()` also records `HttpClient` calls in the **SSR & HTTP** tab.

```ts {5,10-11}
// src/app/app.config.ts
import {provideHttpClient, withFetch} from '@angular/common/http';
import {ApplicationConfig} from '@angular/core';
import {provideFileRouter} from '@analogjs/router';
import {providePangularHttp, withPangular} from '@pangular-inspector/devtools/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideFileRouter(),
    provideHttpClient(withFetch(), withPangular()),
    providePangularHttp(),
  ],
};
```

`providePangularHttp()` and `withPangular()` do nothing in production builds. See [Set up SSR & HTTP](./ssr-http.md) for the interceptor order.

## Trace server renders

To fill the **SSR requests** table in the **SSR & HTTP** tab, add a Nitro server middleware that traces each page render. Analog runs files in `src/server/middleware` before it renders the page, on the dev server too:

```ts
// src/server/middleware/pangular-ssr.ts
import {pangularSsrEventHandler} from '@pangular-inspector/devtools/ssr';
import {defineEventHandler} from 'h3';

export default defineEventHandler(pangularSsrEventHandler());
```

It wraps the Node response of each HTML request, adds the `Server-Timing` header that links the page to its render, and records the render with its render mode. Analog marks its renders `ssr-analog`, which the tab shows as **Server**. It does nothing while the Vite plugin is not running, so it is safe in a production build.

Analog gives the render its own `REQUEST` token, not the one from `@angular/core`, so `withPangular()` can't read the request id from a header. Instead, the tracer links each server call to the only traced request in flight.

If two traced renders run at once, the tracer can't tell their calls apart. The calls show in the timeline without a link to their request.

The tracer skips a request that does not accept `text/html`, such as `curl` without an `Accept` header. It also skips a path in `skip`. A render it skips is not in flight for the tracer.

If an untraced render runs alongside one traced render, the tracer links the untraced render's calls to the traced one.

The tracer drops a traced request after five minutes without activity, such as a response nobody reads. A response that keeps sending chunks stays in flight.

## Try the demo

The repository has an Analog demo in `examples/analog`. It has file routes with route groups, `.server.ts` loads, API routes under `src/server/routes/api/v1`, markdown content, prerendered pages and a client-only `/dashboard`.

```bash
pnpm install
pnpm analog:dev
```

The script builds the devtools package first, then starts the Vite dev server.

<ngmd-alert severity="helpful">
  The demo aliases <code>@pangular-inspector/devtools/overlay</code> to the built package in its <code>vite.config.ts</code>, and the overlay script the plugin adds resolves through that alias. Your app does not need it.
</ngmd-alert>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/inspectors/analog" title="Analog inspector"></ngmd-pill>
  <ngmd-pill href="/getting-started/vite" title="Vite and Analog"></ngmd-pill>
  <ngmd-pill href="/agents/tools" title="Analog tools"></ngmd-pill>
</ngmd-pill-row>
