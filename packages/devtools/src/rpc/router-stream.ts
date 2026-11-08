import type { NavigationRecord } from '../router.ts';
import { code, UNTRUSTED } from './forms-tools.ts';
import { capped, MAX_TOOL_CHARS } from './router-tools.ts';

/** One navigation as the stream hands it out: new, or changed since it was last handed out. */
export interface StreamEntry {
  seq: number;
  pageId: string;
  nav: NavigationRecord;
  /** It was in the stream before, with another outcome or target. */
  updated: boolean;
}

export interface StreamRead {
  entries: StreamEntry[];
  /** Pass this as `since` to get only what comes after. */
  cursor: number;
  /** The cursor was from before the server started or past what it kept, so the stream started over. */
  reset?: boolean;
  /** Entries past the stream's cap that were dropped before they were read. */
  missed?: number;
}

/** Most entries the stream keeps. */
export const MAX_STREAM_ENTRIES = 500;
/** Longest an agent may wait for the next navigation. */
export const MAX_WAIT_MS = 30_000;

/** What makes a navigation worth handing out again: where it is and how it ended. */
function signature(nav: NavigationRecord): string {
  return [
    nav.outcome,
    nav.finalUrl ?? '',
    nav.redirectTo ?? '',
    nav.endedAt ?? '',
    nav.code ?? '',
  ].join('|');
}

/**
 * Every navigation the pages report, in the order the server saw them, each
 * with a sequence number. A navigation comes again with a higher number when
 * its outcome, target or end changes, so an agent that reads with the last
 * cursor sees a pending navigation once it ends. Probes are left out.
 */
export class NavigationStream {
  private seq = 0;
  private entries: StreamEntry[] = [];
  private signatures = new Map<string, string>();
  private waiters = new Set<() => void>();
  private dropped = 0;

  /** Adds the navigations of one report that are new or changed. Returns how many. */
  record(pageId: string, navigations: readonly NavigationRecord[]): number {
    let added = 0;
    for (const nav of navigations) {
      if (nav.probe) continue;
      const key = `${pageId}\u0000${nav.id}\u0000${nav.startedAt}`;
      const sig = signature(nav);
      const before = this.signatures.get(key);
      if (before === sig) continue;
      this.signatures.set(key, sig);
      this.entries = this.entries.filter(
        (entry) =>
          !(
            entry.pageId === pageId &&
            entry.nav.id === nav.id &&
            entry.nav.startedAt === nav.startedAt
          ),
      );
      this.entries.push({ seq: ++this.seq, pageId, nav, updated: before !== undefined });
      added++;
    }
    if (this.entries.length > MAX_STREAM_ENTRIES) {
      const cut = this.entries.length - MAX_STREAM_ENTRIES;
      this.dropped = this.entries[cut - 1].seq;
      this.entries.splice(0, cut);
    }
    if (this.signatures.size > MAX_STREAM_ENTRIES * 4) {
      const keep = new Set(
        this.entries.map((e) => `${e.pageId}\u0000${e.nav.id}\u0000${e.nav.startedAt}`),
      );
      for (const key of this.signatures.keys()) if (!keep.has(key)) this.signatures.delete(key);
    }
    // A copy: each waiter removes itself from the set when it wakes.
    // oxlint-disable-next-line unicorn/no-useless-spread
    if (added) for (const wake of [...this.waiters]) wake();
    return added;
  }

  /**
   * Forgets the navigations of one page, or of every page, after they were
   * cleared or the page went away. The cursor keeps counting, so a cursor an
   * agent holds stays valid.
   */
  clear(pageId?: string): void {
    const gone = (id: string) => pageId === undefined || id === pageId;
    this.entries = this.entries.filter((entry) => !gone(entry.pageId));
    for (const key of this.signatures.keys()) {
      if (gone(key.slice(0, key.indexOf('\u0000')))) this.signatures.delete(key);
    }
  }

  /**
   * The pages the stream holds anything for: navigations, or the signatures of
   * navigations that later entries displaced, which still hold their URLs.
   */
  pageIds(): Set<string> {
    const ids = new Set(this.entries.map((entry) => entry.pageId));
    for (const key of this.signatures.keys()) ids.add(key.slice(0, key.indexOf('\u0000')));
    return ids;
  }

