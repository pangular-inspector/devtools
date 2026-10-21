// The package's entry points, split by where they run. `tsdown.config.ts`
// builds each group on its own, so a browser entry never shares a chunk with
// Node-only code: Rolldown puts a module two entries both reach into one
// chunk, and with one build a page could end up importing `node:module`
// through a chunk it shares with the server (#398).

import { builtinModules } from 'node:module';

// An entry that would otherwise export internals points at a file in `src/entries`, which
// re-exports only the documented API. The internals stay importable inside the package.

/**
 * Entries a page, a NativeScript app or an Angular Native app imports, and the
 * ones that only hold types and plain code (`config`, `cd-data`, `plugin`).
 * They are built for the browser and must reach no Node builtin.
 */
export const BROWSER_ENTRIES = {
  config: 'src/entries/config.ts',
  'cd-data': 'src/cd-data.ts',
  popup: 'src/popup.ts',
  // `overlay` starts on import (`overlay-auto.ts`), `overlay-manual` waits
  // for `initOverlay()` (`overlay.ts`).
  overlay: 'src/overlay-auto.ts',
  'overlay-manual': 'src/overlay.ts',
  'capacitor-hook': 'src/capacitor-hook.ts',
  'store-hook': 'src/store-hook.ts',
  'startup-hook': 'src/startup-hook.ts',
  plugin: 'src/plugin.ts',
  'overlay-nativescript': 'src/overlay-nativescript.ts',
  'overlay-angular-native': 'src/overlay-angular-native.ts',
  'signals-stub': 'src/signals-stub.ts',
  http: 'src/entries/http.ts',
} as const;

/** Entries that only run in Node: the servers, the Vite plugin and the CLI. */
export const NODE_ENTRIES = {
  // The published `devframe` entry is a loader too: an Angular 20 server bundle can't take in
  // devframe's own files (`package-loader.ts`), so it loads `devframe-server` at runtime.
  devframe: 'src/entries/devframe-loader.ts',
  'devframe-server': 'src/entries/devframe.ts',
  vite: 'src/entries/vite.ts',
  // The published `hub` entry is a loader that imports no package, so an
  // app's server bundle never takes in the hub's server code (`hub-entry.ts`).
  hub: 'src/entries/hub.ts',
  'hub-server': 'src/hub.ts',
  ssr: 'src/ssr.ts',
  cli: 'src/entries/cli.ts',
} as const;

/** Whether `id` names a Node builtin, such as `node:module`, `fs` or `fs/promises`. */
export function isNodeBuiltin(id: string): boolean {
  return id.startsWith('node:') || builtinModules.includes(id);
}

/** The part of a Rolldown output chunk the graph walk reads. */
export interface GraphChunk {
  readonly type?: string;
  readonly fileName: string;
  readonly name?: string;
  readonly isEntry?: boolean;
  readonly imports?: readonly string[];
  readonly dynamicImports?: readonly string[];
}

/**
 * Every Node builtin an entry chunk reaches through its static and dynamic
 * imports, as `entry: chunk -> chunk -> builtin` lines. Empty when the graph
 * is clean.
 */
export function nodeImportsFromEntries(
  chunks: readonly GraphChunk[],
  entries: readonly string[],
): string[] {
  const byFile = new Map(chunks.filter((c) => c.type !== 'asset').map((c) => [c.fileName, c]));
  const problems: string[] = [];
  for (const entry of entries) {
    const start = [...byFile.values()].find((c) => c.isEntry && c.name === entry);
    if (!start) {
      problems.push(`${entry}: no entry chunk`);
      continue;
    }
    const seen = new Set<string>();
    const walk = (chunk: GraphChunk, path: readonly string[]): void => {
      if (seen.has(chunk.fileName)) return;
      seen.add(chunk.fileName);
      for (const id of [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]) {
        const next = byFile.get(id);
        if (next) walk(next, [...path, next.fileName]);
        else if (isNodeBuiltin(id)) problems.push(`${entry}: ${[...path, id].join(' -> ')}`);
      }
    };
    walk(start, [start.fileName]);
  }
  return problems;
}

/** Throws when a browser entry reaches a Node builtin. Runs after every browser build. */
export function assertBrowserSafe(
  chunks: readonly GraphChunk[],
  entries: readonly string[] = Object.keys(BROWSER_ENTRIES),
): void {
  const problems = nodeImportsFromEntries(chunks, entries);
  if (problems.length) {
    throw new Error(
      `Browser entry points import Node builtins, so apps fail to build:\n  ${problems.join('\n  ')}`,
    );
  }
}

/**
 * Throws when the published `hub` loader reaches a package or a builtin. An
 * app's bundler follows those imports into the server bundle, which is what
 * the loader exists to prevent. Chunks of this build that import nothing
 * more, such as the on/off switch, are fine.
 */
export function assertHubLoaderStandsAlone(chunks: readonly GraphChunk[]): void {
  assertLoaderStandsAlone(chunks, 'hub');
}

/** The published entries that are loaders: they load their server code from the package at runtime. */
export const LOADER_ENTRIES = ['hub', 'devframe'] as const;

/** Throws when the published loader `entry` reaches a package or a builtin. See `assertHubLoaderStandsAlone`. */
export function assertLoaderStandsAlone(chunks: readonly GraphChunk[], entry: string): void {
  const byFile = new Map(chunks.filter((c) => c.type !== 'asset').map((c) => [c.fileName, c]));
  const loader = [...byFile.values()].find((c) => c.isEntry && c.name === entry);
  if (!loader) throw new Error(`No \`${entry}\` entry chunk was built.`);
  const outside: string[] = [];
  const seen = new Set<string>();
  const walk = (chunk: GraphChunk): void => {
    if (seen.has(chunk.fileName)) return;
    seen.add(chunk.fileName);
    for (const id of [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]) {
      const next = byFile.get(id);
      if (next) walk(next);
      else outside.push(`${chunk.fileName} -> ${id}`);
    }
  };
  walk(loader);
  if (outside.length) {
    throw new Error(
      `The published ${entry} loader must not import packages or builtins, but it reaches:\n  ${outside.join('\n  ')}`,
    );
  }
}
