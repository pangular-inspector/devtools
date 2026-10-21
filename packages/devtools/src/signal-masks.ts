import { maskedFormValues, rememberMaskedValues } from './component-form-masks.ts';
import { isFieldTree } from './forms.ts';
import { REDACTED, longestFirst, redactMessageWith, redactReason } from './forms-privacy.ts';
import type { SignalChange, SignalGraphNode } from './types.ts';

/**
 * The secret form values a signal graph must not show. Signal Forms keeps
 * each field's value in signals of its own: an unnamed `computed` that reads
 * the field's key from the model, and an unnamed `linkedSignal` for the
 * control value. Those nodes have no label, so the name rules never apply to
 * them, and their value is the bare field value. The graph masks them by
 * value instead, against:
 *
 * - the form fields in the component's template that the forms inspector
 *   masks (secret names, `type="password"`, a credential `autocomplete`,
 *   `data-pangular="mask"` and the other markers), from `maskedFormValues`,
 *   with the values those fields held earlier and the page's form secrets;
 * - the secret fields of the Signal Forms forms the component instance holds,
 *   found by name (and by their bound element, when there is one), so a field
 *   the template doesn't bind is covered too.
 *
 * A value found this way is replaced with `[redacted]` in every node and
 * resource of the graph, and in the history entries sent with it, wherever it
 * appears: as the whole value, inside an object or array, or inside a string.
 */

type AnyRecord = Record<string, any>;

/** Most instance fields, form fields and values one scan reads, so a huge component stays cheap. */
const MAX_KEYS = 200;
const MAX_FIELDS = 500;
const MAX_DEPTH = 8;
const MAX_ITEMS = 50;

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Every string and number inside a secret field's value. */
function addValues(out: Set<string>, value: unknown, depth = 0) {
  if (typeof value === 'string' || typeof value === 'number') {
    out.add(String(value));
    return;
  }
  if (!value || typeof value !== 'object' || depth >= 3) return;
  const items = Array.isArray(value) ? value : read(() => Object.values(value), []);
  for (const item of items.slice(0, MAX_ITEMS)) addValues(out, item, depth + 1);
}

/** The element a Signal Forms field is bound to with `[formField]`, if any. */
function boundElement(node: AnyRecord): Element | null {
  const bindings = read(() => node['formFieldBindings']() as AnyRecord[], []);
  const element = bindings[0]?.['element'];
  return typeof Element !== 'undefined' && element instanceof Element ? element : null;
}

/**
 * The values of the secret fields under one Signal Forms field node. Reads
 * only the children the form already created (`materializedChildren`), so it
 * makes no field and writes nothing.
 */
function fieldSecrets(
  node: AnyRecord,
  out: Set<string>,
  budget: { left: number },
  key = '',
  depth = 0,
) {
  if (--budget.left < 0) return;
  if (key && redactReason(key, boundElement(node))) {
    addValues(
      out,
      read(() => node['value'](), undefined),
    );
    return;
  }
  if (depth >= MAX_DEPTH) return;
  for (const child of read(() => node['structure'].materializedChildren() as AnyRecord[], [])) {
    const childKey = read(() => String(child['keyInParent']()), '');
    fieldSecrets(child, out, budget, childKey, depth + 1);
  }
}

/** The values of the secret Signal Forms fields the component instance holds. */
export function instanceFormSecrets(instance: object): Set<string> {
  const out = new Set<string>();
  const budget = { left: MAX_FIELDS };
  for (const key of read(() => Object.keys(instance), [] as string[]).slice(0, MAX_KEYS)) {
    const value = read(() => (instance as AnyRecord)[key], undefined);
    if (typeof value !== 'function' || !isFieldTree(value)) continue;
    const root = read(() => value(), null);
    // The form's own property name (`login`) is not a field name; a secret one masks it all.
    if (root) fieldSecrets(root, out, budget, redactReason(key) ? key : '');
  }
  return out;
}

/**
 * The secret values for the graph of `host`'s component, or for an
 * environment injector's graph when `host` is null (the page-wide masked
 * values only).
 */
export function signalSecrets<H extends object>(
  ng: Parameters<typeof maskedFormValues<H>>[0],
  host: H | null,
  instance: object | null,
): ReadonlySet<string> {
  if (instance) rememberMaskedValues(instanceFormSecrets(instance));
  return maskedFormValues(ng, host);
}

/** The secrets each graph was built with, keyed by its node list, which copies of the graph share. */
const graphSecrets = new WeakMap<SignalGraphNode[], ReadonlySet<string>>();

export function setGraphSecrets(nodes: SignalGraphNode[], secrets: ReadonlySet<string>) {
  graphSecrets.set(nodes, secrets);
}

export function secretsOfGraph(graph: { nodes: SignalGraphNode[] }): ReadonlySet<string> {
  return graphSecrets.get(graph.nodes) ?? new Set();
}

/** A serialized value with every secret in it replaced, without changing `value`. */
function maskValue(
  value: unknown,
  secrets: ReadonlySet<string>,
  ordered: readonly string[],
  depth = 0,
): unknown {
  if (typeof value === 'string') {
    if (value === REDACTED) return value;
    return secrets.has(value) ? REDACTED : redactMessageWith(value, ordered);
  }
  if (typeof value === 'number') return secrets.has(String(value)) ? REDACTED : value;
  if (!value || typeof value !== 'object' || depth > 20) return value;
  if (Array.isArray(value))
    return value.map((item) => maskValue(item, secrets, ordered, depth + 1));
  const out: AnyRecord = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = maskValue(item, secrets, ordered, depth + 1);
  }
  return out;
}

/**
 * History entries with the graph's secret values masked. An entry was
 * serialized when it was recorded, maybe before the value was known to be
 * secret (a write, or a sample from an earlier graph), so it is masked again
 * on the way out. The kept entries stay as they are, for restores.
 */
export function maskHistory(
  history: Record<string, SignalChange[]>,
  secrets: ReadonlySet<string>,
): Record<string, SignalChange[]> {
  if (!secrets.size) return history;
  const ordered = longestFirst(secrets);
  const out: Record<string, SignalChange[]> = {};
  for (const [id, changes] of Object.entries(history)) {
    out[id] = changes.map((change) => {
      const value = maskValue(change.value, secrets, ordered);
      return value === change.value ? change : { ...change, value };
    });
  }
  return out;
}
