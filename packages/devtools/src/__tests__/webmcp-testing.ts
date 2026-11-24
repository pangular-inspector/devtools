import { watchWebMcp, type WebMcpWatcher } from '../forms-webmcp.ts';

type Tool = { name: string; execute: (args: unknown) => Promise<unknown> };

/**
 * A fake `navigator.modelContext` with a watcher on it. `call(run)` registers
 * a tool whose `execute` runs `run`, and calls it through the watcher's
 * wrapper, so an effect `run` starts belongs to a WebMCP call.
 */
export async function fakeWebMcpCall(run: () => unknown) {
  const tools = new Map<string, Tool>();
  (navigator as any).modelContext = {
    registerTool: async (tool: Tool) => {
      tools.set(tool.name, tool);
    },
  };
  const watcher: WebMcpWatcher = watchWebMcp(() => {});
  await (navigator as any).modelContext.registerTool({
    name: 'agent_tool',
    description: '',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      await run();
      return { content: [] };
    },
  });
  await tools.get('agent_tool')!.execute({});
  return {
    watcher,
    /** The `caused` list of the call. */
    caused: () => watcher.report().calls[0]?.caused,
    stop() {
      watcher.stop();
      delete (navigator as any).modelContext;
    },
  };
}
