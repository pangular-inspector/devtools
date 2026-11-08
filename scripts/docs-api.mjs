#!/usr/bin/env node
/**
 * Writes the API reference pages in apps/docs/src/content/api/ from the entry points of
 * packages/devtools/package.json. `pnpm docs:test` fails when a page in the repository is
 * stale, so run this after changing an exported symbol or its JSDoc.
 *
 * Usage: node scripts/docs-api.mjs
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as prettier from 'prettier';
import { API_DIR, renderApiReference } from '../apps/docs/api-reference.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');
const dir = path.join(repoRoot, 'apps/docs', API_DIR);
const pages = renderApiReference(repoRoot, 'https://github.com/pangular-inspector/devtools');
mkdirSync(dir, { recursive: true });
for (const file of readdirSync(dir)) {
  if (file.endsWith('.md') && !pages.has(file)) rmSync(path.join(dir, file));
}
// Formatted the way the docs test formats them, so the two compare equal.
for (const [file, markdown] of pages) {
  const filepath = path.join(dir, file);
  const options = (await prettier.resolveConfig(filepath)) ?? {};
  writeFileSync(filepath, await prettier.format(markdown, { ...options, filepath }));
}
console.log(`Wrote ${pages.size} pages to ${path.relative(process.cwd(), dir)}`);
