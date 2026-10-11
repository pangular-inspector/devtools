// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls: { name: string; args: unknown[] }[] = [];
const handlers = new Map<string, (...args: unknown[]) => unknown>();
const failures = new Map<string, number>();
let configs: Record<string, unknown> | undefined;

vi.mock('devframe/client', () => ({
  connectDevframe: async () => ({
    connectionMeta: { backend: 'websocket', configs },
    scope: () => ({
      rpc: {
        call: async (name: string, ...args: unknown[]) => {
          calls.push({ name, args });
          const left = failures.get(name) ?? 0;
          if (left > 0) {
            failures.set(name, left - 1);
            throw new Error('connection lost');
          }
          return undefined;
        },
        register: (definition: { name: string; handler: (...args: unknown[]) => unknown }) => {
          handlers.set(definition.name, definition.handler);
        },
      },
    }),
  }),
}));

const stops: (() => void)[] = [];

async function start(inspectors: Record<string, boolean> = {}) {
  configs = { pangular: { inspectors: { analog: false, ...inspectors } } };
  vi.resetModules();
  const { initOverlay } = await import('../overlay.ts');
  const pending = initOverlay();
  await vi.advanceTimersByTimeAsync(200);
  stops.push(await pending);
}

const sent = (name: string) => calls.filter((call) => call.name === name);

describe.sequential('overlay pushes that fail', () => {
  beforeEach(() => {
    calls.length = 0;
    handlers.clear();
    failures.clear();
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.useFakeTimers({
      toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
  });

  afterEach(() => {
    stops.splice(0).forEach((stop) => stop());
    vi.useRealTimers();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it.each(['component-tree', 'injector-tree', 'router'])(
    'sends the %s again after a failed push instead of only pinging',
    async (name) => {
      failures.set(`push-${name}`, 1);
      await start({ router: true });
      await vi.advanceTimersByTimeAsync(60_000);
      expect(sent(`push-${name}`).length, name).toBeGreaterThanOrEqual(2);
    },
  );

  it('does not leave a rejected promise when a panel-triggered push fails', async () => {
    await start();
    failures.set('push-component-tree', 5);
    const seen: unknown[] = [];
    const onRejection = (reason: unknown) => seen.push(reason);
    process.on('unhandledRejection', onRejection);
    try {
      handlers.get('inspect-component-in-page')!({ id: null });
      await vi.advanceTimersByTimeAsync(50);
      await new Promise<void>((resolve) => setImmediate(resolve));
    } finally {
      process.off('unhandledRejection', onRejection);
    }
    expect(seen).toEqual([]);
  });
});
