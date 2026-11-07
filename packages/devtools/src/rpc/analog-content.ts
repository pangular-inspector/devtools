// Content tab extras: a frontmatter check against the JSON Schema file named
// by `analog.contentSchema`, the places the app reads content files, and a
// preview of one file's markdown.

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { REDACTED, isSecretName, redactText } from '../serialize.ts';

/** A JSON Schema subset: the keywords `validateFrontmatter` checks. */
export interface ContentSchema {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, ContentSchema>;
  additionalProperties?: boolean;
  enum?: unknown[];
  const?: unknown;
  pattern?: string;
  format?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  items?: ContentSchema;
  minItems?: number;
  maxItems?: number;
}

export interface ContentSchemaInfo {
  /** The schema file as a project path (`/content.schema.json`), or as configured when outside. */
  file: string;
  /** Why the schema was not used: missing, outside the project, not JSON. */
  error?: string;
  /** Keywords the schema uses that the check skips, such as `$ref`. */
  unsupported?: string[];
}

export interface ContentUsage {
  file: string;
  /** `injectContentFiles`, `injectContent` or `contentFilesSource`. */
  api: string;
  line: number;
}

export interface ContentPreview {
  file: string;
  /** Frontmatter values with their YAML types (string, number, boolean, list, map). */
  values: Record<string, unknown>;
  /** The markdown after the frontmatter, masked and clipped. */
  body: string;
  truncated?: true;
  schemaErrors?: string[];
  error?: string;
}

