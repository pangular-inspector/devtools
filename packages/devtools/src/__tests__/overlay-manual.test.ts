// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface ConnectOptions {
  baseURL: string | string[];
  connectionMeta?: { backend: string; configs?: Record<string, unknown> };
}

const connects: ConnectOptions[] = [];
const calls: string[] = [];

vi.mock('devframe/client', () => ({
  connectDevframe: vi.fn(async (options: ConnectOptions) => {
    connects.push(options);
    const base = [options.baseURL].flat()[0];
    return {
      close: vi.fn(),
      connectionMeta: options.connectionMeta ?? { backend: 'websocket' },
      connection: { metaBaseUrl: new URL(`${base}__connection.json`, location.href).href },
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
}));

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

const stops: (() => void)[] = [];

async function loadManual() {
  vi.resetModules();
  return import('../overlay.ts');
}

const popupRoot = () => document.getElementById('pangular-popup-root');

describe.sequential('overlay connectionMeta', () => {
  beforeEach(() => {
    connects.length = 0;
    calls.length = 0;
    document.body.innerHTML = '';
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
  });

  afterEach(() => {
    stops.splice(0).forEach((stop) => stop());
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('passes the connection info to devframe, so it skips __connection.json', async () => {
    const { initOverlay } = await loadManual();
    const connectionMeta = { backend: 'websocket', websocket: 9999 } as const;
    stops.push(await initOverlay({ baseURL: 'http://localhost:9999/', connectionMeta }));

    expect(connects).toEqual([{ baseURL: 'http://localhost:9999/', connectionMeta }]);
  });

  it('leaves the connection info to devframe when none is given', async () => {
    const { initOverlay } = await loadManual();
    stops.push(await initOverlay());

    expect(connects).toHaveLength(1);
    expect(connects[0].connectionMeta).toBeUndefined();
    expect(connects[0].baseURL).toEqual(['./', '/__pangular/', '/__devframes/pangular/']);
  });

  it('applies the devtools config carried in the given connection info', async () => {
    const { initOverlay } = await loadManual();
    stops.push(
      await initOverlay({
        baseURL: 'http://localhost:9999/',
        connectionMeta: {
          backend: 'websocket',
          configs: {
            pangular: {
              inspectors: { components: false },
              redaction: { secretNames: ['voucher'] },
            },
          },
        },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    const { isSecretKey, setRedaction } = await import('../forms-privacy.ts');

    expect(isSecretKey('voucherCode')).toBe(true);
    setRedaction();
    expect(calls).not.toContain('push-component-tree');
    expect(calls).toContain('push-injector-tree');
  });
});

describe.sequential('overlay entries', () => {
  beforeEach(() => {
    connects.length = 0;
    document.body.innerHTML = '';
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );
    vi.stubEnv('VITEST', '');
  });

  afterEach(async () => {
    stops.splice(0).forEach((stop) => stop());
    const { disposeOverlay } = await import('../overlay.ts');
    await disposeOverlay();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('the manual entry starts nothing and adds no button on import', async () => {
    await loadManual();
    await flush();

    expect(connects).toHaveLength(0);
    expect(popupRoot()).toBeNull();
  });

  it('the manual initOverlay connects without adding the floating button', async () => {
    const { initOverlay } = await loadManual();
    stops.push(await initOverlay({ baseURL: 'http://localhost:9999/' }));
    await flush();

    expect(connects).toHaveLength(1);
    expect(popupRoot()).toBeNull();
  });

  it('the default entry starts one overlay and the floating button on import', async () => {
    vi.resetModules();
    await import('../overlay-auto.ts');

    await vi.waitFor(() => {
      expect(connects).toHaveLength(1);
      expect(popupRoot()).not.toBeNull();
    });
  });

  it('the default entry exports the same API as the manual one', async () => {
    vi.resetModules();
    const auto = await import('../overlay-auto.ts');
    const manual = await import('../overlay.ts');

    expect(Object.keys(auto).sort()).toEqual(Object.keys(manual).sort());
    expect(auto.initOverlay).toBe(manual.initOverlay);
    expect(auto.disposeOverlay).toBe(manual.disposeOverlay);
    expect(auto.registerNgrxSignals).toBe(manual.registerNgrxSignals);
  });
});
