import { injectedValues, resourceOf, unwrap, type ComponentDebugNg } from './component-tree.ts';
import { className } from './injector-tree.ts';
import { isSecretName, serialize, VALUE_LEVEL } from './serialize.ts';
import type { ComponentDetail } from './types.ts';

/**
 * Nested levels of the values in the component detail. The detail carries the
 * first level of each input and property (`VALUE_LEVEL`); the panel opens a
 * deeper one by path through `request-component-value`, and agents through
 * `inspect-component` with `path`. Reads go through own data properties only,
 * so a getter never runs, and a path through a name the redaction masks is
 * refused.
 */

/** Most segments in a value path. */
export const MAX_VALUE_PATH = 32;
/** Most entries one level lists (the panel's "Show more" raises it up to this). */
export const MAX_LEVEL_LIMIT = 1000;
/** Most levels one read serializes below its path. */
export const MAX_LEVEL_DEPTH = 5;
/** Most opened levels a page keeps reading on each push. */
export const MAX_WATCHED_PATHS = 40;
const MAX_SEGMENT = 200;
const MAX_DIRECTIVES = 64;

export interface ComponentValueRequest {
  /** The component tree's instance id (`elementId` of the host). */
  id: string;
  /** Property or input name first, then keys, array indexes, or entry indexes of a Map or Set. */
  path: string[];
  /** Index of a directive in the detail's `directives`, to read its inputs instead. */
  directive?: number;
  /** Most entries to list, 30 by default. */
  limit?: number;
  /** Levels to serialize below the path, 1 by default. */
  depth?: number;
  /** Keep reading this level on each push (the panel), until `forget`. */
  watch?: boolean;
  /** Stop reading this level and the ones below it. */
  forget?: boolean;
}

export type ComponentValueResult =
  { ok: true; component: string; path: string[]; value: unknown } | { ok?: false; error: string };

/** The key of an opened level in `ComponentDetail.expanded`. */
export function valuePathKey(path: readonly string[], directive?: number): string {
  return JSON.stringify(directive === undefined ? path : [directive, ...path]);
}

/** `user.address`, `items[0]`, for messages. */
export function shownPath(path: readonly string[]): string {
  return path
    .map((key, i) => (/^\d+$/.test(key) && i > 0 ? `[${key}]` : i > 0 ? `.${key}` : key))
    .join('');
}

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const fail = (error: string): ComponentValueResult => ({ error });

function int(value: unknown, min: number, max: number, fallback: number): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return Math.min(Math.max(value, min), max);
}

/** The request with its limits applied, or why it cannot be read. */
export function toValueRequest(message: unknown): ComponentValueRequest | string {
  const m = (message ?? {}) as Record<string, unknown>;
  if (typeof m['id'] !== 'string' || !m['id'] || m['id'].length > 100) {
    return 'Pass the instance id of a component.';
  }
  const path = m['path'];
  if (
    !Array.isArray(path) ||
    !path.length ||
    path.length > MAX_VALUE_PATH ||
    path.some((key) => typeof key !== 'string' || !key || key.length > MAX_SEGMENT)
  ) {
    return `Pass a path: a property name, then up to ${MAX_VALUE_PATH - 1} keys or indexes.`;
  }
  const directive = m['directive'];
  if (
    directive !== undefined &&
    (typeof directive !== 'number' ||
      !Number.isInteger(directive) ||
      directive < 0 ||
      directive >= MAX_DIRECTIVES)
  ) {
    return 'directive must be the index of a directive on the host.';
  }
  const limit = int(m['limit'], 1, MAX_LEVEL_LIMIT, VALUE_LEVEL.keys);
  const depth = int(m['depth'], 1, MAX_LEVEL_DEPTH, VALUE_LEVEL.depth);
  if (limit === null) return 'limit must be a whole number.';
  if (depth === null) return 'depth must be a whole number.';
  const request: ComponentValueRequest = {
    id: m['id'],
    path: [...(path as string[])],
    limit,
    depth,
  };
  if (directive !== undefined) request.directive = directive as number;
  if (m['watch'] === true) request.watch = true;
  if (m['forget'] === true) request.forget = true;
  return request;
}

function propOf(entry: unknown, fallback: string): string {
  if (typeof entry === 'string') return entry;
  if (Array.isArray(entry) && typeof entry[0] === 'string') return entry[0];
  return fallback;
}

