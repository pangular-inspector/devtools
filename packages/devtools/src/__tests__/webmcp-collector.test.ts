// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachWebMcp } from '../webmcp-collector.ts';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => {
  delete (navigator as any).modelContext;
});

function fakeContext() {
  const tools = new Map<string, any>();
  (navigator as any).modelContext = {
    registerTool: (tool: any) => void tools.set(tool.name, tool),
    getTools: () => [...tools.values()].map(({ name, description }) => ({ name, description })),
  };
  return tools;
}

describe('attachWebMcp', () => {
  it('reports tools registered before it attached', async () => {
    fakeContext();
    (navigator as any).modelContext.registerTool({
      name: 'early',
      description: 'd',
      execute: () => 1,
    });
    const call = vi.fn(async (..._args: unknown[]) => undefined);
    const collector = attachWebMcp({ rpc: { call } }, 'p1');
    await wait(150);
    expect(call).toHaveBeenCalledWith('push-webmcp', expect.objectContaining({ pageId: 'p1' }));
    expect((call.mock.calls[0] as any)[1].tools[0].name).toBe('early');
    collector.stop();
  });

  it('sends the unchanged report again after it resumes', async () => {
    fakeContext();
    (navigator as any).modelContext.registerTool({ name: 'x', description: 'd', execute: () => 1 });
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
