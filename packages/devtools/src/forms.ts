import { domFacts, submitDom, type DomFacts, type SubmitDom } from './forms-dom.ts';
import { clip } from './text.ts';
import type { WebMcpTool } from './forms-webmcp.ts';
import {
  REDACTED,
  SecretSet,
  redactMessage,
  isRedactedKey,
  redactReason,
  type RedactReason,
} from './forms-privacy.ts';
import {
  controlFacts,
  directiveBinding,
  fieldBinding,
  fieldPath,
  isProbing,
  metadataValues,
  signalErrorOrigins,
  signalFacts,
  submitSetup,
  type BindingInfo,
  type ErrorOrigin,
  type ErrorSource,
  type RuleCounts,
  type SkipReason,
  type SubmitSetup,
} from './forms-read.ts';

export { REDACTED } from './forms-privacy.ts';

export type FormKind = 'signal' | 'reactive' | 'template';
export type FieldStatus = 'VALID' | 'INVALID' | 'PENDING' | 'DISABLED';

export interface FormFieldError {
  kind: string;
  message: string;
  params?: Record<string, unknown>;
  source?: ErrorSource;
  from?: string;
}

export interface FormFieldNode {
  key: string;
  path: string;
  type: 'group' | 'array' | 'control';
  status: FieldStatus;
  touched: boolean;
  dirty: boolean;
  required?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  disabledReasons?: string[];
  updateOn?: 'blur' | 'submit';
  materialized?: false;
  bound: boolean;
  value?: unknown;
  constraints?: Record<string, number | string>;
  submitting?: boolean;
  debouncing?: boolean;
  validators?: { sync: boolean; async: boolean };
  defaultValue?: unknown;
  accessor?: string;
  errors: FormFieldError[];
  children?: FormFieldNode[];
  truncated?: number;
  uid?: string;
  skipped?: SkipReason;
  asyncWaiting?: boolean;
  inheritedDisabled?: number;
  hiddenBy?: 'self' | 'parent';
  readonlyBy?: 'self' | 'parent';
  rules?: RuleCounts;
  validatorNames?: string[];
  asyncValidatorNames?: string[];
  stale?: string[];
  uncommitted?: unknown;
  modelDrift?: { model: unknown; viewModel: unknown };
  changed?: boolean;
  binding?: BindingInfo;
  dom?: DomFacts;
  redacted?: RedactReason;
  pendingSince?: number;
  name?: string;
  metadata?: unknown[];
}

export interface FormErrorSummary {
  path: string;
  kind: string;
  message: string;
}

export interface CollectedForm {
  id: string;
  kind: FormKind;
  owner: string;
  property?: string;
  label: string;
  submitted?: boolean;
  submit?: SubmitSetup;
  submitDom?: SubmitDom;
  errorSummary?: FormErrorSummary[];
  webMcp?: WebMcpTool;
  root: FormFieldNode;
}

export interface FormEvent {
  formId: string;
  path: string;
  type:
    | 'value'
    | 'status'
    | 'touched'
    | 'dirty'
    | 'submit'
    | 'reset'
    | 'added'
    | 'removed'
    | 'moved'
    | 'validators';
  detail?: string;
  timestamp: number;
  seq?: number;
  origin?: EventOrigin;
  caller?: string;
  prev?: string;
  count?: number;
  outcome?: 'ran' | 'blocked' | 'threw' | 'busy';
  ms?: number;
  renders?: number;
  rendered?: string[];
}

export type EventOrigin = 'user' | 'code' | 'devtools' | 'binding' | 'agent';

export interface FormsDebugApi {
  getComponent(el: Element): unknown;
  getDirectives(el: Element): unknown[];
  getOwningComponent(el: Element): unknown;
  getListeners?(el: Element): { name: string; type?: string; callback?: unknown }[];
}

export interface FoundForm {
  kind: FormKind;
  root: AnyRecord;
  owner: unknown;
  property?: string;
  directive?: AnyRecord;
  element?: Element;
  formElement?: Element;
  submitListener?: boolean;
}

export interface FoundForms {
  forms: FoundForm[];
  elements: WeakMap<object, Element>;
  hosts?: Element[];
}

const MAX_DEPTH = 8;
const MAX_CHILDREN = 100;
const MAX_STRING = 200;
const MAX_VALUE_ITEMS = 20;
const MAX_VALUE_DEPTH = 3;
const MAX_DETAIL = 120;

type AnyRecord = Record<string, any>;

const accessorNames = new WeakMap<object, string>();
const controlDirectives = new WeakMap<object, AnyRecord>();
const uids = new WeakMap<object, string>();
const baselines = new WeakMap<object, string>();
let nextUid = 0;
let secrets: SecretSet | null = null;
let formSecrets = new Map<string, SecretSet>();
let collectRound = 0;
let collecting = false;
const viewDrift = new WeakMap<object, { round: number; key: string }>();
const modelDrift = new WeakMap<object, { round: number; key: string }>();

function steady(
  seen: WeakMap<object, { round: number; key: string }>,
  target: object,
  key: string | undefined,
): boolean {
  if (key === undefined) {
    if (collecting) seen.delete(target);
    return false;
  }
  if (!collecting) return true;
  const previous = seen.get(target);
  seen.set(target, { round: collectRound, key });
  return !!previous && previous.key === key && previous.round === collectRound - 1;
}

function keepViewDrift(target: object, dom: DomFacts, binding: BindingInfo | undefined) {
  const native = binding?.kind === 'native' || binding?.kind === 'signal-field';
  const key = native && dom.drift !== undefined ? JSON.stringify(dom.drift) : undefined;
  if (!steady(viewDrift, target, key)) delete dom.drift;
}

function uidOf(target: object): string {
  let uid = uids.get(target);
  if (!uid) {
    uid = `f${++nextUid}`;
    uids.set(target, uid);
  }
  return uid;
}

