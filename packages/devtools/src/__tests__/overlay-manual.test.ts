// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface ConnectOptions {
  baseURL?: string | string[];
  connectionMeta?: unknown;
  sseOptions?: { fetch?: (input: string) => Promise<unknown> };
  authToken?: string;
}

const connects: ConnectOptions[] = [];
const calls: string[] = [];
const errorListeners: ((error: Error) => void)[] = [];

// The real `setupDevframeConnection` decides whether `__connection.json` is
// fetched, so the tests check devframe's behaviour, not only what is passed in.
vi.mock('devframe/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('devframe/client')>();
  return {
    ...real,
    connectDevframe: vi.fn(async (options: ConnectOptions) => {
      connects.push(options);
      const connection = await real.setupDevframeConnection(
        options as Parameters<typeof real.setupDevframeConnection>[0],
      );
      return {
        close: vi.fn(),
        events: {
          on: vi.fn((event: string, listener: (error: Error) => void) => {
            if (event === 'connection:error') errorListeners.push(listener);
            return () => errorListeners.splice(errorListeners.indexOf(listener), 1);
          }),
        },
        connectionMeta: connection.connectionMeta,
        connection: { metaBaseUrl: connection.metaBaseUrl },
        scope: () => ({
          rpc: {
            call: vi.fn(async (name: string) => {
              calls.push(name);
              return undefined;
            }),
            register: vi.fn(),
          },
        }),
      };
    }),
  };
});

const DEVFRAME_GLOBALS = [
  '__DEVFRAME_CONNECTION__',
  '__DEVFRAME_CONNECTION_META__',
  '__DEVFRAME_CONNECTION_AUTH_TOKEN__',
];

const serverMeta = { backend: 'sse', sse: { path: '/__devframes/__sse' } } as const;

const stops: (() => void)[] = [];
const fetches: string[] = [];

const popupRoot = () => document.getElementById('pangular-popup-root');

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

async function loadManual() {
  vi.resetModules();
  return import('../overlay.ts');
}

async function loadAuto() {
  vi.resetModules();
  return import('../overlay-auto.ts');
}

beforeEach(() => {
  connects.length = 0;
  calls.length = 0;
  errorListeners.length = 0;
  fetches.length = 0;
  document.body.innerHTML = '';
  for (const key of DEVFRAME_GLOBALS) delete (globalThis as Record<string, unknown>)[key];
  vi.stubGlobal('BroadcastChannel', undefined);
  // A cross-origin `__connection.json` fails the way a WebView's blocked fetch does.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      fetches.push(String(url));
      throw new TypeError('Failed to fetch');
    }),
  );
});

