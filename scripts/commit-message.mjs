#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TYPES = [
  'feat',
  'fix',
  'perf',
  'refactor',
  'test',
  'docs',
  'style',
  'build',
  'ci',
  'chore',
  'revert',
];

export const BODY_REQUIRED = ['feat', 'fix', 'perf', 'refactor'];

export const SCOPES = [
  'hub',
  'ui',
  'popup',
  'overlay',
  'components',
  'signals',
  'injectors',
  'router',
  'forms',
  'store',
  'pipes',
  'http',
  'analog',
  'mcp',
  'extension',
  'vite',
  'demo',
  'docs',
  'release',
  'deps',
];

const MAX_HEADER = 100;
const MIN_BODY = 20;
const HEADER = /^(\w+)(?:\(([^)]+)\))?(!)?: (.+)$/;
const GUIDE = 'docs/contributing/commit-message-guidelines.md';

export function validate(message, { requireBody = true, allowGitPrefixes = true } = {}) {
  const lines = message
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .join('\n')
    .trim()
    .split('\n');
  const header = lines[0] ?? '';
  const errors = [];

  if (allowGitPrefixes && /^(Merge |fixup! |squash! |amend! )/.test(header)) return errors;

  if (!header) return ['The commit message is empty.'];
  if (header.length > MAX_HEADER) {
    errors.push(`The header is ${header.length} characters; keep it under ${MAX_HEADER}.`);
  }

  const match = HEADER.exec(header);
  if (!match) {
    errors.push(`The header must look like "type(scope): summary", got "${header}".`);
    return errors;
  }
  const [, type, scope, , summary] = match;
  if (!TYPES.includes(type)) {
    errors.push(`"${type}" is not a type. Use one of: ${TYPES.join(', ')}.`);
  }
  if (scope !== undefined && !SCOPES.includes(scope)) {
    errors.push(`"${scope}" is not a scope. Use one of: ${SCOPES.join(', ')}, or leave it out.`);
  }
  if (/^\s/.test(summary)) errors.push('Put exactly one space after the colon.');
  if (/\.$/.test(summary)) errors.push("Don't end the summary with a period.");

  const body = lines.slice(1).join('\n').trim();
  if (lines.length > 1 && lines[1].trim() !== '') {
    errors.push('Leave a blank line between the header and the body.');
  }
  if (type === 'revert' && !/This reverts commit [0-9a-f]{7,}/.test(body)) {
    errors.push('A revert must say "This reverts commit <sha>" in the body, and why.');
  }
  if (requireBody && BODY_REQUIRED.includes(type) && body.length < MIN_BODY) {
    errors.push(
      `Add a body of at least ${MIN_BODY} characters that explains why the change is needed.`,
    );
  }
  return errors;
}

let warnOnly = false;

function report(label, errors) {
  if (!errors.length) return true;
  if (warnOnly && process.env.GITHUB_ACTIONS) {
    const text = `${label} ${errors.join(' ')}`.replace(/%/g, '%25').replace(/\r?\n/g, '%0A');
    console.log(`::warning title=Commit message::${text}`);
  }
  console.error(`\n${label}`);
  for (const error of errors) console.error(`  - ${error}`);
  return false;
}

function main(args) {
  const [mode, value] = args;

  if (mode === '--file') {
    const ok = report('Commit message check failed:', validate(readFileSync(value, 'utf8')));
    if (!ok) {
      console.error(`\nSee ${GUIDE}. CI flags it too; fix it with "git commit --amend".\n`);
    }
    return ok;
  }

  if (mode === '--title') {
    const ok = report(
      'Pull request title check failed:',
      validate(value ?? '', { requireBody: false, allowGitPrefixes: false }),
    );
    if (!ok) console.error(`\nThe title becomes the squash commit on main. See ${GUIDE}.\n`);
    return ok;
  }

  if (mode === '--branch') {
    const base = ['upstream/main', 'origin/main', 'main'].find((ref) => {
      try {
        execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    });
    if (!base) {
      console.error('No main branch found to compare with.');
      return false;
    }
    return main(['--range', `${base}..HEAD`]);
  }

  if (mode === '--range') {
    const shas = execFileSync('git', ['rev-list', '--no-merges', value], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    let ok = true;
    for (const sha of shas) {
      const message = execFileSync('git', ['log', '-1', '--format=%B', sha], { encoding: 'utf8' });
      ok = report(`${sha.slice(0, 8)}: ${message.split('\n')[0]}`, validate(message)) && ok;
    }
    if (!ok) console.error(`\nSee ${GUIDE}. Reword with "git rebase -i" and force-push.\n`);
    else console.log(`${shas.length} commit message(s) OK.`);
    return ok;
  }

  console.error(
    'Usage: commit-message.mjs --file <path> | --title <title> | --range <a..b> | --branch [--warn]',
  );
  return false;
}

function isEntryPoint() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  const args = process.argv.slice(2);
  warnOnly = args.includes('--warn');
  const ok = main(args.filter((arg) => arg !== '--warn'));
  if (!ok && warnOnly) console.error('Warn-only mode: not failing the check.');
  process.exit(ok || warnOnly ? 0 : 1);
}
