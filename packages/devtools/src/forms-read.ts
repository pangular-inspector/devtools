type AnyRecord = Record<string, any>;

export type ErrorSource =
  'parse' | 'own' | 'tree' | 'async' | 'submission' | 'schema' | 'directive' | 'manual';

export interface ErrorOrigin {
  source: ErrorSource;
  from?: string;
}

export type SkipReason = 'hidden' | 'disabled' | 'readonly' | 'orphaned';

export interface RuleCounts {
  sync?: number;
  tree?: number;
  async?: number;
  hidden?: number;
  disabled?: number;
  readonly?: number;
  metadata?: number;
}

export interface SignalFacts {
  skipped?: SkipReason;
  asyncWaiting?: boolean;
  inheritedDisabled?: number;
  hiddenBy?: 'self' | 'parent';
  readonlyBy?: 'self' | 'parent';
  rules?: RuleCounts;
}

export interface SubmitSetup {
  hasAction: boolean;
  hasOnInvalid: boolean;
  ignoreValidators?: string;
  submitting: boolean;
  willRun: boolean;
}

export interface ControlFacts {
  origins: Record<string, ErrorOrigin>;
  stale?: string[];
  validators?: string[];
  asyncValidators?: string[];
  pending?: { value: unknown };
  model?: { model: unknown; viewModel: unknown };
}

let probing = 0;
let probeEveryCollect = false;

interface Probe {
  validator: unknown;
  raw: unknown;
  dirFn: unknown;
  value: unknown;
  rootValue: unknown;
  at: number;
  fresh: string[];
  own: string[];
  dir: string[];
}

const probes = new WeakMap<object, Probe>();
const PROBE_TTL_MS = 5000;

export function probeEveryTime(on: boolean) {
  probeEveryCollect = on;
}

export function isProbing(): boolean {
  return probing > 0;
}

export function withoutEvents<T>(fn: () => T): T {
  probing++;
  try {
    return fn();
  } finally {
    probing--;
  }
}

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function list<T>(fn: () => unknown): T[] {
  const value = read(fn, []);
  return Array.isArray(value) ? (value as T[]) : [];
}

function parentOf(node: AnyRecord): AnyRecord | null {
  return read(() => (node['structure']['parent'] as AnyRecord) ?? null, null);
}

export function fieldPath(node: AnyRecord): string {
  const keys: string[] = [];
  let current: AnyRecord | null = node;
  for (let guard = 0; current && guard < 64; guard++) {
    const parent = parentOf(current);
    if (!parent) break;
    keys.unshift(String(read(() => current!['keyInParent'](), '?')));
    current = parent;
  }
  return keys.join('.');
}

function originLevel(node: AnyRecord, error: unknown, raw: string): AnyRecord {
  let level = node;
  for (let guard = 0; guard < 64; guard++) {
    const parent = parentOf(level);
    if (!parent) break;
    const inherited = list<unknown>(() => parent['validationState'][raw]());
    if (!inherited.includes(error)) break;
    level = parent;
  }
  return level;
}

export function signalErrorOrigins(node: AnyRecord): Map<unknown, ErrorOrigin> {
  const state = read(() => node['validationState'] as AnyRecord, null);
  const out = new Map<unknown, ErrorOrigin>();
  if (!state) return out;
  for (const error of list(() => state['parseErrors']())) out.set(error, { source: 'parse' });
  const submission = read(() => node['submitState']['submissionErrors'](), undefined);
  for (const error of Array.isArray(submission) ? submission : submission ? [submission] : []) {
    out.set(error, { source: 'submission' });
  }
  const self = fieldPath(node);
  for (const error of list(() => state['syncTreeErrors']())) {
    if (out.has(error)) continue;
    const from = fieldPath(originLevel(node, error, 'rawSyncTreeErrors'));
    out.set(error, from === self ? { source: 'tree' } : { source: 'tree', from });
  }
  for (const error of list(() => state['asyncErrors']())) {
    if (error === 'pending' || out.has(error)) continue;
    const from = fieldPath(originLevel(node, error, 'rawAsyncErrors'));
    out.set(error, from === self ? { source: 'async' } : { source: 'async', from });
  }
  for (const error of list<AnyRecord>(() => state['errors']())) {
    if (out.has(error)) continue;
    out.set(error, { source: error?.['kind'] === 'standardSchema' ? 'schema' : 'own' });
  }
  return out;
}

