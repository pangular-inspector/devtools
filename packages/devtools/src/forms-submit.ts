import { childPath } from './forms-path.ts';
import { fieldPath } from './forms-read.ts';

/**
 * Says why a submit did not go through: which fields and which validators blocked
 * it, or which fields the submission action rejected. It only reads state that
 * Angular already computed for the submit, so no validator or action runs again.
 */

type AnyRecord = Record<string, any>;

const MAX_FIELDS = 6;
const MAX_NODES = 400;
const MAX_DEPTH = 8;
const MAX_MESSAGE = 60;

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function list<T = unknown>(fn: () => unknown): T[] {
  const value = read(fn, []);
  return Array.isArray(value) ? (value as T[]) : [];
}

interface FieldReasons {
  path: string;
  reasons: string[];
}

function addReason(out: Map<string, FieldReasons>, path: string, reason: string) {
  let entry = out.get(path);
  if (!entry) out.set(path, (entry = { path, reasons: [] }));
  if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
}

function describe(fields: FieldReasons[]): string {
  const shown = fields
    .slice(0, MAX_FIELDS)
    .map((f) => `${f.path || '(form)'} (${f.reasons.join(', ')})`);
  if (fields.length > MAX_FIELDS) shown.push(`${fields.length - MAX_FIELDS} more`);
  return shown.join(', ');
}

function quoted(message: unknown): string {
  if (typeof message !== 'string' || !message) return '';
  const short = message.length > MAX_MESSAGE ? `${message.slice(0, MAX_MESSAGE)}…` : message;
  return ` "${short}"`;
}

/** Walks a Signal Forms field tree through its materialized children. */
function walkSignal(root: AnyRecord, visit: (node: AnyRecord) => void) {
  let seen = 0;
  const step = (node: AnyRecord, depth: number) => {
    if (++seen > MAX_NODES) return;
    visit(node);
    if (depth >= MAX_DEPTH) return;
    for (const child of list<AnyRecord>(() => node['structure'].materializedChildren())) {
      step(child, depth + 1);
    }
  };
  step(root, 0);
}

function submissionErrorsOf(node: AnyRecord): AnyRecord[] {
  const value = read(() => node['submitState']['submissionErrors']() as unknown, undefined);
  if (Array.isArray(value)) return value as AnyRecord[];
  return value ? [value as AnyRecord] : [];
}

/**
 * Why `submit()` did not run a Signal Form's action: the fields with errors (by
 * validator kind, from `errorSummary()`), the fields still validating, and the
 * `ignoreValidators` mode that made them count. Empty when nothing explains it.
 */
export function signalSubmitBlockers(root: AnyRecord, ignoreValidators?: string): string {
  const fields = new Map<string, FieldReasons>();
  const submission = new Set<unknown>();
  walkSignal(root, (node) => {
    for (const error of submissionErrorsOf(node)) submission.add(error);
  });
  for (const error of list<AnyRecord>(() => root['errorSummary']())) {
    const node = read(() => error['fieldTree']() as AnyRecord, null);
    const path = node ? read(() => fieldPath(node), '') : '';
    const kind = read(() => String(error['kind'] ?? 'error'), 'error');
    addReason(fields, path, submission.has(error) ? `${kind} from the last submission` : kind);
  }
  const parts: string[] = [];
  if (fields.size) parts.push(describe([...fields.values()]));
  if (ignoreValidators === 'none') {
    const pending: FieldReasons[] = [];
    walkSignal(root, (node) => {
      const own = list(() => node['validationState']['asyncErrors']());
      if (own.includes('pending'))
        pending.push({ path: read(() => fieldPath(node), ''), reasons: ['async'] });
    });
    if (pending.length) {
      parts.push(
        `still validating (ignoreValidators: 'none' waits for them): ${describe(pending)}`,
      );
    }
  }
  return parts.join('; ');
}

/**
 * The errors a Signal Forms submission action returned, by field, read from each
 * field's `submitState.submissionErrors()` right after the action settled.
 */
export function signalSubmissionRejections(root: AnyRecord): string {
  const fields = new Map<string, FieldReasons>();
  walkSignal(root, (node) => {
    const errors = submissionErrorsOf(node);
    if (!errors.length) return;
    const path = read(() => fieldPath(node), '');
    for (const error of errors) {
      const kind = read(() => String(error?.['kind'] ?? 'error'), 'error');
      addReason(fields, path, `${kind}${quoted(read(() => error?.['message'], undefined))}`);
    }
  });
  return fields.size ? describe([...fields.values()]) : '';
}

function controlChildren(control: AnyRecord): [string, AnyRecord][] {
  const controls = read(() => control['controls'] as unknown, undefined);
  if (Array.isArray(controls)) return controls.map((c, i) => [String(i), c as AnyRecord]);
  if (controls && typeof controls === 'object') {
    return Object.entries(controls as Record<string, AnyRecord>);
  }
  return [];
}

/**
 * The invalid and pending controls of a reactive or template-driven form at submit,
 * with their error keys. `ngSubmit` fires anyway, so this says what the handler saw.
 */
