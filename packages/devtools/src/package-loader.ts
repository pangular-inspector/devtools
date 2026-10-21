// Loads one of this package's built files from the installed package, at
// runtime, instead of through an import an app's bundler would follow.
//
// The Angular CLI bundles `server.ts` and everything it imports. Bundled
// devframe code breaks in two ways: Angular 20 adds `import { createRequire }
// from 'node:module'` to every server chunk, which collides with the same
// import in devframe's own files, and devframe resolves its optional
// `@devframes/agentic` peer from the bundle's folder, where pnpm does not
// hoist it. Loaded from `node_modules`, the hub and the devframe definition
// resolve their dependencies from their own folders, as they do under Vite.
//
// The load is synchronous (`require()` of an ES module, Node.js 20.19 and
// 22.12 or later), so the entries keep returning their values directly. This
// module imports nothing at runtime.

const PACKAGE_JSON = '@pangular-inspector/devtools/package.json';

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
export interface PackageLoaderHost {
  /** `createRequire` from `node:module`, or undefined off Node. */
  createRequire?: (from: string) => LoaderRequire;
  /** The URL the loader resolves the package from: its own module. */
  from: string;
  /** `process.versions.node`, when this is Node.js. */
  nodeVersion?: string;
}

/** The `code` of the error `loadPackageFile` throws when this Node.js cannot load the file. */
export const NODE_TOO_OLD = 'PANGULAR_NODE_TOO_OLD';

/** Why `what` cannot load on this Node.js, with the versions it needs. */
function nodeTooOld(what: string, version: string | undefined, cause?: unknown): Error {
  return Object.assign(
    new Error(
      `[pangular] ${what} needs Node.js 20.19, 22.12 or later, which can require() ES modules. This is ${version ? `v${version.replace(/^v/, '')}` : 'an older version'}.`,
      cause === undefined ? undefined : { cause },
    ),
    { code: NODE_TOO_OLD },
  );
}

/** The host for the running Node.js, resolving the package from `from`. */
export function nodeLoaderHost(from: string): PackageLoaderHost {
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
    from,
    nodeVersion: nodeProcess?.versions?.node,
  };
}

/**
 * Loads `file` (such as `dist/hub-server.mjs`) from the installed package.
 * The package is found from `host.from`: inside an app's server bundle that
 * is the bundle's folder, where the app's own dependency on this package
 * resolves. `what` names the caller in errors, such as "The hub".
 *
 * @internal
 */
export function loadPackageFile(file: string, what: string, host: PackageLoaderHost): unknown {
  if (!host.createRequire) {
    // Node.js before 22.3 (and 20.16) has no `process.getBuiltinModule`.
    if (host.nodeVersion) throw nodeTooOld(what, host.nodeVersion);
    throw new Error(`[pangular] ${what} runs in Node.js only.`);
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
  const path = packageJson.slice(0, -'package.json'.length) + file;
  try {
    return requireHere(path);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'ERR_REQUIRE_ESM') {
      throw nodeTooOld(
        what,
        host.nodeVersion ?? (globalThis as { process?: { version?: string } }).process?.version,
        error,
      );
    }
    throw error;
  }
}
