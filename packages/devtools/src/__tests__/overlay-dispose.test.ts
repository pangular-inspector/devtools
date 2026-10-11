// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeClient {
  close: ReturnType<typeof vi.fn>;
  calls: string[];
}

const clients: FakeClient[] = [];
let connectGate: Promise<void> = Promise.resolve();

vi.mock('devframe/client', () => ({
  connectDevframe: vi.fn(async (options: { baseURL: string | string[] }) => {
    const client: FakeClient = { close: vi.fn(), calls: [] };
    clients.push(client);
    await connectGate;
    const base = [options.baseURL].flat()[0];
    return {
      close: client.close,
      connection: { metaBaseUrl: new URL(`${base}__connection.json`, location.href).href },
      scope: () => ({
        rpc: {
          call: vi.fn(async (name: string) => {
            client.calls.push(name);
            return undefined;
          }),
          register: vi.fn(),
        },
      }),
    };
  }),
}));

async function loadOverlay() {
  vi.resetModules();
  return import('../overlay.ts');
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe.sequential('overlay dispose', () => {
  beforeEach(() => {
    clients.length = 0;
    connectGate = Promise.resolve();
    document.body.innerHTML = '';
    delete window.__pangularComponentOf;
    delete window.__pangularHostOf;
    delete window.__pangularClassOf;
    delete window.__pangularPageId;
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('clears every timer, listener and observer and closes the connection', async () => {
    const { initOverlay } = await loadOverlay();
    const added = vi.spyOn(window, 'addEventListener');
    const removed = vi.spyOn(window, 'removeEventListener');
    const docAdded = vi.spyOn(document, 'addEventListener');
    const docRemoved = vi.spyOn(document, 'removeEventListener');
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');

    const dispose = await initOverlay();
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    dispose();

    expect(vi.getTimerCount()).toBe(0);
    expect(clients[0].close).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalled();
    const key = ([type, listener]: unknown[]) => `${type}:${String(listener)}`;
    expect(removed.mock.calls.map(key).sort()).toEqual(added.mock.calls.map(key).sort());
    expect(docRemoved.mock.calls.map(key).sort()).toEqual(docAdded.mock.calls.map(key).sort());
    expect(clients[0].calls).toContain('forget-component-page');
    expect(window.__pangularComponentOf).toBeUndefined();

    const pushes = clients[0].calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(clients[0].calls.length).toBe(pushes);
  });

  it('removes its profiler and clears the change detection timers', async () => {
    document.body.innerHTML = '<app-root ng-version="22.1.7"></app-root>';
    const profilers: ((event: number) => void)[] = [];
    const other = vi.fn();
    profilers.push(other);
    const setProfiler = vi.fn((profiler: ((event: number) => void) | null) => {
      if (!profiler) return () => {};
      profilers.push(profiler);
      return () => profilers.splice(profilers.indexOf(profiler), 1);
    });
    vi.stubGlobal('ng', { ɵsetProfiler: setProfiler });
    const { initOverlay } = await loadOverlay();

    const dispose = await initOverlay();
    await vi.advanceTimersByTimeAsync(0);
    expect(profilers).toHaveLength(2);
    for (const profiler of [...profilers]) profiler(2);
    expect(vi.getTimerCount()).toBeGreaterThan(1);
    dispose();

    expect(vi.getTimerCount()).toBe(0);
    expect(profilers).toEqual([other]);
    expect(setProfiler).not.toHaveBeenCalledWith(null);
    const pushes = clients[0].calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(clients[0].calls.length).toBe(pushes);
  });

  it('stops the change detection hook of the overlay it replaces', async () => {
    document.body.innerHTML = '<app-root ng-version="22.1.7"></app-root>';
    const profilers: ((event: number) => void)[] = [];
    vi.stubGlobal('ng', {
      ɵsetProfiler: (profiler: (event: number) => void) => {
        profilers.push(profiler);
        return () => profilers.splice(profilers.indexOf(profiler), 1);
      },
    });
    const { initOverlay, disposeOverlay } = await loadOverlay();
    await initOverlay();
    const first = profilers[0];
    await initOverlay({ baseURL: '/__elsewhere/' });

    expect(profilers).toHaveLength(1);
    expect(profilers[0]).not.toBe(first);

    await disposeOverlay();
    expect(profilers).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is safe to dispose twice', async () => {
    const { initOverlay } = await loadOverlay();
    const dispose = await initOverlay();
    dispose();
    dispose();
    expect(clients[0].close).toHaveBeenCalledTimes(1);
  });

  it('removes the Elements-panel lookup it installed', async () => {
    const { initOverlay } = await loadOverlay();
    const dispose = await initOverlay();
    expect(window.__pangularComponentOf).toBeTypeOf('function');

    expect(window.__pangularHostOf).toBeTypeOf('function');

    dispose();
    expect(window.__pangularComponentOf).toBeUndefined();
    expect(window.__pangularHostOf).toBeUndefined();
    expect(window.__pangularClassOf).toBeUndefined();
  });

  it('exposes the page id it claimed until it is disposed', async () => {
    const { initOverlay } = await loadOverlay();
    const dispose = await initOverlay();
    expect(window.__pangularPageId).toBeTypeOf('string');
    expect(window.__pangularPageId).toBe(sessionStorage.getItem('pangular-page-id'));

    dispose();
    expect(window.__pangularPageId).toBeUndefined();
  });

  it('leaves a page id that is not its own', async () => {
    const { initOverlay } = await loadOverlay();
    const dispose = await initOverlay();
    window.__pangularPageId = 'other';

    dispose();
    expect(window.__pangularPageId).toBe('other');
  });

  it('leaves an Elements-panel lookup that is not its own', async () => {
    const { initOverlay } = await loadOverlay();
    const dispose = await initOverlay();
    const other = () => null;
    window.__pangularComponentOf = other;

    dispose();
    expect(window.__pangularComponentOf).toBe(other);
  });

  it('keeps the lookup of the overlay that replaced it', async () => {
    const { initOverlay } = await loadOverlay();
    const first = await initOverlay();
    const firstLookup = window.__pangularComponentOf;
    const second = await initOverlay();
    const secondLookup = window.__pangularComponentOf;

    expect(secondLookup).toBeTypeOf('function');
    expect(secondLookup).not.toBe(firstLookup);
    first();
    expect(window.__pangularComponentOf).toBe(secondLookup);
    second();
    expect(window.__pangularComponentOf).toBeUndefined();
  });

  it('stops the running overlay when another one starts', async () => {
    const { initOverlay } = await loadOverlay();
    const first = await initOverlay();
    const intervals = vi.getTimerCount();
    await initOverlay({ baseURL: '/__elsewhere/' });

    expect(clients).toHaveLength(2);
    expect(clients[0].close).toHaveBeenCalledTimes(1);
    expect(clients[1].close).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(intervals);

    first();
    expect(clients[1].close).not.toHaveBeenCalled();
  });

  it('stops an overlay that is still connecting', async () => {
    const { initOverlay, disposeOverlay } = await loadOverlay();
    let open = () => {};
    connectGate = new Promise((resolve) => (open = resolve));
    const started = initOverlay();
    await flush();
    await disposeOverlay();
    open();
    const dispose = await started;

    expect(clients[0].close).toHaveBeenCalledTimes(1);
    expect(clients[0].calls).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    expect(window.__pangularComponentOf).toBeUndefined();
    dispose();
  });

  it('does not report a failed connect from an overlay it replaced', async () => {
    const { initOverlay } = await loadOverlay();
    let fail = (_error: Error) => {};
    connectGate = new Promise((_resolve, reject) => (fail = reject));
    const first = initOverlay();
    await flush();
    connectGate = Promise.resolve();
    const second = await initOverlay({ baseURL: '/__tools/pangular/' });
    fail(new Error('Failed to get connection meta'));

    await expect(first).resolves.toBeTypeOf('function');
    second();
  });

  it('explains a failed connect and lists the paths it tried', async () => {
    const { initOverlay } = await loadOverlay();
    connectGate = Promise.reject(new Error('Failed to get connection meta'));
    connectGate.catch(() => {});

    await expect(initOverlay({ baseURL: ['/__a/', '/__b/'] })).rejects.toThrow(
      /^\[pangular\] No devtools server found \(tried \/__a\/, \/__b\/\)\. .*initOverlay\(\{baseURL\}\)/,
    );
  });

  it('points the floating button at the base initOverlay connected to', async () => {
    vi.stubEnv('VITEST', '');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === `${location.origin}/__tools/__connection.json`
          ? new Response('{}', { headers: { 'content-type': 'application/json' } })
          : new Response('', { status: 404 }),
      ),
    );
    const { initOverlay, disposeOverlay } = await loadOverlay();
    await vi.waitFor(() => expect(document.getElementById('pangular-popup-root')).not.toBeNull());
    await initOverlay({ baseURL: '/__tools/pangular/' });
    await flush();
    const shadow = document.getElementById('pangular-popup-root')!.shadowRoot!;
    (shadow.querySelector('.fab') as HTMLButtonElement).click();
    await vi.waitFor(() =>
      expect(shadow.querySelector('iframe')!.src).toBe(`${location.origin}/__tools/`),
    );
    await disposeOverlay();
  });

  it('does not start inside the devtools panel frame', async () => {
    vi.stubEnv('VITEST', '');
    const host = document.createElement('div');
    host.id = 'pangular-popup-root';
    const panelFrame = document.createElement('iframe');
    host.attachShadow({ mode: 'open' }).append(panelFrame);
    vi.spyOn(window, 'frameElement', 'get').mockReturnValue(panelFrame);
    await loadOverlay();
    await vi.advanceTimersByTimeAsync(0);
    await flush();

    expect(clients).toHaveLength(0);
    expect(document.getElementById('pangular-popup-root')).toBeNull();
    vi.restoreAllMocks();
  });

  it('stops the auto-started overlay and removes the floating button', async () => {
    vi.stubEnv('VITEST', '');
    const { disposeOverlay } = await loadOverlay();
    await vi.waitFor(() => {
      expect(clients).toHaveLength(1);
      expect(document.getElementById('pangular-popup-root')).not.toBeNull();
    });
    await flush();

    await disposeOverlay();

    expect(clients[0].close).toHaveBeenCalledTimes(1);
    expect(document.getElementById('pangular-popup-root')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(window.__pangularComponentOf).toBeUndefined();
  });
});

describe.sequential('popup hide', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('removes the popup and lets it be shown again', async () => {
    vi.resetModules();
    const popup = await import('../popup.ts');
    await popup.showDevtools();
    expect(document.getElementById('pangular-popup-root')).not.toBeNull();

    await popup.hideDevtools();
    expect(document.getElementById('pangular-popup-root')).toBeNull();

    await popup.showDevtools();
    expect(document.getElementById('pangular-popup-root')).not.toBeNull();
  });
});
