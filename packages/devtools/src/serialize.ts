import { REDACTED, redactMessage, redactReason } from './forms-privacy.ts';
import { clip as clipText } from './text.ts';

export { REDACTED };

export interface SerializeLimits {
  depth?: number;
  keys?: number;
  items?: number;
  text?: number;
  budget?: number;
}

export const TRUNCATED = '[Truncated]';

export function isSecretName(name: unknown): boolean {
  return typeof name === 'string' && !!name && redactReason(name) !== null;
}

export function redactText(text: string): string {
  return redactMessage(text);
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
  const path = new Set<object>();

  const walkNamed = (key: unknown, v: unknown, level: number): unknown =>
    isSecretName(key) && !keepsUnderSecret(v) ? REDACTED : walk(v, level);

  const walk = (v: unknown, level: number): unknown => {
    if (--budget < 0) return TRUNCATED;
    if (v === null || v === undefined || typeof v === 'boolean') return v;
    if (typeof v === 'number') return Number.isFinite(v) ? v : String(v);
    if (typeof v === 'string') {
      const text = redactMessage(head(v));
      return clipText(v.length > REDACT_WINDOW ? `${text}…` : text, maxText);
    }
    if (typeof v === 'bigint') return `${v}n`;
    if (typeof v === 'symbol') return SENTINELS[v.description ?? ''] ?? v.toString();
    if (typeof v === 'function') return `[Function ${v.name || 'anonymous'}]`;
    if (typeof v !== 'object') return String(v);

    if (path.has(v)) return '[Circular]';
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? 'Invalid Date' : v.toISOString();
    if (v instanceof RegExp) return String(v);
    if (v instanceof Error) return clipText(redactMessage(`${v.name}: ${v.message}`), maxText);
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
        if (level >= maxDepth) return `[Map(${v.size})]`;
        const entries: unknown[] = [];
        for (const [key, item] of v) {
          if (entries.length >= maxItems) break;
          entries.push([walk(key, level + 1), walkNamed(key, item, level + 1)]);
        }
        return { $type: 'Map', size: v.size, entries };
      }
      if (v instanceof Set) {
        if (level >= maxDepth) return `[Set(${v.size})]`;
        const values: unknown[] = [];
        for (const item of v) {
          if (values.length >= maxItems) break;
          values.push(walk(item, level + 1));
        }
        return { $type: 'Set', size: v.size, values };
      }
      if (Array.isArray(v)) {
        if (level >= maxDepth) return `[Array(${v.length})]`;
        const out = v.slice(0, maxItems).map((item) => walk(item, level + 1));
        if (v.length > maxItems) out.push(`… ${v.length - maxItems} more`);
        return out;
      }
      const plain = isPlain(v);
      if (level >= maxDepth) return `[${plain ? 'Object' : typeName(v)}]`;
      const out: Record<string, unknown> = plain ? {} : { $type: typeName(v) };
      const keys = Object.keys(v);
      for (const key of keys.slice(0, maxKeys)) {
        let item: unknown;
        try {
          item = (v as Record<string, unknown>)[key];
        } catch {
          item = '[Unreadable]';
        }
        setKey(out, safeKey(key, out), walkNamed(key, item, level + 1));
      }
      if (keys.length > maxKeys) out['…'] = `${keys.length - maxKeys} more`;
      return out;
    } finally {
      path.delete(v);
    }
  };

  try {
    return walk(value, 0);
  } catch {
    return '[Unreadable]';
  }
}

export function serializeNamed(
  name: unknown,
  value: unknown,
  limits: SerializeLimits = {},
): unknown {
  return isSecretName(name) && !keepsUnderSecret(value) ? REDACTED : serialize(value, limits);
}
