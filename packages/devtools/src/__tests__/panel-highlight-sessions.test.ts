import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';

async function boot() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await pangular.setup(ctx as never);
  const rpc = ctx.rpc as unknown as {
    broadcast: (options: { method: string; args: unknown[] }) => Promise<void>;
    getCurrentRpcSession: () => unknown;
    _emitSessionDisconnected: (meta: { id: number }) => void;
  };
  const broadcast = vi.spyOn(rpc, 'broadcast').mockResolvedValue(undefined);
  const as = (id: number, name: string, arg: unknown) => {
    rpc.getCurrentRpcSession = () => ({ meta: { id } });
    return ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([arg] as never));
  };
  const sent = () => broadcast.mock.calls.map(([call]) => [call.method, call.args[0]]);
  return { rpc, broadcast, as, sent };
}

describe('panel highlights and their connection', () => {
  it('clears the page and form highlights when the panel that drew them disconnects', async () => {
    const { rpc, broadcast, as, sent } = await boot();
    await as(1, 'request-page-highlight', { pageId: 'p1', id: 'c1' });
    await as(1, 'request-form-highlight', { formId: 'f1', path: 'name' });
    broadcast.mockClear();

    rpc._emitSessionDisconnected({ id: 1 });
    expect(sent()).toEqual([
      ['pangular:highlight-in-page', null],
      ['pangular:highlight-form-field', null],
    ]);
  });

  it('passes a selector highlight with its page id so other tabs ignore it', async () => {
    const { as, sent } = await boot();
    await as(1, 'request-page-highlight', { pageId: 'p1', selector: 'app-card' });
    expect(sent()).toEqual([
      ['pangular:highlight-in-page', { pageId: 'p1', selector: 'app-card' }],
    ]);
  });

  it('leaves a highlight drawn by another panel or already cleared', async () => {
    const { rpc, broadcast, as, sent } = await boot();
    await as(1, 'request-page-highlight', 'app-card');
    await as(2, 'request-page-highlight', 'app-list');
    await as(3, 'request-form-highlight', { formId: 'f1', path: 'name' });
    await as(3, 'request-form-highlight', null);
    broadcast.mockClear();

    rpc._emitSessionDisconnected({ id: 1 });
    rpc._emitSessionDisconnected({ id: 3 });
    expect(sent()).toEqual([]);

    rpc._emitSessionDisconnected({ id: 2 });
    expect(sent()).toEqual([['pangular:highlight-in-page', null]]);
  });
});
