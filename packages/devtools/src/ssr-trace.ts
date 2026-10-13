// The part of SSR tracing that does not depend on how the server talks HTTP.
// `ssr-middleware.ts` (Node `req`/`res`) and `ssr-fetch.ts` (web `Request`/
// `Response`) both start, time and record a render through these functions,
// so the two paths report the same fields in the same way.

import { editTransferState, matchingOverrides, type SsrOverride } from './ssr-overrides.ts';
import {
  SSR_TIMING_NAME,
  noteOverride,
  ssrRegistry,
  sweepActiveSsrRequests,
  type ActiveRequest,
  type SsrRenderMode,
  type SsrRequest,
} from './ssr-registry.ts';

/** How much of the HTML is kept to read the render mode from. */
export const SNIFF_BYTES = 64 * 1024;

/** Response headers kept on a traced request. */
export const KEPT_HEADERS = [
  'content-type',
  'content-length',
  'content-encoding',
  'cache-control',
  'location',
  'vary',
  'x-powered-by',
] as const;

/** True for a document request: a GET or HEAD outside `skip` that accepts HTML. */
export function wantsHtml(
  method: string | undefined,
  url: string,
  accept: string | null | undefined,
  skip: readonly string[],
): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false;
  if (skip.some((prefix) => url.startsWith(prefix))) return false;
  return /\btext\/html\b/.test(accept ?? '');
}

export function isHtmlType(contentType: string | null | undefined): boolean {
  return /\btext\/html\b/.test(contentType ?? '');
}

/**
 * What kind of answer this was. The HTML wins over the status, so a not-found
 * page that Angular rendered with status 404 still counts as Server.
 */
export function renderModeOf(html: string, status = 200): SsrRenderMode {
  const match = /<[^>]*\sng-server-context="([^"]*)"/.exec(html);
  if (match) {
    // `ssr|hydration` style lists come from older versions; Analog writes `ssr-analog`.
    const values = match[1].split('|');
    if (values.some((value) => value === 'ssr' || value.startsWith('ssr-'))) return 'server';
    if (values.includes('ssg')) return 'prerender';
    return 'unknown';
  }
  // index.csr.html: an empty custom-element root and the app's module script.
  if (
    /<[a-z]+-[\w-]*[^>]*>\s*<\/[a-z]+-[\w-]*>/i.test(html) &&
    /<script[^>]*type="module"/.test(html)
  ) {
    return 'client';
  }
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400) return 'not-rendered';
  return 'unknown';
}

/** A random id of 16 hex characters for one traced request. */
export function newSsrRequestId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export interface SsrTrace {
  id: string;
  /** When the request arrived, in ms since the epoch. */
  at: number;
  active: ActiveRequest;
}

/**
 * Starts tracing one document request, or returns undefined when the http
 * inspector is off. Server calls and router timings collect on `active` until
 * `endSsrTrace` records the request.
 */
export function beginSsrTrace(url: string, id = newSsrRequestId()): SsrTrace | undefined {
  const registry = ssrRegistry();
  if (!registry.record) return undefined;
  const at = Date.now();
  sweepActiveSsrRequests(at);
  const active: ActiveRequest = { fetches: 0, fetchMs: 0, url, startedAt: at };
  registry.active.set(id, active);
  return { id, at, active };
}

/** The `Server-Timing` entries for a render that took `renderMs`. */
export function ssrTimingEntries(trace: SsrTrace, renderMs: number): string[] {
  const { id, active } = trace;
  const timing = [
    `${SSR_TIMING_NAME};desc="${id}"`,
    `render;dur=${renderMs}`,
    `fetch;desc="${active.fetches} calls";dur=${active.fetchMs}`,
  ];
  const navs = active.navigations ?? [];
  const sum = (pick: (n: (typeof navs)[number]) => number | undefined) =>
    navs.reduce((total, n) => total + (pick(n) ?? 0), 0);
  if (navs.some((n) => n.guards?.ms !== undefined)) {
    timing.push(`guards;dur=${sum((n) => n.guards?.ms)}`);
  }
  if (navs.some((n) => n.resolvers?.ms !== undefined)) {
    timing.push(`resolve;dur=${sum((n) => n.resolvers?.ms)}`);
  }
  return timing;
}

/** Joins existing `Server-Timing` values with the trace's entries. */
export function mergeServerTiming(
  existing: readonly (string | undefined)[],
  entries: readonly string[],
): string {
  return [...existing, ...entries].filter(Boolean).join(', ');
}

