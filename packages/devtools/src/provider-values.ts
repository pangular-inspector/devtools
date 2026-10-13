import { resourceOf, unwrap, type ComponentDebugNg } from './component-tree.ts';
import {
  child,
  MAX_LEVEL_DEPTH,
  MAX_LEVEL_LIMIT,
  MAX_VALUE_PATH,
  shownPath,
  type Step,
} from './component-values.ts';
import { className, providerValue, type DebugNg } from './injector-tree.ts';
import { isSecretName, REDACTED, serialize, serializeNamed, VALUE_LEVEL } from './serialize.ts';

/**
 * Peeks at the value of a provider an injector already created, for the
 * Injectors view and `read-provider-value`. The instance comes from
 * `providerValue()`, which never creates one: an environment injector gives
 * only a record that already holds a value, and an element injector only a
 * token that a component or directive on the page injected. Members are read
 * like component properties: own data properties only (getters never run),
 * signals unwrapped, resources as a snapshot, methods left out, secret names
 * redacted, and nested containers collapsed until a path opens them.
 */

/** The path segment that stands for the value itself when it is not an object with members. */
export const WHOLE_VALUE = '$value';
/** Most members the first level lists. */
export const MAX_MEMBERS = 60;
const MAX_SEGMENT = 200;
const MAX_TOKEN = 500;
const MAX_INDEX = 10_000;

export type ProviderDebugNg<H extends object = Element> = DebugNg<H> & ComponentDebugNg<H>;

export interface ProviderValueRequest {
  /** The injector id from the injector tree (`InjectorInfo.id`). */
  injectorId: string;
  /** The provider's token name, which must still match at `index`. */
  token: string;
  /** The provider's place in the injector's `providers`. */
  index: number;
  /** Empty for the members; else a member name (or `$value`), then keys or indexes. */
  path: string[];
  limit?: number;
  depth?: number;
}

export interface ProviderMember {
  name: string;
  kind?: 'signal' | 'resource';
  value: unknown;
}

export type ProviderValueResult =
  | {
      ok: true;
      token: string;
      /** The instance's class name, or the kind of value (`Object`, `Array`, `string`). */
      type: string;
      path: string[];
      /** With an empty path: the members, or one `$value` member for a value without members. */
      members?: ProviderMember[];
      /** Members left out past {@link MAX_MEMBERS}. */
      more?: number;
      /** With a path: one level of the value there. */
      value?: unknown;
    }
  | { ok?: false; error: string };

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function int(value: unknown, min: number, max: number, fallback: number): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return Math.min(Math.max(value, min), max);
}

/** The request with its limits applied, or why it cannot be read. */
export function toProviderValueRequest(message: unknown): ProviderValueRequest | string {
  const m = (message ?? {}) as Record<string, unknown>;
  if (typeof m['injectorId'] !== 'string' || !m['injectorId'] || m['injectorId'].length > 100) {
    return 'Pass the id of an injector from the injector tree.';
  }
  if (typeof m['token'] !== 'string' || !m['token'] || m['token'].length > MAX_TOKEN) {
    return 'Pass the token name of a provider.';
  }
  const index = m['index'];
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > MAX_INDEX) {
    return "Pass the provider's index in the injector's providers.";
  }
  const path = m['path'] ?? [];
  if (
    !Array.isArray(path) ||
    path.length > MAX_VALUE_PATH ||
    path.some((key) => typeof key !== 'string' || !key || key.length > MAX_SEGMENT)
  ) {
    return `Pass a path: a member name, then up to ${MAX_VALUE_PATH - 1} keys or indexes.`;
  }
  const limit = int(m['limit'], 1, MAX_LEVEL_LIMIT, VALUE_LEVEL.keys);
  const depth = int(m['depth'], 1, MAX_LEVEL_DEPTH, VALUE_LEVEL.depth);
  if (limit === null) return 'limit must be a whole number.';
  if (depth === null) return 'depth must be a whole number.';
  return {
    injectorId: m['injectorId'],
    token: m['token'],
    index,
    path: [...(path as string[])],
    limit,
    depth,
  };
}

/** Whether a value lists its own members (a service, a config object), rather than showing whole. */
function hasMembers(value: unknown): value is object {
  if (!value || typeof value !== 'object') return false;
  return !(
    Array.isArray(value) ||
    value instanceof Map ||
    value instanceof Set ||
    value instanceof Date ||
    value instanceof RegExp ||
    value instanceof Error ||
    value instanceof Promise ||
    ArrayBuffer.isView(value) ||
    value instanceof ArrayBuffer
  );
}

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'Array';
  if (typeof value === 'object') {
    return read(
      () => className((value as { constructor: { readonly name?: string } }).constructor),
      'Object',
    );
  }
  return typeof value;
}

function isSignal<H extends object>(ng: ProviderDebugNg<H>, value: unknown): boolean {
  return typeof value === 'function' && read(() => !!ng.isSignal?.(value), false);
}

function isInternal(name: string): boolean {
  return name.startsWith('__ng') || name.startsWith('ɵ');
}

