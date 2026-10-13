import type { SsrContextStorage } from './ssr-context.ts';
import type { SsrNavigation } from './ssr-navigation.ts';
import type { SsrOverride, SsrOverrideKind } from './ssr-overrides.ts';

export interface AppliedOverride {
  id: string;
  kind: SsrOverrideKind;
  applied: boolean;
  /** Why it did not apply, or what it changed. */
  note?: string;
}

/** Request header that carries the SSR request id from `ssrMiddleware` or `withPangularSsr` into the render. */
export const SSR_REQUEST_HEADER = 'x-pangular-ssr-id';

/** Server-Timing metric whose description is the SSR request id. */
export const SSR_TIMING_NAME = 'pangular';

export type SsrRenderMode =
  'server' | 'prerender' | 'client' | 'redirect' | 'not-rendered' | 'unknown';

export interface SsrRequest {
  id: string;
  method: string;
  url: string;
  status: number;
  /** When the request arrived, in ms since the epoch. */
  at: number;
  /** Arrival until the last byte was sent. */
  durationMs: number;
  /** Arrival until the status and headers were sent, which is when the render finished. */
  renderMs: number;
  bytes: number;
  /** Read from `ng-server-context` in the HTML (`ssr` Server, `ssg` Prerender, none Client), else from the status. */
  renderMode: SsrRenderMode;
  /** Server HttpClient calls that finished before the headers were sent. */
  fetches: number;
  fetchMs: number;
  headers: Record<string, string>;
  /** Router navigations during the render, with guard and resolver timings, when `providePangularHttp()` is set up. */
  navigations?: SsrNavigation[];
  /** SSR overrides from the panel that matched this request. */
  overrides?: AppliedOverride[];
  /** The body was already compressed when `ssrMiddleware` saw it, because compression ran first. */
  compressedBeforeTrace?: boolean;
  /** The connection closed before the response finished. */
  aborted?: boolean;
}

export interface ActiveRequest {
  /** The page path and query being rendered. */
  url?: string;
  fetches: number;
  fetchMs: number;
  navigations?: SsrNavigation[];
  overrides?: AppliedOverride[];
  /** When the trace began, in ms since the epoch, so a trace that never ends can expire. */
  startedAt?: number;
  /** When the trace last made progress (a body chunk, a server call, a navigation), in ms since the epoch. */
  lastActivityAt?: number;
  /** Ends the trace as aborted when it expires, such as a Response whose body nobody read. */
  abandon?: () => void;
}

/** How long a trace may stay in flight without progress before {@link sweepActiveSsrRequests} drops it. */
export const ACTIVE_SSR_TTL_MS = 5 * 60_000;

/** Marks a trace in flight as still making progress, so a long stream is not swept. */
export function touchSsrRequest(request: ActiveRequest | undefined, now = Date.now()): void {
  if (request) request.lastActivityAt = now;
}

/**
 * Drops traces with no progress for longer than {@link ACTIVE_SSR_TTL_MS}: a
 * response that was dropped unread never ends its trace, and would otherwise
 * stay in `active` for the server's life. A response that keeps streaming
 * chunks stays.
 */
export function sweepActiveSsrRequests(now = Date.now()): void {
  const { active } = ssrRegistry();
  for (const [id, request] of active) {
    const last = request.lastActivityAt ?? request.startedAt;
    if (last === undefined || now - last <= ACTIVE_SSR_TTL_MS) continue;
    active.delete(id);
    try {
      request.abandon?.();
    } catch {
      // The trace is gone either way.
    }
  }
}

export interface SsrRegistry {
  active: Map<string, ActiveRequest>;
  /** Set by the devframe server while the http inspector is on. */
  record?: (request: SsrRequest) => void;
  /** Set by the devframe server while the http inspector and `actions.http` are on. */
  overrides?: SsrOverride[];
  /** Which traced request the running code belongs to, shared by every copy of the package (`ssr-context.ts`). */
  context?: SsrContextStorage;
}

export function noteOverride(id: string, applied: AppliedOverride) {
  const active = ssrRegistry().active.get(id);
  if (!active) return;
  (active.overrides ??= []).push(applied);
  touchSsrRequest(active);
}

export function ssrRegistry(): SsrRegistry {
  const g = globalThis as { __PANGULAR_SSR__?: SsrRegistry };
  return (g.__PANGULAR_SSR__ ??= { active: new Map() });
}

/** The id when `ssrMiddleware` is still handling that request, so a forged header is ignored. */
export function activeSsrRequest(id: string | null | undefined): string | undefined {
  return id && ssrRegistry().active.has(id) ? id : undefined;
}

export function noteSsrFetch(id: string, durationMs: number) {
  const active = ssrRegistry().active.get(id);
  if (!active) return;
  active.fetches++;
  active.fetchMs += durationMs;
  touchSsrRequest(active);
}

const ID_PATTERN = /^[a-z0-9]{1,40}$/;

export function isSsrRequestId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

/** The SSR request id that the server sent with this document, read from Server-Timing. */
export function readSsrRequestId(): string | undefined {
  try {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const entry = nav?.serverTiming?.find((t) => t.name === SSR_TIMING_NAME);
    return isSsrRequestId(entry?.description) ? entry.description : undefined;
  } catch {
    return undefined;
  }
}
