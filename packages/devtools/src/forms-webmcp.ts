import { redactFormText } from './forms.ts';
import { redactMessage } from './forms-privacy.ts';
import { tokenName, type DebugNg } from './injector-tree.ts';

type AnyRecord = Record<string, any>;

export type WebMcpOutcome = 'running' | 'submitted' | 'failed' | 'done' | 'threw';

export interface WebMcpCall {
  at: number;
  ms?: number;
  outcome: WebMcpOutcome;
  fields?: string[];
  detail?: string;
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

export interface WebMcpWatcher {
  active(): boolean;
  takeActivity(): boolean;
  link(root: object): void;
  describe(
    forms: WebMcpForm[],
    ng?: DebugNg,
  ): { forms: Map<object, WebMcpTool>; page?: WebMcpPage };
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
  calls: (WebMcpCall & { started: number })[];
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

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function join(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

export function inferShape(value: unknown, path = '', depth = 0): Shape {
  if (typeof value === 'string') return { schema: { type: 'string' }, blocking: [] };
  if (typeof value === 'number') return { schema: { type: 'number' }, blocking: [] };
  if (typeof value === 'boolean') return { schema: { type: 'boolean' }, blocking: [] };
  const at = path || '(form)';
  if (value === null) return { blocking: [{ path: at, reason: 'null' }] };
  if (value === undefined) return { blocking: [{ path: at, reason: 'undefined' }] };
  if (depth >= MAX_DEPTH) return { blocking: [] };
  if (Array.isArray(value)) {
    if (!value.length) return { blocking: [{ path: at, reason: 'empty array' }] };
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

function modelContextOf(): AnyRecord | null {
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
  const content = read(() => (value as AnyRecord)['content'] as AnyRecord[], []);
  return Array.isArray(content)
    ? content.map((part) => (typeof part?.['text'] === 'string' ? part['text'] : '')).join('\n')
    : '';
}

function messageOf(error: unknown): string {
  return String((error as Error)?.message ?? error ?? 'error').slice(0, 300);
}

export function watchWebMcp(onChange: () => void): WebMcpWatcher {
  const records: ToolRecord[] = [];
  const links = new WeakMap<object, ToolRecord>();
  let running = 0;
  let current: ToolRecord | null = null;
  let activity = false;
  let provided: boolean | undefined;
  let providerCheckedAt = 0;
  const context = modelContextOf();
  let restore: (() => void) | null = null;

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
      const call: ToolRecord['calls'][number] = {
        at: Date.now(),
        started: performance.now(),
        outcome: 'running',
        fields: args && typeof args === 'object' ? Object.keys(args).slice(0, MAX_LIST) : undefined,
      };
      record.calls.push(call);
      if (record.calls.length > MAX_CALLS) record.calls.shift();
      running++;
      activity = true;
      const previous = current;
      current = record;
      const settle = (outcome: WebMcpOutcome, detail?: string) => {
        call.outcome = outcome;
        call.ms = Math.round(performance.now() - call.started);
        if (detail) call.detail = detail.slice(0, 300);
        running = Math.max(0, running - 1);
        onChange();
      };
      let out: unknown;
      try {
        out = execute.call(this, args, ...rest);
      } catch (error) {
        settle('threw', messageOf(error));
        throw error;
      } finally {
        current = previous;
      }
      Promise.resolve(out).then(
        (value) => {
          const text = resultText(value);
          if (text.startsWith('Form submission failed')) {
            settle('failed', text.replace(/^Form submission failed:\n?/, ''));
          } else settle(text.startsWith('Form submitted successfully') ? 'submitted' : 'done');
        },
        (error) => settle('threw', messageOf(error)),
      );
      onChange();
      return out;
    };
  }

  if (context) {
    const original = context['registerTool'] as (...args: unknown[]) => unknown;
    const own = Object.prototype.hasOwnProperty.call(context, 'registerTool');
    const patched = function (this: unknown, tool: AnyRecord, options?: AnyRecord) {
      const record = add({
        name: String(read(() => tool['name'], '')).slice(0, 200),
        description: String(read(() => tool['description'], '') ?? '').slice(0, 500),
        status: 'registering',
        seen: 'register',
        schema: parseSchema(read(() => tool['inputSchema'], undefined)),
        calls: [],
      });
      record.shape = record.schema && shapeKey(record.schema);
      const execute = read(() => tool['execute'], undefined);
      const forwarded =
        typeof execute === 'function' ? { ...tool, execute: wrapExecute(record, execute) } : tool;
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
          for (const tool of tools.slice(0, MAX_LIST)) {
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
              calls: [],
            });
          }
        })
        .catch(() => undefined);
      break;
    }
  }

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
    const redact = (text: string) =>
      form ? redactFormText(form.formId, text) : redactMessage(text);
    const tool: WebMcpTool = {
      name: record.name,
      description: redact(record.description),
      status: record.status,
      seen: record.seen,
    };
    if (record.error) tool.error = redact(record.error);
    const schema = record.schema ?? shape?.schema;
    if (schema) tool.inputs = schemaInputs(schema);
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
    active: () => running > 0,
    takeActivity() {
      const was = activity;
      activity = running > 0;
      return was;
    },
    link(root) {
      if (current) links.set(root, current);
    },
    describe(forms, ng) {
      const out = new Map<object, WebMcpTool>();
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
        links.set(candidates[0].root, record);
      }
      const failed = records.filter((r) => !owner.has(r) && !r.shape && r.status === 'failed');
      const blocked = forms.filter((form) => !taken.has(form) && !shapes.get(form)?.schema);
      if (failed.length === 1 && blocked.length === 1) {
        owner.set(failed[0], blocked[0]);
        taken.add(blocked[0]);
      }
      const unlinked: WebMcpTool[] = [];
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
    stop() {
      restore?.();
      restore = null;
      if (typeof removeEventListener === 'function') {
        removeEventListener('unhandledrejection', onRejection);
      }
    },
  };
}
