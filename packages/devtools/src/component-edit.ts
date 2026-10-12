import type { ComponentDebugNg } from './component-tree.ts';
import { isSecretName, REDACTED, serialize, serializeNamed, VALUE_LEVEL } from './serialize.ts';
import type { ComponentDetail, ComponentProp } from './types.ts';

/**
 * Writes to one component instance, asked for from the panel or an agent tool
 * (`set-component-property`, `set-signal`). The collector never writes on its
 * own: this runs only for an explicit request, after the server checked
 * `actions.components`, and the overlay checks it again.
 */

export type ComponentEditKind = 'property' | 'signal';

export interface ComponentEditRequest {
  /** The component tree's instance id (`elementId` of the host). */
  id: string;
  /** A property name, or a path into its value: `user.name`, `items[0].title`. */
  path: string;
  value: unknown;
  /** `signal` asks for a writable signal, `property` for anything else. */
  kind?: ComponentEditKind;
}

export type ComponentEditResult =
  | {
      ok: true;
      kind: ComponentEditKind;
      component: string;
      path: string;
      /** The value now in the app, serialized and redacted like the detail. */
      value: unknown;
    }
  | { ok?: false; error: string };

export interface EditDebugNg<H extends object = Element> extends ComponentDebugNg<H> {
  applyChanges?(component: unknown): void;
}

/** The longest JSON text a write may carry. */
export const MAX_EDIT_JSON = 100_000;
const MAX_JSON_NODES = 2000;
const MAX_PATH = 20;
const VALUE_LIMITS = { depth: 3, keys: 30, items: 30, text: 300 };
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * How much of a value the panel reads to edit it as a whole (path `[prop]`
 * through `request-component-value`). A value that does not fit is edited
 * inside, one path at a time.
 */
export const EDIT_LEVEL = { depth: 5, limit: 100 } as const;
const EDIT_LIMITS = {
  ...VALUE_LEVEL,
  depth: EDIT_LEVEL.depth,
  keys: EDIT_LEVEL.limit,
  items: EDIT_LEVEL.limit,
};

export const LOCKED = {
  redacted: 'Redacted, so it cannot be edited here.',
  signalInput: 'Signal input. Its parent binding sets it, so it has no set().',
  readonlySignal: 'Read-only signal (computed() or asReadonly()), so it has no set().',
  resource: 'Resource. Reload it from the app instead.',
  getter: 'Getter without a setter.',
  notJson: 'Only text, numbers, booleans, null, arrays and plain objects can be edited.',
  clipped: 'Too large to edit in the panel.',
  nested: 'Too large to edit as a whole. Open it to edit the values inside.',
} as const;

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/** Whether a value is JSON data: primitives, `null`, arrays and plain objects, without cycles. */
export function isJsonValue(value: unknown, budget = { left: MAX_JSON_NODES }): boolean {
  const seen = new Set<object>();
  const walk = (v: unknown): boolean => {
    if (--budget.left < 0) return false;
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
    if (typeof v === 'number') return Number.isFinite(v);
    if (typeof v !== 'object') return false;
    if (seen.has(v)) return false;
    seen.add(v);
    try {
      if (Array.isArray(v)) return v.every(walk);
      if (!isPlainObject(v)) return false;
      return Object.keys(v).every((key) => {
        const d = Object.getOwnPropertyDescriptor(v, key);
        return !!d && 'value' in d && walk(d.value);
      });
    } finally {
      seen.delete(v);
    }
  };
  return read(() => walk(value), false);
}

/** `a.b[0].c` as `['a', 'b', '0', 'c']`; `null` when it is empty or too deep. */
export function parsePath(path: unknown): string[] | null {
  if (typeof path !== 'string' || !path || path.length > 500) return null;
  const parts = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((part) => part.trim());
  if (parts.some((part) => !part) || parts.length > MAX_PATH) return null;
  return parts;
}

function isSignal<H extends object>(ng: EditDebugNg<H>, value: unknown): boolean {
  return typeof value === 'function' && read(() => !!ng.isSignal?.(value), false);
}

function isWritableSignal<H extends object>(ng: EditDebugNg<H>, value: unknown): boolean {
  return isSignal(ng, value) && typeof (value as { set?: unknown }).set === 'function';
}

