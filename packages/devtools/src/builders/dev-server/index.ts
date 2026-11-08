// The `@pangular-inspector/devtools:dev-server` builder: `ng serve` with the
// devtools hub mounted, so an Angular CLI app without an Express `server.ts`
// gets the panel without a second server or a proxy.
//
// It runs the Angular CLI's own dev server (`@angular/build:dev-server`, or
// `@angular-devkit/build-angular:dev-server`) through its documented
// `executeDevServerBuilder()` and hands it the hub's middleware in
// `extensions.middleware`. That builder validates the serve options against
// its own schema, so its defaults and checks stay the same.
//
// The Angular CLI loads builders with `require()`, so the build ships this file
// as CommonJS. The Angular packages are not dependencies of this package: they
// are loaded from the workspace, the way the CLI resolves the builder.
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { BuilderContext, BuilderOutput } from '@angular-devkit/architect';

/** The builder's own options; every other option goes to the dev server it runs. */
export interface DevServerOptions {
  /** The dev server builder to run. Defaults to the first of `DEV_SERVERS` the workspace has. */
  builder?: string;
  /** Mount the hub. On by default. */
  devtools?: boolean;
  [option: string]: unknown;
}

/** The dev servers this builder can run, in the order it looks for them. */
export const DEV_SERVERS = [
  '@angular/build:dev-server',
  '@angular-devkit/build-angular:dev-server',
] as const;

/** The hub's base, where the panel answers on the dev server's origin. */
const HUB_BASE = '/__devframes/';

type Middleware = (req: unknown, res: unknown, next: (error?: unknown) => void) => void;

interface DevServerExtensions {
  middleware?: Middleware[];
}

/** The part of a dev server package this builder calls. */
export interface DevServerPackage {
  executeDevServerBuilder(
    options: Record<string, unknown>,
    context: BuilderContext,
    ...rest: unknown[]
  ): AsyncIterable<BuilderOutput>;
}

/** The part of the hub this builder uses. */
export interface DevServerHub {
  enabled: boolean;
  base: string;
  nodeMiddleware: Middleware;
  close(): Promise<void>;
}

/** What the builder loads, passed in by tests. */
export interface DevServerHost {
  /** Loads a package from the workspace, or `undefined` when it is not installed. */
  load(name: string, workspaceRoot: string): unknown;
  /** Starts the hub (`initPangularHub` from `@pangular-inspector/devtools/hub`). */
  startHub(): Promise<DevServerHub>;
}

