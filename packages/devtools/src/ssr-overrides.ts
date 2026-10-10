export const SSR_OVERRIDE_KINDS = ['render-error', 'client-render', 'state-edit'] as const;
export type SsrOverrideKind = (typeof SSR_OVERRIDE_KINDS)[number];

export interface SsrOverride {
  id: string;
  kind: SsrOverrideKind;
  /** Substring of the page path and query, or a glob where `*` matches anything. */
  pattern: string;
  enabled: boolean;
  /** render-error: the message the render throws. */
  message?: string;
  /** state-edit: the TransferState key to change. */
  key?: string;
  /** state-edit: JSON text for the new value; leave it out to remove the entry. */
  value?: string;
}

export const MAX_SSR_OVERRIDES = 20;
const MAX_VALUE = 100_000;

const str = (value: unknown, max: number) =>
  typeof value === 'string' ? value.slice(0, max) : undefined;

/** Validates overrides coming over RPC; drops anything malformed. */
export function sanitizeSsrOverrides(input: unknown): SsrOverride[] {
  if (!Array.isArray(input)) return [];
  const out: SsrOverride[] = [];
  for (const raw of input.slice(0, MAX_SSR_OVERRIDES)) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as { [K in keyof SsrOverride]?: unknown };
    const kind = SSR_OVERRIDE_KINDS.find((k) => k === o.kind);
    const pattern = str(o.pattern, 500)?.trim();
    if (!kind || !pattern) continue;
    const base = {
      id: str(o.id, 40) || `o${out.length + 1}`,
      kind,
      pattern,
      enabled: o.enabled !== false,
    };
    if (kind === 'render-error') {
      out.push({ ...base, message: str(o.message, 300)?.trim() || 'Simulated render error' });
    } else if (kind === 'state-edit') {
      const key = str(o.key, 200)?.trim();
      if (!key) continue;
      const value = str(o.value, MAX_VALUE)?.trim();
      if (value !== undefined && value !== '') {
        try {
          JSON.parse(value);
        } catch {
          continue;
        }
      }
      out.push({ ...base, key, ...(value ? { value } : {}) });
    } else {
      out.push(base);
    }
  }
  return out;
}

function globMatch(text: string, pattern: string): boolean {
  let at = 0;
  for (const part of pattern.split('*')) {
    if (!part) continue;
    const found = text.indexOf(part, at);
    if (found < 0) return false;
    at = found + part.length;
  }
  return true;
}

export function matchingOverrides(
  overrides: readonly SsrOverride[] | undefined,
  url: string,
  kind: SsrOverrideKind,
): SsrOverride[] {
  return (overrides ?? []).filter((o) => o.enabled && o.kind === kind && globMatch(url, o.pattern));
}

/** Escapes the JSON the way Angular writes the TransferState script, so it can't close the tag. */
function escapeState(json: string): string {
  return json.replace(/</g, '\\u003C').replace(/\//g, '\\u002F');
}

/**
 * Applies state-edit overrides to the `{appId}-state` script in server HTML.
 * Returns the new HTML and the keys it changed, or null when nothing applied.
 */
export function editTransferState(
  html: string,
  edits: readonly SsrOverride[],
): { html: string; keys: string[] } | null {
  if (!edits.length) return null;
  // Angular writes `<script id="{appId}-state" type="application/json">`; attribute order can vary.
  const script =
    /(<script\b(?=[^>]*\bid="[^"]*-state")(?=[^>]*type="application\/json")[^>]*>)([\s\S]*?)(<\/script>)/.exec(
      html,
    );
  if (!script) return null;
  const [, open, body, close] = script;
  let state: Record<string, unknown>;
  try {
    state = JSON.parse(body || '{}') as Record<string, unknown>;
  } catch {
    return null;
  }
  const keys: string[] = [];
  for (const edit of edits) {
    if (!edit.key) continue;
    if (edit.value === undefined) {
      if (!Object.hasOwn(state, edit.key)) continue;
      delete state[edit.key];
    } else {
      state[edit.key] = JSON.parse(edit.value);
    }
    keys.push(edit.key);
  }
  if (!keys.length) return null;
  const replaced = `${open}${escapeState(JSON.stringify(state))}${close}`;
  return {
    html: html.slice(0, script.index) + replaced + html.slice(script.index + script[0].length),
    keys,
  };
}
