import { isRedactedKey, REDACTED } from './forms-privacy.ts';
import {
  diff,
  joinStatePath,
  NGRX_DIFF_MORE_CAP,
  referenceDiff,
  serialize,
  type NgrxDiffEntry,
} from './ngrx-shared.ts';
import { SliceCache } from './ngrx-slice-cache.ts';

// The diff of a signal store's state between two snapshots, for the NgRx collector's log.

export type Snapshot = Record<PropertyKey, unknown>;

/** The most diff rows an entry keeps. */
export const MAX_DIFF = 50;
/** Serialize limits for values in diff rows and arguments. */
export const SMALL = { depth: 4, maxKeys: 20, maxString: 300, budget: 400 };

/** The kept diff rows, and how many more changes were counted past them. */
export interface Changes {
  diff: NgrxDiffEntry[];
  more: number;
}

/** `diffTruncated` for an entry, set only when changes were left out. */
export function truncated(more: number): { diffTruncated?: number } {
  return more > 0 ? { diffTruncated: Math.min(more, NGRX_DIFF_MORE_CAP) } : {};
}

const slices = new SliceCache();

export function snapshotDiff(before: Snapshot, after: Snapshot, keys: PropertyKey[]): Changes {
  const out: NgrxDiffEntry[] = [];
  const overflow = { more: 0 };
  for (const key of keys) {
    if (out.length >= MAX_DIFF && overflow.more >= NGRX_DIFF_MORE_CAP) break;
    if (before[key] === after[key]) continue;
    // Quoted the way the state tree writes a child path, as in `["first name"]`.
    const root = typeof key === 'string' ? joinStatePath('', key) : String(key);
    if (typeof key === 'string' && isRedactedKey(key)) {
      if (out.length < MAX_DIFF) {
        out.push({ path: root, op: 'change', before: REDACTED, after: REDACTED });
      } else overflow.more++;
      continue;
    }
    const counted = overflow.more;
    const found = diff(
      slices.before(key, before[key]),
      slices.after(key, after[key]),
      MAX_DIFF - out.length,
      undefined,
      overflow,
      root,
    );
    if (!found.length && overflow.more === counted) {
      out.push(
        ...referenceDiff(
          before[key],
          after[key],
          root,
          SMALL,
          MAX_DIFF - out.length,
          undefined,
          overflow,
        ),
      );
      continue;
    }
    for (const entry of found) {
      out.push({
        ...entry,
        ...('before' in entry ? { before: serialize(entry.before, SMALL) } : {}),
        ...('after' in entry ? { after: serialize(entry.after, SMALL) } : {}),
      });
    }
  }
  return { diff: out, more: overflow.more };
}
