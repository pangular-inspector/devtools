// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls: { name: string; args: unknown[] }[] = [];
const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('devframe/client', () => ({
  connectDevframe: async () => ({
    connectionMeta: {
      backend: 'websocket',
      configs: { pangular: { inspectors: { analog: false } } },
    },
    scope: () => ({
      rpc: {
        call: async (name: string, ...args: unknown[]) => {
          calls.push({ name, args });
          return undefined;
        },
        register: (definition: { name: string; handler: (...args: unknown[]) => unknown }) => {
          handlers.set(definition.name, definition.handler);
        },
      },
    }),
  }),
}));

class _MapView {
  static ɵcmp = { debugInfo: { className: 'MapView', filePath: 'src/app/map.ts', lineNumber: 9 } };
}

const stops: (() => void)[] = [];

async function startPick() {
  document.body.innerHTML = '<app-map><b>pin</b></app-map>';
  const host = document.querySelector('app-map')!;
  const instance = new _MapView();
  vi.stubGlobal('ng', { getComponent: (el: Element) => (el === host ? instance : null) });
  vi.resetModules();
  const { initOverlay } = await import('../overlay.ts');
  const pending = initOverlay();
  await vi.advanceTimersByTimeAsync(200);
  stops.push(await pending);
  handlers.get('component-pick')!({ requestId: 'r1' });
  return host.querySelector('b')!;
}

async function pickResult() {
  await vi.advanceTimersByTimeAsync(10);
  return calls.find((call) => call.name === 'component-pick-result');
}

describe.sequential('overlay pick with Alt', () => {
  beforeEach(() => {
    calls.length = 0;
    handlers.clear();
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
    document.body.innerHTML = '';
  });

  it('opens the picked component in the editor on Alt+click and still reports the pick', async () => {
    const target = await startPick();
    target.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, altKey: true }),
    );
    expect(await pickResult()).toBeDefined();
    expect(calls.filter((call) => call.name === 'open-in-editor')).toEqual([
      { name: 'open-in-editor', args: [{ file: 'src/app/map.ts', line: 9 }] },
    ]);
  });

  it('only picks on a plain click', async () => {
    const target = await startPick();
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(await pickResult()).toBeDefined();
    expect(calls.some((call) => call.name === 'open-in-editor')).toBe(false);
  });
});
