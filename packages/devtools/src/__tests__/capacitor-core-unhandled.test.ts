// @vitest-environment jsdom
// Its own file: Vitest loads @capacitor/core once per file.
import { expect, it } from 'vitest';
import type { createCapacitorHook } from '../capacitor-collector.ts';

type HookWindow = Parameters<typeof createCapacitorHook>[0];
const settle = () => new Promise((resolve) => setTimeout(resolve));

it('with the early hook, an unhandled "not implemented" rejection is logged once', async () => {
  const { installCapacitorHook } = await import('../capacitor-hook.ts');
  installCapacitorHook();
  const hook = (globalThis as HookWindow).__pangularCapacitorHook!;
  const core = await import('@capacitor/core');
  const Camera = core.registerPlugin<{ getPhoto(): Promise<unknown> }>('Camera');

  const reason = await Camera.getPhoto().catch((error: unknown) => error);
  window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason }));
  await settle();

  expect(hook.calls().map((c) => [c.plugin, c.method, c.via, c.status])).toEqual([
    ['Camera', 'getPhoto', 'web', 'error'],
  ]);
  hook.stop();
});
