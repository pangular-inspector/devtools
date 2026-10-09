import {
  controlPathOf,
  directivesOf,
  findFieldElement,
  isAbstractControl,
  nodeAt,
  serializeFormValue,
  type FormsDebugApi,
  type FoundForm,
} from './forms.ts';
import {
  REDACT_LABELS,
  isRedactedKey,
  redactReason,
  unmaskHint,
  type RedactReason,
} from './forms-privacy.ts';
import { fieldPath, submitSetup } from './forms-read.ts';
import { clip } from './text.ts';

type AnyRecord = Record<string, any>;

export const FORM_ACTIONS = [
  'set-value',
  'mark-touched',
  'mark-untouched',
  'mark-dirty',
  'mark-pristine',
  'touch-all',
  'revalidate',
  'reset',
  'enable',
  'disable',
  'submit',
  'focus',
  'focus-first-invalid',
  'store-as-global',
  'snapshot',
  'restore',
  'fill',
  'locate',
  'instrument',
  'pick',
  'cancel-pick',
] as const;

export type FormActionName = (typeof FORM_ACTIONS)[number];

export const CONFIRM_ACTIONS: FormActionName[] = ['reset', 'submit', 'restore'];

export interface FormActionRequest {
  action: FormActionName;
  formId?: string;
  path?: string;
  value?: unknown;
  values?: Record<string, unknown>;
  mode?: 'code' | 'user';
  confirm?: boolean;
  force?: boolean;
  coerce?: boolean;
  submit?: boolean;
  snapshot?: string;
  selector?: string;
}

export interface Skipped {
  path: string;
  reason: string;
}

export interface FormActionResult {
  ok: boolean;
  message: string;
  error?: string;
  skipped?: Skipped[];
  status?: string;
  invalid?: string[];
  expression?: string;
  snapshot?: string;
  formId?: string;
  path?: string;
}

export interface ActionContext {
  ng: FormsDebugApi & { applyChanges?: (component: unknown) => void };
  forms: Map<string, FoundForm>;
  elements: WeakMap<object, Element>;
  all: () => Iterable<Element>;
}

let devtoolsDepth = 0;

export function isDevtoolsAction(): boolean {
  return devtoolsDepth > 0;
}

const snapshots = new Map<
  string,
  { root: object; formId: string; value: unknown; shape: string }
>();

const MAX_GUARDED_NODES = 5000;

export function secretInside(
  value: unknown,
  prefix = '',
  seen: WeakSet<object> = new WeakSet(),
): string | null {
  if (!value || typeof value !== 'object' || value instanceof Date || seen.has(value)) return null;
  seen.add(value);
  for (const [key, child] of Object.entries(value as AnyRecord)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!/^\d+$/.test(key) && isRedactedKey(key)) return path;
    const nested = secretInside(child, path, seen);
    if (nested) return nested;
  }
  return null;
}

export function keepSecrets(
  saved: unknown,
  current: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (!saved || typeof saved !== 'object' || saved instanceof Date || seen.has(saved)) return saved;
  if (!current || typeof current !== 'object') return saved;
  seen.add(saved);
  const out: AnyRecord = Array.isArray(saved) ? [...saved] : { ...(saved as AnyRecord) };
  for (const key of Object.keys(out)) {
    const now = (current as AnyRecord)[key];
    out[key] = !/^\d+$/.test(key) && isRedactedKey(key) ? now : keepSecrets(out[key], now, seen);
  }
  return out;
}

function keysOf(path: string): string[] {
  return path ? path.split('.') : [];
}

export function valueAt(value: unknown, path: string): unknown {
  let current = value;
  for (const key of keysOf(path)) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as AnyRecord)[key];
  }
  return current;
}

function hasPath(value: unknown, path: string): boolean {
  let current = value;
  for (const key of keysOf(path)) {
    if (!current || typeof current !== 'object' || !(key in (current as object))) return false;
    current = (current as AnyRecord)[key];
  }
  return true;
}

