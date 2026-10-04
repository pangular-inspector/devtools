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
    const templates = templatesIn(content, relPath, fullPath, cwd);
    const signals = templates.length
      ? fieldsMatching(SIGNAL_FIELD, maskStrings(stripComments(content)))
      : new Set<string>();
    for (const template of templates) {
      findings.push(...impurePipeInForFindings(template, purity));
      findings.push(...jsonPipeFindings(template));
      findings.push(...asyncOnCallFindings(template, signals));
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

/** The call right before a pipe whose name starts at `nameIndex`, such as
 * `getUsers()` or `api.load(id)` in `api.load(id) | async`. */
function callBefore(text: string, nameIndex: number): { callee: string; start: number } | null {
  let i = nameIndex - 1;
  while (i >= 0 && /\s/.test(text[i])) i--;
  if (text[i] !== '|') return null;
  i--;
  while (i >= 0 && /\s/.test(text[i])) i--;
  if (text[i] !== ')') return null;
  let depth = 0;
  for (; i >= 0; i--) {
    if (text[i] === ')') depth++;
    else if (text[i] === '(' && --depth === 0) break;
  }
  if (i < 0) return null;
  const callee = /[\w$]+(?:\s*[?!]?\.\s*[\w$]+)*[?!]?$/.exec(text.slice(0, i));
  if (!callee) return null;
  return { callee: callee[0].replace(/\s+/g, ''), start: callee.index };
}

const NOT_A_SOURCE_CALL = new Set(['$any']);

function asyncOnCallFindings(template: TemplateSource, signals: Set<string>): PipeLintFinding[] {
  const findings: PipeLintFinding[] = [];
  for (const { name, index } of pipeUsesIn(template.text)) {
    if (name !== 'async') continue;
    const call = callBefore(template.text, index);
    if (!call) continue;
    const segments = call.callee.replace(/[?!]/g, '').split('.');
    const method = segments[segments.length - 1];
    const own = segments.length === 1 || (segments.length === 2 && segments[0] === 'this');
    if (NOT_A_SOURCE_CALL.has(method) || (own && signals.has(method))) continue;
    findings.push({
      rule: 'async-on-call',
      severity: 'info',
      pipe: 'async',
      file: template.file,
      line: template.lineAt(template.baseOffset + call.start),
      message: `\`${call.callee}(…) | async\` calls a method on every check. If it builds a new Observable each time, AsyncPipe unsubscribes and subscribes again on every check (with HttpClient, one request per check).`,
      fix: 'Keep the Observable in a field, or read it with toSignal() or httpResource().',
    });
  }
  return findings;
}

const SIGNAL_FIELD =
  /(?<![\w$.])(?:this\.)?(#?[$\w]+)\s*(?::[^=;\n,<]*)?=\s*(?:signal|input|computed|linkedSignal|toSignal|model)(?:\.required)?\s*[<(]/g;
const INJECTED_FIELD = /(?<![\w$.])(?:this\.)?(#?[$\w]+)\s*(?::[^=;\n,<]*)?=\s*inject\s*[<(]/g;
const CONSTRUCTOR_PARAMS = /\bconstructor\s*\(/;
const PARAM_PROPERTY =
  /(?:^|,)\s*(?:@\w+\([^)]*\)\s*)*(?:private|public|protected|readonly)\s+(?:readonly\s+)?([$\w]+)/g;
const TRANSFORM_METHOD = /\btransform\s*\([^)]*\)\s*(?::[^{]+)?\{/;

function fieldsMatching(pattern: RegExp, text: string): Set<string> {
  const fields = new Set<string>();
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) fields.add(match[1]);
  return fields;
}

function injectedFields(classBody: string): Set<string> {
  const fields = fieldsMatching(INJECTED_FIELD, classBody);
  const ctor = CONSTRUCTOR_PARAMS.exec(classBody);
  if (ctor) {
    const open = ctor.index + ctor[0].length - 1;
    const params = classBody.slice(open + 1, matchDelimiter(classBody, open, '(', ')'));
    for (const field of fieldsMatching(PARAM_PROPERTY, params)) fields.add(field);
  }
  return fields;
}

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
    const signalFields = fieldsMatching(SIGNAL_FIELD, classBody);
    const services = injectedFields(classBody);
    if (!signalFields.size && !services.size) continue;

    const transformStart = TRANSFORM_METHOD.exec(classBody);
    if (!transformStart) continue;
    const bodyOpen = scope.start + transformStart.index + transformStart[0].length - 1;
    const bodyClose = matchDelimiter(code, bodyOpen, '{', '}');
    const transformBody = code.slice(bodyOpen, bodyClose);

    const readPattern = /\bthis\.(#?[$\w]+)(?:\s*\.\s*([$\w]+))?\s*\(\s*\)/g;
    let readMatch: RegExpExecArray | null;
    const flagged = new Set<string>();
    while ((readMatch = readPattern.exec(transformBody)) !== null) {
      const [, field, member] = readMatch;
      const line = lineAt(bodyOpen + readMatch.index);
      if (!member) {
        if (!signalFields.has(field) || flagged.has(field)) continue;
        flagged.add(field);
        findings.push({
          rule: 'signal-read-in-pure-pipe',
          severity: 'warning',
          pipe: scope.pipeName,
          file: relPath,
          line,
          message: `transform() reads this.${field}(), a signal — but a pure pipe only recomputes when its own arguments change, not when a signal it reads changes.`,
          fix: "Pass the signal's value as a transform argument instead, or mark the pipe `pure: false`.",
        });
        continue;
      }
      const path = `${field}.${member}`;
      if (!services.has(field) || flagged.has(path)) continue;
      flagged.add(path);
      findings.push({
        rule: 'signal-read-in-pure-pipe',
        severity: 'info',
        pipe: scope.pipeName,
        file: relPath,
        line,
        message: `transform() calls this.${path}() on an injected service. If ${member} is a signal, this pure pipe keeps its old result when the signal changes, because it only recomputes when its own arguments change.`,
        fix: 'If it is a signal, pass its value as a transform argument instead, or mark the pipe `pure: false`.',
      });
    }
  }
  return findings;
}
