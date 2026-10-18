import { REDACTED, isRedactedKey } from './forms-privacy.ts';
import { MAX_HEADERS, MAX_HEADER_VALUE, type HeaderRecord } from './http-headers.ts';
import type { HttpCall } from './http-rules.ts';
import { redactJsonText } from './json-text-redact.ts';
import { redactText, redactUrl } from './router.ts';
import { serialize } from './serialize.ts';
import { clip } from './text.ts';

const PREVIEW_MAX = 2001;

/** Headers whose value is always hidden, whatever `redaction.unmask` says. */
const ALWAYS_MASKED = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  // Azure API Management's key header.
  'ocp-apim-subscription-key',
]);

export function redactStrings(value: unknown): unknown {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redactStrings);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactStrings(item)]));
}

/**
 * An XML or HTML element and its text (or CDATA) content, up to its closing
 * tag or the end of a clipped preview. Group 2 is the local name, without a
 * namespace prefix.
 */
const XML_ELEMENT =
  /<((?:[\w.-]+:)?([\w.-]+))(\s[^<>]*)?>(<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|[^<]*)(?=<\/\1\s*>|$)/g;

/** Masks the content of elements with secret names: `<password>…</password>`. */
export function redactXmlText(text: string): string {
  if (!text.includes('<')) return text;
  return text.replace(XML_ELEMENT, (match, tag: string, local: string, attrs = '', content) =>
    content && isRedactedKey(local) ? `<${tag}${attrs}>${REDACTED}` : match,
  );
}

/**
 * Hides secrets in a recorded body preview. A complete JSON preview is walked
 * by key and value; a clipped or other one (XML, form data, text) falls back
 * to masking `"key": value` pairs, elements with secret names and
 * token-shaped text. Attributes such as `password="…"` are pairs too.
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
  return clip(redactText(redactXmlText(redactJsonText(preview, isRedactedKey))), PREVIEW_MAX);
}

/**
 * Masks header values before they leave the page or reach an agent:
 * `Authorization`, `Proxy-Authorization`, `Cookie` and `Set-Cookie` always,
 * names that look secret or match `redaction.secretNames`, and JWTs, bearer
 * tokens and credentials inside any other value.
 */
export function redactHeaders(headers: HeaderRecord): HeaderRecord {
  const out: HeaderRecord = {};
  for (const [rawName, value] of Object.entries(headers).slice(0, MAX_HEADERS)) {
    const name = rawName.toLowerCase();
    if (typeof value !== 'string') continue;
    out[name] =
      ALWAYS_MASKED.has(name) || isRedactedKey(name)
        ? REDACTED
        : clip(redactText(value), MAX_HEADER_VALUE);
  }
  return out;
}

/**
 * Hides secret query values, tokens and `redaction.secretNames` in a call's
 * URLs, error, response preview and headers, the same way the router redacts its URLs.
 */
export function redactCall(call: HttpCall): HttpCall {
  return {
    ...call,
    url: redactUrl(call.url),
    ...(call.pageUrl === undefined ? {} : { pageUrl: redactUrl(call.pageUrl) }),
    ...(call.redirectedTo === undefined ? {} : { redirectedTo: redactUrl(call.redirectedTo) }),
    ...(call.rulePattern === undefined ? {} : { rulePattern: redactUrl(call.rulePattern) }),
    ...(call.error === undefined ? {} : { error: clip(redactText(call.error), 500) }),
    ...(call.preview === undefined ? {} : { preview: redactPreview(call.preview) }),
    ...(call.requestHeaders ? { requestHeaders: redactHeaders(call.requestHeaders) } : {}),
    ...(call.responseHeaders ? { responseHeaders: redactHeaders(call.responseHeaders) } : {}),
  };
}
