import { redactCall } from '../redaction.ts';
import type { HttpCall } from '../http-rules.ts';
import type { NavigationRecord } from '../router.ts';
import { clip, code } from '../text.ts';
import type { NavigationCalls } from '../router-types.ts';
export type { NavigationCalls } from '../router-types.ts';

/** How long after a navigation ends a call still counts as one of its own. */
export const AFTER_MS = 5_000;
/** Most calls of each group an answer lists. */
const MAX_LISTED = 10;

/** The navigation that started after `nav` in the list, ignoring probes. */
export function nextNavigation(
  navigations: readonly NavigationRecord[],
  nav: NavigationRecord,
): NavigationRecord | undefined {
  return navigations.find(
    (other) => other !== nav && !other.probe && other.startedAt > nav.startedAt,
  );
}

/**
 * The page's client calls for `nav`, redacted, in start order. A navigation
 * still running takes every call since it started. A probe or a navigation
 * from before Pangular Inspector connected has no time window, so it gets none.
 */
export function callsForNavigation(
  nav: NavigationRecord,
  next: NavigationRecord | undefined,
  calls: readonly HttpCall[] | undefined,
): NavigationCalls {
  const out: NavigationCalls = { during: [], after: [] };
  if (!calls?.length || nav.beforeConnect || nav.probe) return out;
  const start = nav.startedAt;
  const end = nav.endedAt ?? Number.POSITIVE_INFINITY;
  const stop = Math.min(next?.startedAt ?? Number.POSITIVE_INFINITY, end + AFTER_MS);
  const sorted = calls.filter((call) => call.side === 'client').sort((a, b) => a.at - b.at);
  for (const call of sorted) {
    if (call.at >= start && call.at <= end) out.during.push(redactCall(call));
    else if (call.at > end && call.at < stop) out.after.push(redactCall(call));
  }
  return out;
}

function status(call: HttpCall): string {
  if (call.cancelled) return 'cancelled';
  return call.status ? String(call.status) : 'ERR';
}

/** One call as `GET /api/users 200 34ms`, with what a rule or the cache did. */
export function callLine(call: HttpCall): string {
  const flags = [
    call.cacheHit ? 'cache hit' : '',
    call.mocked ? 'mocked' : '',
    call.faulted ? 'faulted' : '',
  ].filter(Boolean);
  return `${call.method} ${code(clip(call.url, 300))} ${status(call)} ${Math.round(call.durationMs)}ms${flags.length ? ` (${flags.join(', ')})` : ''}`;
}

/** The markdown lines `explain-navigation` adds under one navigation. */
export function navigationCallsLines(calls: NavigationCalls, pad = '  '): string[] {
  const lines: string[] = [];
  const group = (label: string, list: HttpCall[]) => {
    if (!list.length) return;
    const shown = list.slice(0, MAX_LISTED).map(callLine).join('; ');
    const more = list.length > MAX_LISTED ? ` and ${list.length - MAX_LISTED} more` : '';
    lines.push(
      `${pad}- HTTP calls ${label} (${list.length}, from the HTTP inspector): ${shown}${more}`,
    );
  };
  group('while it ran', calls.during);
  group(`after it ended (within ${AFTER_MS / 1000}s, before the next navigation)`, calls.after);
  return lines;
}