/** Loads `name` from this package's own location, then from the workspace root. */
function loadPackage(name: string, workspaceRoot: string): unknown {
  // `__filename` exists in the CommonJS build the Angular CLI loads; the ES module tests lack it.
  const own = typeof __filename === 'string' ? [__filename] : [];
  for (const from of [...own, join(workspaceRoot, 'package.json')]) {
    try {
      return createRequire(from)(name);
    } catch (error) {
      if ((error as { code?: string }).code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  return undefined;
}

export const nodeDevServerHost: DevServerHost = {
  load: loadPackage,
  startHub: async () => {
    // The published hub entry, which loads the hub's server code on first use.
    const hub = (await import('@pangular-inspector/devtools/hub')) as {
      initPangularHub(options: { ws: false }): DevServerHub;
    };
    // `ws: false`: the dev server hands out no upgrade hook, so the panel and
    // the overlay talk to the hub over server-sent events.
    return hub.initPangularHub({ ws: false });
  },
};

/** The package of a builder name, such as `@angular/build` for `@angular/build:dev-server`. */
function packageOf(builder: string): string {
  return builder.slice(0, builder.lastIndexOf(':'));
}

function isDevServerPackage(value: unknown): value is DevServerPackage {
  return (
    !!value &&
    typeof (value as { executeDevServerBuilder?: unknown }).executeDevServerBuilder === 'function'
  );
}

/** The dev server to run: the one named in the options, or the first one installed. */
export function pickDevServer(
  builder: string | undefined,
  workspaceRoot: string,
  host: DevServerHost,
): { name: string; devServer: DevServerPackage } | { error: string } {
  const names = builder ? [builder] : DEV_SERVERS;
  for (const name of names) {
    const loaded = host.load(packageOf(name), workspaceRoot);
    if (isDevServerPackage(loaded)) return { name, devServer: loaded };
    if (builder && loaded !== undefined) {
      return {
        error: `[pangular] ${builder} has no executeDevServerBuilder(), so the devtools cannot run it. Use ${DEV_SERVERS.join(' or ')}.`,
      };
    }
  }
  return {
    error: builder
      ? `[pangular] Could not load ${packageOf(builder)} from the workspace. Install it, or set "builder" to one that is installed.`
      : `[pangular] Neither ${DEV_SERVERS.map(packageOf).join(' nor ')} is installed in the workspace, so there is no dev server to run.`,
  };
}

/**
 * The extensions for `executeDevServerBuilder()`: the third argument of
 * `@angular/build`'s, the fourth of `@angular-devkit/build-angular`'s, which
 * takes webpack transforms first.
 */
export function devServerArguments(
  name: string,
  extensions: DevServerExtensions | undefined,
): unknown[] {
  if (!extensions) return [];
  return packageOf(name) === '@angular-devkit/build-angular'
    ? [undefined, extensions]
    : [extensions];
}

/** The panel's URL on the dev server's origin. */
export function devtoolsUrl(baseUrl: unknown, base = HUB_BASE): string | undefined {
  if (typeof baseUrl !== 'string' || !URL.canParse(baseUrl)) return undefined;
  return `${new URL(baseUrl).origin}${base}`;
}

/**
 * Warns when the build target uses the webpack `browser` builder: its dev
 * server takes no middleware, so the hub would not be reachable.
 */
async function warnOnWebpack(context: BuilderContext, buildTarget: unknown): Promise<void> {
  if (typeof buildTarget !== 'string' || !context.target) return;
  const [project, target] = buildTarget.split(':');
  try {
    const builder = await context.getBuilderNameForTarget({
      project: project || context.target.project,
      target: target || 'build',
    });
    if (/:(browser|karma)$/.test(builder)) {
      context.logger.warn(
        `[pangular] ${builder} is a webpack build: its dev server takes no middleware, so the devtools hub is not reachable. Use the application builder, or run the standalone CLI next to ng serve.`,
      );
    }
  } catch {
    // The dev server reports a missing or broken build target itself.
  }
}

/**
 * Runs the dev server with the hub's middleware. The hub stops when the dev
 * server does.
 */
export async function* runDevServer(
  options: DevServerOptions,
  context: BuilderContext,
  host: DevServerHost = nodeDevServerHost,
): AsyncIterable<BuilderOutput> {
  const { builder, devtools = true, ...serveOptions } = options;
  const picked = pickDevServer(builder, context.workspaceRoot, host);
  if ('error' in picked) {
    context.logger.error(picked.error);
    yield { success: false, error: picked.error };
    return;
  }
  // The options come from angular.json and the command line, so they are JSON.
  const json = serveOptions as Parameters<BuilderContext['validateOptions']>[0];
  const validated = await context.validateOptions(json, picked.name);
  let hub: DevServerHub | undefined;
  if (devtools) {
    const started = await host.startHub();
    // Off with NODE_ENV=production; the dev server then runs without it.
    if (started.enabled) hub = started;
    else await started.close();
    if (hub) await warnOnWebpack(context, validated['buildTarget']);
  }
  let closing: Promise<void> | undefined;
  const closeHub = () => (closing ??= hub?.close() ?? Promise.resolve());
  // The CLI stops a dev server through its teardowns, while the dev server
  // still waits inside its iterator, so the `finally` below would not run yet.
  if (hub) context.addTeardown(closeHub);
  const extensions = hub ? { middleware: [hub.nodeMiddleware] } : undefined;
  let announced = false;
  try {
    for await (const output of picked.devServer.executeDevServerBuilder(
      validated,
      context,
      ...devServerArguments(picked.name, extensions),
    )) {
      const url = hub && devtoolsUrl(output['baseUrl'], hub.base);
      if (url && output.success && !announced) {
        announced = true;
        context.logger.info(`  ➜  Pangular Inspector: ${url}`);
      }
      yield output;
    }
  } finally {
    await closeHub();
  }
}

interface Architect {
  createBuilder<T>(
    handler: (options: T, context: BuilderContext) => AsyncIterable<BuilderOutput>,
  ): unknown;
}

/**
 * `@angular-devkit/architect`, from the dev server package that brings it, so
 * the builder's marker comes from the same architect the Angular CLI runs.
 */
function loadArchitect(workspaceRoot: string): Architect {
  const own = loadPackage('@angular-devkit/architect', workspaceRoot) as Architect | undefined;
  if (own) return own;
  for (const name of DEV_SERVERS) {
    try {
      const from = createRequire(join(workspaceRoot, 'package.json')).resolve(
        `${packageOf(name)}/package.json`,
      );
      return createRequire(from)('@angular-devkit/architect') as Architect;
    } catch {
      // Not installed; try the next one.
    }
  }
  throw new Error(
    '[pangular] Could not load @angular-devkit/architect. Run the builder from an Angular CLI workspace.',
  );
}

/** The builder the Angular CLI loads (`builder.ts` exports it), marked by the workspace's architect. */
export function createDevServerBuilder(
  workspaceRoot = process.cwd(),
  host: DevServerHost = nodeDevServerHost,
): unknown {
  return loadArchitect(workspaceRoot).createBuilder<DevServerOptions>((options, context) =>
    runDevServer(options, context, host),
  );
}
