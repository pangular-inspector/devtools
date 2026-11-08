// The module graph of the Vite dev server and the chunk sizes of the last
// production build, for the Build tab and the `module-graph` and
// `chunk-sizes` agent tools. Both are read on request: the dev graph from
// Vite's own module graph (the Vite plugin hands it over through a registry
// on `globalThis`), the chunks from the browser build output on disk.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

/** One module as the Vite dev server knows it. */
export interface GraphModule {
  /** The served URL, such as `/src/app/app.ts`. */
  url: string;
  /** The file, relative to the project root when it is inside it. */
  file?: string;
  type: 'js' | 'css' | 'asset';
  /** Bytes of the transformed code Vite serves; 0 until the module was requested. */
  size: number;
  importers: number;
  imports: number;
  /** URLs this module imports with `import()`. */
  dynamicImports: string[];
}

/** A module loaded with `import()`, and what it pulls in that the entry doesn't. */
export interface LazyBoundary {
  url: string;
  file?: string;
  /** Who imports it lazily, such as `app.routes.ts`. */
  importers: string[];
  /** Modules reached only through this boundary. */
  modules: number;
  /** Their transformed size, unminified. */
  size: number;
}

export interface ViteGraph {
  modules: GraphModule[];
  /** Total transformed size of every module Vite served. */
  totalSize: number;
  /** Modules no other module imports, such as `main.ts`. */
  entries: string[];
  /** Transformed size reachable from the entries without `import()`. */
  initialSize: number;
  lazy: LazyBoundary[];
}

export interface BuildChunk {
  file: string;
  bytes: number;
  gzip: number;
  /** `index.html` loads it before the app starts (a script, a module preload or a stylesheet). */
  initial: boolean;
  type: 'js' | 'css';
  /** The source the chunk starts from, from `stats.json` (`ng build --stats-json`). */
  entryPoint?: string;
  /** Its biggest inputs, from `stats.json`. */
  inputs?: { file: string; bytes: number }[];
}

export interface BuildOutput {
  /** The browser output folder, relative to the project root. */
  dir: string;
  builtAt: number;
  chunks: BuildChunk[];
  initialBytes: number;
  initialGzip: number;
  lazyBytes: number;
  /** Whether a `stats.json` metafile was found next to the output. */
  stats: boolean;
}

export interface BuildGraph {
  vite?: ViteGraph;
  /** Why there is no dev graph. */
  viteNote?: string;
  output?: BuildOutput;
  outputNote?: string;
}

/** The part of a Vite module node the graph reads; `staticImportedUrls` is internal and optional. */
export interface ViteModuleLike {
  url: string;
  file: string | null;
  type: string;
  importers: Set<ViteModuleLike>;
  importedModules: Set<ViteModuleLike>;
  transformResult: { code?: string } | null;
  staticImportedUrls?: Set<string>;
}

export interface ViteGraphSource {
  modules(): Iterable<ViteModuleLike>;
  root: string;
}

export interface BuildRegistry {
  /** Set by the Vite plugin while its dev server runs. */
  vite?: ViteGraphSource;
}

export const MAX_GRAPH_MODULES = 5000;
const MAX_CHUNKS = 500;

export function buildRegistry(): BuildRegistry {
  const g = globalThis as { __PANGULAR_BUILD__?: BuildRegistry };
  return (g.__PANGULAR_BUILD__ ??= {});
}

/** The client module graph of a Vite dev server (`environments.client`, or `moduleGraph` before Vite 6). */
export function viteGraphSource(server: {
  config?: { root?: string };
  environments?: Record<string, { moduleGraph?: { idToModuleMap?: Map<string, unknown> } }>;
  moduleGraph?: { idToModuleMap?: Map<string, unknown> };
}): ViteGraphSource | undefined {
  const graph = server.environments?.['client']?.moduleGraph ?? server.moduleGraph;
  const map = graph?.idToModuleMap;
  if (!map) return undefined;
  return {
    root: server.config?.root ?? process.cwd(),
    modules: () => map.values() as Iterable<ViteModuleLike>,
  };
}

const rel = (root: string, file: string | null): string | undefined => {
  if (!file) return undefined;
  const path = relative(root, file);
  return path && !path.startsWith('..') ? path.split(sep).join('/') : file;
};

