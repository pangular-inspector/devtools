import { defineRpcFunction } from 'devframe';
import * as v from 'valibot';
import { describable } from './agent-schema.ts';
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import {
  classScopes,
  escapes,
  lineCounter,
  maskStrings,
  matchDelimiter,
  realPath,
  skipString,
  sourceRoots,
  stripComments,
  walkFiles,
} from './source-scan.ts';

const UsageSiteSchema = v.object({
  file: v.string(),
  line: v.number(),
});

const PipeSchema = v.object({
  name: v.string(),
  className: v.string(),
  file: v.string(),
  line: v.number(),
  isStandalone: v.boolean(),
  isPure: v.boolean(),
  /** Ships with Angular, so there is no declaration to point at: `file`/`line`
   * name its first usage site instead. */
  builtin: v.optional(v.boolean()),
  usageCount: v.optional(v.number()),
  usages: v.optional(v.array(UsageSiteSchema)),
});

export const getPipes = defineRpcFunction({
  name: 'get-pipes',
  type: 'query',
  jsonSerializable: true,
  args: [],
  returns: describable(v.array(PipeSchema)),
  agent: {
    description:
      'Discover Angular pipes: custom pipes declared with @Pipe by scanning source files, and built-in pipes from @angular/common (DatePipe, CurrencyPipe, AsyncPipe, etc.) found in use in templates. Returns each pipe name, its class, purity and standalone status, and where it is declared or used. Call this to understand what data-transformation logic is available to templates.',
    title: 'List Angular pipes',
  },
  setup: (ctx) => ({
    handler: async () => scanPipes(ctx.cwd),
  }),
});

interface UsageSite {
  file: string;
  line: number;
}

export interface PipeInfo {
  name: string;
  className: string;
  file: string;
  line: number;
  isStandalone: boolean;
  /** A pipe is pure unless its decorator says otherwise. */
  isPure: boolean;
  builtin: boolean;
  usageCount?: number;
  usages?: UsageSite[];
}

/** Name (as used after `|` in a template) to class and purity, for every pipe
 * `@angular/common` exports. */
export const BUILTIN_PIPES = new Map<string, { className: string; isPure: boolean }>([
  ['async', { className: 'AsyncPipe', isPure: false }],
  ['currency', { className: 'CurrencyPipe', isPure: true }],
  ['date', { className: 'DatePipe', isPure: true }],
  ['number', { className: 'DecimalPipe', isPure: true }],
  ['i18nPlural', { className: 'I18nPluralPipe', isPure: true }],
  ['i18nSelect', { className: 'I18nSelectPipe', isPure: true }],
  ['json', { className: 'JsonPipe', isPure: false }],
  ['keyvalue', { className: 'KeyValuePipe', isPure: false }],
  ['lowercase', { className: 'LowerCasePipe', isPure: true }],
  ['percent', { className: 'PercentPipe', isPure: true }],
  ['slice', { className: 'SlicePipe', isPure: false }],
  ['titlecase', { className: 'TitleCasePipe', isPure: true }],
  ['uppercase', { className: 'UpperCasePipe', isPure: true }],
]);

/** `| name`, unless it is one side of `||`: the lookbehind/lookahead keep
 * `a || date` from being read as a use of the `date` pipe. */
export const PIPE_USE = /(?<!\|)\|(?!\|)[ \t]*([A-Za-z_$][\w$]*)/g;

export function scanPipes(cwd: string): PipeInfo[] {
  const pipes: PipeInfo[] = [];
  const builtinUsages = new Map<string, UsageSite[]>();
  for (const root of sourceRoots(cwd)) {
    walkFiles(root, (full, entry) => {
      if (!entry.endsWith('.ts') || entry.endsWith('.spec.ts')) return;
      try {
        const content = readFileSync(full, 'utf-8');
        const relPath = relative(cwd, full);
        pipes.push(...pipesIn(content, relPath));
        collectBuiltinUsages(content, relPath, full, cwd, builtinUsages);
      } catch {
        // skip
      }
    });
  }
  for (const [name, usages] of builtinUsages) {
    const meta = BUILTIN_PIPES.get(name);
    if (!meta) continue;
    pipes.push({
      name,
      className: meta.className,
      file: usages[0].file,
      line: usages[0].line,
      isStandalone: true,
      isPure: meta.isPure,
      builtin: true,
      usageCount: usages.length,
      usages,
    });
  }
  return pipes;
}