  /** The latest cursor: what an agent passes to start following from now. */
  get cursor(): number {
    return this.seq;
  }

  /** The entries after `since`, for one page or every page. */
  read(since: number, pageId?: string): StreamRead {
    const reset = since > this.seq || since < 0;
    const from = reset ? 0 : since;
    const entries = this.entries.filter((e) => e.seq > from && (!pageId || e.pageId === pageId));
    const out: StreamRead = { entries, cursor: this.seq };
    if (reset) out.reset = true;
    if (!reset && this.dropped > from) out.missed = this.dropped - from;
    return out;
  }

  /**
   * Like {@link read}, but when nothing came after `since` yet, waits up to
   * `ms` (at most {@link MAX_WAIT_MS}) for the next navigation first.
   */
  async wait(since: number, ms: number, pageId?: string): Promise<StreamRead> {
    const first = this.read(since, pageId);
    const limit = Math.max(0, Math.min(MAX_WAIT_MS, ms));
    if (first.entries.length || first.reset || limit === 0) return first;
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.waiters.delete(check);
        resolve();
      };
      const check = () => {
        if (this.read(since, pageId).entries.length) done();
      };
      const timer = setTimeout(done, limit);
      timer.unref?.();
      this.waiters.add(check);
    });
    return this.read(since, pageId);
  }
}

function line(entry: StreamEntry): string {
  const nav = entry.nav;
  const target = nav.finalUrl && nav.finalUrl !== nav.url ? ` → ${code(nav.finalUrl)}` : '';
  const redirect = nav.redirectTo
    ? `, ${nav.redirectKind ?? 'router'} redirect to ${code(nav.redirectTo)}`
    : '';
  const reason =
    nav.outcome !== 'succeeded' && nav.outcome !== 'pending' && nav.reason
      ? `: ${code(nav.reason)}`
      : '';
  const took = nav.endedAt !== undefined ? ` in ${nav.endedAt - nav.startedAt}ms` : '';
  return `- [${entry.seq}] page ${code(entry.pageId)} #${nav.id} ${code(nav.url)}${target}: **${nav.outcome}**${took}${redirect}${reason}${entry.updated ? ' (updated)' : ''}`;
}

/** The stream read as markdown for the `follow-navigations` tool. */
export function streamText(read: StreamRead, args: { since?: number; waited: boolean }): string {
  const lines: string[] = [];
  if (read.reset) {
    lines.push(
      `_The cursor ${args.since} is from before the server started or is unknown, so this lists every navigation the stream keeps._`,
    );
  }
  if (read.missed) {
    lines.push(`_${read.missed} older change(s) were dropped before they were read._`);
  }
  if (!read.entries.length) {
    lines.push(
      args.since === undefined
        ? 'No navigations recorded yet.'
        : args.waited
          ? 'No new navigation came within the wait.'
          : 'No new navigation since that cursor.',
    );
  } else {
    lines.push(
      `${read.entries.length} navigation(s)${args.since === undefined ? '' : ` after cursor ${args.since}`}, oldest first. "(updated)" marks one that was listed before and has since ended or changed.`,
    );
  }
  const footer = (cursor: number) =>
    `\n\n**Next cursor: ${cursor}**. Pass it as \`since\` to get only what comes after.`;
  const more = (count: number) =>
    `\n_${count} more navigation(s) did not fit. Pass the cursor below as \`since\` to read them._`;
  let body = `${UNTRUSTED}\n\n${lines.join('\n')}`;
  // Cut only at a whole entry, and hand out the cursor of the last one shown,
  // so the next call goes on from there instead of skipping the rest.
  let cursor = read.cursor;
  for (const [index, entry] of read.entries.entries()) {
    const next = `\n${line(entry)}`;
    const left = read.entries.length - index - 1;
    const room = (left ? more(left) : '') + footer(left ? entry.seq : read.cursor);
    if (index > 0 && body.length + next.length + room.length > MAX_TOOL_CHARS) {
      cursor = read.entries[index - 1].seq;
      body += more(left + 1);
      break;
    }
    body += next;
  }
  return capped(body + footer(cursor), 'pass a later `since` or `page`');
}