export function setAt(value: unknown, path: string, next: unknown): unknown {
  const keys = keysOf(path);
  if (!keys.length) return next;
  if (!value || typeof value !== 'object') return value;
  const copy: AnyRecord = Array.isArray(value) ? [...value] : { ...(value as AnyRecord) };
  copy[keys[0]] = setAt(copy[keys[0]], keys.slice(1).join('.'), next);
  return copy;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function relativePath(path: string, base: string): string {
  return base ? path.slice(base.length + 1) : path;
}

let snapshotSeq = 0;

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function isFormAction(value: unknown): value is FormActionRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as Partial<FormActionRequest>;
  return (
    typeof request.action === 'string' &&
    (FORM_ACTIONS as readonly string[]).includes(request.action) &&
    (request.formId === undefined ||
      (typeof request.formId === 'string' && request.formId.length < 200)) &&
    (request.path === undefined ||
      (typeof request.path === 'string' && request.path.length < 500)) &&
    (request.selector === undefined ||
      (typeof request.selector === 'string' && request.selector.length < 500)) &&
    (request.values === undefined ||
      (typeof request.values === 'object' &&
        request.values !== null &&
        Object.keys(request.values).length <= 200))
  );
}

function parseJson(text: string): { value: unknown } | null {
  try {
    return { value: JSON.parse(text) };
  } catch {
    return null;
  }
}

export function coerceToCurrent(
  text: string,
  current: unknown,
  element?: Element | null,
): { value: unknown } | { error: string } {
  const trimmed = text.trim();
  if (current === null || current === undefined) {
    if (trimmed === 'null') return { value: null };
    const type =
      typeof HTMLInputElement !== 'undefined' && element instanceof HTMLInputElement
        ? element.type
        : '';
    if (type === 'number' || type === 'range') {
      return trimmed === '' ? { value: null } : coerceToCurrent(text, 0);
    }
    if (type === 'checkbox') return coerceToCurrent(text, false);
    const json = /^("[\s\S]*"|\{[\s\S]*\}|\[[\s\S]*\])$/.test(trimmed) ? parseJson(trimmed) : null;
    return json ?? { value: text };
  }
  if (typeof current === 'string') {
    const quoted = /^".*"$/s.test(trimmed) ? parseJson(trimmed) : null;
    return { value: typeof quoted?.value === 'string' ? quoted.value : text };
  }
  if (typeof current === 'number') {
    if (trimmed === 'null') return { value: null };
    const number = Number(trimmed);
    return trimmed !== '' && !Number.isNaN(number)
      ? { value: number }
      : { error: `holds a number; "${clipText(text)}" is not a number` };
  }
  if (typeof current === 'boolean') {
    if (/^(true|false)$/i.test(trimmed)) return { value: trimmed.toLowerCase() === 'true' };
    return { error: 'holds a boolean; type true or false' };
  }
  if (typeof current === 'bigint') {
    try {
      return { value: BigInt(trimmed) };
    } catch {
      return { error: `holds a bigint; "${clipText(text)}" is not an integer` };
    }
  }
  if (current instanceof Date) {
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime())
      ? { error: `holds a Date; "${clipText(text)}" is not a date` }
      : { value: date };
  }
  const parsed = parseJson(trimmed);
  if (current && typeof current === 'object') {
    if (!parsed || !parsed.value || typeof parsed.value !== 'object') {
      return { error: `holds ${Array.isArray(current) ? 'an array' : 'an object'}; pass JSON` };
    }
    return parsed;
  }
  return parsed ?? { value: text };
}

function clipText(text: string): string {
  return clip(text, 40);
}

function fail(error: string): FormActionResult {
  return { ok: false, message: error, error };
}

