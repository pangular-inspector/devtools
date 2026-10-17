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

const tree = (pageId: string) => ({
  pageId,
  url: `/${pageId}`,
  count: 3,
  detail: null,
  roots: [
    {
      id: `${pageId}-root`,
      name: 'App',
      tag: 'app-root',
      children: [
        { id: `${pageId}-a`, name: 'Card', tag: 'app-card', children: [] },
        { id: `${pageId}-b`, name: 'Card', tag: 'app-card', children: [] },
      ],
    },
  ],
});

type Broadcast = {
  method: string;
  args: [{ requestId: string; pageId: string; request: Record<string, unknown> }];
};

/** Answers every component-edit broadcast the way the page would. */
function answerEdits(
  ctx: Awaited<ReturnType<typeof boot>>['ctx'],
  push: Awaited<ReturnType<typeof boot>>['push'],
  result: (request: Record<string, unknown>) => unknown,
) {
  const sent: Broadcast['args'][0][] = [];
  vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: Broadcast) => {
    if (!options.method.endsWith('component-edit')) return;
    const message = options.args[0];
    sent.push(message);
    setTimeout(
      () =>
        void push('component-edit-result', {
          requestId: message.requestId,
          pageId: message.pageId,
          result: result(message.request),
        }),
      5,
    );
  }) as never);
  return sent;
}

