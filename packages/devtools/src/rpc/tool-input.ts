import { clip } from '../text.ts';
import { refusalOf, ToolRefusal } from './refusal.ts';

/**
 * The part of JSON Schema the agent tools use for `inputSchema`: `type`,
 * `properties`, `required`, `enum`, `minimum`/`maximum`, `minLength`/
 * `maxLength`, `items` and `additionalProperties`. Devframe hands a tool the
 * caller's arguments as they came, so {@link checkToolArgs} checks them first.
 */
export interface ToolInputSchema {
  type?: string | readonly string[];
  description?: string;
  properties?: Record<string, ToolInputSchema>;
  required?: readonly string[];
  enum?: readonly unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  items?: ToolInputSchema;
  additionalProperties?: boolean | ToolInputSchema;
}

export type CheckedArgs = { args: Record<string, unknown> } | { error: string };

const PAGE_KEYS = new Set(['page']);

/**
 * Argument names that 1.0 renamed, with the names that took their place. A
 * call that sends an old name the schema does not list is refused with the
 * new one, instead of the value being dropped without a word.
 */
const RENAMED_ARGUMENTS: Readonly<Record<string, readonly string[]>> = {
  pageId: ['page'],
  selector: ['component', 'injector'],
  storeId: ['store'],
  signal: ['property', 'node'],
  since: ['after'],
};

/**
 * Arguments that 1.0 moved to another tool, by the tool they left: each names
 * where to go instead. Checked only while that tool's schema lacks the key, as
 * for {@link RENAMED_ARGUMENTS}, so the value is refused instead of dropped.
 */
const MOVED_ARGUMENTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'change-detection': {
    record: '`pangular:record-change-detection`',
    flash: '`pangular:record-change-detection`',
    track: '`pangular:record-change-detection`',
    angularProfiling: '`pangular:record-change-detection`',
  },
  hydration: { overlay: '`pangular:highlight` with `hydration`' },
  navigate: {
    routeId: '`pangular:list-routes` with `resolveLazy`',
    on: '`pangular:record-guards` with `on`',
  },
};

const PAGE_HINT =
  'Pass a page id from pangular:list-pages, or leave it out for the most recent page.';
/** Problems named in one answer; the rest wait for the next call. */
const MAX_PROBLEMS = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function kindOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'object') return 'an object';
  if (typeof value === 'number' && Number.isInteger(value)) return 'the number';
  return `a ${typeof value}`;
}

/** `a number (12345)`: what the caller sent, short. */
function sent(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'nothing';
  const json = JSON.stringify(value) ?? String(value);
  return `${kindOf(value)} (${clip(json, 60)})`;
}

function typeName(type: string): string {
  return (
    {
      string: 'a string',
      integer: 'a whole number',
      number: 'a number',
      boolean: 'true or false',
      object: 'an object',
      array: 'an array',
      null: 'null',
    }[type] ?? type
  );
}

function hasType(value: unknown, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return isRecord(value);
    case 'array':
      return Array.isArray(value);
    case 'null':
      return value === null;
    default:
      return true;
  }
}

function typesOf(schema: ToolInputSchema): readonly string[] {
  if (typeof schema.type === 'string') return [schema.type];
  return schema.type ?? [];
}

/**
 * Whether `null` counts as a value left out for this property: only when the
 * property names its types and `null` is not one of them. An untyped property
 * (such as a signal's new value) or one that allows `null` keeps it.
 */
function nullIsMissing(schema: ToolInputSchema | undefined): boolean {
  if (!schema) return true;
  const types = typesOf(schema);
  return types.length > 0 && !types.includes('null');
}

/** Whether a required argument is missing: left out, or a `null` its type refuses. */
function isMissing(value: unknown, schema: ToolInputSchema | undefined): boolean {
  return value === undefined || (value === null && nullIsMissing(schema));
}

function listed(values: readonly unknown[]): string {
  return values.map((value) => `\`${String(value)}\``).join(', ');
}

