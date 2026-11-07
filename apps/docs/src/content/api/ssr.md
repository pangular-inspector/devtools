---
title: '@pangular-inspector/devtools/ssr'
description: 'Every symbol the @pangular-inspector/devtools/ssr entry point exports, with its declaration and JSDoc, generated from the package source.'
---

<ngmd-hero title="ssr" gradient>
  The symbols <code>&#64;pangular-inspector/devtools/ssr</code> exports, generated from the package source.
</ngmd-hero>

# @pangular-inspector/devtools/ssr

Import from `@pangular-inspector/devtools/ssr`. This page is generated from [`packages/devtools/src/ssr.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/ssr.ts) and the files it re-exports. Run `pnpm docs:api` after you change the public API.

## NodeEventLike

Interface. Source: [`packages/devtools/src/ssr.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/ssr.ts).

The part of an h3 event the tracer reads.

```ts
interface NodeEventLike {
  node: {req: IncomingMessage; res: ServerResponse};
}
```

## pangularSsrEventHandler

Function. Source: [`packages/devtools/src/ssr.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/ssr.ts).

An h3 or Nitro server middleware that traces page renders on Node, such as
Analog's: `export default defineEventHandler(pangularSsrEventHandler())` in
`src/server/middleware`. It answers only a forced Client render; otherwise
it returns nothing, so the request goes on to the renderer.

```ts
function pangularSsrEventHandler(
  options: PangularSsrOptions = {},
): (event: NodeEventLike) => true | undefined;
```

## pangularSsrMiddleware

Function. Source: [`packages/devtools/src/ssr.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/ssr.ts).

The Node `(req, res, next)` tracer behind the hub's `ssrMiddleware`, for a
server that renders on Node without the Express hub, such as Fastify.

```ts
function pangularSsrMiddleware(
  options: PangularSsrOptions = {},
): (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => void;
```

## PangularSsrOptions

Interface. Source: [`packages/devtools/src/ssr-fetch.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/ssr-fetch.ts).

```ts
interface PangularSsrOptions {
  /** Path prefixes that are never traced, such as the hub base. */
  skip?: string[];
  /**
   * The app's browser build folder, which holds `index.csr.html`. Needed to
   * force a Client render from the panel. It is read with `node:fs` when an
   * override asks for it.
   */
  browserDistFolder?: string;
}
```

## WebRequestHandler

Type. Source: [`packages/devtools/src/ssr-fetch.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/ssr-fetch.ts).

A web-standard request handler, such as `AngularAppEngine.handle` or `app.fetch`.

```ts
type WebRequestHandler<Args extends unknown[], Result> = (
  request: Request,
  ...rest: Args
) => Result | Promise<Result>;
```

## withPangularSsr

Function. Source: [`packages/devtools/src/ssr.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/ssr.ts).

Wraps a web-standard SSR handler (`(request: Request) => Promise<Response>`),
such as `AngularAppEngine.handle`, a Hono or h3 app's `fetch`, or a Nitro
route, so each page it renders shows in the SSR & HTTP tab.

```ts
function withPangularSsr<Args extends unknown[], Result extends Response | null | undefined>(
  handler: (request: Request, ...rest: Args) => Result | Promise<Result>,
  options: PangularSsrOptions = {},
): (request: Request, ...rest: Args) => Promise<Result>;
```
