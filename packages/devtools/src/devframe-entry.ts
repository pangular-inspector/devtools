// The loader behind the published `@pangular-inspector/devtools/devframe`
// entry (`entries/devframe-loader.ts`): it imports no package and loads the
// devframe definition (`entries/devframe.ts`, published as
// `dist/devframe-server.mjs`) from the installed package.
// `package-loader.ts` says why devframe's code must not be bundled into an
// app's server, such as an Angular 20 one.

import type * as DevframeServer from './entries/devframe.ts';
import { loadPackageFile, nodeLoaderHost, type PackageLoaderHost } from './package-loader.ts';

const SERVER_FILE = 'dist/devframe-server.mjs';

/**
 * Loads `dist/devframe-server.mjs` from the installed package. The package is
 * found from this module's URL: inside an app's server bundle that is the
 * bundle's folder, where the app's own dependency on this package resolves.
 *
 * @internal
 */
export function loadDevframeServer(
  host: PackageLoaderHost = nodeLoaderHost(import.meta.url),
): typeof DevframeServer {
  return loadPackageFile(SERVER_FILE, 'The devframe entry', host) as typeof DevframeServer;
}
