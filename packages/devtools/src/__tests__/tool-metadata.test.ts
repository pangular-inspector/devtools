import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PANGULAR_INSPECTORS, agentInspector, agentTags } from '../config.ts';
import pangular from '../devframe.ts';
import { initPangularHub } from '../hub.ts';
import { makeProject } from './analog-fixture.ts';

const closers: (() => Promise<void>)[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const close of closers.splice(0)) await close();
  delete (globalThis as { __PANGULAR_HUB__?: unknown }).__PANGULAR_HUB__;
});

async function manifest() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await pangular.setup(ctx as never);
  return ctx.agent.list().tools.filter((tool) => tool.id.startsWith('pangular:'));
}

interface McpTool {
  name: string;
  title?: string;
  outputSchema?: Record<string, unknown>;
  inputSchema?: { properties?: Record<string, { type?: string }>; required?: string[] };
  annotations?: { title?: string; readOnlyHint?: boolean };
}

interface McpCallResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
  isError?: boolean;
}

/** A hub with its MCP endpoint, and a JSON-RPC client for it. */
async function bootMcp() {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const hub = initPangularHub({
    cwd: makeProject({ 'package.json': '{}' }),
    ws: false,
    auth: false,
    allowedOrigins: false,
  });
  closers.push(() => hub.close());
  await hub.ready;
  const ctx = await hub.context;
  let id = 0;
  const call = async <T>(method: string, params: object = {}): Promise<T> => {
    const response = await hub.handler(
      new Request('http://localhost/__devframes/__mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          origin: 'http://localhost:4000',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
      }),
    );
    const text = await response.text();
    const json = text.startsWith('{') ? text : /^data: (.*)$/m.exec(text)?.[1];
    return (JSON.parse(json ?? '{}') as { result: T }).result;
  };
  await call('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '0' },
  });
  const tools = (await call<{ tools: McpTool[] }>('tools/list')).tools.filter((tool) =>
    tool.name.startsWith('pangular_'),
  );
  const invoke = (name: string, args: Record<string, unknown> = {}) =>
    call<McpCallResult>('tools/call', { name, arguments: args });
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  return { tools, invoke, push };
}

/** Answers as MCP clients get them: the markdown itself, and compact JSON for a source scan. */
const TEXT_ANSWERS = {
  'pangular_list-pages':
    'No page is reporting. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser.',
  'pangular_list-components':
    'No component tree has been reported. This is what a page that has never connected reports, and also what a connected page reports when its components are not readable. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser. The stdio MCP server has no page, so there it always answers this.',
  'pangular_scan-routes': '[]',
};

describe('agent tool titles', () => {
  it('gives every built-in tool a short title of its own', async () => {
    const tools = (await manifest()).filter((tool) => !tool.id.startsWith('pangular:plugin:'));
    expect(tools.length).toBeGreaterThan(80);
    const seen = new Map<string, string>();
    for (const tool of tools) {
      expect(tool.title, `${tool.id} has no title`).not.toBe(tool.id);
      expect(tool.title.length, `${tool.id}: "${tool.title}"`).toBeLessThanOrEqual(40);
      expect(tool.title, tool.id).not.toMatch(/pangular/i);
      expect(tool.title, tool.id).toMatch(/^[A-Z]/);
      expect(seen.get(tool.title), `"${tool.title}" is used twice`).toBeUndefined();
      seen.set(tool.title, tool.id);
    }
  });

  it('sends the title as the MCP title and the title annotation', async () => {
    const { tools } = await bootMcp();
    for (const tool of tools) {
      expect(tool.title, tool.name).toBeTruthy();
      expect(tool.title, tool.name).not.toMatch(/^pangular[:_]/);
      expect(tool.annotations?.title, tool.name).toBe(tool.title);
    }
  });
});

describe('agent tool tags', () => {
  it('tags each tool with its inspector and leaves shared tools untagged', async () => {
    for (const tool of await manifest()) {
      const inspector = agentInspector(tool.id);
      if (tool.id === 'pangular:clear-recordings') {
        expect(tool.tags).toEqual(['http', 'router', 'analog']);
      } else if (tool.id === 'pangular:wait-for') {
        expect(tool.tags).toEqual(['components', 'router', 'http', 'errors', 'forms']);
      } else if (inspector) {
        expect(tool.tags, tool.id).toEqual([inspector]);
      } else {
        expect(tool.tags, tool.id).toBeUndefined();
      }
      for (const tag of tool.tags ?? []) expect(PANGULAR_INSPECTORS).toContain(tag);
    }
  });

  it('tags plugin tools as plugins', () => {
    expect(agentTags('pangular:plugin:cart:totals')).toEqual(['plugins']);
    expect(agentTags('pangular:list-pages')).toBeUndefined();
  });
});