/** Values serialize shows as text, so there is nothing inside them to open. */
function isLeafObject(value: object): boolean {
  return (
    value instanceof Date ||
    value instanceof RegExp ||
    value instanceof Error ||
    value instanceof Promise ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    (typeof Node !== 'undefined' && value instanceof Node)
  );
}

function entryIndex(key: string, size: number): number | null {
  if (!/^\d+$/.test(key)) return null;
  const index = Number(key);
  return index < size ? index : null;
}

type Step = { value: unknown } | { error: string };

/** The value of one input or property, as the detail shows it: signals unwrapped, resources as a snapshot. */
function rootValue<H extends object>(
  ng: ComponentDebugNg<H>,
  host: H,
  instance: object,
  owner: object,
  isDirective: boolean,
  first: string,
): Step {
  const meta = read(() => ng.getDirectiveMetadata?.(owner) ?? null, null);
  const inputs = new Map<string, string>();
  for (const [name, entry] of Object.entries(meta?.inputs ?? {})) {
    const prop = propOf(entry, name);
    inputs.set(name, prop);
    inputs.set(prop, prop);
  }
  const outputs = new Set(
    Object.entries(meta?.outputs ?? {}).flatMap(([name, entry]) => [name, propOf(entry, name)]),
  );
  const isInput = inputs.has(first);
  const prop = isInput ? inputs.get(first)! : first;
  if ([first, prop].some(isSecretName)) {
    return { error: `\`${first}\` is redacted, so it is not read.` };
  }
  if (!isInput) {
    if (isDirective) return { error: `The directive has no input \`${first}\`.` };
    if (outputs.has(first)) return { error: `\`${first}\` is an output, not a value.` };
    if (first.startsWith('__ng') || first.startsWith('ɵ')) {
      return { error: `\`${first}\` is internal to Angular.` };
    }
    if (!read(() => Object.keys(owner).includes(first), false)) {
      return { error: `The component has no property \`${first}\`.` };
    }
  }
  const raw = read(() => (owner as Record<string, unknown>)[prop], undefined);
  if (!isInput) {
    const injector = read(() => ng.getInjector?.(host) ?? null, null);
    if (injector && injectedValues(ng, injector, instance.constructor).has(raw)) {
      return { error: `\`${first}\` is an injected service. Read it in the Injectors view.` };
    }
    const isSignal = typeof raw === 'function' && read(() => !!ng.isSignal?.(raw), false);
    if (typeof raw === 'function' && !isSignal) {
      return { error: `\`${first}\` is a method, not a value.` };
    }
  }
  const resource = resourceOf(ng, raw);
  return { value: resource ?? unwrap(ng, raw) };
}

/** One step down from `current`, through own data properties and entry indexes only. */
function child(current: unknown, key: string, at: string): Step {
  if (!current || typeof current !== 'object') {
    return { error: `\`${at}\` holds no object to open.` };
  }
  if (isLeafObject(current)) return { error: `\`${at}\` has nothing inside to open.` };
  if (current instanceof Map) {
    const index = entryIndex(key, current.size);
    if (index === null) return { error: `\`${at}\` has no entry ${key}.` };
    let i = 0;
    for (const [entryKey, value] of current) {
      if (i++ !== index) continue;
      if (isSecretName(entryKey)) return { error: `\`${at}\` entry ${key} is redacted.` };
      return { value };
    }
    return { error: `\`${at}\` has no entry ${key}.` };
  }
  if (current instanceof Set) {
    const index = entryIndex(key, current.size);
    if (index === null) return { error: `\`${at}\` has no entry ${key}.` };
    let i = 0;
    for (const value of current) if (i++ === index) return { value };
    return { error: `\`${at}\` has no entry ${key}.` };
  }
  if (Array.isArray(current) && entryIndex(key, current.length) === null) {
    return { error: `\`${at}\` has no index ${key}.` };
  }
  if (isSecretName(key)) return { error: `\`${at}.${key}\` is redacted, so it is not read.` };
  const descriptor = read(() => Object.getOwnPropertyDescriptor(current, key), undefined);
  if (!descriptor) return { error: `\`${at}\` has no key \`${key}\`.` };
  if (!('value' in descriptor)) {
    return { error: `\`${at}.${key}\` is a getter, which the devtools never run.` };
  }
  return { value: descriptor.value };
}

