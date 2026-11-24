import { redactFormText } from './forms.ts';
import { TRUNCATED, redactText, serialize } from './serialize.ts';
import { childPath } from './forms-path.ts';
import { tokenName, type DebugNg } from './injector-tree.ts';
import {
  WEBMCP_GRACE_MS,
  type WebMcpCallEntry,
  type WebMcpEffectKey,
  type WebMcpOutcome,
  type WebMcpPageTool,
} from './webmcp-trace.ts';
import {
  WEBMCP_ZONE_KEY,
  enterWebMcpCall,
  trackWebMcpCall,
  untrackWebMcpCall,
} from './webmcp-call-context.ts';

export { noteWebMcpEffect, webMcpCallNow } from './webmcp-call-context.ts';

/** Longest a tried WebMCP tool may take to answer. */
export const RUN_TIMEOUT_MS = 10_000;

type AnyRecord = Record<string, any>;

export type { WebMcpOutcome };

export interface WebMcpCall {
  at: number;
  ms?: number;
  outcome: WebMcpOutcome;
  fields?: string[];
  detail?: string;
  /** Started from the panel's Try this tool, not by an agent. */
  tried?: boolean;
}

export interface WebMcpTool {
  name: string;
  description: string;
  status: 'registering' | 'registered' | 'failed';
  seen: 'register' | 'list' | 'error';
  error?: string;
  inputs?: string[];
  required?: string[];
  requiredChanged?: { path: string; now: boolean }[];
  blocking?: { path: string; reason: string }[];
  duplicate?: boolean;
  calls?: WebMcpCall[];
  /** The input schema agents see, through `serialize` (secret-named properties are masked). */
  schema?: unknown;
}

/** The answer of a tool run from the devtools (`try-webmcp`). */
export interface WebMcpRun {
  ok: boolean;
  text?: string;
  error?: string;
}

export interface WebMcpPage {
  modelContext: boolean;
  provided?: boolean;
  tools: WebMcpTool[];
}

export interface WebMcpForm {
  root: AnyRecord;
  formId: string;
  element?: Element;
}

/**
 * How a WebMCP call touched a form since the last push: `wrote` when its synchronous
 * `execute` ran on that form, `maybe` when a call wrote to a form it is not linked to yet,
 * `running` when that form's call was still running (an async submit).
 */
export type AgentTouch = 'wrote' | 'maybe' | 'running';

export interface WebMcpWatcher {
  active(): boolean;
  /** Takes the calls since the last push and says how they touched the form with this root. */
  takeActivity(): (root: object | undefined) => AgentTouch | undefined;
  link(root: object): void;
  /** Runs the tool linked to the form with this root, as the panel's Try this tool. */
  run(root: object, args: unknown): Promise<WebMcpRun>;
  describe(
    forms: WebMcpForm[],
    ng?: DebugNg,
  ): { forms: Map<object, WebMcpTool>; page?: WebMcpPage };
  /** Every tool and the page-wide call log, for the `webmcp` collector. */
  report(): {
    modelContext: boolean;
    tools: WebMcpPageTool[];
    calls: WebMcpCallEntry[];
    dropped: number;
  };
  /** How many calls the page-wide log keeps (`limits.webmcpCalls`). */
  setMaxCalls(max: number): void;
  stop(): void;
}

interface ToolRecord {
  name: string;
  description: string;
  status: WebMcpTool['status'];
  seen: WebMcpTool['seen'];
  error?: string;
  schema?: AnyRecord;
  shape?: string;
  annotations?: Record<string, unknown>;
  registeredAt?: number;
  /** The form `describe` linked it to. */
  formId?: string;
  calls: (WebMcpCall & { started: number })[];
  /** Calls the tool: the wrapped `execute`, or the browser's testing API for a listed tool. */
  execute?: (args: unknown) => unknown;
}

