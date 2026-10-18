import type { FormFieldNode } from '../forms.ts';
import { clip, overflowKey } from '../text.ts';

/** Size caps for the forms agent tools, so a large form cannot flood an agent's context. */
export const FORM_TOOL_MAX_CHARS = 20_000;
/** Fields per form in a field tree. */
export const MAX_FORM_FIELDS = 200;
/** Characters of one value (as JSON) in a field tree. */
export const MAX_FIELD_VALUE_CHARS = 300;
/** Characters of a whole form value (inspect-form-payload, export-form). */
export const MAX_FORM_VALUE_CHARS = 8_000;
/** Lines in a list answer (errors, findings, changes). */
export const MAX_FORM_LINES = 100;

/** A field tree node as the tools return it: fields left out by the cap are counted in `notShown`. */
export type CappedFieldNode = Omit<FormFieldNode, 'children'> & {
  children?: CappedFieldNode[];
  notShown?: number;
};

export interface CappedTree {
  root: CappedFieldNode;
  shown: number;
  total: number;
  /** The first left-out field under each group that lost fields, shallowest first. */
  cut: string[];
  /** How many values were cut to `valueChars`. */
  clipped: number;
  /** How many fields had other long text (error messages, metadata) cut to `valueChars`. */
  trimmed: number;
}

function count(node: FormFieldNode): number {
  return 1 + (node.children ?? []).reduce((sum, child) => sum + count(child), 0);
}

/** `value` as is when its JSON fits in `max` characters, otherwise its JSON cut to `max` and ending in `…`. */
export function clipValue(value: unknown, max = MAX_FIELD_VALUE_CHARS): unknown {
  if (value === undefined) return value;
  const json = JSON.stringify(value);
  return json !== undefined && json.length > max ? clip(json, max) : value;
}

const VALUE_KEYS = ['value', 'defaultValue', 'uncommitted'] as const;
/** Properties kept whole: the field's identity, its value (cut separately) and its children. */
const WHOLE_KEYS = new Set<string>(['key', 'path', 'children', 'modelDrift', ...VALUE_KEYS]);
const MAX_TEXT_ITEMS = 20;
const MAX_TEXT_DEPTH = 4;

/** `value` with long strings cut to `max`, long arrays and objects cut to 20 entries, and deep nesting folded. */
export function trimText(value: unknown, max = MAX_FIELD_VALUE_CHARS, depth = 0): unknown {
  if (typeof value === 'string') return clip(value, max);
  if (!value || typeof value !== 'object') return value;
  if (depth >= MAX_TEXT_DEPTH) return Array.isArray(value) ? `[${value.length} items]` : '{…}';
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_TEXT_ITEMS).map((item) => trimText(item, max, depth + 1));
    if (value.length > MAX_TEXT_ITEMS) items.push(`… ${value.length - MAX_TEXT_ITEMS} more`);
    return items;
  }
  const keys = Object.keys(value);
  const out: Record<string, unknown> = {};
  for (const key of keys.slice(0, MAX_TEXT_ITEMS)) {
    out[clip(key, max)] = trimText((value as Record<string, unknown>)[key], max, depth + 1);
  }
  if (keys.length > MAX_TEXT_ITEMS)
    out[overflowKey(out)] = `${keys.length - MAX_TEXT_ITEMS} more keys`;
  return out;
}

/**
 * Keeps the first `max` fields of `root` in breadth-first order, so the shape
 * near the root survives and deep or long branches are cut first. A kept group
 * that lost fields gets `notShown` with how many fields under it are left out.
 * Values longer than `valueChars` are cut.
 */
export function capFieldTree(
  root: FormFieldNode,
  max = MAX_FORM_FIELDS,
  valueChars = MAX_FIELD_VALUE_CHARS,
): CappedTree {
  const kept = new Set<FormFieldNode>();
  const queue = [root];
  while (queue.length && kept.size < Math.max(1, max)) {
    const node = queue.shift()!;
    kept.add(node);
    queue.push(...(node.children ?? []));
  }
  const cut: { path: string; depth: number }[] = [];
  let clipped = 0;
  const clipOne = (value: unknown) => {
    const out = clipValue(value, valueChars);
    if (out !== value) clipped++;
    return out;
  };
  let trimmed = 0;
  const copy = (node: FormFieldNode, depth: number): CappedFieldNode => {
    const out: CappedFieldNode = { ...node };
    let changed = false;
    for (const [key, value] of Object.entries(node)) {
      if (WHOLE_KEYS.has(key) || !value || typeof value === 'number' || typeof value === 'boolean')
        continue;
      const short = trimText(value, valueChars);
      if (JSON.stringify(short) !== JSON.stringify(value)) {
        (out as unknown as Record<string, unknown>)[key] = short;
        changed = true;
      }
    }
    if (changed) trimmed++;
    for (const key of VALUE_KEYS) {
      if (key in out) out[key] = clipOne(out[key]);
    }
    if (node.modelDrift) {
      out.modelDrift = {
        model: clipOne(node.modelDrift.model),
        viewModel: clipOne(node.modelDrift.viewModel),
      };
    }
    if (node.children) {
      const children = node.children.filter((child) => kept.has(child));
      out.children = children.map((child) => copy(child, depth + 1));
      const dropped = node.children.filter((child) => !kept.has(child));
      if (dropped.length) {
        out.notShown = dropped.reduce((sum, child) => sum + count(child), 0);
        cut.push({ path: dropped[0].path, depth });
      }
    }
    return out;
  };
  const capped = copy(root, 0);
  return {
    root: capped,
    shown: kept.size,
    total: count(root),
    cut: cut.sort((a, b) => a.depth - b.depth).map((c) => c.path),
    clipped,
    trimmed,
  };
}

/**
 * The render with the most fields per form, up to `max`, whose `text` fits in
 * `room` characters, found by bisection. When even one field per form does not
 * fit, returns `fallback()`, which must fit on its own.
 */
export function fitFields<T extends { text: string }>(
  render: (fields: number) => T,
  room: number,
  fallback: () => T,
  max = MAX_FORM_FIELDS,
): T {
  const full = render(max);
  if (full.text.length <= room) return full;
  let low = 1;
  let high = max - 1;
  let best = render(low);
  if (best.text.length > room) return fallback();
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const attempt = render(mid);
    if (attempt.text.length <= room) {
      low = mid;
      best = attempt;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

/** The first `max` lines, and a last line saying how many more were left out and how to narrow. */
export function capLines(lines: string[], narrow: string, max = MAX_FORM_LINES): string[] {
  if (lines.length <= max) return lines;
  return [...lines.slice(0, max), `- … and ${lines.length - max} more not shown; ${narrow}.`];
}

/** `text` cut to `max` characters with the same note the other agent tools use. */
export function capText(text: string, narrow: string, max = FORM_TOOL_MAX_CHARS): string {
  return text.length > max
    ? `${text.slice(0, max)}… (truncated at ${max} characters; ${narrow})`
    : text;
}

/** A form value as JSON, cut to `max` characters with a note on how to see the rest. */
export function valueJson(value: unknown, narrow: string, max = MAX_FORM_VALUE_CHARS): string {
  const json = JSON.stringify(value) ?? 'undefined';
  return json.length > max
    ? `${json.slice(0, max)}… (cut at ${max} of ${json.length} characters; ${narrow})`
    : json;
}

/** Examples of `path` values the agent can pass to see fields the cap left out. */
export function pathHint(cut: string[]): string {
  const paths = [...new Set(cut)].slice(0, 3);
  return paths.length ? `, e.g. ${paths.map((p) => `\`${p}\``).join(', ')}` : '';
}
