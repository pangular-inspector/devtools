// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  capacitorHook,
  createCapacitorHook,
  isUnimplemented,
  readCapacitorInfo,
  type CapacitorCall,
  type CapacitorHook,
} from '../capacitor-collector.ts';
import { setRedaction } from '../forms-privacy.ts';

type Callback = (data: unknown, error?: unknown) => void;
type HookWindow = Parameters<typeof createCapacitorHook>[0];

/** The bridge functions native-bridge.js puts on `window.Capacitor`, answering from `answers`. */
function fakeCapacitor(answers: Record<string, () => Promise<unknown>> = {}) {
  const callbacks = new Map<string, Callback>();
  let nextId = 0;
  const nativePromise = vi.fn((plugin: string, method: string, _options?: unknown) => {
    const answer = answers[`${plugin}.${method}`];
    return answer ? answer() : Promise.resolve(undefined);
  });
  const nativeCallback = vi.fn(
    (_plugin: string, _method: string, _options?: unknown, callback?: Callback) => {
      const id = String(++nextId);
      if (callback) callbacks.set(id, callback);
      return id;
    },
  );
  const cap = {
    getPlatform: () => 'android',
    isNativePlatform: () => true,
    isPluginAvailable: (name: string) => name !== 'Barcode',
    getServerUrl: () => 'https://localhost',
    DEBUG: true,
    isLoggingEnabled: false,
    Plugins: { Camera: {}, Preferences: {}, Barcode: {} },
    PluginHeaders: [
      {
        name: 'Camera',
        methods: [
          { name: 'getPhoto', rtype: 'promise' },
          { name: 'addListener', rtype: 'callback' },
        ],
      },
      { name: 'Geolocation', methods: [{ name: 'watchPosition', rtype: 'callback' }] },
    ],
    nativePromise,
    nativeCallback,
  };
  const fire = (id: string, data: unknown, error?: unknown) => callbacks.get(id)?.(data, error);
  const win: HookWindow = { Capacitor: cap, navigator: { userAgent: 'Mozilla/5.0 (Android 15)' } };
  return { cap, win, nativePromise, nativeCallback, fire };
}

const hooks: CapacitorHook[] = [];

function collect(win: HookWindow, options: { maxCalls?: number } = {}) {
  const hook = createCapacitorHook(win, { maxCalls: options.maxCalls ?? 50 });
  hooks.push(hook);
  return hook;
}

const settle = () => new Promise((resolve) => setTimeout(resolve));

afterEach(() => {
  hooks.splice(0).forEach((hook) => hook.stop());
  setRedaction();
});

describe('readCapacitorInfo', () => {
  it('reads the platform, the environment and every plugin', () => {
    const { win } = fakeCapacitor();
    expect(readCapacitorInfo(win)).toEqual({
      platform: 'android',
      native: true,
      bridge: true,
      webCalls: false,
      env: {
        serverUrl: 'https://localhost',
        debug: true,
        logging: false,
        capacitorHttp: false,
        userAgent: 'Mozilla/5.0 (Android 15)',
      },
      plugins: [
        { name: 'Barcode', available: false, registered: true, native: false, methods: [] },
        {
          name: 'Camera',
          available: true,
          registered: true,
          native: true,
          methods: ['getPhoto'],
        },
        {
          name: 'Geolocation',
          available: true,
          registered: false,
          native: true,
          methods: ['watchPosition'],
        },
        { name: 'Preferences', available: true, registered: true, native: false, methods: [] },
      ],
    });
  });

  it('says CapacitorHttp is on when the bridge kept the browser fetch', () => {
    const { win } = fakeCapacitor();
    expect(readCapacitorInfo({ ...win, CapacitorWebFetch: () => {} })?.env.capacitorHttp).toBe(
      true,
    );
  });

  it('is null on a page without Capacitor', () => {
    expect(readCapacitorInfo({})).toBeNull();
    expect(readCapacitorInfo({ Capacitor: {} })).toBeNull();
  });
});

