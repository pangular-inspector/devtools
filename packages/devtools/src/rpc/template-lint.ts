// Lints the project's component templates (inline `template:` and
// `templateUrl` files) with the project's own `@angular/compiler`, so a
// finding is read from the same AST Angular compiles, not guessed with a
// regex. The compiler is loaded from the project, never bundled: when the
// project has none, the tool says so and reports nothing.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { templatesIn, type TemplateSource } from './get-pipes.ts';
import { sourceRoots, walkFiles } from './source-scan.ts';
import type { LintSeverity } from './pipe-lint.ts';
import { redactText } from '../text-redact.ts';

export const TEMPLATE_LINT_RULES = {
  'template-parse-error': 'error',
  'track-by-index': 'warning',
  'img-missing-alt': 'warning',
  'click-without-key': 'warning',
  'legacy-control-flow': 'info',
  'ngclass-ngstyle': 'info',
} as const satisfies Record<string, LintSeverity>;

export type TemplateLintRule = keyof typeof TEMPLATE_LINT_RULES;

export interface TemplateLintFinding {
  rule: TemplateLintRule;
  severity: LintSeverity;
  /** Path relative to the project: the `.ts` file for an inline template, the `.html` file otherwise. */
  file: string;
  line: number;
  message: string;
  fix: string;
}

export interface TemplateLintResult {
  /** `false` when the project has no `@angular/compiler` to parse with. */
  parsed: boolean;
  templates: number;
  findings: TemplateLintFinding[];
}

type Ctor = abstract new (...args: never[]) => object;

interface ParseErrorLike {
  msg: string;
  level: number;
  span: { start: { offset: number } };
}

/** The parts of `@angular/compiler` the lint reads, checked against 22.1. */
export interface TemplateCompiler {
  VERSION?: { major: string };
  parseTemplate(
    template: string,
    templateUrl: string,
    options?: Record<string, unknown>,
  ): { errors: ParseErrorLike[] | null; nodes: unknown[] };
  ParseErrorLevel: { ERROR: number };
  TmplAstElement: Ctor;
  TmplAstTemplate: Ctor;
  TmplAstForLoopBlock?: Ctor;
  PropertyRead: Ctor;
  SafePropertyRead?: Ctor;
  KeyedRead?: Ctor;
  SafeKeyedRead?: Ctor;
  ImplicitReceiver: Ctor;
  ThisReceiver?: Ctor;
}

interface Span {
  start: { offset: number };
}
interface Attribute {
  name: string;
  value: unknown;
  sourceSpan: Span;
}
interface OutputNode {
  name: string;
}
interface ElementNode {
  name: string;
  attributes: Attribute[];
  inputs: Attribute[];
  outputs: OutputNode[];
  startSourceSpan: Span;
}
interface TemplateNode {
  templateAttrs: Attribute[];
}
interface ForLoopNode {
  item: { name: string };
  trackBy?: { ast?: unknown };
  trackKeywordSpan?: Span;
  contextVariables?: { name: string; value: string }[];
  children: unknown[];
  sourceSpan: Span;
}
interface ReadNode {
  name?: string;
  receiver: unknown;
}

const compilers = new Map<string, Promise<TemplateCompiler | undefined>>();

/** The project's own `@angular/compiler`, or `undefined` when it has none. A
 * miss is not remembered, so installing it works without a restart. */
export function projectCompiler(cwd: string): Promise<TemplateCompiler | undefined> {
  const known = compilers.get(cwd);
  if (known) return known;
  const loading = (async () => {
    try {
      const path = createRequire(join(cwd, 'package.json')).resolve('@angular/compiler');
      const mod = (await import(pathToFileURL(path).href)) as Partial<TemplateCompiler>;
      return typeof mod.parseTemplate === 'function' ? (mod as TemplateCompiler) : undefined;
    } catch {
      return undefined;
    }
  })();
  compilers.set(cwd, loading);
  void loading.then((found) => {
    if (!found) compilers.delete(cwd);
  });
  return loading;
}

/** Findings per template, keyed by compiler, then project, then the file,
 * offset and text of the template. A template whose text is unchanged is not
 * parsed again; each scan keeps only the templates it saw. */
const cache = new WeakMap<TemplateCompiler, Map<string, Map<string, TemplateLintFinding[]>>>();

