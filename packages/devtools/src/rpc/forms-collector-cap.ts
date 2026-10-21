import type { CollectedForm, FormFieldNode } from '../forms.ts';
import { code } from '../text.ts';

/**
 * Children the forms collector keeps per group or array (`MAX_CHILDREN` in
 * `forms.ts`). The rest never reach the server; the group counts them in
 * `truncated` and names the invalid ones in `truncatedInvalid`.
 */
export const COLLECTOR_MAX_CHILDREN = 100;
/** Levels the collector reads (`MAX_DEPTH` in `forms.ts`); a group at the last one keeps no children. */
export const COLLECTOR_MAX_DEPTH = 8;
/** Invalid children past the cap a group names at most (`MAX_INVALID_PAST_CAP` in `forms.ts`). */
export const COLLECTOR_MAX_INVALID = 20;
/** The longest path the collector names in `truncatedInvalid` (`MAX_INVALID_PATH` in `forms.ts`). */
export const COLLECTOR_MAX_INVALID_PATH = 500;

/** A group the collector cut: how many of its direct children it kept, of how many. */
export interface CutGroup {
  path: string;
  kept: number;
  total: number;
  /** Paths of invalid children left out, as far as the collector named them. */
  invalid: string[];
  /** Cut by the depth limit: none of its children were read. */
  tooDeep: boolean;
}

/** The groups under `node` (itself included) that the collector cut, in tree order. */
export function cutGroups(node: FormFieldNode): CutGroup[] {
  const groups: CutGroup[] = [];
  const visit = (n: FormFieldNode) => {
    if (n.truncated) {
      const kept = n.children?.length ?? 0;
      groups.push({
        path: n.path,
        kept,
        total: kept + n.truncated,
        invalid: n.truncatedInvalid ?? [],
        tooDeep: !n.children,
      });
    }
    for (const child of n.children ?? []) visit(child);
  };
  visit(node);
  return groups;
}

const MAX_NAMED = 3;
const where = (path: string) => code(path || '(form)');

/**
 * One sentence on the groups the collector cut, such as "`items` keeps the
 * first 100 of 150 fields (the collector's limit of 100 per group); 50 more
 * are not read." Empty when nothing was cut.
 */
export function cutSentence(groups: CutGroup[]): string {
  if (!groups.length) return '';
  const named = groups
    .slice(0, MAX_NAMED)
    .map((g) =>
      g.tooDeep
        ? `${where(g.path)} is past the depth limit (${g.total} fields not read)`
        : `${where(g.path)} keeps the first ${g.kept} of ${g.total} fields (${g.total - g.kept} more not read)`,
    );
  const more = groups.length > MAX_NAMED ? `, and ${groups.length - MAX_NAMED} more groups` : '';
  return `${named.join('; ')}${more}. The collector reads at most ${COLLECTOR_MAX_CHILDREN} fields per group and ${COLLECTOR_MAX_DEPTH} levels deep.`;
}

/**
 * The lines `explain-invalid-forms` adds for fields the collector left out:
 * each invalid field it named, with the error the form's `errorSummary` has
 * for it (Signal Forms), and a note on the cut groups.
 */
export function pastCapLines(form: CollectedForm, start: FormFieldNode): string[] {
  const groups = cutGroups(start);
  const lines: string[] = [];
  const summary = form.errorSummary ?? [];
  for (const path of groups.flatMap((g) => g.invalid)) {
    const errors = summary.filter((e) => e.path === path);
    const detail = errors.length
      ? errors.map((e) => `[${e.kind}] ${e.message}`).join('; ')
      : 'its errors are not in the report';
    lines.push(
      `- ${where(path)} is INVALID: ${detail} (past the collector's limit of ${COLLECTOR_MAX_CHILDREN} fields per group)`,
    );
  }
  return lines;
}
