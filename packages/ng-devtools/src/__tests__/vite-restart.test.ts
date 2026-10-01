import { createHostContext } from 'devframe/node';
import { beforeEach, describe, expect, it } from 'vitest';
import ngDevtools from '../devframe.ts';
import { clearCalls, recordCall, type AnalogCall } from '../analog-server-log.ts';
import { httpRegistry } from '../http-rules.ts';
import type { AnalogState } from '../rpc/analog-tools.ts';
import { releaseServerState } from '../vite.ts';

async function boot() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await ngDevtools.setup(ctx as never);
  const analog = async () =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: { get: (key: string) => Promise<{ value: () => AnalogState }> };
        }
      ).sharedState.get('ng-devtools:analog')
    ).value();
  return { ctx, analog };
}

const call: Omit<AnalogCall, 'id'> = {
  at: 0,
  kind: 'api',
  method: 'GET',
  url: '/api/v1/hello',
  status: 200,
  ms: 3,
  from: 'ssr',
};

beforeEach(() => clearCalls());

describe('releaseServerState', () => {
  it('leaves the state of a newer server alone when an old one closes', async () => {
    const old = await boot();
    const current = await boot();

    releaseServerState(old.ctx);

    expect(typeof httpRegistry().record).toBe('function');
    recordCall(call);
    expect((await current.analog()).calls).toHaveLength(1);
  });

  it('turns off capture when the server that owns it closes', async () => {
    const current = await boot();

    releaseServerState(current.ctx);

    expect(httpRegistry().record).toBeUndefined();
    recordCall(call);
    expect((await current.analog()).calls).toHaveLength(0);
  });
});
