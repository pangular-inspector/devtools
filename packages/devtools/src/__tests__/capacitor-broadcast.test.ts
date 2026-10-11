// What a Capacitor push costs the panel: devframe broadcasts each change of
// the shared state to every subscribed client, so it has to stay small.
import { createHostContext } from 'devframe/node';
import { expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';
import type { CapacitorCall, CapacitorInfo, CapacitorReport } from '../rpc/capacitor-tools.ts';

const info: CapacitorInfo = {
  platform: 'android',
  native: true,
  bridge: true,
  webCalls: false,
  env: { serverUrl: '', debug: false, logging: false, capacitorHttp: false, userAgent: 'UA' },
  plugins: [
    { name: 'Preferences', available: true, registered: true, native: true, methods: ['get'] },
  ],
};

const call = (id: number): CapacitorCall => ({
  id,
  plugin: 'Preferences',
  method: 'get',
  kind: 'promise',
  via: 'native',
  args: { key: `key-${id}` },
  status: 'ok',
  result: { value: 'v'.repeat(40) },
  startedAt: 1_000 + id,
  durationMs: 3,
});

it('broadcasts only what a push changed, before and at limits.capacitorCalls', async () => {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await pangular.setup(ctx as never);
  const sizes: number[] = [];
  const broadcast = vi.spyOn(ctx.rpc, 'broadcast');
  const push = async (report: CapacitorReport) => {
    broadcast.mockClear();
    await ctx.rpc.invokeLocal('pangular:push-capacitor' as never, ...([report] as never));
    const sent = broadcast.mock.calls
      .map(([message]) => message as { method: string; args: unknown[] })
      .filter((message) => message.args[0] === 'pangular:capacitor');
    sizes.push(JSON.stringify(sent.map((message) => message.args[1])).length);
  };
  const base = { url: '/', title: 'App', listeners: [], dropped: 0 };

  // Three pages, each at the default cap of 200 calls.
  for (const pageId of ['a', 'b', 'c']) {
    await push({
      ...base,
      pageId,
      full: true,
      info,
      calls: Array.from({ length: 200 }, (_, at) => call(at + 1)),
    });
  }
  sizes.length = 0;

  // Each push brings one new call, so the server drops the oldest one.
  for (let id = 201; id < 221; id++) {
    for (const pageId of ['a', 'b', 'c']) {
      await push({ ...base, pageId, full: false, calls: [call(id)] });
    }
  }
  expect(sizes).toHaveLength(60);
  expect(Math.max(...sizes)).toBeLessThan(2_000);

  const state = (
    await (
      ctx.rpc as unknown as {
        sharedState: {
          get: (key: string) => Promise<{
            value: () => { pages: Record<string, { calls: Record<string, CapacitorCall> }> };
          }>;
        };
      }
    ).sharedState.get('pangular:capacitor')
  ).value();
  const ids = Object.keys(state.pages['a'].calls).map(Number);
  expect(ids).toHaveLength(200);
  expect(ids[0]).toBe(21);
  expect(ids.at(-1)).toBe(220);
});
