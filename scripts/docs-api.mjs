#!/usr/bin/env node
/**
 * Writes the API reference pages in apps/docs/src/content/api/ from the entry points of
 * packages/devtools/package.json. `pnpm docs:test` fails when a page in the repository is
 * stale, so run this after changing an exported symbol or its JSDoc.
 *
 * Usage: node scripts/docs-api.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { API_DIR, renderApiReference } from '../apps/docs/api-reference.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');
const dir = path.join(repoRoot, 'apps/docs', API_DIR);
const pages = renderApiReference(repoRoot, 'https://github.com/pangular-inspector/devtools');
mkdirSync(dir, { recursive: true });
for (const file of readdirSync(dir)) {
  if (file.endsWith('.md') && !pages.has(file)) rmSync(path.join(dir, file));
}
for (const [file, markdown] of pages) writeFileSync(path.join(dir, file), markdown);
execFileSync('pnpm', ['exec', 'prettier', '--write', dir], { cwd: repoRoot, stdio: 'inherit' });
console.log(`Wrote ${pages.size} pages to ${path.relative(process.cwd(), dir)}`);
