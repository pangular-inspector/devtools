// @vitest-environment jsdom
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  capacitorHook,
  createCapacitorHook,
  isUnimplemented,
  readCapacitorInfo,
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
        capacitorHttp: null,
        userAgent: 'Mozilla/5.0 (Android 15)',
      },
      plugins: [
        { name: 'Barcode', available: false, registered: null, native: false, methods: [] },
        {
          name: 'Camera',
          available: true,
          registered: null,
          native: true,
          methods: ['getPhoto'],
        },
        {
          name: 'Geolocation',
          available: true,
          registered: null,
          native: true,
          methods: ['watchPosition'],
        },
        { name: 'Preferences', available: true, registered: null, native: false, methods: [] },
      ],
    });
  });

  it('reads CapacitorHttp the way the native bridge does, not from CapacitorWebFetch', () => {
    const android = (enabled: boolean) => {
      const { win } = fakeCapacitor();
      return readCapacitorInfo({
        ...win,
        // The bridge sets it on every native launch, whatever the setting.
        CapacitorWebFetch: () => {},
        CapacitorHttpAndroidInterface: { isEnabled: () => enabled },
      })?.env.capacitorHttp;
    };
    expect(android(false)).toBe(false);
    expect(android(true)).toBe(true);

    const prompt = vi.fn(() => 'true');
    const { cap } = fakeCapacitor();
    const ios: HookWindow = {
      Capacitor: { ...cap, getPlatform: () => 'ios' },
      prompt,
      webkit: { messageHandlers: { bridge: {} } },
    };
    expect(readCapacitorInfo(ios)?.env.capacitorHttp).toBe(true);
    expect(readCapacitorInfo(ios)?.env.capacitorHttp).toBe(true);
    // Asked once, with the payload the iOS WebView answers itself.
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(prompt).toHaveBeenCalledWith('{"type":"CapacitorHttp"}');

    const web = readCapacitorInfo({
      Capacitor: { getPlatform: () => 'web', isNativePlatform: () => false, Plugins: {} },
      prompt,
    });
    expect(web?.env.capacitorHttp).toBe(false);
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('opens no dialog for a custom platform named ios without the iOS bridge', () => {
    const prompt = vi.fn(() => null);
    // What @capacitor/core sets up for CapacitorCustomPlatform {name: 'ios'} in a desktop browser.
    const info = readCapacitorInfo({
      Capacitor: { getPlatform: () => 'ios', isNativePlatform: () => true, Plugins: {} },
      prompt,
    });
    expect(prompt).not.toHaveBeenCalled();
    expect(info?.env.capacitorHttp).toBeNull();
  });

  it('knows which plugins the app imported only on the web, without the early hook', () => {
    const web = readCapacitorInfo({
      Capacitor: {
        getPlatform: () => 'web',
        isNativePlatform: () => false,
        isPluginAvailable: () => false,
        Plugins: { Preferences: {} },
      },
    });
    expect(web?.plugins).toEqual([
      { name: 'Preferences', available: false, registered: true, native: false, methods: [] },
    ]);
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

  it('keeps CORS header values in a CapacitorHttp response', async () => {
    const { win, cap } = fakeCapacitor({
      'CapacitorHttp.request': async () => ({
        status: 200,
        headers: {
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Origin': 'https://localhost',
          'Set-Cookie': 'session=opaque-session-1',
        },
      }),
    });
    const hook = collect(win);

    await cap.nativePromise('CapacitorHttp', 'request', {
      url: 'https://api.example.com/me',
      method: 'GET',
      headers: { 'X-Api-Key': 'opaque-key-1' },
    });
    await settle();

    const [call] = hook.calls();
    expect(call.result).toMatchObject({
      headers: {
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Origin': 'https://localhost',
      },
    });
    expect(JSON.stringify(hook.calls())).not.toContain('opaque-session-1');
    expect(JSON.stringify(hook.calls())).not.toContain('opaque-key-1');
  });

  it('keeps CORS header values within the serialization limits', async () => {
    const headers: Record<string, string> = {};
    for (let i = 0; i < 500; i++) headers[`Access-Control-X-${i}`] = 'x'.repeat(400);
    const { win, cap } = fakeCapacitor({
      'CapacitorHttp.request': async () => ({ status: 200, headers }),
    });
    const hook = collect(win);

    await cap.nativePromise('CapacitorHttp', 'request', { url: 'https://api.example.com/' });
    await settle();

    const kept = (hook.calls()[0].result as { headers: Record<string, string> }).headers;
    expect(Object.keys(kept).length).toBeLessThan(500);
    expect(Math.max(...Object.values(kept).map((v) => String(v).length))).toBeLessThanOrEqual(201);
    expect(JSON.stringify(kept).length).toBeLessThan(500 * 400);
  });

  it('masks secrets inside string bodies: JSON, form fields and JSON stored as a value', async () => {
    const { win, cap } = fakeCapacitor({
      'CapacitorHttp.request': async () => ({
        status: 200,
        data: '{"accessToken":"opaque-access-1","name":"Ann"}',
      }),
    });
    const hook = collect(win);

    await cap.nativePromise('CapacitorHttp', 'request', {
      url: 'https://api.example.com/login',
      method: 'POST',
      dataType: 'json',
      data: '{"username":"ann","password":"hunter2"}',
    });
    await cap.nativePromise('CapacitorHttp', 'request', {
      url: 'https://api.example.com/login',
      method: 'POST',
      data: 'username=ann&password=hunter3',
    });
    await cap.nativePromise('Preferences', 'set', {
      key: 'profile',
      value: '{"refreshToken":"opaque-refresh-1","name":"Ann"}',
    });
    await settle();

    const text = JSON.stringify(hook.calls());
    for (const secret of ['hunter2', 'hunter3', 'opaque-access-1', 'opaque-refresh-1']) {
      expect(text).not.toContain(secret);
    }
    expect(text).toContain('ann');
    expect(text).toContain('Ann');
  });

  it('hands the app the same arguments, result and rejection', async () => {
    const failure = new Error('denied');
    const { win, cap, nativePromise } = fakeCapacitor({
      'Camera.checkPermissions': () => Promise.reject(failure),
      'Camera.getPhoto': async () => ({ format: 'png' }),
    });
    const original = cap.nativePromise;
    const options = { permissions: ['camera'] };
    collect(win);

    const rejected = cap.nativePromise('Camera', 'checkPermissions', options);
    expect(cap.nativePromise).not.toBe(original);
    expect(nativePromise.mock.calls[0][2]).toBe(options);
    await expect(rejected).rejects.toBe(failure);
    await expect(cap.nativePromise('Camera', 'getPhoto', {})).resolves.toEqual({ format: 'png' });
  });

  it('copies own properties of a returned promise, such as remove', async () => {
    const remove = vi.fn();
    const { win, cap } = fakeCapacitor({
      'Camera.getPhoto': () => Object.assign(Promise.resolve({}), { remove }),
    });
    collect(win);
    const returned = cap.nativePromise('Camera', 'getPhoto', {}) as Promise<unknown> & {
      remove?: unknown;
    };
    expect(returned.remove).toBe(remove);
    await returned;
  });

  it('leaves a rejection the app does not handle unhandled, as it was without the hook', () => {
    // In a child process: an unhandled rejection is the thing under test, and
    // the test runner would report one as a failure.
    const script = `
      const { createCapacitorHook } = await import(${JSON.stringify(join(__dirname, '../capacitor-collector.ts'))});
      let unhandled = 0;
      process.on('unhandledRejection', () => unhandled++);
      const failure = Object.assign(new Error('denied'), { code: 'DENIED' });
      const cap = { nativePromise: () => Promise.reject(failure), nativeCallback: () => '1' };
      const withHook = process.argv[2] === 'hook';
      if (withHook) createCapacitorHook({ Capacitor: cap });
      cap.nativePromise('Camera', 'getPhoto', {});
      await new Promise((resolve) => setTimeout(resolve, 50));
      console.log(unhandled);
    `;
    const run = (mode: string) =>
      execFileSync(process.execPath, ['--input-type=module', '-e', script, mode], {
        encoding: 'utf8',
        env: { ...process.env, NODE_NO_WARNINGS: '1' },
      }).trim();
    expect(run('plain')).toBe('1');
    expect(run('hook')).toBe('1');
  });

  it('keeps the name and toString of the functions it wraps', () => {
    const { win, cap } = fakeCapacitor();
    const nativePromise = function nativePromise() {
      return Promise.resolve();
    };
    cap.nativePromise = nativePromise as never;
    collect(win);
    expect(cap.nativePromise).not.toBe(nativePromise);
    expect(cap.nativePromise.name).toBe('nativePromise');
    expect(String(cap.nativePromise)).toBe(String(nativePromise));
  });

  it('marks the listeners of a plugin removed once removeAllListeners succeeds', async () => {
    const { win, cap } = fakeCapacitor();
    const hook = collect(win);
    cap.nativeCallback('Network', 'addListener', { eventName: 'networkStatusChange' }, () => {});
    cap.nativeCallback('Keyboard', 'addListener', { eventName: 'keyboardWillShow' }, () => {});

    await cap.nativePromise('Network', 'removeAllListeners', {});
    await settle();

    const listeners = hook.snapshot().listeners ?? [];
    expect(listeners.find((l) => l.plugin === 'Network')?.removed).toBe(true);
    expect(listeners.find((l) => l.plugin === 'Keyboard')?.removed).toBeUndefined();
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

  it('keeps only the last event of a listener, masked when a snapshot reads it', () => {
    const { win, cap, fire } = fakeCapacitor();
    const hook = collect(win);
    const id = cap.nativeCallback(
      'Foldable',
      'addListener',
      { eventName: 'foldStateChange' },
      () => {},
    );
    fire(id, { state: 'flat', posture: 'flat' });
    const event = {
      state: 'half-opened',
      posture: 'tabletop',
      password: 'hunter2',
      note: 'y'.repeat(500),
    };
    fire(id, event);
    // An error carries no event, so the last one stays.
    fire(id, undefined, { message: 'gone' });

    const [listener] = hook.snapshot().listeners ?? [];
    const last = listener.last as Record<string, unknown>;
    expect(listener.events).toBe(3);
    expect(last['state']).toBe('half-opened');
    expect(last['posture']).toBe('tabletop');
    expect(last['password']).toBe('[redacted]');
    expect(String(last['note']).length).toBeLessThanOrEqual(201);
    // A copy, not the app's own object.
    expect(listener.last).not.toBe(event);
    expect(event.password).toBe('hunter2');
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

  it('logs an unhandled rejection it already logged as a call only once, and never a then', async () => {
    const reason = {
      message: '"Camera.getLimitedLibraryPhotos()" is not implemented on android',
      code: 'UNIMPLEMENTED',
    };
    const { win, cap } = fakeCapacitor({
      'Camera.getLimitedLibraryPhotos': () => Promise.reject(reason),
    });
    const target = new EventTarget();
    const hookWin = Object.assign(win, {
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
    });
    const hook = collect(hookWin as HookWindow);
    await cap.nativePromise('Camera', 'getLimitedLibraryPhotos', {}).catch(() => {});
    await settle();
    const fire = (r: unknown) =>
      target.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: r }));
    fire(reason);
    fire({ message: '"Camera.then()" is not implemented on android', code: 'UNIMPLEMENTED' });

    expect(hook.calls().map((c) => c.method)).toEqual(['getLimitedLibraryPhotos']);
  });

  it('with no @capacitor/core after it, does not claim to log web calls', () => {
    const win: HookWindow = {};
    const hook = createCapacitorHook(win, { early: true });
    hooks.push(hook);
    expect(win.Capacitor).toBeDefined();
    expect(hook.webCalls()).toBe(false);
    expect(readCapacitorInfo(win)).toBeNull();
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
