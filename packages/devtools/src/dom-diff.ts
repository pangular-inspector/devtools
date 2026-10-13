// A line diff of two DOM descriptions, such as the server HTML Angular expected
// and the client DOM it found when hydration failed (NG0500 to NG0502).

/** One line of a diff: in both, only in what was expected (server), or only in what was found (client). */
export interface DiffLine {
  op: 'same' | 'expected' | 'actual';
  text: string;
}

/** Lines compared at most per side; the rest is dropped, so the table stays small. */
export const MAX_DIFF_LINES = 80;

/** Angular marks the node it means with this text (`AT_THIS_LOCATION` in `@angular/core`). */
const AT_THIS_LOCATION = /\s*<-- AT THIS LOCATION\s*$/;

function lines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim() !== '')
    .slice(0, MAX_DIFF_LINES);
}

/** The line without Angular's location marker, so a marked line matches its unmarked twin. */
const comparable = (line: string) => line.replace(AT_THIS_LOCATION, '').trim();

/**
 * Compares two DOM descriptions line by line (longest common subsequence),
 * ignoring indentation and Angular's `<-- AT THIS LOCATION` marker when
 * matching. Lines in both are `same`, lines only Angular expected are
 * `expected`, lines only the client DOM has are `actual`. Either side may be
 * empty, as when Angular found no node at all.
 */
export function diffDom(expected: string | undefined, actual: string | undefined): DiffLine[] {
  const a = lines(expected ?? '');
  const b = lines(actual ?? '');
  const ka = a.map(comparable);
  const kb = b.map(comparable);
  // lcs[i][j]: the longest common run of a[i..] and b[j..].
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] =
        ka[i] === kb[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (ka[i] === kb[j]) {
      // Keep the client's line: it carries the marker when only the client side has one.
      out.push({ op: 'same', text: AT_THIS_LOCATION.test(a[i]!) ? a[i]! : b[j]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ op: 'expected', text: a[i++]! });
    } else {
      out.push({ op: 'actual', text: b[j++]! });
    }
  }
  while (i < a.length) out.push({ op: 'expected', text: a[i++]! });
  while (j < b.length) out.push({ op: 'actual', text: b[j++]! });
  return out;
}

/** The diff as unified text: two spaces, `-` for the server side and `+` for the client side. */
export function diffText(diff: readonly DiffLine[]): string {
  return diff
    .map((line) => `${line.op === 'same' ? ' ' : line.op === 'expected' ? '-' : '+'} ${line.text}`)
    .join('\n');
}
