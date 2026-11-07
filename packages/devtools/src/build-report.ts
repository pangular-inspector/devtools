import { resolve } from 'node:path';
import process from 'node:process';
import { defineDevframe } from 'devframe';
import { createBuild } from 'devframe/adapters/build';
import {
  checkReportOutDir,
  cliHostOptions,
  loadCliConfig,
  looksLikeAngularProject,
  resolveCliRoot,
} from './cli.ts';
import type { PangularConfig } from './config.ts';
import { createPangular } from './devframe.ts';

/** Where `buildReport()` and `pangular build` write the report when no folder is given. */
export const DEFAULT_REPORT_DIR = 'dist-static';

export interface BuildReportOptions {
  /**
   * The folder the report goes into, relative to the working directory.
   * Defaults to `dist-static`, as `pangular build` does. The build empties it
   * first, so it refuses a folder that is not empty and not a previous report,
   * unless `force` is set.
   */
  outDir?: string;
  /** The project folder the source scans read. Defaults to the working directory. */
  root?: string;
  /**
   * The devtools config. Without it, `pangular.config.json` in `root` is read
   * when it exists, as the CLI does.
   */
  config?: PangularConfig;
  /** Empty `outDir` even when it is not a previous report. */
  force?: boolean;
  /** Pretty-print the JSON files of the report, to read or diff them by hand. */
  pretty?: boolean;
  /** A folder with a panel build to copy instead of the one this package ships. */
  distDir?: string;
}

export interface BuildReportResult {
  /** The absolute path of the report folder. */
  outDir: string;
  /** The absolute path of the project folder that was scanned. */
  root: string;
}

/**
 * Writes the static report that `pangular build` writes, from a script: the
 * panel with the source scan baked in (components, routes, signals,
 * providers, pipes, NgRx declarations and build metadata). It does not change
 * the working directory, so it can run inside a Vite or Analog build hook.
 *
 * ```ts
 * import { buildReport } from '@pangular-inspector/devtools/cli';
 *
 * await buildReport({ outDir: 'dist/devtools-report' });
 * ```
 */
export async function buildReport(options: BuildReportOptions = {}): Promise<BuildReportResult> {
  const cwd = process.cwd();
  // No environment: a script passes what it wants, so PANGULAR_ROOT and
  // PANGULAR_CONFIG don't change what it gets.
  const root = resolveCliRoot({ root: options.root }, {}, cwd);
  const outDir = resolve(cwd, options.outDir ?? DEFAULT_REPORT_DIR);
  checkReportOutDir(outDir, { cwd, force: options.force, invokedFrom: root });

  // `allowedOrigins` is a server option, so it stays out of the report's config.
  const { allowedOrigins: _origins, ...config } = (options.config ??
    loadCliConfig({}, root, {}, cwd)) as PangularConfig & { allowedOrigins?: unknown };
  const notAProject = looksLikeAngularProject(root) ? undefined : root;
  if (notAProject) {
    console.warn(
      `[pangular] ${root} has no angular.json and no package.json that depends on @angular/core, so the source scans find nothing. Pass root to buildReport().`,
    );
  }
  const definition = createPangular(
    config,
    cliHostOptions('build', { allowedOrigins: [], authTokens: [] }, notAProject),
  );
  await createBuild(
    defineDevframe({
      ...definition,
      ...(options.distDir ? { clientAssets: resolve(cwd, options.distDir) } : {}),
      // devframe scans its own working directory; the report scans `root`.
      setup: (ctx, info) =>
        definition.setup(Object.assign(ctx, { cwd: root, workspaceRoot: root }), info),
    }),
    { outDir, pretty: options.pretty },
  );
  return { outDir, root };
}