/** What the argument is for, after the problem: the page hint, or its description. */
function hintFor(name: string, schema: ToolInputSchema): string {
  if (PAGE_KEYS.has(name)) return ` ${PAGE_HINT}`;
  const description = schema.description?.trim();
  if (!description) return '';
  const text = clip(description, 160);
  return ` ${text}${/[.!?)…]$/.test(text) ? '' : '.'}`;
}

/** The problems with one value, each naming `name`. */
function problemsOf(name: string, value: unknown, schema: ToolInputSchema): string[] {
  const types = typesOf(schema);
  if (types.length && !types.some((type) => hasType(value, type))) {
    const expected = types.map(typeName).join(' or ');
    return [`\`${name}\` must be ${expected}, not ${sent(value)}.${hintFor(name, schema)}`];
  }
  if (schema.enum && !schema.enum.includes(value)) {
    const allowed =
      schema.enum.length === 1
        ? `only takes ${listed(schema.enum)}`
        : `must be one of ${listed(schema.enum)}`;
    return [`\`${name}\` ${allowed}, not ${sent(value)}.${hintFor(name, schema)}`];
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum)
      return [`\`${name}\` must be at least ${schema.minimum}, not ${value}.`];
    if (schema.maximum !== undefined && value > schema.maximum)
      return [`\`${name}\` must be at most ${schema.maximum}, not ${value}.`];
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength)
      return [`\`${name}\` must be at least ${schema.minLength} characters long.`];
    if (schema.maxLength !== undefined && value.length > schema.maxLength)
      return [`\`${name}\` must be at most ${schema.maxLength} characters long.`];
  }
  if (Array.isArray(value) && schema.items) {
    return value.flatMap((item, index) => problemsOf(`${name}[${index}]`, item, schema.items!));
  }
  if (isRecord(value)) {
    const problems: string[] = [];
    const properties = schema.properties ?? {};
    for (const key of schema.required ?? []) {
      if (isMissing(value[key], properties[key])) problems.push(`\`${name}.${key}\` is required.`);
    }
    for (const [key, item] of Object.entries(value)) {
      const property = properties[key];
      if (property) {
        // A null its type refuses counts as left out, as at the top level.
        if (!isMissing(item, property))
          problems.push(...problemsOf(`${name}.${key}`, item, property));
      } else if (isRecord(schema.additionalProperties)) {
        problems.push(...problemsOf(`${name}.${key}`, item, schema.additionalProperties));
      } else if (schema.additionalProperties === false) {
        problems.push(`\`${name}\` has no \`${key}\`.`);
      }
    }
    return problems;
  }
  return [];
}

/** What a required argument takes, short, for the answer that asks for it. */
function describe(schema: ToolInputSchema | undefined): string {
  const description = schema?.description?.trim().replace(/\.$/, '');
  const choices = schema?.enum ? `one of ${listed(schema.enum)}` : '';
  const parts = [choices, description && clip(description, 200)].filter(Boolean);
  return parts.length ? `: ${parts.join('. ')}` : '';
}

/**
 * Checks a tool call's arguments against the tool's `inputSchema`. Returns
 * the arguments to call the tool with, or a readable error that names each
 * bad argument and what it takes.
 *
 * A `null` for an argument whose type does not allow `null` counts as left
 * out, since some clients send one for every argument they skip: an optional
 * one is dropped from the args, a required one is asked for. An untyped
 * argument (one that takes any value, such as a signal's new value) or one
 * that allows `null` keeps it, required or not.
 * Keys the schema does not list pass through, unless it sets
 * `additionalProperties: false`, or are checked against `additionalProperties`
 * when it is a schema, as for a listed argument. A `page` must be a string,
 * so a wrong one is refused instead of falling back to another tab; an empty
 * one counts as left out. An argument name 1.0 renamed is refused with the
 * name that replaced it (see {@link RENAMED_ARGUMENTS}), and one 1.0 moved off
 * `toolId` with the tool to use instead (see {@link MOVED_ARGUMENTS}).
 */