function isResource<H extends object>(ng: EditDebugNg<H>, value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const ref = value as Record<string, unknown>;
  return (
    isSignal(
      ng,
      read(() => ref['value'], undefined),
    ) &&
    isSignal(
      ng,
      read(() => ref['status'], undefined),
    )
  );
}

/** The class property behind each input, mapped from both its public name and its own name. */
function inputProps(inputs: Record<string, unknown> | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const [name, entry] of Object.entries(inputs ?? {})) {
    const prop =
      typeof entry === 'string'
        ? entry
        : Array.isArray(entry) && typeof entry[0] === 'string'
          ? entry[0]
          : name;
    map.set(name, prop);
    map.set(prop, prop);
  }
  return map;
}

/** The accessor of a property on an object or its prototypes, if it is one. */
function accessorOf(target: object, key: string): PropertyDescriptor | null {
  for (let o: object | null = target; o; o = Object.getPrototypeOf(o)) {
    const d = Object.getOwnPropertyDescriptor(o, key);
    if (d) return 'value' in d ? null : d;
  }
  return null;
}

function hasRedaction(serialized: unknown): boolean {
  return read(() => JSON.stringify(serialized) ?? '', '').includes(REDACTED);
}

/** Whether the current value would show masked anywhere, so a writer never saw all of it. */
function masked(name: string, value: unknown): boolean {
  return hasRedaction(serializeNamed(name, value, { budget: MAX_JSON_NODES }));
}

/**
 * Why a top-level property cannot be edited in the panel, or how it can be:
 * `edit` names the write to send, `locked` says why there is none.
 */
export function editabilityOf<H extends object>(
  ng: EditDebugNg<H>,
  instance: object,
  prop: string,
  names: string[],
  isInput: boolean,
): Pick<ComponentProp, 'edit' | 'locked' | 'editInside'> {
  if (names.some(isSecretName)) return { locked: LOCKED.redacted };
  const raw = read(() => (instance as Record<string, unknown>)[prop], undefined);
  if (isResource(ng, raw)) return { locked: LOCKED.resource };
  let value = raw;
  let edit: ComponentEditKind = 'property';
  if (isSignal(ng, raw)) {
    if (!isWritableSignal(ng, raw)) {
      return { locked: isInput ? LOCKED.signalInput : LOCKED.readonlySignal };
    }
    edit = 'signal';
    value = read(() => (raw as () => unknown)(), undefined);
  } else {
    const accessor = accessorOf(instance, prop);
    if (accessor && !accessor.set) return { locked: LOCKED.getter };
  }
  // A value it cannot replace whole may still hold values a path can write.
  const inside = editsInside(edit, value);
  const locked = (reason: string) =>
    inside ? { locked: reason, editInside: edit } : { locked: reason };
  if (value !== undefined && !isJsonValue(value)) return locked(LOCKED.notJson);
  const shown = serializeNamed(prop, value, { ...EDIT_LIMITS, ancestors: [instance] });
  if (hasRedaction(shown)) return locked(LOCKED.redacted);
  // The panel edits what it reads, so a clipped value would lose its tail.
  if (value !== undefined && JSON.stringify(shown) !== JSON.stringify(value)) {
    return locked(inside ? LOCKED.nested : LOCKED.clipped);
  }
  return inside ? { edit, editInside: edit } : { edit };
}

/**
 * Whether paths inside the value can be written: a signal is set to a copy,
 * which needs plain objects and arrays; a property is written in place, which
 * any object but a Map or Set allows.
 */
function editsInside(kind: ComponentEditKind, value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value) || isPlainObject(value)) return true;
  return kind === 'property' && !(value instanceof Map) && !(value instanceof Set);
}

/** Adds `edit` or `locked` to the component's own inputs and properties. */
export function markEditable<H extends object>(
  ng: EditDebugNg<H>,
  instance: object,
  detail: Pick<ComponentDetail, 'inputs' | 'properties'>,
): void {
  for (const input of detail.inputs) {
    Object.assign(input, editabilityOf(ng, instance, input.prop, [input.name, input.prop], true));
  }
  for (const prop of detail.properties ?? []) {
    Object.assign(prop, editabilityOf(ng, instance, prop.prop, [prop.name], false));
  }
}

