// Read-only suggestions for moving template pipes to signals. Nothing here
// writes a file: the answer is text an agent or a person applies by hand.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { code, untrusted } from './forms-tools.ts';
import { scanPipes, type PipeInfo } from './get-pipes.ts';
import { lintPipes, type PipeLintFinding } from './pipe-lint.ts';
import type { PipesState, PipeUsageInfo } from './pipes-tools.ts';
import { realPath } from './source-scan.ts';

/** Sites listed per suggestion before the rest are only counted. */
const MAX_SITES = 10;
const MAX_SNIPPET = 120;

export type MigrationKind =
  'async-to-signal' | 'impure-to-computed' | 'signal-pipe-to-computed' | 'churn' | 'stale';

export interface PipeMigration {
  kind: MigrationKind;
  pipe: string;
  /** Where to make the change; empty for a suggestion from live data only. */
  sites: { file: string; line: number; snippet?: string }[];
  title: string;
  why: string;
  how: string;
}

const ASYNC_OPERAND = /([\w$.?!]+(?:\([^()|]*\))?)\s*\|\s*async\b/;

function lineReader(cwd: string): (file: string, line: number) => string | undefined {
  const root = realPath(cwd);
  const files = new Map<string, string[] | null>();
  return (file, line) => {
    if (!files.has(file)) {
      try {
        files.set(file, readFileSync(join(root, file), 'utf-8').split(/\r?\n/));
      } catch {
        files.set(file, null);
      }
    }
    const text = files.get(file)?.[line - 1]?.trim();
    if (!text) return undefined;
    return text.length > MAX_SNIPPET ? `${text.slice(0, MAX_SNIPPET)}…` : text;
  };
}

/** `user$` → `user`, `this.items$` → `items`, `load()` → `load`. */
function signalName(operand: string): string {
  const last =
    operand
      .replace(/\(.*\)$/, '')
      .split('.')
      .pop() ?? operand;
  const bare = last.replace(/[?!]/g, '').replace(/\$$/, '');
  return bare || 'value';
}

function asyncSuggestion(
  pipe: PipeInfo,
  lineAt: (file: string, line: number) => string | undefined,
  calls: readonly PipeLintFinding[],
): PipeMigration {
  const sites = (pipe.usages ?? []).map((site) => ({
    ...site,
    snippet: lineAt(site.file, site.line),
  }));
  const operand = sites.map((s) => s.snippet && ASYNC_OPERAND.exec(s.snippet)?.[1]).find(Boolean);
  const source = operand ?? 'data$';
  const name = signalName(source);
  const field = source.replace(/^this\./, '');
  const callNote = calls.length
    ? ` ${calls.length} of these pipe a method call (${calls.map((c) => code(`${c.file}:${c.line}`)).join(', ')}); keep that Observable in a field first, or use \`httpResource()\` for an HTTP read.`
    : '';
  return {
    kind: 'async-to-signal',
    pipe: 'async',
    sites,
    title: '`| async` to `toSignal()`',
    why: `Each \`| async\` subscribes on its own and needs a change detection pass to show a new value. A signal reads the latest value synchronously, shares one subscription between every read in the template, and works with zoneless change detection.${callNote}`,
    how: `In the component: \`readonly ${name} = toSignal(this.${field});\` (from \`@angular/core/rxjs-interop\`, in an injection context; pass \`{ initialValue }\` or \`{ requireSync: true }\` when the template must not see \`undefined\`). In the template: \`${source} | async\` becomes \`${name}()\`.`,
  };
}

function siteList(pipe: PipeInfo, lineAt: (file: string, line: number) => string | undefined) {
  return (pipe.usages ?? []).map((site) => ({ ...site, snippet: lineAt(site.file, site.line) }));
}

function impureSuggestion(
  pipe: PipeInfo,
  lineAt: (file: string, line: number) => string | undefined,
): PipeMigration {
  return {
    kind: 'impure-to-computed',
    pipe: pipe.name,
    sites: siteList(pipe, lineAt),
    title: `impure ${code(pipe.name)} to \`computed()\``,
    why: `${code(pipe.className)} is \`pure: false\`, so Angular runs its \`transform\` on every change detection pass of every component that uses it. A \`computed()\` reruns only when a signal it reads changes, and caches the result in between.`,
    how: `Hold the pipe's inputs in signals (\`input()\`, \`signal()\` or \`toSignal()\`), then add \`readonly ${pipe.name}Value = computed(() => /* the body of ${pipe.className}.transform, reading the signals */);\` to each component and read \`${pipe.name}Value()\` in the template. Remove the pipe from \`imports\` once no template uses it.`,
  };
}