afterEach(async () => {
  stops.splice(0).forEach((stop) => stop());
  const { disposeOverlay } = await import('../overlay.ts');
  await disposeOverlay();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe.sequential('overlay connectionMeta', () => {
  it('connects with the given connection info and never fetches __connection.json', async () => {
    const { initOverlay } = await loadManual();
    stops.push(
      await initOverlay({
        baseURL: 'http://192.168.1.20:4000/__devframes/pangular/',
        connectionMeta: serverMeta,
      }),
    );

    expect(fetches).toEqual([]);
    expect(connects).toEqual([
      { baseURL: 'http://192.168.1.20:4000/__devframes/pangular/', connectionMeta: serverMeta },
    ]);
  });

  it('fetches __connection.json from the default paths when none is given', async () => {
    const { initOverlay } = await loadManual();

    await expect(initOverlay()).rejects.toThrow('No devtools server found');
    expect(connects[0].connectionMeta).toBeUndefined();
    expect(fetches).toEqual([
      './__connection.json',
      '/__pangular/__connection.json',
      '/__devframes/pangular/__connection.json',
    ]);
  });

  it('applies the devtools config carried in the given connection info', async () => {
    const { initOverlay } = await loadManual();
    stops.push(
      await initOverlay({
        baseURL: 'http://192.168.1.20:4000/__devframes/pangular/',
        connectionMeta: {
          ...serverMeta,
          configs: {
            pangular: {
              inspectors: { components: false },
              redaction: { secretNames: ['voucher'] },
            },
          },
        },
      }),
    );
    // The overlay's own module instance, loaded after `vi.resetModules()`.
    const { isSecretKey } = await import('../forms-privacy.ts');
    await vi.waitFor(() => expect(calls).toContain('push-injector-tree'));

    expect(isSecretKey('voucherCode')).toBe(true);
    expect(calls).not.toContain('push-component-tree');
  });

  it('points a device app at the network, mixed content and cleartext when no server answers', async () => {
    vi.stubGlobal('Capacitor', { getPlatform: () => 'android' });
    const { initOverlay } = await loadManual();
    const failure = initOverlay({ baseURL: 'http://192.168.1.20:9999/' });
    await expect(failure).rejects.toThrow('No devtools server found');
    await expect(failure).rejects.toThrow(/mixed content.*cleartext/);
    // Without connectionMeta it may be live reload, so the dev server hints stay too.
    await expect(failure).rejects.toThrow('Mount initPangularHub()');
  });

  it('keeps to the server hints in a browser, without Capacitor', async () => {
    const { initOverlay } = await loadManual();
    const failure = initOverlay({ baseURL: 'http://localhost:4200/' });
    await expect(failure).rejects.toThrow('Mount initPangularHub()');
    await expect(failure).rejects.not.toThrow(/mixed content/);
  });

  it('warns once when the server refuses the authToken or cannot be reached', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { initOverlay } = await loadManual();
    stops.push(
      await initOverlay({
        baseURL: 'http://192.168.1.20:9999/',
        connectionMeta: { ...serverMeta, configs: { pangular: {} } },
        authToken: 'pairing-token-0123456789abcdef',
      }),
    );
    const emit = (error: Error) => errorListeners.forEach((listener) => listener(error));
    const auth = Object.assign(new Error('refused'), { kind: 'auth' });
    emit(auth);
    emit(auth);
    emit(Object.assign(new Error('Failed to fetch'), { kind: 'connection' }));
    emit(Object.assign(new Error('Failed to fetch'), { kind: 'connection' }));
    const messages = warn.mock.calls.map(([message]) => String(message));
    warn.mockRestore();

    expect(messages.filter((m) => m.includes('refused the authToken'))).toHaveLength(1);
    expect(messages.filter((m) => m.includes("Can't reach the devtools server"))).toHaveLength(1);
    expect(messages.join('\n')).not.toContain('pairing-token-0123456789abcdef');
  });

  it('stays quiet about a refused stored token when no authToken was passed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { initOverlay } = await loadManual();
    stops.push(
      await initOverlay({
        baseURL: 'http://192.168.1.20:9999/',
        connectionMeta: { ...serverMeta, configs: { pangular: {} } },
      }),
    );
    errorListeners.forEach((listener) => listener(Object.assign(new Error('x'), { kind: 'auth' })));
    const messages = warn.mock.calls.map(([message]) => String(message));
    warn.mockRestore();
    expect(messages.some((m) => m.includes('authToken'))).toBe(false);
  });

  it('accepts an imported __connection.json as connectionMeta', async () => {
    // What `import meta from './__connection.json'` gives TypeScript: `backend` is a string.
    const imported: { backend: string; websocket: { path: string } } = JSON.parse(
      '{"backend":"websocket","websocket":{"path":"__ws"}}',
    );
    const { initOverlay } = await loadManual();
    stops.push(
      await initOverlay({ baseURL: 'http://192.168.1.20:9999/', connectionMeta: imported }),
    );
    expect(connects[0].connectionMeta).toEqual(imported);
  });
});

