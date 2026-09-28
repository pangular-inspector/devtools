import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { BUILTIN_PIPES, pipeUsesIn, templatesIn, type TemplateSource } from './get-pipes.ts';
import {
  classScopes,
  lineCounter,
  maskStrings,
  matchDelimiter,
  sourceRoots,
  stripComments,
  walkFiles,
} from './source-scan.ts';

export type LintSeverity = 'error' | 'warning' | 'info';

export interface PipeLintFinding {
  rule: string;
  severity: LintSeverity;
  pipe: string;
  file: string;
  line: number;
  message: string;
  fix: string;
}

/** Declared (custom) pipe purity, keyed by template name — used to tell an
 * impure custom pipe from a pure one inside a `@for` block. Built-ins come
 * from `BUILTIN_PIPES` directly. */
type PurityMap = Map<string, boolean>;

export function lintPipesText(cwd: string): string {
  const findings = lintPipes(cwd);
  if (!findings.length) return 'No pipe problems found by the lint rules.';
  const order = { error: 0, warning: 1, info: 2 };
  const lines = findings
    .sort((a, b) => order[a.severity] - order[b.severity])
    .map(
      (f) =>
        `- **${f.severity}** ${f.rule} on \`${f.pipe}\` at \`${f.file}:${f.line}\`: ${f.message} Fix: ${f.fix}`,
    );
  return lines.join('\n');
}

export function lintPipes(cwd: string): PipeLintFinding[] {
  const files: { content: string; relPath: string; fullPath: string }[] = [];
  for (const root of sourceRoots(cwd)) {
    walkFiles(root, (full, entry) => {
      if (!entry.endsWith('.ts') || entry.endsWith('.spec.ts')) return;
      try {
        files.push({
          content: readFileSync(full, 'utf-8'),
          relPath: relative(cwd, full),
          fullPath: full,
        });
      } catch {
        // skip
      }
    });
  }

  const purity: PurityMap = new Map();
  for (const [name, meta] of BUILTIN_PIPES) purity.set(name, meta.isPure);
  for (const { content } of files) {
    for (const scope of classScopes(maskStrings(stripComments(content)), stripComments(content))) {
      if (scope.kind === 'pipe' && scope.pipeName) {
        purity.set(scope.pipeName, !/\bpure\s*:\s*false\b/.test(scope.decoratorArgs ?? ''));
      }
    }
  }

  const findings: PipeLintFinding[] = [];
  for (const { content, relPath, fullPath } of files) {
    for (const template of templatesIn(content, relPath, fullPath, cwd)) {
      findings.push(...impurePipeInForFindings(template, purity));
      findings.push(...jsonPipeFindings(template));
    }
    findings.push(...signalInPurePipeFindings(content, relPath));
  }
  return findings;
}

/** Byte spans of every `@for (...) { ... }` block's body in `text`. */
function forBlocks(text: string): { start: number; end: number }[] {
  const blocks: { start: number; end: number }[] = [];
  const re = /@for\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const openParen = match.index + match[0].length - 1;
    const closeParen = matchDelimiter(text, openParen, '(', ')');
    if (closeParen >= text.length) break;
    const openBrace = text.indexOf('{', closeParen);
    if (openBrace === -1) break;
    const closeBrace = matchDelimiter(text, openBrace, '{', '}');
    blocks.push({ start: openBrace, end: closeBrace });
    re.lastIndex = openBrace + 1;
  }
  return blocks;
}

function impurePipeInForFindings(template: TemplateSource, purity: PurityMap): PipeLintFinding[] {
  const findings: PipeLintFinding[] = [];
  for (const block of forBlocks(template.text)) {
    const body = template.text.slice(block.start, block.end);
    for (const { name, index } of pipeUsesIn(body)) {
      const isPure = purity.get(name);
      if (isPure === undefined || isPure) continue;
      findings.push({
        rule: 'impure-pipe-in-for',
        severity: 'warning',
        pipe: name,
        file: template.file,
        line: template.lineAt(template.baseOffset + block.start + index),
        message: `Impure pipe ${JSON.stringify(name)} runs on every change-detection pass, inside an @for block — potentially once per row, every check.`,
        fix: 'Precompute the value on the item before the loop, use a pure pipe, or memoize the transform yourself.',
      });
    }
  }
  return findings;
}

function jsonPipeFindings(template: TemplateSource): PipeLintFinding[] {
  const findings: PipeLintFinding[] = [];
  for (const { name, index } of pipeUsesIn(template.text)) {
    if (name !== 'json') continue;
    findings.push({
      rule: 'json-pipe-in-template',
      severity: 'info',
      pipe: 'json',
      file: template.file,
      line: template.lineAt(template.baseOffset + index),
      message:
        '`| json` is a debugging aid (JsonPipe), not something users are usually meant to see.',
      fix: 'Remove it before shipping, or gate it behind a dev-only flag.',
    });
  }
  return findings;
}

const SIGNAL_FIELD =
  /(?<![\w$.])(?:this\.)?(#?[$\w]+)\s*(?::[^=;\n,<]*)?=\s*(?:signal|input|computed)(?:\.required)?\s*[<(]/g;
const TRANSFORM_METHOD = /\btransform\s*\([^)]*\)\s*(?::[^{]+)?\{/;

function signalInPurePipeFindings(content: string, relPath: string): PipeLintFinding[] {
  const source = stripComments(content);
  const code = maskStrings(source);
  const lineAt = lineCounter(code);
  const findings: PipeLintFinding[] = [];

  for (const scope of classScopes(code, source)) {
    if (scope.kind !== 'pipe' || !scope.pipeName) continue;
    const isPure = !/\bpure\s*:\s*false\b/.test(scope.decoratorArgs ?? '');
    if (!isPure) continue;

    const classBody = code.slice(scope.start, scope.end);
    const signalFields = new Set<string>();
    SIGNAL_FIELD.lastIndex = 0;
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = SIGNAL_FIELD.exec(classBody)) !== null) signalFields.add(fieldMatch[1]);
    if (!signalFields.size) continue;

    const transformStart = TRANSFORM_METHOD.exec(classBody);
    if (!transformStart) continue;
    const bodyOpen = scope.start + transformStart.index + transformStart[0].length - 1;
    const bodyClose = matchDelimiter(code, bodyOpen, '{', '}');
    const transformBody = code.slice(bodyOpen, bodyClose);

    const readPattern = /\bthis\.(#?[$\w]+)\s*\(\s*\)/g;
    let readMatch: RegExpExecArray | null;
    const flagged = new Set<string>();
    while ((readMatch = readPattern.exec(transformBody)) !== null) {
      const field = readMatch[1];
      if (!signalFields.has(field) || flagged.has(field)) continue;
      flagged.add(field);
      findings.push({
        rule: 'signal-read-in-pure-pipe',
        severity: 'warning',
        pipe: scope.pipeName,
        file: relPath,
        line: lineAt(bodyOpen + readMatch.index),
        message: `transform() reads this.${field}(), a signal — but a pure pipe only recomputes when its own arguments change, not when a signal it reads changes.`,
        fix: "Pass the signal's value as a transform argument instead, or mark the pipe `pure: false`.",
      });
    }
  }
  return findings;
}
