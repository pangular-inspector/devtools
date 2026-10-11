// @vitest-environment jsdom
// Its own file: Vitest loads @capacitor/core once per file, and core sets up
// window.Capacitor when it loads, so each scenario needs a fresh one.
import { afterEach, expect, it } from 'vitest';
import {
  createCapacitorHook,
  readCapacitorInfo,
  type CapacitorHook,
} from '../capacitor-collector.ts';

type HookWindow = Parameters<typeof createCapacitorHook>[0];
const settle = () => new Promise((resolve) => setTimeout(resolve));
const hooks: CapacitorHook[] = [];
afterEach(() => hooks.splice(0).forEach((hook) => hook.stop()));
it('installed before core, also logs calls a lazily loaded web implementation answers', async () => {
  const { installCapacitorHook } = await import('../capacitor-hook.ts');
  installCapacitorHook();
  const hook = (globalThis as HookWindow).__pangularCapacitorHook!;
  hooks.push(hook);
  const core = await import('@capacitor/core');

  class PreferencesWeb extends core.WebPlugin {
    async get(options: { key: string }) {
      return { value: options.key === 'theme' ? 'dark' : null };
    }
  }
  const Preferences = core.registerPlugin<{
    get(options: { key: string }): Promise<{ value: string | null }>;
    migrate(): Promise<void>;
  }>('Preferences', { web: () => Promise.resolve(new PreferencesWeb()) });

  expect(core.Capacitor.getPlatform()).toBe('web');
  expect(await Preferences.get({ key: 'theme' })).toEqual({ value: 'dark' });
  await expect(Preferences.migrate()).rejects.toMatchObject({ code: 'UNIMPLEMENTED' });
  await settle();

  expect(hook.webCalls()).toBe(true);
  expect(hook.calls()).toEqual([
    expect.objectContaining({
      plugin: 'Preferences',
      method: 'get',
      via: 'web',
      status: 'ok',
      result: { value: 'dark' },
    }),
    expect.objectContaining({
      plugin: 'Preferences',
      method: 'migrate',
      via: 'web',
      status: 'error',
      error: expect.objectContaining({ code: 'UNIMPLEMENTED' }),
    }),
  ]);
  expect(readCapacitorInfo(globalThis as HookWindow)?.webCalls).toBe(true);
  // The wrapped method looks like core's own, and the app's import is known.
  expect(Preferences.get.name).toBe('get');
  expect(String(Preferences.get)).toContain('[capacitor code]');
  expect(
    readCapacitorInfo(globalThis as HookWindow)?.plugins.find((p) => p.name === 'Preferences')
      ?.registered,
  ).toBe(true);
});
