import { elementById } from './element-id.ts';
import { isRedactedKey, REDACTED } from './forms-privacy.ts';
import { providerValue, type DebugNg } from './injector-tree.ts';
import { isSecretName, redactText } from './serialize.ts';

/** How many selected components `$ng0..$ng4` keep, like Chrome's `$0..$4`. */
export const NG_HANDLES = 5;

/** What "Store as global" stores: a component, a provider or NgRx state. */
export type ConsoleTarget =
  | { kind: 'component'; id: string }
  | { kind: 'provider'; injectorId: string; token: string; index: number }
  | { kind: 'ngrx'; storeId: string };

/** `store` keeps the value as `tempN`; `log` prints it in the page's console instead. */
export type ConsoleMode = 'store' | 'log';

export function isConsoleMode(value: unknown): value is ConsoleMode {
  return value === 'store' || value === 'log';
}

export interface ConsoleGlobalResult {
  ok: boolean;
  /** The global the value went to, such as `temp1`. */
  name?: string;
  message: string;
  /** Secret fields were masked in the stored copy. */
  masked?: boolean;
}

export function isConsoleTarget(value: unknown): value is ConsoleTarget {
  if (!value || typeof value !== 'object') return false;
  const target = value as Record<string, unknown>;
  const text = (key: string) => typeof target[key] === 'string' && (target[key] as string).length;
  switch (target['kind']) {
    case 'component':
      return !!text('id');
    case 'provider':
      return (
        !!text('injectorId') &&
        !!text('token') &&
        typeof target['index'] === 'number' &&
        Number.isInteger(target['index']) &&
        target['index'] >= 0
      );
    case 'ngrx':
      return !!text('storeId');
    default:
      return false;
  }
}

const MAX_COPY_DEPTH = 32;

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * A copy of `value` with the fields the panel masks replaced by `[redacted]`
 * and credentials, JWTs and bearer tokens masked in strings. Plain objects,
 * arrays, `Map`s and `Set`s are copied; other objects (class instances,
 * dates, elements) are kept as they are unless they hold a masked field, in
 * which case their own fields are copied into a plain object.
 */
export function redactedCopy(value: unknown): { value: unknown; masked: boolean } {
  let masked = false;
  const seen = new Map<object, unknown>();
  const walk = (val: unknown, depth: number): unknown => {
    if (typeof val === 'string') {
      const text = redactText(val);
      if (text !== val) masked = true;
      return text;
    }
    if (!val || typeof val !== 'object') return val;
    if (seen.has(val)) return seen.get(val);
    if (depth >= MAX_COPY_DEPTH) return val;
    if (Array.isArray(val)) {
      const out: unknown[] = [];
      seen.set(val, out);
      for (const item of val) out.push(walk(item, depth + 1));
      return out;
    }
    if (val instanceof Map) {
      const out = new Map<unknown, unknown>();
      seen.set(val, out);
      for (const [key, item] of val) {
        if (typeof key === 'string' && isRedactedKey(key)) {
          masked = true;
          out.set(key, REDACTED);
        } else out.set(key, walk(item, depth + 1));
      }
      return out;
    }
    if (val instanceof Set) {
      const out = new Set<unknown>();
      seen.set(val, out);
      for (const item of val) out.add(walk(item, depth + 1));
      return out;
    }
    if (val instanceof Date || (typeof Node !== 'undefined' && val instanceof Node)) return val;
    const plain = isPlainObject(val);
    const before = masked;
    const out: Record<string, unknown> = {};
    seen.set(val, out);
    for (const key of Object.keys(val)) {
      if (isRedactedKey(key)) {
        masked = true;
        out[key] = REDACTED;
        continue;
      }
      let item: unknown;
      try {
        item = (val as Record<string, unknown>)[key];
      } catch {
        continue;
      }
      out[key] = walk(item, depth + 1);
    }
    if (plain || masked !== before) return out;
    // A class instance with nothing to mask stays the live object.
    seen.set(val, val);
    return val;
  };
  const copy = walk(value, 0);
  return { value: copy, masked };
}

