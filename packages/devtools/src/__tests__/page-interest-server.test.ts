import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';
import { PAGE_TTL_MS } from '../rpc/page-ttl.ts';

// The activity lease as devframe.ts wires it: pages that left are not waited
// for, and an idle forms page keeps itself alive with a ping.

async function boot() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await pangular.setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  return { ctx, push };
}

const formsReport = (pageId: string) => ({ pageId, forms: [], events: [], setupErrors: [] });

describe('page interest on the server', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps an idle forms page alive with a ping', async () => {
    const { push } = await boot();
    expect(await push('ping-forms', 'p1')).toEqual({ known: false });
    await push('push-forms', formsReport('p1'));
    expect(await push('ping-forms', 'p1')).toEqual({ known: true });
    await push('forget-forms-page', 'p1');
    expect(await push('ping-forms', 'p1')).toEqual({ known: false });
  });

  it('does not make an agent wait for a page that said goodbye', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { ctx, push } = await boot();
    // A host with no panel connected.
    (ctx.rpc as unknown as { _rpcGroup: unknown })._rpcGroup = { clients: [] };
    expect(await push('page-interest', { pageId: 'gone' })).toEqual({ watching: false });
    await push('push-forms', formsReport('gone'));
    await push('forget-forms-page', 'gone');
    let answered = false;
    const reading = ctx.agent.invoke('pangular:inspect-forms', {}).then(() => (answered = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(answered).toBe(true);
    await reading;
  });

  it('does not make an agent wait for a page whose reports expired', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval'] });
    const { ctx, push } = await boot();
    (ctx.rpc as unknown as { _rpcGroup: unknown })._rpcGroup = { clients: [] };
    // The page reports on its own connection.
    (ctx.rpc as unknown as { getCurrentRpcSession: () => unknown }).getCurrentRpcSession = () => ({
      meta: { id: 1 },
    });
    await push('page-interest', { pageId: 'closed' });
    await push('push-forms', formsReport('closed'));
    // The browser closed without a pagehide: it stops reporting, and once its
    // reports expire the page is not waited for.
    await vi.advanceTimersByTimeAsync(PAGE_TTL_MS + 6000);
    let answered = false;
    const reading = ctx.agent.invoke('pangular:inspect-forms', {}).then(() => (answered = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(answered).toBe(true);
    await reading;
  });
});
