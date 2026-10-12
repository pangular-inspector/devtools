import { REDACTED, redactMessage, redactReason } from './forms-privacy.ts';
import { knownSecrets, redactText as redactPairs } from './text-redact.ts';
import { clip as clipText } from './text.ts';

export { REDACTED };

export interface SerializeLimits {
  depth?: number;
  keys?: number;
  items?: number;
  text?: number;
  budget?: number;
  /**
   * Lazy levels for the component detail: a container past `depth` becomes a
   * `{ $collapsed, size }` marker instead of a `[Type]` string, and a cut
   * array or object ends with a `$more` count, so a reader can tell both
   * apart from text and ask for that path.
   */
  lazy?: boolean;
  /** Objects already open above the value, so one of them inside it shows as `[Circular]`. */
  ancestors?: readonly object[];
}

/**
 * One level of a value in the component detail: its own entries, with nested
 * containers collapsed, so the panel and agents read deeper levels by path.
 */
export const VALUE_LEVEL = { depth: 1, keys: 30, items: 30, text: 300, lazy: true } as const;

/** The marker a lazy level puts where a nested container was not read. */
export interface CollapsedValue {
  $collapsed: string;
  size: number;
}

export const TRUNCATED = '[Truncated]';
const UNREADABLE = '[Unreadable]';
const GETTER = '[Getter]';

export function isSecretName(name: unknown): boolean {
  return typeof name === 'string' && !!name && redactReason(name) !== null;
}

/** Masks credentials, JWTs, bearer tokens, secret `key=value` pairs and known secret values. */
export function redactText(text: string): string {
  return redactPairs(text, knownSecrets);
}

const REDACT_WINDOW = 65536;

function head(text: string): string {
  return text.length > REDACT_WINDOW ? text.slice(0, REDACT_WINDOW) : text;
}

function keepsUnderSecret(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    typeof value === 'function'
  );
}

const SENTINELS: Record<string, string> = {
  UNSET: '(not computed yet)',
  COMPUTING: '(computing)',
  ERRORED: '(threw an error)',
};

function typeName(value: object): string {
  const ctor = (value as { constructor?: { name?: unknown } }).constructor;
  const name = typeof ctor?.name === 'string' && ctor.name ? ctor.name : 'Object';
  return name.replace(/^_(?=[A-Z])/, '');
}