/** Why a provider must not be stored at all, or `null` when it may be. */
export function providerRefusal(
  token: string,
  value: unknown,
  mode: ConsoleMode = 'store',
): string | null {
  if (isSecretName(token)) {
    return `${token} looks like a secret, so the devtools mask it and did not ${mode} it.`;
  }
  if (typeof value === 'string' && redactText(value) !== value) {
    return `${token} holds a credential or token, so the devtools mask it and did not ${mode} it.`;
  }
  return null;
}

/**
 * The console globals the overlay writes into the page: `$ng0..$ng4` for the
 * components selected in the panel, newest first, and `temp1`, `temp2`… for
 * "Store as global", named like Chrome's "Store as global variable". A global
 * the page (or another tool) already set is never overwritten, and
 * `dispose()` removes only the globals this module still owns.
 */
export function createConsoleHandles(win: object = globalThis) {
  const scope = win as Record<string, unknown>;
  const ours = new Map<string, unknown>();
  let selected: object[] = [];

  const owned = (name: string) => ours.has(name) && Object.is(scope[name], ours.get(name));
  const free = (name: string) => !(name in scope) || owned(name);
  const write = (name: string, value: unknown) => {
    scope[name] = value;
    ours.set(name, value);
  };

  return {
    /**
     * Makes `instance` `$ng0` and moves the earlier selections down to
     * `$ng1..$ng4`. Selecting the current `$ng0` again changes nothing; an
     * earlier one moves back to the top instead of appearing twice.
     */
    select(instance: unknown) {
      if (!instance || typeof instance !== 'object' || selected[0] === instance) return;
      selected = [instance, ...selected.filter((item) => item !== instance)].slice(0, NG_HANDLES);
      for (let index = 0; index < NG_HANDLES; index++) {
        const name = `$ng${index}`;
        if (!free(name)) continue;
        if (index < selected.length) write(name, selected[index]);
      }
    },
    /** Stores `value` as the first free `tempN` and returns its name. */
    store(value: unknown): string {
      for (let n = 1; ; n++) {
        const name = `temp${n}`;
        if (name in scope) continue;
        write(name, value);
        return name;
      }
    },
    /** The components `$ng0..$ng4` hold, newest first. */
    selection: () => [...selected],
    dispose() {
      for (const name of ours.keys()) if (owned(name)) delete scope[name];
      ours.clear();
      selected = [];
    },
  };
}

export type ConsoleHandles = ReturnType<typeof createConsoleHandles>;

interface RpcScope {
  rpc: {
    call(name: string, ...args: unknown[]): Promise<unknown>;
    register(definition: {
      name: string;
      type: 'event';
      jsonSerializable: boolean;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: (...args: any[]) => unknown;
    }): void;
  };
}

export interface ConsoleGlobalsOptions {
  getNg: () => DebugNg | undefined;
  /** The inspectors turned on in the devtools config. */
  inspectors: { components: boolean; injectors: boolean; ngrx: boolean };
  /** The live state of an NgRx store, when the NgRx inspector runs. */
  ngrxState?: (storeId: string) => { value: unknown } | null;
  /** Where the globals go; the page's `window` by default. */
  win?: object;
  /** Prints a logged value; `console.log` by default. */
  log?: (...args: unknown[]) => void;
}

const KIND_INSPECTOR = { component: 'components', provider: 'injectors', ngrx: 'ngrx' } as const;

function isPlainData(value: unknown): boolean {
  return (
    Array.isArray(value) ||
    value instanceof Map ||
    value instanceof Set ||
    (!!value && typeof value === 'object' && isPlainObject(value))
  );
}

/**
 * Wires the console globals into the overlay: `selectComponent(id)` sets
 * `$ng0` for a component the panel selected on this page, and the
 * `console-global` event stores a component, provider or NgRx state as
 * `tempN` for the page that owns the request, or with `mode: 'log'` prints it
 * in the page console. Both follow the same redaction rules, and only the
 * variable name and a message go back to the server, never the value.
 */
