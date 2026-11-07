---
title: '@pangular-inspector/devtools/cli'
description: 'Every symbol the @pangular-inspector/devtools/cli entry point exports, with its declaration and JSDoc, generated from the package source.'
---

<ngmd-hero title="cli" gradient>
  The symbols <code>&#64;pangular-inspector/devtools/cli</code> exports, generated from the package source.
</ngmd-hero>

# @pangular-inspector/devtools/cli

Import from `@pangular-inspector/devtools/cli`. This page is generated from [`packages/devtools/src/entries/cli.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/entries/cli.ts) and the files it re-exports. Run `pnpm docs:api` after you change the public API.

## buildReport

Function. Source: [`packages/devtools/src/build-report.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/build-report.ts).

Writes the static report that `pangular build` writes, from a script: the
panel with the source scan baked in (components, routes, signals,
providers, pipes, NgRx declarations and build metadata). It does not change
the working directory, so it can run inside a Vite or Analog build hook.

```ts
import {buildReport} from '@pangular-inspector/devtools/cli';

await buildReport({outDir: 'dist/devtools-report'});
```

```ts
async function buildReport(options: BuildReportOptions = {}): Promise<BuildReportResult>;
```

## BuildReportOptions

Interface. Source: [`packages/devtools/src/build-report.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/build-report.ts).

```ts
interface BuildReportOptions {
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
```

## BuildReportResult

Interface. Source: [`packages/devtools/src/build-report.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/build-report.ts).

```ts
interface BuildReportResult {
  /** The absolute path of the report folder. */
  outDir: string;
  /** The absolute path of the project folder that was scanned. */
  root: string;
}
```

## createPangularCli

Function. Source: [`packages/devtools/src/cli.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cli.ts).

The `pangular` command line: `dev` (the default), `build`, `mcp`, `skills`
and `lint`, with `--root`, `--config` and `--read-only` on each.

```ts
function createPangularCli(options: PangularCliOptions = {}): {
  cli: CAC;
  parse(argv?: string[]): Promise<void>;
};
```

## DEFAULT_REPORT_DIR

Constant. Source: [`packages/devtools/src/build-report.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/build-report.ts).

Where `buildReport()` and `pangular build` write the report when no folder is given.

```ts
const DEFAULT_REPORT_DIR: 'dist-static';
```

## PangularCliOptions

Interface. Source: [`packages/devtools/src/cli.ts`](https://github.com/pangular-inspector/devtools/blob/main/packages/devtools/src/cli.ts).

```ts
interface PangularCliOptions {
  env?: Env;
  log?: (message: string) => void;
}
```