function changedOf(target: object, value: unknown, dirty: boolean): boolean | undefined {
  const text = JSON.stringify(serializeFormValue(value)) ?? 'undefined';
  if (!dirty || !baselines.has(target)) {
    baselines.set(target, text);
    return undefined;
  }
  return baselines.get(target) !== text;
}

function remember(value: unknown, seen = new WeakSet<object>()) {
  if (!secrets) return;
  if (value && typeof value === 'object') {
    if (seen.has(value)) return;
    seen.add(value);
    for (const item of Object.values(value).slice(0, 50)) remember(item, seen);
  } else secrets.add(value);
}

function withOrigin(error: FormFieldError, origin: ErrorOrigin | undefined): FormFieldError {
  if (!origin) return error;
  return origin.from !== undefined
    ? { ...error, source: origin.source, from: origin.from }
    : { ...error, source: origin.source };
}

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function isAbstractControl(value: unknown): value is AnyRecord {
  if (!value || typeof value !== 'object') return false;
  const v = value as AnyRecord;
  return read(
    () =>
      typeof v['getRawValue'] === 'function' &&
      typeof v['setParent'] === 'function' &&
      typeof v['updateValueAndValidity'] === 'function' &&
      'status' in v,
    false,
  );
}

export function isFieldTree(value: unknown): value is () => AnyRecord {
  if (typeof value !== 'function') return false;
  const source = read(() => Function.prototype.toString.call(value), '');
  if (!source.includes('[native code]')) return false;
  const length = read(() => Reflect.getOwnPropertyDescriptor(value, 'length'), undefined);
  if (length && !length.enumerable && !length.writable) return false;
  return read(() => {
    const node = (value as () => AnyRecord)();
    return (
      !!node &&
      typeof node['keyInParent'] === 'function' &&
      typeof node['formFieldBindings'] === 'function' &&
      !!node['structure']?.root
    );
  }, false);
}

function selectorsOf(directive: unknown): Set<string> {
  const def = (directive as AnyRecord | null)?.['constructor']?.['ɵdir'];
  const selectors: unknown = def?.['selectors'];
  const tokens = new Set<string>();
  if (!Array.isArray(selectors)) return tokens;
  for (const selector of selectors) {
    if (!Array.isArray(selector)) continue;
    for (const token of selector) {
      if (typeof token !== 'string') break;
      if (token) tokens.add(token);
    }
  }
  return tokens;
}

const TEMPLATE_SELECTORS = ['ngModel', 'ngForm', 'ngModelGroup'];
const CONTROL_SELECTORS = ['ngModel', 'formControl', 'formControlName'];

function isTemplateDirective(selectors: Set<string>): boolean {
  return TEMPLATE_SELECTORS.some((token) => selectors.has(token));
}

export function detailOf(value: unknown): string {
  return clip(JSON.stringify(value) ?? 'undefined', MAX_DETAIL);
}

export function isSensitive(key: string, element?: Element | null): boolean {
  return !!redactReason(key, element);
}

function isoOf(date: Date): string {
  return Number.isNaN(date.getTime()) ? 'Invalid Date' : date.toISOString();
}

export function serializeFormValue(value: unknown, depth = 0): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value === 'string') return clip(value, MAX_STRING);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'function') return 'ƒ';
  if (value instanceof Date) return isoOf(value);
  if (typeof value !== 'object') return String(value);
  if (typeof Node !== 'undefined' && value instanceof Node)
    return `<${value.nodeName.toLowerCase()}>`;
  if (value instanceof Map) value = Object.fromEntries(value);
  else if (value instanceof Set) value = Array.from(value);
  if (depth >= MAX_VALUE_DEPTH) {
    return Array.isArray(value) ? `[${value.length} items]` : '{…}';
  }
  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_VALUE_ITEMS)
      .map((item) => serializeFormValue(item, depth + 1));
    if (value.length > MAX_VALUE_ITEMS) items.push(`… ${value.length - MAX_VALUE_ITEMS} more`);
    return items;
  }
  const out: Record<string, unknown> = {};
  const keys = Object.keys(value as object).filter((key) => !key.startsWith('__ng'));
  for (const key of keys.slice(0, MAX_VALUE_ITEMS)) {
    out[key] = isRedactedKey(key)
      ? REDACTED
      : serializeFormValue(
          read(() => (value as AnyRecord)[key], undefined),
          depth + 1,
        );
  }
  if (keys.length > MAX_VALUE_ITEMS) out['…'] = `${keys.length - MAX_VALUE_ITEMS} more keys`;
  return out;
}

const DROPPED_PARAMS = [
  'fieldTree',
  'formField',
  'control',
  'context',
  'kind',
  'actualValue',
  'value',
];

function errorParams(detail: unknown): Record<string, unknown> | undefined {
  if (!detail || typeof detail !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(detail as AnyRecord)) {
    if (DROPPED_PARAMS.includes(key)) continue;
    if (val instanceof RegExp) out[key] = val.source;
    else if (val instanceof Date) out[key] = isoOf(val);
    else if (val === null || ['string', 'number', 'boolean'].includes(typeof val)) out[key] = val;
  }
  return Object.keys(out).length ? out : undefined;
}

const has = (p: Record<string, unknown>) =>
  p['actualLength'] !== undefined ? ` (has ${p['actualLength']})` : '';

const errorText: Record<string, (p: Record<string, unknown>, items: boolean) => string> = {
  required: () => 'is required',
  email: () => 'is not a valid email address',
  minlength: (p, items) =>
    `needs at least ${p['requiredLength']} ${items ? 'items' : 'characters'}${has(p)}`,
  maxlength: (p, items) =>
    `allows at most ${p['requiredLength']} ${items ? 'items' : 'characters'}${has(p)}`,
  minLength: (p, items) => `needs at least ${p['minLength']} ${items ? 'items' : 'characters'}`,
  maxLength: (p, items) => `allows at most ${p['maxLength']} ${items ? 'items' : 'characters'}`,
  min: (p) =>
    `must be at least ${p['min']}${p['actual'] !== undefined ? ` (is ${p['actual']})` : ''}`,
  max: (p) =>
    `must be at most ${p['max']}${p['actual'] !== undefined ? ` (is ${p['actual']})` : ''}`,
  minDate: (p) => `must be on or after ${p['minDate'] ?? p['min']}`,
  maxDate: (p) => `must be on or before ${p['maxDate'] ?? p['max']}`,
  pattern: (p) => `must match ${p['requiredPattern'] ?? p['pattern']}`,
  parse: () => 'could not be parsed',
};

