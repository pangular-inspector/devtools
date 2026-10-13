// `@pangular-inspector/devtools/ssr`: SSR tracing for servers that don't use
// the Express hub's `ssrMiddleware`. Both helpers record into the devtools
// server running in the same process (the hub or the Vite plugin) and do
// nothing while none runs or the http inspector is off.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { withPangularSsr as traceWebHandler, type PangularSsrOptions } from './ssr-fetch.ts';
import { createSsrMiddleware } from './ssr-middleware.ts';

export type { PangularSsrOptions, WebRequestHandler } from './ssr-fetch.ts';

/** The hub's default base, never traced: the panel there is HTML too. */
const HUB_BASE = '/__devframes/';

function withHubBase(options: PangularSsrOptions): PangularSsrOptions {
  return { ...options, skip: [HUB_BASE, ...(options.skip ?? [])] };
}

/**
 * Wraps a web-standard SSR handler (`(request: Request) => Promise<Response>`),
 * such as `AngularAppEngine.handle`, a Hono or h3 app's `fetch`, or a Nitro
 * route, so each page it renders shows in the SSR & HTTP tab.
 */
export function withPangularSsr<Args extends unknown[], Result extends Response | null | undefined>(
  handler: (request: Request, ...rest: Args) => Result | Promise<Result>,
  options: PangularSsrOptions = {},
): (request: Request, ...rest: Args) => Promise<Result> {
  return traceWebHandler(handler, withHubBase(options));
}

/**
 * The Node `(req, res, next)` tracer behind the hub's `ssrMiddleware`, for a
 * server that renders on Node without the Express hub, such as Fastify.
 */
export function pangularSsrMiddleware(options: PangularSsrOptions = {}) {
  return createSsrMiddleware(withHubBase(options));
}

/** The part of an h3 event the tracer reads. */
export interface NodeEventLike {
  node: { req: IncomingMessage; res: ServerResponse };
}

/**
 * An h3 or Nitro server middleware that traces page renders on Node, such as
 * Analog's: `export default defineEventHandler(pangularSsrEventHandler())` in
 * `src/server/middleware`. It answers only a forced Client render; otherwise
 * it returns nothing, so the request goes on to the renderer.
 */
export function pangularSsrEventHandler(options: PangularSsrOptions = {}) {
  const trace = pangularSsrMiddleware(options);
  return (event: NodeEventLike): true | undefined => {
    const { req, res } = event.node;
    trace(req, res, () => {});
    return res.writableEnded ? true : undefined;
  };
}
