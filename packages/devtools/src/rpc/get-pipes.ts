import { defineRpcFunction } from 'devframe';
import * as v from 'valibot';
import { describable } from './agent-schema.ts';
import { angularMajor } from './angular-version.ts';
import { standaloneOf } from './get-components.ts';
import { readFileSync } from 'node:fs';
import { scanSourceFiles } from './source-file-index.ts';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import {
  classScopes,
  escapes,
  lineCounter,
  maskStrings,
  matchDelimiter,
  realPath,
  skipString,
  stripComments,
  toPosixPath,
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
  snapshot: true,
  args: [],
  returns: describable(v.array(PipeSchema)),
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
  const major = angularMajor(cwd);
  const files = scanSourceFiles(cwd, `pipes:${major ?? '?'}`, (file) => {
    const usages = new Map<string, UsageSite[]>();
    const missing: string[] = [];
    const templates = templatesIn(file.content, file.relPath, file.full, cwd, missing);
    for (const t of templates) recordUsages(t.text, t.file, t.lineAt, t.baseOffset, usages);
    return {
      value: { pipes: pipesIn(file.content, file.relPath, major), usages: [...usages] },
      deps: templateDeps(templates, file.relPath, cwd, missing),
    };
  });
  // The kept results are shared between calls, so the answer is built from copies.
  const pipes: PipeInfo[] = files.flatMap((file) => file.pipes.map((pipe) => ({ ...pipe })));
  const usagesByName = new Map<string, UsageSite[]>();
  for (const file of files) {
    for (const [name, sites] of file.usages) {
      const list = usagesByName.get(name);
      if (list) list.push(...sites);
      else usagesByName.set(name, [...sites]);
    }
  }
  for (const pipe of pipes) {
    const usages = usagesByName.get(pipe.name);
    if (!usages) continue;
    pipe.usageCount = usages.length;
    pipe.usages = usages;
  }
  for (const [name, usages] of usagesByName) {
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

function pipesIn(content: string, relPath: string, major: number | undefined): PipeInfo[] {
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
      isStandalone: standaloneOf(scope.decoratorArgs, major),
      isPure: !/\bpure\s*:\s*false\b/.test(scope.decoratorArgs ?? ''),
      builtin: false,
    });
  }
  return pipes;
}

/** The `templateUrl` files among `templates`, by absolute path, plus the
 * `missing` ones `templatesIn` could not read, so a kept scan of their
 * component file is redone when one of them changes or appears. */
export function templateDeps(
  templates: readonly TemplateSource[],
  relPath: string,
  cwd: string,
  missing: readonly string[] = [],
): string[] {
  const root = realPath(cwd);
  return [
    ...templates
      .filter((template) => template.baseOffset === 0 && template.file !== relPath)
      .map((template) => join(root, template.file)),
    ...missing,
  ];
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
 * line number. Shared by the pipe usage scan and the pipe linter. A
 * `templateUrl` inside the workspace that cannot be read is added to
 * `missing` by absolute path, for `templateDeps`.
 */
export function templatesIn(
  content: string,
  relPath: string,
  fullPath: string,
  cwd: string,
  missing?: string[],
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
      const external = url && templateFromUrl(url.value, fullPath, cwd, missing);
      if (external) out.push(external);
    }
    decorator.lastIndex = close;
  }
  return out;
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
function templateFromUrl(
  url: string,
  fullPath: string,
  cwd: string,
  missing?: string[],
): TemplateSource | null {
  const templatePath = resolve(dirname(fullPath), url);
  const root = realPath(cwd);
  const real = realPath(templatePath);
  const inside = relative(root, real);
  if (escapes(inside) || isAbsolute(inside)) return null;
  try {
    const text = readFileSync(real, 'utf-8');
    // `inside` is already relative(root, real): both real, so it matches
    // `cwd`-relative paths reported elsewhere without a second `relative()`
    // call that would mix a real path with an unresolved `cwd` and produce a
    // long, wrong `../../` chain wherever `cwd` sits behind a symlink itself
    // (e.g. macOS's /var -> /private/var).
    return { text, file: toPosixPath(inside), lineAt: lineCounter(text), baseOffset: 0 };
  } catch {
    // templateUrl does not resolve to a readable file yet: watch for it.
    missing?.push(real);
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
    const usages = out.get(name) ?? [];
    usages.push({ file, line: lineAt(baseOffset + index) });
    out.set(name, usages);
  }
}

/**
 * Byte spans of every real Angular expression in a template: `{{ }}`
 * interpolations, bound attribute/event/structural-directive values
 * (`[x]="…"`, `(x)="…"`, `*x="…"`), `@if`/`@else if`/`@for`/`@switch`/`@case`
 * conditions, `@defer` triggers and `@let` values. Plain markup and text nodes — where `| word` is prose, not a
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
  const boundAttr =
    /(?:\[\(?@?[\w.$-]+\)?\]|\(@?[\w.$-]+\)|\*[\w.$-]+|\b(?:bind|on|bindon)-[\w.$-]+)\s*=\s*(["'])/g;
  while ((m = boundAttr.exec(text)) !== null) {
    const quote = m[1];
    const start = m.index + m[0].length;
    const end = text.indexOf(quote, start);
    if (end === -1) continue;
    regions.push({ start, end });
    boundAttr.lastIndex = end + 1;
  }

  const control = /@(?:if|else\s+if|for|switch|case|defer)\s*\(/g;
  while ((m = control.exec(text)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = matchDelimiter(text, open, '(', ')');
    regions.push({ start: open + 1, end: close });
    control.lastIndex = close + 1;
  }

  const letDecl = /@let\s+[\w$]+\s*=/g;
  while ((m = letDecl.exec(text)) !== null) {
    const start = m.index + m[0].length;
    const end = letEnd(text, start);
    regions.push({ start, end });
    letDecl.lastIndex = end + 1;
  }

  return regions;
}

/** The `;` that ends a `@let` value, skipping strings and nested brackets. */
function letEnd(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipString(text, i);
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (--depth < 0) return i;
    } else if (ch === ';' && depth === 0) return i;
  }
  return text.length;
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
    const slice = maskStrings(text.slice(region.start, region.end));
    PIPE_USE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = PIPE_USE.exec(slice)) !== null) {
      const name = match[1];
      uses.push({ name, index: region.start + match.index + match[0].length - name.length });
    }
  }
  return uses;
}
