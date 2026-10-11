// How Capacitor plugin arguments and results are masked. The page runs this
// when it logs a call, and the server runs it again with its own
// `redaction` config, so a call logged before the page knew that config (or by
// a page without it) is masked the same way.
import { REDACTED } from './forms-privacy.ts';
import { redactPreview } from './http-redact.ts';
import { redactUrl } from './router.ts';
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

/** A call's arguments, masked. */
export function maskedArgs(plugin: string, args: unknown, limits: SerializeLimits): unknown {
  return maskedValue(withUrlMasked(plugin, withValueMasked(args, hasSecretKey(args))), limits);
}

/** A call's result, masked. `secretKey` says whether its arguments had a secret `key`. */
export function maskedResult(
  plugin: string,
  secretKey: boolean,
  result: unknown,
  limits: SerializeLimits,
): unknown {
  return maskedValue(withUrlMasked(plugin, withValueMasked(result, secretKey)), limits);
}
