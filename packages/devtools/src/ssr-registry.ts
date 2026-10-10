import type { SsrNavigation } from './ssr-navigation.ts';
import type { SsrOverride, SsrOverrideKind } from './ssr-overrides.ts';

export interface AppliedOverride {
  id: string;
  kind: SsrOverrideKind;
  applied: boolean;
  /** Why it did not apply, or what it changed. */
  note?: string;
}

/** Request header that carries the SSR request id from `ssrMiddleware` into the render. */
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
  /** The connection closed before the response finished. */
  aborted?: boolean;
}

export interface ActiveRequest {
  fetches: number;
  fetchMs: number;
  navigations?: SsrNavigation[];
  overrides?: AppliedOverride[];
}

export interface SsrRegistry {
  active: Map<string, ActiveRequest>;
  /** Set by the devframe server while the http inspector is on. */
  record?: (request: SsrRequest) => void;
  /** Set by the devframe server while the http inspector and `actions.http` are on. */
  overrides?: SsrOverride[];
}

export function noteOverride(id: string, applied: AppliedOverride) {
  const active = ssrRegistry().active.get(id);
  if (active) (active.overrides ??= []).push(applied);
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
