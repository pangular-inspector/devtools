import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';

async function boot() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await pangular.setup(ctx as never);
  vi.spyOn(ctx.rpc, 'getCurrentRpcSession').mockReturnValue({} as never);
  const state = await ctx.rpc.sharedState.get('pangular:http');
  return { ctx, state };
}

describe('shared-state write guard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses remote replacement of Pangular shared state', async () => {
    const { ctx, state } = await boot();
    const initial = structuredClone(state.value());

    const set = await ctx.rpc.getHandler('devframe:rpc:server-state:set');
    await expect(set('pangular:http', { calls: [] }, 'remote-set')).rejects.toThrow(
      'Remote writes to Pangular Inspector shared state are not allowed',
    );

    expect(state.value()).toEqual(initial);
  });

  it('refuses remote patching of Pangular shared state', async () => {
    const { ctx, state } = await boot();
    const initial = structuredClone(state.value());

    const patch = await ctx.rpc.getHandler('devframe:rpc:server-state:patch');
    await expect(
      patch(
        'pangular:http',
        [{ op: 'replace', path: [], value: { calls: ['forged report'] } }],
        'remote-patch',
      ),
    ).rejects.toThrow('Remote writes to Pangular Inspector shared state are not allowed');

    expect(state.value()).toEqual(initial);
  });

  it('keeps remote devframe settings writable', async () => {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await pangular.setup(ctx as never);
    const state = await ctx.rpc.sharedState.get('devframe:user-settings', {
      initialValue: { theme: 'dark' },
    });
    vi.spyOn(ctx.rpc, 'getCurrentRpcSession').mockReturnValue({} as never);

    const set = await ctx.rpc.getHandler('devframe:rpc:server-state:set');
    await set('devframe:user-settings', { theme: 'light' }, 'remote-set');

    expect(state.value()).toEqual({ theme: 'light' });
  });
});
