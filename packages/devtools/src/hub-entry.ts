// The published `@pangular-inspector/devtools/hub` entry: a loader that
// imports no package and loads the hub (`hub.ts`, published as
// `dist/hub-server.mjs`) from the installed package when first called.
// `package-loader.ts` says why the hub must not be bundled into an app's
// server. The loader may import the dependency-free `hub-off.ts`, so a server
// with the hub off loads nothing more.

import type * as HubServer from './hub.ts';
import type { PangularHubOptions } from './hub.ts';
import { disabledHub, hubEnabled, type PangularHub } from './hub-off.ts';
import {
  NODE_TOO_OLD,
  loadPackageFile,
  nodeLoaderHost,
  type PackageLoaderHost,
} from './package-loader.ts';

export type { PangularConfig, PangularHubOptions } from './hub.ts';
export { hubEnabled } from './hub-off.ts';

const SERVER_FILE = 'dist/hub-server.mjs';

/**
 * What the loader needs from Node, passed in by tests.
 *
 * @internal
 */
export type HubLoaderHost = PackageLoaderHost;

/**
 * Loads `dist/hub-server.mjs` from the installed package. The package is
 * found from this module's URL: inside an app's server bundle that is the
 * bundle's folder, where the app's own dependency on this package resolves.
 *
 * @internal
 */
export function loadHubServer(
  host: HubLoaderHost = nodeLoaderHost(import.meta.url),
): typeof HubServer {
  return loadPackageFile(SERVER_FILE, 'The hub', host) as typeof HubServer;
}

let server: typeof HubServer | undefined;
const hubServer = (): typeof HubServer => (server ??= loadHubServer());

/** The default hub base, `/__devframes/`. */
export const PANGULAR_HUB_BASE = '/__devframes/';

/** A hub base with one leading and one trailing slash, as the hub normalizes it. */
function hubBase(base: string): string {
  return `/${base}/`.replace(/\/{2,}/g, '/');
}

/**
 * Mounts the devtools hub in an Express or Connect server, behind the request
 * gate: loopback requests only (unless `allowLan`), a loopback or allowed
 * `Host`, and the origin check. Off in production unless `enabled` is `true`.
 * When off, the hub's server code is not loaded at all.
 */
export function initPangularHub(options: PangularHubOptions = {}): PangularHub {
  // The hub warns about `enabled: true` in production itself.
  const base = hubBase(options.base ?? PANGULAR_HUB_BASE);
  if (!hubEnabled(options.enabled, undefined, () => undefined)) return disabledHub(base);
  let loaded: typeof HubServer;
  try {
    loaded = hubServer();
  } catch (error) {
    // A Node.js that cannot load the hub must not take the app's server down with it: the app
    // runs on without the devtools, and the log says why.
    if ((error as { code?: string }).code !== NODE_TOO_OLD) throw error;
    console.warn(
      `\n  ${(error as Error).message}\n  The devtools hub is off; the app runs without it.\n`,
    );
    return disabledHub(base);
  }
  return loaded.initPangularHub(options);
}

/** @internal */
export function startPangularHub(
  ...args: Parameters<typeof HubServer.startPangularHub>
): ReturnType<typeof HubServer.startPangularHub> {
  return hubServer().startPangularHub(...args);
}

/** The request gate for the Express hub. See `hub.ts`. */
export function hubGatePolicy(
  ...args: Parameters<typeof HubServer.hubGatePolicy>
): ReturnType<typeof HubServer.hubGatePolicy> {
  return hubServer().hubGatePolicy(...args);
}

/** The origin check the hub runs. See `hub.ts`. */
export function hubAllowedOrigins(
  ...args: Parameters<typeof HubServer.hubAllowedOrigins>
): ReturnType<typeof HubServer.hubAllowedOrigins> {
  return hubServer().hubAllowedOrigins(...args);
}

/** The hub's default origin check, loaded on first use. */
export const hubDefaultOrigins: typeof HubServer.hubDefaultOrigins = {
  get token() {
    return hubServer().hubDefaultOrigins.token;
  },
  registerFromUrl: (url) => hubServer().hubDefaultOrigins.registerFromUrl(url),
  isAllowed: (origin) => hubServer().hubDefaultOrigins.isAllowed(origin),
};
