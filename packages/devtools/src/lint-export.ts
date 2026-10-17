import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import type { CAC } from 'cac';
import { lintAnalog, scanAnalog } from './rpc/analog-scan.ts';
import { lintPipes, type LintSeverity } from './rpc/pipe-lint.ts';
import { TEMPLATE_LINT_RULES, lintTemplates, type TemplateCompiler } from './rpc/template-lint.ts';
import pkg from '../package.json' with { type: 'json' };

/**
 * `pangular lint`: runs the lints that read only source files, with no page
 * connected, and prints their findings as JSON or SARIF 2.1.0 for CI. The live
 * lints (`lint-forms`, `lint-routes`, the live part of `analog-lint`) need a
 * running page, so they are not here.
 */

/** The source lints, by the name `--only` takes, with the agent tool each matches. */
export const SOURCE_LINTS = {
  templates: 'lint-templates',
  pipes: 'lint-pipes',
  analog: 'analog-lint',
} as const;

export type SourceLint = keyof typeof SOURCE_LINTS;

export type LintFormat = 'json' | 'sarif';

export interface ExportFinding {
  lint: SourceLint;
  rule: string;
  severity: LintSeverity;
  /** Path relative to the project folder, with `/` separators. */
  file?: string;
  line?: number;
  /** A route or URL path when the finding is about one, not about a file. */
  path?: string;
  message: string;
  fix: string;
}

export interface LintRun {
  lint: SourceLint;
  tool: string;
  ran: boolean;
  /** Why the lint did not run, when `ran` is false. */
  skipped?: string;
  findings: number;
}

export interface LintExport {
  lints: LintRun[];
  findings: ExportFinding[];
}

const SEVERITY_ORDER: Record<LintSeverity, number> = { error: 0, warning: 1, info: 2 };

function posix(path: string): string {
  return path.split(sep).join('/');
}

/** Runs the chosen source lints on `cwd`, all of them by default. */
export async function runSourceLints(
  cwd: string,
  options: { only?: SourceLint[]; compiler?: TemplateCompiler } = {},
): Promise<LintExport> {
  const chosen = new Set<SourceLint>(options.only?.length ? options.only : lintNames());
  const lints: LintRun[] = [];
  const findings: ExportFinding[] = [];
  const add = (lint: SourceLint, found: ExportFinding[], skipped?: string) => {
    lints.push({
      lint,
      tool: SOURCE_LINTS[lint],
      ran: !skipped,
      ...(skipped ? { skipped } : {}),
      findings: found.length,
    });
    findings.push(...found);
  };

  if (chosen.has('templates')) {
    const result = await lintTemplates(cwd, { compiler: options.compiler });
    add(
      'templates',
      result.findings.map((f) => ({
        lint: 'templates',
        rule: f.rule,
        severity: f.severity,
        file: posix(f.file),
        line: f.line,
        message: f.message,
        fix: f.fix,
      })),
      result.parsed ? undefined : 'The project has no @angular/compiler to parse templates with.',
    );
  }
  if (chosen.has('pipes')) {
    add(
      'pipes',
      lintPipes(cwd).map((f) => ({
        lint: 'pipes',
        rule: f.rule,
        severity: f.severity,
        file: posix(f.file),
        line: f.line,
        message: f.message,
        fix: f.fix,
      })),
    );
  }
  if (chosen.has('analog')) {
    const project = scanAnalog(cwd);
    if (!project.analog) add('analog', [], 'The project is not an Analog app.');
    else {
      const root = project.root;
      add(
        'analog',
        lintAnalog(project).map((f) => ({
          lint: 'analog',
          rule: f.rule,
          severity: f.severity,
          // Analog paths start with `/` at the Analog app folder.
          ...(f.file ? { file: posix(relative(cwd, join(root, f.file))) } : {}),
          ...(f.path ? { path: f.path } : {}),
          message: f.message,
          fix: f.fix,
        })),
      );
    }
  }
  findings.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (a.file ?? '').localeCompare(b.file ?? '') ||
      (a.line ?? 0) - (b.line ?? 0),
  );
  return { lints, findings };
}

export function lintNames(): SourceLint[] {
  return Object.keys(SOURCE_LINTS) as SourceLint[];
}

/** The JSON export: the tool, which lints ran, counts per severity and the findings. */
export function toLintJson(result: LintExport) {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const finding of result.findings) counts[finding.severity]++;
  return {
    tool: { name: 'pangular', version: pkg.version },
    lints: result.lints,
    counts,
    findings: result.findings,
  };
}

const SARIF_LEVEL: Record<LintSeverity, 'error' | 'warning' | 'note'> = {
  error: 'error',
  warning: 'warning',
  info: 'note',
};

function ruleId(finding: { lint: SourceLint; rule: string }): string {
  return `${finding.lint}/${finding.rule}`;
}

function sarifUri(file: string): string {
  return file.split('/').map(encodeURIComponent).join('/');
}

/**
 * A SARIF 2.1.0 log with one run. File paths are relative to `%SRCROOT%`, the
 * project folder, so code scanning tools map them onto the repository. A
 * finding about a whole file, with no line, points at line 1.
 */
