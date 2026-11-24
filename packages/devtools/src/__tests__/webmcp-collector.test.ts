// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachWebMcp } from '../webmcp-collector.ts';
import type { WebMcpReport } from '../webmcp-trace.ts';

interface FakeTool {
  name: string;
  description: string;
  execute: (args: unknown) => unknown;
}

interface FakeContext {
  registerTool(tool: FakeTool): void;
  getTools(): Pick<FakeTool, 'name' | 'description'>[];
}

type WithContext = Navigator & { modelContext?: FakeContext };

const nav = navigator as WithContext;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => {
  delete nav.modelContext;
});

function fakeContext(): FakeContext {
  const tools = new Map<string, FakeTool>();
  const context: FakeContext = {
    registerTool: (tool) => void tools.set(tool.name, tool),
    getTools: () => [...tools.values()].map(({ name, description }) => ({ name, description })),
  };
  nav.modelContext = context;
  return context;
}

describe('attachWebMcp', () => {
  it('reports tools registered before it attached', async () => {
    fakeContext().registerTool({
      name: 'early',
      description: 'd',
      execute: () => 1,
    });
    const call = vi.fn(async (..._args: unknown[]) => undefined);
    const collector = attachWebMcp({ rpc: { call } }, 'p1');
    await wait(150);
    expect(call).toHaveBeenCalledWith('push-webmcp', expect.objectContaining({ pageId: 'p1' }));
    const report = call.mock.calls[0]?.[1] as WebMcpReport;
    expect(report.tools[0]?.name).toBe('early');
    collector.stop();
  });

  it('sends the unchanged report again after it resumes', async () => {
    fakeContext().registerTool({ name: 'x', description: 'd', execute: () => 1 });
    const call = vi.fn(async (..._args: unknown[]) => undefined);
    const collector = attachWebMcp({ rpc: { call } }, 'p1');
    await wait(150);
    const pushes = () => call.mock.calls.filter(([name]) => name === 'push-webmcp').length;
    expect(pushes()).toBe(1);
    collector.leave();
    collector.resume();
    await wait(150);
    expect(pushes()).toBe(2);
    collector.stop();
  });

  it('sends nothing for a page without modelContext or tools', async () => {
    const call = vi.fn(async (..._args: unknown[]) => undefined);
    const collector = attachWebMcp({ rpc: { call } }, 'p1');
    await collector.push(true);
    expect(call).not.toHaveBeenCalled();
    collector.stop();
  });
});
