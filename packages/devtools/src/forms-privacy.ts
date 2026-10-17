import { redactCredentials } from './credential-redact.ts';
import { RedactionScope } from './redaction-scope.ts';

export const REDACTED = '[redacted]';

export type RedactReason = 'key' | 'input-type' | 'autocomplete' | 'marker' | 'parent' | 'config';

export const REDACT_LABELS: Record<RedactReason, string> = {
  key: 'name looks secret',
  'input-type': 'password input',
  autocomplete: 'autocomplete is a secret kind',
  marker: 'marked as mask',
  parent: 'inside a secret group',
  config: 'listed in mask',
};

/** How to let DevTools write a field redacted for `reason`; `key` is the name that matched. */
export function unmaskHint(reason: RedactReason, key: string): string {
  const byKey = `add "${key}" to unmask on window.__PANGULAR_FORMS__ or to redaction.unmask`;
  return reason === 'key' || reason === 'parent' || reason === 'config'
    ? byKey
    : `add data-pangular="unmask" to the field, or ${byKey}`;
}

const SECRET_WORDS = new Set([
  'password',
  'passwd',
  'passphrase',
  'passcode',
  'pass',
  'pwd',
  'secret',
  'token',
  'otp',
  'totp',
  'pin',
  'cvv',
  'cvc',
  'csc',
  'ssn',
  'iban',
  'credential',
  'credentials',
  'cookie',
  'authorization',
  'jwt',
  'signature',
  'sig',
  'salt',
  'nonce',
  'privkey',
  'dsn',
  'sid',
]);

const SECRET_PAIRS = new Set([
  'apikey',
  'privatekey',
  'secretkey',
  'accesskey',
  'ccnum',
  'ccnumber',
  'ccexp',
  'cccvc',
  'cccvv',
  'cardnum',
  'cardnumber',
  'cardno',
  'cardcvc',
  'cardcvv',
  'cardexp',
  'cardexpiry',
  'cardpin',
  'creditcard',
  'debitcard',
  'mfacode',
  'recoverycode',
  'recoverykey',
  'securitycode',
  'sessionid',
  'sessionkey',
  'authheader',
  'authkey',
  'authcode',
  'basicauth',
  'bearer',
]);

/**
 * `card` and `cc` mark a card number wherever they appear (`paymentCard`,
 * `ccExpiry`), except before one of these words: `cardTitle` is a UI card
 * and `ccList` an email CC.
 */
const CARD_WORDS = new Set(['card', 'cc']);
const HARMLESS_AFTER_CARD = new Set([
  'title',
  'id',
  'list',
  'type',
  'count',
  'style',
  'layout',
  'header',
  'footer',
  'body',
  'class',
  'image',
  'color',
  'variant',
  'size',
  'width',
  'height',
  'index',
  'grid',
  'view',
  'email',
  'address',
  'recipient',
]);

const SECRET_AUTOCOMPLETE = /password|one-time-code|cc-/i;
/** Elements whose content never leaves the page (also blacked out in component screenshots). */
export const MASK_MARKERS = '.sentry-mask, .rr-mask, [data-private], [data-pangular="mask"]';
export const UNMASK_MARKER = '[data-pangular="unmask"]';
/** A JWT, including an unsigned (`alg: none`) one with an empty signature. */
export const JWT = /eyJ[\w-]{4,}\.[\w-]{4,}\.[\w-]*/g;
const BEARER = /\bBearer\s+[\w.~+/=-]+/gi;

interface PrivacyConfig {
  mask?: string[];
  unmask?: string[];
}

const scope = new RedactionScope<PrivacyConfig, RedactReason | null>();

/**
 * A number that changes whenever a value redacted inside the current
 * `withRedactionScope` could come out differently, or null outside a scope.
 */
export function redactionEpoch(): number | null {
  return scope.epoch();
}

let secretNames: string[] = [];
let unmaskNames: string[] = [];