export async function lintTemplates(
  cwd: string,
  options: { compiler?: TemplateCompiler } = {},
): Promise<TemplateLintResult> {
  const compiler = options.compiler ?? (await projectCompiler(cwd));
  if (!compiler) return { parsed: false, templates: 0, findings: [] };

  const byProject = cache.get(compiler) ?? new Map<string, Map<string, TemplateLintFinding[]>>();
  cache.set(compiler, byProject);
  const previous = byProject.get(cwd) ?? new Map<string, TemplateLintFinding[]>();
  const next = new Map<string, TemplateLintFinding[]>();
  const major = Number(compiler.VERSION?.major);
  const hasControlFlow = !Number.isFinite(major) || major >= 17;

  let templates = 0;
  const findings: TemplateLintFinding[] = [];
  for (const root of sourceRoots(cwd)) {
    walkFiles(root, (full, entry) => {
      if (!entry.endsWith('.ts') || entry.endsWith('.spec.ts')) return;
      let content: string;
      try {
        content = readFileSync(full, 'utf-8');
      } catch {
        return;
      }
      if (!content.includes('@Component')) return;
      const relPath = relative(cwd, full);
      for (const template of templatesIn(content, relPath, full, cwd)) {
        const text = templateText(template, content, relPath);
        if (text === undefined) continue;
        templates++;
        const key = `${template.file}\0${template.baseOffset}\0${text}`;
        const own = next.get(key) ?? previous.get(key) ?? lintTemplate(compiler, template, text);
        next.set(key, own);
        for (const finding of own) {
          if (finding.rule === 'legacy-control-flow' && !hasControlFlow) continue;
          findings.push(finding);
        }
      }
    });
  }
  byProject.set(cwd, next);
  return { parsed: true, templates, findings };
}

/** The template as Angular sees it, with the same length so parser offsets
 * map back to the file. Escapes in a quoted inline template become a space
 * and the character; a backtick template with `${}` is skipped, as it is
 * built at run time. */
function templateText(
  template: TemplateSource,
  content: string,
  relPath: string,
): string | undefined {
  if (template.file !== relPath) return template.text;
  const quote = content[template.baseOffset - 1];
  if (quote === '`') return template.text.includes('${') ? undefined : template.text;
  return template.text.replace(/\\(.)/g, (_, ch: string) => ` ${ch === 'n' ? ' ' : ch}`);
}

function lintTemplate(
  compiler: TemplateCompiler,
  template: TemplateSource,
  text: string,
): TemplateLintFinding[] {
  const at = (offset: number) => template.lineAt(template.baseOffset + offset);
  const findings: TemplateLintFinding[] = [];
  const add = (rule: TemplateLintRule, offset: number, message: string, fix: string) =>
    findings.push({
      rule,
      severity: TEMPLATE_LINT_RULES[rule],
      file: template.file,
      line: at(offset),
      message,
      fix,
    });

  let parsed: ReturnType<TemplateCompiler['parseTemplate']>;
  try {
    parsed = compiler.parseTemplate(text, template.file, { preserveWhitespaces: false });
  } catch (error) {
    add(
      'template-parse-error',
      0,
      `The template parser stopped: ${redactText(error instanceof Error ? error.message : String(error))}`,
      'Fix the syntax near the reported spot; `ng build` reports the same error.',
    );
    return findings;
  }

  const seen = new Set<number>();
  for (const error of parsed.errors ?? []) {
    if (error.level !== compiler.ParseErrorLevel.ERROR) continue;
    const offset = error.span.start.offset;
    if (seen.has(offset)) continue;
    seen.add(offset);
    add(
      'template-parse-error',
      offset,
      redactText(error.msg.replace(/\s+in \S+@\d+:\d+$/, '')),
      'Fix the syntax here; `ng build` fails on the same error.',
    );
  }

  walk(parsed.nodes, (node) => {
    if (node instanceof compiler.TmplAstElement) elementFindings(node as ElementNode, add);
    else if (node instanceof compiler.TmplAstTemplate) legacyFindings(node as TemplateNode, add);
    else if (compiler.TmplAstForLoopBlock && node instanceof compiler.TmplAstForLoopBlock) {
      trackFindings(compiler, node as ForLoopNode, add);
    }
  });
  return findings;
}

type Add = (rule: TemplateLintRule, offset: number, message: string, fix: string) => void;

/** Keys that hold source spans, i18n metadata or raw text, never child nodes. */
function skipKey(key: string): boolean {
  return /span$/i.test(key) || ['i18n', 'source', 'location', 'errors', 'file'].includes(key);
}

/** Visits every template node and expression under `value` once. */
function walk(value: unknown, visit: (node: object) => void, seen = new Set<object>()) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit, seen);
    return;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  visit(value);
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === 'object' && !skipKey(key)) walk(child, visit, seen);
  }
}

const LEGACY: Record<string, string> = {
  ngIf: '@if',
  ngFor: '@for',
  ngForOf: '@for',
  ngSwitchCase: '@switch',
  ngSwitchDefault: '@switch',
};

