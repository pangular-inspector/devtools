import { redactCredentials } from './credential-redact.ts';
import { JWT, REDACTED, isRedactedKey } from './forms-privacy.ts';

/**
 * Masking for free text and URLs, shared by `serialize`, the router collector
 * and the HTTP and NgRx paths: `key=value` pairs under secret keys, credentials
 * in text, JWTs, bearer tokens and the secret values seen so far this session.
 */

const URL_SECRET_KEY =
  /^(code|key|sig|signature|session|session_?id|sid|auth|authorization|jwt|credentials?|x-amz-(signature|credential|security-token)|x-goog-(signature|credential))$/i;
const BEARER = /Bearer\s+[\w.~+/-]+=*/gi;
const LONG_TOKEN = /(?<=[/=])[A-Za-z0-9_-]{32,}(?=[/?#&;]|$)/g;
const UUID_OR_ULID =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9A-HJKMNP-TV-Z]{26})$/i;
// The `=` can arrive percent-encoded (`#access_token%3D…`), so the first `%3D` ends a key too.
const TEXT_PAIR = /(^|[?&#;])((?:(?!%3D)[^=&#;?\s"'/])+)(=|%3D)([^&#;\s"']*)/gi;
const URL_PAIR = /(^|[?&#;])((?:(?!%3D)[^=&#;?\s/])+)(=|%3D)([^&#;\s]*)/gi;
const MAX_KNOWN_SECRETS = 100;

/** Secret values seen this session, such as secret route params, newest last. */
export const knownSecrets = new Set<string>();

export function rememberSecret(secret: string) {
  knownSecrets.delete(secret);
  knownSecrets.add(secret);
  if (knownSecrets.size > MAX_KNOWN_SECRETS) {
    knownSecrets.delete(knownSecrets.values().next().value!);
  }
}

function isOpaqueToken(token: string): boolean {
  if (UUID_OR_ULID.test(token)) return false;
  if (/^[0-9a-f]{32,}$/i.test(token)) return true;
  return (
    /\d/.test(token) &&
    /[a-z]/.test(token) &&
    /[A-Z]/.test(token) &&
    (token.match(/-/g) ?? []).length <= 2
  );
}

export function isSecretKey(key: string): boolean {
  return isRedactedKey(key) || URL_SECRET_KEY.test(key);
}

export function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function segmentForm(secret: string): string {
  return encodeURIComponent(secret)
    .replace(/%40/g, '@')
    .replace(/%3A/gi, ':')
    .replace(/%24/g, '$')
    .replace(/%2C/gi, ',')
    .replace(/%26/gi, '&')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

/**
 * Hides the values of secret-looking query, matrix and fragment keys
 * (`?token=…`, `;api_key=…`, `#access_token=…`), URL passwords, `Authorization`
 * credentials (`Basic`, `Digest`, `Token`), JWTs and bearer tokens, and
 * any of the given secret route param values, wherever they appear in a URL or
 * a message. In `url` mode a value runs to the next separator and long opaque
 * tokens (not UUIDs or ULIDs) are hidden too; in messages it also stops at quotes.
 */
export function redactText(
  text: string,
  secrets: Iterable<string> = [],
  mode: 'url' | 'text' = 'text',
  depth = 0,
): string {
  let out = redactCredentials(text, REDACTED).replace(
    mode === 'url' ? URL_PAIR : TEXT_PAIR,
    (match, sep: string, key: string, eq: string, value: string) => {
      if (isSecretKey(decode(key))) return `${sep}${key}${eq}${REDACTED}`;
      const decoded = decode(value);
      if (depth > 1 || decoded === value || !decoded.includes('=')) return match;
      const inner = redactText(decoded, secrets, mode, depth + 1);
      return inner === decoded ? match : `${sep}${key}${eq}${encodeURIComponent(inner)}`;
    },
  );
  out = out.replace(JWT, REDACTED).replace(BEARER, `Bearer ${REDACTED}`);
  if (mode === 'url') {
    out = out.replace(LONG_TOKEN, (token) => (isOpaqueToken(token) ? REDACTED : token));
  }
  for (const secret of secrets) {
    if (secret.length < 3) continue;
    for (const form of new Set([secret, encodeURIComponent(secret), segmentForm(secret)])) {
      out = out.split(form).join(REDACTED);
    }
  }
  return out;
}