/** Applies the `redaction` devtools config on top of the built-in rules. */
export function setRedaction(options: { secretNames?: string[]; unmask?: string[] } = {}) {
  secretNames = (options.secretNames ?? [])
    .map((name) => wordsOf(name).map(singular).join(''))
    .filter(Boolean);
  unmaskNames = [...(options.unmask ?? [])];
  secretKeys.clear();
  scope.changed();
}

function pageConfig(): PrivacyConfig {
  try {
    const value = (globalThis as { __PANGULAR_FORMS__?: unknown }).__PANGULAR_FORMS__;
    return value && typeof value === 'object' ? (value as PrivacyConfig) : {};
  } catch {
    return {};
  }
}

function config(): PrivacyConfig {
  const pinned = scope.config();
  if (pinned) return pinned;
  const page = pageConfig();
  if (!unmaskNames.length) return page;
  return { ...page, unmask: [...(Array.isArray(page.unmask) ? page.unmask : []), ...unmaskNames] };
}

export function wordsOf(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function singular(word: string): string {
  return word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
}

function containsName(words: string[], name: string): boolean {
  for (let i = 0; i < words.length; i++) {
    let run = '';
    for (let j = i; j < words.length && run.length < name.length; j++) {
      run += words[j];
      if (run === name) return true;
    }
  }
  return false;
}

/** `isSecretKey` per key: it depends only on the key and `secretNames`, so `setRedaction` clears it. */
const secretKeys = new Map<string, boolean>();
const MAX_CACHED_KEYS = 20_000;

export function isSecretKey(key: string): boolean {
  let secret = secretKeys.get(key);
  if (secret === undefined) {
    secret = classify(key);
    if (secretKeys.size >= MAX_CACHED_KEYS) secretKeys.clear();
    secretKeys.set(key, secret);
  }
  return secret;
}

let classified = 0;

/** How many keys `isSecretKey` has classified (not answered from its cache), for the hot-path tests. */
export function secretKeyClassifications(): number {
  return classified;
}

function classify(key: string): boolean {
  classified++;
  const words = wordsOf(key).map(singular);
  if (words.some((word) => SECRET_WORDS.has(word))) return true;
  if (SECRET_PAIRS.has(words.join(''))) return true;
  if (words.some((word, i) => CARD_WORDS.has(word) && !HARMLESS_AFTER_CARD.has(words[i + 1] ?? '')))
    return true;
  if (words.some((word, i) => i > 0 && SECRET_PAIRS.has(words[i - 1] + word))) return true;
  return secretNames.some((name) => containsName(words, name));
}

/**
 * The one key check for values leaving the page: the built-in words,
 * `redaction.secretNames`, and the `mask` and `unmask` lists.
 */
export function isRedactedKey(key: string): boolean {
  return scope.keyReason(key, () => redactReason(key)) !== null;
}

/**
 * Runs `body` with the redaction config read once: the page's
 * `__PANGULAR_FORMS__` lists and `redaction.unmask` are read at the start, and
 * each key's `isRedactedKey` answer is kept until that config changes. Use it
 * around a whole collect or store update; nested calls join the outer one.
 */
export function withRedactionScope<T>(body: () => T): T {
  return scope.run(() => {
    // Each list is read once (it may be a getter) and copied, so the scope sees one config.
    const { mask, unmask } = pageConfig();
    const own = Array.isArray(unmask) ? [...unmask] : unmask;
    return {
      mask: Array.isArray(mask) ? [...mask] : mask,
      unmask: unmaskNames.length ? [...(Array.isArray(own) ? own : []), ...unmaskNames] : own,
    };
  }, body);
}

function listed(list: string[] | undefined, key: string): boolean {
  return Array.isArray(list) && list.some((entry) => entry === key);
}

export function redactReason(key: string, element?: Element | null): RedactReason | null {
  const { mask, unmask } = config();
  if (listed(unmask, key)) return null;
  const unmasked = !!element && safeClosest(element, UNMASK_MARKER);
  if (listed(mask, key)) return 'config';
  if (!unmasked && isSecretKey(key)) return 'key';
  if (!element || unmasked) return null;
  if (element.getAttribute('type') === 'password') return 'input-type';
  if (SECRET_AUTOCOMPLETE.test(element.getAttribute('autocomplete') ?? '')) return 'autocomplete';
  if (safeClosest(element, MASK_MARKERS)) return 'marker';
  if (safeQuery(element, 'input[type="password"]')) return 'input-type';
  return null;
}

function safeClosest(element: Element, selector: string): boolean {
  try {
    return !!element.closest(selector);
  } catch {
    return false;
  }
}

function safeQuery(element: Element, selector: string): boolean {
  try {
    return !!element.querySelector(selector);
  } catch {
    return false;
  }
}

export function redactMessage(text: string, secrets: Iterable<string> = []): string {
  return redactMessageWith(text, longestFirst(secrets));
}

/** `secrets` as `redactMessageWith` takes them: 3 characters or more, longest first. */
export function longestFirst(secrets: Iterable<string>): string[] {
  const out = [...secrets].filter((secret) => secret.length >= 3);
  out.sort((a, b) => b.length - a.length);
  return out;
}

/** `redactMessage` with secrets `longestFirst` already prepared, for many texts in a row. */
export function redactMessageWith(text: string, ordered: readonly string[]): string {
  let out = redactCredentials(text, REDACTED)
    .replace(JWT, REDACTED)
    .replace(BEARER, `Bearer ${REDACTED}`);
  for (const secret of ordered) out = out.split(secret).join(REDACTED);
  return out;
}

/** Most earlier secret values a `SecretSet` keeps hiding after they changed. */
export const MAX_RETIRED_SECRETS = 50;

/**
 * Whether `value` is one of `values` or the start of one, as a field's value
 * is while someone keeps typing.
 */
export function startsAnyOf(value: string, values: Iterable<string>): boolean {
  for (const other of values) if (other.startsWith(value)) return true;
  return false;
}

/**
 * The secret values of one form, to hide them in its harmless fields and messages.
 * Built again on every collection from `previous`, so a value a secret field held
 * a moment ago (the old password a `confirmation` field still repeats) stays
 * hidden: up to `MAX_RETIRED_SECRETS` earlier values, newest kept.
 *
 * A value is kept only once no value of the form starts with it any more: the
 * field moved on to something else. While someone types `Secret123`, the collections see `Sec`,
 * `Secr` and so on; those are the start of the next value, not values the
 * field left, and hiding them would mask `Section` or `Security` everywhere.
 */
export class SecretSet {
  private readonly values = new Set<string>();
  private readonly retired = new Set<string>();
  /** The previous collection's values, kept unless a value of this one starts with them. */
  private readonly previous: readonly string[];

  constructor(previous?: SecretSet) {
    this.previous = previous ? [...previous.values] : [];
    if (!previous) return;
    for (const value of previous.earlier()) this.retired.add(value);
  }

  /** The earlier values this set hides, oldest first, at most `MAX_RETIRED_SECRETS`. */
  private earlier(): string[] {
    const out = new Set(this.retired);
    for (const value of this.previous) {
      if (startsAnyOf(value, this.values)) continue;
      out.delete(value);
      out.add(value);
    }
    return [...out].slice(-MAX_RETIRED_SECRETS);
  }

  add(value: unknown) {
    if (typeof value === 'string' && value.length >= 3) this.values.add(value);
    else if (typeof value === 'number' && String(value).length >= 3) this.values.add(String(value));
  }

  get size() {
    return this.values.size;
  }

  /** The values this set hides, current and earlier. */
  all(): string[] {
    return [...new Set([...this.values, ...this.earlier()])];
  }

  redact(text: string): string {
    return redactMessage(text, this.all());
  }
}