function legacyFindings(node: TemplateNode, add: Add) {
  // `templateAttrs` holds only the `*` microsyntax, so `<ng-template [ngIf]>`
  // is left alone.
  const attr = (node.templateAttrs ?? []).find((a) => a.name in LEGACY);
  if (!attr) return;
  const block = LEGACY[attr.name];
  const directive = attr.name === 'ngForOf' ? 'ngFor' : attr.name;
  add(
    'legacy-control-flow',
    attr.sourceSpan.start.offset,
    `\`*${directive}\` is the structural directive form; Angular 17 added the built-in \`${block}\` block, which needs no import and type-checks better.`,
    `Rewrite it as \`${block}\`, by hand or with \`ng generate @angular/core:control-flow\`.`,
  );
}

const INTERACTIVE = new Set([
  'a',
  'area',
  'audio',
  'button',
  'details',
  'embed',
  'iframe',
  'input',
  'label',
  'object',
  'option',
  'select',
  'summary',
  'textarea',
  'video',
]);

function staticValue(element: ElementNode, name: string): string | undefined {
  const attr = element.attributes.find((a) => a.name.toLowerCase() === name);
  return attr && typeof attr.value === 'string' ? attr.value.trim().toLowerCase() : undefined;
}

/** Bound by `[name]`, `[attr.name]` or `bind-name`. */
function isBound(element: ElementNode, name: string): boolean {
  return element.inputs.some((input) => input.name.toLowerCase() === name);
}

/** Hidden from assistive tech, so neither alt text nor key handling matter. */
function isPresentational(element: ElementNode): boolean {
  const role = staticValue(element, 'role');
  return (
    role === 'presentation' ||
    role === 'none' ||
    staticValue(element, 'aria-hidden') === 'true' ||
    isBound(element, 'role') ||
    isBound(element, 'aria-hidden')
  );
}

function elementFindings(element: ElementNode, add: Add) {
  const name = element.name.toLowerCase();
  const offset = element.startSourceSpan.start.offset;

  for (const directive of ['ngClass', 'ngStyle']) {
    const used =
      element.inputs.find((input) => input.name === directive) ??
      element.attributes.find((attr) => attr.name === directive);
    if (!used) continue;
    const binding = directive === 'ngClass' ? 'class' : 'style';
    add(
      'ngclass-ngstyle',
      used.sourceSpan.start.offset,
      `\`${directive}\` needs an import and a directive per element; \`[${binding}]\` and \`[${binding}.x]\` bindings take the same object, array or string without one.`,
      `Bind \`[${binding}]\` (or \`[${binding}.name]\`) instead and drop the ${directive === 'ngClass' ? 'NgClass' : 'NgStyle'} import.`,
    );
  }

  if (name === 'img' && !element.attributes.some((a) => a.name.toLowerCase() === 'alt')) {
    if (!isBound(element, 'alt') && !isPresentational(element)) {
      add(
        'img-missing-alt',
        offset,
        '`<img>` has no `alt`, so screen readers announce the file name or nothing.',
        'Add `alt` text that says what the image shows, or `alt=""` when it is decorative.',
      );
    }
  }

  // Custom elements (`app-card`) and namespaced ones (`:svg:g`) are skipped:
  // a component can handle keys itself.
  if (INTERACTIVE.has(name) || name.includes('-') || name.includes(':')) return;
  if (!element.outputs.some((output) => output.name === 'click')) return;
  if (element.outputs.some((output) => /^key(down|up|press)\b/.test(output.name))) return;
  if (isPresentational(element) || staticValue(element, 'contenteditable') !== undefined) return;
  add(
    'click-without-key',
    offset,
    `\`<${name}>\` has a \`(click)\` handler but no keyboard handler, so keyboard users cannot trigger it.`,
    'Use a `<button>` (or `<a>` for navigation), or add `tabindex="0"`, a `role` and a `(keydown.enter)` handler.',
  );
}

function trackFindings(compiler: TemplateCompiler, loop: ForLoopNode, add: Add) {
  const track = loop.trackBy?.ast;
  if (!track || !(track instanceof compiler.PropertyRead)) return;
  const read = track as ReadNode;
  if (!isImplicit(compiler, read.receiver)) return;
  const indexNames = new Set(['$index']);
  for (const variable of loop.contextVariables ?? []) {
    if (variable.value === '$index') indexNames.add(variable.name);
  }
  if (!read.name || !indexNames.has(read.name)) return;
  // Only when the body reads a field of the item: then the items are objects,
  // and tracking by position rebuilds every row after an insert or a sort.
  if (!readsItemField(compiler, loop)) return;
  // Form array rows are found by position (`[formControlName]="$index"`), so
  // tracking them by `$index` is deliberate.
  if (bindsFormDirective(compiler, loop)) return;
  add(
    'track-by-index',
    (loop.trackKeywordSpan ?? loop.sourceSpan).start.offset,
    `\`@for\` tracks \`${loop.item.name}\` by \`${read.name}\`, but the items are objects, so an insert, removal or sort re-renders every row after it and moves their state.`,
    `Track by a stable key, such as \`track ${loop.item.name}.id\`.`,
  );
}