function pipesIn(content: string, relPath: string): PipeInfo[] {
  const source = stripComments(content);
  // A decorator quoted inside a template is not code.
  const code = maskStrings(source);
  const lineAt = lineCounter(code);

  const pipes: PipeInfo[] = [];
  for (const scope of classScopes(code, source)) {
    if (scope.kind !== 'pipe' || !scope.pipeName || !scope.className) continue;
    pipes.push({
      name: scope.pipeName,
      className: scope.className,
      file: relPath,
      line: lineAt(scope.start),
      isStandalone: !/\bstandalone\s*:\s*false\b/.test(scope.decoratorArgs ?? ''),
      isPure: !/\bpure\s*:\s*false\b/.test(scope.decoratorArgs ?? ''),
      builtin: false,
    });
  }
  return pipes;
}

const TEMPLATE_KEY = /\btemplate\s*:\s*/;
const TEMPLATE_URL_KEY = /\btemplateUrl\s*:\s*/;

export interface TemplateSource {
  text: string;
  file: string;
  lineAt: (index: number) => number;
  /** `text`'s own offset 0 relative to `file`'s full source, for combining
   * with an index into `text` before calling `lineAt`. */
  baseOffset: number;
}

/**
 * Finds every `@Component(...)` in `content` and its template — inline, or
 * read from `templateUrl` relative to `fullPath` — for any scanner that needs
 * the template's text alongside a way to turn an offset into it back into a
 * line number. Shared by the built-in-pipe usage scan and the pipe linter.
 */
export function templatesIn(
  content: string,
  relPath: string,
  fullPath: string,
  cwd: string,
): TemplateSource[] {
  const source = stripComments(content);
  const code = maskStrings(source);
  const lineAt = lineCounter(code);
  const out: TemplateSource[] = [];

  const decorator = /@Component\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = decorator.exec(code)) !== null) {
    const open = match.index + match[0].length - 1;
    const close = matchDelimiter(code, open, '(', ')');
    const args = code.slice(open, close);

    const inline = valueOf(args, source, open, TEMPLATE_KEY);
    if (inline) {
      out.push({ text: inline.value, file: relPath, lineAt, baseOffset: inline.offset });
    } else {
      const url = valueOf(args, source, open, TEMPLATE_URL_KEY);
      const external = url && templateFromUrl(url.value, fullPath, cwd);
      if (external) out.push(external);
    }
    decorator.lastIndex = close;
  }
  return out;
}

/**
 * Finds every `@Component(...)` in `content` and scans its template — inline,
 * or read from `templateUrl` relative to `fullPath` — for uses of a built-in
 * pipe, recording each one into `out`.
 */
function collectBuiltinUsages(
  content: string,
  relPath: string,
  fullPath: string,
  cwd: string,
  out: Map<string, UsageSite[]>,
) {
  for (const template of templatesIn(content, relPath, fullPath, cwd)) {
    recordUsages(template.text, template.file, template.lineAt, template.baseOffset, out);
  }
}

/** Reads the string value that follows `keyPattern` in `args` (a decorator's
 * masked argument list), starting at `offset` within `source`/the full file's
 * masked code. `args` and `source`/`code` share offsets up to `offset`. */
function valueOf(
  args: string,
  source: string,
  offset: number,
  keyPattern: RegExp,
): { value: string; offset: number } | null {
  const key = keyPattern.exec(args);
  if (!key) return null;
  let local = key.index + key[0].length;
  while (/\s/.test(args[local] ?? '')) local++;
  const abs = offset + local;
  const quote = source[abs];
  if (quote !== '"' && quote !== "'" && quote !== '`') return null;
  const end = skipString(source, abs);
  if (end === abs) return null;
  return { value: source.slice(abs + 1, end), offset: abs + 1 };
}