function isPlain(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function safeKey(key: string, taken: object): string {
  const safe = redactMessage(key);
  if (!Object.prototype.hasOwnProperty.call(taken, safe)) return safe;
  let n = 2;
  while (Object.prototype.hasOwnProperty.call(taken, `${safe} (${n})`)) n++;
  return `${safe} (${n})`;
}

function setKey(target: Record<string, unknown>, key: string, value: unknown) {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

export function serialize(value: unknown, limits: SerializeLimits = {}): unknown {
  const maxDepth = limits.depth ?? 4;
  const maxKeys = limits.keys ?? 40;
  const maxItems = limits.items ?? 40;
  const maxText = limits.text ?? 500;
  let budget = limits.budget ?? 5000;
  const lazy = limits.lazy === true;
  const path = new Set<object>(limits.ancestors ?? []);

  const walkNamed = (key: unknown, v: unknown, level: number): unknown =>
    isSecretName(key) && !keepsUnderSecret(v) ? REDACTED : walk(v, level);

  const errorText = (error: Error): string =>
    clipText(redactText(`${error.name}: ${error.message}`), maxText);

  // One node that throws (a revoked Proxy, a hostile `instanceof`) only hides itself.
  const walk = (v: unknown, level: number): unknown => {
    try {
      return walkNode(v, level);
    } catch {
      return UNREADABLE;
    }
  };

  const walkNode = (v: unknown, level: number): unknown => {
    if (--budget < 0) return TRUNCATED;
    if (v === null || v === undefined || typeof v === 'boolean') return v;
    if (typeof v === 'number') return Number.isFinite(v) ? v : String(v);
    if (typeof v === 'string') {
      const text = redactText(head(v));
      return clipText(v.length > REDACT_WINDOW ? `${text}…` : text, maxText);
    }
    if (typeof v === 'bigint') return `${v}n`;
    if (typeof v === 'symbol') return SENTINELS[v.description ?? ''] ?? v.toString();
    if (typeof v === 'function') return `[Function ${v.name || 'anonymous'}]`;
    if (typeof v !== 'object') return String(v);

    if (path.has(v)) return '[Circular]';
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? 'Invalid Date' : v.toISOString();
    if (v instanceof RegExp) return String(v);
    if (v instanceof Error) {
      const cause = ownValue(v, 'cause');
      if (cause === undefined || cause === GETTER || level >= maxDepth) return errorText(v);
      // One level of `cause`: a nested Error shows as text only.
      return {
        $type: typeName(v),
        message: errorText(v),
        cause: cause instanceof Error ? errorText(cause) : walk(cause, level + 1),
      };
    }
    if (typeof Element !== 'undefined' && v instanceof Element) {
      return `<${v.tagName.toLowerCase()}>`;
    }
    if (typeof Node !== 'undefined' && v instanceof Node) return `[${v.nodeName}]`;
    if (typeof Promise !== 'undefined' && v instanceof Promise) return '[Promise]';
    if (ArrayBuffer.isView(v)) return `[${typeName(v)}(${(v as { length?: number }).length ?? 0})]`;
    if (v instanceof ArrayBuffer) return `[ArrayBuffer(${v.byteLength})]`;

    path.add(v);
    try {
      if (v instanceof Map) {
        if (level >= maxDepth && !(lazy && !v.size)) {
          return lazy ? collapsed('Map', v.size) : `[Map(${v.size})]`;
        }
        const entries: unknown[] = [];
        for (const [key, item] of v) {
          if (entries.length >= maxItems) break;
          entries.push([walk(key, level + 1), walkNamed(key, item, level + 1)]);
        }
        return { $type: 'Map', size: v.size, entries };
      }
      if (v instanceof Set) {
        if (level >= maxDepth && !(lazy && !v.size)) {
          return lazy ? collapsed('Set', v.size) : `[Set(${v.size})]`;
        }
        const values: unknown[] = [];
        for (const item of v) {
          if (values.length >= maxItems) break;
          values.push(walk(item, level + 1));
        }
        return { $type: 'Set', size: v.size, values };
      }
      if (Array.isArray(v)) {
        if (level >= maxDepth && !(lazy && !v.length)) {
          return lazy ? collapsed('Array', v.length) : `[Array(${v.length})]`;
        }
        const out = v.slice(0, maxItems).map((item) => walk(item, level + 1));
        if (v.length > maxItems) {
          out.push(lazy ? { $more: v.length - maxItems } : `… ${v.length - maxItems} more`);
        }
        return out;
      }
      const plain = isPlain(v);
      if (level >= maxDepth && !lazy) return `[${plain ? 'Object' : typeName(v)}]`;
      const keys = Object.keys(v);
      if (level >= maxDepth && keys.length) {
        return collapsed(plain ? 'Object' : typeName(v), keys.length);
      }
      const out: Record<string, unknown> = plain ? {} : { $type: typeName(v) };
      for (const key of keys.slice(0, maxKeys)) {
        // Through the descriptor, so a getter on a live page object never runs.
        const item = ownValue(v, key);
        const shown =
          item === GETTER || item === UNREADABLE ? item : walkNamed(key, item, level + 1);
        setKey(out, safeKey(key, out), shown);
      }
      // Through safeKey, so the marker never replaces a real `…` key.
      if (keys.length > maxKeys) {
        if (lazy) setKey(out, safeKey('$more', out), keys.length - maxKeys);
        else setKey(out, safeKey('…', out), `${keys.length - maxKeys} more`);
      }
      return out;
    } finally {
      path.delete(v);
    }
  };

  return walk(value, 0);
}

function collapsed(type: string, size: number): CollapsedValue {
  return { $collapsed: type, size };
}

/** An own property's value, `[Getter]` for an accessor, `[Unreadable]` when the read throws. */
function ownValue(target: object, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (!descriptor) return undefined;
    return 'value' in descriptor ? descriptor.value : GETTER;
  } catch {
    return UNREADABLE;
  }
}

export function serializeNamed(
  name: unknown,
  value: unknown,
  limits: SerializeLimits = {},
): unknown {
  return isSecretName(name) && !keepsUnderSecret(value) ? REDACTED : serialize(value, limits);
}
