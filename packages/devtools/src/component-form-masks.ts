import { CONTROL_SELECTORS, formSecretValues, pageElements, selectorsOf } from './forms.ts';
import { MAX_RETIRED_SECRETS, redactReason, startsAnyOf } from './forms-privacy.ts';
import { DIRTY_HEARTBEAT_MS } from './dom-dirty.ts';

/**
 * The values of the form fields inside a component that the forms inspector
 * masks because of their element: `type="password"`, a credential
 * `autocomplete`, `data-pangular="mask"` and the other mask markers, besides
 * the secret names. The component detail and its value levels hide these
 * values wherever they appear, so a `FormGroup` property, the `ngModel` model
 * object or a Signal Forms model shows `[redacted]` where the Forms view does.
 * The values the forms inspector hides in the page's forms (secret fields,
 * current and earlier) are hidden as well. Values seen earlier stay hidden too
 * (up to `MAX_RETIRED_SECRETS`, newest kept), so a harmless field that repeats
 * a secret's old value stays masked after the secret changes. The start of a
 * value still being typed is not kept. Only a DOM host has fields; the native overlays
 * get an empty set.
 *
 * Finding the fields walks every element of the component, so the elements
 * that hold a form control are cached per host and found again only after a
 * `MutationObserver` saw elements added or removed (or once per heartbeat, as
 * a safety net). Each call still reads the values and the mask rules of those
 * fields, which change without a DOM mutation.
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

/**
 * Keeps `values` as seen. A value seen before that one of them starts with
 * was the same field part way through typing (`Sec` on the way to
 * `Secret123`), so it is dropped instead of hiding `Section` everywhere.
 */
function remember(values: Set<string>) {
  for (const value of [...seen]) if (startsAnyOf(value, values)) seen.delete(value);
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

function isControl(selectors: Set<string>): boolean {
  return selectors.has('formField') || CONTROL_SELECTORS.some((s) => selectors.has(s));
}

/** Bumped when elements are added or removed anywhere the scans looked. */
let domVersion = 0;
let observer: MutationObserver | null | undefined;
const observed = new WeakSet<Node>();

function observe(node: Node) {
  if (!observer || observed.has(node)) return;
  observed.add(node);
  observer.observe(node, { childList: true, subtree: true });
}

/** The current DOM version, after the records not delivered yet. */
function currentVersion(): number {
  if (observer === undefined) {
    observer =
      typeof MutationObserver === 'function' && typeof document !== 'undefined'
        ? new MutationObserver(() => void domVersion++)
        : null;
    if (observer) observe(document.documentElement ?? document);
  }
  if (observer?.takeRecords().length) domVersion++;
  return domVersion;
}

interface ControlScan {
  version: number;
  at: number;
  elements: Element[];
}

/** The elements with a form control directive inside each host, from the last scan. */
const scans = new WeakMap<Element, ControlScan>();

function controlElements<H extends object>(ng: FormsDebugNg<H>, host: Element): Element[] {
  const version = currentVersion();
  const cached = scans.get(host);
  if (
    cached &&
    observer &&
    cached.version === version &&
    Date.now() - cached.at < DIRTY_HEARTBEAT_MS
  ) {
    return cached.elements;
  }
  const elements = read(() => pageElements(host, observe), [] as Element[]);
  const controls = elements
    .slice(0, MAX_ELEMENTS)
    .filter((el) =>
      read(
        () => (ng.getDirectives!(el as unknown as H) ?? []).some((d) => isControl(selectorsOf(d))),
        false,
      ),
    );
  scans.set(host, { version, at: Date.now(), elements: controls });
  return controls;
}

export function maskedFormValues<H extends object>(
  ng: FormsDebugNg<H> | undefined,
  host: H | null,
): Set<string> {
  const out = new Set<string>();
  if (!ng?.getDirectives || typeof Element === 'undefined' || !(host instanceof Element)) {
    return new Set([...seen, ...formSecretValues()]);
  }
  for (const el of controlElements(ng, host)) {
    for (const directive of read(
      () => ng.getDirectives!(el as unknown as H) ?? [],
      [] as unknown[],
    )) {
      const selectors = selectorsOf(directive);
      if (!isControl(selectors)) continue;
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
