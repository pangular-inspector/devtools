import type { HydrationMismatch } from './http-hydration.ts';
import type { HydrationStats } from './types.ts';

export type PayloadSource = 'http' | 'analog' | 'hydration';

export interface PayloadEntry {
  key: string;
  /** Present when the entry is an HttpClient transfer-cache response. */
  http?: { url?: string; status?: number; statusText?: string; responseType?: string };
  source?: PayloadSource;
  /** Present when the entry is an Analog server function result seeded during SSR. */
  fn?: { id: string; name?: string; file?: string };
  size: number;
  value: unknown;
}

export interface PayloadSummary {
  found: boolean;
  size: number;
  entries: PayloadEntry[];
  error?: string;
}

const MAX_VALUE_CHARS = 20_000;

function clip(value: unknown): unknown {
  const text = JSON.stringify(value) ?? '';
  return text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS)}…` : value;
}

const MAX_ENTRIES = 500;
const MAX_LIST = 200;

const str = (value: unknown, max: number) =>
  typeof value === 'string' ? value.slice(0, max) : undefined;
const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const strings = (value: unknown, max: number) =>
  Array.isArray(value)
    ? value
        .slice(-MAX_LIST)
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.slice(0, max))
    : [];

/** Validates a payload summary reported over RPC and caps its size. */
export function sanitizePayload(input: unknown): PayloadSummary {
  if (!input || typeof input !== 'object') return { found: false, size: 0, entries: [] };
  const p = input as { [K in keyof PayloadSummary]?: unknown };
  const entries: PayloadEntry[] = [];
  for (const raw of Array.isArray(p.entries) ? p.entries.slice(0, MAX_ENTRIES) : []) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as { [K in keyof PayloadEntry]?: unknown };
    const key = str(e.key, 500);
    if (key === undefined) continue;
    const h = e.http && typeof e.http === 'object' ? (e.http as Record<string, unknown>) : null;
    const source =
      e.source === 'http' || e.source === 'analog' || e.source === 'hydration'
        ? e.source
        : undefined;
    const f = e.fn && typeof e.fn === 'object' ? (e.fn as Record<string, unknown>) : null;
    const fnId = str(f?.['id'], 16);
    entries.push({
      key,
      size: num(e.size) ?? 0,
      value: clip(e.value),
      ...(source && { source }),
      ...(fnId && /^[0-9a-f]{16}$/.test(fnId) && { fn: { id: fnId } }),
      ...(h && {
        http: {
          url: str(h['url'], 2000),
          status: num(h['status']),
          statusText: str(h['statusText'], 200),
          responseType: str(h['responseType'], 20),
        },
      }),
    });
  }
  return {
    found: p.found === true,
    size: num(p.size) ?? 0,
    entries,
    error: str(p.error, 500),
  };
}

/** Validates hydration stats reported over RPC; returns null when malformed. */
export function sanitizeHydration(input: unknown): HydrationStats | null {
  if (!input || typeof input !== 'object') return null;
  const h = input as { [K in keyof HydrationStats]?: unknown };
  if (typeof h.enabled !== 'boolean') return null;
  const n =
    h.nodes && typeof h.nodes === 'object' ? (h.nodes as Record<string, unknown>) : undefined;
  const mismatches: HydrationMismatch[] = [];
  for (const raw of Array.isArray(h.mismatches) ? h.mismatches.slice(0, 20) : []) {
    if (!raw || typeof raw !== 'object') continue;
    const m = raw as Record<string, unknown>;
    const component = str(m['component'], 200);
    if (!component) continue;
    mismatches.push({
      component,
      expected: str(m['expected'], 500),
      actual: str(m['actual'], 500),
    });
  }
  return {
    enabled: h.enabled,
    hydratedComponents: num(h.hydratedComponents),
    hydratedNodes: num(h.hydratedNodes),
    componentsSkippedHydration: num(h.componentsSkippedHydration),
    deferBlocksWithIncrementalHydration: num(h.deferBlocksWithIncrementalHydration),
    ...(n && {
      nodes: {
        hydrated: num(n['hydrated']) ?? 0,
        skipped: num(n['skipped']) ?? 0,
        mismatched: num(n['mismatched']) ?? 0,
      },
    }),
    mismatches,
    skipHydrationHosts: strings(h.skipHydrationHosts, 200),
    warnings: strings(h.warnings, 1000),
    warningsCaptured: h.warningsCaptured === true,
  };
}

const HYDRATION_KEYS = new Set(['__nghData__', '__nghDeferData__']);
const SERVER_FN_KEY = /^__analog_fn_([0-9a-f]{16})_/;

/** Reads the TransferState script (`<script id="{appId}-state">`) that SSR embeds. */
export function decodePayload(doc: Document, appId = 'ng'): PayloadSummary {
  const script =
    doc.getElementById(`${appId}-state`) ??
    doc.querySelector<HTMLScriptElement>('script[id$="-state"][type="application/json"]');
  const text = script?.textContent ?? '';
  if (!script) return { found: false, size: 0, entries: [] };
  let data: unknown;
  try {
    data = JSON.parse(text || '{}');
  } catch (error) {
    return { found: true, size: text.length, entries: [], error: String(error) };
  }
  if (!data || typeof data !== 'object') return { found: true, size: text.length, entries: [] };
  const entries = Object.entries(data as Record<string, unknown>).map(([key, raw]) => {
    const entry: PayloadEntry = { key, size: JSON.stringify(raw)?.length ?? 0, value: raw };
    const fnId = key.match(SERVER_FN_KEY)?.[1];
    if (HYDRATION_KEYS.has(key)) {
      entry.source = 'hydration';
    } else if (fnId) {
      entry.source = 'analog';
      entry.fn = { id: fnId };
    } else if (
      key.startsWith('analog_') &&
      raw &&
      typeof raw === 'object' &&
      'body' in raw &&
      ('status' in raw || 'url' in raw)
    ) {
      const r = raw as { body: unknown; status?: number; statusText?: string; url?: string };
      entry.http = { url: r.url, status: r.status, statusText: r.statusText };
      entry.source = 'analog';
      entry.value = r.body;
    } else if (raw && typeof raw === 'object' && 'b' in raw && ('s' in raw || 'u' in raw)) {
      const r = raw as { b: unknown; s?: number; st?: string; u?: string; rt?: string };
      entry.http = { url: r.u, status: r.s, statusText: r.st, responseType: r.rt };
      entry.source = 'http';
      entry.value = r.b;
    }
    entry.value = clip(entry.value);
    return entry;
  });
  return { found: true, size: text.length, entries };
}