/** Directive inputs that tie a row to a form array entry. */
const FORM_ROW_BINDINGS = new Set([
  'formControlName',
  'formGroupName',
  'formArrayName',
  'formControl',
  'formGroup',
  'formField',
  'field',
  'control',
]);

function bindsFormDirective(compiler: TemplateCompiler, loop: ForLoopNode): boolean {
  let found = false;
  walk(loop.children, (node) => {
    if (found || !(node instanceof compiler.TmplAstElement)) return;
    const element = node as ElementNode;
    found = [...element.inputs, ...element.attributes].some((a) => FORM_ROW_BINDINGS.has(a.name));
  });
  return found;
}

function isImplicit(compiler: TemplateCompiler, receiver: unknown): boolean {
  if (!(receiver instanceof compiler.ImplicitReceiver)) return false;
  return !compiler.ThisReceiver || !(receiver instanceof compiler.ThisReceiver);
}

function readsItemField(compiler: TemplateCompiler, loop: ForLoopNode): boolean {
  const reads = [
    compiler.PropertyRead,
    compiler.SafePropertyRead,
    compiler.KeyedRead,
    compiler.SafeKeyedRead,
  ].filter((ctor): ctor is Ctor => typeof ctor === 'function');
  let found = false;
  walk(loop.children, (node) => {
    if (found || !reads.some((ctor) => node instanceof ctor)) return;
    const receiver = (node as ReadNode).receiver as ReadNode | undefined;
    found =
      !!receiver &&
      receiver instanceof compiler.PropertyRead &&
      receiver.name === loop.item.name &&
      isImplicit(compiler, receiver.receiver);
  });
  return found;
}

export interface TemplateLintArgs {
  rule?: string;
  file?: string;
  severity?: string;
  limit?: number;
}

const ORDER: Record<LintSeverity, number> = { error: 0, warning: 1, info: 2 };
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function templateLintText(result: TemplateLintResult, args: TemplateLintArgs = {}): string {
  if (!result.parsed) {
    return 'Cannot lint templates: this project has no `@angular/compiler` installed to parse them with. Install dependencies and try again.';
  }
  const rules = Object.keys(TEMPLATE_LINT_RULES);
  if (args.rule && !rules.includes(args.rule)) {
    return `Unknown rule ${JSON.stringify(args.rule)}. Rules: ${rules.map((r) => `\`${r}\``).join(', ')}.`;
  }
  if (args.severity && !(args.severity in ORDER)) {
    return `Unknown severity ${JSON.stringify(args.severity)}. Use \`error\`, \`warning\` or \`info\`.`;
  }
  if (!result.templates) return 'No component templates found in source.';

  const fileFilter = args.file?.replace(/\\/g, '/');
  const matching = result.findings
    .filter((f) => !args.rule || f.rule === args.rule)
    .filter((f) => !args.severity || f.severity === args.severity)
    .filter((f) => !fileFilter || f.file.replace(/\\/g, '/').includes(fileFilter))
    .sort(
      (a, b) =>
        ORDER[a.severity] - ORDER[b.severity] ||
        a.file.localeCompare(b.file) ||
        a.line - b.line ||
        a.rule.localeCompare(b.rule),
    );
  const scope = `${result.templates} template${result.templates === 1 ? '' : 's'}`;
  const filtered = args.rule || args.file || args.severity;
  if (!matching.length) {
    return `No template problems found by the lint rules in ${scope}${filtered ? ' with these filters' : ''}.`;
  }

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Math.floor(Number.isFinite(args.limit) ? Number(args.limit) : DEFAULT_LIMIT)),
  );
  const shown = matching.slice(0, limit);
  const counts = (['error', 'warning', 'info'] as const)
    .map((severity) => [severity, matching.filter((f) => f.severity === severity).length] as const)
    .filter(([, n]) => n)
    .map(([severity, n]) => `${n} ${severity}`)
    .join(', ');
  const lines = [
    `${matching.length} finding${matching.length === 1 ? '' : 's'} (${counts}) in ${scope}.`,
    '',
    ...shown.map(
      (f) => `- **${f.severity}** ${f.rule} at \`${f.file}:${f.line}\`: ${f.message} Fix: ${f.fix}`,
    ),
  ];
  if (matching.length > shown.length) {
    lines.push(
      '',
      `${matching.length - shown.length} more not shown. Pass \`rule\`, \`file\`, \`severity\` or a higher \`limit\` (up to ${MAX_LIMIT}).`,
    );
  }
  return lines.join('\n');
}