describe('createCapacitorHook', () => {
  it('logs a native call that succeeds with its arguments, result and duration', async () => {
    const { win, cap } = fakeCapacitor({
      'Camera.getPhoto': async () => ({ format: 'jpeg', webPath: 'blob:1' }),
    });
    const hook = collect(win);

    await cap.nativePromise('Camera', 'getPhoto', { quality: 90 });
    await settle();

    expect(hook.calls()).toEqual([
      expect.objectContaining({
        plugin: 'Camera',
        method: 'getPhoto',
        kind: 'promise',
        via: 'native',
        args: { quality: 90 },
        status: 'ok',
        result: { format: 'jpeg', webPath: 'blob:1' },
        durationMs: expect.any(Number),
      }),
    ]);
  });

  it('logs a failed call with its error message and code', async () => {
    const { win, cap } = fakeCapacitor({
      'Camera.getPhoto': () =>
        Promise.reject(
          Object.assign(new Error('User cancelled photos app'), { code: 'CANCELLED' }),
        ),
    });
    const hook = collect(win);

    await expect(cap.nativePromise('Camera', 'getPhoto', {})).rejects.toThrow('User cancelled');
    await settle();

    const [call] = hook.calls();
    expect(call.status).toBe('error');
    expect(call.error).toEqual({ message: 'User cancelled photos app', code: 'CANCELLED' });
    expect(isUnimplemented(call.error)).toBe(false);
  });

  it('marks a call the platform does not implement', async () => {
    const { win, cap } = fakeCapacitor({
      'Camera.pickLimitedLibraryPhotos': () =>
        Promise.reject({ message: 'not implemented on android', code: 'UNIMPLEMENTED' }),
    });
    const hook = collect(win);

    await cap.nativePromise('Camera', 'pickLimitedLibraryPhotos', {}).catch(() => {});
    await settle();

    expect(isUnimplemented(hook.calls()[0].error)).toBe(true);
  });

  it('masks secret arguments, tokens and secret results', async () => {
    setRedaction({ secretNames: ['pin'] });
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.c2lnbmF0dXJl';
    const { win, cap } = fakeCapacitor({
      'SecureStorage.get': async () => ({ value: jwt, refreshToken: 'r-123' }),
    });
    const hook = collect(win);

    await cap.nativePromise('SecureStorage', 'get', {
      key: 'session',
      password: 'hunter2',
      pin: '1234',
    });
    await settle();

    const text = JSON.stringify(hook.calls());
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('1234');
    expect(text).not.toContain(jwt);
    expect(text).not.toContain('r-123');
    expect(hook.calls()[0].args).toMatchObject({ key: 'session', password: '[redacted]' });
  });

  it('masks the value stored under a secret key, on the way in and out', async () => {
    const { win, cap } = fakeCapacitor({
      'Preferences.get': async () => ({ value: 'opaque-session-42' }),
    });
    const hook = collect(win);

    await cap.nativePromise('Preferences', 'set', { key: 'authToken', value: 'opaque-session-42' });
    await cap.nativePromise('Preferences', 'get', { key: 'authToken' });
    await cap.nativePromise('Preferences', 'set', { key: 'theme', value: 'dark' });
    await settle();

    const [set, get, theme] = hook.calls();
    expect(set.args).toEqual({ key: 'authToken', value: '[redacted]' });
    expect(get.result).toEqual({ value: '[redacted]' });
    expect(theme.args).toEqual({ key: 'theme', value: 'dark' });
  });

  it('masks secrets in CapacitorHttp URLs and headers', async () => {
    const { win, cap } = fakeCapacitor({
      'CapacitorHttp.request': async () => ({
        status: 200,
        url: 'https://api.example.com/me?token=abc123',
      }),
    });
    const hook = collect(win);

    await cap.nativePromise('CapacitorHttp', 'request', {
      url: 'https://api.example.com/me?token=abc123',
      method: 'GET',
      headers: { Authorization: 'Bearer abc123', Accept: 'application/json' },
    });
    await settle();

    expect(JSON.stringify(hook.calls())).not.toContain('abc123');
    expect(hook.calls()[0].args).toMatchObject({
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  });

  it('hands the app the original promise, arguments and rejection', async () => {
    const failure = new Error('denied');
    const { win, cap, nativePromise } = fakeCapacitor({
      'Camera.checkPermissions': () => Promise.reject(failure),
    });
    const original = cap.nativePromise;
    const options = { permissions: ['camera'] };
    collect(win);

    const returned = cap.nativePromise('Camera', 'checkPermissions', options);
    const fromBridge = nativePromise.mock.results[0].value;

    expect(cap.nativePromise).not.toBe(original);
    expect(returned).toBe(fromBridge);
    expect(nativePromise.mock.calls[0][2]).toBe(options);
    await expect(returned).rejects.toBe(failure);
  });

  it('counts listener events and marks a removed listener', () => {
    const { win, cap, fire } = fakeCapacitor();
    const hook = collect(win);
    const received: unknown[] = [];

    const id = cap.nativeCallback(
      'Network',
      'addListener',
      { eventName: 'networkStatusChange' },
      (data) => received.push(data),
    );
    fire(id, { connected: false });
    fire(id, { connected: true });

    expect(received).toEqual([{ connected: false }, { connected: true }]);
    expect(hook.snapshot().listeners).toEqual([
      expect.objectContaining({ id, plugin: 'Network', event: 'networkStatusChange', events: 2 }),
    ]);
    expect(hook.calls()).toEqual([]);

    cap.nativeCallback('Network', 'removeListener', {
      callbackId: id,
      eventName: 'networkStatusChange',
    });
    expect(hook.snapshot().listeners?.[0].removed).toBe(true);
  });

  it('logs a callback method as a stream and counts how often it calls back', () => {
    const { win, cap, fire } = fakeCapacitor();
    const hook = collect(win);

    const id = cap.nativeCallback(
      'Geolocation',
      'watchPosition',
      { enableHighAccuracy: true },
      () => {},
    );
    fire(id, { coords: { latitude: 1 } });
    fire(id, { coords: { latitude: 2 } });

    expect(hook.calls()[0]).toMatchObject({
      plugin: 'Geolocation',
      method: 'watchPosition',
      kind: 'callback',
      status: 'ok',
      callbacks: 2,
      result: { coords: { latitude: 2 } },
    });
  });

  it('leaves out calls the ignore predicate names', async () => {
    const { win, cap } = fakeCapacitor();
    const hook = collect(win);
    hook.setIgnore((plugin) => plugin === 'CapacitorHttp');

    await cap.nativePromise('CapacitorHttp', 'request', { url: 'http://localhost:9999/__sse' });

    expect(hook.calls()).toEqual([]);
  });

  it('keeps the newest calls and counts the dropped ones', async () => {
    const { win, cap } = fakeCapacitor();
    const hook = collect(win, { maxCalls: 2 });

    for (const method of ['get', 'set', 'remove']) {
      await cap.nativePromise('Preferences', method, {});
    }

    expect(hook.calls().map((call) => call.method)).toEqual(['set', 'remove']);
    expect(hook.snapshot().dropped).toBe(1);
  });

  it('returns only the calls that changed after a revision', async () => {
    const { win, cap } = fakeCapacitor();
    const hook = collect(win);
    await cap.nativePromise('Preferences', 'get', {});
    await settle();
    const seen = hook.revision();

    await cap.nativePromise('Preferences', 'set', {});
    await settle();

    expect(hook.snapshot(seen).calls.map((call) => call.method)).toEqual(['set']);
    expect(hook.snapshot(seen).listeners).toBeUndefined();
  });

  it('puts the bridge back on stop, and passes through when wrapped again', async () => {
    const { win, cap, nativePromise } = fakeCapacitor();
    const hook = collect(win);
    hook.stop();
    expect(cap.nativePromise).toBe(nativePromise);

    const again = collect(win);
    const ours = cap.nativePromise;
    const outer = (...args: [string, string, unknown]) => ours(...args);
    cap.nativePromise = outer as typeof cap.nativePromise;
    again.stop();

    expect(cap.nativePromise).toBe(outer);
    await cap.nativePromise('Preferences', 'get', {});
    expect(again.calls()).toEqual([]);
    expect(nativePromise).toHaveBeenCalledTimes(1);
  });

  it('logs core\'s unhandled "not implemented" rejections without handling them', () => {
    const { win } = fakeCapacitor();
    const target = new EventTarget();
    const hookWin = Object.assign(win, {
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
    });
    const hook = collect(hookWin as HookWindow);
    const event = Object.assign(new Event('unhandledrejection', { cancelable: true }), {
      reason: {
        message: '"Camera.getLimitedLibraryPhotos()" is not implemented on android',
        code: 'UNIMPLEMENTED',
      },
    });

    target.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(hook.calls()[0]).toMatchObject({
      plugin: 'Camera',
      method: 'getLimitedLibraryPhotos',
      via: 'web',
      status: 'error',
      error: { code: 'UNIMPLEMENTED' },
    });
  });

  it('never creates window.Capacitor unless installed early on purpose', () => {
    const win: HookWindow = {};
    hooks.push(createCapacitorHook(win));
    expect(win.Capacitor).toBeUndefined();
  });
});

describe('capacitorHook', () => {
  it('shares one hook per page, so the overlay finds the calls made before it', async () => {
    const { win, cap } = fakeCapacitor();
    const first = capacitorHook(win, { maxCalls: 10 });
    hooks.push(first.hook);
    await cap.nativePromise('SplashScreen', 'hide', {});

    const second = capacitorHook(win, { maxCalls: 20 });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.hook).toBe(first.hook);
    expect(second.hook.calls().map((call) => call.method)).toEqual(['hide']);
  });
});
