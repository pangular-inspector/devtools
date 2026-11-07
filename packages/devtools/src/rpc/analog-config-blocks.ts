// Reads object literals out of vite.config by key, such as `nitro.storage` or
// `nitro.runtimeConfig`, without running the config. Values that are not
// literals are reported as expressions.

import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { maskStrings, stripComments } from './source-scan.ts';
import { blockEnd, configFile } from './analog-scan.ts';

export interface ConfigEntry {
  key: string;
  /** The literal value as text, or undefined for an object, which goes in `children`. */
  value?: string;
  /** Set when the value is code (a call, a variable), not a literal. */
  expression?: true;
  children?: ConfigEntry[];
}

export interface ConfigSource {
  file?: string;
  source: string;
  masked: string;
}

const MAX_ENTRIES = 100;

export function readConfigSource(root: string): ConfigSource {
  const file = configFile(root);
  if (!file) return { source: '', masked: '' };
  let raw = '';
  try {
    raw = readFileSync(join(root, file), 'utf-8');
  } catch {
    return { file, source: '', masked: '' };
  }
  const source = stripComments(raw);
  return { file, source, masked: maskStrings(source) };
}

/** The `{...}` value of `key` inside `[from, to)`, as offsets of its braces. */
export function blockOf(
  config: ConfigSource,
  key: string,
  from = 0,
  to = config.masked.length,
): { open: number; close: number } | undefined {
  const pattern = new RegExp(`(?:^|[\\s,{])['"]?${key}['"]?\\s*:\\s*\\{`, 'g');
  pattern.lastIndex = from;
  const match = pattern.exec(config.masked);
  if (!match || match.index >= to) return undefined;
  const open = match.index + match[0].length - 1;
  const close = blockEnd(config.masked, open);
  return close < to ? { open, close } : undefined;
}

/** A path of keys, such as `['nitro', 'storage']`, each looked up inside the last. */
export function blockAt(config: ConfigSource, path: string[]) {
  let range: { open: number; close: number } | undefined = {
    open: -1,
    close: config.masked.length,
  };
  for (const key of path) {
    range = blockOf(config, key, range.open + 1, range.close);
    if (!range) return undefined;
  }
  return range;
}

function literal(text: string): { value: string; expression?: true } {
  const value = text.trim();
  if (/^(['"`])[\s\S]*\1$/.test(value) && !/\$\{/.test(value)) {
    return { value: value.slice(1, -1) };
  }
  if (/^(true|false|null|undefined|-?\d+(\.\d+)?)$/.test(value)) return { value };
  return { value: value.slice(0, 120), expression: true };
}

/** The entries of the object literal between `open` and `close`, two levels deep. */
export function entriesOf(
  config: ConfigSource,
  range: { open: number; close: number },
  depth = 0,
): ConfigEntry[] {
  const out: ConfigEntry[] = [];
  const { masked, source } = config;
  let i = range.open + 1;
  while (i < range.close && out.length < MAX_ENTRIES) {
    const rest = masked.slice(i, range.close);
    const keyMatch = rest.match(/^[\s,]*(?:(['"])((?:(?!\1).)*)\1|([\w$-]+))\s*:\s*/);
    if (!keyMatch) {
      // A spread (`...base`) or a method: skip to the next comma at this level.
      const skip = nextComma(masked, i, range.close);
      if (skip <= i) break;
      i = skip + 1;
      continue;
    }
    const key =
      keyMatch[2] !== undefined
        ? (source.slice(i, i + keyMatch[0].length).match(/['"]([^'"]*)['"]/)?.[1] ?? '')
        : keyMatch[3];
    const valueAt = i + keyMatch[0].length;
    if (masked[valueAt] === '{') {
      const close = blockEnd(masked, valueAt);
      const entry: ConfigEntry = { key };
      entry.children = depth < 2 ? entriesOf(config, { open: valueAt, close }, depth + 1) : [];
      out.push(entry);
      i = close + 1;
      continue;
    }
    const end = nextComma(masked, valueAt, range.close);
    out.push({ key, ...literal(source.slice(valueAt, end)) });
    i = end + 1;
  }
  return out;
}

/** The next `,` at depth 0 from `from`, or `to`. */
function nextComma(masked: string, from: number, to: number): number {
  let depth = 0;
  for (let i = from; i < to; i++) {
    const ch = masked[i];
    if (ch === '{' || ch === '(' || ch === '[') depth++;
    else if (ch === '}' || ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) return i;
  }
  return to;
}
