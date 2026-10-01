import type { NgDevtoolsLimit } from './config.ts';

/** Agent tool note for a timeline that dropped its oldest entries at a `limits` cap. */
export function droppedNote(dropped: number | undefined, what: string, limit: NgDevtoolsLimit) {
  if (!dropped || dropped < 1) return '';
  return `\n\n_${dropped} older ${what} were dropped at the limit, so the list starts later than the page did. Raise \`limits.${limit}\` in the ng-devtools configuration to keep more._`;
}