/**
 * One level of the value at `request.path` on the component hosted by
 * `host`, serialized and redacted like the detail: nested containers come
 * back as `{ $collapsed, size }`, a cut list ends with a `$more` count, and an
 * object that contains itself shows `[Circular]`.
 */
export function readComponentValue<H extends object>(
  ng: ComponentDebugNg<H> | undefined,
  host: H | null,
  request: ComponentValueRequest,
): ComponentValueResult {
  if (!ng?.getComponent) return fail('Angular debug APIs are not available on this page.');
  const instance = host ? read(() => ng.getComponent?.(host) ?? null, null) : null;
  if (!host || !instance || typeof instance !== 'object') {
    return fail(
      `No component instance \`${request.id}\` is on this page. It may have been destroyed; select it again, or read the component tree for current ids.`,
    );
  }
  let owner: object = instance;
  if (request.directive !== undefined) {
    const directives = read(() => ng.getDirectives?.(host) ?? [], [] as unknown[]).filter(
      (d): d is object => !!d && typeof d === 'object' && d !== instance,
    );
    const directive = directives[request.directive];
    if (!directive) return fail(`The host has no directive ${request.directive}.`);
    owner = directive;
  }
  const component = read(
    () => className((owner as { constructor: { readonly name?: string } }).constructor),
    'Component',
  );
  const [first, ...rest] = request.path;
  let step = rootValue(ng, host, instance, owner, request.directive !== undefined, first);
  const ancestors: object[] = [owner];
  for (let i = 0; i < rest.length && !('error' in step); i++) {
    if (step.value && typeof step.value === 'object') ancestors.push(step.value);
    step = child(step.value, rest[i], shownPath(request.path.slice(0, i + 1)));
  }
  if ('error' in step) return fail(step.error);
  const limit = request.limit ?? VALUE_LEVEL.keys;
  const value = serialize(step.value, {
    ...VALUE_LEVEL,
    keys: limit,
    items: limit,
    depth: request.depth ?? VALUE_LEVEL.depth,
    ancestors,
  });
  return { ok: true, component, path: request.path, value };
}

interface Watched {
  path: string[];
  directive?: number;
  limit: number;
}

/**
 * The levels the panel opened on one component. The page reads them again on
 * every push (`attach`), so they change with the app and an unchanged level
 * keeps the push unchanged. Opening a level on another instance starts over.
 */
export function createComponentValues<H extends object>(options: {
  getNg: () => ComponentDebugNg<H> | undefined;
  find: (id: string) => H | null;
}) {
  let watchedId: string | null = null;
  const watched = new Map<string, Watched>();

  const forget = (request: ComponentValueRequest) => {
    if (request.id !== watchedId) return;
    for (const [key, entry] of watched) {
      if (entry.directive !== request.directive) continue;
      if (request.path.every((segment, i) => entry.path[i] === segment)) watched.delete(key);
    }
  };

  return {
    /** Answers one request; `changed` says whether the opened levels changed. */
    handle(message: unknown): { result: ComponentValueResult; changed: boolean } {
      const request = toValueRequest(message);
      if (typeof request === 'string') return { result: fail(request), changed: false };
      if (request.forget) {
        const before = watched.size;
        forget(request);
        return {
          result: { ok: true, component: '', path: request.path, value: null },
          changed: watched.size !== before,
        };
      }
      const result = readComponentValue(options.getNg(), options.find(request.id), request);
      if (!request.watch || !result.ok) return { result, changed: false };
      if (watchedId !== request.id) {
        watchedId = request.id;
        watched.clear();
      }
      const key = valuePathKey(request.path, request.directive);
      watched.delete(key);
      watched.set(key, {
        path: request.path,
        directive: request.directive,
        limit: request.limit ?? VALUE_LEVEL.keys,
      });
      while (watched.size > MAX_WATCHED_PATHS) watched.delete(watched.keys().next().value!);
      return { result, changed: true };
    },
    /** Adds the opened levels of the selected instance to its detail. */
    attach(detail: ComponentDetail, host: H) {
      if (detail.id !== watchedId || !watched.size) return;
      const ng = options.getNg();
      const expanded: Record<string, unknown> = {};
      for (const [key, entry] of watched) {
        const result = readComponentValue(ng, host, { id: detail.id, ...entry });
        if (result.ok) expanded[key] = result.value;
      }
      if (Object.keys(expanded).length) detail.expanded = expanded;
    },
    /** Opened levels, for tests. */
    watchedPaths: () => [...watched.keys()],
  };
}
