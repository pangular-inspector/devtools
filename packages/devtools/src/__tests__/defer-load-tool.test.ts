import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import pangular, { createPangular } from '../devframe.ts';
import type { PangularConfig } from '../config.ts';
import { agentSafety, resolvePangularConfig } from '../config.ts';
import { UNTRUSTED } from '../rpc/forms-tools.ts';
import { answerText } from './tool-answer.ts';

async function boot(config?: PangularConfig) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await (config ? createPangular(config) : pangular).setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const call = async (tool: string, args: Record<string, unknown>) =>
    await answerText(ctx.agent.invoke(`pangular:${tool}`, args));
  const tools = () => ctx.agent.list().tools.map((tool) => tool.id);
  return { ctx, push, call, tools };
}

const tree = (pageId: string, blocks: string[] = ['d1']) => ({
  pageId,
  url: `/${pageId}`,
  count: 1,
  detail: null,
  roots: [{ id: `${pageId}-root`, name: 'App', tag: 'app-root', children: [] }],
  deferBlocks: blocks.map((id) => ({
    id,
    owner: { id: `${pageId}-root`, name: 'App', tag: 'app-root' },
    state: 'placeholder',
    hydration: 'not-configured',
    triggers: ['on viewport'],
    hasErrorBlock: false,
    rootIds: [],
    since: 1,
  })),
});

type Load = { requestId: string; pageId: string; id: string };

/** Answers every defer-load broadcast the way the page would. */
function answerLoads(
  ctx: Awaited<ReturnType<typeof boot>>['ctx'],
  push: Awaited<ReturnType<typeof boot>>['push'],
  result: (message: Load) => unknown,
) {
  const sent: Load[] = [];
  vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: {
    method: string;
    args: [Load];
  }) => {
    if (!options.method.endsWith('defer-load')) return;
    const message = options.args[0];
    sent.push(message);
    setTimeout(
      () =>
        void push('defer-load-result', {
          requestId: message.requestId,
          pageId: message.pageId,
          result: result(message),
        }),
      5,
    );
  }) as never);
  return sent;
}

describe('load-defer-block', () => {
  it('is an action tool of the components inspector', () => {
    expect(agentSafety('pangular:load-defer-block', resolvePangularConfig())).toBe('action');
  });

  it('sends the load to the page that has the block and reports the new state', async () => {
    const { ctx, push, call } = await boot();
    await push('push-component-tree', tree('p1'));
    await push('push-component-tree', tree('p2', ['d7']));
    const sent = answerLoads(ctx, push, () => ({ ok: true, state: 'complete' }));
    const text = await call('load-defer-block', { block: 'd7' });
    expect(sent).toEqual([{ requestId: expect.any(String), pageId: 'p2', id: 'd7' }]);
    expect(text.startsWith(UNTRUSTED)).toBe(true);
    expect(text).toContain('Loaded defer block `d7` in App on page `p2`');
  });

  it('passes the page refusal on, and says when the load fell back to @error', async () => {
    const { ctx, push, call } = await boot();
    await push('push-component-tree', tree('p1'));
    answerLoads(ctx, push, () => ({ error: 'The block is server HTML.' }));
    expect(await call('load-defer-block', { block: 'd1' })).toContain(
      'Defer block `d1` in App on page `p1` was not loaded. The block is server HTML.',
    );
    vi.restoreAllMocks();
    answerLoads(ctx, push, () => ({ ok: true, state: 'error' }));
    expect(await call('load-defer-block', { block: 'd1' })).toContain('shows its @error block');
  });

  it('names what change detection threw while the block rendered', async () => {
    const { ctx, push, call } = await boot();
    await push('push-component-tree', tree('p1'));
    answerLoads(ctx, push, () => ({ ok: true, state: 'complete', renderError: 'NG0100' }));
    expect(await call('load-defer-block', { block: 'd1' })).toContain(
      'Change detection threw while it rendered: NG0100.',
    );
  });

  it('asks for a page when several tabs have the same block id, and refuses unknown ids', async () => {
    const { ctx, push, call } = await boot();
    await push('push-component-tree', tree('p1'));
    await push('push-component-tree', tree('p2'));
    const sent = answerLoads(ctx, push, () => ({ ok: true, state: 'complete' }));
    expect(await call('load-defer-block', { block: 'd1' })).toContain('pass one of these ids');
    expect(await call('load-defer-block', { block: 'd9' })).toContain('No defer block `d9`');
    expect(sent).toEqual([]);
    await call('load-defer-block', { block: 'd1', page: 'p1' });
    expect(sent.map((s) => s.pageId)).toEqual(['p1']);
  });

  it('ignores a result from another page', async () => {
    const { ctx, push, call } = await boot();
    await push('push-component-tree', tree('p1'));
    vi.useFakeTimers();
    try {
      vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: {
        method: string;
        args: [Load];
      }) => {
        if (!options.method.endsWith('defer-load')) return;
        void push('defer-load-result', {
          requestId: options.args[0].requestId,
          pageId: 'p2',
          result: { ok: true },
        });
      }) as never);
      const answer = call('load-defer-block', { block: 'd1' });
      await vi.advanceTimersByTimeAsync(16_000);
      expect(await answer).toContain('No page answered');
    } finally {
      vi.useRealTimers();
    }
  });

  it('is left out when actions.components is off or agents are read only', async () => {
    for (const config of [
      { actions: { components: false } },
      { agent: { readOnly: true } },
      { inspectors: { components: false } },
    ] satisfies PangularConfig[]) {
      const { tools } = await boot(config);
      expect(tools(), JSON.stringify(config)).not.toContain('pangular:load-defer-block');
    }
  });
});
