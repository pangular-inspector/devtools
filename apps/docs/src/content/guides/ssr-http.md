---
title: Set up SSR & HTTP
description: Add the interceptor and hydration hooks, in the right order, to fill the SSR & HTTP tab.
---

<ngmd-hero title="Set up SSR & HTTP" gradient>
  Record every HttpClient call on the server and in the browser, then break them on purpose with fault rules.
</ngmd-hero>

# Set up SSR & HTTP

The [SSR & HTTP tab](../inspectors/ssr-http.md) records every `HttpClient` call during server rendering and in the browser. It needs three things: an interceptor, a hydration hook, and SSR running next to the devtools.

## What you set up

<ngmd-card-grid columns="3">
  <ngmd-card icon="zap" title="Interceptor">
    <code>withNgDevtools()</code> records each request and applies fault rules.
  </ngmd-card>
  <ngmd-card icon="lightbulb" title="Hydration hook">
    <code>provideNgDevtoolsHttp()</code> captures the NG05xx hydration warnings Angular logs.
  </ngmd-card>
  <ngmd-card icon="layers" title="One server process">
    SSR and the devtools hub run in the same Express process.
  </ngmd-card>
</ngmd-card-grid>

## The flow

<ngmd-workflow>
  <ngmd-step title="Add the providers">
    Register the interceptor and the hydration hook in <code>app.config.ts</code>.
  </ngmd-step>
  <ngmd-step title="Put the interceptor first">
    Place <code>withNgDevtools()</code> before your own interceptors.
  </ngmd-step>
  <ngmd-step title="Mount the hub in server.ts">
    SSR and the devtools middleware share one Express process.
  </ngmd-step>
  <ngmd-step title="Render the pages you test on the server">
    Use <code>RenderMode.Server</code> for them in <code>app.routes.server.ts</code>.
  </ngmd-step>
  <ngmd-step title="Inject a fault">
    Add a rule in the tab and reload the page.
  </ngmd-step>
</ngmd-workflow>

## Step 1: Add the providers

Both functions come from `@santoshyadavdev/ng-devtools/http`.

```ts {4,10-11}
// src/app/app.config.ts
import {ApplicationConfig} from '@angular/core';
import {provideHttpClient, withFetch} from '@angular/common/http';
import {provideNgDevtoolsHttp, withNgDevtools} from '@santoshyadavdev/ng-devtools/http';
import {provideClientHydration} from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(),
    provideHttpClient(withFetch(), withNgDevtools()),
    provideNgDevtoolsHttp(),
  ],
};
```

### What each provider does

- `withNgDevtools()` adds the interceptor that records calls and applies fault rules.
- `provideNgDevtoolsHttp()` captures the hydration warnings (NG05xx) before the overlay loads.

<ngmd-alert severity="helpful">
  The interceptor checks <code>ngDevMode</code>. In production builds it passes every request through untouched.
</ngmd-alert>

## Step 2: Put withNgDevtools first

Register `withNgDevtools()` before your own interceptors. Then it records requests as the app makes them, and fault rules apply before anything else.

```ts {11}
// src/app/app.config.ts
import {provideHttpClient, withFetch, withInterceptors} from '@angular/common/http';
import {ApplicationConfig} from '@angular/core';
import {provideClientHydration} from '@angular/platform-browser';
import {provideNgDevtoolsHttp, withNgDevtools} from '@santoshyadavdev/ng-devtools/http';
import {authInterceptor} from './auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(),
    provideHttpClient(withFetch(), withNgDevtools(), withInterceptors([authInterceptor])),
    provideNgDevtoolsHttp(),
  ],
};
```

### How transfer cache hits are detected

A call counts as a transfer cache hit when the cached response comes back right away. It also counts when the page's TransferState holds a GET or HEAD entry for the same URL. So an async interceptor after `withNgDevtools()` does not hide cache hits.

## Step 3: Mount the hub in server.ts

The interceptor on the server hands its calls to the devtools through the Node process. So SSR and the devtools middleware must run in the same Express process.

```ts {4,9-12}
// src/server.ts
import {AngularNodeAppEngine, createNodeRequestHandler} from '@angular/ssr/node';
import express from 'express';
import {initNgDevtoolsHub} from '@santoshyadavdev/ng-devtools/hub';

const app = express();
const angularApp = new AngularNodeAppEngine();

const devtools = initNgDevtoolsHub({
  ws: {sidecar: true},
});
app.use(devtools.nodeMiddleware);

// ... your API routes, static files and the Angular handler

export const reqHandler = createNodeRequestHandler(app);
```

This is adapted from the demo app's `src/server.ts`. It keeps the one-time code and the origin check on, which are the defaults. See [Angular CLI and Express](../getting-started/express.md) for every option.

## Step 4: Render the pages you test on the server

Routes that are prerendered at build time make no requests at runtime. SSR rules do not apply to them. Use `RenderMode.Server` for the pages you want to test.

```ts {5}
// src/app/app.routes.server.ts
import {RenderMode, ServerRoute} from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {path: 'products', renderMode: RenderMode.Server},
  {path: '**', renderMode: RenderMode.Prerender},
];
```

<ngmd-callout type="tip" title="Check a route's render mode">
  The <code>explain-render-mode</code> agent tool tells you which <code>ServerRoute</code> and render mode a URL gets. See <a href="../agents/tools.md">Tools</a>.
</ngmd-callout>

## Step 5: Inject a fault

<ngmd-workflow>
  <ngmd-step title="Open Fault injection">
    Open the <strong>SSR & HTTP</strong> tab and go to <strong>Fault injection</strong>.
  </ngmd-step>
  <ngmd-step title="Match a URL">
    Enter a URL pattern, for example <code>/api/*</code>.
  </ngmd-step>
  <ngmd-step title="Pick where it applies">
    <strong>SSR + client</strong>, <strong>SSR only</strong> or <strong>Client only</strong>.
  </ngmd-step>
  <ngmd-step title="Set the response">
    Set a status (for example <code>500</code>), a delay, or a mock JSON body. Click <strong>Add rule</strong>.
  </ngmd-step>
  <ngmd-step title="Reload">
    SSR rules apply from the next page load. Client rules apply right away.
  </ngmd-step>
</ngmd-workflow>

### How a rule answers

- A status of 400 or more fails the request with an `HttpErrorResponse`.
- A lower status returns the body as a mocked response.

<ngmd-callout type="warning" title="SSR mocks are not transferred">
  SSR mocks are not written to TransferState, so the browser requests the URL again. Apply the rule on <strong>SSR + client</strong> to mock both.
</ngmd-callout>

## Try it on the demo

The demo app has an SSR & HTTP example at `/examples/http`. It fetches `/api/products` during SSR and replays it from the transfer cache. The endpoint accepts `?delay=` and `?fail=` for backend errors.

```bash
pnpm build --configuration development
node dist/angular-devtools/server/server.mjs
```

Open `http://localhost:4000/examples/http`. See [Demo apps](../contributing/demo-apps.md) for the rest.

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/inspectors/ssr-http" title="SSR & HTTP inspector"></ngmd-pill>
  <ngmd-pill href="/getting-started/express" title="Angular CLI and Express"></ngmd-pill>
  <ngmd-pill href="/guides/analog" title="Set up Analog"></ngmd-pill>
</ngmd-pill-row>
