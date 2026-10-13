import { modelContextOf } from './forms-webmcp.ts';

/**
 * Registers the server's `read` agent tools on the page, so a browser agent
 * finds them with no MCP setup:
 * - WebMCP: `document.modelContext.registerTool()` (`navigator.modelContext`
 *   in earlier drafts), with the `readOnlyHint` and `debugging` annotations.
 * - Chrome DevTools for agents: a `devtoolstooldiscovery` listener on
 *   `window` that answers with one tool group.
 *
 * Each call goes to the server (`call-browser-tool`), which runs the same
 * handler an MCP client gets and masks secrets in the answer. The server
 * lists no tools while `agent.browserTools` (or the panel's switch) is off,
 * and says `browser-tools-changed` when the switch moves, so the page asks
 * again then. The tools
 * answer for this page unless the agent names another one. Nothing is
 * written to the app's DOM.
 */

export const DISCOVERY_EVENT = 'devtoolstooldiscovery';

export const TOOL_GROUP = {
  name: 'Pangular Inspector',
  description:
    'Read-only Angular devtools for this page: component tree, signals, DI, router, forms, HTTP, errors and the source scan.',
};

type AnyRecord = Record<string, any>;

export interface PageTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** Broadcast by the server when the panel's Settings turns the tools on or off. */
export const CHANGED_EVENT = 'browser-tools-changed';

interface PageRpc {
  rpc: {
    call(name: string, ...args: unknown[]): Promise<unknown>;
    register?(definition: {
      name: string;
      type: 'event';
      jsonSerializable: true;
      handler: (message: unknown) => void;
    }): unknown;
  };
}

export interface BrowserToolsHandle {
  /** Unregisters the tools, on `pagehide`. */
  leave(): void;
  /** Registers them again, when a page comes back from the back/forward cache. */
  resume(): void;
  stop(): void;
}

interface DiscoveryEvent extends Event {
  respondWith?: (group: unknown) => void;
}

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function asTools(value: unknown): PageTool[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (tool): tool is PageTool =>
      !!tool &&
      typeof tool.name === 'string' &&
      typeof tool.description === 'string' &&
      !!tool.inputSchema &&
      typeof tool.inputSchema === 'object',
  );
}

/** A WebMCP implemented by the browser, which DevTools for agents already lists. */
function isNative(context: AnyRecord): boolean {
  const ModelContext = (globalThis as AnyRecord)['ModelContext'];
  return typeof ModelContext === 'function' && read(() => context instanceof ModelContext, false);
}

export function attachBrowserTools(
  my: PageRpc,
  pageId: string,
  target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
): BrowserToolsHandle {
  let generation = 0;
  let tools: PageTool[] = [];
  let context: AnyRecord | null = null;
  let controller: AbortController | null = null;
  const registered = new Set<string>();
  let listening = false;

  async function run(name: string, args: unknown): Promise<string> {
    const answer = (await my.rpc.call('call-browser-tool', { pageId, name, args })) as
      { text?: unknown; isError?: unknown } | undefined;
    const text =
      typeof answer?.text === 'string' ? answer.text : 'The devtools server gave no answer.';
    if (answer?.isError) throw new Error(text);
    return text;
  }

  const onDiscovery = (event: Event) => {
    const respond = (event as DiscoveryEvent).respondWith;
    if (typeof respond !== 'function') return;
    // A browser's own WebMCP already shows its debugging tools to DevTools for agents.
    const skip = context && isNative(context) ? registered : new Set<string>();
    const group = tools.filter((tool) => !skip.has(tool.name));
    if (!group.length) return;
    respond.call(event, {
      ...TOOL_GROUP,
      tools: group.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: (args: unknown) => run(tool.name, args),
      })),
    });
  };

  function registerWebMcp() {
    context = modelContextOf();
    if (!context) return;
    const ctx = context;
    controller = typeof AbortController === 'function' ? new AbortController() : null;
    for (const tool of tools) {
      const definition = {
        name: tool.name,
        ...(tool.title ? { title: tool.title } : {}),
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { readOnlyHint: true, untrustedContentHint: true, debugging: true },
        execute: async (args: unknown) => ({
          content: [{ type: 'text', text: await run(tool.name, args) }],
        }),
      };
      const options = controller ? { signal: controller.signal } : undefined;
      let result: unknown;
      try {
        result = ctx['registerTool'](definition, options);
      } catch {
        // A tool of the same name, or a schema this implementation refuses.
        continue;
      }
      registered.add(tool.name);
      // The draft rejects a duplicate name or an invalid schema asynchronously.
      void Promise.resolve(result).catch(() => {
        if (context === ctx) registered.delete(tool.name);
      });
    }
  }

  function unregister() {
    controller?.abort();
    controller = null;
    // Earlier drafts unregister by name instead of through the signal.
    const unregisterTool = context && read(() => context!['unregisterTool'], undefined);
    if (typeof unregisterTool === 'function') {
      for (const name of registered) read(() => unregisterTool.call(context, name), undefined);
    }
    registered.clear();
    context = null;
    if (listening) {
      target.removeEventListener(DISCOVERY_EVENT, onDiscovery);
      listening = false;
    }
  }

  async function start() {
    const mine = ++generation;
    const listed = await my.rpc.call('list-browser-tools').catch(() => []);
    if (mine !== generation) return;
    tools = asTools(listed);
    if (!tools.length) return;
    registerWebMcp();
    target.addEventListener(DISCOVERY_EVENT, onDiscovery);
    listening = true;
  }

  let away = false;
  let stopped = false;
  const leave = () => {
    generation++;
    unregister();
  };
  const restart = () => {
    leave();
    void start();
  };

  // The server lists no tools while the switch is off, so asking again
  // registers or unregisters them without a reload.
  my.rpc.register?.({
    name: CHANGED_EVENT,
    type: 'event',
    jsonSerializable: true,
    handler: () => {
      if (!away && !stopped) restart();
    },
  });

  void start();
  return {
    leave: () => {
      away = true;
      leave();
    },
    resume: () => {
      if (stopped) return;
      away = false;
      restart();
    },
    stop: () => {
      stopped = true;
      leave();
    },
  };
}
