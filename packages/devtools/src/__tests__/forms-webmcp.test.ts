// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  inferShape,
  requiredNow,
  schemaInputs,
  schemaRequired,
  watchWebMcp,
  type WebMcpWatcher,
} from '../forms-webmcp.ts';

type Tool = {
  name: string;
  description: string;
  inputSchema: unknown;
  execute: (args: unknown) => Promise<unknown>;
};

const watchers: WebMcpWatcher[] = [];
afterEach(() => {
  watchers.splice(0).forEach((w) => w.stop());
  delete (navigator as any).modelContext;
  delete (navigator as any).modelContextTesting;
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeContext(fail?: (tool: Tool) => unknown) {
  const tools = new Map<string, Tool>();
  const context = {
    registerTool: vi.fn(async (tool: Tool, options?: { signal?: AbortSignal }) => {
      const error = fail?.(tool);
      if (error) throw error;
      tools.set(tool.name, tool);
      options?.signal?.addEventListener('abort', () => tools.delete(tool.name));
    }),
  };
  (navigator as any).modelContext = context;
  return { context, tools };
}

function fieldNode(value: unknown, required = false, key = ''): any {
  const children = (): any[] => {
    if (Array.isArray(value)) return value.map((item, i) => fieldNode(item, false, String(i)));
    if (value && typeof value === 'object') {
      return Object.entries(value).map(([k, v]) => fieldNode(v, k === 'name', k));
    }
    return [];
  };
  return {
    value: () => value,
    required: () => required,
    keyInParent: () => key,
    structure: { materializedChildren: children },
  };
}

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
    tags: {
      type: 'array',
      items: { type: 'object', properties: { label: { type: 'string' } }, required: [] },
    },
  },
  required: ['name', 'age'],
  additionalProperties: false,
};

function watch(onChange = vi.fn()) {
  const watcher = watchWebMcp(onChange);
  watchers.push(watcher);
  return watcher;
}

describe('WebMCP shape helpers', () => {
  it('lists every field that blocks schema inference, not only the first', () => {
    const shape = inferShape({ name: null, tags: [], nested: { when: undefined }, ok: 'x' });
    expect(shape.schema).toBeUndefined();
    expect(shape.blocking).toEqual([
      { path: 'name', reason: 'null' },
      { path: 'tags', reason: 'empty array' },
      { path: 'nested.when', reason: 'undefined' },
    ]);
  });

  it('summarizes inputs and required paths of a schema', () => {
    expect(schemaInputs(schema)).toEqual([
      'name: string',
      'age: number',
      'tags: array',
      'tags[].label: string',
    ]);
    expect(schemaRequired(schema)).toEqual(['name', 'age']);
  });

  it('reads the current required flags from materialized children', () => {
    const now = requiredNow(fieldNode({ name: 'a', age: 1, tags: [{ label: 'x' }] }));
    expect(now.get('name')).toBe(true);
    expect(now.get('age')).toBe(false);
    expect(now.has('tags[].label')).toBe(true);
  });
});

