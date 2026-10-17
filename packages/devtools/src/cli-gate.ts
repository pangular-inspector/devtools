import type { IncomingMessage } from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { listensOnNetwork } from './cli-access.ts';
import {
  blockedOriginReporter,
  isAllowedHubRequest,
  isLoopback,
  type BlockedRequest,
  type HubOriginPolicy,
} from './hub-gate.ts';

/**
 * The request gate for `pangular dev`, the one the Vite plugin and the Express
 * hub run: a foreign `Origin`, a `Host` that is not this machine (DNS
 * rebinding), `Origin: null` and a cross-site request without `Origin` get a
 * `403`, for the panel, `__connection.json`, the SSE endpoint and MCP alike.
 * `--allowed-origin` adds origins. With `--host` on a network address, other
 * machines get through when their `Origin` is allowed or they send none (a
 * device app), as with the Express hub's `allowLan`. The app's dev server
 * named by `--proxy-origin` is allowed too, for a proxy that keeps its
 * `Origin` and `Host`.
 */
export function cliGatePolicy(
  allowedOrigins: readonly string[],
  host: string,
  proxyUrl?: string,
): HubOriginPolicy {
  const proxy = proxyUrl ? new URL(proxyUrl).origin : undefined;
  return {
    allowedOrigins:
      proxy && !allowedOrigins.includes(proxy) ? [...allowedOrigins, proxy] : allowedOrigins,
    remote: listensOnNetwork(host),
  };
}

const REFUSED = 'Pangular Inspector only answers requests from this machine.';
const FIX = 'To answer other machines, pass --host with a network address and --allowed-origin.';

interface GateRequest {
  url: string;
  headers: Headers;
  ip?: string;
  runtime?: { node?: { req?: IncomingMessage } };
}

/** An h3 middleware: a `403` response for a refused request, nothing to go on. */
export function cliRequestGate(policy: HubOriginPolicy, onBlocked?: BlockedRequest) {
  return (event: { req: GateRequest }): Response | undefined => {
    const request = event.req;
    const node = request.runtime?.node?.req;
    const req =
      node ??
      ({
        url: request.url,
        headers: Object.fromEntries(request.headers),
        // Without a peer address (not Node), read the headers as from this machine, as the hub does.
        socket: { remoteAddress: request.ip ?? (policy.remote ? '' : '127.0.0.1') },
      } as unknown as IncomingMessage);
    if (isAllowedHubRequest(req, policy, onBlocked)) return undefined;
    const local = isLoopback(req.socket?.remoteAddress);
    return new Response(local ? REFUSED : `${REFUSED} ${FIX}`, { status: 403 });
  };
}

interface H3App {
  use(middleware: (event: { req: GateRequest }) => Response | undefined): unknown;
}

/**
 * An h3 app with the gate in front, for `createDevServer({ app })`. devframe
 * runs h3 2, which the package does not depend on directly, so the class comes
 * from devframe's own copy.
 */
export async function gatedDevApp(
  policy: HubOriginPolicy,
  warn: (message: string) => void = (message) => console.warn(message),
): Promise<H3App> {
  const require = createRequire(import.meta.url);
  const fromDevframe = createRequire(require.resolve('devframe/package.json'));
  const { H3 } = (await import(pathToFileURL(fromDevframe.resolve('h3')).href)) as {
    H3: new () => H3App;
  };
  const app = new H3();
  app.use(cliRequestGate(policy, blockedOriginReporter(warn)));
  return app;
}