describe('agent tool answers', () => {
  it('advertises no output schema, so no client expects structured content', async () => {
    const { tools } = await bootMcp();
    expect(tools.length).toBeGreaterThan(80);
    expect(tools.filter((tool) => tool.outputSchema).map((tool) => tool.name)).toEqual([]);
  });

  it('answers every call with plain text blocks and no structured content', async () => {
    const { tools, invoke, push } = await bootMcp();
    await push('push-component-tree', {
      pageId: 'p1',
      roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
      count: 1,
      detail: null,
    });
    let answered = 0;
    for (const tool of tools.filter((t) => t.annotations?.readOnlyHint)) {
      if (tool.name === 'pangular_wait-for') continue;
      const result = await invoke(tool.name, { page: 'p1' });
      expect(result.structuredContent, tool.name).toBeUndefined();
      expect(result.content.length, tool.name).toBeGreaterThan(0);
      const [first] = result.content;
      expect(first!.type, tool.name).toBe('text');
      // Never the old `{"markdown": ...}` wrapper.
      expect(first!.text, tool.name).not.toMatch(/^\{\s*"markdown"/);
      if (!result.isError) answered += 1;
    }
    expect(answered).toBeGreaterThan(40);
  });

  it('sends the markdown itself, and a source scan as compact JSON', async () => {
    const { invoke } = await bootMcp();
    for (const [name, text] of Object.entries(TEXT_ANSWERS)) {
      const result = await invoke(name);
      expect(result.content, name).toEqual([{ type: 'text', text }]);
    }
    const scan = (await invoke('pangular_scan-build')).content[0]!.text;
    expect(() => JSON.parse(scan)).not.toThrow();
    expect(scan).not.toContain('\n');
  });

  it('asks for a component with isError instead of failing when it is missing', async () => {
    const { invoke, push } = await bootMcp();
    await push('push-component-tree', {
      pageId: 'p1',
      roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
      count: 1,
      detail: null,
    });
    for (const name of ['pangular_inspect-component', 'pangular_highlight']) {
      const result = await invoke(name, {});
      expect(result.isError, name).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0]!.text, name).toMatch(/Pass (one of )?`component`/);
    }
  });
});

describe('agent tool arguments', () => {
  const RAW_ERROR =
    /\b(?:TypeError|ReferenceError|RangeError)\b|Cannot read propert|is not a function/;
  const wrong: Record<string, unknown> = {
    string: 12345,
    integer: 'not-a-number',
    number: 'not-a-number',
    boolean: 'yes',
    array: 'not-an-array',
    object: 'not-an-object',
  };

  it('refuses every wrong-typed argument with isError and names it, never a raw error', async () => {
    const { tools, invoke, push } = await bootMcp();
    await push('push-component-tree', {
      pageId: 'p1',
      roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
      count: 1,
      detail: null,
    });
    let checked = 0;
    for (const tool of tools) {
      for (const [key, property] of Object.entries(tool.inputSchema?.properties ?? {})) {
        const value = property.type ? wrong[property.type] : undefined;
        if (value === undefined) continue;
        const result = await invoke(tool.name, { [key]: value });
        const text = result.content[0]?.text ?? '';
        expect(result.isError, `${tool.name} ${key}`).toBe(true);
        expect(text, `${tool.name} ${key}`).toContain('Invalid arguments: ');
        expect(text, `${tool.name} ${key}`).toContain(`\`${key}\` must be`);
        expect(text, `${tool.name} ${key}`).not.toMatch(RAW_ERROR);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(150);
  });

  it('refuses a missing required argument with isError', async () => {
    const { tools, invoke } = await bootMcp();
    for (const tool of tools.filter((t) => t.inputSchema?.required?.length)) {
      const result = await invoke(tool.name, {});
      const text = result.content[0]?.text ?? '';
      expect(result.isError, tool.name).toBe(true);
      expect(text, tool.name).toContain(`Pass \`${tool.inputSchema!.required![0]}\``);
      expect(text, tool.name).not.toMatch(RAW_ERROR);
    }
  });

  it('answers inspect-signals without a component instead of throwing', async () => {
    const { invoke, push } = await bootMcp();
    await push('push-signal-graph', {
      pageId: 'p1',
      nodes: [{ id: 'a', kind: 'signal', label: 'count', epoch: 0 }],
      edges: [],
      componentSelector: 'app-root',
    });
    for (const args of [{}, { component: '   ' }]) {
      const result = await invoke('pangular_inspect-signals', args);
      expect(result.isError).toBe(true);
      expect(result.content[0]!.text).toMatch(/Pass `component`/);
      expect(result.content[0]!.text).not.toMatch(RAW_ERROR);
    }
  });

  it('never acts on another tab for a page that is not a string', async () => {
    const { invoke, push } = await bootMcp();
    await push('push-component-tree', {
      pageId: 'p1',
      roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
      count: 1,
      detail: null,
    });
    const result = await invoke('pangular_list-components', { page: 12345 });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe(
      'Error invoking "pangular_list-components": Invalid arguments: `page` must be a string, not the number (12345). Pass a page id from pangular:list-pages, or leave it out for the most recent page.',
    );
    expect(result.content[0]!.text).not.toContain('p1');
  });

  it('sends an unknown page with isError', async () => {
    const { invoke, push } = await bootMcp();
    await push('push-component-tree', {
      pageId: 'p1',
      roots: [{ id: 'c1', name: 'App', tag: 'app-root', children: [] }],
      count: 1,
      detail: null,
    });
    const result = await invoke('pangular_list-components', { page: 'gone' });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/Refused: No page `gone` is reporting/);
  });
});
