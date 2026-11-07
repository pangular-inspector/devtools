// Build analysis for an Analog app: after `analog build`, the client chunks in
// dist/analog/public with their sizes, the chunk each page compiles to, what it
// loads up front beyond the entry and the lazy chunks it can pull in.

import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { flattenRoutes, type AnalogProject } from './analog-scan.ts';

export interface BuildChunk {
  /** Path in the public folder, such as `assets/index.page-B2x.js`. */
  file: string;
  kind: 'js' | 'css';
  size: number;
  gzip: number;
}

export interface BuildRoute {
  path: string;
  /** The page file, as a project path. */
  file: string;
  /** The chunk the page compiles to, when it was found. */
  chunk?: string;
  /** Bytes of the page chunk and the chunks it imports that the entry does not load. */
  size: number;
  gzip: number;
  /** Chunks the page imports up front, beyond the entry. */
  shared: string[];
  /** Chunks the page can load later with `import()`. */
  lazy: string[];
  /** How the chunk was found: the Vite manifest, or the chunk name. */
  matchedBy?: 'manifest' | 'name';
}

export interface BuildAnalysis {
  found: boolean;
  /** The public folder that was read, relative to the project root. */
  dir?: string;
  builtAt?: number;
  manifest: boolean;
  entry?: { chunk: string; size: number; gzip: number };
  totals: { js: number; css: number; jsGzip: number; cssGzip: number; chunks: number };
  /** The largest chunks first. */
  chunks: BuildChunk[];
  routes: BuildRoute[];
  notes: string[];
}

interface ManifestEntry {
  file?: string;
  src?: string;
  isEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
}

const MAX_CHUNKS = 400;
/** Gzip sizes by file, path and mtime, so asking again after no build skips the gzip. */
const gzipCache = new Map<string, number>();

function gzipSize(full: string, mtime: number, code: Buffer): number {
  const key = `${full}:${mtime}:${code.length}`;
  let size = gzipCache.get(key);
  if (size === undefined) {
    size = gzipSync(code).length;
    if (gzipCache.size > 2000) gzipCache.clear();
    gzipCache.set(key, size);
  }
  return size;
}
const SHOWN_CHUNKS = 60;
const MAX_READ = 5_000_000;

function posix(path: string): string {
  return path.split('\\').join('/');
}

function listFiles(dir: string, out: string[] = [], depth = 0): string[] {
  if (depth > 6 || out.length >= MAX_CHUNKS) return out;
  let names: string[];
  try {
    names = readdirSync(dir).sort();
  } catch {
    return out;
  }
  for (const name of names) {
    const full = join(dir, name);
    try {
      const stats = lstatSync(full);
      if (stats.isSymbolicLink()) continue;
      if (stats.isDirectory()) listFiles(full, out, depth + 1);
      else if (/\.(m?js|css)$/.test(name)) out.push(full);
    } catch {
      continue;
    }
    if (out.length >= MAX_CHUNKS) break;
  }
  return out;
}

/** The client build folder: Analog's `dist/analog/public`, or the same under an Nx `dist`. */
export function publicDir(root: string, workspace = root): string | undefined {
  return [
    join(root, 'dist/analog/public'),
    join(workspace, 'dist', relative(workspace, root), 'analog/public'),
  ].find((candidate) => existsSync(candidate));
}

function readManifest(root: string, dir: string): Record<string, ManifestEntry> | undefined {
  for (const file of [
    join(dir, '.vite/manifest.json'),
    join(dir, 'manifest.json'),
    join(root, 'dist/client/.vite/manifest.json'),
  ]) {
    try {
      const value = JSON.parse(readFileSync(file, 'utf-8'));
      if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    } catch {
      continue;
    }
  }
  return undefined;
}

const STATIC_IMPORT = /\bimport\s*(?:[\w${}\s,*]+from\s*)?["'](\.{1,2}\/[^"']+)["']/g;
const DYNAMIC_IMPORT = /\bimport\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;