export function attachConsoleGlobals(my: RpcScope, pageId: string, options: ConsoleGlobalsOptions) {
  const handles = createConsoleHandles(options.win ?? globalThis);
  const componentAt = (id: string): unknown => {
    const el = elementById(id);
    if (!el) return null;
    try {
      return options.getNg()?.getComponent?.(el) ?? null;
    } catch {
      return null;
    }
  };
  const fail = (message: string): ConsoleGlobalResult => ({ ok: false, message });
  const log = options.log ?? ((...args: unknown[]) => console.log(...args));

  const store = (target: unknown, mode: ConsoleMode): ConsoleGlobalResult => {
    if (!isConsoleTarget(target))
      return fail(mode === 'log' ? 'Nothing to log.' : 'Nothing to store.');
    const inspector = KIND_INSPECTOR[target.kind];
    if (!options.inspectors[inspector]) {
      return fail(`The ${inspector} inspector is turned off in the devtools config.`);
    }
    if (target.kind === 'component') {
      const instance = componentAt(target.id);
      if (!instance) return fail('That component is no longer on the page.');
      return keep(instance, mode, 'Component');
    }
    if (target.kind === 'provider') {
      const found = providerValue(
        options.getNg(),
        target.injectorId,
        target.token,
        target.index,
        mode,
      );
      if ('error' in found) return fail(found.error);
      const refused = providerRefusal(target.token, found.value, mode);
      if (refused) return fail(refused);
      if (!isPlainData(found.value)) return keep(found.value, mode, target.token);
      return keepCopy(found.value, mode, target.token);
    }
    const state = options.ngrxState?.(target.storeId);
    if (!state) return fail('That store is no longer on the page.');
    return keepCopy(state.value, mode, 'NgRx state');
  };

  /** Stores `value` as `tempN`, or prints it in the page console under `label`. */
  const keep = (value: unknown, mode: ConsoleMode, label: string): ConsoleGlobalResult => {
    if (mode === 'log') {
      log(`[pangular] ${label}:`, value);
      return { ok: true, message: `Logged ${label} in the page console.` };
    }
    const name = handles.store(value);
    return { ok: true, name, message: `Stored as ${name}.` };
  };

  const keepCopy = (value: unknown, mode: ConsoleMode, label: string): ConsoleGlobalResult => {
    const copy = redactedCopy(value);
    const masked = copy.masked ? { masked: true as const } : {};
    if (mode === 'log') {
      log(`[pangular] ${label}:`, copy.value);
      return {
        ok: true,
        ...masked,
        message: copy.masked
          ? `Logged a copy of ${label} in the page console, with secret fields masked.`
          : `Logged ${label} in the page console.`,
      };
    }
    const name = handles.store(copy.value);
    return copy.masked
      ? {
          ok: true,
          name,
          masked: true,
          message: `Stored a copy as ${name}, with secret fields masked.`,
        }
      : { ok: true, name, message: `Stored a copy as ${name}.` };
  };

  my.rpc.register({
    name: 'console-global',
    type: 'event',
    jsonSerializable: true,
    handler: (
      message: { requestId?: unknown; pageId?: unknown; target?: unknown; mode?: unknown } | null,
    ) => {
      // Only the page that owns the request answers it; a request for every page is ignored.
      if (!message || typeof message.requestId !== 'string' || message.pageId !== pageId) return;
      let result: ConsoleGlobalResult;
      try {
        result = store(message.target, message.mode === 'log' ? 'log' : 'store');
      } catch (error) {
        result = fail(String((error as Error)?.message ?? error));
      }
      void my.rpc
        .call('console-global-result', { requestId: message.requestId, pageId, result })
        .catch(() => {});
    },
  });

  return {
    /** Sets `$ng0` to the component with this id, when the components inspector runs. */
    selectComponent(id: string | null) {
      if (!id || !options.inspectors.components) return;
      handles.select(componentAt(id));
    },
    dispose: () => handles.dispose(),
  };
}
