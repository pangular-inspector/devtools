import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import { resolvePangularConfig } from '../config.ts';
import pangular from '../devframe.ts';

type Broadcast = { method: string; args: [Record<string, unknown>] };

async function boot(config?: unknown) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await pangular.setup(ctx as never, { config: resolvePangularConfig(config) } as never);
  const call = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const sent: Broadcast[] = [];
  vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: Broadcast) => {
    sent.push(options);
  }) as never);
  return { call, sent };
}

const target = { kind: 'component', id: 'c2' };

describe('Store as global on the server', () => {
  it('asks the one page and returns the name it stored the value under', async () => {
    const { call, sent } = await boot();
    const answer = call('request-console-global', { pageId: 'p1', target });
    const request = await vi.waitFor(
      () => sent.find((b) => b.method.endsWith('console-global'))!.args[0],
    );
    expect(request).toMatchObject({ pageId: 'p1', target });
    // Another page can't answer for p1.
    await call('console-global-result', {
      requestId: request['requestId'],
      pageId: 'p2',
      result: { ok: true, name: 'temp9', message: 'Stored as temp9.' },
    });
    await call('console-global-result', {
      requestId: request['requestId'],
      pageId: 'p1',
      result: { ok: true, name: 'temp1', message: 'Stored as temp1.', extra: 'x' },
    });
    expect(await answer).toEqual({ ok: true, name: 'temp1', message: 'Stored as temp1.' });
  });

  it('refuses without a page, with a malformed target, or with the inspector off', async () => {
    const { call, sent } = await boot({ inspectors: { ngrx: false } });
    expect(await call('request-console-global', { target })).toMatchObject({ ok: false });
    expect(
      await call('request-console-global', { pageId: 'p1', target: { kind: 'window' } }),
    ).toMatchObject({ ok: false, message: 'Nothing to store.' });
    expect(
      await call('request-console-global', {
        pageId: 'p1',
        target: { kind: 'ngrx', storeId: 'store' },
      }),
    ).toMatchObject({ ok: false, message: expect.stringMatching(/ngrx inspector is turned off/) });
    expect(sent.some((b) => b.method.endsWith('console-global'))).toBe(false);
  });

  it('marks a panel selection for one page so that page sets $ng0', async () => {
    const { call, sent } = await boot();
    await call('select-component', { pageId: 'p1', id: 'c2', console: true });
    await call('select-component', { id: 'c3', console: true });
    const selections = sent
      .filter((b) => b.method.endsWith('inspect-component-in-page'))
      .map((b) => b.args[0]);
    expect(selections).toEqual([
      { pageId: 'p1', id: 'c2', console: true },
      { pageId: undefined, id: 'c3' },
    ]);
  });
});