function resolveFrom(file: string, spec: string): string {
  const parts = file.split('/').slice(0, -1);
  for (const part of spec.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

/** The relative imports of a built chunk, read from its code. */
export function chunkImports(file: string, code: string): { imports: string[]; lazy: string[] } {
  const imports = new Set<string>();
  const lazy = new Set<string>();
  for (const match of code.matchAll(DYNAMIC_IMPORT)) lazy.add(resolveFrom(file, match[1]));
  const withoutDynamic = code.replace(DYNAMIC_IMPORT, '');
  for (const match of withoutDynamic.matchAll(STATIC_IMPORT)) {
    imports.add(resolveFrom(file, match[1]));
  }
  return { imports: [...imports], lazy: [...lazy] };
}

function closure(start: string, graph: Map<string, string[]>, seen = new Set<string>()) {
  const stack = [start];
  while (stack.length) {
    const next = stack.pop()!;
    if (seen.has(next)) continue;
    seen.add(next);
    stack.push(...(graph.get(next) ?? []));
  }
  return seen;
}

/** A chunk name without its hash and extension: `index.page-B2x9.js` gives `indexpage`. */
function stem(name: string): string {
  return name
    .replace(/\.(m?js|css)$/, '')
    .replace(/-[\w-]{6,12}$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function entryChunk(dir: string, files: string[]): string | undefined {
  try {
    const html = readFileSync(join(dir, 'index.html'), 'utf-8');
    const src = html.match(/<script[^>]*type=["']module["'][^>]*src=["']\/?([^"']+)["']/);
    if (src && files.includes(src[1])) return src[1];
  } catch {
    // No index.html: fall back on the chunk name.
  }
  return files.find((file) => /(^|\/)(index|main)-[\w-]+\.js$/.test(file));
}

/** Reads the last client build of an Analog app. `found` is false before the first build. */
export function analyzeBuild(project: Pick<AnalogProject, 'root' | 'routes'>, workspace?: string) {
  const root = project.root;
  const dir = publicDir(root, workspace);
  const empty: BuildAnalysis = {
    found: false,
    manifest: false,
    totals: { js: 0, css: 0, jsGzip: 0, cssGzip: 0, chunks: 0 },
    chunks: [],
    routes: [],
    notes: [],
  };
  if (!dir) return empty;
  const fullFiles = listFiles(dir);
  const chunks: BuildChunk[] = [];
  const graph = new Map<string, string[]>();
  const lazyOf = new Map<string, string[]>();
  let builtAt = 0;
  for (const full of fullFiles) {
    const file = posix(relative(dir, full));
    let code: Buffer;
    let mtime = 0;
    try {
      const stats = statSync(full);
      mtime = stats.mtimeMs;
      builtAt = Math.max(builtAt, stats.mtimeMs);
      if (stats.size > MAX_READ) {
        chunks.push({
          file,
          kind: file.endsWith('.css') ? 'css' : 'js',
          size: stats.size,
          gzip: 0,
        });
        continue;
      }
      code = readFileSync(full);
    } catch {
      continue;
    }
    const kind = file.endsWith('.css') ? 'css' : 'js';
    chunks.push({ file, kind, size: code.length, gzip: gzipSize(full, mtime, code) });
    if (kind === 'js') {
      const { imports, lazy } = chunkImports(file, code.toString('utf-8'));
      graph.set(file, imports);
      lazyOf.set(file, lazy);
    }
  }
  const byFile = new Map(chunks.map((chunk) => [chunk.file, chunk]));
  const sizeOf = (files: Iterable<string>) => {
    let size = 0;
    let gzip = 0;
    for (const file of files) {
      size += byFile.get(file)?.size ?? 0;
      gzip += byFile.get(file)?.gzip ?? 0;
    }
    return { size, gzip };
  };
  const manifest = readManifest(root, dir);
  const notes: string[] = [];
  const jsFiles = chunks.filter((c) => c.kind === 'js').map((c) => c.file);
  let entry = entryChunk(dir, jsFiles);
  if (manifest) {
    const own = Object.values(manifest).find((m) => m.isEntry && m.file?.endsWith('.js'));
    if (own?.file && byFile.has(own.file)) entry = own.file;
  }
  const baseline = entry ? closure(entry, graph) : new Set<string>();
  const pages = flattenRoutes(project.routes).filter(
    (route) => route.file && (route.kind === 'page' || route.kind === 'layout'),
  );
  const routes: BuildRoute[] = pages.map((route) => {
    const file = route.file!;
    let chunk: string | undefined;
    let matchedBy: BuildRoute['matchedBy'];
    const fromManifest = manifest?.[file.replace(/^\//, '')]?.file;
    if (fromManifest && byFile.has(fromManifest)) {
      chunk = fromManifest;
      matchedBy = 'manifest';
    } else {
      const want = stem(
        file
          .split('/')
          .pop()!
          .replace(/\.(ts|analog|ag)$/, '.js'),
      );
      const found = jsFiles.filter((c) => stem(c.split('/').pop()!) === want);
      // Several pages share a name (index.page.ts): only a unique match counts.
      if (found.length === 1) {
        chunk = found[0];
        matchedBy = 'name';
      }
    }
    if (!chunk) {
      return { path: route.fullPath, file, size: 0, gzip: 0, shared: [], lazy: [] };
    }
    const own = [...closure(chunk, graph)].filter((c) => !baseline.has(c));
    return {
      path: route.fullPath,
      file,
      chunk,
      ...sizeOf(own),
      shared: own.filter((c) => c !== chunk),
      lazy: (lazyOf.get(chunk) ?? []).filter((c) => byFile.has(c)),
      matchedBy,
    };
  });
  if (!manifest && routes.some((r) => !r.chunk)) {
    notes.push(
      'Some pages share a chunk name, so their chunk was not found. Set build.manifest: true in vite.config to map every page.',
    );
  }
  if (fullFiles.length >= MAX_CHUNKS) notes.push(`Only the first ${MAX_CHUNKS} files were read.`);
  const js = chunks.filter((c) => c.kind === 'js');
  const css = chunks.filter((c) => c.kind === 'css');
  return {
    found: true,
    dir: posix(relative(root, dir)) || '.',
    builtAt: Math.round(builtAt),
    manifest: !!manifest,
    ...(entry ? { entry: { chunk: entry, ...sizeOf(baseline) } } : {}),
    totals: {
      js: sizeOf(js.map((c) => c.file)).size,
      css: sizeOf(css.map((c) => c.file)).size,
      jsGzip: sizeOf(js.map((c) => c.file)).gzip,
      cssGzip: sizeOf(css.map((c) => c.file)).gzip,
      chunks: chunks.length,
    },
    chunks: [...chunks].sort((a, b) => b.size - a.size).slice(0, SHOWN_CHUNKS),
    routes,
    notes,
  } satisfies BuildAnalysis;
}

function kb(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
}

/** Markdown for the `analog-scan-build` agent tool. */
export function analogBuildText(analysis: BuildAnalysis): string {
  if (!analysis.found) {
    return 'No client build found in dist/analog/public. Run `analog build` (or `vite build`) first, then ask again.';
  }
  const lines = [
    `## Analog build (${analysis.dir})`,
    '',
    `${analysis.totals.chunks} files: JS ${kb(analysis.totals.js)} (${kb(analysis.totals.jsGzip)} gzip), CSS ${kb(analysis.totals.css)} (${kb(analysis.totals.cssGzip)} gzip).`,
  ];
  if (analysis.entry) {
    lines.push(
      `Entry ${analysis.entry.chunk} loads ${kb(analysis.entry.size)} (${kb(analysis.entry.gzip)} gzip) with its imports.`,
    );
  }
  lines.push(
    '',
    '### Pages',
    '',
    '| Route | Page chunk | Beyond the entry | Lazy chunks |',
    '| --- | --- | --- | --- |',
  );
  for (const route of analysis.routes) {
    lines.push(
      `| ${route.path} | ${route.chunk ?? 'not found'} | ${route.chunk ? `${kb(route.size)} (${kb(route.gzip)} gzip)` : ''} | ${route.lazy.join(', ')} |`,
    );
  }
  lines.push('', '### Largest chunks', '');
  for (const chunk of analysis.chunks.slice(0, 15)) {
    lines.push(`- ${chunk.file}: ${kb(chunk.size)} (${kb(chunk.gzip)} gzip)`);
  }
  for (const note of analysis.notes) lines.push('', `Note: ${note}`);
  return lines.join('\n');
}
