// @vitest-environment jsdom
// Its own file: Vitest loads @capacitor/core once per file, and core sets up
// window.Capacitor when it loads, so each scenario needs a fresh one.
import { afterEach, expect, it, vi } from 'vitest';
import { readCapacitorInfo, type createCapacitorHook } from '../capacitor-collector.ts';
import { setRedaction } from '../forms-privacy.ts';

type HookWindow = Parameters<typeof createCapacitorHook>[0];
const settle = () => new Promise((resolve) => setTimeout(resolve));
afterEach(() => setRedaction());

it('installed before core on Android, logs native calls once, as native, and knows what the app imported', async () => {
  const nativePromise = vi.fn(async (_plugin: string, method: string) =>
    method === 'get' ? { value: '1234' } : undefined,
  );
  // What native-bridge.js leaves on the page before the app loads.
  Object.assign(globalThis, {
    androidBridge: {},
    Capacitor: {
      PluginHeaders: [
        {
          name: 'Preferences',
          methods: [
            { name: 'get', rtype: 'promise' },
            { name: 'set', rtype: 'promise' },
          ],
        },
        { name: 'Haptics', methods: [{ name: 'vibrate', rtype: 'promise' }] },
      ],
      nativePromise,
      nativeCallback: vi.fn(() => '1'),
    },
  });
  const { installCapacitorHook } = await import('../capacitor-hook.ts');
  installCapacitorHook();
  const hook = (globalThis as HookWindow).__pangularCapacitorHook!;
  setRedaction({ secretNames: ['pin'] });
  const core = await import('@capacitor/core');
  class PreferencesWeb extends core.WebPlugin {
    async migrate() {
      return { migrated: [] };
    }
  }
  const Preferences = core.registerPlugin<{
    get(options: { key: string }): Promise<{ value: string }>;
    set(options: { key: string; value: string }): Promise<void>;
    migrate(): Promise<{ migrated: string[] }>;
  }>('Preferences', { web: new PreferencesWeb(), android: new PreferencesWeb() });

  expect(core.Capacitor.getPlatform()).toBe('android');
  await Preferences.set({ key: 'pin', value: '1234' });
  expect(await Preferences.get({ key: 'pin' })).toEqual({ value: '1234' });
  await settle();

  expect(hook.calls().map((call) => [call.method, call.via])).toEqual([
    ['set', 'native'],
    ['get', 'native'],
  ]);
  expect(nativePromise).toHaveBeenCalledTimes(2);
  // `pin` is a configured secret name: the value under it is masked both ways.
  expect(JSON.stringify(hook.calls())).not.toContain('1234');

  const plugins = readCapacitorInfo(globalThis as HookWindow)?.plugins ?? [];
  expect(plugins.find((p) => p.name === 'Preferences')?.registered).toBe(true);
  expect(plugins.find((p) => p.name === 'Haptics')).toMatchObject({
    native: true,
    registered: false,
  });
  hook.stop();
});
