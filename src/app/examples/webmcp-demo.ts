interface DemoTool {
  name: string;
  description: string;
  inputSchema?: unknown;
  execute: (args: unknown, client?: unknown) => unknown;
}

interface DemoModelContext {
  registerTool(tool: DemoTool, options?: { signal?: AbortSignal }): void;
  getTools(): Omit<DemoTool, 'execute'>[];
  executeTool(name: string, args: unknown): Promise<unknown>;
}

let demo: DemoModelContext | null = null;

export function installDemoModelContext(): void {
  const nav = navigator as Navigator & { modelContext?: unknown };
  const doc = document as Document & { modelContext?: unknown };
  if (doc.modelContext || nav.modelContext) return;
  const tools = new Map<string, DemoTool>();
  demo = {
    registerTool(tool, options) {
      if (tools.has(tool.name)) {
        throw new DOMException(
          `A tool named "${tool.name}" is already registered.`,
          'InvalidStateError',
        );
      }
      tools.set(tool.name, tool);
      options?.signal?.addEventListener('abort', () => tools.delete(tool.name), { once: true });
    },
    getTools: () =>
      [...tools.values()].map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      })),
    executeTool: async (name, args) => {
      const tool = tools.get(name);
      if (!tool) throw new Error(`No WebMCP tool named "${name}".`);
      return tool.execute(args, {});
    },
  };
  Object.defineProperty(nav, 'modelContext', { value: demo, configurable: true });
}

export function demoModelContext(): DemoModelContext | null {
  return demo;
}