export function describeError(
  error: { kind: string; message?: string; params?: Record<string, unknown> },
  type: FormFieldNode['type'] = 'control',
): string {
  if (error.message) return error.message;
  const params = error.params ?? {};
  if (typeof params['message'] === 'string') return params['message'];
  const describe = errorText[error.kind];
  return describe ? describe(params, type === 'array') : `fails the "${error.kind}" validator`;
}

function toError(
  kind: string,
  params: Record<string, unknown> | undefined,
  type: FormFieldNode['type'],
  message?: string,
): FormFieldError {
  const text = describeError({ kind, message, params }, type);
  if (!params || !('message' in params)) return { kind, params, message: text };
  const { message: _, ...rest } = params;
  return { kind, params: Object.keys(rest).length ? rest : undefined, message: text };
}

const VALUE_PARAMS = ['actual', 'actualLength'];

function withoutValues(params: Record<string, unknown> | undefined, secret: boolean) {
  if (!secret || !params) return params;
  const rest = Object.fromEntries(
    Object.entries(params).filter(([key]) => !VALUE_PARAMS.includes(key)),
  );
  return Object.keys(rest).length ? rest : undefined;
}

function controlErrors(
  control: AnyRecord,
  type: FormFieldNode['type'],
  secret: boolean,
): FormFieldError[] {
  const errors = read(() => control['errors'] as AnyRecord | null, null);
  if (!errors) return [];
  return Object.entries(errors).map(([kind, detail]) =>
    typeof detail === 'string' && detail
      ? { kind, message: detail }
      : toError(kind, withoutValues(errorParams(detail), secret), type),
  );
}

function controlType(control: AnyRecord): FormFieldNode['type'] {
  const controls = read(() => control['controls'], undefined);
  if (Array.isArray(controls)) return 'array';
  if (controls && typeof controls === 'object') return 'group';
  return 'control';
}

function signalTreeOf(control: AnyRecord): (() => AnyRecord) | null {
  const tree = read(() => control['fieldTree'], undefined);
  return isFieldTree(tree) ? tree : null;
}

function rootOf(value: unknown): { kind: FormKind; root: AnyRecord } | null {
  const control = isAbstractControl(value) ? read(() => value['root'] as AnyRecord, value) : null;
  const tree = isFieldTree(value) ? value : control ? signalTreeOf(control) : null;
  if (tree) {
    const root = read(() => tree()['structure'].root as AnyRecord, null);
    return root && { kind: 'signal', root };
  }
  return control && { kind: 'reactive', root: control };
}

export function serializeControl(
  control: AnyRecord,
  elements: WeakMap<object, Element> = new WeakMap(),
  key = '',
  path = '',
  depth = 0,
  parentSecret = false,
): FormFieldNode {
  const tree = signalTreeOf(control);
  if (tree) return serializeField(tree(), elements, key, path, depth, parentSecret);
  const type = controlType(control);
  const updateOn = read(() => control['updateOn'], 'change');
  const element = elements.get(control);
  const reason: RedactReason | null = parentSecret ? 'parent' : redactReason(key, element);
  const secret = !!reason;
  const dir = controlDirectives.get(control);
  const facts = read(() => controlFacts(control, dir, type === 'control'), { origins: {} });
  const status = read(() => control['status'], 'VALID') as FieldStatus;
  const dirty = !!read(() => control['dirty'], false);
  const node: FormFieldNode = {
    key,
    path,
    type,
    status,
    touched: !!read(() => control['touched'], false),
    dirty,
    bound: !!element,
    errors: controlErrors(control, type, secret).map((e) => withOrigin(e, facts.origins[e.kind])),
    uid: uidOf(control),
  };
  if (reason) node.redacted = reason;
  if (updateOn === 'blur' || updateOn === 'submit') node.updateOn = updateOn;
  const sync = !!read(() => control['validator'], null);
  const async = !!read(() => control['asyncValidator'], null);
  if (sync || async) node.validators = { sync, async };
  if (facts.validators) node.validatorNames = facts.validators;
  if (facts.asyncValidators) node.asyncValidatorNames = facts.asyncValidators;
  if (facts.stale) node.stale = facts.stale;
  if (dir) node.binding = directiveBinding(dir, element);
  if (type === 'control') {
    const raw = read(() => control['value'], undefined);
    if (secret) {
      remember(raw);
      if (facts.pending) remember(facts.pending.value);
    }
    node.value = secret ? REDACTED : serializeFormValue(raw);
    if ('defaultValue' in control) {
      node.defaultValue = secret ? REDACTED : serializeFormValue(control['defaultValue']);
    }
    if (facts.pending) {
      node.uncommitted = secret ? REDACTED : serializeFormValue(facts.pending.value);
    }
    const unbound = !!element?.hasAttribute('ngmodel');
    const driftKey =
      facts.model && !unbound
        ? (JSON.stringify(serializeFormValue(facts.model)) ?? 'undefined')
        : undefined;
    if (facts.model && steady(modelDrift, control, driftKey)) {
      node.modelDrift = secret
        ? { model: REDACTED, viewModel: REDACTED }
        : {
            model: serializeFormValue(facts.model.model),
            viewModel: serializeFormValue(facts.model.viewModel),
          };
    }
    const changed = changedOf(control, raw, dirty);
    if (changed !== undefined) node.changed = changed;
    const accessor = accessorNames.get(control);
    if (accessor) node.accessor = accessor;
    if (element) {
      node.dom = domFacts(element, {
        value: facts.pending ? facts.pending.value : raw,
        disabled: status === 'DISABLED',
        secret,
        hasErrors: node.errors.length > 0,
      });
      keepViewDrift(control, node.dom, node.binding);
    }
    return node;
  }
  const controls = read(() => control['controls'] as AnyRecord, {});
  const entries: [string, AnyRecord][] = Array.isArray(controls)
    ? controls.map((child, index) => [String(index), child])
    : Object.entries(controls);
  if (depth >= MAX_DEPTH) {
    node.truncated = entries.length;
    return node;
  }
  node.children = entries
    .slice(0, MAX_CHILDREN)
    .map(([childKey, child]) =>
      serializeControl(
        child,
        elements,
        childKey,
        path ? `${path}.${childKey}` : childKey,
        depth + 1,
        secret,
      ),
    );
  if (entries.length > MAX_CHILDREN) node.truncated = entries.length - MAX_CHILDREN;
  return node;
}

