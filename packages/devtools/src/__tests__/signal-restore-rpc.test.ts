import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import pangular, { createPangular } from '../devframe.ts';
import { RPC_INSPECTOR, resolvePangularConfig, type PangularConfig } from '../config.ts';
import { createSignalRestores } from '../rpc/signal-restores.ts';

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
  return { ctx, push };
}

const graph = (pageId: string) => ({
  pageId,
  nodes: [
    { id: '2', kind: 'signal', label: 'title', epoch: 3, locator: { id: 'c1', key: 'title' } },
    { id: '7', kind: 'computed', label: 'shout', epoch: 4 },
  ],
  edges: [],
  component: { id: 'c1', name: 'Editor', tag: 'app-root', path: 'app-root' },
});

type Sent = { requestId: string; pageId: string; request: Record<string, unknown> };

function answerRestores(
  ctx: Awaited<ReturnType<typeof boot>>['ctx'],
  push: Awaited<ReturnType<typeof boot>>['push'],
  result: (request: Record<string, unknown>) => unknown,
) {
  const sent: Sent[] = [];
  vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: {
    method: string;
    args: [Sent];
  }) => {
    if (!options.method.endsWith('signal-restore')) return;
    const message = options.args[0];
    sent.push(message);
    setTimeout(
      () =>
        void push('signal-restore-result', {
          requestId: message.requestId,
          pageId: message.pageId,
          result: result(message.request),
        }),
      5,
    );
  }) as never);
  return sent;
}

describe('request-signal-restore', () => {
  it('belongs to the signals inspector', () => {
    expect(RPC_INSPECTOR['request-signal-restore']).toBe('signals');
    expect(RPC_INSPECTOR['signal-restore-result']).toBe('signals');
  });

  it('sends the entry to the page that reported it and returns its answer', async () => {
    const { ctx, push } = await boot();
    await push('push-signal-graph', graph('p1'));
    const sent = answerRestores(ctx, push, () => ({
      ok: true,
      component: 'Editor',
      key: 'title',
      epoch: 1,
      value: 'One',
    }));
    const result = await push('request-signal-restore', {
      pageId: 'p1',
      request: { component: 'c1', node: '2', epoch: 1 },
    });
    expect(result).toEqual({ ok: true, component: 'Editor', key: 'title', epoch: 1, value: 'One' });
    expect(sent).toEqual([
      {
        requestId: expect.any(String),
        pageId: 'p1',
        request: { component: 'c1', node: '2', epoch: 1 },
      },
    ]);
  });

  it('sends nothing for a node without a locator, an unknown page or a bad request', async () => {
    const { ctx, push } = await boot();
    await push('push-signal-graph', graph('p1'));
    const sent = answerRestores(ctx, push, () => ({ ok: true }));
    const ask = (pageId: string, request: unknown) =>
      push('request-signal-restore', { pageId, request });
    expect(await ask('p1', { component: 'c1', node: '7', epoch: 0 })).toEqual({
      error: expect.stringContaining('not a writable field'),
    });
    expect(await ask('p1', { component: 'c9', node: '2', epoch: 0 })).toEqual({
      error: expect.stringContaining('not a writable field'),
    });
    expect(await ask('p9', { component: 'c1', node: '2', epoch: 0 })).toEqual({
      error: expect.stringContaining('reports no signal graph'),
    });
    expect(await ask('p1', { component: 'c1', node: '2', epoch: -1 })).toEqual({
      error: expect.stringContaining('entry epoch'),
    });
    expect(sent).toHaveLength(0);
  });

  it('refuses while component writes are off', async () => {
    const { ctx, push } = await boot({ actions: { components: false } } as PangularConfig);
    await push('push-signal-graph', graph('p1'));
    const sent = answerRestores(ctx, push, () => ({ ok: true }));
    expect(
      await push('request-signal-restore', {
        pageId: 'p1',
        request: { component: 'c1', node: '2', epoch: 1 },
      }),
    ).toEqual({ error: expect.stringContaining('actions.components') });
    expect(sent).toHaveLength(0);
  });

  it('times out, and ignores answers from a connection that does not own the page', async () => {
    const broadcast = vi.fn();
    const restores = createSignalRestores({
      config: resolvePangularConfig(),
      graphOf: (pageId) => (pageId === 'p1' ? (graph('p1') as never) : undefined),
      broadcast,
      answersFor: (target, pageId) => target === pageId,
      timeoutMs: 20,
    });
    const answer = restores.request('p1', { component: 'c1', node: '2', epoch: 1 });
    const { requestId } = broadcast.mock.calls[0][1] as Sent;
    restores.answer({ requestId, pageId: 'p2', result: { ok: true } });
    expect(await answer).toEqual({ error: expect.stringContaining('No page answered') });
    expect(restores.pendingCount()).toBe(0);
  });
});
