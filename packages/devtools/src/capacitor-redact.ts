// How Capacitor plugin arguments and results are masked. The page runs this
// when it logs a call, and the server runs it again with its own
// `redaction` config, so a call logged before the page knew that config (or by
// a page without it) is masked the same way.
import { REDACTED, redactReason } from './forms-privacy.ts';
import { redactPreview } from './http-redact.ts';
import { redactText, redactUrl } from './router.ts';
import { isSecretName, serialize, type SerializeLimits } from './serialize.ts';
import { clip } from './text.ts';

// Strings are masked before they are cut: a JSON or form body cut short no
// longer parses, and its secrets would slip through.
const WIDE_TEXT = 4000;

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function maskStrings(value: unknown, text: number, depth = 0): unknown {
  if (typeof value === 'string') return clip(redactPreview(value), text);
  if (depth > 12 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => maskStrings(item, text, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, maskStrings(item, text, depth + 1)]),
  );
}

/** `serialize()`, then every string masked like an HTTP body: JSON, form fields and tokens. */
export function maskedValue(value: unknown, limits: SerializeLimits): unknown {
  const text = limits.text ?? 500;
  return maskStrings(serialize(value, { ...limits, text: WIDE_TEXT }), text);
}

/**
 * `{key: 'authToken', value}`, as Preferences and secure storage plugins take
 * it. Only this shape is recognised: the key has to be in a field named `key`.
 */
export function hasSecretKey(args: unknown): boolean {
  return isObject(args) && typeof args['key'] === 'string' && isSecretName(args['key']);
}

function withValueMasked(value: unknown, secretKey: boolean): unknown {
  return secretKey && isObject(value) && 'value' in value ? { ...value, value: REDACTED } : value;
}

function withUrlMasked(plugin: string, value: unknown): unknown {
  return plugin === 'CapacitorHttp' && isObject(value) && typeof value['url'] === 'string'
    ? { ...value, url: redactUrl(value['url']) }
    : value;
}

// CORS headers hold origins, methods and `true`, never a secret, but a name
// such as `Access-Control-Allow-Credentials` reads like one.
const PLAIN_HEADER = /^access-control-/i;
// CORS values are short. A longer one is cut, so kept values stay small.
const PLAIN_HEADER_TEXT = 200;

/**
 * Masks a CapacitorHttp request or response, keeping the values of its CORS
 * headers. The headers go through `maskedValue` with the rest, so its key and
 * size limits decide which ones are kept; only the values of CORS headers that
 * made it through are put back. Other plugins' values are masked as they are.
 */
function maskedCall(plugin: string, value: unknown, limits: SerializeLimits): unknown {
  const masked = maskedValue(value, limits);
  if (plugin !== 'CapacitorHttp' || !isObject(value) || !isObject(value['headers'])) {
    return masked;
  }
  if (!isObject(masked) || !isObject(masked['headers'])) return masked;
  const headers = masked['headers'];
  const text = Math.min(limits.text ?? 500, PLAIN_HEADER_TEXT);
  for (const [name, item] of Object.entries(value['headers'])) {
    if (!(name in headers) || typeof item !== 'string') continue;
    if (!PLAIN_HEADER.test(name) || redactReason(name) === 'config') continue;
    headers[name] = clip(redactText(item), text);
  }
  return masked;
}

/** A call's arguments, masked. */
export function maskedArgs(plugin: string, args: unknown, limits: SerializeLimits): unknown {
  return maskedCall(
    plugin,
    withUrlMasked(plugin, withValueMasked(args, hasSecretKey(args))),
    limits,
  );
}

/** A call's result, masked. `secretKey` says whether its arguments had a secret `key`. */
export function maskedResult(
  plugin: string,
  secretKey: boolean,
  result: unknown,
  limits: SerializeLimits,
): unknown {
  return maskedCall(plugin, withUrlMasked(plugin, withValueMasked(result, secretKey)), limits);
}