function fieldStatus(state: AnyRecord): FieldStatus {
  if (read(() => state['disabled'](), false)) return 'DISABLED';
  if (read(() => state['invalid'](), false)) return 'INVALID';
  if (read(() => state['pending'](), false)) return 'PENDING';
  return 'VALID';
}

function fieldErrors(
  state: AnyRecord,
  type: FormFieldNode['type'],
  secret: boolean,
): FormFieldError[] {
  const errors = read(() => state['errors']() as AnyRecord[], []);
  const origins = errors.length ? read(() => signalErrorOrigins(state), new Map()) : new Map();
  return errors.map((error) => withOrigin(signalError(error, type, secret), origins.get(error)));
}

function issuePath(issue: AnyRecord): string | undefined {
  const parts = read(() => (Array.isArray(issue['path']) ? (issue['path'] as unknown[]) : []), []);
  const keys = parts.map((part) =>
    part && typeof part === 'object' ? String((part as AnyRecord)['key']) : String(part),
  );
  return keys.length ? keys.join('.') : undefined;
}

function signalError(
  error: AnyRecord,
  type: FormFieldNode['type'],
  secret: boolean,
): FormFieldError {
  const kind = String(read(() => error['kind'], 'error'));
  const issue =
    kind === 'standardSchema' ? read(() => error['issue'] as AnyRecord | null, null) : null;
  const own = read(() => error['message'], undefined);
  const fromIssue = read(() => issue?.['message'], undefined);
  const message =
    typeof own === 'string' && own
      ? own
      : typeof fromIssue === 'string' && fromIssue
        ? fromIssue
        : undefined;
  let params = withoutValues(errorParams(error), secret);
  const path = issue ? issuePath(issue) : undefined;
  if (path) params = { ...params, path };
  return toError(kind, params, type, message);
}

export function errorSummaryOf(root: AnyRecord): FormErrorSummary[] {
  const errors = read(() => root['errorSummary']() as AnyRecord[], []);
  return errors.slice(0, 50).map((error) => {
    const target = read(() => error['fieldTree']() as AnyRecord, null);
    const path = target ? fieldPath(target) : '';
    const secret = path.split('.').some((key) => isRedactedKey(key));
    const { kind, message } = signalError(error, 'control', secret);
    return { path, kind, message };
  });
}

function valueType(value: unknown): FormFieldNode['type'] {
  if (Array.isArray(value)) return 'array';
  if (value && typeof value === 'object' && !(value instanceof Date)) return 'group';
  return 'control';
}

function unmaterializedField(
  value: unknown,
  key: string,
  path: string,
  parentSecret: boolean,
): FormFieldNode {
  const reason: RedactReason | null = parentSecret ? 'parent' : redactReason(key);
  const node: FormFieldNode = {
    key,
    path,
    type: valueType(value),
    status: 'VALID',
    touched: false,
    dirty: false,
    bound: false,
    materialized: false,
    value: reason ? REDACTED : serializeFormValue(value),
    errors: [],
  };
  if (reason) node.redacted = reason;
  return node;
}

const CONSTRAINTS = ['min', 'max', 'minLength', 'maxLength'];

function fieldConstraints(state: AnyRecord): Record<string, number | string> | undefined {
  const out: Record<string, number | string> = {};
  for (const name of CONSTRAINTS) {
    const value = read(() => state[name]?.() as unknown, undefined);
    if (typeof value === 'number' || typeof value === 'string') out[name] = value;
    else if (value instanceof Date) out[name] = isoOf(value);
  }
  const patterns = read(() => state['pattern']() as RegExp[], []);
  if (patterns.length) out['pattern'] = patterns.map((p) => p.source).join(' | ');
  return Object.keys(out).length ? out : undefined;
}

function fieldElement(state: AnyRecord, elements: WeakMap<object, Element>): Element | undefined {
  const bindings = read(() => state['formFieldBindings']() as AnyRecord[], []);
  const bound = bindings[0]?.['element'] as Element | undefined;
  if (bound) return bound;
  const control = read(() => state['control']?.() as AnyRecord | undefined, undefined);
  return control ? elements.get(control) : undefined;
}

