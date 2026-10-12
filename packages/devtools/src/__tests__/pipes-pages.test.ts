import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';
import { isPipePageReport, mergePipePageReport, type PipePageReport } from '../rpc/pipes-tools.ts';
import { fixtureDir } from '../rpc/__tests__/fixture-dir.ts';

async function boot() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  // An empty project: explain-pipe scans the source on every call, and these
  // tests are about live data only.
  const cwd = fixtureDir('pangular-pipes-pages-');
  const ctx = await createHostContext({ cwd, mode: 'dev', host: host as never });
  await pangular.setup(ctx as never);
  const invoke = (name: string, ...args: unknown[]) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...(args as never));
  const tool = async (id: string, args: Record<string, unknown>) =>
    ((await ctx.agent.invoke(`pangular:${id}`, args)) as { markdown: string }).markdown;
  const explain = (page?: string) => tool('explain-pipe', { name: 'async', page });
  return { ctx, invoke, explain, tool };
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
    const key = 'k'.repeat(32);
    await invoke('claim-page', { pageId: 'tab-2', key });
    await invoke('push-pipes', page('tab-2'));
    expect(await explain('tab-1')).toContain('3 instance(s)');

    host._emitSessionDisconnected({ id: 1 });
    expect(await explain('tab-1')).toMatch(/^No page `tab-1` is reporting pipe usage/);
    expect(await explain('tab-2')).toContain('3 instance(s)');

    // A reconnect shows the page's key and re-binds the page to its new
    // connection, so the old connection closing afterwards must not drop it.
    host.getCurrentRpcSession = () => ({ meta: { id: 3 } });
    await invoke('claim-page', { pageId: 'tab-2', key });
    await invoke('push-pipes', page('tab-2'));
    host._emitSessionDisconnected({ id: 2 });
    expect(await explain('tab-2')).toContain('3 instance(s)');
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
  it('rejects a report whose call or stale finding is malformed', () => {
    const report = page('tab-1');
    const withPipe = (extra: Record<string, unknown>) => ({
      ...report,
      pipes: [{ ...report.pipes[0], ...extra }],
    });
    expect(isPipePageReport(withPipe({ call: { callCount: 1, totalMs: 2 } }))).toBe(true);
    expect(isPipePageReport(withPipe({ call: { callCount: '1' } }))).toBe(false);
    expect(isPipePageReport(withPipe({ call: { callCount: 1, lastArgs: 'x' } }))).toBe(false);
    expect(
      isPipePageReport(withPipe({ call: { callCount: 1, instances: [{ callCount: 1 }] } })),
    ).toBe(false);
    expect(isPipePageReport(withPipe({ stale: { detectedAt: 'now' } }))).toBe(false);
  });

  it('clamps oversized call values and lists before keeping a report', () => {
    const pages = new Map();
    const huge = 'x'.repeat(10_000);
    const report = page('tab-1');
    report.pipes[0].call = {
      callCount: 1,
      lastArgs: Array.from({ length: 50 }, () => huge),
      lastResult: huge,
      lastCaller: huge,
      instances: Array.from({ length: 40 }, () => ({ component: 'X', callCount: 1 })),
    };
    report.async = Array.from({ length: 500 }, () => report.async![0]);
    const state = mergePipePageReport(pages, report, 1000);
    const call = state.pipes[0].call!;
    expect(call.lastArgs!.length).toBeLessThanOrEqual(10);
    expect((call.lastArgs![0] as string).length).toBeLessThan(1000);
    expect((call.lastResult as string).length).toBeLessThan(1000);
    expect(call.lastCaller!.length).toBeLessThan(1000);
    expect(call.instances!.length).toBeLessThanOrEqual(10);
    expect(call.instanceTotal).toBe(40);
    report.pipes[0].call.instanceTotal = 90;
    expect(mergePipePageReport(pages, report, 1001).pipes[0].call!.instanceTotal).toBe(90);
    expect(state.async).toHaveLength(200);
    expect(state.asyncTotal).toBe(500);
  });

  it('sums time and errors across pages and splits the state by page', () => {
    const pages = new Map();
    const a = page('tab-1');
    a.pipes[0].call = { callCount: 2, totalMs: 3, maxMs: 2, lastMs: 1 };
    const b = page('tab-2');
    b.pipes[0].call = {
      callCount: 1,
      totalMs: 5,
      maxMs: 5,
      lastMs: 5,
      errorCount: 1,
      lastError: 'boom',
    };
    mergePipePageReport(pages, a, 1000);
    const state = mergePipePageReport(pages, b, 1001);
    expect(state.pipes[0].call).toMatchObject({
      callCount: 3,
      totalMs: 8,
      maxMs: 5,
      errorCount: 1,
      lastError: 'boom',
    });
    expect(state.pages?.map((p) => p.pageId)).toEqual(['tab-1', 'tab-2']);
    expect(state.pages?.[0].pipes[0].call?.callCount).toBe(2);
    expect(state.pages?.[1].async).toHaveLength(3);
  });

  it('keeps the stale check marked off only when every page has it off', () => {
    const off = page('tab-1');
    off.pipes[0].staleCheck = 'unavailable';
    const pages = new Map();
    expect(mergePipePageReport(pages, off, 1000).pipes[0].staleCheck).toBe('unavailable');
    expect(mergePipePageReport(pages, page('tab-2'), 1001).pipes[0].staleCheck).toBeUndefined();
  });

  it('does not repeat the data by page when only one page reports', () => {
    const state = mergePipePageReport(new Map(), page('tab-1'), 1000);
    expect(state.pages).toBeUndefined();
  });
});

