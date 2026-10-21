import type { ToolInputSchema } from './tool-input.ts';
import { clip } from '../text.ts';

/** Longest answer of a listed source scan, note included, as for the live tools. */
export const SCAN_LIST_MAX_CHARS = 20_000;
/** Room the note after a cut part takes, so the whole answer fits {@link SCAN_LIST_MAX_CHARS}. */
const NOTE_ROOM = 300;
const JSON_ROOM = SCAN_LIST_MAX_CHARS - NOTE_ROOM;
/** Items a listed source scan answers when the call sets no `limit`. */
export const SCAN_LIST_DEFAULT_LIMIT = 200;
/** The most items one call can ask for. */
export const SCAN_LIST_MAX_LIMIT = 1_000;

/** How a scan that answers a list is filtered and paged. */
export interface ScanList {
  /** What the items are, plural, for the notes: `signals`. */
  noun: string;
  /** The item fields `filter` searches. */
  fields: readonly string[];
}

export interface ScanListArgs {
  filter?: string;
  offset?: number;
  limit?: number;
}

/** The `filter`, `offset` and `limit` arguments of a listed scan. */
export function scanListSchema(list: ScanList): Record<string, ToolInputSchema> {
  return {
    filter: {
      type: 'string',
      maxLength: 200,
      description: `Only ${list.noun} whose ${list.fields.join(', ')} contains this text, any case.`,
    },
    offset: {
      type: 'integer',
      minimum: 0,
      description: `How many matching ${list.noun} to skip (default 0). A cut answer says the offset of the next part.`,
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: SCAN_LIST_MAX_LIMIT,
      description: `How many ${list.noun} to answer (1-${SCAN_LIST_MAX_LIMIT}, default ${SCAN_LIST_DEFAULT_LIMIT}). The answer also stops at ${SCAN_LIST_MAX_CHARS.toLocaleString('en-US')} characters.`,
    },
  };
}

function matches(item: unknown, fields: readonly string[], needle: string): boolean {
  if (!item || typeof item !== 'object') return false;
  return fields.some((field) => {
    const value = (item as Record<string, unknown>)[field];
    const text = Array.isArray(value) ? value.join(' ') : value;
    return typeof text === 'string' && text.toLowerCase().includes(needle);
  });
}

/**
 * One part of a scan's list as compact JSON. An answer that holds every
 * matching item is the JSON array alone, as before; a cut one is followed by
 * a note with how many items it left out and the `offset` of the next part.
 */
export function scanListAnswer(items: unknown[], args: ScanListArgs, list: ScanList): string {
  const needle = args.filter?.trim().toLowerCase() ?? '';
  const matched = needle ? items.filter((item) => matches(item, list.fields, needle)) : items;
  const offset = args.offset ?? 0;
  const limit = args.limit ?? SCAN_LIST_DEFAULT_LIMIT;
  const which = needle ? `${list.noun} matching \`filter\`` : list.noun;
  const narrow = needle ? '' : ', or `filter` to narrow it';

  if (!matched.length) {
    return needle
      ? `[]\n\n_No ${list.noun} match \`filter\`; the scan found ${items.length} in all._`
      : '[]';
  }
  if (offset >= matched.length) {
    return `[]\n\n_No ${which} at \`offset\` ${offset}; there are ${matched.length}, so the last part starts at ${Math.max(0, matched.length - limit)}._`;
  }

  let part = matched.slice(offset, offset + limit);
  let json = JSON.stringify(part);
  if (json.length > JSON_ROOM && part.length > 1) {
    // The most items that fit, found by bisection; at least one, cut below if it alone is too long.
    let low = 1;
    let high = part.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (JSON.stringify(part.slice(0, mid)).length <= JSON_ROOM) low = mid;
      else high = mid - 1;
    }
    part = part.slice(0, low);
    json = JSON.stringify(part);
  }
  if (json.length > JSON_ROOM) {
    // One item alone is longer than the cap: cut it, so the cap still holds.
    const after =
      offset + 1 < matched.length
        ? ` Pass \`offset: ${offset + 1}\` for the next part.`
        : ' This is the last part.';
    return `${clip(json, JSON_ROOM)}\n\n_Item ${offset + 1} of ${matched.length} is ${json.length.toLocaleString('en-US')} characters as JSON, so it is cut at ${JSON_ROOM.toLocaleString('en-US')} and the answer is not valid JSON.${after}_`;
  }
  if (offset === 0 && part.length === matched.length) return json;

  const end = offset + part.length;
  const left = matched.length - part.length;
  const next =
    end < matched.length
      ? ` Pass \`offset: ${end}\` for the next part${narrow}.`
      : ' This is the last part.';
  return `${json}\n\n_Showing ${which} ${offset + 1}-${end} of ${matched.length}; ${left} more not shown.${next}_`;
}
