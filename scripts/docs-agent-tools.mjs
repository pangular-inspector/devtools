#!/usr/bin/env node
/**
 * Writes apps/docs/src/content/agents/tool-index.md from AGENT_ENTRIES in
 * packages/devtools/src/config.ts. `pnpm docs:test` fails when the page in the repository is
 * stale, so run this after adding or changing an agent tool or resource.
 *
 * Usage: node scripts/docs-agent-tools.mjs
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderToolIndex, TOOL_INDEX_PATH } from '../apps/docs/agent-tool-index.ts';

const docsRoot = path.resolve(import.meta.dirname, '../apps/docs');
const { markdown, problems } = renderToolIndex(docsRoot);
if (problems.length > 0) {
  for (const { name, problem } of problems) console.error(`${name}: ${problem}`);
  console.error('Describe each entry in tools.md or resources.md first.');
  process.exit(1);
}
const file = path.join(docsRoot, TOOL_INDEX_PATH);
writeFileSync(file, markdown);
execFileSync('pnpm', ['exec', 'prettier', '--write', file], {
  cwd: path.resolve(import.meta.dirname, '..'),
  stdio: 'inherit',
});
console.log(`Wrote ${path.relative(process.cwd(), file)}`);