function shapeOf(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(shapeOf).join(',')}]`;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${k}:${shapeOf((value as AnyRecord)[k])}`)
      .join(',')}}`;
  }
  return '';
}

function rawValue(found: FoundForm, node: AnyRecord): unknown {
  if (found.kind === 'signal') return read(() => node['value'](), undefined);
  return read(
    () => node['getRawValue'](),
    read(() => node['value'], undefined),
  );
}

function secretOf(
  path: string,
  element: Element | null,
): { key: string; reason: RedactReason } | null {
  const keys = path.split('.');
  for (const [i, key] of keys.entries()) {
    const reason = redactReason(key);
    if (reason) return { key, reason: i < keys.length - 1 ? 'parent' : reason };
  }
  const key = keys.at(-1)!;
  const reason = element && redactReason(key, element);
  return reason ? { key, reason } : null;
}

function secretRefusal(key: string, reason: RedactReason): string {
  return `is redacted (${REDACT_LABELS[reason]}). Pangular Inspector never writes secret fields; to write it, ${unmaskHint(reason, key)}`;
}

function elementFor(ctx: ActionContext, found: FoundForm, path: string): Element | null {
  return read(() => findFieldElement(ctx.ng, ctx.all(), found, path, ctx.elements), null);
}

function refusal(
  ctx: ActionContext,
  found: FoundForm,
  node: AnyRecord,
  path: string,
  force = false,
): string | null {
  const secret = secretOf(path, elementFor(ctx, found, path));
  if (secret) return secretRefusal(secret.key, secret.reason);
  if (found.kind === 'signal') {
    if (read(() => node['hidden'](), false)) return 'is hidden';
    if (read(() => node['readonly'](), false)) return 'is readonly';
    if (read(() => node['disabled'](), false)) return 'is disabled by a disabled() rule';
    return null;
  }
  if (!force && read(() => node['disabled'], false)) return 'is disabled (pass force to write it)';
  return null;
}

function childrenOf(found: FoundForm, node: AnyRecord): [string, AnyRecord][] {
  if (found.kind === 'signal') {
    const value = read(() => node['value'](), undefined);
    if (!value || typeof value !== 'object' || value instanceof Date) return [];
    const tree = read(() => node['fieldTree'] as AnyRecord, null);
    if (!tree) return [];
    return Object.keys(value).flatMap((key) => {
      const child = read(() => tree[key]?.() as AnyRecord | undefined, undefined);
      return child ? [[key, child] as [string, AnyRecord]] : [];
    });
  }
  const controls = read(() => node['controls'], null);
  if (!controls || typeof controls !== 'object') return [];
  return Array.isArray(controls)
    ? controls.map((child, index) => [String(index), child] as [string, AnyRecord])
    : Object.entries(controls as AnyRecord);
}

export interface GuardedField {
  path: string;
  reason: string;
}

export function guardedFields(
  ctx: ActionContext,
  found: FoundForm,
  node: AnyRecord,
  path: string,
  force = false,
): GuardedField[] | null {
  const out: GuardedField[] = [];
  const seen = new WeakSet<object>();
  let count = 0;
  let overflow = false;
  const visit = (current: AnyRecord, currentPath: string) => {
    if (overflow || !current || seen.has(current)) return;
    seen.add(current);
    if (++count > MAX_GUARDED_NODES) {
      overflow = true;
      return;
    }
    const reason = currentPath !== path ? refusal(ctx, found, current, currentPath, force) : null;
    if (reason) {
      out.push({ path: currentPath, reason });
      return;
    }
    for (const [key, child] of childrenOf(found, current)) {
      visit(child, currentPath ? `${currentPath}.${key}` : key);
    }
  };
  visit(node, path);
  return overflow ? null : out;
}

function nativeWrite(element: Element, value: unknown): boolean {
  if (element instanceof HTMLInputElement) {
    if (element.type === 'file') return false;
    if (element.type === 'checkbox') {
      element.checked = !!value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (element.type === 'radio') {
      const scope = element.form ?? element.ownerDocument;
      const target = Array.from(scope.querySelectorAll('input[type="radio"]')).find(
        (radio) =>
          (radio as HTMLInputElement).name === element.name &&
          (radio as HTMLInputElement).value === String(value),
      ) as HTMLInputElement | undefined;
      if (!target) return false;
      target.checked = true;
      target.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    element.value = value == null ? '' : String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  if (element instanceof HTMLTextAreaElement) {
    element.value = value == null ? '' : String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  return false;
}

function label(value: unknown): string {
  const text = read(() => JSON.stringify(value), undefined) ?? String(value);
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

function selectWrite(
  ctx: ActionContext,
  select: HTMLSelectElement,
  value: unknown,
): { problem: string } | { expected: unknown } {
  const accessor = directiveWith(ctx, select, '_getOptionValue');
  const compare =
    typeof accessor?.['_compareWith'] === 'function' ? accessor['_compareWith'] : Object.is;
  const options = Array.from(select.options).map((option) => ({
    option,
    value: accessor
      ? read(() => accessor['_getOptionValue'](option.value) as unknown, option.value)
      : option.value,
  }));
  const matches = (candidate: unknown, wanted: unknown) =>
    read(() => !!compare(candidate, wanted), false) ||
    sameValue(candidate, wanted) ||
    (typeof candidate === 'string' && wanted != null && candidate === String(wanted));
  let expected: unknown;
  if (select.multiple) {
    if (!Array.isArray(value)) return { problem: 'is a multiple select; pass an array' };
    const missing = value.find((wanted) => !options.some((o) => matches(o.value, wanted)));
    if (missing !== undefined) return { problem: `has no option with the value ${label(missing)}` };
    const chosen = options.filter((o) => value.some((wanted) => matches(o.value, wanted)));
    for (const o of options) o.option.selected = chosen.includes(o);
    expected = chosen.map((o) => o.value);
  } else {
    const index = options.findIndex((o) => matches(o.value, value));
    if (index < 0) return { problem: `has no option with the value ${label(value)}` };
    select.selectedIndex = index;
    expected = options[index].value;
  }
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return { expected };
}

function sameOption(stored: unknown, expected: unknown): boolean {
  return (
    sameValue(stored, expected) ||
    (stored != null &&
      expected != null &&
      typeof stored !== 'object' &&
      typeof expected !== 'object' &&
      String(stored) === String(expected))
  );
}

function sameSelection(stored: unknown, expected: unknown): boolean {
  if (!Array.isArray(expected)) return sameOption(stored, expected);
  return (
    Array.isArray(stored) &&
    stored.length === expected.length &&
    expected.every((item, index) => sameOption(stored[index], item))
  );
}

function writeValue(
  ctx: ActionContext,
  found: FoundForm,
  path: string,
  value: unknown,
  mode: 'code' | 'user',
  force: boolean,
): string | null {
  const node = nodeAt(found, path, true);
  if (!node) return 'does not exist';
  const refused = refusal(ctx, found, node, path, force);
  if (refused) return refused;
  const current = rawValue(found, node);
  const secret = secretInside(value);
  if (secret) {
    const key = secret.split('.').pop()!;
    const reason = redactReason(key) ?? 'key';
    return `contains the secret field "${secret}" (${REDACT_LABELS[reason]}). Pangular Inspector never writes secret fields; to write it, ${unmaskHint(reason, key)}`;
  }
  if (current && typeof current === 'object' && !(current instanceof Date)) {
    const guarded = guardedFields(ctx, found, node, path, force);
    if (!guarded) return 'is too large to check for protected fields; write the fields one by one';
    for (const field of guarded) {
      const rel = relativePath(field.path, path);
      if (found.kind !== 'signal' && !hasPath(value, rel)) continue;
      if (!sameValue(valueAt(value, rel), valueAt(current, rel))) {
        return `would change ${field.path}, which ${field.reason}`;
      }
    }
  }
  if (current && typeof current === 'object' && shapeOf(current) !== shapeOf(value)) {
    if (!value || typeof value !== 'object') return 'is a group or array; pass an object or array';
  }
  const leaf = !current || typeof current !== 'object' || current instanceof Date;
  const element = elementFor(ctx, found, path);
  const select = element instanceof HTMLSelectElement;
  const viaDom = element && (leaf || select) && (mode === 'user' || found.kind === 'template');
  if (viaDom && element instanceof HTMLSelectElement) {
    const outcome = selectWrite(ctx, element, value);
    if ('problem' in outcome) return outcome.problem;
    if (mode === 'user') element.dispatchEvent(new Event('blur'));
    const deferred = found.kind !== 'signal' && read(() => node['updateOn'], 'change') !== 'change';
    const stored = deferred ? node['_pendingValue'] : rawValue(found, node);
    return sameSelection(stored, outcome.expected)
      ? null
      : `holds ${label(stored)} after the write`;
  }
  if (viaDom && nativeWrite(element, value)) {
    if (mode === 'user') element.dispatchEvent(new Event('blur'));
    return null;
  }
  if (found.kind === 'template' && leaf) {
    const dir = directivesOf(node);
    if (!dir || typeof dir['viewToModelUpdate'] !== 'function') {
      return 'is an ngModel without a native input; set the component property instead';
    }
    node['setValue'](value);
    dir['viewToModelUpdate'](value);
    return null;
  }
  if (found.kind === 'signal') {
    if (mode === 'user' && typeof node['controlValue']?.set === 'function') {
      node['controlValue'].set(value);
      node['markAsDirty']?.();
    } else node['value'].set(value);
    return null;
  }
  if (Array.isArray(current) || !leaf) node['patchValue'](value);
  else node['setValue'](value);
  if (mode === 'user') {
    node['markAsDirty']?.();
    node['markAsTouched']?.();
  }
  return null;
}

function invalidPaths(found: FoundForm): string[] {
  const out: string[] = [];
  const visit = (node: AnyRecord, path: string, depth: number) => {
    if (depth > 12 || out.length > 50) return;
    if (found.kind === 'signal') {
      const children = read(() => node['structure'].materializedChildren() as AnyRecord[], []);
      const ownErrors = read(() => (node['errors']() as unknown[]).length, 0);
      if (ownErrors) out.push(path);
      for (const child of children) {
        const key = String(read(() => child['keyInParent'](), ''));
        visit(child, path ? `${path}.${key}` : key, depth + 1);
      }
      return;
    }
    const errors = read(() => node['errors'], null);
    if (errors && Object.keys(errors).length) out.push(path);
    const controls = read(() => node['controls'], null);
    if (!controls) return;
    const entries: [string, AnyRecord][] = Array.isArray(controls)
      ? controls.map((c, i) => [String(i), c])
      : Object.entries(controls);
    for (const [key, child] of entries) visit(child, path ? `${path}.${key}` : key, depth + 1);
  };
  visit(found.root, '', 0);
  return out;
}

function statusOf(found: FoundForm): string {
  if (found.kind === 'signal') {
    const root = found.root;
    if (read(() => root['pending'](), false)) return 'PENDING';
    if (read(() => root['invalid'](), false)) return 'INVALID';
    return 'VALID';
  }
  return String(read(() => found.root['status'], 'VALID'));
}

async function settle(ctx: ActionContext, found: FoundForm, timeout = 2000) {
  read(() => found.owner && ctx.ng.applyChanges?.(found.owner), undefined);
  const start = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 30));
  while (statusOf(found) === 'PENDING' && Date.now() - start < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  read(() => found.owner && ctx.ng.applyChanges?.(found.owner), undefined);
}

function directiveWith(ctx: ActionContext, element: Element | undefined, method: string) {
  if (!element) return null;
  const directives = read(() => ctx.ng.getDirectives(element) ?? [], [] as unknown[]);
  return (directives.find((d) => typeof (d as AnyRecord)?.[method] === 'function') ??
    null) as AnyRecord | null;
}

function expressionFor(found: FoundForm, path: string): string {
  if (!path) return '$form';
  if (found.kind === 'signal') {
    return `$form${path
      .split('.')
      .map((key) => (/^\d+$/.test(key) ? `[${key}]` : `.${key}`))
      .join('')}`;
  }
  return `$form.get('${path.replace(/'/g, "\\'")}')`;
}

