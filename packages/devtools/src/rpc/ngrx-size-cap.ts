/** The most bytes of JSON one stored NgRx state keeps (256 KB). */
export const NGRX_STATE_MAX_BYTES = 256 * 1024;

const encoder = new TextEncoder();

/** The size of a value as JSON, in bytes. A value JSON can't write counts as 0. */
function jsonBytes(value: unknown): number {
  try {
    const text = JSON.stringify(value);
    return text === undefined ? 0 : encoder.encode(text).length;
  } catch {
    return 0;
  }
}

/** What a state past the cap shows instead: `[too large: 300 KB]`. */
export function tooLargeText(bytes: number): string {
  return `[too large: ${Math.ceil(bytes / 1024)} KB]`;
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * Caps one stored NgRx state at `max` bytes of JSON. A state under the cap is
 * returned as it is. For an object, the largest top-level slices are replaced
 * with `[too large: N KB]` until the rest fits, so the small slices stay
 * readable. Any other value past the cap becomes the marker itself, and so
 * does an object that still doesn't fit, such as one with many small fields.
 */
export function capNgrxState(value: unknown, max = NGRX_STATE_MAX_BYTES): unknown {
  const whole = jsonBytes(value);
  let total = whole;
  if (total <= max) return value;
  if (!isPlainRecord(value)) return tooLargeText(whole);
  const out: Record<string, unknown> = { ...value };
  const sizes = Object.keys(out)
    .map((key) => ({ key, bytes: jsonBytes(out[key]) }))
    .sort((a, b) => b.bytes - a.bytes);
  for (const { key, bytes } of sizes) {
    if (total <= max) break;
    const marker = tooLargeText(bytes);
    const saved = bytes - jsonBytes(marker);
    // A slice no larger than its marker (or one JSON can't write) would not shrink the state.
    if (saved <= 0) continue;
    out[key] = marker;
    total -= saved;
  }
  return total <= max ? out : tooLargeText(whole);
}

/** The field a signal store's state holds when even its fields together don't fit. */
export const NGRX_TOO_LARGE_FIELD = '[state]';

/**
 * Caps a signal store's fields as one state: the largest fields give way to
 * the marker until the whole record fits. When they never fit, the record
 * holds only `[state]` with the marker, so it stays a record.
 */
export function capNgrxFields(
  fields: Record<string, unknown>,
  max = NGRX_STATE_MAX_BYTES,
): Record<string, unknown> {
  const capped = capNgrxState(fields, max);
  return typeof capped === 'string'
    ? { [NGRX_TOO_LARGE_FIELD]: capped }
    : (capped as Record<string, unknown>);
}
