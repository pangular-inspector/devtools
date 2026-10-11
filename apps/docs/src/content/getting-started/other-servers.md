---
title: Hono, h3 and Fastify
description: Mount the devtools hub in an Angular SSR server built on Hono, h3 or Fastify.
---

<ngmd-hero title="Hono, h3 and Fastify" gradient>
  Mount the devtools hub in an Angular SSR server that runs on Hono, h3 or Fastify instead of Express.
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

## Pick a transport

A web handler never sees WebSocket upgrades, and neither does a server that `ng serve` drives through `reqHandler`. Pick one of these:

| Setting                                   | Use it when                                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ws: false`                               | Always works. The browser connects over server-sent events on the same port, including under `ng serve`. |
| `ws: {sidecar: true}`                     | You want a WebSocket. It runs on its own port, picked automatically.                                     |
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

The other hub options, access control and the production warning are the same as for Express. See [Hub options](./express.md#hub-options) and [Access control](./express.md#access-control).

## Troubleshooting

<ngmd-accordion>
  <ngmd-accordion-item title="Every app route answers 404" open>
    <code>devtools.handler</code> is mounted on a route that matches more than <code>devtools.base</code>. It answers 404 outside the base and doesn't fall through. Mount it on <code>`${devtools.base}*`</code> (Hono) or <code>`${devtools.base}**`</code> (h3).
  </ngmd-accordion-item>
  <ngmd-accordion-item title="The panel does not connect">
    The hub advertises a WebSocket that no upgrade reaches. Pass <code>ws: false</code>, pass <code>ws: {sidecar: true}</code>, or call <code>devtools.attach(server)</code> on the Node server you start.
  </ngmd-accordion-item>
</ngmd-accordion>

## Where to next

<ngmd-pill-row>
  <ngmd-pill href="/getting-started/express" title="Angular CLI and Express"></ngmd-pill>
  <ngmd-pill href="/getting-started/configuration" title="Configuration"></ngmd-pill>
  <ngmd-pill href="/getting-started/overlay" title="Browser overlay"></ngmd-pill>
</ngmd-pill-row>