function ruleCount(logic: AnyRecord, name: string): number {
  return list(() => logic[name]['fns']).length;
}

export function ruleCounts(node: AnyRecord): RuleCounts | undefined {
  const logic = read(() => node['logicNode']['logic'] as AnyRecord, null);
  if (!logic) return undefined;
  const counts: RuleCounts = {};
  for (const [name, key] of [
    ['syncErrors', 'sync'],
    ['syncTreeErrors', 'tree'],
    ['asyncErrors', 'async'],
    ['hidden', 'hidden'],
    ['disabledReasons', 'disabled'],
    ['readonly', 'readonly'],
  ] as const) {
    const n = ruleCount(logic, name);
    if (n) counts[key] = n;
  }
  const metadata = read(() => (logic['metadata'] as Map<unknown, unknown>).size, 0);
  if (metadata) counts.metadata = metadata;
  return Object.keys(counts).length ? counts : undefined;
}

export function signalFacts(node: AnyRecord): SignalFacts {
  const facts: SignalFacts = {};
  const state = read(() => node['nodeState'] as AnyRecord, null);
  const parent = parentOf(node);
  const flag = (name: string) => !!read(() => state?.[name](), false);
  if (read(() => node['structure']['isOrphaned'](), false)) facts.skipped = 'orphaned';
  else if (flag('hidden')) facts.skipped = 'hidden';
  else if (flag('disabled')) facts.skipped = 'disabled';
  else if (flag('readonly')) facts.skipped = 'readonly';
  const inherited = parent ? list(() => parent['nodeState']['disabledReasons']()).length : 0;
  if (inherited) facts.inheritedDisabled = inherited;
  for (const name of ['hidden', 'readonly'] as const) {
    if (!flag(name)) continue;
    const byParent = !!parent && !!read(() => parent['nodeState'][name](), false);
    facts[name === 'hidden' ? 'hiddenBy' : 'readonlyBy'] = byParent ? 'parent' : 'self';
  }
  const rules = ruleCounts(node);
  if (rules) facts.rules = rules;
  const hasAsync = !!rules?.async || hasAncestorAsync(parent);
  if (hasAsync && !facts.skipped && !read(() => node['validationState']['syncValid'](), true)) {
    facts.asyncWaiting = true;
  }
  return facts;
}

function hasAncestorAsync(node: AnyRecord | null): boolean {
  for (let guard = 0; node && guard < 64; guard++) {
    if (
      ruleCount(
        read(() => node!['logicNode']['logic'], {}),
        'asyncErrors',
      )
    )
      return true;
    node = parentOf(node);
  }
  return false;
}

export function metadataKeyCount(node: AnyRecord): number {
  return read(() => Array.from(node['logicNode']['logic'].getMetadataKeys()).length, 0);
}

function isInternalMetadata(value: unknown): boolean {
  if (typeof value === 'function') return true;
  if (!value || typeof value !== 'object') return false;
  const record = value as AnyRecord;
  return (
    'reducer' in record ||
    typeof record['reload'] === 'function' ||
    (typeof record['value'] === 'function' && typeof record['status'] === 'function')
  );
}

export function metadataValues(node: AnyRecord): unknown[] {
  const keys = read(() => Array.from(node['logicNode']['logic'].getMetadataKeys()) as object[], []);
  if (!keys.length) return [];
  const builtIn = new Set<unknown>(
    ['required', 'minLength', 'maxLength', 'pattern', 'min', 'max'].map((name) =>
      read(() => node[name], undefined),
    ),
  );
  const out: unknown[] = [];
  for (const key of keys) {
    const entry = read(() => node['metadata'](key) as unknown, undefined);
    if (entry === undefined || builtIn.has(entry)) continue;
    const value =
      typeof entry === 'function' ? read(() => (entry as () => unknown)(), undefined) : entry;
    if (value === undefined || isInternalMetadata(value)) continue;
    out.push(value);
  }
  return out;
}

