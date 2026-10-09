import { isRedactedKey } from './forms-privacy.ts';
import type { HttpCall } from './http-rules.ts';
import { redactText, redactUrl } from './router.ts';
import { serialize } from './serialize.ts';
import { clip } from './text.ts';

const PREVIEW_MAX = 2001;
const JSON_PAIR = /("((?:[^"\\]|\\.){1,100})"\s*:\s*)("(?:[^"\\]|\\.)*"?|[^,}\]\s]*)/g;

export function redactStrings(value: unknown): unknown {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redactStrings);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactStrings(item)]));
}

function decodeKey(key: string): string {
  try {
    return JSON.parse(`"${key}"`) as string;
  } catch {
    return key;
  }
}

/**
 * Hides secrets in a recorded body preview. A complete JSON preview is walked
 * by key and value; a clipped one falls back to masking `"key": value` pairs
 * and token-shaped text.
 */
export function redactPreview(preview: string): string {
  try {
    const parsed: unknown = JSON.parse(preview);
    if (parsed !== null && typeof parsed === 'object') {
      const safe = serialize(parsed, {
        depth: 8,
        keys: 100,
        items: 100,
        text: PREVIEW_MAX,
        budget: 5000,
      });
      return clip(JSON.stringify(redactStrings(safe)) ?? '', PREVIEW_MAX);
    }
  } catch {
    /* clipped or not JSON: fall through to text masking */
  }
  const masked = preview.replace(JSON_PAIR, (match, head: string, key: string) =>
    isRedactedKey(decodeKey(key)) ? `${head}"[redacted]"` : match,
  );
  return clip(redactText(masked), PREVIEW_MAX);
}

/**
 * Hides secret query values, tokens and `redaction.secretNames` in a call's
 * URLs, error and response preview, the same way the router redacts its URLs.
 */
export function redactCall(call: HttpCall): HttpCall {
  return {
    ...call,
    url: redactUrl(call.url),
    ...(call.pageUrl === undefined ? {} : { pageUrl: redactUrl(call.pageUrl) }),
    ...(call.error === undefined ? {} : { error: clip(redactText(call.error), 500) }),
    ...(call.preview === undefined ? {} : { preview: redactPreview(call.preview) }),
  };
}
