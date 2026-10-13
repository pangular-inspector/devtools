import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import { createPangular, type PangularConfig } from '../../devframe.ts';
import { resolvePangularConfig } from '../../config.ts';
import {
  browserTools,
  callBrowserTool,
  redactAnswer,
  scopedArgs,
  type BrowserTool,
  type BrowserToolHost,
} from '../browser-tools.ts';

async function boot(config: PangularConfig = {}) {
  // Page tools are off by default; these tests turn them on unless they say otherwise.
  config = { ...config, agent: { browserTools: true, ...config.agent } };
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await createPangular(config).setup(ctx as never);
  const invoke = ctx.rpc.invokeLocal.bind(ctx.rpc) as unknown as (
    name: string,
    ...args: unknown[]
  ) => Promise<any>;
  const rpc = (name: string, ...args: unknown[]) => invoke(`pangular:${name}`, ...args);
  const names = async () => ((await rpc('list-browser-tools')) as BrowserTool[]).map((t) => t.name);
  return { ctx, rpc, names };
}

const JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

describe('list-browser-tools', () => {
  it('lists only the read tools, under their MCP names, with an object input schema', async () => {
    const { rpc, names } = await boot();
    const tools = (await rpc('list-browser-tools')) as BrowserTool[];
    const list = await names();
    expect(list).toEqual(
      expect.arrayContaining([
        'pangular_list-pages',
        'pangular_inspect-component',
        'pangular_explain-form-invalid',
        'pangular_get-routes',
        'pangular_list-errors',
      ]),
    );
    for (const action of [
      'pangular_navigate',
      'pangular_form-action',
      'pangular_fill-form',
      'pangular_set-signal',
      'pangular_clear-recordings',
      'pangular_change-detection',
      'pangular_hydration',
      'pangular_analog-call-api',
    ]) {
      expect(list).not.toContain(action);
    }
    expect(list.every((name) => /^pangular_[\w.-]{1,119}$/.test(name))).toBe(true);
    expect(new Set(list).size).toBe(list.length);
    for (const tool of tools) {
      expect(tool.inputSchema['type']).toBe('object');
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it('keeps the read-only variants under agent.readOnly', async () => {
    const list = await (await boot({ agent: { readOnly: true } })).names();
    expect(list).toContain('pangular_change-detection');
    expect(list).toContain('pangular_hydration');
    expect(list).not.toContain('pangular_navigate');
  });

  it('follows inspectors and agent.tools', async () => {
    const list = await (
      await boot({ inspectors: { forms: false }, agent: { tools: { router: false } } })
    ).names();
    expect(list.some((name) => name.includes('form'))).toBe(false);
    expect(list).not.toContain('pangular_inspect-route');
    expect(list).toContain('pangular_inspect-component');
  });

  it('is off by default', () => {
    expect(resolvePangularConfig({}).agent.browserTools).toBe(false);
    expect(resolvePangularConfig({ agent: { browserTools: true } }).agent.browserTools).toBe(true);
  });

  it('is empty, and calls are refused, with agent.browserTools off', async () => {
    const { rpc, names } = await boot({ agent: { browserTools: false } });
    expect(await names()).toEqual([]);
    const answer = await rpc('call-browser-tool', { pageId: 'p1', name: 'pangular_list-pages' });
    expect(answer).toEqual({ text: expect.stringMatching(/agent\.browserTools/), isError: true });
  });
});

describe('call-browser-tool', () => {
  it('runs a read tool through the agent host and answers its markdown', async () => {
    const { rpc } = await boot();
    const answer = await rpc('call-browser-tool', {
      pageId: 'p1',
      name: 'pangular_list-pages',
      args: {},
    });
    expect(answer.isError).toBeUndefined();
    expect(typeof answer.text).toBe('string');
  });

  it('refuses an action tool and an unknown name', async () => {
    const { rpc } = await boot();
    for (const name of ['pangular_navigate', 'pangular_nope', 'devframe_state_read']) {
      const answer = await rpc('call-browser-tool', { pageId: 'p1', name, args: { url: '/' } });
      expect(answer).toEqual({ text: expect.stringMatching(/No read-only/), isError: true });
    }
  });

  it('refuses a page the connection does not own, or no page', async () => {
    const host = fakeHost(async () => ({ markdown: 'ok' }));
    const owns = (pageId: unknown): pageId is string => pageId === 'mine';
    for (const pageId of ['theirs', undefined, '', 'x'.repeat(60)]) {
      const answer = await callBrowserTool(
        host,
        { pageId, name: 'pangular_inspect-component' },
        { enabled: true, owns },
      );
      expect(answer).toEqual({ text: expect.stringMatching(/not connected/), isError: true });
    }
    expect(host.agent.invoke).not.toHaveBeenCalled();
  });

  it('scopes the call to the calling page and masks secrets in the answer', async () => {
    const host = fakeHost(async () => ({
      markdown: `token ${JWT}\nAuthorization: Bearer abc123def456\n{"password":"hunter22"}`,
    }));
    const answer = await callBrowserTool(
      host,
      { pageId: 'p9', name: 'pangular_inspect-component', args: { selector: 'app-root' } },
      { enabled: true, owns: (id): id is string => true },
    );
    expect(host.agent.invoke).toHaveBeenCalledWith('pangular:inspect-component', {
      selector: 'app-root',
      page: 'p9',
    });
    expect(answer.text).not.toContain(JWT);
    expect(answer.text).not.toContain('abc123def456');
    expect(answer.text).not.toContain('hunter22');
  });

  it('answers a thrown handler as an error, and JSON results as JSON', async () => {
    const owns = (id: unknown): id is string => true;
    const failing = fakeHost(async () => {
      throw new Error(`boom ${JWT}`);
    });
    const failed = await callBrowserTool(
      failing,
      { pageId: 'p1', name: 'pangular_get-routes' },
      { enabled: true, owns },
    );
    expect(failed.isError).toBe(true);
    expect(failed.text).toMatch(/pangular_get-routes failed: boom/);
    expect(failed.text).not.toContain(JWT);
    const json = fakeHost(async () => [{ path: '/', apiKey: 'sk-live-1234567890' }]);
    const answer = await callBrowserTool(
      json,
      { pageId: 'p1', name: 'pangular_get-routes' },
      { enabled: true, owns },
    );
    expect(JSON.parse(answer.text)[0].path).toBe('/');
    expect(answer.text).not.toContain('sk-live-1234567890');
  });
});

describe('browser tool helpers', () => {
  const tool = (properties: Record<string, unknown>): BrowserTool => ({
    name: 't',
    description: 'd',
    inputSchema: { type: 'object', properties },
  });

  it('fills page, else pageId, and keeps a page the agent named', () => {
    expect(scopedArgs(tool({ page: {} }), {}, 'p1')).toEqual({ page: 'p1' });
    expect(scopedArgs(tool({ page: {}, pageId: {} }), { pageId: 'p2' }, 'p1')).toEqual({
      pageId: 'p2',
    });
    expect(scopedArgs(tool({ page: {} }), { page: 'p3' }, 'p1')).toEqual({ page: 'p3' });
    expect(scopedArgs(tool({ pageId: {} }), undefined, 'p1')).toEqual({ pageId: 'p1' });
    expect(scopedArgs(tool({}), { a: 1 }, 'p1')).toEqual({ a: 1 });
    expect(scopedArgs(tool({}), 'junk', 'p1')).toEqual({});
  });

  it('describes RPC-backed tools from their argument schemas and skips other devframes', () => {
    const host = fakeHost(async () => null);
    const names = browserTools(host).map((entry) => entry.name);
    expect(names).toEqual([
      'pangular_inspect-component',
      'pangular_get-routes',
      'pangular_list-errors',
    ]);
    expect(browserTools(host)[1].inputSchema).toEqual({ type: 'object', properties: {} });
  });

  it('masks secret keys, JWTs and bearer tokens', () => {
    const text = redactAnswer(`{"apiToken":"abcdef123456","ok":"yes"} Bearer ${JWT}`);
    expect(text).toContain('"ok":"yes"');
    expect(text).not.toContain('abcdef123456');
    expect(text).not.toContain(JWT);
  });
});

function fakeHost(invoke: (id: string, args: unknown) => Promise<unknown>) {
  const tools = [
    {
      id: 'pangular:inspect-component',
      kind: 'tool' as const,
      title: 'pangular:inspect-component',
      description: 'One component.',
      safety: 'read' as const,
      inputSchema: { type: 'object', properties: { selector: {}, page: {} } },
    },
    {
      id: 'pangular:navigate',
      kind: 'tool' as const,
      description: 'Navigates.',
      safety: 'action' as const,
    },
    {
      id: 'pangular:get-routes',
      kind: 'rpc' as const,
      rpcName: 'pangular:get-routes',
      description: 'Routes.',
      safety: 'read' as const,
    },
    {
      id: 'pangular:list-errors',
      kind: 'tool' as const,
      description: 'Errors.',
      safety: 'read' as const,
      inputSchema: 'not a schema',
    },
    { id: 'other:read', kind: 'tool' as const, description: 'Other.', safety: 'read' as const },
  ];
  return {
    agent: { list: () => ({ tools }), invoke: vi.fn(invoke) },
    rpc: { definitions: { get: () => ({ args: [] }) } },
  } satisfies BrowserToolHost;
}
