/**
 * The redaction helpers for recorded HTTP calls, JSON text and Analog page
 * reports, in one place: `redactJsonText` masks `"key": value` pairs in JSON
 * that may be clipped, `redactPreview`, `redactHeaders` and `redactCall` mask
 * what the HTTP inspector records, and `redactAnalogReport` masks an Analog
 * page report. They build on the shared text masking (`text-redact.ts`, via
 * `redactText` and `redactUrl`), the secret key rules (`forms-privacy.ts`) and
 * `serialize`, so `redaction.secretNames`, JWTs and bearer tokens are masked
 * the same way everywhere. `countRedacted` and `countRedactedText` count the
 * masks they left, for the counts the panel and agent answers show.
 */
import type { AnalogRuntimeReport } from './analog-runtime.ts';
import { redactCredentials } from './credential-redact.ts';
import { redactHighEntropy } from './entropy-redact.ts';
import { REDACTED, isRedactedKey, redactJwt } from './forms-privacy.ts';
import { MAX_HEADERS, MAX_HEADER_VALUE, type HeaderRecord } from './http-headers.ts';
import type { HttpCall } from './http-rules.ts';
import { redactText, redactUrl } from './router.ts';
import { serialize } from './serialize.ts';
import { clip } from './text.ts';

export { countRedacted, countRedactedText, redactionNote } from './redaction-count.ts';

// Messages and log lines

const BEARER = /\bBearer\s+[\w.~+/=-]+/gi;

export function redactMessage(text: string, secrets: Iterable<string> = []): string {
  return redactMessageWith(text, longestFirst(secrets));
}

/**
 * Credentials inside text (`credential-redact.ts`), JWTs and bearer tokens:
 * the value-shape rules every message and log line goes through.
 */
export function redactTokens(text: string): string {
  return redactJwt(redactCredentials(text, REDACTED)).replace(BEARER, `Bearer ${REDACTED}`);
}

/** `secrets` as `redactMessageWith` takes them: 3 characters or more, longest first. */
export function longestFirst(secrets: Iterable<string>): string[] {
  const out = [...secrets].filter((secret) => secret.length >= 3);
  out.sort((a, b) => b.length - a.length);
  return out;
}

/** `redactMessage` with secrets `longestFirst` already prepared, for many texts in a row. */
export function redactMessageWith(text: string, ordered: readonly string[]): string {
  let out = redactTokens(text);
  for (const secret of ordered) out = out.split(secret).join(REDACTED);
  return redactHighEntropy(out, REDACTED);
}

// JSON text

function stringEnd(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') i++;
    else if (text[i] === '"') return i + 1;
  }
  return text.length;
}

function valueEnd(text: string, start: number): number {
  const first = text[start];
  if (first === '"') return stringEnd(text, start);
  if (first !== '{' && first !== '[') {
    const stop = text.slice(start).search(/[,}\]]/);
    return stop < 0 ? text.length : start + stop;
  }
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') i = stringEnd(text, i) - 1;
    else if (ch === '{' || ch === '[') depth++;
    else if ((ch === '}' || ch === ']') && --depth === 0) return i + 1;
  }
  return text.length;
}

export function redactJsonText(text: string, isSecret: (key: string) => boolean): string {
  const colon = /\s*:\s*/y;
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '"') {
      out += text[i++];
      continue;
    }
    const end = stringEnd(text, i);
    const token = text.slice(i, end);
    out += token;
    i = end;
    colon.lastIndex = i;
    const sep = colon.exec(text);
    if (!sep) continue;
    let key: string;
    try {
      key = String(JSON.parse(token));
    } catch {
      key = token.slice(1, -1);
    }
    if (!isSecret(key)) continue;
    out += `${sep[0]}${JSON.stringify(REDACTED)}`;
    i = valueEnd(text, i + sep[0].length);
  }
  return out;
}

// HTTP calls

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
      // The name as sent too, since lowercasing loses camelCase words (`newPassword`).
      ALWAYS_MASKED.has(name) || isRedactedKey(name) || isRedactedKey(rawName)
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

// Analog page reports

/** Longest URL, `load()` preview and file path kept from a page report. */
const MAX_URL = 2000;
const MAX_PREVIEW = 1001;
const MAX_PATH = 500;
const MAX_ERROR = 300;

/** A JWT cut before its signature, which the JWT pattern no longer matches. */
const PARTIAL_JWT = /eyJ[\w-]*(?:\.[\w-]*)?$/;

/**
 * Clips `value` to twice `max` before redacting it, so an oversized field
 * costs little to redact, and to `max` after. A JWT that the first cut splits
 * is dropped, so its header and claims cannot slip past the redaction.
 */
function capped(value: string, max: number, redact: (text: string) => string = (t) => t) {
  const head =
    value.length > max * 2 ? `${value.slice(0, max * 2).replace(PARTIAL_JWT, '')}…` : value;
  return clip(redact(head), max);
}

/**
 * Hides secret query values, JWTs, bearer tokens and `redaction.secretNames`
 * in the text fields of a page report before it is stored or served, and
 * clips each text field.
 */
export function redactAnalogReport(report: AnalogRuntimeReport): AnalogRuntimeReport {
  const path = (value: string) => capped(value, MAX_PATH);
  return {
    ...report,
    url: capped(report.url, MAX_URL, redactUrl),
    chain: report.chain.map((item) => ({
      ...item,
      path: path(item.path),
      ...(item.file !== undefined && { file: path(item.file) }),
      ...(item.serverFile !== undefined && { serverFile: path(item.serverFile) }),
    })),
    ...(report.load && {
      load: {
        ...report.load,
        preview: capped(report.load.preview, MAX_PREVIEW, redactPreview),
        keys: report.load.keys.map((key) => capped(key, MAX_PATH, redactUrl)),
      },
    }),
    hydrationErrors: report.hydrationErrors.map((error) => capped(error, MAX_ERROR, redactText)),
    configPaths: report.configPaths.map(path),
  };
}
