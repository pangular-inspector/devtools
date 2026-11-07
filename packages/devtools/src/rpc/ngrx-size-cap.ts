/** The most bytes of JSON one stored NgRx state keeps (256 KB). */
export const NGRX_STATE_MAX_BYTES = 256 * 1024;

const encoder = new TextEncoder();

/**
 * The size of a value as JSON, in bytes. A value JSON leaves out (`undefined`,
 * a function) counts as 0; one it throws on (a `BigInt`, a cycle) is `null`.
 */
function jsonBytes(value: unknown): number | null {
  try {
    const text = JSON.stringify(value);
    return text === undefined ? 0 : encoder.encode(text).length;
  } catch {
    return null;
  }
}

/**
 * What a state, or a top-level slice, shows when JSON can't write it. The
 * overlay serializes state first, but a client may send a structured-clone
 * frame, which can carry a `BigInt` or a cycle.
 */
export const NGRX_NOT_SERIALIZABLE = '[not serializable]';

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
 * A value JSON can't write becomes `[not serializable]`; in an object, only the
 * slices it can't write do.
 */
export function capNgrxState(input: unknown, max = NGRX_STATE_MAX_BYTES): unknown {
  let value = input;
  let measured = jsonBytes(value);
  if (measured === null) {
    // Mark the slices JSON can't write, so the rest of an object stays readable.
    if (!isPlainRecord(value)) return NGRX_NOT_SERIALIZABLE;
    value = Object.fromEntries(
      Object.entries(value).map(([key, slice]) => [
        key,
        jsonBytes(slice) === null ? NGRX_NOT_SERIALIZABLE : slice,
      ]),
    );
    measured = jsonBytes(value);
    if (measured === null) return NGRX_NOT_SERIALIZABLE;
  }
  const whole = measured;
  let total = whole;
  if (total <= max) return value;
  if (!isPlainRecord(value)) return tooLargeText(whole);
  const out: Record<string, unknown> = { ...value };
  const sizes = Object.keys(out)
    .map((key) => ({ key, bytes: jsonBytes(out[key]) ?? 0 }))
    .sort((a, b) => b.bytes - a.bytes);
  for (const { key, bytes } of sizes) {
    if (total <= max) break;
    const marker = tooLargeText(bytes);
    const saved = bytes - (jsonBytes(marker) ?? 0);
    // A slice no larger than its marker (or one JSON can't write) would not shrink the state.
    if (saved <= 0) continue;
    out[key] = marker;
    total -= saved;
  }
  return total <= max ? out : tooLargeText(whole);
}

/** The field a signal store's state holds when even its fields together don't fit or can't be written. */
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