export function submitSetup(root: AnyRecord): SubmitSetup {
  const options = read(
    () => root['structure']['fieldManager']['submitOptions'] as AnyRecord | undefined,
    undefined,
  );
  const normalized = typeof options === 'function' ? { action: options } : options;
  const ignore = read(() => normalized?.['ignoreValidators'] as string | undefined, undefined);
  const submitting = !!read(() => root['submitState']['submitting'](), false);
  const valid = !!read(() => root['valid'](), false);
  const invalid = !!read(() => root['invalid'](), false);
  const passes = ignore === 'all' ? true : ignore === 'none' ? valid : !invalid;
  const setup: SubmitSetup = {
    hasAction: typeof normalized?.['action'] === 'function',
    hasOnInvalid: typeof normalized?.['onInvalid'] === 'function',
    submitting,
    willRun: !submitting && passes,
  };
  if (ignore) setup.ignoreValidators = ignore;
  return setup;
}

export function fnName(fn: unknown): string {
  const name = read(() => String((fn as AnyRecord)?.['name'] ?? ''), '');
  return name.replace(/^bound /, '').replace(/^_+/, '') || 'anonymous';
}

function asList(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function directiveName(item: unknown): string {
  if (typeof item === 'function') return fnName(item);
  const name = read(() => String((item as AnyRecord).constructor.name), '').replace(/^_+/, '');
  const base = name.replace(/Validator$/, '');
  return base ? base[0].toLowerCase() + base.slice(1) : 'directive';
}

export function validatorNames(
  control: AnyRecord,
  dir?: AnyRecord | null,
  kind: 'sync' | 'async' = 'sync',
): string[] {
  const raw = asList(
    read(() => control[kind === 'sync' ? '_rawValidators' : '_rawAsyncValidators'], null),
  );
  const dirFn = dir
    ? read(() => dir[kind === 'sync' ? 'validator' : 'asyncValidator'], null)
    : null;
  const dirItems = dir
    ? asList(read(() => dir[kind === 'sync' ? '_rawValidators' : '_rawAsyncValidators'], null))
    : [];
  const parseFn = dir ? read(() => dir['parseErrorsValidator'], null) : null;
  return raw.flatMap((fn) => {
    if (fn && fn === parseFn) return [];
    if (fn && fn === dirFn) return dirItems.map((item) => `${directiveName(item)} (template)`);
    return [fnName(fn)];
  });
}

function keysOf(errors: unknown): string[] {
  return errors && typeof errors === 'object' ? Object.keys(errors) : [];
}

function probeValidators(
  control: AnyRecord,
  validator: unknown,
  dirFn: unknown,
  parseFn: unknown,
): Probe {
  const raw = read(() => control['_rawValidators'], null);
  const value = read(() => control['value'], undefined);
  const rootValue = read(() => (control['root'] as AnyRecord | undefined)?.['value'], undefined);
  const cached = probes.get(control);
  const now = Date.now();
  if (
    !probeEveryCollect &&
    cached &&
    now - cached.at < PROBE_TTL_MS &&
    cached.validator === validator &&
    cached.raw === raw &&
    cached.dirFn === dirFn &&
    Object.is(cached.value, value) &&
    Object.is(cached.rootValue, rootValue)
  ) {
    return cached;
  }
  const run = (fn: unknown) =>
    typeof fn === 'function'
      ? keysOf(withoutEvents(() => read(() => (fn as (c: unknown) => unknown)(control), null)))
      : [];
  const ownFns = asList(raw).filter((fn) => fn !== dirFn && fn !== parseFn);
  const probe: Probe = {
    validator,
    raw,
    dirFn,
    value,
    rootValue,
    at: now,
    fresh: run(validator),
    own: ownFns.flatMap(run),
    dir: run(dirFn),
  };
  probes.set(control, probe);
  return probe;
}

export function controlFacts(
  control: AnyRecord,
  dir?: AnyRecord | null,
  isLeaf = true,
): ControlFacts {
  const facts: ControlFacts = { origins: {} };
  const errors = keysOf(read(() => control['errors'], null));
  const parseFn = dir ? read(() => dir['parseErrorsValidator'], null) : null;
  const parseKeys = new Set(
    typeof parseFn === 'function' ? keysOf(read(() => parseFn(control), null)) : [],
  );
  const validator = read(() => control['validator'] as ((c: unknown) => unknown) | null, null);
  const hasAsync = !!read(() => control['asyncValidator'], null);
  const status = read(() => String(control['status']), '');
  const canProbe = isLeaf && typeof validator === 'function' && status !== 'DISABLED';
  const dirFn = dir ? read(() => dir['validator'], null) : null;
  const probe = canProbe ? probeValidators(control, validator, dirFn, parseFn) : null;
  const fresh = probe ? new Set(probe.fresh) : null;
  const ownKeys = new Set(probe?.own ?? []);
  const dirKeys = new Set(probe?.dir ?? []);
  for (const key of errors) {
    if (parseKeys.has(key)) facts.origins[key] = { source: 'parse' };
    else if (ownKeys.has(key)) facts.origins[key] = { source: 'own' };
    else if (dirKeys.has(key)) facts.origins[key] = { source: 'directive' };
    else if (fresh ? fresh.has(key) : !!validator) facts.origins[key] = { source: 'own' };
    else if (hasAsync) facts.origins[key] = { source: 'async' };
    else facts.origins[key] = { source: 'manual' };
  }
  if (fresh && status !== 'PENDING') {
    const stale = Array.from(fresh).filter((key) => !errors.includes(key));
    if (stale.length) facts.stale = stale;
  }
  const sync = validatorNames(control, dir, 'sync');
  const async = validatorNames(control, dir, 'async');
  if (sync.length) facts.validators = sync;
  if (async.length) facts.asyncValidators = async;
  if (read(() => control['_pendingChange'] === true, false)) {
    facts.pending = { value: read(() => control['_pendingValue'], undefined) };
  }
  if (dir && read(() => 'viewModel' in dir && 'model' in dir, false)) {
    const model = read(() => dir['model'], undefined);
    const viewModel = read(() => dir['viewModel'], undefined);
    if (!Object.is(model, viewModel)) facts.model = { model, viewModel };
  }
  return facts;
}

export type BindingKind = 'native' | 'accessor' | 'custom-control' | 'signal-field' | 'none';

export interface BindingInfo {
  kind: BindingKind;
  accessor?: string;
  element?: string;
  count?: number;
  disabledHook?: boolean;
}

function nameOf(value: unknown): string {
  return read(() => String((value as AnyRecord).constructor.name), '').replace(/^_+/, '');
}

function tagOf(element: unknown): string | undefined {
  const tag = read(() => (element as Element).tagName?.toLowerCase(), undefined);
  return tag || undefined;
}

const BUILT_IN_ACCESSORS = new Set([
  'DefaultValueAccessor',
  'CheckboxControlValueAccessor',
  'NumberValueAccessor',
  'RangeValueAccessor',
  'RadioControlValueAccessor',
  'SelectControlValueAccessor',
  'SelectMultipleControlValueAccessor',
]);

export function directiveBinding(dir: AnyRecord, element?: Element): BindingInfo {
  if (read(() => dir['isCustomControlBased'] === true, false)) {
    return { kind: 'custom-control', element: tagOf(element) };
  }
  const accessor = read(() => dir['valueAccessor'] as AnyRecord | null, null);
  if (!accessor) return { kind: 'none', element: tagOf(element) };
  const name = nameOf(accessor);
  return {
    kind: BUILT_IN_ACCESSORS.has(name) ? 'native' : 'accessor',
    accessor: name,
    element: tagOf(element),
    disabledHook: typeof accessor['setDisabledState'] === 'function',
  };
}

export function fieldBinding(node: AnyRecord): BindingInfo {
  const bindings = list<AnyRecord>(() => node['formFieldBindings']());
  if (!bindings.length) return { kind: 'none' };
  const first = bindings[0];
  const accessors = list<AnyRecord>(() => first['controlValueAccessors']);
  const info: BindingInfo = accessors.length
    ? {
        kind: BUILT_IN_ACCESSORS.has(nameOf(accessors[0])) ? 'native' : 'accessor',
        accessor: nameOf(accessors[0]),
      }
    : { kind: 'signal-field' };
  const tag = tagOf(first['element']);
  if (tag) info.element = tag;
  if (bindings.length > 1) info.count = bindings.length;
  return info;
}