describe('set-component-property and set-signal', () => {
  it('are action tools of the components inspector', () => {
    const config = resolvePangularConfig();
    expect(agentSafety('pangular:set-component-property', config)).toBe('action');
    expect(agentSafety('pangular:set-signal', config)).toBe('action');
  });

  it('send the write to the page of the instance and return the new value', async () => {
    const { ctx, push, call } = await boot();
    await push('push-component-tree', tree('p1'));
    const sent = answerEdits(ctx, push, (request) => ({
      ok: true,
      kind: request.kind,
      component: 'Card',
      path: request.path,
      value: request.value,
    }));
    const text = await call('set-signal', { component: 'p1-a', signal: 'count', value: 3 });
    expect(text.startsWith(UNTRUSTED)).toBe(true);
    expect(text).toContain('Set `count` on `Card` (instance `p1-a` on page `p1`) with `.set()`');
    expect(text).toContain('```json\n3\n```');
    expect(sent[0]).toMatchObject({
      pageId: 'p1',
      request: { id: 'p1-a', path: 'count', value: 3, kind: 'signal' },
    });
    const prop = await call('set-component-property', {
      component: 'p1-b',
      property: 'user.name',
      value: 'Ada',
    });
    expect(prop).toContain('ng.applyChanges');
    expect(sent[1].request).toMatchObject({ kind: 'property', path: 'user.name' });
  });

  it('send a null value to the page instead of asking for one', async () => {
    const { ctx, push, call } = await boot();
    await push('push-component-tree', tree('p1'));
    const sent = answerEdits(ctx, push, (request) => ({
      ok: true,
      kind: request.kind,
      component: 'Card',
      path: request.path,
      value: request.value,
    }));
    const text = await call('set-signal', { component: 'p1-a', signal: 'user', value: null });
    expect(text).not.toContain('Pass `value`');
    expect(text).toContain('```json\nnull\n```');
    expect(sent[0].request).toMatchObject({ kind: 'signal', path: 'user', value: null });
    const prop = await call('set-component-property', {
      component: 'p1-b',
      property: 'selected',
      value: null,
    });
    expect(prop).not.toContain('Pass `value`');
    expect(sent[1].request).toMatchObject({ kind: 'property', path: 'selected', value: null });
  });

  it('pass the page refusal on behind the untrusted notice', async () => {
    const { ctx, push, call } = await boot();
    await push('push-component-tree', tree('p1'));
    answerEdits(ctx, push, () => ({ error: '`title` is a signal input.' }));
    const text = await call('set-signal', { component: 'p1-a', signal: 'title', value: 'x' });
    expect(text.startsWith(UNTRUSTED)).toBe(true);
    expect(text).toContain(
      'Nothing was written to instance `p1-a` on page `p1`. `title` is a signal input.',
    );
  });

  it('refuse a class name that matches several instances', async () => {
    const { ctx, push, call } = await boot();
    await push('push-component-tree', tree('p1'));
    const sent = answerEdits(ctx, push, () => ({ ok: true }));
    const text = await call('set-component-property', {
      component: 'Card',
      property: 'price',
      value: 1,
    });
    expect(text).toMatch(/2 instances match `Card`.*nothing was written/s);
    expect(sent).toHaveLength(0);
  });

  it('write nothing without `page` when several pages report, or to an unknown page', async () => {
    const { ctx, push, call } = await boot();
    await push('push-component-tree', tree('p1'));
    await push('push-component-tree', tree('p2'));
    const sent = answerEdits(ctx, push, () => ({ ok: true }));
    expect(await call('set-signal', { component: 'p1-a', signal: 'count', value: 1 })).toMatch(
      /2 pages report a component tree/,
    );
    expect(
      await call('set-signal', { component: 'p1-a', signal: 'count', value: 1, page: 'p9' }),
    ).toMatch(/No page `p9`/);
    expect(sent).toHaveLength(0);
    // The panel RPC follows the same rule.
    expect(
      await push('request-component-edit', { request: { id: 'p1-a', path: 'count', value: 1 } }),
    ).toEqual({ error: expect.stringMatching(/2 pages report a component tree/) });
  });

  it('only take a result from the page the write went to', async () => {
    const { ctx, push } = await boot();
    await push('push-component-tree', tree('p1'));
    let requestId = '';
    vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: Broadcast) => {
      if (options.method.endsWith('component-edit')) requestId = options.args[0].requestId;
    }) as never);
    const answer = push('request-component-edit', {
      pageId: 'p1',
      request: { id: 'p1-a', path: 'count', value: 1 },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await push('component-edit-result', { requestId, pageId: 'p2', result: { ok: true } });
    await push('component-edit-result', {
      requestId,
      pageId: 'p1',
      result: { ok: true, kind: 'signal', component: 'Card', path: 'count', value: 1 },
    });
    expect(await answer).toMatchObject({ ok: true, value: 1 });
  });

  it('are left out when actions.components is off, and the RPC refuses', async () => {
    const { push, tools } = await boot({ actions: { components: false } });
    expect(tools()).not.toContain('pangular:set-component-property');
    expect(tools()).not.toContain('pangular:set-signal');
    expect(tools()).toContain('pangular:inspect-component');
    await push('push-component-tree', tree('p1'));
    expect(
      await push('request-component-edit', {
        pageId: 'p1',
        request: { id: 'p1-a', path: 'count', value: 1 },
      }),
    ).toEqual({ error: expect.stringContaining('actions.components') });
  });

  it('are left out under agent.readOnly, and when the components inspector or its tools are off', async () => {
    for (const config of [
      { agent: { readOnly: true } },
      { agent: { tools: { components: false } } },
      { inspectors: { components: false } },
    ] satisfies PangularConfig[]) {
      const { tools } = await boot(config);
      expect(tools(), JSON.stringify(config)).not.toContain('pangular:set-component-property');
      expect(tools(), JSON.stringify(config)).not.toContain('pangular:set-signal');
    }
    const { ctx } = await boot({ inspectors: { components: false } });
    await expect(
      ctx.rpc.invokeLocal('pangular:request-component-edit' as never, ...([{}] as never)),
    ).rejects.toThrow();
  });

  it('refuse requests that are not JSON or name no instance', async () => {
    const { push } = await boot();
    await push('push-component-tree', tree('p1'));
    expect(
      await push('request-component-edit', { pageId: 'p1', request: { path: 'x', value: 1 } }),
    ).toEqual({ error: 'Pass the instance id of a component.' });
    expect(
      await push('request-component-edit', { pageId: 'p1', request: { id: 'p1-a', path: 'x' } }),
    ).toEqual({ error: 'Pass a JSON value.' });
  });
});