export function serializeField(
  state: AnyRecord,
  elements: WeakMap<object, Element> = new WeakMap(),
  key = '',
  path = '',
  depth = 0,
  parentSecret = false,
): FormFieldNode {
  const compat = read(() => state['control']?.() as unknown, undefined);
  if (isAbstractControl(compat) && controlType(compat) !== 'control') {
    return serializeControl(compat, elements, key, path, depth, parentSecret);
  }
  const value = read(() => state['value'](), undefined);
  const type = valueType(value);
  const element = fieldElement(state, elements);
  const reason: RedactReason | null = parentSecret ? 'parent' : redactReason(key, element);
  const secret = !!reason;
  const dirty = !!read(() => state['dirty'](), false);
  const node: FormFieldNode = {
    key,
    path,
    type,
    status: fieldStatus(state),
    touched: !!read(() => state['touched'](), false),
    dirty,
    required: !!read(() => state['required'](), false),
    readonly: !!read(() => state['readonly'](), false),
    hidden: !!read(() => state['hidden'](), false),
    bound: !!element,
    errors: fieldErrors(state, type, secret),
    uid: uidOf(state),
    ...read(() => signalFacts(state), {}),
  };
  if (reason) node.redacted = reason;
  if (element) node.binding = read(() => fieldBinding(state), { kind: 'none' as const });
  const name = read(() => state['name']() as unknown, undefined);
  if (typeof name === 'string' && name) node.name = name;
  const metadata = read(() => metadataValues(state), []);
  if (metadata.length) {
    node.metadata = secret
      ? metadata.map(() => REDACTED)
      : metadata.map((v) => serializeFormValue(v));
  }
  const reasons = read(() => state['disabledReasons']() as AnyRecord[], []);
  if (reasons.length) {
    node.disabledReasons = reasons.map((r) =>
      typeof r?.['message'] === 'string' ? r['message'] : 'disabled',
    );
  }
  const constraints = fieldConstraints(state);
  if (constraints) node.constraints = constraints;
  if (!path && read(() => state['submitting'](), false)) node.submitting = true;
  if (type === 'control') {
    const buffered = read(() => state['controlValue'](), value);
    if (secret) {
      remember(value);
      remember(buffered);
    }
    node.value = secret ? REDACTED : serializeFormValue(value);
    if (!Object.is(buffered, value)) {
      node.debouncing = true;
      node.uncommitted = secret ? REDACTED : serializeFormValue(buffered);
    }
    const changed = changedOf(state, value, dirty);
    if (changed !== undefined) node.changed = changed;
    if (element) {
      node.dom = domFacts(element, {
        value: buffered,
        disabled: node.status === 'DISABLED',
        secret,
        hasErrors: node.errors.length > 0,
      });
      keepViewDrift(state, node.dom, node.binding);
    }
    return node;
  }
  const keys = Object.keys(value as object);
  if (depth >= MAX_DEPTH) {
    node.truncated = keys.length;
    return node;
  }
  const created = new Map<string, AnyRecord>();
  for (const child of read(() => state['structure'].materializedChildren() as AnyRecord[], [])) {
    created.set(String(read(() => child['keyInParent'](), '')), child);
  }
  const fieldKeys = keys.filter(
    (childKey) => created.has(childKey) || (value as AnyRecord)[childKey] !== undefined,
  );
  node.children = fieldKeys.slice(0, MAX_CHILDREN).map((childKey) => {
    const childPath = path ? `${path}.${childKey}` : childKey;
    const child = created.get(childKey);
    return child
      ? serializeField(child, elements, childKey, childPath, depth + 1, secret)
      : unmaterializedField((value as AnyRecord)[childKey], childKey, childPath, secret);
  });
  if (fieldKeys.length > MAX_CHILDREN) node.truncated = fieldKeys.length - MAX_CHILDREN;
  return node;
}

