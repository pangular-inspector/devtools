// @vitest-environment jsdom
// Its own file: Vitest loads @capacitor/core once per file, and core sets up
// window.Capacitor when it loads, so each scenario needs a fresh one.
import { afterEach, expect, it, vi } from 'vitest';
import {
  createCapacitorHook,
  isUnimplemented,
  readCapacitorInfo,
  type CapacitorCall,
  type CapacitorHook,
} from '../capacitor-collector.ts';

type HookWindow = Parameters<typeof createCapacitorHook>[0];
const settle = () => new Promise((resolve) => setTimeout(resolve));
const hooks: CapacitorHook[] = [];
afterEach(() => hooks.splice(0).forEach((hook) => hook.stop()));

/** What native-bridge.js leaves on the page before the app loads. */
function fakeBridge(answers: Record<string, () => Promise<unknown>>) {
  const nativePromise = vi.fn((plugin: string, method: string, _options?: unknown) => {
    const answer = answers[`${plugin}.${method}`];
    return answer ? answer() : Promise.resolve(undefined);
  });
  return { nativePromise, nativeCallback: vi.fn(() => '1') };
}

it('logs native calls made through a plugin registered before the hook started', async () => {
  const cap = fakeBridge({
    'Camera.getPhoto': async () => ({ format: 'png' }),
    'Camera.pickLimitedLibraryPhotos': () =>
      Promise.reject({
        message: 'pickLimitedLibraryPhotos is not implemented on Android',
        code: 'UNIMPLEMENTED',
      }),
  });
  const bridge = {
    PluginHeaders: [
      {
        name: 'Camera',
        methods: [
          { name: 'getPhoto', rtype: 'promise' },
          { name: 'pickLimitedLibraryPhotos', rtype: 'promise' },
        ],
      },
    ],
    nativePromise: cap.nativePromise,
    nativeCallback: cap.nativeCallback,
  };
  Object.assign(globalThis, { androidBridge: {}, Capacitor: bridge });
  const core = await import('@capacitor/core');
  const Camera = core.registerPlugin<{
    getPhoto(options: { quality: number }): Promise<{ format: string }>;
    pickLimitedLibraryPhotos(): Promise<unknown>;
    getLimitedLibraryPhotos(): Promise<unknown>;
  }>('Camera');
  const hook = createCapacitorHook(globalThis as HookWindow);
  hooks.push(hook);

  expect(await Camera.getPhoto({ quality: 80 })).toEqual({ format: 'png' });
  await expect(Camera.pickLimitedLibraryPhotos()).rejects.toMatchObject({
    code: 'UNIMPLEMENTED',
  });
  // Not in the native header: core rejects it before the bridge. A hook that
  // started after core can't see it (unless it ends up unhandled).
  await expect(Camera.getLimitedLibraryPhotos()).rejects.toMatchObject({
    code: 'UNIMPLEMENTED',
  });
  await settle();

  expect(core.Capacitor.getPlatform()).toBe('android');
  expect(hook.calls().map((call: CapacitorCall) => [call.method, call.status])).toEqual([
    ['getPhoto', 'ok'],
    ['pickLimitedLibraryPhotos', 'error'],
  ]);
  expect(hook.calls()[0].args).toEqual({ quality: 80 });
  expect(isUnimplemented(hook.calls()[1].error)).toBe(true);
  expect(hook.webCalls()).toBe(false);
  expect(readCapacitorInfo(globalThis as HookWindow)?.plugins).toContainEqual({
    name: 'Camera',
    available: true,
    // Started after core on Android: Capacitor.Plugins lists every native plugin.
    registered: null,
    native: true,
    methods: ['getPhoto', 'pickLimitedLibraryPhotos'],
  });
});
