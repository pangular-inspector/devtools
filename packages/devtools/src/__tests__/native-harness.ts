// A shared headless harness for the mobile overlays: the NativeScript overlay, the Angular Native
// overlay and the Capacitor collector. It runs them in plain Node.js with fake globals in place of
// a device, so no jsdom and no emulator. Each test file still declares its own `vi.mock` calls
// (Vitest hoists them per file), and points the `devframe/client` mock at `devframe`:
//
//   vi.mock('devframe/client', async () => (await import('./native-harness.ts')).devframeModule());
import { vi } from 'vitest';

type Handler = (...args: unknown[]) => unknown;

/** One connection an overlay opened: what it called on the server and what it registered. */
export interface FakeSession {
  options: Record<string, unknown>;
  calls: [string, unknown][];
  handlers: Map<string, Handler>;
  close: ReturnType<typeof vi.fn>;
  /** The payloads of every call to `name`, oldest first. */
  pushes<T = unknown>(name: string): T[];
}

interface DevframeFake {
  sessions: FakeSession[];
  /** Whether the server trusts the app (`ensureTrusted`). */
  trusted: boolean;
  /** Answers by function name; any other call answers `{ known: true }`. */
  replies: Record<string, unknown>;
  connectDevframe: ReturnType<typeof vi.fn>;
  reset(): void;
}

function newSession(options: Record<string, unknown>): FakeSession {
  const calls: [string, unknown][] = [];
  return {
    options,
    calls,
    handlers: new Map(),
    close: vi.fn(),
    pushes: <T>(name: string) => calls.filter(([n]) => n === name).map(([, arg]) => arg as T),
  };
}

/** A stand-in for `connectDevframe` from `devframe/client`, shared by every overlay under test. */
export const devframe: DevframeFake = {
  sessions: [],
  trusted: true,
  replies: {},
  connectDevframe: vi.fn(async (options: Record<string, unknown> = {}) => {
    const session = newSession(options);
    devframe.sessions.push(session);
    return {
      status: 'connected',
      connectionMeta: {},
      ensureTrusted: async () => devframe.trusted,
      close: session.close,
      scope: () => ({
        rpc: {
          register: (definition: { name: string; handler: Handler }) =>
            session.handlers.set(definition.name, definition.handler),
          call: vi.fn(async (name: string, arg: unknown) => {
            session.calls.push([name, arg]);
            return name in devframe.replies ? devframe.replies[name] : { known: true };
          }),
        },
      }),
    };
  }),
  reset() {
    devframe.sessions.length = 0;
    devframe.trusted = true;
    devframe.replies = {};
    devframe.connectDevframe.mockClear();
  },
};

/** The module a test file's `vi.mock('devframe/client', ...)` factory returns. */
export function devframeModule() {
  return { connectDevframe: devframe.connectDevframe };
}

/** An RPC scope for code that takes one directly, such as `attachCapacitor`. */
export function fakeScope() {
  const session = newSession({});
  devframe.sessions.push(session);
  const scope = {
    rpc: {
      call: vi.fn(async (name: string, arg: unknown) => {
        session.calls.push([name, arg]);
        return name in devframe.replies ? devframe.replies[name] : { known: true };
      }),
    },
  };
  return { scope, session };
}

const g = globalThis as Record<string, unknown>;
const RUNTIME_GLOBALS = ['window', 'document', 'location', 'ng', 'WebSocket', 'fetch'];

/**
 * The globals of a NativeScript or Angular Native runtime: a `WebSocket` (the polyfill the
 * overlays ask for), a `fetch` that answers `__connection.json`, and no DOM. `ng` is the debug
 * API the app exposes in development. Returns the function that puts the real globals back.
 */
export function nativeRuntime(
  ng: unknown,
  meta: Record<string, unknown> = { backend: 'websocket' },
) {
  const saved = new Map(
    RUNTIME_GLOBALS.map((name) => [name, Object.getOwnPropertyDescriptor(g, name)]),
  );
  for (const name of ['window', 'document', 'location']) delete g[name];
  const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => meta }));
  Object.assign(g, { ng, WebSocket: class {}, fetch });
  return {
    fetch,
    restore() {
      for (const [name, descriptor] of saved) {
        if (descriptor) Object.defineProperty(g, name, descriptor);
        else delete g[name];
      }
    },
  };
}

/** A `@nativescript/core` view: children come from `eachChildView`. */
export interface FakeNativeView {
  typeName: string;
  parent: FakeNativeView | null;
  isLoaded: boolean;
  customCSSName?: string;
  eachChildView(callback: (child: FakeNativeView) => boolean | void): void;
  [key: string]: unknown;
}

export function nsView(
  typeName: string,
  children: FakeNativeView[] = [],
  extra: Partial<FakeNativeView> = {},
): FakeNativeView {
  const view: FakeNativeView = {
    typeName,
    parent: null,
    isLoaded: true,
    eachChildView: (callback) => {
      for (const child of children) if (callback(child) === false) break;
    },
    ...extra,
  };
  for (const child of children) child.parent = view;
  return view;
}

/** An Angular Native node, as `mount()` builds them. */
export interface FakeNativeNode {
  kind: string;
  name: string;
  children: FakeNativeNode[];
  parent: FakeNativeNode | null;
  props: Record<string, unknown>;
  host: { setProp(node: FakeNativeNode, key: string, value: unknown): void };
}

const engine = {
  setProp: (node: FakeNativeNode, key: string, value: unknown) => {
    node.props[key] = value;
  },
};

export function nativeNode(
  name: string,
  children: FakeNativeNode[] = [],
  kind = 'element',
): FakeNativeNode {
  const node: FakeNativeNode = { kind, name, children, parent: null, props: {}, host: engine };
  for (const child of children) child.parent = node;
  return node;
}

/** A component instance whose class carries the selector Angular's compiler gives it. */
export function fakeComponent(
  selector: string,
  name: string,
  fields: Record<string, unknown> = {},
) {
  const Cmp = { [name]: class {} }[name] as new () => object;
  Object.assign(Cmp, { ɵcmp: { selectors: [[selector]] } });
  return Object.assign(new Cmp(), fields);
}

/**
 * The page a Capacitor WebView shows, without jsdom: a `location`, a `document` with a title and
 * the visibility events, and a `Capacitor` bridge whose native calls resolve.
 */
export function capacitorWebView(platform: 'ios' | 'android' = 'ios') {
  const listeners = new Map<string, EventListenerOrEventListenerObject>();
  const doc = {
    title: 'Capacitor app',
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      listeners.set(type, listener);
    },
    removeEventListener(type: string) {
      listeners.delete(type);
    },
  };
  const Capacitor = {
    getPlatform: () => platform,
    isNativePlatform: () => true,
    isPluginAvailable: () => true,
    Plugins: { Preferences: {} },
    nativePromise: vi.fn(async (_plugin: string, method: string, _options?: unknown) =>
      method === 'get' ? { value: 'dark' } : undefined,
    ),
    nativeCallback: vi.fn(() => '1'),
  };
  vi.stubGlobal('location', { pathname: '/home', search: '', origin: 'capacitor://localhost' });
  vi.stubGlobal('document', doc);
  return { win: { Capacitor }, doc, Capacitor };
}