export function checkToolArgs(schema: unknown, input: unknown, toolId?: string): CheckedArgs {
  if (input !== undefined && input !== null && !isRecord(input)) {
    return {
      error: `The arguments must be an object of named values, not ${sent(input)}.`,
    };
  }
  const args: Record<string, unknown> = { ...(input ?? {}) };
  if (!isRecord(schema)) return { args };
  const shape = schema as ToolInputSchema;
  const properties = shape.properties ?? {};
  const problems: string[] = [];
  const moved = toolId ? movedFrom(toolId) : undefined;

  const missing = (shape.required ?? []).filter((key) => isMissing(args[key], properties[key]));
  for (const key of missing) problems.push(`Pass \`${key}\`${describe(properties[key])}.`);

  const extra = isRecord(shape.additionalProperties) ? shape.additionalProperties : undefined;
  for (const [key, value] of Object.entries(args)) {
    const property = properties[key] ?? (PAGE_KEYS.has(key) ? undefined : extra);
    if (value === undefined) continue;
    if (PAGE_KEYS.has(key) && value === '') {
      // An empty page id is a page left out, as some clients send for every optional string.
      delete args[key];
      continue;
    }
    if (value === null) {
      // Left out (a required one is asked for above), unless the argument
      // takes any value, such as a signal's new value.
      if (property && nullIsMissing(property)) delete args[key];
      continue;
    }
    const renamed = properties[key] ? undefined : renamedTo(key, properties);
    const movedTo =
      properties[key] || !moved || !Object.hasOwn(moved, key) ? undefined : moved[key];
    if (renamed) problems.push(`There is no \`${key}\` argument; pass \`${renamed}\`.`);
    else if (movedTo) problems.push(`There is no \`${key}\` argument; use ${movedTo}.`);
    // The old page argument never passes unnoticed, even on a tool without `page`.
    else if (key === 'pageId' && !properties[key]) problems.push('There is no `pageId` argument.');
    else if (property) problems.push(...problemsOf(key, value, property));
    else if (PAGE_KEYS.has(key) && typeof value !== 'string')
      problems.push(...problemsOf(key, value, { type: 'string' }));
    else if (shape.additionalProperties === false)
      problems.push(`There is no \`${key}\` argument.`);
  }

  if (!problems.length) return { args };
  const shown = problems.slice(0, MAX_PROBLEMS);
  if (problems.length > shown.length) shown.push(`…and ${problems.length - shown.length} more.`);
  return { error: shown.join('\n') };
}

/** The argument that replaced the retired name `key` in this schema, if any. */
function renamedTo(key: string, properties: Record<string, ToolInputSchema>): string | undefined {
  if (!Object.hasOwn(RENAMED_ARGUMENTS, key)) return undefined;
  return RENAMED_ARGUMENTS[key]!.find((name) => Object.hasOwn(properties, name));
}

/** The arguments 1.0 moved off the tool `toolId` (`pangular:<name>`). */
function movedFrom(toolId: string): Readonly<Record<string, string>> | undefined {
  const name = toolId.replace(/^pangular:/, '');
  return Object.hasOwn(MOVED_ARGUMENTS, name) ? MOVED_ARGUMENTS[name] : undefined;
}

/**
 * Wraps a tool handler so that it runs only with arguments that fit
 * `inputSchema`, and so that a refusal it answers with (see `refusal()`) is
 * sent with `isError: true`. Both come back to the caller as a thrown
 * {@link ToolRefusal}, which devframe turns into an error result. `toolId`
 * names the tool for the arguments it no longer takes (see {@link checkToolArgs}).
 */
export function guardHandler<R>(
  inputSchema: unknown,
  handler: (args: never) => R,
  toolId?: string,
): (args: unknown) => Promise<Awaited<R>> {
  return async (input: unknown): Promise<Awaited<R>> => {
    const checked = checkToolArgs(inputSchema, input, toolId);
    if ('error' in checked) throw new ToolRefusal(checked.error, 'Invalid arguments');
    const result = await handler(checked.args as never);
    const refused = refusalOf(result);
    if (refused !== undefined) throw new ToolRefusal(refused);
    return result;
  };
}
