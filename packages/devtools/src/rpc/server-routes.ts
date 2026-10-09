import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import {
  matchDelimiter,
  maskStrings,
  skipString,
  sourceRoots,
  stripComments,
  walkFiles,
} from './source-scan.ts';

export interface ServerRouteEntry {
  path: string;
  renderMode: string;
  file: string;
}

const MAX_FILES = 20;
const PATH_KEY = /(?<![\w$.])path\s*:\s*(['"`])/;
const MODE_KEY = /(?<![\w$.])renderMode\s*:\s*RenderMode\.(\w+)/;

function ownLevel(masked: string, open: number, close: number): string {
  let out = '';
  let depth = 0;
  for (let i = open; i <= close; i++) {
    const ch = masked[i];
    if (ch === '{' || ch === '(' || ch === '[') {
      depth++;
      out += ' ';
    } else if (ch === '}' || ch === ')' || ch === ']') {
      depth--;
      out += ' ';
    } else out += depth === 1 || ch === '\n' ? ch : ' ';
  }
  return out;
}

export function parseServerRoutes(source: string, file: string): ServerRouteEntry[] {
  const code = stripComments(source);
  const masked = maskStrings(code);
  const forward: ServerRouteEntry[] = [];
  const reversed: ServerRouteEntry[] = [];
  for (let open = masked.indexOf('{'); open >= 0; open = masked.indexOf('{', open + 1)) {
    const close = matchDelimiter(masked, open, '{', '}');
    const own = ownLevel(masked, open, Math.min(close, masked.length - 1));
    const path = PATH_KEY.exec(own);
    const mode = MODE_KEY.exec(own);
    if (!path || !mode) continue;
    const quote = open + path.index + path[0].length - 1;
    const end = skipString(code, quote);
    const entry = { path: code.slice(quote + 1, end), renderMode: mode[1], file };
    (path.index < mode.index ? forward : reversed).push(entry);
  }
  return [...forward, ...reversed];
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
