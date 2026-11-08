// How many values the redaction masked in what the panel or an agent sees.
// The panel imports this file through
// `@pangular-inspector/devtools/internal/redaction-count`, so it imports
// nothing. `redaction-count.test.ts` checks that the masks below are the ones
// the redaction helpers write.

/** What a masked value becomes (`REDACTED` in `forms-privacy.ts`). */
export const REDACTED_MASK = '[redacted]';
/** What an email address in a URL becomes (`EMAIL_MASK` in `text-redact.ts`). */
export const EMAIL_ADDRESS_MASK = '[email]';

const MASKS = [REDACTED_MASK, EMAIL_ADDRESS_MASK];

/** Most strings and keys `countRedacted` reads, so a large state stays cheap to count. */
export const COUNT_BUDGET = 20_000;

/**
 * The masks in a text: one `indexOf` scan per mask, which costs little next
 * to building the text. Redaction already ran; this only counts its marks.
 */
export function countRedactedText(text: string): number {
  let count = 0;
  for (const mask of MASKS) {
    for (let at = text.indexOf(mask); at >= 0; at = text.indexOf(mask, at + mask.length)) count++;
  }
  return count;
}

/**
 * The masks in a value the panel shows: in its strings and its keys, walked
 * once. It stops after `budget` strings and keys, so the count of a very
 * large value is a lower bound (`capped`).
 */
export function countRedacted(
  value: unknown,
  budget = COUNT_BUDGET,
): { count: number; capped: boolean } {
  let count = 0;
  let left = budget;
  const seen = new Set<object>();
  const stack: unknown[] = [value];
  while (stack.length) {
    const item = stack.pop();
    if (typeof item === 'string') {
      if (--left < 0) return { count, capped: true };
      count += countRedactedText(item);
      continue;
    }
    if (item === null || typeof item !== 'object' || seen.has(item)) continue;
    seen.add(item);
    if (Array.isArray(item)) {
      for (const entry of item) stack.push(entry);
      continue;
    }
    for (const [key, entry] of Object.entries(item)) {
      if (--left < 0) return { count, capped: true };
      count += countRedactedText(key);
      stack.push(entry);
    }
  }
  return { count, capped: false };
}

/** The short line an agent answer ends with when it holds masked values. */
export function redactionNote(count: number): string {
  return `_Redaction masked ${count} value${count === 1 ? '' : 's'} in this answer._`;
}