const MAX_SCHEMA_BYTES = 200_000;
const MAX_ERRORS = 20;
const MAX_BODY = 20_000;
const MAX_VALUE = 500;
const SUPPORTED = new Set<string>([
  'type',
  'required',
  'properties',
  'additionalProperties',
  'enum',
  'const',
  'pattern',
  'format',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'items',
  'minItems',
  'maxItems',
  'title',
  'description',
  'default',
  'examples',
  '$schema',
  '$id',
  '$comment',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Whether `full` is `root` or a path inside it, after symlinks are resolved. */
function inside(root: string, full: string): boolean {
  try {
    const real = realpathSync(full);
    const base = realpathSync(root);
    const rel = relative(base, real);
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
  } catch {
    return false;
  }
}

function scalar(raw: string): unknown {
  const text = raw.trim();
  if (/^(['"]).*\1$/.test(text)) return text.slice(1, -1).slice(0, MAX_VALUE);
  if (text === '' || text === '~' || text === 'null') return null;
  if (text === 'true' || text === 'false') return text === 'true';
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  if (text.startsWith('[') && text.endsWith(']')) {
    const inner = text.slice(1, -1).trim();
    return inner ? inner.split(',').map((part) => scalar(part)) : [];
  }
  return text.slice(0, MAX_VALUE);
}

/**
 * Reads a frontmatter block with YAML types: scalars, inline `[a, b]` lists,
 * `- item` lists and one level of nested maps. Enough for the usual title,
 * date, tags and draft keys; anything deeper is kept as text.
 */
export function typedFrontmatter(source: string): {
  values: Record<string, unknown>;
  body: string;
  error?: string;
} {
  if (!source.startsWith('---')) return { values: {}, body: source };
  const end = source.indexOf('\n---', 3);
  if (end < 0)
    return { values: {}, body: source, error: 'Frontmatter block is not closed with ---' };
  const afterEnd = source.indexOf('\n', end + 4);
  const body = afterEnd < 0 ? '' : source.slice(afterEnd + 1);
  const values: Record<string, unknown> = {};
  let key: string | undefined;
  for (const line of source.slice(3, end).replace(/\r/g, '').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const item = line.match(/^\s+-\s*(.*)$/);
    if (item && key) {
      const list = Array.isArray(values[key]) ? (values[key] as unknown[]) : [];
      list.push(scalar(item[1]));
      values[key] = list;
      continue;
    }
    const nested = line.match(/^\s+([\w-]+)\s*:\s*(.*)$/);
    if (nested && key) {
      const current = values[key];
      const map: Record<string, unknown> = isRecord(current) ? current : {};
      map[nested[1]] = scalar(nested[2]);
      values[key] = map;
      continue;
    }
    const top = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!top) return { values, body, error: `Cannot read frontmatter line: ${line.slice(0, 60)}` };
    key = top[1];
    values[key] = top[2].trim() === '' ? null : scalar(top[2]);
  }
  return { values, body };
}

function unsupportedKeywords(schema: unknown, out = new Set<string>(), depth = 0): Set<string> {
  if (!isRecord(schema) || depth > 10) return out;
  for (const key of Object.keys(schema)) if (!SUPPORTED.has(key)) out.add(key);
  if (isRecord(schema['properties'])) {
    for (const child of Object.values(schema['properties'])) {
      unsupportedKeywords(child, out, depth + 1);
    }
  }
  unsupportedKeywords(schema['items'], out, depth + 1);
  return out;
}

/**
 * Reads the JSON Schema file `analog.contentSchema` names. The path is
 * relative to the project root and must stay inside it.
 */
export function loadContentSchema(
  root: string,
  path: string,
): { info: ContentSchemaInfo; schema?: ContentSchema } {
  const full = resolve(root, path);
  const inRoot = relative(root, full).split(sep).join('/');
  const info: ContentSchemaInfo = {
    file: inRoot.startsWith('..') || isAbsolute(inRoot) ? path : `/${inRoot}`,
  };
  if (!existsSync(full)) {
    info.error = `${path} does not exist in the project.`;
    return { info };
  }
  if (!inside(root, full)) {
    info.error = `${path} is outside the project, so it was not read.`;
    return { info };
  }
  let text: string;
  try {
    if (statSync(full).size > MAX_SCHEMA_BYTES) {
      info.error = `${path} is larger than 200 KB, so it was not read.`;
      return { info };
    }
    text = readFileSync(full, 'utf-8');
  } catch {
    info.error = `${path} could not be read.`;
    return { info };
  }
  let schema: unknown;
  try {
    schema = JSON.parse(text);
  } catch {
    info.error = `${path} is not valid JSON. Point analog.contentSchema at a JSON Schema file.`;
    return { info };
  }
  if (!isRecord(schema)) {
    info.error = `${path} is not a JSON Schema object.`;
    return { info };
  }
  const unsupported = [...unsupportedKeywords(schema)].sort();
  if (unsupported.length) info.unsupported = unsupported.slice(0, 10);
  return { info, schema: schema as ContentSchema };
}

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

function typeMatches(want: string, value: unknown): boolean {
  const got = typeOf(value);
  if (want === got) return true;
  if (want === 'number' && got === 'integer') return true;
  return false;
}

const FORMATS: Record<string, RegExp> = {
  date: /^\d{4}-\d{2}-\d{2}$/,
  'date-time': /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uri: /^[a-z][a-z\d+.-]*:\S+$/i,
};

function show(value: unknown): string {
  const text = JSON.stringify(value) ?? String(value);
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

function check(name: string, value: unknown, schema: ContentSchema, errors: string[]): void {
  if (errors.length >= MAX_ERRORS) return;
  const types = schema.type === undefined ? [] : [schema.type].flat();
  // YAML reads a bare date as a date; this reader keeps it as text, so `date` strings pass `string`.
  if (types.length && !types.some((type) => typeMatches(type, value))) {
    errors.push(`${name} should be ${types.join(' or ')}, got ${typeOf(value)} ${show(value)}.`);
    return;
  }
  if (schema.enum && !schema.enum.some((option) => show(option) === show(value))) {
    errors.push(
      `${name} should be one of ${schema.enum.map(show).join(', ')}, got ${show(value)}.`,
    );
  }
  if (schema.const !== undefined && show(schema.const) !== show(value)) {
    errors.push(`${name} should be ${show(schema.const)}, got ${show(value)}.`);
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${name} should have at least ${schema.minLength} characters.`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${name} should have at most ${schema.maxLength} characters.`);
    }
    if (schema.pattern) {
      let pattern: RegExp | undefined;
      try {
        pattern = new RegExp(schema.pattern, 'u');
      } catch {
        errors.push(`${name}: the schema pattern ${show(schema.pattern)} is not a valid regex.`);
      }
      if (pattern && !pattern.test(value.slice(0, MAX_VALUE))) {
        errors.push(`${name} does not match the pattern ${show(schema.pattern)}.`);
      }
    }
    const format = schema.format && FORMATS[schema.format];
    if (format && !format.test(value)) {
      errors.push(`${name} should be a ${schema.format}, got ${show(value)}.`);
    }
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${name} should be at least ${schema.minimum}.`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${name} should be at most ${schema.maximum}.`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${name} should have at least ${schema.minItems} items.`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${name} should have at most ${schema.maxItems} items.`);
    }
    if (isRecord(schema.items)) {
      value.forEach((item, index) => check(`${name}[${index}]`, item, schema.items!, errors));
    }
  }
  if (isRecord(value)) checkObject(name, value, schema, errors);
}

function checkObject(
  prefix: string,
  value: Record<string, unknown>,
  schema: ContentSchema,
  errors: string[],
): void {
  const at = (key: string) => (prefix ? `${prefix}.${key}` : key);
  for (const key of schema.required ?? []) {
    if (value[key] === undefined) errors.push(`${at(key)} is required.`);
  }
  const properties = isRecord(schema.properties) ? schema.properties : {};
  for (const [key, item] of Object.entries(value)) {
    const own = properties[key];
    if (own) check(at(key), item, own, errors);
    else if (schema.additionalProperties === false) {
      errors.push(`${at(key)} is not in the schema.`);
    }
  }
}

/** Checks frontmatter values against a schema; an empty list means they pass. */
export function validateFrontmatter(
  values: Record<string, unknown>,
  schema: ContentSchema,
): string[] {
  const errors: string[] = [];
  checkObject('', values, schema, errors);
  return errors.slice(0, MAX_ERRORS);
}

const USAGE = /\b(injectContentFiles|injectContent|contentFilesSource)\b/g;

/** Where the app reads content files, from source files already read by the scan. */
export function contentUsageOf(file: string, source: string): ContentUsage[] {
  const out: ContentUsage[] = [];
  const seen = new Set<string>();
  for (const match of source.matchAll(USAGE)) {
    // Skip the import line; the call sites are what matter.
    const lineStart = source.lastIndexOf('\n', match.index) + 1;
    const lineEnd = source.indexOf('\n', match.index);
    const line = source.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
    if (/^\s*import\b/.test(line) || /^\s*}\s*from\b/.test(line)) continue;
    if (/^\s*[\w,\s]*$/.test(line) && !line.includes('(')) continue;
    const key = `${match[1]}:${lineStart}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ file, api: match[1], line: source.slice(0, match.index).split('\n').length });
  }
  return out;
}

/** Whether `file` (a project path like `/src/content/post.md`) is a content file. */
export function isContentPath(file: string): boolean {
  return /^\/src\/content\/(?:[^/\\]+\/)*[^/\\]+\.md$/.test(file) && !file.includes('..');
}

/** One content file's frontmatter, schema result and masked markdown, for the preview. */
export function contentPreview(root: string, file: string, schema?: ContentSchema): ContentPreview {
  if (typeof file !== 'string' || !isContentPath(file)) {
    return {
      file: String(file),
      values: {},
      body: '',
      error: 'Pass a .md file under src/content.',
    };
  }
  const full = join(root, ...file.split('/').filter(Boolean));
  if (!inside(join(root, 'src', 'content'), full) || !full.startsWith(root + sep)) {
    return { file, values: {}, body: '', error: `${file} is not in src/content.` };
  }
  let source: string;
  try {
    source = readFileSync(full, 'utf-8');
  } catch {
    return { file, values: {}, body: '', error: `${file} could not be read.` };
  }
  const parsed = typedFrontmatter(source);
  const values = Object.fromEntries(
    Object.entries(parsed.values).map(([key, value]) => [key, maskValue(value, key)]),
  );
  const body = redactText(parsed.body.slice(0, MAX_BODY + 1));
  const preview: ContentPreview = {
    file,
    values,
    body: body.length > MAX_BODY ? body.slice(0, MAX_BODY) : body,
  };
  if (body.length > MAX_BODY) preview.truncated = true;
  if (parsed.error) preview.error = parsed.error;
  if (schema && !parsed.error) {
    const errors = validateFrontmatter(parsed.values, schema);
    if (errors.length) preview.schemaErrors = errors;
  }
  return preview;
}

function maskValue(value: unknown, key?: string): unknown {
  if (key !== undefined && isSecretName(key) && value !== null) return REDACTED;
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map((item) => maskValue(item));
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskValue(v, k)]));
  }
  return value;
}