describe('pipe recording requests', () => {
  it('says how many pages the request reached', async () => {
    const { invoke } = await boot();
    expect(await invoke('request-instrument-pipes', true)).toEqual({ pages: 0 });
    await invoke('push-pipes', page('tab-1'));
    expect(await invoke('request-instrument-pipes', true)).toEqual({ pages: 1 });
  });

  it('does not start recording on every tab before any page has reported', async () => {
    const { ctx, invoke } = await boot();
    const broadcast = vi.spyOn(ctx.rpc, 'broadcast');
    expect(await invoke('request-instrument-pipes', true)).toEqual({ pages: 0 });
    const starts = broadcast.mock.calls.filter(
      ([options]) => (options as { method: string }).method === 'pangular:instrument-pipes',
    );
    expect(starts).toHaveLength(0);
  });

  it('sends the page id with the request so other tabs stay unpatched', async () => {
    vi.useFakeTimers();
    try {
      const { ctx, invoke } = await boot();
      const broadcast = vi.spyOn(ctx.rpc, 'broadcast');
      const sent = () =>
        broadcast.mock.calls
          .map(([options]) => options as { method: string; args: unknown[] })
          .filter((options) => options.method === 'pangular:instrument-pipes')
          .at(-1)?.args;
      await invoke('push-pipes', page('tab-1'));
      await vi.advanceTimersByTimeAsync(1000);
      await invoke('push-pipes', page('tab-2'));

      expect(await invoke('request-instrument-pipes', { pageId: 'tab-1', on: true })).toEqual({
        pages: 1,
      });
      expect(sent()).toEqual([{ pageId: 'tab-1', on: true }]);
      expect(await invoke('request-instrument-pipes', { pageId: 'gone', on: true })).toEqual({
        pages: 0,
      });
      // Without a page id, start picks the latest page and stop reaches every page.
      await invoke('request-instrument-pipes', true);
      expect(sent()).toEqual([{ pageId: 'tab-2', on: true }]);
      expect(await invoke('request-instrument-pipes', { on: false })).toEqual({ pages: 2 });
      expect(sent()).toEqual([{ on: false }]);
    } finally {
      vi.useRealTimers();
    }
  });
});

function pageWith(pageId: string, instanceCount: number, callCount?: number): PipePageReport {
  const base = page(pageId);
  return {
    ...base,
    pipes: [
      {
        ...base.pipes[0],
        instanceCount,
        components: [{ name: 'ExamplePage', count: instanceCount }],
        ...(callCount === undefined
          ? {}
          : { call: { callCount, lastArgs: [pageId], lastResult: pageId } }),
      },
    ],
    instrumented: callCount !== undefined,
  };
}