export function formIdFor(label: string): string {
  const id = label
    .replace(/ #(\d+)$/, '~$1')
    .replace(/[@\s]+/g, '_')
    .slice(0, 120);
  return id || 'form';
}

export function createFormIds(pageId: string) {
  const assigned = new WeakMap<object, string>();
  const used = new Set<string>();
  return (forms: FoundForm[], labels: Map<object, string>): WeakMap<object, string> => {
    for (const form of forms) {
      if (assigned.has(form.root)) continue;
      const base = formIdFor(labels.get(form.root) ?? 'form');
      const stem = base.replace(/~\d+$/, '');
      let id = `${base}@${pageId}`;
      for (let n = 2; used.has(id); n++) id = `${stem}~${n}@${pageId}`;
      used.add(id);
      assigned.set(form.root, id);
    }
    return assigned;
  };
}

function ownerName(owner: unknown): string {
  const name = read(() => (owner as AnyRecord | null)?.['constructor']?.['name'], undefined);
  return typeof name === 'string' && name ? name.replace(/^_+/, '') : 'Unknown';
}

function ownValues(target: unknown): [string, unknown][] {
  if (!target || typeof target !== 'object') return [];
  const out: [string, unknown][] = [];
  for (const key of Object.keys(target)) {
    const desc = read(() => Object.getOwnPropertyDescriptor(target, key), undefined);
    if (desc && 'value' in desc) out.push([key, desc.value]);
  }
  return out;
}

export function propertyHolding(found: FoundForm): string | undefined {
  const values = ownValues(found.owner);
  const exact = values.find(
    ([, value]) => value === found.root || (!!found.directive && value === found.directive),
  );
  if (exact) return exact[0];
  return values.find(([, value]) => rootOf(value)?.root === found.root)?.[0];
}

function compatControls(root: AnyRecord): AnyRecord[] {
  const out: AnyRecord[] = [];
  const visit = (state: AnyRecord) => {
    const control = read(() => state['control']?.() as AnyRecord | undefined, undefined);
    if (isAbstractControl(control)) out.push(control);
    for (const child of read(() => state['structure'].materializedChildren() as AnyRecord[], [])) {
      visit(child);
    }
  };
  visit(root);
  return out;
}

export function findForms(ng: FormsDebugApi, elements: Iterable<Element>): FoundForms {
  const byRoot = new Map<object, FoundForm>();
  const controlElements = new WeakMap<object, Element>();
  const components = new Set<unknown>();
  const hosts: Element[] = [];
  const listensForSubmit = (el: Element) =>
    !(typeof HTMLFormElement !== 'undefined' && el instanceof HTMLFormElement) &&
    read(
      () =>
        (ng.getListeners?.(el) ?? []).some((listener, _index, all) =>
          listener.name === 'ngSubmit'
            ? listener.type !== 'dom'
            : listener.name === 'submit' &&
              listener.type !== 'output' &&
              (typeof (listener.callback as AnyRecord | undefined)?.['__ngNextListenerFn__'] ===
                'function' ||
                all.filter((other) => other.name === 'submit' && other.type !== 'output').length >
                  1),
        ),
      false,
    );

  const add = (found: FoundForm) => {
    const existing = byRoot.get(found.root);
    if (!existing) {
      byRoot.set(found.root, found);
      return;
    }
    existing.owner ??= found.owner;
    existing.directive ??= found.directive;
    existing.element ??= found.element;
    existing.formElement ??= found.formElement;
    existing.submitListener ||= found.submitListener;
  };

  for (const el of elements) {
    const component = read(() => ng.getComponent(el), null);
    if (component) components.add(component);
    const directives = read(() => ng.getDirectives(el) ?? [], [] as unknown[]);
    if (component || directives.length) hosts.push(el);
    const selectorSets = directives.map(selectorsOf);
    let owner: unknown;
    const ownerOf = () => (owner ??= read(() => ng.getOwningComponent(el) ?? null, null));
    directives.forEach((directive, index) => {
      const selectors = selectorSets[index];
      if (!selectors.size) return;
      const dir = directive as AnyRecord;
      if (selectors.has('formField') || selectors.has('formRoot')) {
        const tree = selectors.has('formRoot')
          ? read(() => dir['fieldTree']() as unknown, null)
          : null;
        const state = isFieldTree(tree) ? tree() : read(() => dir['state']() as AnyRecord, null);
        const root = read(() => state?.['structure'].root as AnyRecord, null);
        const element = selectors.has('formRoot') ? el : undefined;
        if (root) {
          add({
            kind: 'signal',
            root,
            owner: ownerOf(),
            element,
            formElement: element,
            submitListener: element ? listensForSubmit(element) : undefined,
          });
        }
        return;
      }
      const ownControl = read(() => dir['control'] as unknown, undefined);
      const control = read(() => (dir['form'] ?? ownControl) as unknown, null);
      if (!isAbstractControl(control)) return;
      const binds = CONTROL_SELECTORS.some((token) => selectors.has(token));
      if (binds && ownControl === control && !controlElements.has(control)) {
        controlElements.set(control, el);
        controlDirectives.set(control, dir);
        const accessor = read(
          () => String(dir['valueAccessor']?.constructor?.name ?? '').replace(/^_+/, ''),
          '',
        );
        if (accessor) accessorNames.set(control, accessor);
      }
      const template = isTemplateDirective(selectors);
      const isGroup = controlType(control) !== 'control';
      const empty = read(() => Object.keys(control['controls'] ?? {}).length === 0, false);
      if (template && isGroup && empty) return;
      const found = rootOf(control);
      if (!found) return;
      const isRootDirective = read(() => dir['form'], undefined) === found.root;
      add({
        kind: found.kind === 'signal' ? 'signal' : template ? 'template' : 'reactive',
        root: found.root,
        owner: ownerOf(),
        directive: isRootDirective ? dir : undefined,
        element: el,
        formElement: isRootDirective ? el : undefined,
        submitListener: isRootDirective ? listensForSubmit(el) : undefined,
      });
    });
  }

  for (const component of components) {
    for (const [key, value] of ownValues(component)) {
      const found = rootOf(value);
      if (found) add({ ...found, owner: component, property: key });
    }
  }

  const owned = new Set<object>();
  for (const form of byRoot.values()) {
    if (form.kind === 'signal') for (const control of compatControls(form.root)) owned.add(control);
  }
  const forms = Array.from(byRoot.values()).filter((form) => !owned.has(form.root));
  return { forms, elements: controlElements, hosts };
}

function fallbackName(found: FoundForm): string {
  const el = found.element;
  const attr = el && (el.getAttribute('name') || el.id);
  const isControl = found.kind !== 'signal' && controlType(found.root) === 'control';
  const base = isControl ? 'ngModel' : found.kind === 'template' ? 'ngForm' : 'form';
  if (isControl && attr) return `${base}(${attr})`;
  return attr ? `${base}#${attr}` : base;
}

export function formLabels(forms: FoundForm[]): Map<object, string> {
  const seen = new Map<string, number>();
  const labels = new Map<object, string>();
  for (const found of forms) {
    const property = found.property ?? propertyHolding(found);
    const label = `${ownerName(found.owner)}.${property ?? fallbackName(found)}`;
    const count = (seen.get(label) ?? 0) + 1;
    seen.set(label, count);
    labels.set(found.root, count > 1 ? `${label} #${count}` : label);
  }
  return labels;
}

export function collectForms(
  { forms, elements }: FoundForms,
  idOf?: (root: object, label: string) => string,
): CollectedForm[] {
  const kept = new Map<string, SecretSet>();
  const labels = formLabels(forms);
  collectRound++;
  collecting = true;
  try {
    const collected = forms.map((found) => collectOne(found, elements, labels, kept, idOf));
    formSecrets = kept;
    return collected;
  } finally {
    collecting = false;
  }
}

function collectOne(
  found: FoundForm,
  elements: WeakMap<object, Element>,
  labels: Map<object, string>,
  kept: Map<string, SecretSet>,
  idOf?: (root: object, label: string) => string,
): CollectedForm {
  const property = found.property ?? propertyHolding(found);
  const owner = ownerName(found.owner);
  const label = labels.get(found.root) ?? `${owner}.${property ?? fallbackName(found)}`;
  const id = idOf ? idOf(found.root, label) : formIdFor(label);
  const set = new SecretSet();
  secrets = set;
  kept.set(id, set);
  let root: FormFieldNode;
  let errorSummary: FormErrorSummary[] = [];
  try {
    root =
      found.kind === 'signal'
        ? serializeField(found.root, elements, property ?? '')
        : serializeControl(found.root, elements, property ?? '');
    if (found.kind === 'signal') errorSummary = read(() => errorSummaryOf(found.root), []);
    if (set.size) {
      redactTree(root, set);
      errorSummary = errorSummary.map((entry) => ({
        ...entry,
        message: set.redact(entry.message),
      }));
    }
  } finally {
    secrets = null;
  }
  const form: CollectedForm = {
    id,
    kind: found.kind,
    owner,
    property,
    label,
    submitted:
      found.kind === 'signal'
        ? undefined
        : read(() => found.directive?.['submitted'] as boolean | undefined, undefined),
    root,
  };
  if (found.kind === 'signal') form.submit = read(() => submitSetup(found.root), undefined);
  if (errorSummary.length) form.errorSummary = errorSummary;
  if (found.formElement) {
    const context = { valid: root.status === 'VALID', submitListener: found.submitListener };
    form.submitDom = read(() => submitDom(found.formElement!, context), undefined);
  }
  return form;
}

export function forgetFormSecrets(formIds: Iterable<string>) {
  for (const id of formIds) formSecrets.delete(id);
}

export function redactFormText(formId: string, text: string): string {
  return formSecrets.get(formId)?.redact(text) ?? redactMessage(text);
}

const STRUCTURAL_KEYS = new Set([
  'key',
  'path',
  'uid',
  'type',
  'status',
  'updateOn',
  'skipped',
  'hiddenBy',
  'readonlyBy',
  'redacted',
  'children',
]);

function redactTree(node: FormFieldNode, set: SecretSet) {
  const fields = node as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(fields)) {
    if (!STRUCTURAL_KEYS.has(key)) fields[key] = redactStrings(value, set, 0);
  }
  for (const child of node.children ?? []) redactTree(child, set);
}

