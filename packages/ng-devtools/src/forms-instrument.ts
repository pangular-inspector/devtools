import { addProfilerListener } from './change-detection.ts';

type AnyRecord = Record<string, any>;

export interface InstrumentCall {
  method: string;
  target: AnyRecord;
  caller?: string;
  signalRoot?: AnyRecord;
}

export interface Instrumentation {
  addControl(control: AnyRecord): void;
  addSignalRoot(root: AnyRecord): void;
  forgetSignalRoot(root: object): void;
  stop(): void;
}

const VALUE_METHODS = ['setValue', 'patchValue', 'reset'];
const STRUCTURE_METHODS = [
  'push',
  'insert',
  'removeAt',
  'setControl',
  'addControl',
  'removeControl',
  'clear',
];
const STATE_METHODS = [
  'markAsTouched',
  'markAsUntouched',
  'markAsDirty',
  'markAsPristine',
  'markAllAsTouched',
  'enable',
  'disable',
  'setErrors',
];
export const VALIDATOR_METHODS = [
  'setValidators',
  'setAsyncValidators',
  'addValidators',
  'addAsyncValidators',
  'removeValidators',
  'removeAsyncValidators',
  'clearValidators',
  'clearAsyncValidators',
];
const METHODS = [...VALUE_METHODS, ...STRUCTURE_METHODS, ...STATE_METHODS, ...VALIDATOR_METHODS];

const FRAMEWORK =
  /@angular|node_modules|\.vite\/deps|rxjs|zone\.js|zone-|forms-(instrument|collector|actions)\.[mc]?[jt]s|ng-devtools\/(dist|src\/(?!__tests__))|<anonymous>|\(native\)/;
const FRAMEWORK_CLASS =
  /^(Abstract|Form|Ng|Default|Operator|Checkbox|Select|Radio|Number|Range|Subscriber|Safe|Consumer|Observable|Subject|EventEmitter|Zone|Object|Array|Function|Proxy|Promise|Router|Renderer|Dom|EventManager|ApplicationRef|ChangeDetection|ViewRef|ComponentRef|Injector|R3Injector|NodeInjector|Listener|Task|Scheduler|Interop|Signal|Field|Deep)/;
const FRAMEWORK_FUNCTION =
  /^(updateControl|setUp\w*|cleanUp\w*|syncPendingControls|next|onInvoke\w*|invoke\w*|run\w*|execute\w*|refresh\w*|detectChanges\w*|wrapListener\w*|handleEvent|dispatch\w*|callHook\w*|process\w*|flush\w*|tick|markViewDirty|emit|onChange|onTouched|writeValue|setValue|patchValue|reset|signal\w*|producer\w*|consumer\w*|wrapper|listener|anonymous)$/;

