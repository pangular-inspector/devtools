import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';
import { isPipePageReport, mergePipePageReport, type PipePageReport } from '../rpc/pipes-tools.ts';

async function boot() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await pangular.setup(ctx as never);
  const invoke = (name: string, ...args: unknown[]) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...(args as never));
  const explain = async () =>
    (
      (await ctx.agent.invoke('pangular:explain-pipe', { name: 'async' })) as {
        markdown: string;
      }
    ).markdown;
  return { ctx, invoke, explain };
}

function page(pageId: string): PipePageReport {
  return {
    pageId,
    pipes: [
      {
        name: 'async',
        className: 'AsyncPipe',
        isPure: false,
        instanceCount: 3,
        components: [{ name: 'ExamplePage', count: 3 }],
      },
    ],
    async: [1, 2, 3].map(() => ({ component: 'ExamplePage', hasSource: true, duplicate: false })),
    instrumented: false,
  };
}

describe('pipe pages across tabs', () => {
  afterEach(() => vi.useRealTimers());

  it('drops a closed tab so reopening does not stack its instances', async () => {
    vi.useFakeTimers();
    const { invoke, explain } = await boot();

    await invoke('push-pipes', page('tab-1'));
    expect(await explain()).toContain('3 instance(s)');

    // tab-1 closes without a `forget`; a new tab opens 20s later.
    await vi.advanceTimersByTimeAsync(20_000);
    await invoke('push-pipes', page('tab-2'));
    expect(await explain()).toContain('3 instance(s)');
  });
});

describe('pipe pages and their connections', () => {
  it('drops a page the moment its connection closes', async () => {
    const { ctx, invoke, explain } = await boot();
    const host = ctx.rpc as unknown as {
      getCurrentRpcSession: () => unknown;
      _emitSessionDisconnected: (meta: { id: number }) => void;
    };

    host.getCurrentRpcSession = () => ({ meta: { id: 1 } });
    await invoke('push-pipes', page('tab-1'));
    host.getCurrentRpcSession = () => ({ meta: { id: 2 } });
    await invoke('push-pipes', page('tab-2'));
    expect(await explain()).toContain('6 instance(s)');

    host._emitSessionDisconnected({ id: 1 });
    expect(await explain()).toContain('3 instance(s)');

    // A reconnect re-binds the page to its new connection, so the old
    // connection closing afterwards must not drop it.
    host.getCurrentRpcSession = () => ({ meta: { id: 3 } });
    await invoke('push-pipes', page('tab-2'));
    host._emitSessionDisconnected({ id: 2 });
    expect(await explain()).toContain('3 instance(s)');
  });
});

describe('pipe page targets', () => {
  it('keeps each page host element when merging the same component across tabs', () => {
    const pages = new Map();
    const withTarget = (pageId: string): PipePageReport => ({
      ...page(pageId),
      pipes: [
        {
          ...page(pageId).pipes[0],
          components: [{ name: 'ExamplePage', count: 3, targets: [{ pageId, id: 'c1' }] }],
        },
      ],
    });
    mergePipePageReport(pages, withTarget('tab-1'), 0);
    const state = mergePipePageReport(pages, withTarget('tab-2'), 0);
    expect(state.pipes[0].components).toEqual([
      {
        name: 'ExamplePage',
        count: 6,
        targets: [
          { pageId: 'tab-1', id: 'c1' },
          { pageId: 'tab-2', id: 'c1' },
        ],
      },
    ]);
  });

  it('lists a host element once when two pipes with the same name use it', () => {
    const pages = new Map();
    const pipe = {
      ...page('tab-1').pipes[0],
      components: [{ name: 'ExamplePage', count: 1, targets: [{ pageId: 'tab-1', id: 'c1' }] }],
    };
    const state = mergePipePageReport(pages, { ...page('tab-1'), pipes: [pipe, pipe] }, 0);
    expect(state.pipes[0].components[0].targets).toEqual([{ pageId: 'tab-1', id: 'c1' }]);
  });

  it('rejects a report whose targets are malformed', () => {
    const report = page('tab-1');
    expect(isPipePageReport(report)).toBe(true);
    const bad = {
      ...report,
      pipes: [{ ...report.pipes[0], components: [{ name: 'X', count: 1, targets: [{ id: 1 }] }] }],
    };
    expect(isPipePageReport(bad)).toBe(false);
    expect(isPipePageReport({ ...report, async: [{ ...report.async![0], target: 'c1' }] })).toBe(
      false,
    );
  });
});

describe('pipe recording requests', () => {
  it('says how many pages the request reached', async () => {
    const { invoke } = await boot();
    expect(await invoke('request-instrument-pipes', true)).toEqual({ pages: 0 });
    await invoke('push-pipes', page('tab-1'));
    expect(await invoke('request-instrument-pipes', true)).toEqual({ pages: 1 });
  });
});