describe('watchWebMcp', () => {
  it('says when the browser has no modelContext and the provider is set', () => {
    const watcher = watch();
    const token = { _desc: 'REGISTER_WEBMCP_FORM' };
    const ng = {
      getInjector: () => 'node',
      ɵgetInjectorResolutionPath: () => ['node', 'env'],
      ɵgetInjectorProviders: (inj: unknown) => (inj === 'env' ? [{ token, provider: {} }] : []),
    };
    const root = fieldNode({ name: '' });
    const out = watcher.describe([{ root, formId: 'a@pg', element: document.body }], ng as any);
    expect(out.page).toEqual({ modelContext: false, provided: true, tools: [] });
    expect(out.forms.size).toBe(0);
  });

  it('records a registration, links it to the form by schema and leaves registerTool as it was on stop', async () => {
    const { context } = fakeContext();
    const original = context.registerTool;
    const watcher = watch();
    expect(context.registerTool).not.toBe(original);
    await (navigator as any).modelContext.registerTool(
      { name: 'sign_up', description: 'Create an account', inputSchema: schema, execute: vi.fn() },
      {},
    );
    await tick();
    const root = fieldNode({ name: 'Ada', age: 3, tags: [{ label: 'x' }] });
    const other = fieldNode({ city: 'Paris' });
    const out = watcher.describe([
      { root, formId: 'a@pg' },
      { root: other, formId: 'b@pg' },
    ]);
    expect(out.forms.get(other)).toBeUndefined();
    expect(out.forms.get(root)).toMatchObject({
      name: 'sign_up',
      description: 'Create an account',
      status: 'registered',
      seen: 'register',
      inputs: ['name: string', 'age: number', 'tags: array', 'tags[].label: string'],
      required: ['name', 'age'],
      requiredChanged: [{ path: 'age', now: false }],
    });
    expect(out.page).toEqual({ modelContext: true, provided: undefined, tools: [] });
    watcher.stop();
    expect(context.registerTool).toBe(original);
  });

  it('records failed registrations and flags duplicate names', async () => {
    fakeContext((tool) =>
      tool.description === 'second' ? new Error('Duplicate tool name') : null,
    );
    const watcher = watch();
    const register = (navigator as any).modelContext.registerTool;
    await register({ name: 'dup', description: 'first', inputSchema: schema, execute: vi.fn() });
    await expect(
      register({
        name: 'dup',
        description: 'second',
        inputSchema: { type: 'string' },
        execute: vi.fn(),
      }),
    ).rejects.toThrow('Duplicate');
    await tick();
    const { page } = watcher.describe([]);
    expect(page!.tools.map((t) => [t.status, t.error, t.duplicate])).toEqual([
      ['registered', undefined, true],
      ['failed', 'Duplicate tool name', true],
    ]);
  });

  it('forgets a tool when Angular aborts its registration', async () => {
    fakeContext();
    const watcher = watch();
    const abort = new AbortController();
    await (navigator as any).modelContext.registerTool(
      { name: 't', description: '', inputSchema: schema, execute: vi.fn() },
      { signal: abort.signal },
    );
    expect(watcher.describe([]).page!.tools).toHaveLength(1);
    abort.abort();
    expect(watcher.describe([]).page!.tools).toHaveLength(0);
  });

  it('turns an unhandled schema error into a failed tool with the blocking fields', async () => {
    fakeContext();
    const watcher = watch();
    const event = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(event, 'reason', {
      value: new Error('Could not accurately infer WebMCP schema for form "book". Ensure ...'),
    });
    dispatchEvent(event);
    const root = fieldNode({ when: null, seats: [] });
    const out = watcher.describe([
      { root, formId: 'a@pg' },
      { root: fieldNode({ ok: 'x' }), formId: 'b@pg' },
    ]);
    expect(out.forms.get(root)).toMatchObject({
      name: 'book',
      status: 'failed',
      error: 'schema',
      seen: 'error',
      blocking: [
        { path: 'when', reason: 'null' },
        { path: 'seats', reason: 'empty array' },
      ],
    });
  });

  it('records calls, marks the page active during them and links the form that submits', async () => {
    const { tools } = fakeContext();
    const onChange = vi.fn();
    const watcher = watch(onChange);
    const first = fieldNode({ name: '' });
    const second = fieldNode({ name: '' });
    let activeInside = false;
    await (navigator as any).modelContext.registerTool({
      name: 'profile',
      description: 'Update profile',
      inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: [] },
      execute: async () => {
        activeInside = watcher.active();
        watcher.link(second);
        return { content: [{ type: 'text', text: 'Form submission failed:\nname: is required' }] };
      },
    });
    const forms = [
      { root: first, formId: 'a@pg' },
      { root: second, formId: 'b@pg' },
    ];
    expect(watcher.describe(forms).forms.size).toBe(0);
    await tools.get('profile')!.execute({ name: '' });
    await tick();
    expect(activeInside).toBe(true);
    expect(watcher.active()).toBe(false);
    expect(watcher.takeActivity()).toBe(true);
    expect(watcher.takeActivity()).toBe(false);
    const tool = watcher.describe(forms).forms.get(second);
    expect(tool?.calls).toEqual([
      expect.objectContaining({ outcome: 'failed', fields: ['name'], detail: 'name: is required' }),
    ]);
    expect(onChange).toHaveBeenCalled();
  });

  it('masks tokens in the description, error and call detail of a tool no form owns', async () => {
    const jwt = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');
    const { tools } = fakeContext((tool) =>
      tool.name === 'broken' ? new Error(`bad token ${jwt}`) : null,
    );
    const watcher = watch();
    const register = (navigator as any).modelContext.registerTool;
    await register({
      name: 'lookup',
      description: 'Uses Bearer abc123def456',
      inputSchema: { type: 'string' },
      execute: async () => ({
        content: [{ type: 'text', text: `Form submission failed:\ninvalid ${jwt}` }],
      }),
    });
    await expect(
      register({ name: 'broken', description: '', inputSchema: {}, execute: vi.fn() }),
    ).rejects.toThrow();
    await tools.get('lookup')!.execute({});
    await tick();
    const text = JSON.stringify(watcher.describe([]).page);
    expect(text).not.toContain('eyJhbGci');
    expect(text).not.toContain('abc123def456');
    expect(text).toContain('[redacted]');
  });

  it('reads tools that were registered before it attached from the browser tool list', async () => {
    fakeContext();
    (navigator as any).modelContextTesting = {
      listTools: () => [
        { name: 'early', description: 'Registered first', inputSchema: JSON.stringify(schema) },
      ],
    };
    const watcher = watch();
    await tick();
    const root = fieldNode({ name: 'a', age: 1, tags: [{ label: '' }] });
    expect(watcher.describe([{ root, formId: 'a@pg' }]).forms.get(root)).toMatchObject({
      name: 'early',
      status: 'registered',
      seen: 'list',
    });
  });
});