/**
 * Resolves `url` relative to `fullPath` and reads it — but only once its real
 * (symlinks-followed) location is confirmed to still be inside the workspace.
 * A `templateUrl` that resolves outside it (through a symlink, `../../`, or
 * otherwise) is refused rather than read, the same containment rule
 * `sourceRoots` applies to every scanned directory.
 */
function templateFromUrl(url: string, fullPath: string, cwd: string): TemplateSource | null {
  try {
    const templatePath = resolve(dirname(fullPath), url);
    const root = realPath(cwd);
    const real = realPath(templatePath);
    const inside = relative(root, real);
    if (escapes(inside) || isAbsolute(inside)) return null;
    const text = readFileSync(real, 'utf-8');
    // `inside` is already relative(root, real): both real, so it matches
    // `cwd`-relative paths reported elsewhere without a second `relative()`
    // call that would mix a real path with an unresolved `cwd` and produce a
    // long, wrong `../../` chain wherever `cwd` sits behind a symlink itself
    // (e.g. macOS's /var -> /private/var).
    return { text, file: inside, lineAt: lineCounter(text), baseOffset: 0 };
  } catch {
    // templateUrl does not resolve to a readable file
    return null;
  }
}

function recordUsages(
  templateText: string,
  file: string,
  lineAt: (index: number) => number,
  baseOffset: number,
  out: Map<string, UsageSite[]>,
) {
  for (const { name, index } of pipeUsesIn(templateText)) {
    if (!BUILTIN_PIPES.has(name)) continue;
    const usages = out.get(name) ?? [];
    usages.push({ file, line: lineAt(baseOffset + index) });
    out.set(name, usages);
  }
}

/**
 * Byte spans of every real Angular expression in a template: `{{ }}`
 * interpolations, bound attribute/event/structural-directive values
 * (`[x]="…"`, `(x)="…"`, `*x="…"`), and `@if`/`@for`/`@switch`/`@case`
 * conditions. Plain markup and text nodes — where `| word` is prose, not a
 * pipe — fall outside every span.
 */
function expressionRegionsIn(text: string): { start: number; end: number }[] {
  const regions: { start: number; end: number }[] = [];

  const interpolation = /\{\{/g;
  let m: RegExpExecArray | null;
  while ((m = interpolation.exec(text)) !== null) {
    const start = m.index + 2;
    let depth = 1;
    let i = start;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"' || ch === "'" || ch === '`') {
        i = skipString(text, i);
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) break;
    }
    const end = Math.min(i, text.length);
    regions.push({ start, end });
    interpolation.lastIndex = end + 1;
  }

  // [prop]="…", [(prop)]="…", (event)="…", *directive="…"
  const boundAttr = /(?:\[\(?[\w.$-]+\)?\]|\([\w.$-]+\)|\*[\w.$-]+)\s*=\s*(["'])/g;
  while ((m = boundAttr.exec(text)) !== null) {
    const quote = m[1];
    const start = m.index + m[0].length;
    const end = text.indexOf(quote, start);
    if (end === -1) continue;
    regions.push({ start, end });
    boundAttr.lastIndex = end + 1;
  }

  const control = /@(?:if|for|switch|case)\s*\(/g;
  while ((m = control.exec(text)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = matchDelimiter(text, open, '(', ')');
    regions.push({ start: open + 1, end: close });
    control.lastIndex = close + 1;
  }

  return regions;
}

/**
 * Every `| name` pipe use found inside `text`'s real Angular expressions,
 * each with its absolute offset into `text`. A `| word` sitting in plain
 * markup or a text node — `<code>| json</code>` in a docs paragraph, say —
 * is outside every expression region and so is never reported.
 */
export function pipeUsesIn(text: string): { name: string; index: number }[] {
  const uses: { name: string; index: number }[] = [];
  for (const region of expressionRegionsIn(text)) {
    const slice = text.slice(region.start, region.end);
    PIPE_USE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = PIPE_USE.exec(slice)) !== null) {
      const name = match[1];
      uses.push({ name, index: region.start + match.index + match[0].length - name.length });
    }
  }
  return uses;
}
