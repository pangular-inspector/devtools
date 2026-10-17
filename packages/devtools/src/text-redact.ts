import { redactCredentials } from './credential-redact.ts';
import { JWT, REDACTED, isRedactedKey, wordsOf } from './forms-privacy.ts';

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
// In text a key starts anywhere a word does (after a space, `:`, `(`, `,`, a quote,
// `?&#;` or the start), may be quoted (`"token":"…"`), and is followed by `=` or `:`.
const TEXT_PAIR =
  /(?<![\w$%.[\]-])(["']?)((?:(?!%3D)[\w$%.[\]-])+)\1(\s*(?:=|%3D)\s*|\s*:\s*)("[^"]*"|'[^']*'|[^&#;\s"',)}\]<>]*)/gi;
/** Values a `key: value` text pair keeps, so `token: null` in a log stays readable. */
const PLAIN_VALUE = /^(?:null|undefined|true|false|)$/;
/**
 * Names that hold a secret and rarely start prose, so `password: correcthorse`
 * is masked although its value is one lowercase word. Weaker names (`token`,
 * `key`, `auth`) keep such a word, as in `Invalid token: expired`.
 */
const STRONG_WORDS = new Set([
  'password',
  'passwd',
  'passphrase',
  'passcode',
  'pwd',
  'secret',
  'privkey',
]);
const STRONG_PAIRS = new Set(['apikey', 'privatekey', 'secretkey', 'accesskey']);
const URL_PAIR = /(^|[?&#;])((?:(?!%3D)[^=&#;?\s/])+)(=|%3D)([^&#;\s]*)/gi;
const MAX_KNOWN_SECRETS = 100;

/** Secret values seen this session, such as secret route params, newest last. */
export const knownSecrets = new Set<string>();

let knownVersion = 0;

/** Changes whenever `knownSecrets` does, so texts masked with the old set are not reused. */
export function knownSecretsVersion(): string {
  return `${knownVersion}:${knownSecrets.size}`;
}

export function rememberSecret(secret: string) {
  knownVersion++;
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

function isStrongSecretKey(key: string): boolean {
  const words = wordsOf(key);
  return words.some(
    (word, i) =>
      STRONG_WORDS.has(word) ||
      STRONG_WORDS.has(word.replace(/s$/, '')) ||
      (i > 0 && STRONG_PAIRS.has(words[i - 1] + word.replace(/s$/, ''))),
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

/** Redacts a percent-encoded value that is itself a query (`?next=%2Fcb%3Ftoken%3D…`). */
function nested(
  match: string,
  head: string,
  value: string,
  secrets: Iterable<string>,
  mode: 'url' | 'text',
  depth: number,
): string {
  const decoded = decode(value);
  if (depth > 1 || decoded === value || !decoded.includes('=')) return match;
  const inner = redactText(decoded, secrets, mode, depth + 1);
  return inner === decoded ? match : `${head}${encodeURIComponent(inner)}`;
}

/**
 * Hides the values of secret-looking query, matrix and fragment keys
 * (`?token=…`, `;api_key=…`, `#access_token=…`), URL passwords, `Authorization`
 * credentials (`Basic`, `Digest`, `Token`), JWTs and bearer tokens, and
 * any of the given secret route param values, wherever they appear in a URL or
 * a message. In `url` mode a value runs to the next separator and long opaque
 * tokens (not UUIDs or ULIDs) are hidden too. In messages a pair starts at any
 * word (`retry with token=abc`), may use `:` (`password: hunter2`) or JSON-ish
 * quotes (`"token":"abc"`), and a value stops at quotes, spaces and `,)}]`;
 * `key: value` only counts for the secret names, so `Invalid key: x` stays.
 */
export function redactText(
  text: string,
  secrets: Iterable<string> = [],
  mode: 'url' | 'text' = 'text',
  depth = 0,
): string {
  let out = redactCredentials(text, REDACTED);
  if (mode === 'url') {
    out = out.replace(URL_PAIR, (match, sep: string, key: string, eq: string, value: string) => {
      if (isSecretKey(decode(key))) return `${sep}${key}${eq}${REDACTED}`;
      return nested(match, `${sep}${key}${eq}`, value, secrets, mode, depth);
    });
    out = out.replace(JWT, REDACTED).replace(BEARER, `Bearer ${REDACTED}`);
    out = out.replace(LONG_TOKEN, (token) => (isOpaqueToken(token) ? REDACTED : token));
  } else {
    // Bearer tokens and JWTs first, so `token: Bearer abc` can't keep `abc` once `Bearer` is hidden.
    out = out.replace(JWT, REDACTED).replace(BEARER, `Bearer ${REDACTED}`);
    const pair = (
      match: string,
      quote: string,
      key: string,
      eq: string,
      value: string,
      at: number,
      whole: string,
    ) => {
      const quoted = /^(["'])[\s\S]*\1$/.test(value);
      const bare = quoted ? value.slice(1, -1) : value;
      if (!bare || bare.startsWith(REDACTED.slice(0, -1))) return match;
      const head = `${quote}${key}${quote}${eq}`;
      const colon = eq.trim() === ':';
      // `:` reads as prose more often than `=`, so it takes only the secret names, not `key`
      // or `code`, and an unquoted lowercase word after a weak name (`token: expired`) or a
      // scheme whose credential is already hidden (`Authorization: Negotiate [redacted]`)
      // stays. After a strong name (`password: correcthorse`) the word is masked.
      const secret = colon ? isRedactedKey(decode(key)) : isSecretKey(decode(key));
      const prose =
        colon &&
        (PLAIN_VALUE.test(bare) ||
          (!quote && !quoted && /^[a-z]+$/.test(bare) && !isStrongSecretKey(decode(key))) ||
          whole.startsWith(` ${REDACTED}`, at + match.length));
      if (secret) {
        if (prose) return match;
        return bare === value ? `${head}${REDACTED}` : `${head}${value[0]}${REDACTED}${value[0]}`;
      }
      // A value can carry the next pair (`Error:password=…`), so it is read on its own.
      if (depth < 2 && /[=:]/.test(value)) {
        const inner = redactText(value, secrets, mode, depth + 1);
        if (inner !== value) return `${head}${inner}`;
      }
      return colon ? match : nested(match, head, value, secrets, mode, depth);
    };
    out = out.replace(TEXT_PAIR, pair);
  }
  for (const secret of secrets) {
    if (secret.length < 3) continue;
    for (const form of new Set([secret, encodeURIComponent(secret), segmentForm(secret)])) {
      out = out.split(form).join(REDACTED);
    }
  }
  return out;
}
