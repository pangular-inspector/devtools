import {
  WEBMCP_CAUSED_AFTER_MS,
  type WebMcpEffectKey,
  type WebMcpEffectLayer,
} from './webmcp-trace.ts';

/**
 * Which WebMCP tool call is running right now, for collectors that tie the
 * effects they see to it (`webMcpCallNow`, `noteWebMcpEffect`). It imports
 * nothing heavy, so the HTTP interceptor entry can use it.
 */

/** What the context needs of a call in the watcher's log. */
export interface CallContextEntry {
  id: number;
  /** `performance.now()` at the start. */
  started: number;
  ms?: number;
  caused: WebMcpEffectKey[];
}

/** The Zone.js property that names the call a forked zone belongs to. */
export const WEBMCP_ZONE_KEY = 'pangularWebMcpCall';
const MAX_CAUSED = 100;

let active: CallContextEntry | null = null;
/** Calls still in a watcher's log, by id, so a zone property finds its call. */
const live = new Map<number, CallContextEntry>();

/** Marks `entry` as the call whose `execute` runs synchronously now; returns the one before. */
export function enterWebMcpCall(entry: CallContextEntry | null): CallContextEntry | null {
  const previous = active;
  active = entry;
  return previous;
}

export function trackWebMcpCall(entry: CallContextEntry): void {
  live.set(entry.id, entry);
}

export function untrackWebMcpCall(id: number): void {
  live.delete(id);
}

function zoneCallId(): unknown {
  try {
    const zone = (globalThis as { Zone?: { current?: { get?: (key: string) => unknown } } }).Zone;
    return zone?.current?.get?.(WEBMCP_ZONE_KEY);
  } catch {
    return undefined;
  }
}

/**
 * The id of the WebMCP tool call running now, synchronously or in its zone.
 * A collector keeps it from the start of an effect it reports later.
 */
export function webMcpCallNow(): number | undefined {
  if (active) return active.id;
  const id = zoneCallId();
  if (typeof id !== 'number') return undefined;
  const entry = live.get(id);
  if (!entry) return undefined;
  // A timer the call left behind stops counting as its own after a while.
  const now = performance.now();
  const end = entry.started + (entry.ms ?? now - entry.started);
  return now - end <= WEBMCP_CAUSED_AFTER_MS ? entry.id : undefined;
}

/** Ties an effect a collector reports to the call `callId` (from `webMcpCallNow`). */
export function noteWebMcpEffect(
  callId: number | undefined,
  layer: WebMcpEffectLayer,
  key: string,
): void {
  if (callId === undefined) return;
  const entry = live.get(callId);
  if (!entry || entry.caused.length >= MAX_CAUSED) return;
  if (!entry.caused.some((effect) => effect.layer === layer && effect.key === key)) {
    entry.caused.push({ layer, key });
  }
}