describe('explain-pipe page scoping', () => {
  it('answers from the most recent page, or the one `page` names, without mixing tabs', async () => {
    vi.useFakeTimers();
    try {
      const { invoke, explain } = await boot();
      await invoke('push-pipes', pageWith('tab-1', 2, 5));
      await vi.advanceTimersByTimeAsync(1000);
      await invoke('push-pipes', pageWith('tab-2', 4));

      const latest = await explain();
      expect(latest).toMatch(/^Live data from page `tab-2`; 2 pages report pipe usage/);
      expect(latest).toContain('4 instance(s)');
      expect(latest).toContain('recording is off');
      expect(latest).not.toContain('6 instance(s)');

      const first = await explain('tab-1');
      expect(first).toContain('Live data from page `tab-1`');
      expect(first).toContain('2 instance(s)');
      expect(first).toContain('Called 5 time(s)');
      expect(first).toContain('Last input: `[tab-1]`');
    } finally {
      vi.useRealTimers();
    }
  });

  it('names the reporting pages when `page` is unknown', async () => {
    const { invoke, explain } = await boot();
    expect(await explain('gone')).toBe(
      'No page `gone` is reporting pipe usage. No page reports pipe usage right now.',
    );
    await invoke('push-pipes', page('tab-1'));
    expect(await explain('gone')).toBe(
      'No page `gone` is reporting pipe usage. Pages that report pipe usage: `tab-1`. Pass one of these ids as `page`, or leave `page` out for the most recent.',
    );
  });

  it('adds no page line when only one page reports', async () => {
    const { invoke, explain } = await boot();
    await invoke('push-pipes', page('tab-1'));
    const text = await explain();
    expect(text).not.toContain('Live data from page');
    expect(text).toContain('3 instance(s)');
  });
});

describe('record-pipes agent tool', () => {
  const recordings = (broadcast: { mock: { calls: unknown[][] } }) =>
    broadcast.mock.calls
      .map(([options]) => options as { method: string; args: unknown[] })
      .filter((options) => options.method === 'pangular:instrument-pipes')
      .map((options) => options.args[0]);

  it('starts and stops recording through the same request the panel sends', async () => {
    vi.useFakeTimers();
    try {
      const { ctx, invoke, tool } = await boot();
      const broadcast = vi.spyOn(ctx.rpc, 'broadcast');
      await invoke('push-pipes', page('tab-1'));
      await vi.advanceTimersByTimeAsync(1000);
      await invoke('push-pipes', page('tab-2'));

      expect(await tool('record-pipes', { action: 'start' })).toMatch(
        /^Recording pipe calls on page `tab-2`\./,
      );
      expect(await tool('record-pipes', { action: 'start', page: 'tab-1' })).toMatch(
        /^Recording pipe calls on page `tab-1`\./,
      );
      expect(await tool('record-pipes', { action: 'stop', page: 'tab-1' })).toMatch(
        /^Recording stopped on page `tab-1`\./,
      );
      expect(await tool('record-pipes', { action: 'stop' })).toMatch(
        /^Recording stopped on 2 page\(s\)\./,
      );
      expect(recordings(broadcast)).toEqual([
        { pageId: 'tab-2', on: true },
        { pageId: 'tab-1', on: true },
        { pageId: 'tab-1', on: false },
        { on: false },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends nothing for an unknown page, a missing action or before any page reports', async () => {
    const { ctx, invoke, tool } = await boot();
    const broadcast = vi.spyOn(ctx.rpc, 'broadcast');
    expect(await tool('record-pipes', { action: 'start' })).toMatch(
      /^No page reports pipe usage, so there is nothing to record/,
    );
    await invoke('push-pipes', page('tab-1'));
    expect(await tool('record-pipes', { action: 'start', page: 'gone' })).toMatch(
      /^No page `gone` is reporting pipe usage\. Pages that report pipe usage: `tab-1`/,
    );
    expect(await tool('record-pipes', {})).toBe('Pass `action`: "start" or "stop".');
    expect(recordings(broadcast)).toEqual([]);
  });

  it('points explain-pipe at the agent tool while recording is off', async () => {
    const { invoke, explain } = await boot();
    await invoke('push-pipes', page('tab-1'));
    expect(await explain()).toContain('Start it with pangular:record-pipes');
  });
});
