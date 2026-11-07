// Smoke tests for the mobile overlays in the shared headless harness: each one starts against a
// fake runtime, sends its first report with a page id, and leaves nothing behind when stopped.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  capacitorWebView,
  devframe,
  fakeComponent,
  fakeScope,
  nativeNode,
  nativeRuntime,
  nsView,
  type FakeNativeView,
} from './native-harness.ts';

const nativeScript = vi.hoisted(() => ({ root: null as unknown }));

vi.mock('devframe/client', async () => (await import('./native-harness.ts')).devframeModule());
vi.mock('@nativescript/core', () => ({
  Application: { getRootView: () => nativeScript.root },
  isAndroid: false,
}));

let restore: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  devframe.reset();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  restore?.();
  restore = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

interface TreePush {
  pageId: string;
  count: number;
  platform?: string;
  roots: { name: string; tag: string }[];
}

describe('NativeScript overlay in the headless harness', () => {
  it('reports the component tree over a WebSocket session and forgets the page on dispose', async () => {
    const label = nsView('Label');
    const host: FakeNativeView = nsView('AppHostView', [nsView('StackLayout', [label])]);
    nativeScript.root = host;
    const app = fakeComponent('ns-app', 'AppComponent');
    restore = nativeRuntime({
      getComponent: (view: unknown) => (view === host ? app : null),
      getRootComponents: () => [app],
      getHostElement: (component: unknown) => (component === app ? host : null),
    }).restore;

    const { initNativeScriptOverlay } = await import('../overlay-nativescript.ts');
    const dispose = initNativeScriptOverlay({
      baseURL: 'http://localhost:9999/',
      intervalMs: 1000,
    });
    await vi.waitFor(() =>
      expect(devframe.sessions[0]?.pushes('push-component-tree').length ?? 0).toBeGreaterThan(0),
    );

    const session = devframe.sessions[0];
    expect(session.options).toMatchObject({
      baseURL: 'http://localhost:9999/',
      transport: 'websocket',
    });
    const [tree] = session.pushes<TreePush>('push-component-tree');
    expect(tree.pageId).toMatch(/^[a-z0-9]+$/);
    expect(tree.count).toBe(1);
    expect(tree.roots[0]).toMatchObject({ name: 'AppComponent', tag: 'ns-app' });

    dispose();
    await vi.advanceTimersByTimeAsync(0);
    expect(session.calls.map(([name]) => name)).toContain('forget-component-page');
    expect(session.close).toHaveBeenCalled();
  });
});

describe('Angular Native overlay in the headless harness', () => {
  it('reports the component tree, with no location left once it connected', async () => {
    const rowHost = nativeNode('app-row', [nativeNode('text')]);
    const rootHost = nativeNode('root', [nativeNode('view', [rowHost])]);
    const app = fakeComponent('app-root', 'AppComponent');
    const row = fakeComponent('app-row', 'RowComponent');
    const components = new Map<unknown, unknown>([
      [rootHost, app],
      [rowHost, row],
    ]);
    const runtime = nativeRuntime({
      getComponent: (node: unknown) => components.get(node) ?? null,
      getRootComponents: () => [app],
      getHostElement: (component: unknown) =>
        [...components].find(([, c]) => c === component)?.[0] ?? null,
    });
    restore = runtime.restore;

    const { initAngularNativeOverlay } = await import('../overlay-angular-native.ts');
    const dispose = initAngularNativeOverlay({
      root: rootHost as never,
      baseURL: 'http://192.168.1.20:9999/',
      intervalMs: 1000,
    });
    await vi.waitFor(() =>
      expect(devframe.sessions[0]?.pushes('push-component-tree').length ?? 0).toBeGreaterThan(0),
    );

    expect(runtime.fetch).toHaveBeenCalledWith('http://192.168.1.20:9999/__connection.json');
    const session = devframe.sessions[0];
    const [tree] = session.pushes<TreePush>('push-component-tree');
    expect(tree).toMatchObject({ count: 2, platform: 'angular-native' });
    expect(tree.pageId).toMatch(/^[a-z0-9]+$/);
    expect(typeof (globalThis as { location?: unknown }).location).toBe('undefined');

    dispose();
    await vi.advanceTimersByTimeAsync(0);
    expect(session.calls.map(([name]) => name)).toContain('forget-component-page');
    expect(session.close).toHaveBeenCalled();
  });
});

describe('Capacitor collector in the headless harness', () => {
  it('pushes the platform and a native call, then stops pushing', async () => {
    const { win, doc, Capacitor } = capacitorWebView('android');
    const { scope, session } = fakeScope();
    const { attachCapacitor } = await import('../capacitor-overlay.ts');
    const capacitor = attachCapacitor(scope, 'cap1', { maxCalls: 50, win, doc });
    await vi.advanceTimersByTimeAsync(0);

    const [first] = session.pushes<{ pageId: string; title: string; info: object }>(
      'push-capacitor',
    );
    expect(first).toMatchObject({ pageId: 'cap1', title: 'Capacitor app', url: '/home' });
    expect(first.info).toMatchObject({ platform: 'android', native: true });

    await Capacitor.nativePromise('Preferences', 'get', { key: 'theme' });
    await vi.advanceTimersByTimeAsync(300);
    const calls = session
      .pushes<{ calls: { plugin: string; method: string }[] }>('push-capacitor')
      .flatMap((report) => report.calls);
    expect(calls).toContainEqual(expect.objectContaining({ plugin: 'Preferences', method: 'get' }));

    capacitor.stop();
    const sent = session.calls.length;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(session.calls.slice(sent).map(([name]) => name)).not.toContain('push-capacitor');
  });
});
