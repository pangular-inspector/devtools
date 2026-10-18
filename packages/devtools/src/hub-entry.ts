// The published `@pangular-inspector/devtools/hub` entry: a loader that
// imports no package and loads the hub (`hub.ts`, published as
// `dist/hub-server.mjs`) from the installed package when first called.
//
// The Angular CLI bundles `server.ts` and everything it imports. A bundled
// hub breaks in two ways: Angular 20 adds `import { createRequire } from
// 'node:module'` to every server chunk, which collides with the same import
// in devframe's own files, and devframe resolves its optional
// `@devframes/agentic` peer from the bundle's folder, where pnpm does not
// hoist it. Loaded from `node_modules`, the hub and devframe resolve their
// dependencies from their own folders, as they do under Vite.
//
// The load is synchronous (`require()` of an ES module, Node.js 20.19 and
// 22.12 or later), so `initPangularHub()` keeps returning the hub directly.
// The loader may import the dependency-free `hub-off.ts`, so a server with
// the hub off loads nothing more.

import type * as HubServer from './hub.ts';
import type { PangularHubOptions } from './hub.ts';
import { disabledHub, hubEnabled, type PangularHub } from './hub-off.ts';

export type { PangularConfig, PangularHubOptions } from './hub.ts';
export { hubEnabled } from './hub-off.ts';

const PACKAGE_JSON = '@pangular-inspector/devtools/package.json';
const SERVER_FILE = 'dist/hub-server.mjs';

/** The part of Node's `require` the loader uses. */
interface LoaderRequire {
  (id: string): unknown;
  resolve(id: string): string;
}

/**
 * What the loader needs from Node, passed in by tests.
 *
 * @internal
 */
export interface HubLoaderHost {
  /** `createRequire` from `node:module`, or undefined off Node. */
  createRequire?: (from: string) => LoaderRequire;
  /** The URL the loader resolves the package from: its own module. */
  from: string;
  /** `process.versions.node`, when this is Node.js. */
  nodeVersion?: string;
}

/** The `code` of the error `loadHubServer` throws when this Node.js cannot load the hub. */
const NODE_TOO_OLD = 'PANGULAR_NODE_TOO_OLD';

/** Why the hub cannot load on this Node.js, with the versions it needs. */
function nodeTooOld(version: string | undefined, cause?: unknown): Error {
  return Object.assign(
    new Error(
      `[pangular] The hub needs Node.js 20.19, 22.12 or later, which can require() ES modules. This is ${version ? `v${version.replace(/^v/, '')}` : 'an older version'}.`,
      cause === undefined ? undefined : { cause },
    ),
    { code: NODE_TOO_OLD },
  );
}

function nodeHost(): HubLoaderHost {
  const nodeProcess = (
    globalThis as {
      process?: {
        getBuiltinModule?: (id: string) => unknown;
        versions?: { node?: string };
      };
    }
  ).process;
  const nodeModule = nodeProcess?.getBuiltinModule?.('node:module') as
    { createRequire: (from: string) => LoaderRequire } | undefined;
  return {
    createRequire: nodeModule?.createRequire,
    from: import.meta.url,
    nodeVersion: nodeProcess?.versions?.node,
  };
}

/**
 * Loads `dist/hub-server.mjs` from the installed package. The package is
 * found from this module's URL: inside an app's server bundle that is the
 * bundle's folder, where the app's own dependency on this package resolves.
 *
 * @internal
 */
export function loadHubServer(host: HubLoaderHost = nodeHost()): typeof HubServer {
  if (!host.createRequire) {
    // Node.js before 22.3 (and 20.16) has no `process.getBuiltinModule`.
    if (host.nodeVersion) throw nodeTooOld(host.nodeVersion);
    throw new Error('[pangular] initPangularHub() runs in Node.js only.');
  }
  const requireHere = host.createRequire(host.from);
  let packageJson: string;
  try {
    packageJson = requireHere.resolve(PACKAGE_JSON);
  } catch (error) {
    throw new Error(
      `[pangular] Could not find @pangular-inspector/devtools from ${host.from}. Install it as a dependency of the app that runs the server.`,
      { cause: error },
    );
  }
  const file = packageJson.slice(0, -'package.json'.length) + SERVER_FILE;
  try {
    return requireHere(file) as typeof HubServer;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'ERR_REQUIRE_ESM') {
      throw nodeTooOld(
        host.nodeVersion ?? (globalThis as { process?: { version?: string } }).process?.version,
        error,
      );
    }
    throw error;
  }
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
