import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { sourceRoots, stripComments, walkFiles } from './source-scan.ts';

export interface ServerRouteEntry {
  path: string;
  renderMode: string;
  file: string;
}

const MAX_FILES = 20;
const ENTRY =
  /\{[^{}]*?\bpath\s*:\s*(['"`])([^'"`]*)\1[^{}]*?\brenderMode\s*:\s*RenderMode\.(\w+)[^{}]*?\}/g;
const ENTRY_REVERSED =
  /\{[^{}]*?\brenderMode\s*:\s*RenderMode\.(\w+)[^{}]*?\bpath\s*:\s*(['"`])([^'"`]*)\2[^{}]*?\}/g;

export function parseServerRoutes(source: string, file: string): ServerRouteEntry[] {
  const code = stripComments(source);
  const out: ServerRouteEntry[] = [];
  const seen = new Set<string>();
  for (const match of code.matchAll(ENTRY)) {
    const key = `${match.index}`;
    seen.add(key);
    out.push({ path: match[2], renderMode: match[3], file });
  }
  for (const match of code.matchAll(ENTRY_REVERSED)) {
    if (seen.has(`${match.index}`)) continue;
    out.push({ path: match[3], renderMode: match[1], file });
  }
  return out;
}

/**
 * The `ServerRoute[]` entries (path and render mode) declared in the
 * workspace's `*.routes.server.ts` files, read from source.
 */
export function scanServerRoutes(cwd: string): ServerRouteEntry[] {
  const files: string[] = [];
  for (const root of sourceRoots(cwd)) {
    if (files.length >= MAX_FILES) break;
    walkFiles(
      root,
      (full, entry) => {
        if (/\.routes\.server\.ts$/.test(entry) || entry === 'app.routes.server.ts') {
          files.push(full);
        }
        return files.length < MAX_FILES;
      },
      8,
    );
  }
  return files.flatMap((file) => {
    try {
      return parseServerRoutes(readFileSync(file, 'utf-8'), relative(cwd, file));
    } catch {
      return [];
    }
  });
}