const sizeOf = (mod: ViteModuleLike) => mod.transformResult?.code?.length ?? 0;

function isStatic(from: ViteModuleLike, to: ViteModuleLike): boolean {
  // Without Vite's internal list, every import counts as static.
  return from.staticImportedUrls ? from.staticImportedUrls.has(to.url) : true;
}

/** Everything `start` reaches through static imports, `start` included. */
function staticClosure(start: Iterable<ViteModuleLike>): Set<ViteModuleLike> {
  const seen = new Set<ViteModuleLike>();
  const queue = [...start];
  while (queue.length) {
    const mod = queue.pop()!;
    if (seen.has(mod)) continue;
    seen.add(mod);
    for (const next of mod.importedModules) if (isStatic(mod, next)) queue.push(next);
  }
  return seen;
}

/** Reads the dev server's module graph into the shape the panel and tools show. */
export function readViteGraph(source: ViteGraphSource): ViteGraph {
  const all = [...source.modules()].slice(0, MAX_GRAPH_MODULES);
  const entries = all.filter(
    (mod) => mod.type === 'js' && mod.importers.size === 0 && !mod.url.startsWith('/@'),
  );
  const initial = staticClosure(entries);
  const lazyTargets = new Map<ViteModuleLike, Set<ViteModuleLike>>();
  for (const mod of all) {
    for (const next of mod.importedModules) {
      if (isStatic(mod, next)) continue;
      if (!lazyTargets.has(next)) lazyTargets.set(next, new Set());
      lazyTargets.get(next)!.add(mod);
    }
  }
  const lazy: LazyBoundary[] = [...lazyTargets].map(([target, importers]) => {
    const only = [...staticClosure([target])].filter((mod) => !initial.has(mod));
    return {
      url: target.url,
      ...(rel(source.root, target.file) ? { file: rel(source.root, target.file) } : {}),
      importers: [...importers].map((mod) => rel(source.root, mod.file) ?? mod.url),
      modules: only.length,
      size: only.reduce((sum, mod) => sum + sizeOf(mod), 0),
    };
  });
  lazy.sort((a, b) => b.size - a.size);
  const modules: GraphModule[] = all.map((mod) => {
    const file = rel(source.root, mod.file);
    return {
      url: mod.url,
      ...(file ? { file } : {}),
      type: mod.type === 'css' ? 'css' : mod.type === 'asset' ? 'asset' : 'js',
      size: sizeOf(mod),
      importers: mod.importers.size,
      imports: mod.importedModules.size,
      dynamicImports: [...mod.importedModules].filter((n) => !isStatic(mod, n)).map((n) => n.url),
    };
  });
  modules.sort((a, b) => b.size - a.size);
  return {
    modules,
    totalSize: modules.reduce((sum, mod) => sum + mod.size, 0),
    entries: entries.map((mod) => mod.url),
    initialSize: [...initial].reduce((sum, mod) => sum + sizeOf(mod), 0),
    lazy,
  };
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

/**
 * The browser output folder of the app's production build: `outputPath` of
 * the first application in `angular.json` (its `browser` folder), else
 * `dist/browser` or `dist`. `hint` wins when it exists.
 */
export function findBuildOutput(root: string, hint?: string): string | undefined {
  const candidates: string[] = [];
  if (hint) candidates.push(resolve(root, hint));
  const workspace = readJson(join(root, 'angular.json')) as
    | { projects?: Record<string, { projectType?: string; architect?: Record<string, unknown> }> }
    | undefined;
  for (const project of Object.values(workspace?.projects ?? {})) {
    if (project.projectType && project.projectType !== 'application') continue;
    const build = project.architect?.['build'] as
      { options?: { outputPath?: string | { base?: string; browser?: string } } } | undefined;
    const output = build?.options?.outputPath;
    if (typeof output === 'string') {
      candidates.push(join(root, output, 'browser'), join(root, output));
    } else if (output?.base) {
      candidates.push(join(root, output.base, output.browser ?? 'browser'));
    }
  }
  candidates.push(join(root, 'dist', 'browser'), join(root, 'dist'));
  return candidates.find((dir) => existsSync(join(dir, 'index.html')) || hasScripts(dir));
}

function hasScripts(dir: string): boolean {
  try {
    return readdirSync(dir).some((name) => /\.m?js$/.test(name));
  } catch {
    return false;
  }
}

/** Files `index.html` loads up front: scripts, module preloads and stylesheets. */
export function initialFiles(html: string): Set<string> {
  const files = new Set<string>();
  const pattern = /<(script|link)\b[^>]*?(?:src|href)=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(pattern)) {
    const tag = match[0];
    if (match[1]!.toLowerCase() === 'link' && !/rel=["']?(modulepreload|stylesheet)/i.test(tag)) {
      continue;
    }
    const url = match[2]!;
    if (/^[a-z]+:\/\//i.test(url) || url.startsWith('//')) continue;
    files.add(basename(url.split(/[?#]/)[0]!));
  }
  return files;
}

interface Metafile {
  outputs?: Record<
    string,
    { bytes?: number; entryPoint?: string; inputs?: Record<string, { bytesInOutput?: number }> }
  >;
}

/** Lists the JS and CSS chunks of a browser build with their sizes. */
export function readBuildOutput(root: string, dir: string): BuildOutput {
  const html = existsSync(join(dir, 'index.html'))
    ? readFileSync(join(dir, 'index.html'), 'utf8')
    : '';
  const initial = initialFiles(html);
  const metafile = (readJson(join(dir, 'stats.json')) ??
    readJson(join(dirname(dir), 'stats.json'))) as Metafile | undefined;
  const outputs = metafile?.outputs ?? {};
  const byName = new Map(Object.entries(outputs).map(([path, out]) => [basename(path), out]));
  const files = readdirSync(dir)
    .filter((name) => /\.(m?js|css)$/.test(name))
    .slice(0, MAX_CHUNKS);
  let builtAt = 0;
  const chunks: BuildChunk[] = files.map((name) => {
    const path = join(dir, name);
    const stat = statSync(path);
    builtAt = Math.max(builtAt, stat.mtimeMs);
    const content = readFileSync(path);
    const meta = byName.get(name);
    const inputs = Object.entries(meta?.inputs ?? {})
      .map(([file, input]) => ({ file, bytes: input.bytesInOutput ?? 0 }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 5);
    return {
      file: name,
      bytes: stat.size,
      gzip: gzipSync(content).length,
      initial: initial.has(name),
      type: name.endsWith('.css') ? 'css' : 'js',
      ...(meta?.entryPoint ? { entryPoint: meta.entryPoint } : {}),
      ...(inputs.length ? { inputs } : {}),
    };
  });
  chunks.sort((a, b) => Number(b.initial) - Number(a.initial) || b.bytes - a.bytes);
  const sum = (list: BuildChunk[], key: 'bytes' | 'gzip') =>
    list.reduce((total, chunk) => total + chunk[key], 0);
  const first = chunks.filter((chunk) => chunk.initial);
  return {
    dir: rel(root, dir) ?? dir,
    builtAt: Math.round(builtAt),
    chunks,
    initialBytes: sum(first, 'bytes'),
    initialGzip: sum(first, 'gzip'),
    lazyBytes: sum(
      chunks.filter((chunk) => !chunk.initial),
      'bytes',
    ),
    stats: !!metafile?.outputs,
  };
}

/** The dev graph and the build output, each with a note when it is missing. */
export function readBuildGraph(root: string, options: { outputDir?: string } = {}): BuildGraph {
  const graph: BuildGraph = {};
  const source = buildRegistry().vite;
  if (source) {
    try {
      graph.vite = readViteGraph(source);
    } catch {
      graph.viteNote = "Vite's module graph could not be read.";
    }
  } else {
    graph.viteNote =
      'No Vite dev server in this process. The module graph needs the Vite plugin (@pangular-inspector/devtools/vite).';
  }
  const dir = findBuildOutput(root, options.outputDir);
  if (dir) {
    try {
      graph.output = readBuildOutput(root, dir);
    } catch {
      graph.outputNote = `The build output in ${rel(root, dir) ?? dir} could not be read.`;
    }
  } else {
    graph.outputNote =
      'No production build found (the outputPath in angular.json, dist/browser or dist). Run the production build, with --stats-json for the source of each chunk.';
  }
  return graph;
}
