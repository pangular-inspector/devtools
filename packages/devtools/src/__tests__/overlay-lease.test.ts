// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The overlay with a server that takes deltas and runs the activity lease:
// a fake `ng` page, a fake RPC that answers like `devframe.ts`.

const calls: { name: string; arg: unknown }[] = [];
const handlers = new Map<string, (message: unknown) => unknown>();
let watching = true;
let formsOn = false;

vi.mock('devframe/client', () => ({
  connectDevframe: async () => ({
    connectionMeta: {
      backend: 'websocket',
      configs: {
        pangular: {
          inspectors: {
            router: false,
            analog: false,
            signals: false,
            http: false,
            errors: false,
            forms: formsOn,
            pipes: false,
          },
        },
      },
    },
    scope: () => ({
      rpc: {
        call: async (name: string, arg?: unknown) => {
          calls.push({ name, arg: JSON.parse(JSON.stringify(arg ?? null)) });
          if (name === 'page-interest') return { watching };
          if (name.startsWith('ping-')) return { known: true };
          if (
            name === 'push-component-tree' ||
            name === 'push-injector-tree' ||
            name === 'push-forms'
          ) {
            return { delta: true };
          }
          return undefined;
        },
        register: (definition: { name: string; handler: (message: unknown) => unknown }) =>
          void handlers.set(definition.name, definition.handler),
      },
    }),
  }),
}));

class App {}
class Item {}
const getComponent = vi.fn((el: Element) =>
  el.tagName === 'APP-ROOT' ? new App() : el.tagName === 'APP-ITEM' ? new Item() : null,
);

const stops: (() => void)[] = [];
const sent = (name: string) => calls.filter((call) => call.name === name);

async function start() {
  vi.resetModules();
  const { initOverlay } = await import('../overlay.ts');
  const pending = initOverlay();
  await vi.advanceTimersByTimeAsync(300);
  stops.push(await pending);
}

describe.sequential('overlay activity lease and deltas', () => {
  beforeEach(() => {
    calls.length = 0;
    handlers.clear();
    watching = true;
    formsOn = false;
    vi.stubGlobal('BroadcastChannel', undefined);
    document.body.innerHTML = '<app-root ng-version="22.0.0"><app-item></app-item></app-root>';
    (window as unknown as { ng: unknown }).ng = { getComponent, getDirectives: () => [] };
    vi.useFakeTimers({
      toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
  });

  afterEach(() => {
    stops.splice(0).forEach((stop) => stop());
    vi.useRealTimers();
    vi.unstubAllGlobals();
    sessionStorage.clear();
    delete (window as unknown as { ng?: unknown }).ng;
  });

  it('sends the tree once in full, then deltas, and skips walks while elements stay', async () => {
    await start();
    const pushes = sent('push-component-tree');
    expect(pushes[0]!.arg).toMatchObject({
      roots: [{ name: 'App', children: [{ name: 'Item' }] }],
      delta: { full: true },
    });
    // Let the overlay's own floating button settle into the page first.
    await vi.advanceTimersByTimeAsync(4500);
    const before = sent('push-component-tree').length;
    getComponent.mockClear();
    // Four polls; with no element added, only the 4 s safety walk reads the tree.
    await vi.advanceTimersByTimeAsync(12_000);
    const walks = getComponent.mock.calls.length / 2;
    expect(walks).toBeGreaterThan(0);
    expect(walks).toBeLessThan(4);
    expect(sent('push-component-tree')).toHaveLength(before);
    document.querySelector('app-root')!.append(document.createElement('app-item'));
    await vi.advanceTimersByTimeAsync(3500);
    const delta = sent('push-component-tree').at(-1)!.arg as {
      delta: { trees: { roots: { set: [string, { name: string }][] } } };
    };
    expect(delta).not.toHaveProperty('roots');
    const changed = delta.delta.trees.roots.set.map(([, node]) => node.name);
    // The new item, and its parent whose children changed.
    expect(changed.sort()).toEqual(['App', 'Item']);
  });

  it('stops pushing while nobody watches and sends again on a wake', async () => {
    watching = false;
    await start();
    // An idle page still reports once, so it is listed.
    expect(sent('push-component-tree').length + sent('ping-component-tree').length).toBe(1);
    calls.length = 0;
    document.querySelector('app-root')!.append(document.createElement('app-item'));
    await vi.advanceTimersByTimeAsync(20_000);
    expect(sent('push-component-tree')).toHaveLength(0);
    expect(sent('push-injector-tree')).toHaveLength(0);
    // Keepalives only.
    expect(sent('ping-component-tree').length).toBeGreaterThan(0);
    watching = true;
    handlers.get('page-interest-changed')!({ watching: true, wake: true });
    await vi.advanceTimersByTimeAsync(10);
    expect(sent('push-component-tree')).toHaveLength(1);
    expect(sent('page-interest').at(-1)!.arg).toMatchObject({ synced: true });
  });

  it('sends the forms report in full again after a back/forward cache restore', async () => {
    formsOn = true;
    await start();
    expect(sent('push-forms')).toHaveLength(1);
    expect(sent('push-forms')[0]!.arg).toMatchObject({ delta: { full: true } });
    window.dispatchEvent(new Event('pagehide'));
    expect(sent('forget-forms-page')).toHaveLength(1);
    window.dispatchEvent(new Event('pageshow'));
    await vi.advanceTimersByTimeAsync(2000);
    expect(sent('push-forms')).toHaveLength(2);
    expect(sent('push-forms')[1]!.arg).toMatchObject({ forms: [], delta: { full: true } });
  });
});
