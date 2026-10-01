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
  const byKey = `add "${key}" to unmask on window.__NG_DEVTOOLS_FORMS__ or to redaction.unmask`;
  return reason === 'key' || reason === 'parent' || reason === 'config'
    ? byKey
    : `add data-ng-devtools="unmask" to the field, or ${byKey}`;
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
  'card',
  'cc',
  'credential',
  'credentials',
  'cookie',
  'authorization',
  'jwt',
]);

const SECRET_PAIRS = new Set([
  'apikey',
  'privatekey',
  'secretkey',
  'accesskey',
  'ccnum',
  'ccnumber',
  'securitycode',
  'sessionid',
  'sessionkey',
]);

const SECRET_AUTOCOMPLETE = /password|one-time-code|cc-/i;
const MASK_MARKERS = '.sentry-mask, .rr-mask, [data-private], [data-ng-devtools="mask"]';
const UNMASK_MARKER = '[data-ng-devtools="unmask"]';
const JWT = /\beyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/g;
const BEARER = /\bBearer\s+[\w.~+/=-]+/gi;

interface PrivacyConfig {
  mask?: string[];
  unmask?: string[];
}

let secretNames: string[] = [];
let unmaskNames: string[] = [];

/** Applies the `redaction` devtools config on top of the built-in rules. */
export function setRedaction(options: { secretNames?: string[]; unmask?: string[] } = {}) {
  secretNames = (options.secretNames ?? [])
    .map((name) => wordsOf(name).map(singular).join(''))
    .filter(Boolean);
  unmaskNames = [...(options.unmask ?? [])];
}

function pageConfig(): PrivacyConfig {
  try {
    const value = (globalThis as { __NG_DEVTOOLS_FORMS__?: unknown }).__NG_DEVTOOLS_FORMS__;
    return value && typeof value === 'object' ? (value as PrivacyConfig) : {};
  } catch {
    return {};
  }
}

function config(): PrivacyConfig {
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

export function isSecretKey(key: string): boolean {
  const words = wordsOf(key).map(singular);
  if (words.some((word) => SECRET_WORDS.has(word))) return true;
  if (SECRET_PAIRS.has(words.join(''))) return true;
  if (words.some((word, i) => i > 0 && SECRET_PAIRS.has(words[i - 1] + word))) return true;
  return secretNames.some((name) => containsName(words, name));
}

/**
 * The one key check for values leaving the page: the built-in words,
 * `redaction.secretNames`, and the `mask` and `unmask` lists.
 */
export function isRedactedKey(key: string): boolean {
  return redactReason(key) !== null;
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
  let out = text.replace(JWT, REDACTED).replace(BEARER, `Bearer ${REDACTED}`);
  for (const secret of secrets) {
    if (secret.length < 3) continue;
    out = out.split(secret).join(REDACTED);
  }
  return out;
}

export class SecretSet {
  private readonly values = new Set<string>();

  add(value: unknown) {
    if (typeof value === 'string' && value.length >= 3) this.values.add(value);
    else if (typeof value === 'number' && String(value).length >= 3) this.values.add(String(value));
  }

  get size() {
    return this.values.size;
  }

  redact(text: string): string {
    return redactMessage(text, this.values);
  }
}
