export function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** The key for an overflow marker in `out`: `…`, or `… (2)`, `… (3)` and so on when the object already has it. */
export function overflowKey(out: object): string {
  let key = '…';
  for (let n = 2; Object.hasOwn(out, key); n++) key = `… (${n})`;
  return key;
}