/** A copy of `root` with `value` at `path`, copying each plain object or array on the way. */
function replaced(root: unknown, path: string[], value: unknown): unknown {
  if (!path.length) return value;
  const [key, ...rest] = path;
  if (Array.isArray(root)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= root.length) throw new PathError(key);
    const copy = root.slice();
    copy[index] = replaced(root[index], rest, value);
    return copy;
  }
  if (!isPlainObject(root) || !Object.hasOwn(root, key)) throw new PathError(key);
  return { ...root, [key]: replaced(root[key], rest, value) };
}

class PathError extends Error {
  readonly key: string;
  constructor(key: string) {
    super(key);
    this.key = key;
  }
}

function leafOf(root: unknown, path: string[]): unknown {
  let current = root;
  for (const key of path) {
    if (!current || typeof current !== 'object') throw new PathError(key);
    if (Array.isArray(current) ? !(Number(key) < current.length) : !(key in current)) {
      throw new PathError(key);
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

const fail = (error: string): ComponentEditResult => ({ error });

/**
 * Writes `request.value` at `request.path` on the component hosted by the
 * element with `request.id`. A writable signal gets `.set()` (with a copy of
 * its value when the path goes inside it); a plain property is assigned and
 * the view refreshed with `ng.applyChanges`. Signal inputs, read-only signals,
 * getters, functions, outputs, values that are not JSON and paths the
 * redaction masks are refused.
 */
export function editComponent<H extends object>(
  ng: EditDebugNg<H> | undefined,
  request: ComponentEditRequest,
  find: (id: string) => H | null,
): ComponentEditResult {
  if (!ng?.getComponent) return fail('Angular debug APIs are not available on this page.');
  if (!request || typeof request.id !== 'string' || !request.id) {
    return fail('Pass the instance id of a component.');
  }
  const path = parsePath(request.path);
  if (!path) return fail('Pass a property name, or a path such as user.name or items[0].title.');
  const unsafe = path.find((key) => UNSAFE_KEYS.has(key));
  if (unsafe) return fail(`\`${unsafe}\` cannot be written.`);
  if (!isJsonValue(request.value)) {
    return fail('The value must be JSON: text, a number, a boolean, null, an array or an object.');
  }
  if ((read(() => JSON.stringify(request.value), '') ?? '').length > MAX_EDIT_JSON) {
    return fail(`The value is longer than ${MAX_EDIT_JSON} characters of JSON.`);
  }
  const host = find(request.id);
  const instance = host ? read(() => ng.getComponent?.(host) ?? null, null) : null;
  if (!instance || typeof instance !== 'object') {
    return fail(
      `No component instance \`${request.id}\` is on this page. It may have been destroyed; read the component tree again for current ids.`,
    );
  }
  const component = read(() => {
    const ctor = (instance as { constructor?: { name?: string } }).constructor;
    return (ctor?.name ?? 'Component').replace(/^_(?=[A-Z])/, '');
  }, 'Component');
  const meta = read(() => ng.getDirectiveMetadata?.(instance) ?? null, null);
  const inputs = inputProps(meta?.inputs);
  const outputs = inputProps(meta?.outputs);

  // A public input name stands for its class property.
  const [first, ...rest] = path;
  const isInput = inputs.has(first);
  const prop = isInput ? inputs.get(first)! : first;
  const full = [prop, ...rest];
  const shownPath = full.join('.');
  const names = isInput ? [first, prop, ...rest] : full;
  if (names.some(isSecretName)) {
    return fail(`\`${shownPath}\` is redacted, so it cannot be written.`);
  }
  if (outputs.has(prop)) return fail(`\`${prop}\` is an output, not a value.`);
  if (prop.startsWith('__ng') || prop.startsWith('ɵ')) {
    return fail(`\`${prop}\` is internal to Angular.`);
  }
  if (!(prop in instance)) {
    return fail(`${component} has no property \`${prop}\`.`);
  }

  // Walk to the first signal on the path, or to the last container.
  let container: object = instance;
  let index = 0;
  let signal: unknown = null;
  for (; index < full.length; index++) {
    const key = full[index];
    const exists = Array.isArray(container)
      ? Number.isInteger(Number(key)) && Number(key) >= 0 && Number(key) < container.length
      : key in container;
    if (!exists) return fail(`\`${full.slice(0, index + 1).join('.')}\` does not exist.`);
    const value = read(() => (container as Record<string, unknown>)[key], undefined);
    if (isSignal(ng, value)) {
      signal = value;
      break;
    }
    if (index === full.length - 1) break;
    if (!value || typeof value !== 'object') {
      return fail(`\`${full.slice(0, index + 1).join('.')}\` holds no object to go into.`);
    }
    if (isResource(ng, value)) {
      return fail(
        `\`${full.slice(0, index + 1).join('.')}\` is a resource. Reload it from the app instead.`,
      );
    }
    container = value;
  }

  if (signal) {
    const signalPath = full.slice(0, index + 1).join('.');
    if (request.kind === 'property') {
      return fail(`\`${signalPath}\` is a signal. Write it with set-signal.`);
    }
    if (!isWritableSignal(ng, signal)) {
      const reason =
        index === 0 && isInput
          ? 'is a signal input. Its parent binding sets it, so it cannot be written'
          : 'is a read-only signal (computed() or asReadonly()), so it has no set()';
      return fail(`\`${signalPath}\` ${reason}.`);
    }
    const inner = full.slice(index + 1);
    let next: unknown;
    let current: unknown;
    try {
      const root = (signal as () => unknown)();
      current = leafOf(root, inner);
      next = replaced(root, inner, request.value);
    } catch (error) {
      if (error instanceof PathError) {
        return fail(
          `\`${shownPath}\` does not exist, or goes through a value that is not a plain object or array.`,
        );
      }
      return fail(`Reading \`${signalPath}\` threw: ${String((error as Error)?.message ?? error)}`);
    }
    const problem = currentProblem(full.at(-1)!, current, shownPath);
    if (problem) return fail(problem);
    try {
      (signal as { set(value: unknown): void }).set(next);
    } catch (error) {
      return fail(`Setting \`${signalPath}\` threw: ${String((error as Error)?.message ?? error)}`);
    }
    const now = read(() => leafOf((signal as () => unknown)(), inner), request.value);
    return { ok: true, kind: 'signal', component, path: shownPath, value: shown(full, now) };
  }

  if (request.kind === 'signal') {
    return fail(`\`${shownPath}\` is not a signal. Write it with set-component-property.`);
  }
  const key = full.at(-1)!;
  const current = read(() => (container as Record<string, unknown>)[key], undefined);
  if (typeof current === 'function') return fail(`\`${shownPath}\` is a method, not a value.`);
  if (isResource(ng, current)) {
    return fail(`\`${shownPath}\` is a resource. Reload it from the app instead.`);
  }
  const accessor = accessorOf(container, key);
  if (accessor && !accessor.set) return fail(`\`${shownPath}\` is a getter without a setter.`);
  const problem = currentProblem(key, current, shownPath);
  if (problem) return fail(problem);
  let written = false;
  try {
    written = Reflect.set(container, key, request.value);
  } catch (error) {
    return fail(`Setting \`${shownPath}\` threw: ${String((error as Error)?.message ?? error)}`);
  }
  if (!written) return fail(`\`${shownPath}\` is read-only.`);
  try {
    ng.applyChanges?.(instance);
  } catch {
    // The value is set; the next change detection shows it.
  }
  const now = read(() => (container as Record<string, unknown>)[key], request.value);
  return { ok: true, kind: 'property', component, path: shownPath, value: shown(full, now) };
}

/** Why the value at the target cannot be replaced, from what it holds now. */
function currentProblem(key: string, current: unknown, path: string): string | null {
  if (current !== undefined && !isJsonValue(current)) {
    return `\`${path}\` holds a value that is not JSON (a class instance, Map, Date or function), so it is not replaced.`;
  }
  if (masked(key, current)) {
    return `\`${path}\` holds redacted data, so it cannot be replaced. Write a path next to it instead.`;
  }
  return null;
}

function shown(path: string[], value: unknown): unknown {
  return path.some(isSecretName) ? REDACTED : serialize(value, VALUE_LIMITS);
}
