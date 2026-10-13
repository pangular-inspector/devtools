// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CHANGED_EVENT,
  DISCOVERY_EVENT,
  TOOL_GROUP,
  attachBrowserTools,
  type BrowserToolsHandle,
} from '../browser-tools.ts';
import { watchWebMcp } from '../forms-webmcp.ts';

type Registered = {
  name: string;
  title?: string;
  description: string;
  inputSchema: unknown;
  annotations?: Record<string, boolean>;
  execute: (args: unknown) => Promise<unknown>;
};

const LISTED = [
  {
    name: 'pangular_inspect-component',
    description: 'One component instance.',
    inputSchema: { type: 'object', properties: { selector: { type: 'string' } } },
  },
  {
    name: 'pangular_get-routes',
    title: 'Routes',
    description: 'Routes from the source.',
    inputSchema: { type: 'object', properties: {} },
  },
];

const handles: BrowserToolsHandle[] = [];
afterEach(() => {
  handles.splice(0).forEach((handle) => handle.stop());
  delete (document as any).modelContext;
  delete (navigator as any).modelContext;
  delete (globalThis as any).ModelContext;
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeRpc(answers: Record<string, unknown> = {}, listed: unknown = LISTED) {
  const call = vi.fn(async (name: string, message?: any) => {
    if (name === 'list-browser-tools') return listed;
    if (name === 'call-browser-tool') {
      return answers[message.name] ?? { text: `ran ${message.name} for ${message.pageId}` };
    }
    throw new Error(`unexpected ${name}`);
  });
  return { rpc: { call } };
}

/** The draft's `document.modelContext`: rejects duplicates, unregisters through the signal. */
function fakeContext(on: 'document' | 'navigator' = 'document') {
  const tools = new Map<string, Registered>();
  const context = {
    registerTool: vi.fn(async (tool: Registered, options?: { signal?: AbortSignal }) => {
      if (tools.has(tool.name)) throw new DOMException('duplicate', 'InvalidStateError');
      tools.set(tool.name, tool);
      options?.signal?.addEventListener('abort', () => tools.delete(tool.name), { once: true });
    }),
  };
  (on === 'document' ? (document as any) : (navigator as any)).modelContext = context;
  return { context, tools };
}

function attach(my = fakeRpc(), pageId = 'p1') {
  const handle = attachBrowserTools(my, pageId);
  handles.push(handle);
  return handle;
}

function discover() {
  const groups: any[] = [];
  const event = new CustomEvent(DISCOVERY_EVENT) as CustomEvent & { respondWith?: unknown };
  event.respondWith = (group: unknown) => groups.push(group);
  window.dispatchEvent(event);
  return groups;
}

describe('browser tools on the page', () => {
  it('registers each read tool through document.modelContext with read-only debugging hints', async () => {
    const { tools } = fakeContext();
    attach();
    await tick();
    expect([...tools.keys()]).toEqual(['pangular_inspect-component', 'pangular_get-routes']);
    const tool = tools.get('pangular_inspect-component')!;
    expect(tool.annotations).toEqual({
      readOnlyHint: true,
      untrustedContentHint: true,
      debugging: true,
    });
    expect(tool.inputSchema).toEqual(LISTED[0].inputSchema);
    expect(tools.get('pangular_get-routes')!.title).toBe('Routes');
  });

  it('falls back to navigator.modelContext from earlier drafts', async () => {
    const { tools } = fakeContext('navigator');
    attach();
    await tick();
    expect(tools.size).toBe(2);
  });

  it('runs a call on the server for this page and answers as text content', async () => {
    const { tools } = fakeContext();
    const my = fakeRpc();
    attach(my, 'page-7');
    await tick();
    const result = await tools.get('pangular_inspect-component')!.execute({ selector: 'app-root' });
    expect(my.rpc.call).toHaveBeenCalledWith('call-browser-tool', {
      pageId: 'page-7',
      name: 'pangular_inspect-component',
      args: { selector: 'app-root' },
    });
    expect(result).toEqual({
      content: [{ type: 'text', text: 'ran pangular_inspect-component for page-7' }],
    });
  });

  it('rejects the call when the server refuses it', async () => {
    const { tools } = fakeContext();
    attach(
      fakeRpc({ 'pangular_get-routes': { text: 'Browser tools are turned off.', isError: true } }),
    );
    await tick();
    await expect(tools.get('pangular_get-routes')!.execute({})).rejects.toThrow(/turned off/);
  });

  it('answers devtoolstooldiscovery with one tool group', async () => {
    const my = fakeRpc();
    attach(my);
    await tick();
    const groups = discover();
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe(TOOL_GROUP.name);
    expect(groups[0].tools.map((tool: any) => tool.name)).toEqual([
      'pangular_inspect-component',
      'pangular_get-routes',
    ]);
    expect(typeof groups[0].tools[0].inputSchema).toBe('object');
    await expect(groups[0].tools[1].execute({})).resolves.toBe('ran pangular_get-routes for p1');
  });

  it('leaves out of the group the tools a native WebMCP already shows', async () => {
    class ModelContext {
      registerTool = vi.fn(async () => undefined);
    }
    (globalThis as any).ModelContext = ModelContext;
    (document as any).modelContext = new ModelContext();
    attach();
    await tick();
    expect(discover()).toEqual([]);
  });

  it('keeps a tool in the group when WebMCP refused it', async () => {
    class ModelContext {
      registerTool = vi.fn(async (tool: Registered) => {
        if (tool.name === 'pangular_get-routes') throw new TypeError('bad schema');
      });
    }
    (globalThis as any).ModelContext = ModelContext;
    (document as any).modelContext = new ModelContext();
    attach();
    await tick();
    await tick();
    expect(discover()[0].tools.map((tool: any) => tool.name)).toEqual(['pangular_get-routes']);
  });

  it('does nothing without WebMCP or tools, and survives a context that throws', async () => {
    attach(fakeRpc({}, []));
    await tick();
    expect(discover()).toEqual([]);
    (document as any).modelContext = {
      registerTool: () => {
        throw new Error('nope');
      },
    };
    attach();
    await tick();
    expect(discover()[0].tools).toHaveLength(2);
  });

  it('unregisters on leave and registers again on resume', async () => {
    const { tools, context } = fakeContext();
    const handle = attach();
    await tick();
    expect(tools.size).toBe(2);
    handle.leave();
    expect(tools.size).toBe(0);
    expect(discover()).toEqual([]);
    handle.resume();
    await tick();
    expect(tools.size).toBe(2);
    expect(context.registerTool).toHaveBeenCalledTimes(4);
    expect(discover()).toHaveLength(1);
  });

  it('unregisters by name where the draft has unregisterTool and no signal', async () => {
    const names = new Set<string>();
    (navigator as any).modelContext = {
      registerTool: (tool: Registered) => void names.add(tool.name),
      unregisterTool: (name: string) => void names.delete(name),
    };
    const handle = attach();
    await tick();
    expect(names.size).toBe(2);
    handle.stop();
    expect(names.size).toBe(0);
  });

  it('registers nothing when stopped before the list arrives', async () => {
    const { tools } = fakeContext();
    const handle = attach();
    handle.stop();
    await tick();
    expect(tools.size).toBe(0);
    expect(discover()).toEqual([]);
  });

  it('registers or unregisters without a reload when the panel switch changes', async () => {
    const { tools } = fakeContext();
    let listed: unknown = [];
    const handlers = new Map<string, (message: unknown) => void>();
    const my = {
      rpc: {
        call: vi.fn(async (name: string) => {
          if (name === 'list-browser-tools') return listed;
          throw new Error(`unexpected ${name}`);
        }),
        register: (definition: { name: string; handler: (message: unknown) => void }) =>
          void handlers.set(definition.name, definition.handler),
      },
    };
    attach(my);
    await tick();
    expect(tools.size).toBe(0);
    expect(discover()).toEqual([]);

    listed = LISTED;
    handlers.get(CHANGED_EVENT)!({ enabled: true, config: false });
    await tick();
    expect([...tools.keys()]).toEqual(['pangular_inspect-component', 'pangular_get-routes']);
    expect(discover()).toHaveLength(1);

    listed = [];
    handlers.get(CHANGED_EVENT)!({ enabled: false, config: false });
    await tick();
    expect(tools.size).toBe(0);
    expect(discover()).toEqual([]);
  });

  it('ignores the switch while the page is away or after it stopped', async () => {
    const { tools } = fakeContext();
    const handlers = new Map<string, (message: unknown) => void>();
    const my = {
      rpc: {
        call: vi.fn(async () => LISTED),
        register: (definition: { name: string; handler: (message: unknown) => void }) =>
          void handlers.set(definition.name, definition.handler),
      },
    };
    const handle = attach(my);
    await tick();
    handle.leave();
    handlers.get(CHANGED_EVENT)!({ enabled: true });
    await tick();
    expect(tools.size).toBe(0);
    handle.resume();
    await tick();
    expect(tools.size).toBe(2);
    handle.stop();
    handlers.get(CHANGED_EVENT)!({ enabled: true });
    handle.resume();
    await tick();
    expect(tools.size).toBe(0);
    expect(my.rpc.call).toHaveBeenCalledTimes(2);
  });

  it('stays out of the Forms inspector WebMCP list', async () => {
    const { context } = fakeContext();
    const watcher = watchWebMcp(() => {});
    try {
      attach();
      await tick();
      await context.registerTool({
        name: 'checkout',
        description: 'Checkout form',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => ({}),
      });
      await tick();
      const names = watcher.describe([]).page?.tools.map((tool) => tool.name);
      expect(names).toEqual(['checkout']);
    } finally {
      watcher.stop();
    }
  });
});