describe.sequential('overlay connection options', () => {
  afterEach(() => {
    delete (globalThis as { CapacitorWebFetch?: unknown }).CapacitorWebFetch;
    vi.restoreAllMocks();
  });

  it('refuses connectionMeta with a list of base URLs or none, before connecting', async () => {
    const { initOverlay } = await loadManual();

    await expect(
      initOverlay({
        baseURL: ['http://192.168.1.20:4000/', '/__pangular/'],
        connectionMeta: serverMeta,
      }),
    ).rejects.toThrow('Pass one baseURL with connectionMeta');
    await expect(initOverlay({ connectionMeta: serverMeta })).rejects.toThrow(
      'Pass one baseURL with connectionMeta',
    );
    expect(connects).toEqual([]);
  });

  it('warns once when connectionMeta carries no devtools config', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { initOverlay } = await loadManual();
    const baseURL = 'http://192.168.1.20:4000/__devframes/pangular/';

    stops.push(await initOverlay({ baseURL, connectionMeta: serverMeta }));
    stops.push(await initOverlay({ baseURL, connectionMeta: serverMeta }));
    const noConfig = warn.mock.calls.filter(([message]) =>
      String(message).includes('has no configs'),
    );
    expect(noConfig).toHaveLength(1);

    warn.mockClear();
    const withConfig = { ...serverMeta, configs: { pangular: {} } };
    const fresh = await loadManual();
    stops.push(await fresh.initOverlay({ baseURL, connectionMeta: withConfig }));
    expect(warn.mock.calls.some(([message]) => String(message).includes('has no configs'))).toBe(
      false,
    );
  });

  it("streams server-sent events through Capacitor's own fetch when CapacitorHttp patched fetch", async () => {
    const webFetch = vi.fn(function (this: unknown) {
      return Promise.resolve(this);
    });
    (globalThis as { CapacitorWebFetch?: unknown }).CapacitorWebFetch = webFetch;
    const { initOverlay } = await loadManual();
    stops.push(
      await initOverlay({
        baseURL: 'http://192.168.1.20:4000/__devframes/pangular/',
        connectionMeta: serverMeta,
      }),
    );

    const sseFetch = connects[0].sseOptions?.fetch;
    expect(sseFetch).toBeTypeOf('function');
    // Bound to the window: a native fetch called on nothing throws "Illegal invocation".
    await expect(sseFetch!('http://192.168.1.20:4000/__devframes/__sse')).resolves.toBe(globalThis);
    expect(webFetch).toHaveBeenCalledWith('http://192.168.1.20:4000/__devframes/__sse');
  });

  it('passes a pairing token to devframe, so the page skips the one-time code', async () => {
    const { initOverlay } = await loadManual();
    stops.push(
      await initOverlay({
        baseURL: 'http://192.168.1.20:4000/__devframes/pangular/',
        connectionMeta: serverMeta,
        authToken: 'pairing-token-0123456789abcdef',
      }),
    );
    expect(connects[0].authToken).toBe('pairing-token-0123456789abcdef');
  });

  it('leaves the SSE fetch to devframe without CapacitorHttp', async () => {
    const { initOverlay } = await loadManual();
    stops.push(
      await initOverlay({
        baseURL: 'http://192.168.1.20:4000/__devframes/pangular/',
        connectionMeta: serverMeta,
      }),
    );
    expect(connects[0].sseOptions).toBeUndefined();
  });
});

describe.sequential('overlay entries', () => {
  // Lets the auto-start run, as it does outside the test runner.
  beforeEach(() => vi.stubEnv('VITEST', ''));

  it('the manual entry starts nothing and adds no button on import', async () => {
    await loadManual();
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(connects).toHaveLength(0);
    expect(popupRoot()).toBeNull();
  });

  it('the manual initOverlay connects without adding the floating button', async () => {
    const { initOverlay } = await loadManual();
    stops.push(
      await initOverlay({
        baseURL: 'http://192.168.1.20:4000/__devframes/pangular/',
        connectionMeta: serverMeta,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(connects).toHaveLength(1);
    expect(popupRoot()).toBeNull();
  });

  it('the default entry starts one overlay and the floating button on import', async () => {
    await loadAuto();

    await vi.waitFor(() => {
      expect(connects).toHaveLength(1);
      expect(popupRoot()).not.toBeNull();
    });
  });

  it('the default entry exports the same API as the manual one', async () => {
    const auto = await loadAuto();
    const manual = await import('../overlay.ts');

    expect(Object.keys(auto).sort()).toEqual(Object.keys(manual).sort());
    expect(auto.initOverlay).toBe(manual.initOverlay);
    expect(auto.disposeOverlay).toBe(manual.disposeOverlay);
    expect(auto.registerNgrxSignals).toBe(manual.registerNgrxSignals);
  });

  it('disposeOverlay from the manual entry removes the button the default entry added', async () => {
    await loadAuto();
    await vi.waitFor(() => expect(popupRoot()).not.toBeNull());
    const { disposeOverlay } = await import('../overlay.ts');

    await disposeOverlay();

    expect(popupRoot()).toBeNull();
  });
});