export function toSarif(result: LintExport) {
  const rules = new Map<string, { id: string; level: LintSeverity; lint: SourceLint }>();
  for (const lint of result.lints) {
    if (lint.lint !== 'templates' || !lint.ran) continue;
    for (const [rule, level] of Object.entries(TEMPLATE_LINT_RULES)) {
      rules.set(`templates/${rule}`, { id: `templates/${rule}`, level, lint: 'templates' });
    }
  }
  for (const finding of result.findings) {
    const id = ruleId(finding);
    if (!rules.has(id)) rules.set(id, { id, level: finding.severity, lint: finding.lint });
  }
  const ruleList = [...rules.values()];
  const index = new Map(ruleList.map((rule, i) => [rule.id, i]));
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'Pangular Inspector',
            semanticVersion: pkg.version,
            informationUri: pkg.homepage,
            rules: ruleList.map((rule) => ({
              id: rule.id,
              name: rule.id.split('/')[1],
              shortDescription: {
                text: `${rule.id.split('/')[1]} (${SOURCE_LINTS[rule.lint]})`,
              },
              defaultConfiguration: { level: SARIF_LEVEL[rule.level] },
            })),
          },
        },
        originalUriBaseIds: { '%SRCROOT%': { description: { text: 'The project folder.' } } },
        results: result.findings.map((finding) => ({
          ruleId: ruleId(finding),
          ruleIndex: index.get(ruleId(finding)),
          level: SARIF_LEVEL[finding.severity],
          message: {
            text: `${finding.path ? `${finding.path}: ` : ''}${finding.message} Fix: ${finding.fix}`,
          },
          locations: finding.file
            ? [
                {
                  physicalLocation: {
                    artifactLocation: { uri: sarifUri(finding.file), uriBaseId: '%SRCROOT%' },
                    region: { startLine: finding.line && finding.line > 0 ? finding.line : 1 },
                  },
                },
              ]
            : [],
          properties: { fix: finding.fix, ...(finding.path ? { path: finding.path } : {}) },
        })),
      },
    ],
  };
}

export function formatLintExport(result: LintExport, format: LintFormat): string {
  return `${JSON.stringify(format === 'sarif' ? toSarif(result) : toLintJson(result), null, 2)}\n`;
}

/** Whether a finding at `failOn` or worse is present; `none` never fails. */
export function failsAt(result: LintExport, failOn: LintSeverity | 'none'): boolean {
  if (failOn === 'none') return false;
  return result.findings.some((f) => SEVERITY_ORDER[f.severity] <= SEVERITY_ORDER[failOn]);
}

interface LintCommandFlags {
  format?: string;
  output?: string;
  only?: string | string[];
  failOn?: string;
}

function parseOnly(value: LintCommandFlags['only']): SourceLint[] | undefined {
  if (value === undefined) return undefined;
  const names = [value]
    .flat()
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim())
    .filter(Boolean);
  for (const name of names) {
    if (!(name in SOURCE_LINTS)) {
      throw new Error(
        `[pangular] Unknown lint "${name}" for --only. Use ${lintNames().join(', ')}.`,
      );
    }
  }
  return names as SourceLint[];
}

/** Adds `pangular lint` to the CLI. */
export function registerLintCommand(
  cli: CAC,
  options: {
    cwd: (flags: Record<string, unknown>) => string;
    log: (message: string) => void;
    /** Lines for the person at the terminal, kept off stdout so the export stays parseable. */
    note?: (message: string) => void;
    compiler?: TemplateCompiler;
  },
) {
  const note = options.note ?? ((message: string) => console.error(message));
  cli
    .command('lint', 'Run the source lints and print the findings as JSON or SARIF')
    .option('--format <format>', 'json or sarif (default: json)')
    .option('--output <file>', 'Write the findings to this file instead of stdout')
    .option('--only <lints>', `Only these lints, comma separated: ${lintNames().join(', ')}`)
    .option(
      '--fail-on <severity>',
      'Exit with code 1 when a finding of this severity or worse is found: error, warning, info or none (default: none)',
    )
    .action(async (flags: LintCommandFlags) => {
      const format = (flags.format ?? 'json') as LintFormat;
      if (format !== 'json' && format !== 'sarif') {
        throw new Error(`[pangular] Unknown --format "${flags.format}". Use json or sarif.`);
      }
      const failOn = (flags.failOn ?? 'none') as LintSeverity | 'none';
      if (!['error', 'warning', 'info', 'none'].includes(failOn)) {
        throw new Error(
          `[pangular] Unknown --fail-on "${flags.failOn}". Use error, warning, info or none.`,
        );
      }
      const only = parseOnly(flags.only);
      const cwd = options.cwd(flags as Record<string, unknown>);
      const result = await runSourceLints(cwd, { only, compiler: options.compiler });
      const text = formatLintExport(result, format);
      for (const lint of result.lints) {
        if (lint.skipped) note(`[pangular] ${lint.tool} did not run: ${lint.skipped}`);
      }
      if (flags.output) {
        const file = isAbsolute(flags.output) ? flags.output : resolve(flags.output);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, text);
        note(`[pangular] Wrote ${result.findings.length} findings to ${flags.output}.`);
      } else {
        options.log(text.trimEnd());
      }
      if (failsAt(result, failOn)) process.exitCode = 1;
    });
}
