import { CONTROL_SELECTORS, formSecretValues, pageElements, selectorsOf } from './forms.ts';
import { MAX_RETIRED_SECRETS, redactReason } from './forms-privacy.ts';

/**
 * The values of the form fields inside a component that the forms inspector
 * masks because of their element: `type="password"`, a credential
 * `autocomplete`, `data-pangular="mask"` and the other mask markers, besides
 * the secret names. The component detail and its value levels hide these
 * values wherever they appear, so a `FormGroup` property, the `ngModel` model
 * object or a Signal Forms model shows `[redacted]` where the Forms view does.
 * The values the forms inspector hides in the page's forms (secret fields,
 * current and earlier) are hidden as well. Values seen earlier stay hidden too (up to `MAX_RETIRED_SECRETS`, newest
 * kept), so a harmless field that repeats a secret's old value stays masked
 * after the secret changes. Only a DOM host has fields; the native overlays
 * get an empty set.
 */

type AnyRecord = Record<string, any>;

/** Most elements one component is scanned for, so a huge view stays cheap. */
const MAX_ELEMENTS = 2000;
/** Shorter values are too common to hide wherever they appear (as in `SecretSet`). */
const MIN_SECRET = 3;

interface FormsDebugNg<H extends object> {
  getDirectives?(el: H): unknown[];
}

/** Masked values seen on this page, newest last. */
const seen = new Set<string>();

function remember(values: Set<string>) {
  for (const value of values) {
    seen.delete(value);
    seen.add(value);
  }
  while (seen.size > MAX_RETIRED_SECRETS) seen.delete(seen.values().next().value!);
}

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function addValue(out: Set<string>, value: unknown, depth = 0) {
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value);
    if (text.length >= MIN_SECRET) out.add(text);
  } else if (Array.isArray(value) && depth < 1) {
    for (const item of value.slice(0, 20)) addValue(out, item, depth + 1);
  }
}

/** The name a field goes by, and every value it holds, for one control directive. */
function fieldOf(dir: AnyRecord, selectors: Set<string>, el: Element) {
  const attr = el.getAttribute('name') ?? el.getAttribute('formControlName') ?? '';
  if (selectors.has('formField')) {
    const state = read(() => dir['state']() as AnyRecord, null);
    const name = read(() => String(state?.['name']() ?? ''), '');
    return {
      key: name.split('.').pop() || attr,
      values: [read(() => state?.['value'](), undefined)],
    };
  }
  const control = read(() => (dir['control'] ?? dir['form']) as AnyRecord | undefined, undefined);
  const name = read(() => dir['name'], undefined);
  return {
    key: typeof name === 'string' || typeof name === 'number' ? String(name) : attr,
    values: [
      read(() => control?.['value'], undefined),
      read(() => dir['model'], undefined),
      read(() => dir['viewModel'], undefined),
    ],
  };
}

export function maskedFormValues<H extends object>(
  ng: FormsDebugNg<H> | undefined,
  host: H | null,
): Set<string> {
  const out = new Set<string>();
  if (!ng?.getDirectives || typeof Element === 'undefined' || !(host instanceof Element)) {
    return new Set([...seen, ...formSecretValues()]);
  }
  const elements = read(() => pageElements(host), [] as Element[]);
  for (const el of elements.slice(0, MAX_ELEMENTS)) {
    for (const directive of read(
      () => ng.getDirectives!(el as unknown as H) ?? [],
      [] as unknown[],
    )) {
      const selectors = selectorsOf(directive);
      if (!selectors.has('formField') && !CONTROL_SELECTORS.some((s) => selectors.has(s))) continue;
      const field = fieldOf(directive as AnyRecord, selectors, el);
      if (!redactReason(field.key, el)) continue;
      for (const value of field.values) addValue(out, value);
    }
  }
  remember(out);
  return new Set([...seen, ...out, ...formSecretValues()]);
}

/** Forgets the values seen so far, for tests. */
export function forgetMaskedFormValues() {
  seen.clear();
}