function locate(ctx: ActionContext, selector: string): FormActionResult {
  let target: Element | null = null;
  try {
    target = document.querySelector(selector);
  } catch {
    return fail(`${selector} is not a valid CSS selector.`);
  }
  if (!target) return fail(`Nothing on the page matches ${selector}.`);
  return locateElement(ctx, target) ?? fail(`${selector} is not bound to a form field.`);
}

export function locateElement(ctx: ActionContext, target: Element): FormActionResult | null {
  const directives = read(() => ctx.ng.getDirectives(target) ?? [], [] as unknown[]) as AnyRecord[];
  for (const [formId, found] of ctx.forms) {
    for (const dir of directives) {
      const state = read(() => dir['state']?.() as AnyRecord | undefined, undefined);
      if (state && read(() => state['structure'].root, null) === found.root) {
        return { ok: true, message: 'Found', formId, path: fieldPath(state) };
      }
      const control = read(() => dir['control'] as unknown, undefined);
      if (isAbstractControl(control) && read(() => control['root'], null) === found.root) {
        const path = controlPathOf(found.root, control);
        if (!path && control !== found.root) continue;
        return { ok: true, message: 'Found', formId, path };
      }
    }
  }
  return null;
}

export async function runFormAction(
  ctx: ActionContext,
  request: FormActionRequest,
): Promise<FormActionResult> {
  if (request.action === 'locate') {
    if (!request.selector) return fail('Pass a CSS selector.');
    return locate(ctx, request.selector);
  }
  const found = request.formId ? ctx.forms.get(request.formId) : ctx.forms.values().next().value;
  if (!found) return fail(`No form ${request.formId ?? ''} on this page.`);
  if (CONFIRM_ACTIONS.includes(request.action) || (request.action === 'fill' && request.submit)) {
    if (request.confirm !== true) {
      return fail(`${request.action} changes app state; call again with confirm: true.`);
    }
  }
  const path = request.path ?? '';
  devtoolsDepth++;
  try {
    const result = await perform(ctx, found, request, path);
    if (result.ok && !['focus', 'store-as-global', 'snapshot'].includes(request.action)) {
      await settle(ctx, found);
    }
    return { ...result, status: statusOf(found), invalid: invalidPaths(found).slice(0, 20) };
  } catch (error) {
    return fail(String((error as Error)?.message ?? error).slice(0, 300));
  } finally {
    devtoolsDepth--;
  }
}