function signalPipeSuggestion(
  pipe: PipeInfo | undefined,
  findings: readonly PipeLintFinding[],
): PipeMigration {
  const name = findings[0].pipe;
  return {
    kind: 'signal-pipe-to-computed',
    pipe: name,
    sites: findings.map((f) => ({ file: f.file, line: f.line })),
    title: `${code(name)} reads a signal: move it to \`computed()\``,
    why: `A pure pipe reruns only when its arguments change, so a signal read inside \`transform\` does not make it rerun: the template keeps the old value. A \`computed()\` tracks the signal.`,
    how: `Pass the signal's value as an argument (\`value | ${name}: locale()\`), or replace the pipe with \`computed(() => …)\` in the component${pipe ? ` and drop ${code(pipe.className)} from its \`imports\`` : ''}.`,
  };
}

function churnSuggestion(
  live: PipeUsageInfo,
  pipe: PipeInfo | undefined,
  lineAt: (file: string, line: number) => string | undefined,
): PipeMigration {
  return {
    kind: 'churn',
    pipe: live.name,
    sites: pipe ? siteList(pipe, lineAt) : [],
    title: `churning ${code(live.name)} to a stable input or \`computed()\``,
    why: `While recording, an instance returned an equal result ${live.churn!.streak} calls in a row, so its work was thrown away each time.`,
    how: live.isPure
      ? `Its input is a new reference on every check, such as an array or object literal or a method call in the template. Build that input once in a \`computed()\` (give it an \`equal\` function when it is rebuilt from equal parts) and pipe the signal, or compute the result itself in a \`computed()\`.`
      : `Move the logic to a \`computed()\`, which returns the cached result until a signal it reads changes, or return the previous result from \`transform\` when the new one is equal.`,
  };
}

function staleSuggestion(
  live: PipeUsageInfo,
  pipe: PipeInfo | undefined,
  lineAt: (file: string, line: number) => string | undefined,
): PipeMigration {
  return {
    kind: 'stale',
    pipe: live.name,
    sites: pipe ? siteList(pipe, lineAt) : [],
    title: `stale ${code(live.name)}: update its input immutably`,
    why: 'The pipe got an argument whose contents changed while its reference stayed the same, so Angular skipped the pipe and the template may show an old value (experimental check).',
    how: 'Keep the value in a `signal()` and change it with `update(list => [...list, item])` instead of mutating it, or derive the shown value with `computed()`.',
  };
}

/**
 * Suggestions for moving pipes to signals, from the source scan, the pipe lint
 * and, when a page reports, live churn and stale findings. Built-in formatting
 * pipes (`date`, `currency` and so on) are pure and cheap, so none are suggested.
 */
export function pipeMigrations(
  cwd: string,
  live: PipesState | undefined,
  options: { name?: string; rules?: Record<string, boolean> } = {},
): PipeMigration[] {
  const wanted = (name: string) => !options.name || options.name === name;
  const pipes = scanPipes(cwd);
  const lint = lintPipes(cwd, { rules: options.rules });
  const lineAt = lineReader(cwd);
  const byName = new Map(pipes.map((p) => [p.name, p]));
  const out: PipeMigration[] = [];

  const asyncPipe = byName.get('async');
  if (asyncPipe && wanted('async')) {
    out.push(
      asyncSuggestion(
        asyncPipe,
        lineAt,
        lint.filter((f) => f.rule === 'async-on-call'),
      ),
    );
  }
  for (const pipe of pipes) {
    if (pipe.builtin || pipe.isPure || !wanted(pipe.name)) continue;
    out.push(impureSuggestion(pipe, lineAt));
  }
  const signalReads = new Map<string, PipeLintFinding[]>();
  for (const finding of lint) {
    if (finding.rule !== 'signal-read-in-pure-pipe' || !wanted(finding.pipe)) continue;
    signalReads.set(finding.pipe, [...(signalReads.get(finding.pipe) ?? []), finding]);
  }
  for (const findings of signalReads.values()) {
    out.push(signalPipeSuggestion(byName.get(findings[0].pipe), findings));
  }
  for (const pipe of live?.pipes ?? []) {
    if (!wanted(pipe.name)) continue;
    if (pipe.churn) out.push(churnSuggestion(pipe, byName.get(pipe.name), lineAt));
    if (pipe.stale) out.push(staleSuggestion(pipe, byName.get(pipe.name), lineAt));
  }
  return out;
}

function migrationText(m: PipeMigration, index: number): string {
  const lines = [`### ${index + 1}. ${m.title}`, '', m.why, '', `**How:** ${m.how}`];
  if (m.sites.length) {
    lines.push('', '**Where:**');
    for (const site of m.sites.slice(0, MAX_SITES)) {
      lines.push(
        `- ${code(`${site.file}:${site.line}`)}${site.snippet ? `: ${code(site.snippet)}` : ''}`,
      );
    }
    if (m.sites.length > MAX_SITES) lines.push(`- and ${m.sites.length - MAX_SITES} more`);
  }
  return lines.join('\n');
}

/** `suggest-pipe-migrations` as markdown. */
export function pipeMigrationsText(
  cwd: string,
  live: PipesState | undefined,
  options: { name?: string; rules?: Record<string, boolean> } = {},
): string {
  const migrations = pipeMigrations(cwd, live, options);
  if (!migrations.length) {
    const scope = options.name ? `for ${code(options.name)} ` : '';
    return `No pipe-to-signal migrations to suggest ${scope}. No template uses \`| async\`, no custom pipe is impure or reads a signal${live ? ', and no recorded pipe churned or went stale' : ''}. Pure pipes, built-in ones included, are memoized already and can stay.`;
  }
  const head = `${migrations.length} suggestion(s). These are read-only: no file was changed. Apply them by hand and check the result with the app's tests.${
    live ? '' : ' No page reports pipes, so live churn and stale findings are left out.'
  }`;
  return untrusted(
    [
      head,
      '',
      ...migrations
        .map((m, i) => migrationText(m, i))
        .join('\n\n')
        .split('\n'),
    ].join('\n'),
  );
}