/** A call in the page-wide log; values are masked when it is reported. */
interface LogEntry {
  id: number;
  record: ToolRecord;
  at: number;
  started: number;
  ms?: number;
  outcome: WebMcpOutcome;
  args?: unknown;
  result?: unknown;
  detail?: string;
  caused: WebMcpEffectKey[];
  /** Started from the panel's Try this tool, not by an agent. */
  tried?: boolean;
}

const DEFAULT_MAX_LOG = 100;
/** About 4 KB of JSON per value. */
const MAX_VALUE_CHARS = 4096;
const VALUE_LIMITS = { depth: 6, keys: 50, items: 50, text: 1000, budget: 400 };
const MAX_INPUTS = 50;
let nextCallId = 0;

function zoneApi(): AnyRecord | undefined {
  return read(() => (globalThis as AnyRecord)['Zone'] as AnyRecord | undefined, undefined);
}

/** A value as it may leave the page: masked, and cut to about 4 KB. */
function captureValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  const safe = read(() => serialize(value, VALUE_LIMITS), TRUNCATED);
  const text = read(() => JSON.stringify(safe) ?? '', '');
  return text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS)}… ${TRUNCATED}` : safe;
}

/** `value` with a form's masked field values hidden too. */
function maskForForm(value: unknown, formId: string | undefined): unknown {
  if (value === undefined || !formId) return value;
  if (typeof value === 'string') return redactFormText(formId, value);
  return read(() => {
    const text = JSON.stringify(value);
    const masked = redactFormText(formId, text);
    return masked === text ? value : JSON.parse(masked);
  }, '[Unreadable]');
}

function annotationsOf(tool: AnyRecord): Record<string, unknown> | undefined {
  const value = read(() => tool['annotations'], undefined);
  if (!value || typeof value !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, hint] of Object.entries(value).slice(0, 20)) {
    if (typeof hint === 'boolean' || typeof hint === 'number') out[key.slice(0, 60)] = hint;
    else if (typeof hint === 'string') out[key.slice(0, 60)] = redactText(hint.slice(0, 200));
  }
  return Object.keys(out).length ? out : undefined;
}

interface Shape {
  schema?: AnyRecord;
  blocking: { path: string; reason: string }[];
}

const MAX_CALLS = 5;
const MAX_LIST = 40;
const MAX_DEPTH = 10;
const MAX_KEYS = 200;
const PROVIDER_CHECK_MS = 5000;
const SCHEMA_ERROR = /Could not accurately infer WebMCP schema for form "([^"]{1,200})"/;
const REGISTER_TOKEN = 'REGISTER_WEBMCP_FORM';
const SCHEMA_LIMITS = { depth: 12, keys: 100, items: 40, text: 300, budget: 4000 };

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const join = childPath;

export function inferShape(value: unknown, path = '', depth = 0): Shape {
  if (typeof value === 'string') return { schema: { type: 'string' }, blocking: [] };
  if (typeof value === 'number') return { schema: { type: 'number' }, blocking: [] };
  if (typeof value === 'boolean') return { schema: { type: 'boolean' }, blocking: [] };
  const at = path || '(form)';
  if (value === null) return { blocking: [{ path: at, reason: 'null' }] };
  if (value === undefined) return { blocking: [{ path: at, reason: 'undefined' }] };
  if (depth >= MAX_DEPTH) {
    return { blocking: [{ path: at, reason: `nested deeper than ${MAX_DEPTH} levels` }] };
  }
  if (Array.isArray(value)) {
    if (!value.length) return { blocking: [{ path: at, reason: 'empty array' }] };
    // Angular infers an array from its first item only, so the others are not checked.
    const item = inferShape(value[0], `${path}[]`, depth + 1);
    return {
      schema: item.schema && { type: 'array', items: item.schema },
      blocking: item.blocking,
    };
  }
  if (typeof value === 'object') {
    const properties: AnyRecord = {};
    const blocking: Shape['blocking'] = [];
    let ok = true;
    for (const key of Object.keys(value).slice(0, MAX_KEYS)) {
      const child = inferShape((value as AnyRecord)[key], join(path, key), depth + 1);
      blocking.push(...child.blocking);
      if (child.schema) properties[key] = child.schema;
      else ok = false;
    }
    return { schema: ok ? { type: 'object', properties } : undefined, blocking };
  }
  return { blocking: [{ path: at, reason: `unsupported type ${typeof value}` }] };
}

export function shapeKey(schema: unknown): string {
  const strip = (node: unknown): unknown => {
    if (!node || typeof node !== 'object') return node;
    const record = node as AnyRecord;
    if (record['type'] === 'array') return { type: 'array', items: strip(record['items']) };
    if (record['type'] === 'object') {
      const properties: AnyRecord = {};
      for (const [key, child] of Object.entries((record['properties'] ?? {}) as AnyRecord)) {
        properties[key] = strip(child);
      }
      return { type: 'object', properties };
    }
    return { type: record['type'] };
  };
  return JSON.stringify(strip(schema));
}

export function schemaInputs(schema: unknown): string[] {
  const out: string[] = [];
  const visit = (node: unknown, path: string, depth: number) => {
    if (!node || typeof node !== 'object' || depth > MAX_DEPTH || out.length >= MAX_LIST) return;
    const record = node as AnyRecord;
    if (record['type'] === 'object') {
      for (const [key, child] of Object.entries((record['properties'] ?? {}) as AnyRecord)) {
        visit(child, join(path, key), depth + 1);
      }
      return;
    }
    if (record['type'] === 'array') {
      const items = record['items'] as AnyRecord | undefined;
      if (items?.['type'] === 'object' || items?.['type'] === 'array') {
        out.push(`${path || '(form)'}: array`);
        visit(items, `${path}[]`, depth + 1);
      } else out.push(`${path || '(form)'}: ${String(items?.['type'] ?? 'unknown')}[]`);
      return;
    }
    out.push(`${path || '(form)'}: ${String(record['type'] ?? 'unknown')}`);
  };
  visit(schema, '', 0);
  return out;
}

export function schemaRequired(schema: unknown): string[] {
  const out: string[] = [];
  const visit = (node: unknown, path: string, depth: number) => {
    if (!node || typeof node !== 'object' || depth > MAX_DEPTH) return;
    const record = node as AnyRecord;
    if (record['type'] === 'array') return visit(record['items'], `${path}[]`, depth + 1);
    if (record['type'] !== 'object') return;
    const required = Array.isArray(record['required']) ? record['required'] : [];
    for (const key of required) if (typeof key === 'string') out.push(join(path, key));
    for (const [key, child] of Object.entries((record['properties'] ?? {}) as AnyRecord)) {
      visit(child, join(path, key), depth + 1);
    }
  };
  visit(schema, '', 0);
  return out.slice(0, MAX_LIST);
}

export function requiredNow(root: AnyRecord): Map<string, boolean> {
  const out = new Map<string, boolean>();
  const visit = (node: AnyRecord, path: string, depth: number) => {
    if (depth > MAX_DEPTH) return;
    const isArray = read(() => Array.isArray(node['value']()), false);
    const children = read(() => node['structure'].materializedChildren() as AnyRecord[], []);
    for (const child of children.slice(0, MAX_KEYS)) {
      const key = String(read(() => child['keyInParent'](), ''));
      if (isArray && key !== '0') continue;
      const childPath = isArray ? `${path}[]` : join(path, key);
      if (!isArray)
        out.set(
          childPath,
          read(() => !!child['required'](), false),
        );
      visit(child, childPath, depth + 1);
    }
  };
  visit(root, '', 0);
  return out;
}

/** Names of the tools the overlay registers itself (`browser-tools.ts`); not the app's. */
export const PANGULAR_TOOL_PREFIX = 'pangular_';

function ownTool(name: unknown): boolean {
  return typeof name === 'string' && name.startsWith(PANGULAR_TOOL_PREFIX);
}

/** `document.modelContext` (the WebMCP draft), or `navigator.modelContext` (earlier drafts). */
export function modelContextOf(): AnyRecord | null {
  const doc = typeof document === 'undefined' ? undefined : (document as unknown as AnyRecord);
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as unknown as AnyRecord);
  const context = read(() => doc?.['modelContext'] ?? nav?.['modelContext'], null);
  return context && typeof context['registerTool'] === 'function' ? context : null;
}

function listSources(context: AnyRecord): AnyRecord[] {
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as unknown as AnyRecord);
  return [context, read(() => nav?.['modelContextTesting'] as AnyRecord, null)].filter(
    (source): source is AnyRecord => !!source,
  );
}

function parseSchema(value: unknown): AnyRecord | undefined {
  if (typeof value === 'string') return read(() => JSON.parse(value) as AnyRecord, undefined);
  return value && typeof value === 'object' ? (value as AnyRecord) : undefined;
}

function resultText(value: unknown): string {
  if (typeof value === 'string') return value;
  const content = read(() => (value as AnyRecord)['content'] as AnyRecord[], []);
  return Array.isArray(content)
    ? content.map((part) => (typeof part?.['text'] === 'string' ? part['text'] : '')).join('\n')
    : '';
}

function messageOf(error: unknown): string {
  return String((error as Error)?.message ?? error ?? 'error').slice(0, 300);
}

/**
 * Runs a tool's `execute` in a zone forked from the current one when the app
 * uses Zone.js, so work it starts later (after an `await`, in a timer) is
 * still tied to the call. The fork only adds a property; everything else
 * goes to the parent zone as before.
 */
function inCallZone<T>(id: number, run: () => T): T {
  const zone = read(
    () =>
      zoneApi()?.['current']?.fork?.({
        name: 'pangular-webmcp-call',
        properties: { [WEBMCP_ZONE_KEY]: id },
      }) as AnyRecord | undefined,
    undefined,
  );
  return zone && typeof zone['run'] === 'function' ? (zone['run'](run) as T) : run();
}

export function watchWebMcp(onChange: () => void): WebMcpWatcher {
  const records: ToolRecord[] = [];
  const links = new WeakMap<object, ToolRecord>();
  let current: ToolRecord | null = null;
  // Calls running per tool, the tools whose `execute` ran since the last push, and the
  // tools that ran at any time since then.
  const running = new Map<ToolRecord, number>();
  let wrote = new Set<ToolRecord>();
  let ran = new Set<ToolRecord>();
  const linked = new WeakSet<ToolRecord>();
  const linkTo = (root: object, record: ToolRecord) => {
    links.set(root, record);
    linked.add(record);
  };
  let provided: boolean | undefined;
  let providerCheckedAt = 0;
  let context: AnyRecord | null = null;
  let restore: (() => void) | null = null;
  // True while `run` calls a tool, so the call is marked as tried and not counted as the agent's.
  let trying = false;
  const log: LogEntry[] = [];
  let maxLog = DEFAULT_MAX_LOG;
  let dropped = 0;
  // When the user last pressed a key or the pointer, so a call's time window can leave them out.
  const inputs: number[] = [];
  const onInput = () => {
    inputs.push(Date.now());
    if (inputs.length > MAX_INPUTS) inputs.shift();
  };
  const INPUT_EVENTS = ['pointerdown', 'keydown'] as const;
  if (typeof addEventListener === 'function') {
    for (const type of INPUT_EVENTS) {
      addEventListener(type, onInput, { capture: true, passive: true });
    }
  }

  const trimLog = () => {
    while (log.length > maxLog) {
      const old = log.shift()!;
      untrackWebMcpCall(old.id);
      dropped++;
    }
  };

  const add = (record: ToolRecord) => {
    records.push(record);
    onChange();
    return record;
  };

  const forget = (record: ToolRecord) => {
    const index = records.indexOf(record);
    if (index >= 0) records.splice(index, 1);
    onChange();
  };

  function wrapExecute(record: ToolRecord, execute: (...args: unknown[]) => unknown) {
    return function (this: unknown, args: unknown, ...rest: unknown[]) {
      const tried = trying;
      const call: ToolRecord['calls'][number] = {
        at: Date.now(),
        started: performance.now(),
        outcome: 'running',
        fields: args && typeof args === 'object' ? Object.keys(args).slice(0, MAX_LIST) : undefined,
        ...(tried ? { tried } : {}),
      };
      record.calls.push(call);
      if (record.calls.length > MAX_CALLS) record.calls.shift();
      if (!tried) {
        running.set(record, (running.get(record) ?? 0) + 1);
        wrote.add(record);
        ran.add(record);
      }
      const entry: LogEntry = {
        id: ++nextCallId,
        record,
        at: call.at,
        started: call.started,
        outcome: 'running',
        args: captureValue(args),
        caused: [],
        ...(tried ? { tried } : {}),
      };
      log.push(entry);
      trackWebMcpCall(entry);
      trimLog();
      const previous = current;
      current = record;
      const previousEntry = enterWebMcpCall(entry);
      const settle = (outcome: WebMcpOutcome, detail?: string, value?: unknown) => {
        call.outcome = outcome;
        call.ms = Math.round(performance.now() - call.started);
        if (detail) call.detail = detail.slice(0, 300);
        entry.outcome = outcome;
        entry.ms = call.ms;
        if (detail) entry.detail = redactText(detail.slice(0, 300));
        if (value !== undefined) entry.result = captureValue(value);
        if (!tried) {
          const left = (running.get(record) ?? 1) - 1;
          if (left > 0) running.set(record, left);
          else running.delete(record);
        }
        onChange();
      };
      let out: unknown;
      try {
        out = inCallZone(entry.id, () => execute.call(this, args, ...rest));
      } catch (error) {
        settle('threw', messageOf(error));
        throw error;
      } finally {
        current = previous;
        enterWebMcpCall(previousEntry);
      }
      Promise.resolve(out).then(
        (value) => {
          const text = resultText(value);
          if (text.startsWith('Form submission failed')) {
            settle('failed', text.replace(/^Form submission failed:\n?/, ''), value);
          } else {
            settle(
              text.startsWith('Form submitted successfully') ? 'submitted' : 'done',
              '',
              value,
            );
          }
        },
        (error) => settle('threw', messageOf(error)),
      );
      onChange();
      return out;
    };
  }

  // Patches `registerTool` and lists the tools already there, once a `modelContext` exists.
  function attach(context: AnyRecord) {
    const original = context['registerTool'] as (...args: unknown[]) => unknown;
    const own = Object.prototype.hasOwnProperty.call(context, 'registerTool');
    const patched = function (this: unknown, tool: AnyRecord, options?: AnyRecord) {
      if (ownTool(read(() => tool['name'], undefined))) return original.call(this, tool, options);
      const record = add({
        name: String(read(() => tool['name'], '')).slice(0, 200),
        description: String(read(() => tool['description'], '') ?? '').slice(0, 500),
        status: 'registering',
        seen: 'register',
        schema: parseSchema(read(() => tool['inputSchema'], undefined)),
        annotations: annotationsOf(tool),
        registeredAt: Date.now(),
        calls: [],
      });
      record.shape = record.schema && shapeKey(record.schema);
      const execute = read(() => tool['execute'], undefined);
      const wrapped = typeof execute === 'function' ? wrapExecute(record, execute) : undefined;
      const forwarded = wrapped ? { ...tool, execute: wrapped } : tool;
      if (wrapped) record.execute = (args) => wrapped.call(tool, args);
      const signal = read(() => options?.['signal'] as AbortSignal | undefined, undefined);
      read(
        () => signal?.addEventListener('abort', () => forget(record), { once: true }),
        undefined,
      );
      const fail = (error: unknown) => {
        record.status = 'failed';
        record.error = messageOf(error);
        onChange();
      };
      let result: unknown;
      try {
        result = original.call(this, forwarded, options);
      } catch (error) {
        fail(error);
        throw error;
      }
      Promise.resolve(result).then(() => {
        if (record.status === 'registering') record.status = 'registered';
        onChange();
      }, fail);
      return result;
    };
    context['registerTool'] = patched;
    restore = () => {
      if (context['registerTool'] !== patched) return;
      if (own) context['registerTool'] = original;
      else delete context['registerTool'];
    };
    for (const source of listSources(context)) {
      const list = read(() => source['getTools'] ?? source['listTools'], undefined);
      if (typeof list !== 'function') continue;
      void Promise.resolve(read(() => list.call(source), undefined))
        .then((tools) => {
          if (!Array.isArray(tools)) return;
          const appTools = tools.filter((tool) => !ownTool(read(() => tool?.['name'], undefined)));
          for (const tool of appTools.slice(0, MAX_LIST)) {
            const name = read(() => tool?.['name'], undefined);
            if (typeof name !== 'string' || records.some((r) => r.name === name)) continue;
            const schema = parseSchema(read(() => tool['inputSchema'], undefined));
            add({
              name: name.slice(0, 200),
              description: String(read(() => tool['description'], '') ?? '').slice(0, 500),
              status: 'registered',
              seen: 'list',
              schema,
              shape: schema && shapeKey(schema),
              annotations: annotationsOf(tool),
              calls: [],
              execute: testingExecute(name),
            });
          }
        })
        .catch(() => undefined);
      break;
    }
  }

  /** The browser's `modelContextTesting.executeTool`, for a tool registered before the overlay. */
  function testingExecute(name: string): ToolRecord['execute'] {
    const nav = typeof navigator === 'undefined' ? undefined : (navigator as unknown as AnyRecord);
    const testing = read(() => nav?.['modelContextTesting'] as AnyRecord | undefined, undefined);
    const run = read(() => testing?.['executeTool'], undefined);
    if (typeof run !== 'function') return undefined;
    return (args) => run.call(testing, name, JSON.stringify(args ?? {}));
  }

  // A polyfill or extension can add `modelContext` after the overlay loads, so `describe`
  // looks again until one shows up.
  const lookUp = () => {
    if (context) return;
    context = modelContextOf();
    if (context) attach(context);
  };
  lookUp();

  const onRejection = (event: PromiseRejectionEvent) => {
    const match = read(
      () => String(event.reason?.message ?? event.reason).match(SCHEMA_ERROR),
      null,
    );
    if (!match) return;
    const name = match[1];
    if (records.some((r) => r.name === name && r.status === 'failed' && r.seen === 'error')) return;
    add({ name, description: '', status: 'failed', seen: 'error', error: 'schema', calls: [] });
  };
  if (typeof addEventListener === 'function') addEventListener('unhandledrejection', onRejection);

  function checkProvided(forms: WebMcpForm[], ng?: DebugNg) {
    if (provided || !ng?.getInjector || !ng.ɵgetInjectorResolutionPath) return;
    const now = Date.now();
    if (now - providerCheckedAt < PROVIDER_CHECK_MS) return;
    providerCheckedAt = now;
    const element = forms.find((form) => form.element)?.element;
    if (!element) return;
    const path = read(() => ng.ɵgetInjectorResolutionPath!(ng.getInjector!(element)), []);
    provided = path.some((injector) =>
      read(
        () =>
          (ng.ɵgetInjectorProviders?.(injector) ?? []).some(
            (record) => tokenName(record.token) === REGISTER_TOKEN,
          ),
        false,
      ),
    );
  }

  function toTool(record: ToolRecord, form?: WebMcpForm, shape?: Shape): WebMcpTool {
    const redact = (text: string) => (form ? redactFormText(form.formId, text) : redactText(text));
    const tool: WebMcpTool = {
      name: record.name,
      description: redact(record.description),
      status: record.status,
      seen: record.seen,
    };
    if (record.error) tool.error = redact(record.error);
    const schema = record.schema ?? shape?.schema;
    if (schema) {
      tool.inputs = schemaInputs(schema);
      tool.schema = serialize(schema, SCHEMA_LIMITS);
    }
    if (record.schema) {
      const then = schemaRequired(record.schema);
      tool.required = then;
      if (form) {
        const now = requiredNow(form.root);
        const changed: { path: string; now: boolean }[] = [];
        for (const [path, required] of now) {
          if (required !== then.includes(path)) changed.push({ path, now: required });
        }
        if (changed.length) tool.requiredChanged = changed.slice(0, MAX_LIST);
      }
    }
    if (record.status === 'failed' && shape?.blocking.length) {
      tool.blocking = shape.blocking.slice(0, MAX_LIST);
    }
    if (records.filter((r) => r.name === record.name).length > 1) tool.duplicate = true;
    if (record.calls.length) {
      tool.calls = record.calls.map(({ started: _, ...call }) => ({
        ...call,
        ...(call.detail ? { detail: redact(call.detail) } : {}),
      }));
    }
    return tool;
  }

  return {
    // Only the synchronous part of `execute`: user typing or app code that runs while a
    // long async submit is pending is not the agent's.
    active: () => current !== null,
    takeActivity() {
      const wroteNow = wrote;
      const ranNow = ran;
      wrote = new Set();
      ran = new Set(running.keys());
      const unlinkedWrite = [...wroteNow].some((record) => !linked.has(record));
      return (root) => {
        const record = root ? links.get(root) : undefined;
        if (record && wroteNow.has(record)) return 'wrote';
        if (unlinkedWrite) return 'maybe';
        if (record && ranNow.has(record)) return 'running';
        return undefined;
      };
    },
    link(root) {
      if (current) linkTo(root, current);
    },
    async run(root, args) {
      const record = links.get(root);
      if (!record || !records.includes(record)) {
        return { ok: false, error: 'This form has no WebMCP tool the inspector linked to it.' };
      }
      if (record.status !== 'registered') {
        return { ok: false, error: `The tool ${record.name} is not registered.` };
      }
      if (!record.execute) {
        return {
          ok: false,
          error: `The tool ${record.name} was registered before the inspector attached, and the browser offers no way to call it.`,
        };
      }
      let out: unknown;
      trying = true;
      try {
        out = record.execute(args);
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      } finally {
        trying = false;
      }
      // A tool that never settles would keep the form action, and with it the
      // devtools origin of every later form event, open for good.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timedOut = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`The tool ${record.name} did not answer within 10s.`)),
          RUN_TIMEOUT_MS,
        );
      });
      try {
        return { ok: true, text: resultText(await Promise.race([out, timedOut])).slice(0, 2000) };
      } catch (error) {
        return { ok: false, error: messageOf(error) };
      } finally {
        clearTimeout(timer);
      }
    },
    describe(forms, ng) {
      const out = new Map<object, WebMcpTool>();
      lookUp();
      if (!context) checkProvided(forms, ng);
      if (!records.length) {
        return {
          forms: out,
          page: context || provided ? { modelContext: !!context, provided, tools: [] } : undefined,
        };
      }
      const shapes = new Map<WebMcpForm, Shape>();
      for (const form of forms) {
        shapes.set(form, inferShape(read(() => form.root['value'](), undefined)));
      }
      const owner = new Map<ToolRecord, WebMcpForm>();
      const taken = new Set<WebMcpForm>();
      for (const form of forms) {
        const record = links.get(form.root);
        if (record && records.includes(record) && !owner.has(record)) {
          owner.set(record, form);
          taken.add(form);
        }
      }
      for (const record of records) {
        if (owner.has(record) || !record.shape) continue;
        const candidates = forms.filter((form) => {
          const schema = shapes.get(form)?.schema;
          return !taken.has(form) && schema && shapeKey(schema) === record.shape;
        });
        const rivals = records.filter((r) => r.shape === record.shape && !owner.has(r));
        if (candidates.length !== 1 || rivals.length !== 1) continue;
        owner.set(record, candidates[0]);
        taken.add(candidates[0]);
        linkTo(candidates[0].root, record);
      }
      const failed = records.filter((r) => !owner.has(r) && !r.shape && r.status === 'failed');
      const blocked = forms.filter((form) => !taken.has(form) && !shapes.get(form)?.schema);
      if (failed.length === 1 && blocked.length === 1) {
        owner.set(failed[0], blocked[0]);
        taken.add(blocked[0]);
      }
      const unlinked: WebMcpTool[] = [];
      for (const record of records) record.formId = owner.get(record)?.formId;
      for (const record of records) {
        const form = owner.get(record);
        if (form) out.set(form.root, toTool(record, form, shapes.get(form)));
        else unlinked.push(toTool(record));
      }
      return {
        forms: out,
        page: { modelContext: !!context, provided, tools: unlinked.slice(0, MAX_LIST) },
      };
    },
    report() {
      lookUp();
      const now = Date.now();
      const tools: WebMcpPageTool[] = records.slice(0, MAX_LIST).map((record) => {
        const redact = (text: string) =>
          record.formId ? redactFormText(record.formId, text) : redactText(text);
        const schema = record.schema;
        return {
          name: record.name,
          description: redact(record.description),
          status: record.status,
          seen: record.seen,
          ...(record.error ? { error: redact(record.error) } : {}),
          ...(record.annotations ? { annotations: record.annotations } : {}),
          ...(schema ? { inputs: schemaInputs(schema), required: schemaRequired(schema) } : {}),
          ...(record.formId ? { formId: record.formId } : {}),
          ...(records.filter((r) => r.name === record.name).length > 1 ? { duplicate: true } : {}),
          ...(record.registeredAt ? { registeredAt: record.registeredAt } : {}),
        };
      });
      const calls: WebMcpCallEntry[] = log.map((entry) => {
        const formId = entry.record.formId;
        const end = entry.at + (entry.ms ?? now - entry.at) + WEBMCP_GRACE_MS;
        const userInput = inputs.some((at) => at >= entry.at && at <= end);
        return {
          id: entry.id,
          tool: entry.record.name,
          at: entry.at,
          ...(entry.ms !== undefined ? { ms: entry.ms } : {}),
          outcome: entry.outcome,
          ...(entry.args !== undefined ? { args: maskForForm(entry.args, formId) } : {}),
          ...(entry.result !== undefined ? { result: maskForForm(entry.result, formId) } : {}),
          ...(entry.detail
            ? { detail: formId ? redactFormText(formId, entry.detail) : entry.detail }
            : {}),
          ...(userInput ? { userInput: true } : {}),
          ...(entry.caused.length ? { caused: entry.caused.slice() } : {}),
          ...(formId ? { formId } : {}),
          ...(entry.tried ? { tried: true } : {}),
        };
      });
      return { modelContext: !!context, tools, calls, dropped };
    },
    setMaxCalls(max) {
      maxLog = Math.max(1, Math.floor(max));
      trimLog();
    },
    stop() {
      restore?.();
      restore = null;
      for (const entry of log) untrackWebMcpCall(entry.id);
      if (typeof removeEventListener === 'function') {
        removeEventListener('unhandledrejection', onRejection);
        for (const type of INPUT_EVENTS) removeEventListener(type, onInput, { capture: true });
      }
    },
  };
}

let shared: { watcher: WebMcpWatcher; listeners: Set<() => void> } | null = null;

/**
 * The one watcher of the page, shared by the forms and `webmcp` collectors:
 * `registerTool` is replaced once, and each collector hears every change.
 * The watcher stops when the last one releases it.
 */
export function shareWebMcp(listener: () => void): {
  watcher: WebMcpWatcher;
  release(): void;
} {
  if (!shared) {
    const listeners = new Set<() => void>();
    const watcher = watchWebMcp(() => {
      for (const run of [...listeners]) run();
    });
    shared = { watcher, listeners };
  }
  const own = shared;
  own.listeners.add(listener);
  let released = false;
  return {
    watcher: own.watcher,
    release() {
      if (released) return;
      released = true;
      own.listeners.delete(listener);
      if (!own.listeners.size && shared === own) {
        own.watcher.stop();
        shared = null;
      }
    },
  };
}