function redactStrings(value: unknown, set: SecretSet, depth: number): unknown {
  if (typeof value === 'string') return set.redact(value);
  if (!value || typeof value !== 'object' || depth > 20) return value;
  if (Array.isArray(value)) return value.map((item) => redactStrings(item, set, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, redactStrings(item, set, depth + 1)]),
  );
}

function flatten(node: FormFieldNode, out = new Map<string, FormFieldNode>()) {
  out.set(node.path, node);
  for (const child of node.children ?? []) flatten(child, out);
  return out;
}

function byUid(node: FormFieldNode, out = new Map<string, FormFieldNode>()) {
  if (node.uid) out.set(node.uid, node);
  for (const child of node.children ?? []) byUid(child, out);
  return out;
}

function parentPath(path: string): string {
  return path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : '';
}

export function diffForms(
  previous: CollectedForm[],
  next: CollectedForm[],
  now = Date.now(),
): FormEvent[] {
  const before = new Map(previous.map((form) => [form.id, form]));
  const events: FormEvent[] = [];
  for (const form of next) {
    const prevForm = before.get(form.id);
    if (!prevForm) continue;
    const push = (path: string, type: FormEvent['type'], detail?: string) =>
      events.push({ formId: form.id, path, type, detail, timestamp: now });
    const old = flatten(prevForm.root);
    const current = flatten(form.root);
    const oldUids = byUid(prevForm.root);
    const currentUids = byUid(form.root);
    const find = (
      node: FormFieldNode,
      uids: Map<string, FormFieldNode>,
      paths: Map<string, FormFieldNode>,
    ) => (node.uid && uids.size ? uids.get(node.uid) : paths.get(node.path));
    const reportable = (
      node: FormFieldNode,
      paths: Map<string, FormFieldNode>,
      otherUids: Map<string, FormFieldNode>,
      otherPaths: Map<string, FormFieldNode>,
    ) => {
      if (!node.path) return false;
      const parent = paths.get(parentPath(node.path));
      return !!parent && parent.type !== 'array' && !!find(parent, otherUids, otherPaths);
    };
    const resized: string[] = [];
    for (const [path, node] of current) {
      const prev = old.get(path);
      if (node.type !== 'array' || prev?.type !== 'array') continue;
      const kids = node.children ?? [];
      const was = prev.children ?? [];
      if (currentUids.size && oldUids.size && [...kids, ...was].every((c) => !!c.uid)) {
        kids.forEach((child, index) => {
          const earlier = oldUids.get(child.uid!);
          if (!earlier) push(child.path, 'added', `inserted at ${index}`);
          else if (earlier.path !== child.path) {
            push(child.path, 'moved', `${earlier.path} → ${child.path}`);
          }
        });
        for (const child of was) {
          if (!currentUids.has(child.uid!)) push(child.path, 'removed', `was at ${child.key}`);
        }
        continue;
      }
      if (was.length !== kids.length) {
        resized.push(path);
        push(
          path,
          kids.length > was.length ? 'added' : 'removed',
          `${was.length} → ${kids.length} items`,
        );
      }
    }
    const inResized = (path: string) =>
      resized.some((array) => (array ? path.startsWith(`${array}.`) : path !== ''));
    for (const [path, node] of current) {
      if (inResized(path)) continue;
      const prev = find(node, oldUids, old);
      if (!prev) {
        if (reportable(node, current, oldUids, old)) push(path, 'added');
        continue;
      }
      if (node.type === 'control' && JSON.stringify(prev.value) !== JSON.stringify(node.value))
        push(path, 'value', detailOf(node.value));
      if (prev.status !== node.status) push(path, 'status', `${prev.status} → ${node.status}`);
      if (prev.touched !== node.touched) push(path, 'touched', String(node.touched));
      if (prev.dirty !== node.dirty) push(path, 'dirty', String(node.dirty));
    }
    for (const [path, node] of old) {
      if (inResized(path) || find(node, currentUids, current)) continue;
      if (reportable(node, old, currentUids, current)) push(path, 'removed');
    }
  }
  return events;
}

function valueOf(node: FormFieldNode): unknown {
  if (node.type === 'control' || !node.children) return node.value;
  const enabled =
    node.status === 'DISABLED'
      ? node.children
      : node.children.filter((child) => child.status !== 'DISABLED');
  const entries = enabled.map((child) => [child.key, valueOf(child)] as const);
  return node.type === 'array' ? entries.map(([, v]) => v) : Object.fromEntries(entries);
}