function frameName(line: string): { name: string; where: string } {
  const match = line.match(/^(.*?)\s*\((.*)\)$/) ?? line.match(/^(.*?)@(.*)$/);
  const name = (match ? match[1] : '').trim().replace(/^async\s+/, '');
  const where = (match ? match[2] : line)
    .replace(/^https?:\/\/[^/]+\//, '')
    .replace(/\?[^:]*(?=:\d)/, '');
  return { name, where };
}

function isFrameworkName(name: string): boolean {
  const bare = name.replace(/^new\s+/, '').replace(/^_+/, '');
  if (/_(HostBindingHandler|Template|Factory|Listener|listener)\b|^ɵ/.test(bare)) return true;
  if (bare.includes('.')) return FRAMEWORK_CLASS.test(bare);
  return FRAMEWORK_FUNCTION.test(bare.replace(/^_+/, ''));
}

export function callerFrom(
  stack: string | undefined,
  preferred: ReadonlySet<string> = new Set(),
): string | undefined {
  if (!stack) return undefined;
  const frames = stack
    .split('\n')
    .slice(1)
    .map((raw) => raw.trim().replace(/^at\s+/, ''))
    .filter((line) => line && !FRAMEWORK.test(line))
    .map(frameName);
  const format = ({ name, where }: { name: string; where: string }) =>
    (name ? `${name.replace(/^_+/, '')} (${where})` : where).slice(0, 200);
  const owned = frames.find(({ name }) => {
    const owner = name.replace(/^_+/, '').split('.')[0];
    return name.includes('.') && preferred.has(owner);
  });
  if (owned) return format(owned);
  const fallback = frames.find(({ name }) => name && !isFrameworkName(name));
  return fallback ? format(fallback) : undefined;
}

const WRAPPED = Symbol('ng-devtools-wrapped');

export function instrumentForms(
  onCall: (call: InstrumentCall) => void,
  preferred: ReadonlySet<string> = new Set(),
): Instrumentation {
  const restores: (() => void)[] = [];
  const seenProtos = new WeakSet<object>();
  const seenRoots = new WeakSet<object>();
  const signalRestores = new Map<object, { model: AnyRecord; restore: (() => void)[] }>();
  let depth = 0;

  const wrap = (
    holder: AnyRecord,
    method: string,
    signalRoot?: AnyRecord,
    into: (() => void)[] = restores,
  ) => {
    const original = holder[method];
    if (typeof original !== 'function' || original[WRAPPED]) return;
    const wrapper = function (this: AnyRecord, ...args: unknown[]) {
      if (depth === 0) {
        try {
          onCall({
            method,
            target: signalRoot ?? this,
            caller: callerFrom(new Error().stack, preferred),
            signalRoot,
          });
        } catch {
          // never break the app
        }
      }
      depth++;
      try {
        return original.apply(this, args);
      } finally {
        depth--;
      }
    };
    Object.defineProperty(wrapper, WRAPPED, { value: true });
    try {
      holder[method] = wrapper;
    } catch {
      return;
    }
    into.push(() => {
      if (holder[method] === wrapper) holder[method] = original;
    });
  };

  const forgetSignalRoot = (root: object) => {
    const entry = signalRestores.get(root);
    if (!entry) return;
    signalRestores.delete(root);
    seenRoots.delete(entry.model);
    for (const restore of entry.restore.splice(0).reverse()) restore();
  };

  const wrapPrototypes = (control: AnyRecord) => {
    for (
      let proto = Object.getPrototypeOf(control);
      proto && proto !== Object.prototype;
      proto = Object.getPrototypeOf(proto)
    ) {
      if (seenProtos.has(proto)) continue;
      seenProtos.add(proto);
      for (const method of METHODS) {
        if (Object.prototype.hasOwnProperty.call(proto, method)) wrap(proto, method);
      }
    }
  };

  return {
    addControl(control) {
      const visit = (node: AnyRecord, depth: number) => {
        wrapPrototypes(node);
        if (depth > 12) return;
        let controls: unknown;
        try {
          controls = node['controls'];
        } catch {
          return;
        }
        if (!controls || typeof controls !== 'object') return;
        for (const child of Object.values(controls as object)) {
          if (child && typeof child === 'object') visit(child as AnyRecord, depth + 1);
        }
      };
      visit(control, 0);
    },
    addSignalRoot(root) {
      const model = root?.['structure']?.['value'] as AnyRecord | undefined;
      if (!model || seenRoots.has(model)) return;
      seenRoots.add(model);
      const restore: (() => void)[] = [];
      signalRestores.set(root, { model, restore });
      for (const method of ['set', 'update']) wrap(model, method, root, restore);
    },
    forgetSignalRoot,
    stop() {
      for (const root of [...signalRestores.keys()]) forgetSignalRoot(root);
      for (const restore of restores.splice(0).reverse()) restore();
    },
  };
}

export const TEMPLATE_UPDATE_START = 2;

export interface RenderCounter {
  start(): void;
  take(): { total: number; top: string[] } | null;
  stop(): void;
}

export function countRenders(ng: AnyRecord, doc: Document = document): RenderCounter | null {
  let counts: Map<string, number> | null = null;
  const profiler = (event: number, instance: unknown) => {
    if (!counts || event !== TEMPLATE_UPDATE_START || !instance) return;
    if (!((instance as AnyRecord).constructor as AnyRecord | undefined)?.['ɵcmp']) return;
    const name = String((instance as AnyRecord).constructor?.name ?? '?').replace(/^_+/, '');
    counts.set(name, (counts.get(name) ?? 0) + 1);
  };
  const remove = addProfilerListener(ng, profiler, doc);
  if (!remove) return null;
  return {
    start() {
      counts = new Map();
    },
    take() {
      if (!counts) return null;
      const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      counts = null;
      const total = entries.reduce((sum, [, n]) => sum + n, 0);
      return total ? { total, top: entries.slice(0, 3).map(([name, n]) => `${name}×${n}`) } : null;
    },
    stop() {
      counts = null;
      remove();
    },
  };
}
