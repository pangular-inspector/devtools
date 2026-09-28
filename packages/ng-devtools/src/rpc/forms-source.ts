import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { lineCounter, sourceRoots, stripComments, walkFiles } from './source-scan.ts';

export interface SourceLine {
  file: string;
  line: number;
  text: string;
}

export interface FormSource {
  form?: SourceLine;
  rules: SourceLine[];
  schemas?: (SourceLine & { name: string })[];
}

export interface SchemaSource {
  content: string;
  file: string;
}

const MAX_FILES = 5000;
const CACHE_MS = 10_000;
const RULE_CALL =
  /\b(required|validate\w*|min|max|minLength|maxLength|minDate|maxDate|pattern|email|disabled|hidden|readonly|debounce|metadata|applyWhen\w*|applyEach|Validators\.\w+)\s*\(/;

let cache: {
  cwd: string;
  at: number;
  files: string[];
  contents: Map<string, string | null>;
  found: Map<string, FormSource | null>;
} | null = null;

function listFiles(cwd: string): string[] {
  if (cache && cache.cwd === cwd && Date.now() - cache.at < CACHE_MS) return cache.files;
  const files: string[] = [];
  for (const root of sourceRoots(cwd)) {
    if (files.length >= MAX_FILES) break;
    walkFiles(root, (full, entry) => {
      if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts') && !entry.endsWith('.d.ts')) {
        files.push(full);
      }
      return files.length < MAX_FILES;
    });
  }
  cache = { cwd, at: Date.now(), files, contents: new Map(), found: new Map() };
  return files;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function classBody(source: string, owner: string): { start: number; end: number } | null {
  const match = new RegExp(`\\bclass\\s+_*${escape(owner)}\\b`).exec(source);
  if (!match) return null;
  const open = source.indexOf('{', match.index);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return { start: match.index, end: i };
  }
  return { start: match.index, end: source.length };
}

const SCHEMA_REF =
  /\b(?:form|apply|applyEach|applyWhen\w*)\s*\([^()]*?,\s*([A-Za-z_$][\w$]*)\s*[,)]/g;

function schemaRefs(text: string): string[] {
  return Array.from(text.matchAll(SCHEMA_REF), (match) => match[1]).filter(
    (name) => name !== 'this' && !/^(p|path|s|f|schema)$/.test(name),
  );
}

function blockEnd(source: string, open: number): number {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')' && --depth === 0) return i;
  }
  return source.length;
}

export function schemaDeclaration(
  source: string,
  name: string,
): { start: number; end: number } | null {
  const match = new RegExp(
    `\\b(?:const|let|var)\\s+${escape(name)}\\b[^=;]*=\\s*schema\\s*(?:<[^;]*?>)?\\s*\\(`,
  ).exec(source);
  if (!match) return null;
  const open = match.index + match[0].length - 1;
  return { start: match.index, end: blockEnd(source, open) };
}

function fieldRules(
  scope: string,
  base: number,
  key: string,
  at: (index: number) => SourceLine,
  out: SourceLine[],
) {
  const field = new RegExp(`(\\.${escape(key)}\\b|\\b${escape(key)}\\s*:)`);
  let offset = 0;
  for (const text of scope.split('\n')) {
    if (out.length >= 10) return;
    if (
      field.test(text) &&
      (RULE_CALL.test(text) || /new Form(Control|Group|Array)|\bfb\.|\[\s*['"]/.test(text))
    ) {
      out.push(at(base + offset));
    }
    offset += text.length + 1;
  }
}

export function formSourceIn(
  content: string,
  file: string,
  owner: string,
  property: string | undefined,
  path: string,
  lookup: (name: string) => SchemaSource | null = () => null,
): FormSource | null {
  const source = stripComments(content);
  const body = classBody(source, owner);
  if (!body) return null;
  const lineOf = lineCounter(source);
  const lines = content.split('\n');
  const at = (index: number): SourceLine => {
    const line = lineOf(index);
    return { file, line, text: (lines[line - 1] ?? '').trim().slice(0, 160) };
  };
  const scope = source.slice(body.start, body.end);
  const result: FormSource = { rules: [] };
  const declared = property
    ? new RegExp(`\\b${escape(property)}\\s*(?::[^=;]+)?=`).exec(scope)
    : null;
  result.form = at(body.start + (declared ? declared.index : 0));
  const key = path
    .split('.')
    .filter((k) => !/^\d+$/.test(k))
    .pop();
  if (key) fieldRules(scope, body.start, key, at, result.rules);
  const pending = schemaRefs(scope);
  const visited = new Set<string>();
  while (pending.length && visited.size < 10) {
    const name = pending.shift()!;
    if (visited.has(name)) continue;
    visited.add(name);
    const local = schemaDeclaration(source, name);
    const found = local ? { source, file, at, span: local } : schemaElsewhere(name, lookup);
    if (!found) continue;
    (result.schemas ??= []).push({ name, ...found.at(found.span.start) });
    const text = found.source.slice(found.span.start, found.span.end);
    if (key) fieldRules(text, found.span.start, key, found.at, result.rules);
    pending.push(...schemaRefs(text));
  }
  return result;
}

function schemaElsewhere(name: string, lookup: (name: string) => SchemaSource | null) {
  const other = lookup(name);
  if (!other) return null;
  const source = stripComments(other.content);
  const span = schemaDeclaration(source, name);
  if (!span) return null;
  const lineOf = lineCounter(source);
  const lines = other.content.split('\n');
  const at = (index: number): SourceLine => {
    const line = lineOf(index);
    return { file: other.file, line, text: (lines[line - 1] ?? '').trim().slice(0, 160) };
  };
  return { source, file: other.file, at, span };
}

export function findFormSource(
  cwd: string,
  owner: string,
  property: string | undefined,
  path = '',
): FormSource | null {
  if (!owner || owner === 'Unknown') return null;
  const files = listFiles(cwd);
  const key = `${owner}|${property ?? ''}|${path}`;
  const known = cache?.found.get(key);
  if (known !== undefined) return known;
  let result: FormSource | null = null;
  const needle = new RegExp(`\\bclass\\s+_*${escape(owner)}\\b`);
  for (const full of files) {
    const content = readCached(full);
    if (content === null || !needle.test(content)) continue;
    result = formSourceIn(content, relative(cwd, full), owner, property, path, (name) =>
      schemaFile(cwd, files, name),
    );
    if (result) break;
  }
  cache?.found.set(key, result);
  return result;
}

function schemaFile(cwd: string, files: string[], name: string): SchemaSource | null {
  const needle = new RegExp(`\\b(?:const|let|var)\\s+${escape(name)}\\b[^=;]*=\\s*schema\\b`);
  for (const full of files) {
    const content = readCached(full);
    if (content !== null && needle.test(content)) return { content, file: relative(cwd, full) };
  }
  return null;
}

function readCached(full: string): string | null {
  const known = cache?.contents.get(full);
  if (known !== undefined) return known;
  let content: string | null;
  try {
    content = readFileSync(full, 'utf-8');
  } catch {
    content = null;
  }
  cache?.contents.set(full, content);
  return content;
}

export function sourceText(source: FormSource | null): string {
  if (!source?.form) return '';
  const out = [`Defined at ${source.form.file}:${source.form.line}: ${source.form.text}`];
  for (const schema of source.schemas ?? []) {
    out.push(`Schema ${schema.name} at ${schema.file}:${schema.line}: ${schema.text}`);
  }
  for (const rule of source.rules) out.push(`- ${rule.file}:${rule.line}: ${rule.text}`);
  return out.join('\n');
}