/** The client-render override that matches `url`, if any. */
export function clientRenderOverride(url: string): SsrOverride | undefined {
  return matchingOverrides(ssrRegistry().overrides, url, 'client-render')[0];
}

/**
 * Notes whether a matched client-render override applied. Returns the shell
 * to serve, or undefined when there is none and the render goes ahead.
 */
export function noteClientRender(
  trace: SsrTrace,
  override: SsrOverride,
  shell: string | undefined,
  missingNote: string,
): string | undefined {
  noteOverride(trace.id, {
    id: override.id,
    kind: 'client-render',
    applied: !!shell,
    note: shell ? 'served index.csr.html instead of rendering' : missingNote,
  });
  return shell;
}

/** State-edit overrides that match `url`. */
export function stateEditsFor(url: string): SsrOverride[] {
  return matchingOverrides(ssrRegistry().overrides, url, 'state-edit');
}

/** The header that marks a response the panel changed. */
export const OVERRIDE_HEADER = 'x-pangular-override';

/**
 * Applies state-edit overrides to a held HTML body and notes each result on
 * the trace. Bytes that were not edited come back as they were, in case they
 * were not UTF-8 text.
 */
export function applyStateEdits(
  trace: SsrTrace,
  body: Uint8Array,
  list: readonly SsrOverride[],
  options: { isHtml: boolean; compressed: boolean; compressedNote: string },
): { out: Uint8Array | string; edited: boolean } {
  const { isHtml, compressed } = options;
  const html = isHtml && !compressed ? new TextDecoder().decode(body) : '';
  const hasState = isHtml && /<script\b[^>]*\sid="[^"]*-state"/.test(html);
  const edited = hasState ? editTransferState(html, list) : null;
  // Error pages and redirects carry no TransferState, so an edit there is not worth a note.
  for (const o of (isHtml && compressed) || hasState ? list : []) {
    const done = !!edited?.keys.includes(o.key ?? '');
    noteOverride(trace.id, {
      id: o.id,
      kind: 'state-edit',
      applied: done,
      note:
        isHtml && compressed
          ? options.compressedNote
          : done
            ? `${o.value === undefined ? 'removed' : 'set'} ${o.key}`
            : o.value === undefined
              ? `no entry ${o.key} to remove`
              : `could not edit the TransferState script for ${o.key}`,
    });
  }
  return edited ? { out: edited.html, edited: true } : { out: body, edited: false };
}

/** What the transport saw of the response, read when it finished or closed. */
export interface SsrOutcome {
  method: string;
  url: string;
  status: number;
  /** Arrival until the status and headers went out; 0 when they never did. */
  renderMs: number;
  bytes: number;
  /** The start of the body, up to `SNIFF_BYTES`. */
  sniff: string;
  /** Reads one response header. */
  header(name: string): string | undefined;
  /** The body was encoded before the trace saw it. */
  compressed: boolean;
  aborted: boolean;
}

/**
 * Ends the trace and records the request. Static files and API answers that
 * reached the trace are not renders, so they are dropped.
 */
export function endSsrTrace(trace: SsrTrace, outcome: SsrOutcome): void {
  const registry = ssrRegistry();
  registry.active.delete(trace.id);
  const { active } = trace;
  const isHtml = isHtmlType(outcome.header('content-type'));
  if (!outcome.aborted && !isHtml && outcome.status < 300) return;
  const compressed = isHtml && outcome.compressed;
  const headers: Record<string, string> = {};
  for (const name of KEPT_HEADERS) {
    const value = outcome.header(name);
    if (value !== undefined) headers[name] = value.slice(0, 500);
  }
  const now = Date.now();
  const request: SsrRequest = {
    id: trace.id,
    method: outcome.method,
    url: outcome.url.slice(0, 2000),
    status: outcome.status,
    at: trace.at,
    durationMs: now - trace.at,
    renderMs: outcome.renderMs || now - trace.at,
    bytes: outcome.bytes,
    // Encoded bytes are not HTML, so only the status is read then.
    renderMode: renderModeOf(isHtml && !compressed ? outcome.sniff : '', outcome.status),
    fetches: active.fetches,
    fetchMs: active.fetchMs,
    headers,
    ...(active.navigations?.length ? { navigations: active.navigations } : {}),
    ...(active.overrides?.length ? { overrides: active.overrides } : {}),
    ...(compressed ? { compressedBeforeTrace: true } : {}),
    ...(outcome.aborted ? { aborted: true } : {}),
  };
  registry.record?.(request);
}
