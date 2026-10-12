/** A command as the palette lists it. */
export interface PaletteCommand {
  id: string;
  title: string;
  group: string;
  keywords?: string;
  /** A shortcut that also runs it, shown beside the title. */
  shortcut?: string;
}

/**
 * How well `query` matches `text` as a subsequence, or `-1` when it doesn't.
 * Consecutive letters and letters at the start of a word score higher, so
 * `gtsig` finds "Go to Signals" and `sig` puts it before "Design".
 */
export function fuzzyScore(text: string, query: string): number {
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase().replace(/\s+/g, '');
  if (!needle) return 0;
  let score = 0;
  let from = 0;
  let previous = -2;
  for (const char of needle) {
    const index = haystack.indexOf(char, from);
    if (index < 0) return -1;
    const wordStart = index === 0 || /[\s:&/-]/.test(haystack[index - 1]);
    score += 1;
    if (index === previous + 1) score += 3;
    if (wordStart) score += 4;
    previous = index;
    from = index + 1;
  }
  // Shorter texts with the same letters read as the closer match.
  return score - haystack.length / 100;
}

/**
 * The commands that match `query`, best first. A title match beats one in
 * the group or keywords. An empty query keeps the given order.
 */
export function filterCommands<T extends PaletteCommand>(
  commands: readonly T[],
  query: string,
): T[] {
  const trimmed = query.trim();
  if (!trimmed) return [...commands];
  return commands
    .map((command, index) => {
      const title = fuzzyScore(command.title, trimmed);
      const extra = fuzzyScore(`${command.group} ${command.keywords ?? ''}`, trimmed);
      const score = Math.max(title >= 0 ? title + 10 : -1, extra);
      return { command, index, score };
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.command);
}
