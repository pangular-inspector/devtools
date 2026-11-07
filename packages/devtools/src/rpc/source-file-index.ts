// Pipe scans read and parse every source file, and the panel, explain-pipe,
// the lint and the audit ask for them often. This keeps each file's parsed
// result until the file (or a template it reads) changes: by its mtime and
// size, or, when the Vite plugin runs and its watcher covers every source
// root, until the watcher sees any change, which skips the walk as well.

import { statSync, readFileSync, type Stats } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { viteWatchVersion } from './analog-scan-cache.ts';
import { escapes, realPath, relativeFile, sourceRoots, walkFiles } from './source-scan.ts';

export interface SourceFile {
  /** Absolute path. */
  full: string;
  /** Path relative to the workspace, with forward slashes. */
  relPath: string;
  content: string;
}

export interface ParsedFile<T> {
  value: T;
  /** Other files the result was read from, such as a `templateUrl`, by absolute path. */
  deps?: readonly string[];
}

interface Entry<T> {
  key: string;
  deps: { path: string; key: string }[];
  value: T;
}

interface Scan<T> {
  files: Map<string, Entry<T>>;
  /** The Vite watcher's version when `last` was built. */
  version?: number;
  last?: T[];
}

const scans = new Map<string, Scan<unknown>>();

function keyOf(stats: Pick<Stats, 'mtimeMs' | 'ctimeMs' | 'size' | 'ino'>): string {
  return `${stats.mtimeMs}:${stats.ctimeMs}:${stats.size}:${stats.ino}`;
}

function statKey(path: string): string {
  try {
    return keyOf(statSync(path));
  } catch {
    return 'missing';
  }
}

/** Whether the Vite watcher sees every file under `roots`. */
function watcherCovers(roots: readonly string[]): boolean {
  const shared = viteWatchVersion();
  if (!shared.watched || !shared.root) return false;
  const root = realPath(shared.root);
  return roots.every((dir) => {
    const inside = relative(root, realPath(dir));
    return !escapes(inside) && !isAbsolute(inside);
  });
}

/**
 * Every `.ts` source file (not `.spec.ts`) under the workspace's source roots,
 * parsed by `parse`, in walk order. `kind` names the parse, so two scans with
 * different parses keep separate results; put anything else the parse depends
 * on (such as the Angular version) in it too.
 */
export function scanSourceFiles<T>(
  cwd: string,
  kind: string,
  parse: (file: SourceFile) => ParsedFile<T>,
): T[] {
  const id = `${realPath(cwd)}\0${kind}`;
  let scan = scans.get(id) as Scan<T> | undefined;
  if (!scan) {
    scan = { files: new Map() };
    scans.set(id, scan as Scan<unknown>);
  }
  const roots = sourceRoots(cwd);
  const shared = viteWatchVersion();
  const covered = watcherCovers(roots);
  if (covered && scan.last && scan.version === shared.version) return scan.last;
  const version = shared.version;

  const out: T[] = [];
  const seen = new Set<string>();
  for (const root of roots) {
    walkFiles(root, (full, entry, stats) => {
      if (!entry.endsWith('.ts') || entry.endsWith('.spec.ts')) return;
      seen.add(full);
      const key = keyOf(stats);
      const cached = scan.files.get(full);
      if (
        cached &&
        cached.key === key &&
        cached.deps.every((dep) => statKey(dep.path) === dep.key)
      ) {
        out.push(cached.value);
        return;
      }
      try {
        const content = readFileSync(full, 'utf-8');
        const parsed = parse({ full, relPath: relativeFile(cwd, full), content });
        const deps = (parsed.deps ?? []).map((path) => ({ path, key: statKey(path) }));
        scan.files.set(full, { key, deps, value: parsed.value });
        out.push(parsed.value);
      } catch {
        scan.files.delete(full);
      }
    });
  }
  for (const full of scan.files.keys()) if (!seen.has(full)) scan.files.delete(full);
  scan.last = out;
  scan.version = covered ? version : undefined;
  return out;
}

/** For tests: forgets every kept result. */
export function clearSourceFileIndex(): void {
  scans.clear();
}
