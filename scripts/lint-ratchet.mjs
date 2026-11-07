#!/usr/bin/env node
// Runs oxlint and fails when a file has more warnings of a rule than
// `lint-baseline.json` allows. The baseline only goes down: fix a warning and
// run `pnpm lint --update` to lower it, so the old count can't come back.
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'lint-baseline.json');
/** The folders oxlint checks, relative to the repository root. */
export const LINT_PATHS = ['packages', 'app', 'apps', 'src', 'examples', 'scripts', 'e2e'];

/**
 * Counts oxlint's diagnostics per file and rule, with `/` paths relative to
 * `root`, sorted so the baseline file diffs cleanly.
 * @param {{ filename: string; code?: string }[]} diagnostics
 * @param {string} root
 * @returns {Record<string, Record<string, number>>}
 */
export function countDiagnostics(diagnostics, root = ROOT) {
  /** @type {Record<string, Record<string, number>>} */
  const counts = {};
  for (const { filename, code } of diagnostics) {
    const file = relative(root, join(root, filename)).split(sep).join('/');
    const rule = code ?? 'unknown';
    const rules = (counts[file] ??= {});
    rules[rule] = (rules[rule] ?? 0) + 1;
  }
  return sortCounts(counts);
}

/** @param {Record<string, Record<string, number>>} counts */
function sortCounts(counts) {
  return Object.fromEntries(
    Object.keys(counts)
      .sort()
      .map((file) => [
        file,
        Object.fromEntries(
          Object.keys(counts[file])
            .sort()
            .map((rule) => [rule, counts[file][rule]]),
        ),
      ]),
  );
}

/**
 * Compares the counts with the baseline.
 * @param {Record<string, Record<string, number>>} baseline
 * @param {Record<string, Record<string, number>>} current
 * @returns {{ added: string[]; fixed: string[] }} `added` lines fail the check;
 *   `fixed` lines mean the baseline can go down.
 */
export function compareCounts(baseline, current) {
  const added = [];
  const fixed = [];
  for (const [file, rules] of Object.entries(current)) {
    for (const [rule, count] of Object.entries(rules)) {
      const allowed = baseline[file]?.[rule] ?? 0;
      if (count > allowed) added.push(`${file}: ${rule} ${allowed} -> ${count}`);
    }
  }
  for (const [file, rules] of Object.entries(baseline)) {
    for (const [rule, allowed] of Object.entries(rules)) {
      const count = current[file]?.[rule] ?? 0;
      if (count < allowed) fixed.push(`${file}: ${rule} ${allowed} -> ${count}`);
    }
  }
  return { added, fixed };
}

function runOxlint() {
  const bin = join(
    ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'oxlint.cmd' : 'oxlint',
  );
  let output;
  try {
    output = execFileSync(bin, ['-c', '.oxlintrc.json', '--format', 'json', ...LINT_PATHS], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      shell: process.platform === 'win32',
    });
  } catch (error) {
    // oxlint exits non-zero on errors, and still prints the report.
    output = /** @type {{ stdout?: string }} */ (error).stdout ?? '';
    if (!output) throw error;
  }
  return JSON.parse(output).diagnostics ?? [];
}

function readBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8'));
  } catch {
    return {};
  }
}

function main(args) {
  const diagnostics = runOxlint();
  const current = countDiagnostics(diagnostics);
  const baseline = readBaseline();
  const { added, fixed } = compareCounts(baseline, current);
  if (args.includes('--update')) {
    if (added.length && !args.includes('--allow-new')) {
      console.error('New lint warnings, so the baseline was not updated:\n' + added.join('\n'));
      console.error('Fix them, or pass --allow-new when a reviewer agreed to keep them.');
      return 1;
    }
    writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n');
    console.log(
      `lint-baseline.json updated: ${diagnostics.length} warnings in ${Object.keys(current).length} files.`,
    );
    return 0;
  }
  if (added.length) {
    const lines = new Set(added.map((line) => line.split(':')[0]));
    for (const d of diagnostics) {
      const file = relative(ROOT, join(ROOT, d.filename)).split(sep).join('/');
      const label = d.labels?.[0]?.span;
      if (lines.has(file))
        console.error(
          `${file}${label ? `:${label.line}:${label.column}` : ''} ${d.code}: ${d.message}`,
        );
    }
    console.error('\nNew lint warnings (file: rule baseline -> now):\n' + added.join('\n'));
    console.error('\nFix them; the baseline in lint-baseline.json only goes down.');
    return 1;
  }
  if (fixed.length) {
    console.log(
      `${fixed.length} counts are below the baseline. Run \`pnpm lint --update\` to lower it:\n` +
        fixed.join('\n'),
    );
  }
  console.log(`oxlint: no new warnings (${diagnostics.length} in the baseline).`);
  return 0;
}

const invoked = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) process.exitCode = main(process.argv.slice(2));