export function controlSubmitBlockers(root: AnyRecord): string {
  const invalid: FieldReasons[] = [];
  const pending: FieldReasons[] = [];
  let seen = 0;
  const step = (control: AnyRecord, path: string, depth: number) => {
    if (++seen > MAX_NODES) return;
    const status = read(() => String(control['status']), '');
    if (status === 'DISABLED') return;
    const errors = read(() => control['errors'] as Record<string, unknown> | null, null);
    const keys = errors && typeof errors === 'object' ? Object.keys(errors) : [];
    if (keys.length) invalid.push({ path, reasons: keys });
    const children = depth < MAX_DEPTH ? controlChildren(control) : [];
    if (
      status === 'PENDING' &&
      !children.some(([, c]) => read(() => c['status'], '') === 'PENDING')
    )
      pending.push({ path, reasons: ['async'] });
    for (const [key, child] of children) step(child, childPath(path, key), depth + 1);
  };
  step(root, '', 0);
  const parts: string[] = [];
  if (invalid.length) parts.push(`invalid: ${describe(invalid)}`);
  if (pending.length) parts.push(`pending: ${describe(pending)}`);
  return parts.join('; ');
}

interface ActionWatch {
  root: AnyRecord;
  onThrow: (error: unknown) => void;
}

interface SharedAction {
  original: (...args: unknown[]) => unknown;
  wrapped: (...args: unknown[]) => unknown;
  watches: Set<ActionWatch>;
}

/**
 * The wrapper on each `submission` object. Apps can share one object between
 * forms (a module-level `{ action }`), so it is wrapped once and every form
 * that uses it registers here instead of wrapping the wrapper.
 */
const sharedActions = new WeakMap<object, SharedAction>();

/** The root field tree of a form, which Angular passes to the action as `detail.root`. */
function rootTreeOf(root: AnyRecord): unknown {
  return read(() => root['structure']['root']['fieldProxy'] ?? root['fieldProxy'], undefined);
}

/** The watches a throw belongs to: the form Angular says it submitted, or the only one. */
function watchesFor(shared: SharedAction, args: unknown[]): ActionWatch[] {
  const detail = args[1] as AnyRecord | undefined;
  const submitted = read(() => detail?.['root'], undefined) ?? args[0];
  const all = [...shared.watches];
  const own = submitted === undefined ? [] : all.filter((w) => rootTreeOf(w.root) === submitted);
  if (own.length) return own;
  return all.length === 1 ? all : [];
}

function notifyThrow(shared: SharedAction, args: unknown[], error: unknown) {
  for (const watch of watchesFor(shared, args)) {
    try {
      watch.onThrow(error);
    } catch {
      // A listener never changes what the app's action does.
    }
  }
}

/**
 * Wraps the submission action given to `form(..., { submission })` so a throw is
 * tied to its form even when the app catches the `submit()` promise. The wrapper
 * returns what the action returns, so the app sees no difference. A
 * `submission` object shared by several forms is wrapped once; a throw goes to
 * the form Angular submitted, and the original action comes back when the
 * last form using it restores. Returns the restore function, or null when
 * there is no action to wrap.
 */
export function wrapSubmitAction(
  root: AnyRecord,
  onThrow: (error: unknown) => void,
): { options: object; restore: () => void } | null {
  const options = read(
    () => root['structure']['fieldManager']['submitOptions'] as AnyRecord | undefined,
    undefined,
  );
  if (!options || typeof options !== 'object') return null;
  let shared = sharedActions.get(options);
  // The app put its own action in since; leave that one alone.
  if (shared && read(() => options['action'], undefined) !== shared.wrapped) {
    sharedActions.delete(options);
    shared = undefined;
  }
  if (!shared) {
    const original = read(() => options['action'] as unknown, undefined);
    if (typeof original !== 'function') return null;
    const entry: SharedAction = {
      original: original as SharedAction['original'],
      wrapped: () => undefined,
      watches: new Set(),
    };
    entry.wrapped = function (this: unknown, ...args: unknown[]) {
      let result: unknown;
      try {
        result = entry.original.apply(this, args);
      } catch (error) {
        notifyThrow(entry, args, error);
        throw error;
      }
      if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
        (result as PromiseLike<unknown>).then(undefined, (error) =>
          notifyThrow(entry, args, error),
        );
      }
      return result;
    };
    try {
      options['action'] = entry.wrapped;
    } catch {
      return null;
    }
    if (options['action'] !== entry.wrapped) return null;
    sharedActions.set(options, entry);
    shared = entry;
  }
  const entry = shared;
  const watch: ActionWatch = { root, onThrow };
  entry.watches.add(watch);
  return {
    options,
    restore: () => {
      if (!entry.watches.delete(watch) || entry.watches.size) return;
      if (sharedActions.get(options) === entry) sharedActions.delete(options);
      if (read(() => options['action'], undefined) === entry.wrapped) {
        try {
          options['action'] = entry.original;
        } catch {
          // A frozen options object keeps the wrapper, which only forwards.
        }
      }
    },
  };
}