async function perform(
  ctx: ActionContext,
  found: FoundForm,
  request: FormActionRequest,
  path: string,
): Promise<FormActionResult> {
  const signal = found.kind === 'signal';
  const node = () => nodeAt(found, path, true);
  const need = () => {
    const n = node();
    if (!n) throw new Error(`No field at ${path || '(form)'}.`);
    return n;
  };
  switch (request.action) {
    case 'set-value': {
      let value = request.value;
      if (request.coerce && typeof value === 'string') {
        const current = node();
        const raw = current ? rawValue(found, current) : undefined;
        const coerced = coerceToCurrent(
          value,
          raw,
          raw === null || raw === undefined ? elementFor(ctx, found, path) : null,
        );
        if ('error' in coerced) {
          return {
            ...fail(`${path || '(form)'} ${coerced.error}.`),
            skipped: [{ path, reason: coerced.error }],
          };
        }
        value = coerced.value;
      }
      const problem = writeValue(ctx, found, path, value, request.mode ?? 'code', !!request.force);
      return problem
        ? { ...fail(`${path || '(form)'} ${problem}.`), skipped: [{ path, reason: problem }] }
        : { ok: true, message: `Set ${path || '(form)'}.` };
    }
    case 'fill': {
      const skipped: Skipped[] = [];
      let written = 0;
      for (const [fieldPathKey, value] of Object.entries(request.values ?? {})) {
        const problem = writeValue(ctx, found, fieldPathKey, value, request.mode ?? 'user', false);
        if (problem) skipped.push({ path: fieldPathKey, reason: problem });
        else written++;
      }
      let message = `Wrote ${written} field(s)${skipped.length ? `, skipped ${skipped.length}` : ''}.`;
      if (request.submit) {
        await settle(ctx, found);
        const submitted = await perform(ctx, found, { ...request, action: 'submit' }, '');
        message += ` ${submitted.message}`;
      }
      return { ok: written > 0 || !skipped.length, message, skipped };
    }
    case 'mark-touched':
    case 'mark-untouched':
    case 'mark-dirty':
    case 'mark-pristine': {
      const n = need();
      const method = {
        'mark-touched': 'markAsTouched',
        'mark-untouched': 'markAsUntouched',
        'mark-dirty': 'markAsDirty',
        'mark-pristine': 'markAsPristine',
      }[request.action];
      if (signal && read(() => n['nodeState']['isNonInteractive'](), false)) {
        return {
          ok: false,
          message: `${path || '(form)'} is hidden, disabled or readonly, so Signal Forms ignores touched and dirty on it.`,
        };
      }
      n[method]();
      return { ok: true, message: `${method} on ${path || '(form)'}.` };
    }
    case 'touch-all': {
      const n = need();
      if (signal) n['markAsTouched']();
      else n['markAllAsTouched']();
      return { ok: true, message: 'Marked every interactive field as touched.' };
    }
    case 'revalidate': {
      const n = need();
      if (signal) {
        if (typeof n['reloadValidation'] !== 'function')
          return fail('This Angular version has no reloadValidation.');
        n['reloadValidation']();
        return { ok: true, message: 'Reloaded async validation (HTTP validators fire again).' };
      }
      n['updateValueAndValidity']();
      return { ok: true, message: `Revalidated ${path || '(form)'}.` };
    }
    case 'reset': {
      need()['reset']();
      return { ok: true, message: `Reset ${path || '(form)'}.` };
    }
    case 'enable':
    case 'disable': {
      if (signal) {
        return fail(
          'Signal Forms fields are disabled by disabled() rules in the schema, not imperatively. Change the rule or the value it reads.',
        );
      }
      const n = need();
      if (found.kind === 'template' && path) {
        const dir = directivesOf(n);
        if (dir) {
          return fail(
            'This field uses ngModel, which syncs disabled from its [disabled] input on the next change detection. Change the bound property instead.',
          );
        }
      }
      n[request.action]();
      return {
        ok: true,
        message: `${request.action === 'enable' ? 'Enabled' : 'Disabled'} ${path || '(form)'}.`,
      };
    }
    case 'submit': {
      if (signal) {
        const setup = submitSetup(found.root);
        const formRoot = directiveWith(ctx, found.formElement, 'onSubmit');
        if (formRoot) {
          formRoot['onSubmit'](new Event('submit', { cancelable: true }));
          return {
            ok: true,
            message: setup.willRun
              ? 'Submitted through the form root; the action runs.'
              : 'Submitted through the form root; the form is invalid, so the action did not run (fields are now touched).',
          };
        }
        return fail(
          setup.hasAction
            ? 'This Signal Form has no [formRoot] element to submit through. Call submit(form) from app code.'
            : 'This Signal Form has no submission action (NG01915 on submit). Add { submission: { action } } to form().',
        );
      }
      const el = found.formElement;
      if (el instanceof HTMLFormElement) {
        if (!el.noValidate && !el.checkValidity()) {
          return fail(
            'The browser would block this submit: native validation fails and the form has no novalidate.',
          );
        }
        el.requestSubmit();
        return {
          ok: true,
          message: 'Submitted the <form> (ngSubmit fires even when the form is invalid).',
        };
      }
      const dir = found.directive;
      if (dir && typeof dir['onSubmit'] === 'function') {
        dir['onSubmit'](new Event('submit', { cancelable: true }));
        return {
          ok: true,
          message: 'Called onSubmit on the form directive (it is not on a <form>).',
        };
      }
      return fail('No form element or form directive to submit.');
    }
    case 'focus': {
      const el = elementFor(ctx, found, path);
      if (!(el instanceof HTMLElement))
        return fail(`${path || '(form)'} is not bound to an element.`);
      el.scrollIntoView?.({ block: 'center' });
      el.focus();
      return { ok: true, message: `Focused ${path || '(form)'}.` };
    }
    case 'focus-first-invalid': {
      const candidates = invalidPaths(found)
        .map((p) => ({ path: p, el: elementFor(ctx, found, p) }))
        .filter((c): c is { path: string; el: HTMLElement } => c.el instanceof HTMLElement);
      candidates.sort((a, b) =>
        a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      );
      const first = candidates[0];
      if (!first) return fail('No invalid field is bound to an element.');
      first.el.scrollIntoView?.({ block: 'center' });
      first.el.focus();
      return { ok: true, message: `Focused ${first.path}.`, path: first.path };
    }
    case 'store-as-global': {
      const target = signal ? read(() => found.root['fieldTree'], found.root) : found.root;
      const w = window as unknown as AnyRecord;
      w['$form'] = target;
      w['$control'] = signal ? read(() => nodeAt(found, path, true)?.['fieldTree'], null) : node();
      const expression = expressionFor(found, path);
      return {
        ok: true,
        message:
          `Stored as $form in the page console. ${path ? `The field is ${expression} (also $control).` : ''}`.trim(),
        expression,
      };
    }
    case 'snapshot': {
      const value = rawValue(found, found.root);
      let copy: unknown;
      try {
        copy = structuredClone(value);
      } catch {
        return fail('This form value cannot be snapshotted.');
      }
      const id = `s${++snapshotSeq}`;
      snapshots.set(id, {
        root: found.root,
        formId: request.formId ?? '',
        value: copy,
        shape: shapeOf(value),
      });
      if (snapshots.size > 20) snapshots.delete(snapshots.keys().next().value!);
      return { ok: true, message: `Saved snapshot ${id}.`, snapshot: id };
    }
    case 'restore': {
      const saved = request.snapshot ? snapshots.get(request.snapshot) : undefined;
      if (!saved)
        return fail(`No snapshot ${request.snapshot ?? ''} (snapshots live until reload).`);
      if (saved.root !== found.root) {
        return fail(`Snapshot ${request.snapshot} was taken from another form.`);
      }
      const currentValue = rawValue(found, found.root);
      if (shapeOf(currentValue) !== saved.shape) {
        return fail(
          'The form structure changed since the snapshot (arrays or groups differ), so it cannot be restored.',
        );
      }
      const guarded = guardedFields(ctx, found, found.root, '');
      if (!guarded) return fail('The form is too large to check for protected fields.');
      let restored = keepSecrets(structuredClone(saved.value), currentValue);
      for (const field of guarded) {
        restored = setAt(restored, field.path, valueAt(currentValue, field.path));
      }
      if (signal) found.root['value'].set(restored);
      else found.root['patchValue'](restored);
      return { ok: true, message: `Restored snapshot ${request.snapshot}.` };
    }
    default:
      return fail('Unknown action.');
  }
}