export function controlPathOf(root: AnyRecord, target: AnyRecord): string {
  const keys: string[] = [];
  let current: AnyRecord | null = target;
  while (current && current !== root) {
    const parent: AnyRecord | null = read(() => current!['parent'], null);
    if (!parent) return '';
    const controls = read(() => parent['controls'], {});
    const index = Array.isArray(controls) ? controls.indexOf(current) : -1;
    const key = Array.isArray(controls)
      ? index >= 0
        ? String(index)
        : undefined
      : Object.keys(controls).find((k) => controls[k] === current);
    if (key === undefined) return '';
    keys.unshift(key);
    current = parent;
  }
  return keys.join('.');
}

export interface ControlEventOptions {
  elements?: WeakMap<object, Element>;
  rootKey?: string;
  submitted?: boolean;
  now?: number;
}

export function controlEventOf(
  root: AnyRecord,
  formId: string,
  event: AnyRecord,
  { elements = new WeakMap(), rootKey = '', submitted, now = Date.now() }: ControlEventOptions = {},
): FormEvent | null {
  const source = read(() => event['source'] as AnyRecord, null);
  const path = source ? controlPathOf(root, source) : '';
  const base = { formId, path, timestamp: now };
  const of = (key: string) => read(() => (source ?? event)[key], event[key]);
  if ('value' in event) {
    const keys = [rootKey, ...(path ? path.split('.') : [])];
    const key = keys[keys.length - 1];
    const secret = keys.slice(0, -1).some((k) => isRedactedKey(k));
    const value = isAbstractControl(source)
      ? valueOf(serializeControl(source, elements, key, path, 0, secret))
      : serializeFormValue(of('value'));
    return { ...base, type: 'value', detail: detailOf(value) };
  }
  if ('status' in event) return { ...base, type: 'status', detail: String(of('status')) };
  if ('touched' in event) return { ...base, type: 'touched', detail: String(of('touched')) };
  if ('pristine' in event) return { ...base, type: 'dirty', detail: String(!of('pristine')) };
  const name = read(() => String(event['constructor']?.['name'] ?? ''), '');
  if (/Submit/.test(name)) return { ...base, path: '', type: 'submit' };
  if (/Reset/.test(name)) return { ...base, path: '', type: 'reset' };
  if (submitted === undefined || Object.keys(event).some((k) => k !== 'source')) return null;
  return { ...base, path: '', type: submitted ? 'submit' : 'reset' };
}

export function watchControlEvents(
  root: AnyRecord,
  formId: string,
  onEvent: (event: FormEvent) => void,
  options: {
    elements?: () => WeakMap<object, Element>;
    rootKey?: string;
    submitted?: () => boolean | undefined;
  } = {},
): (() => void) | null {
  const events = read(() => root['events'] as AnyRecord | undefined, undefined);
  if (!events || typeof events['subscribe'] !== 'function') return null;
  const subscription = read(
    () =>
      events['subscribe']((event: AnyRecord) => {
        if (isProbing()) return;
        const emit = () => {
          const mapped = read(
            () =>
              controlEventOf(root, formId, event, {
                elements: options.elements?.(),
                rootKey: options.rootKey,
                submitted: options.submitted?.(),
              }),
            null,
          );
          if (mapped) onEvent(mapped);
        };
        const name = read(() => String(event['constructor']?.['name'] ?? ''), '');
        const bare = Object.keys(event).every((key) => key === 'source');
        if (bare && !/Submit|Reset/.test(name)) queueMicrotask(emit);
        else emit();
      }) as AnyRecord,
    null,
  );
  return subscription ? () => read(() => subscription['unsubscribe'](), undefined) : null;
}

function childAt(node: AnyRecord, kind: FormKind, key: string): AnyRecord | null {
  if (kind === 'signal') {
    const children = read(() => node['structure'].materializedChildren() as AnyRecord[], []);
    return children.find((child) => read(() => String(child['keyInParent']()), '') === key) ?? null;
  }
  const controls = read(() => node['controls'], undefined);
  if (!controls) return null;
  return (Array.isArray(controls) ? controls[Number(key)] : controls[key]) ?? null;
}

export function nodeAt(
  found: Pick<FoundForm, 'root' | 'kind'>,
  path: string,
  create = false,
): AnyRecord | null {
  const keys = path ? path.split('.') : [];
  if (found.kind === 'signal' && create) {
    let tree: unknown = read(() => found.root['fieldTree'], null);
    for (const key of keys) {
      tree = read(() => (tree as AnyRecord)[key], null);
      if (typeof tree !== 'function') return null;
    }
    return read(() => (tree as () => AnyRecord)(), null);
  }
  let node: AnyRecord | null = found.root;
  for (const key of keys) node = node && childAt(node, found.kind, key);
  return node;
}

export function directivesOf(control: object): AnyRecord | undefined {
  return controlDirectives.get(control);
}

export function findFieldElement(
  ng: FormsDebugApi,
  elements: Iterable<Element>,
  found: Pick<FoundForm, 'root' | 'kind' | 'element'>,
  path: string,
  known: WeakMap<object, Element> = new WeakMap(),
): Element | null {
  let node: AnyRecord | null = found.root;
  for (const key of path ? path.split('.') : []) {
    node = node && childAt(node, found.kind, key);
  }
  if (!node) return null;
  let target: AnyRecord = node;
  if (found.kind === 'signal') {
    const bindings = read(() => node!['formFieldBindings']() as AnyRecord[], []);
    const bound = bindings[0]?.['element'] as Element | undefined;
    if (bound) return bound;
    const control = read(() => node!['control']?.() as AnyRecord | undefined, undefined);
    if (!control) return path ? null : (found.element ?? null);
    target = control;
  }
  const bound = known.get(target);
  if (bound) return bound;
  for (const el of elements) {
    const directives = read(() => ng.getDirectives(el) ?? [], [] as unknown[]);
    const match = directives.some((d) =>
      read(
        () => (d as AnyRecord)['control'] === target || (d as AnyRecord)['form'] === target,
        false,
      ),
    );
    if (match) return el;
  }
  return null;
}
