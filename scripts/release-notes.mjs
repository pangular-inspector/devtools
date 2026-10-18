#!/usr/bin/env node
/**
 * The release gate's first check, run by `.github/workflows/release.yml` before anything is built:
 * the tag, the package version and the changelog must name the same release.
 *
 * - `--tag=v1.2.3` must be `v` plus `version` in `packages/devtools/package.json`.
 * - `packages/devtools/CHANGELOG.md` must have a `## 1.2.3` section with something in it.
 *
 * Prints the section's body, or writes it to `--out=<file>` for the GitHub release notes. Exits
 * with 1 and an `::error::` line when they disagree.
 *
 * Usage: node scripts/release-notes.mjs --tag=v1.2.3 [--out=<file>]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

/** The body of the `## <version>` section, without its heading, or undefined when it is missing. */
export function changelogSection(changelog, version) {
  const lines = changelog.split('\n');
  const heading = lines.findIndex((line) => /^## /.test(line) && line.slice(3).trim() === version);
  if (heading === -1) return undefined;
  const next = lines.findIndex((line, i) => i > heading && /^## /.test(line));
  return lines
    .slice(heading + 1, next === -1 ? undefined : next)
    .join('\n')
    .trim();
}

/** The problems that stop a release of `tag`, or an empty list. */
export function releaseProblems(tag, version, section) {
  const problems = [];
  if (tag !== `v${version}`) {
    problems.push(
      `The tag ${tag} does not match packages/devtools/package.json, whose version is ${version}. Tag v${version}, or bump the version first.`,
    );
  }
  if (section === undefined) {
    problems.push(`packages/devtools/CHANGELOG.md has no "## ${version}" section.`);
  } else if (!section) {
    problems.push(`The "## ${version}" section of packages/devtools/CHANGELOG.md is empty.`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tag = arg('tag');
  if (!tag) {
    console.error('Usage: node scripts/release-notes.mjs --tag=v1.2.3 [--out=<file>]');
    process.exit(2);
  }
  const pkg = JSON.parse(readFileSync(join(ROOT, 'packages/devtools/package.json'), 'utf8'));
  const changelog = readFileSync(join(ROOT, 'packages/devtools/CHANGELOG.md'), 'utf8');
  const section = changelogSection(changelog, pkg.version);
  const problems = releaseProblems(tag, pkg.version, section);
  if (problems.length) {
    for (const problem of problems) console.error(`::error::${problem}`);
    process.exit(1);
  }
  const out = arg('out');
  if (out) {
    writeFileSync(out, `${section}\n`);
    console.log(`${tag}: version and changelog match; the notes are in ${out}`);
  } else {
    console.log(section);
  }
}
