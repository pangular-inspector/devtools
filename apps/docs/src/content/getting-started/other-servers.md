---
title: Hono, h3 and Fastify
description: Mount the devtools hub and trace SSR renders in an Angular SSR server built on Hono, h3, Nitro or Fastify.
---

<ngmd-hero title="Hono, h3 and Fastify" gradient>
  Mount the devtools hub and trace SSR renders in an Angular SSR server that runs on Hono, h3, Nitro or Fastify instead of Express.
</ngmd-hero>

# Hono, h3 and Fastify

*Angular SSR runs on Hono and h3 through [`createRequestHandler`](https://angular.dev/api/ssr/createRequestHandler), and on Fastify through [`createNodeRequestHandler`](https://angular.dev/api/ssr/node/createNodeRequestHandler). The devtools hub mounts in each of them. The browser part is the same as for Express: load the overlay as shown in [Angular CLI and Express](./express.md#load-the-overlay).

## Two ways to mount the hub

`initPangularHub()` returns two request handlers for the same routes:

| Handler          | Signature                                 | Outside `devtools.base` |
| ---------------- | ----------------------------------------- | ----------------------- |
| `handler`        | `(request: Request) => Promise<Response>` | Answers 404.            |
| `nodeMiddleware` | `(req, res, next) => void`, Connect style | Calls `next()`.         |

Hono and h3 take web-standard handlers, so they use `handler`. Fastify runs on Node, so it uses `nodeMiddleware`.

### Route the base to `handler`

`handler` doesn't fall through. Mount it on a catch-all route under `devtools.base` (`/__devframes/` by default), and register it before your Angular SSR route. Requests outside the base then reach your app.

## Hono

```ts
// src/server.ts
import {AngularAppEngine, createRequestHandler} from '@angular/ssr';
import {initPangularHub} from '@pangular-inspector/devtools/hub';
import {Hono} from 'hono';

const angularApp = new AngularAppEngine();
const devtools = initPangularHub({ws: false});
const app = new Hono();

app.all(`${devtools.base}*`, (c) => devtools.handler(c.req.raw));
app.get('*', async (c) => (await angularApp.handle(c.req.raw)) ?? c.notFound());

export const reqHandler = createRequestHandler(app.fetch);
```

## h3

```ts
// src/server.ts
import {createRequestHandler} from '@angular/ssr';
import {initPangularHub} from '@pangular-inspector/devtools/hub';
import {H3} from 'h3';

const devtools = initPangularHub({ws: false});
const app = new H3();

app.all(`${devtools.base}**`, (event) => devtools.handler(event.req));
// ... your static files and Angular SSR routes

export const reqHandler = createRequestHandler(app.fetch);
```

This sample uses h3 v2. With h3 v1, wrap the handler in `fromWebHandler()` on a router: ``router.use(`${devtools.base}**`, fromWebHandler(devtools.handler))``.

## Fastify

Fastify has no Connect middleware of its own. Hand requests under the base to `nodeMiddleware` in an `onRequest` hook, and call `reply.hijack()` so Fastify leaves the response to the hub:

```ts
// src/server.ts
import {createNodeRequestHandler} from '@angular/ssr/node';
import {initPangularHub} from '@pangular-inspector/devtools/hub';
import Fastify from 'fastify';

const devtools = initPangularHub({ws: false});
const app = Fastify();

app.addHook('onRequest', (request, reply, done) => {
  if (!request.url.startsWith(devtools.base)) return done();
  reply.hijack();
  devtools.nodeMiddleware(request.raw, reply.raw);
});
// ... your static files and Angular SSR routes

export const reqHandler = createNodeRequestHandler(async (req, res) => {
  await app.ready();
  app.server.emit('request', req, res);
});
```

The hook runs before Fastify parses the body, so the MCP endpoint at `<base>__mcp` still receives the raw request.

## Trace SSR renders

The **SSR requests** table in [SSR & HTTP](../inspectors/ssr-http.md#ssr-requests) needs each page render traced. The Express hub's `ssrMiddleware` wraps a Node response. For a web-standard handler, `@pangular-inspector/devtools/ssr` has `withPangularSsr()`, which wraps any `(request: Request) => Promise<Response>` and records the same data:

- The request gets an id in the `x-pangular-ssr-id` header, so `withPangular()` tags each server call with it.
- The response gets a `Server-Timing` header with the id and the render, fetch, guard and resolver times, so the overlay links the page to its render.
- The render is recorded once the body has been sent, with its status, render mode, size and kept headers.
- SSR overrides from the panel apply: render errors, forced Client renders and TransferState edits.

It traces `GET` and `HEAD` requests that accept `text/html` and whose answer is HTML or a redirect. A `null` or `undefined` answer, as `AngularAppEngine.handle()` gives for a URL with no route, passes through untraced. The wrapper records into the devtools server in the same process, the hub or the Vite plugin. While there is none, or the `http` inspector is off, it calls your handler directly.

### Trace on Hono

Wrap the Angular engine where the Hono app renders pages:

```ts {3,8,11}
// src/server.ts
import {AngularAppEngine, createRequestHandler} from '@angular/ssr';
import {withPangularSsr} from '@pangular-inspector/devtools/ssr';
import {initPangularHub} from '@pangular-inspector/devtools/hub';
import {Hono} from 'hono';

const angularApp = new AngularAppEngine();
const render = withPangularSsr((request: Request) => angularApp.handle(request));
const devtools = initPangularHub({ws: false});
const app = new Hono();

app.all(`${devtools.base}*`, (c) => devtools.handler(c.req.raw));
app.get('*', async (c) => (await render(c.req.raw)) ?? c.notFound());

export const reqHandler = createRequestHandler(app.fetch);
```

Pass a function that calls `angularApp.handle(request)`, not `angularApp.handle` itself, so the method keeps its `this`.

### Trace on h3

With h3 v2, the event carries the web request as `event.req`:

```ts
// src/server.ts
import {AngularAppEngine, createRequestHandler} from '@angular/ssr';
import {withPangularSsr} from '@pangular-inspector/devtools/ssr';
import {initPangularHub} from '@pangular-inspector/devtools/hub';
import {H3} from 'h3';

const angularApp = new AngularAppEngine();
const render = withPangularSsr((request: Request) => angularApp.handle(request));
const devtools = initPangularHub({ws: false});
const app = new H3();

app.all(`${devtools.base}**`, (event) => devtools.handler(event.req));
app.get('**', async (event) => (await render(event.req)) ?? undefined);

export const reqHandler = createRequestHandler(app.fetch);
```

With h3 v1, as in Nitro, turn the event into a web request with `toWebRequest(event)`:

```ts
// server/routes/[...].ts
import {AngularAppEngine} from '@angular/ssr';
import {withPangularSsr} from '@pangular-inspector/devtools/ssr';
import {defineEventHandler, toWebRequest} from 'h3';

const angularApp = new AngularAppEngine();
const render = withPangularSsr((request: Request) => angularApp.handle(request));

export default defineEventHandler(
  async (event) => (await render(toWebRequest(event))) ?? undefined,
);
```

### Wrap the whole app

`withPangularSsr()` also wraps a whole app's `fetch`, such as `createRequestHandler(withPangularSsr(app.fetch))`. API answers are not HTML, so they are not recorded. The hub base (`/__devframes/`) is never traced.

### Trace on Fastify

On Node, `pangularSsrMiddleware()` from the same entry point is the tracer behind the hub's `ssrMiddleware`. Run it in an `onRequest` hook after the hub hook:

```ts
// src/server.ts
import {pangularSsrMiddleware} from '@pangular-inspector/devtools/ssr';

const traceSsr = pangularSsrMiddleware();

app.addHook('onRequest', (request, reply, done) => {
  traceSsr(request.raw, reply.raw, done);
});
```

### Options

| Option              | Default | What it does                                                                                                                    |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `skip`              | `[]`    | Path prefixes that are never traced. The hub base is always skipped.                                                            |
| `browserDistFolder` | none    | The browser build folder that holds `index.csr.html`. **Force Client render** in the SSR overrides needs it to serve the shell. |

### Compression

If a compression middleware encodes the body before `withPangularSsr()` sees it, the render mode can't be read and **Edit TransferState** can't apply. Wrap the handler inside any compression, so the wrapper sees the HTML.

## Pick a transport

A web handler never sees WebSocket upgrades, and neither does a server that `ng serve` drives through `reqHandler`. Pick one of these:

| Setting                                   | Use it when                                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ws: false`                               | Always works. The browser connects over server-sent events on the same port, including under `ng serve`. |
| `ws: {sidecar: true}`                     | You want a WebSocket. It runs on its own port, the first free one from 9777 to 9877.                     |
| `ws: {port: 4001}`                        | You want the side-car WebSocket on a port you choose, such as one a firewall or container lets through.  |
| No `ws` option, `devtools.attach(server)` | You start a Node server yourself, such as `serve()` from `@hono/node-server` or Fastify's `app.server`.  |

`attach(server)` routes the server's `upgrade` events to the hub's WebSocket at `<base>__ws`:

```ts
// src/server.ts
import {serve} from '@hono/node-server';

const devtools = initPangularHub();
// ... mount devtools.handler on the Hono app as shown above

const server = serve({fetch: app.fetch, port: 4000});
devtools.attach(server);
```

The upgrades that `attach(server)` routes pass the same request gate as `nodeMiddleware`. Upgrades outside `devtools.base` are left to the server.

## Access and production

The other hub options are the same as for Express. See [Hub options](./express.md#hub-options).

The hub answers `403` to a request it refuses. Each handler checks what it can see of the request:

| Handler                               | Checks                                                                                         |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `nodeMiddleware` and `attach(server)` | A loopback peer address, a loopback or allowed `Host`, and the origin check, as for Express.   |
| `handler`                             | The `Host`, `Origin` and `Sec-Fetch-Site` headers only. A web request carries no peer address. |

A client outside the browser can set any header, so `handler` alone doesn't keep other machines out. Keep the one-time code (`auth`) on, or bind the server to `localhost`. Pass `allowLan: true` to answer other machines on purpose. [Access control](./express.md#access-control) covers the code and the origin check.

The hub is off when `NODE_ENV` is `production`. `handler` then answers 404, `attach(server)` does nothing and `devtools.enabled` is `false`. Check `enabled` before you mount the hub, and pass `enabled: true` only on a server only you can reach. See [Production](./express.md#production).

## Troubleshooting

<ngmd-accordion>
  <ngmd-accordion-item title="Every app route answers 404" open>
    <code>devtools.handler</code> is mounted on a route that matches more than <code>devtools.base</code>. It answers 404 outside the base and doesn't fall through. Mount it on <code>`${devtools.base}*`</code> (Hono) or <code>`${devtools.base}**`</code> (h3).
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The hub answers 403">
    The request gate refused the request. Open the app on <code>localhost</code> or <code>127.0.0.1</code>, not on a LAN address or a host name. To reach the hub from another machine, pass <code>allowLan: true</code> and keep <code>auth</code> on.
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The panel does not connect">
    The hub advertises a WebSocket that no upgrade reaches. Pass <code>ws: false</code>, pass <code>ws: {sidecar: true}</code>, or call <code>devtools.attach(server)</code> on the Node server you start.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/inspectors/ssr-http" title="SSR & HTTP"></ngmd-pill>
  <ngmd-pill href="/getting-started/express" title="Angular CLI and Express"></ngmd-pill>
  <ngmd-pill href="/getting-started/configuration" title="Configuration"></ngmd-pill>
  <ngmd-pill href="/getting-started/overlay" title="Browser overlay"></ngmd-pill>
</ngmd-pill-row>
