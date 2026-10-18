import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import pangular, { createPangular } from '../devframe.ts';
import { RPC_INSPECTOR, agentSafety, resolvePangularConfig } from '../config.ts';
import { createComponentValues } from '../rpc/component-values.ts';
import { UNTRUSTED } from '../rpc/forms-tools.ts';
import { answerText } from './tool-answer.ts';

async function boot(inspectors?: Record<string, boolean>) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await (inspectors ? createPangular({ inspectors }) : pangular).setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const call = async (tool: string, args: Record<string, unknown>) =>
    await answerText(ctx.agent.invoke(`pangular:${tool}`, args));
  return { ctx, push, call };
}

const tree = (pageId: string) => ({
  pageId,
  url: `/${pageId}`,
  count: 2,
  detail: null,
  roots: [
    {
      id: `${pageId}-root`,
      name: 'App',
      tag: 'app-root',
      children: [{ id: `${pageId}-a`, name: 'Card', tag: 'app-card', children: [] }],
    },
  ],
});

type Message = { requestId: string; pageId: string; request: Record<string, unknown> };

/** Answers every component-value broadcast the way the page would. */
function answerValues(
  ctx: Awaited<ReturnType<typeof boot>>['ctx'],
  push: Awaited<ReturnType<typeof boot>>['push'],
  result: (request: Record<string, unknown>) => unknown,
  from?: string,
) {
  const sent: Message[] = [];
  vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: {
    method: string;
    args: [Message];
  }) => {
    if (!options.method.endsWith('component-value')) return;
    const message = options.args[0];
    sent.push(message);
    setTimeout(
      () =>
        void push('component-value-result', {
          requestId: message.requestId,
          pageId: from ?? message.pageId,
          result: result(message.request),
        }),
      5,
    );
  }) as never);
  return sent;
}

describe('request-component-value', () => {
  it('is a read of the components inspector', () => {
    expect(RPC_INSPECTOR['request-component-value']).toBe('components');
    expect(RPC_INSPECTOR['component-value-result']).toBe('components');
    expect(agentSafety('pangular:inspect-component', resolvePangularConfig())).toBe('read');
  });

  it('sends the read to the page and returns its level', async () => {
    const { ctx, push } = await boot();
    await push('push-component-tree', tree('p1'));
    const sent = answerValues(ctx, push, (request) => ({
      ok: true,
      component: 'Card',
      path: request.path,
      value: { name: 'Ada' },
    }));
    const result = await push('request-component-value', {
      pageId: 'p1',
      request: { id: 'p1-a', path: ['user'], watch: true, limit: 60 },
    });
    expect(result).toEqual({ ok: true, component: 'Card', path: ['user'], value: { name: 'Ada' } });
    expect(sent[0]).toMatchObject({
      pageId: 'p1',
      request: { id: 'p1-a', path: ['user'], watch: true, limit: 60, depth: 1 },
    });
  });

  it('refuses bad requests and unknown pages without asking a page', async () => {
    const { ctx, push } = await boot();
    await push('push-component-tree', tree('p1'));
    const sent = answerValues(ctx, push, () => ({ ok: true }));
    expect(
      await push('request-component-value', { pageId: 'p9', request: { id: 'p1-a', path: ['x'] } }),
    ).toEqual({ error: expect.stringMatching(/No page `p9`/) });
    expect(
      await push('request-component-value', { pageId: 'p1', request: { id: 'p1-a', path: 'x' } }),
    ).toEqual({ error: expect.stringMatching(/Pass a path/) });
    expect(await push('request-component-value', { request: { id: 'p1-a', path: ['x'] } })).toEqual(
      {
        error: expect.stringMatching(/page id/),
      },
    );
    expect(sent).toHaveLength(0);
  });

  it('ignores an answer from another page', async () => {
    const values = createComponentValues({
      pages: () => [{ ...tree('p1'), reportedAt: 1 }],
      broadcast: () => {},
      answersFor: (target, pageId) => pageId === target,
      timeoutMs: 30,
    });
    const answer = values.request('p1', { id: 'p1-a', path: ['user'] });
    values.answer({ requestId: 'v1', pageId: 'p2', result: { ok: true, value: 'stolen' } });
    expect(await answer).toEqual({ error: expect.stringMatching(/did not answer/) });
    expect(values.pendingCount()).toBe(0);
  });

  it('is gone with the components inspector', async () => {
    const { ctx } = await boot({ components: false });
    await expect(
      ctx.rpc.invokeLocal('pangular:request-component-value' as never, ...([{}] as never)),
    ).rejects.toThrow();
  });
});

describe('inspect-component with path', () => {
  it('reads one value without selecting, and passes depth and limit', async () => {
    const { ctx, push, call } = await boot();
    await push('push-component-tree', tree('p1'));
    const sent = answerValues(ctx, push, (request) => ({
      ok: true,
      component: 'Card',
      path: request.path,
      value: { city: 'Rome', tags: { $collapsed: 'Array', size: 2 } },
    }));
    const text = await call('inspect-component', {
      component: 'p1-a',
      path: 'user.address',
      depth: 2,
      limit: 10,
    });
    expect(text.startsWith(UNTRUSTED)).toBe(true);
    expect(text).toContain('`user.address` of `Card` (instance `p1-a` on page `p1`)');
    expect(text).toContain('"$collapsed": "Array"');
    expect(sent).toHaveLength(1);
    expect(sent[0].request).toEqual({
      id: 'p1-a',
      path: ['user', 'address'],
      depth: 2,
      limit: 10,
    });
    const indexed = await call('inspect-component', { component: 'Card', path: 'items[2].tags' });
    expect(indexed).toContain('`items[2].tags`');
    expect(sent[1].request).toMatchObject({ path: ['items', '2', 'tags'], depth: 1, limit: 30 });
  });

  it('passes the page refusal on, and rejects a malformed path', async () => {
    const { ctx, push, call } = await boot();
    await push('push-component-tree', tree('p1'));
    answerValues(ctx, push, () => ({ error: '`user.password` is redacted, so it is not read.' }));
    const text = await call('inspect-component', { component: 'p1-a', path: 'user.password' });
    expect(text.startsWith(UNTRUSTED)).toBe(true);
    expect(text).toContain('Could not read `user.password` of instance `p1-a` on page `p1`.');
    expect(text).toContain('is redacted');
    expect(await call('inspect-component', { component: 'p1-a', path: 'a..b' })).toMatch(
      /Pass `path`/,
    );
  });
});
