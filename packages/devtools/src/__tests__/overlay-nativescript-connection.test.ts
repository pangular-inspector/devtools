import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { elementId } from '../element-id.ts';

type Handler = (...args: unknown[]) => unknown;

interface Client {
  options: { wsOptions: { onDisconnected: () => void } };
  calls: [string, unknown][];
  handlers: Map<string, Handler>;
}

const clients: Client[] = [];
let trusted = true;

const host: Record<string, unknown> = {
  typeName: 'AppHostView',
  parent: null,
  isLoaded: true,
  eachChildView: () => undefined,
  borderWidth: 1,
  borderColor: 'red',
};
class AppComponent {}
Object.assign(AppComponent, { ɵcmp: { selectors: [['ns-app']] } });
const app = new AppComponent();

vi.mock('@nativescript/core', () => ({
  Application: { getRootView: () => host },
  isAndroid: true,
}));

vi.mock('devframe/client', () => ({
  connectDevframe: vi.fn(async (options: Client['options']) => {
    const client: Client = { options, calls: [], handlers: new Map() };
    clients.push(client);
    return {
      status: 'connected',
      connectionMeta: {},
      ensureTrusted: async () => trusted,
      close: vi.fn(),
      scope: () => ({
        rpc: {
          register: (def: { name: string; handler: Handler }) =>
            client.handlers.set(def.name, def.handler),
          call: vi.fn(async (name: string, payload: unknown) => {
            client.calls.push([name, payload]);
            return undefined;
          }),
        },
      }),
    };
  }),
}));

vi.mock('../signal-history.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../signal-history.ts')>()),
  installSignalWriteHook: vi.fn(async () => () => undefined),
}));

vi.mock('../ngrx-overlay.ts', () => ({
  attachNgrx: () => ({ push: async () => undefined, stop: () => undefined }),
}));

async function flush() {
  for (let i = 0; i < 40; i++) await Promise.resolve();
}

const pageIdOf = (client: Client) =>
  (client.calls.find(([name]) => name === 'push-component-tree')?.[1] as { pageId: string }).pageId;

describe('NativeScript overlay connection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', class {});
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    clients.length = 0;
    trusted = true;
    host['borderWidth'] = 1;
    host['borderColor'] = 'red';
    (globalThis as Record<string, unknown>)['ng'] = {
      getComponent: (h: unknown) => (h === host ? app : null),
      getRootComponents: () => [app],
      getHostElement: (c: unknown) => (c === app ? host : null),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (globalThis as Record<string, unknown>)['ng'];
  });

  it('marks its reports as a NativeScript app with a url and title', async () => {
    const { initNativeScriptOverlay } = await import('../overlay-nativescript.ts');
    const dispose = initNativeScriptOverlay({ baseURL: 'http://localhost:9999/', intervalMs: 100 });
    await flush();
    const report = clients[0].calls.find(([name]) => name === 'push-component-tree')?.[1];
    expect(report).toMatchObject({
      platform: 'nativescript',
      url: '/',
      title: 'NativeScript (Android)',
    });
    dispose();
  });

  it('keeps its page id across a reconnect and forgets nothing on the dropped socket', async () => {
    const { initNativeScriptOverlay } = await import('../overlay-nativescript.ts');
    const dispose = initNativeScriptOverlay({
      baseURL: 'http://localhost:9999/',
      intervalMs: 100,
      retryMs: 50,
    });
    await flush();
    const first = clients[0];
    const pageId = pageIdOf(first);

    first.options.wsOptions.onDisconnected();
    await flush();
    expect(first.calls.some(([name]) => name.startsWith('forget-'))).toBe(false);

    await vi.advanceTimersByTimeAsync(50);
    await flush();
    expect(clients).toHaveLength(2);
    expect(pageIdOf(clients[1])).toBe(pageId);

    dispose();
    await flush();
    expect(clients[1].calls).toContainEqual(['forget-component-page', pageId]);
  });

  it('closes a session the server does not trust and says how to fix it', async () => {
    trusted = false;
    const warn = vi.mocked(console.warn);
    const { initNativeScriptOverlay } = await import('../overlay-nativescript.ts');
    const dispose = initNativeScriptOverlay({ baseURL: 'http://localhost:9999/', retryMs: 100 });
    await flush();
    expect(clients[0].calls).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('--no-auth'));
    dispose();
  });

  it('clears a highlight on an empty request and keeps it for another page', async () => {
    const { initNativeScriptOverlay } = await import('../overlay-nativescript.ts');
    const dispose = initNativeScriptOverlay({ baseURL: 'http://localhost:9999/', intervalMs: 100 });
    await flush();
    const highlight = clients[0].handlers.get('highlight-in-page')!;
    const pageId = pageIdOf(clients[0]);

    highlight({ pageId, id: elementId(host) });
    expect(host['borderWidth']).toBe(2);
    highlight({ pageId: 'other', id: 'x' });
    expect(host['borderWidth']).toBe(2);
    highlight('');
    expect(host).toMatchObject({ borderWidth: 1, borderColor: 'red' });
    dispose();
  });

  it('keeps a highlight for the duration the request names', async () => {
    const { initNativeScriptOverlay } = await import('../overlay-nativescript.ts');
    const dispose = initNativeScriptOverlay({
      baseURL: 'http://localhost:9999/',
      intervalMs: 60_000,
    });
    await flush();
    const highlight = clients[0].handlers.get('highlight-in-page')!;

    highlight({ id: elementId(host), durationMs: 5000 });
    await vi.advanceTimersByTimeAsync(4000);
    expect(host['borderWidth']).toBe(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(host['borderWidth']).toBe(1);

    highlight({ id: elementId(host) });
    await vi.advanceTimersByTimeAsync(2000);
    expect(host['borderWidth']).toBe(1);
    dispose();
  });
});
