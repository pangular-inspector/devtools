// @vitest-environment jsdom
// Its own file: Vitest loads @capacitor/core once per file, and core sets up
// window.Capacitor when it loads, so each scenario needs a fresh one.
import { afterEach, expect, it } from 'vitest';
import { createCapacitorHook, type CapacitorHook } from '../capacitor-collector.ts';

type HookWindow = Parameters<typeof createCapacitorHook>[0];
const hooks: CapacitorHook[] = [];
afterEach(() => hooks.splice(0).forEach((hook) => hook.stop()));
it('installed after core, logs no web calls and changes nothing', async () => {
  const core = await import('@capacitor/core');
  const before = core.Capacitor.registerPlugin;
  const { installCapacitorHook } = await import('../capacitor-hook.ts');
  installCapacitorHook();
  const hook = (globalThis as HookWindow).__pangularCapacitorHook!;
  hooks.push(hook);

  class EchoWeb extends core.WebPlugin {
    async echo(options: { value: string }) {
      return options;
    }
  }
  const Echo = core.registerPlugin<{ echo(o: { value: string }): Promise<{ value: string }> }>(
    'Echo',
    { web: new EchoWeb() },
  );

  expect(await Echo.echo({ value: 'hi' })).toEqual({ value: 'hi' });
  expect(core.Capacitor.registerPlugin).toBe(before);
  expect(hook.webCalls()).toBe(false);
  expect(hook.calls()).toEqual([]);
});