/** The members of an instance, as the component detail lists its properties. */
function membersOf<H extends object>(
  ng: ProviderDebugNg<H>,
  instance: object,
): { members: ProviderMember[]; more: number } {
  const level = { ...VALUE_LEVEL, ancestors: [instance] };
  const members: ProviderMember[] = [];
  let more = 0;
  for (const name of read(() => Object.keys(instance), [] as string[])) {
    if (isInternal(name)) continue;
    const descriptor = read(() => Object.getOwnPropertyDescriptor(instance, name), undefined);
    if (!descriptor || !('value' in descriptor)) continue;
    const raw = descriptor.value;
    const resource = resourceOf(ng, raw);
    const signal = !resource && isSignal(ng, raw);
    if (typeof raw === 'function' && !signal) continue;
    if (members.length >= MAX_MEMBERS) {
      more++;
      continue;
    }
    const member: ProviderMember = {
      name,
      value: serializeNamed(name, resource ?? unwrap(ng, raw), level),
    };
    if (resource) member.kind = 'resource';
    else if (signal) member.kind = 'signal';
    members.push(member);
  }
  return { members, more };
}

/**
 * The descriptor of `name` on the instance or its prototypes, read without
 * running anything, so a class method or getter can be named as such.
 */
function descriptorOf(instance: object, name: string): PropertyDescriptor | undefined {
  for (
    let target: object | null = instance;
    target && target !== Object.prototype;
    target = read<object | null>(() => Object.getPrototypeOf(target), null)
  ) {
    const found = read(() => Object.getOwnPropertyDescriptor(target, name), undefined);
    if (found) return found;
  }
  return undefined;
}

/** The member at the start of a path, unwrapped like the members list shows it. */
function memberValue<H extends object>(
  ng: ProviderDebugNg<H>,
  token: string,
  instance: unknown,
  name: string,
): Step {
  if (name === WHOLE_VALUE && !hasMembers(instance)) {
    // The same policy as the `$value` member the members list shows: a value
    // whose token name looks secret is redacted, so nothing under it is read.
    if (isSecretName(token) && serializeNamed(token, instance, VALUE_LEVEL) === REDACTED) {
      return { error: `\`${token}\` is redacted, so its value is not read.` };
    }
    return { value: instance };
  }
  if (!hasMembers(instance)) return { error: `The value has no member \`${name}\`.` };
  if (isSecretName(name)) return { error: `\`${name}\` is redacted, so it is not read.` };
  if (isInternal(name)) return { error: `\`${name}\` is internal to Angular.` };
  const descriptor = descriptorOf(instance, name);
  if (!descriptor) return { error: `The value has no member \`${name}\`.` };
  if (!('value' in descriptor)) {
    return { error: `\`${name}\` is a getter, which the devtools never run.` };
  }
  const raw = descriptor.value;
  const resource = resourceOf(ng, raw);
  if (resource) return { value: resource };
  if (typeof raw === 'function' && !isSignal(ng, raw)) {
    return { error: `\`${name}\` is a method, not a value.` };
  }
  return { value: unwrap(ng, raw) };
}

/**
 * One level of a provider's value: its members with an empty path, or the
 * value at `request.path`. Serialized and redacted like component values.
 */
export function readProviderValue<H extends object = Element>(
  ng: ProviderDebugNg<H> | undefined,
  request: ProviderValueRequest,
): ProviderValueResult {
  if (!ng?.getInjector) return { error: 'Angular debug APIs are not available on this page.' };
  const found = providerValue(ng, request.injectorId, request.token, request.index, 'read');
  if ('error' in found) return { error: found.error };
  const instance = found.value;
  const type = typeOf(instance);
  if (!request.path.length) {
    if (hasMembers(instance)) {
      const { members, more } = membersOf(ng, instance);
      return {
        ok: true,
        token: request.token,
        type,
        path: [],
        members,
        ...(more ? { more } : {}),
      };
    }
    const value = serializeNamed(request.token, instance, VALUE_LEVEL);
    return {
      ok: true,
      token: request.token,
      type,
      path: [],
      members: [{ name: WHOLE_VALUE, value }],
    };
  }
  const [first, ...rest] = request.path;
  let step = memberValue(ng, request.token, instance, first);
  const ancestors: object[] = instance && typeof instance === 'object' ? [instance] : [];
  for (let i = 0; i < rest.length && !('error' in step); i++) {
    if (step.value && typeof step.value === 'object') ancestors.push(step.value);
    step = child(step.value, rest[i], shownPath(request.path.slice(0, i + 1)));
  }
  if ('error' in step) return { error: step.error };
  const limit = request.limit ?? VALUE_LEVEL.keys;
  const value = serialize(step.value, {
    ...VALUE_LEVEL,
    keys: limit,
    items: limit,
    depth: request.depth ?? VALUE_LEVEL.depth,
    ancestors,
  });
  return { ok: true, token: request.token, type, path: request.path, value };
}

interface ValuesRpc {
  call(name: string, ...args: unknown[]): Promise<unknown>;
  register(definition: {
    name: string;
    type: 'event';
    jsonSerializable: boolean;
    handler: (message: never) => unknown;
  }): void;
}

/**
 * Answers the server's `provider-value` events for this page with one level
 * of a provider's value. It only reads, and never creates an instance.
 */
export function registerProviderValues<H extends object = Element>(
  rpc: ValuesRpc,
  pageId: string,
  getNg: () => ProviderDebugNg<H> | undefined,
) {
  rpc.register({
    name: 'provider-value',
    type: 'event',
    jsonSerializable: true,
    handler: (message: { requestId?: unknown; pageId?: unknown; request?: unknown } | null) => {
      if (!message || typeof message.requestId !== 'string' || message.pageId !== pageId) return;
      let result: ProviderValueResult;
      try {
        const request = toProviderValueRequest(message.request);
        result =
          typeof request === 'string' ? { error: request } : readProviderValue(getNg(), request);
      } catch (error) {
        result = { error: String((error as Error)?.message ?? error) };
      }
      void rpc
        .call('provider-value-result', { requestId: message.requestId, pageId, result })
        .catch(() => {});
    },
  });
}
