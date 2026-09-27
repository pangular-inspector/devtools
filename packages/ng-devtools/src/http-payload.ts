export interface PayloadEntry {
  key: string;
  /** Present when the entry is an HttpClient transfer-cache response. */
  http?: { url?: string; status?: number; statusText?: string; responseType?: string };
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
    if (raw && typeof raw === 'object' && 'b' in raw && ('s' in raw || 'u' in raw)) {
      const r = raw as { b: unknown; s?: number; st?: string; u?: string; rt?: string };
      entry.http = { url: r.u, status: r.s, statusText: r.st, responseType: r.rt };
      entry.value = r.b;
    }
    entry.value = clip(entry.value);
    return entry;
  });
  return { found: true, size: text.length, entries };
}
