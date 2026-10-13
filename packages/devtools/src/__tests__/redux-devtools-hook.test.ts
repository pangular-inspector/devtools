// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  installReduxDevtoolsHook,
  isNgrxDevtoolsOptions,
  libraryOf,
  REDUX_EXTENSION_KEY,
  reduxDevtoolsHook,
  uninstallReduxDevtoolsHook,
} from '../redux-devtools-hook.ts';

type Target = Record<PropertyKey, any>;

/** The options `@ngrx/store-devtools` passes to `connect` (`getExtensionConfig()`). */
const NGRX_OPTIONS = {
  name: 'NgRx Store DevTools',
  features: { pause: true },
  serialize: false,
  autoPause: false,
  trace: false,
  traceLimit: 75,
  maxAge: 25,
};

function fakeExtension() {
  const sent: unknown[][] = [];
  const unsubscribe = vi.fn();
  const connection = {
    init: vi.fn((state: unknown) => sent.push(['init', state])),
    send: vi.fn((action: unknown, state: unknown) => sent.push(['send', action, state])),
    subscribe: vi.fn(() => unsubscribe),
    unsubscribe: vi.fn(),
    error: vi.fn(),
  };
  const enhancer = vi.fn((next: unknown) => next);
  return {
    sent,
    unsubscribe,
    connection,
    // Like the real extension: the store enhancer, with the page API on it.
    enhancer,
    extension: Object.assign(
      vi.fn((..._args: unknown[]) => enhancer),
      {
        connect: vi.fn(() => connection),
        disconnect: vi.fn(),
        send: vi.fn(),
        open: vi.fn(),
      },
    ),
  };
}

describe('the Redux DevTools stand-in', () => {
  it('records what a store sends when no extension is installed', () => {
    const target: Target = {};
    const hook = installReduxDevtoolsHook(target)!;
    const changed = vi.fn();
    hook.listeners.add(changed);
    const devtools = target[REDUX_EXTENSION_KEY].connect({ name: 'Travel' });
    devtools.init({ trips: [] });
    devtools.send({ type: '[Trips] Add', id: 7 }, { trips: [7] });
    devtools.send('[Trips] Clear', { trips: [] });

    const [connection] = hook.connections;
    expect(connection).toMatchObject({ id: 'r1', name: 'Travel', count: 3, hasState: true });
    expect(connection.state).toEqual({ trips: [] });
    expect(connection.pending.map((entry) => entry.type)).toEqual([
      '@@INIT',
      '[Trips] Add',
      '[Trips] Clear',
    ]);
    expect(connection.pending[1].action).toEqual({ type: '[Trips] Add', id: 7 });
    expect(changed).toHaveBeenCalledTimes(3);
    // Nothing is sent back to the app.
    const listener = vi.fn();
    expect(typeof devtools.subscribe(listener)).toBe('function');
    expect(listener).not.toHaveBeenCalled();
  });

  it('passes every call on to the real extension and returns its unsubscribe', () => {
    const real = fakeExtension();
    const target: Target = { [REDUX_EXTENSION_KEY]: real.extension };
    const hook = installReduxDevtoolsHook(target)!;
    const devtools = target[REDUX_EXTENSION_KEY].connect({ name: 'NGXS' });
    devtools.init({ count: 0 });
    devtools.send({ type: 'Increment' }, { count: 1 });
    expect(real.extension.connect).toHaveBeenCalledWith({ name: 'NGXS' });
    expect(real.sent).toEqual([
      ['init', { count: 0 }],
      ['send', { type: 'Increment' }, { count: 1 }],
    ]);
    const listener = vi.fn();
    expect(devtools.subscribe(listener)).toBe(real.unsubscribe);
    expect(real.connection.subscribe).toHaveBeenCalledWith(listener);
    // Other members of the extension still work.
    target[REDUX_EXTENSION_KEY].open('right');
    expect(real.extension.open).toHaveBeenCalledWith('right');
    expect(hook.connections[0]).toMatchObject({ library: 'NGXS', count: 2 });
  });

  it('passes @ngrx/store-devtools through without recording it', () => {
    const real = fakeExtension();
    const target: Target = { [REDUX_EXTENSION_KEY]: real.extension };
    const hook = installReduxDevtoolsHook(target)!;
    const connection = target[REDUX_EXTENSION_KEY].connect(NGRX_OPTIONS);
    expect(connection).toBe(real.connection);
    expect(hook.connections).toEqual([]);

    const alone: Target = {};
    const silent = installReduxDevtoolsHook(alone)!;
    const quiet = alone[REDUX_EXTENSION_KEY].connect(NGRX_OPTIONS);
    quiet.init({});
    quiet.send({ type: 'x' }, {});
    expect(silent.connections).toEqual([]);
  });

  it('is callable like the real extension and forwards the call with its this and arguments', () => {
    const real = fakeExtension();
    const target: Target = { [REDUX_EXTENSION_KEY]: real.extension };
    installReduxDevtoolsHook(target);
    const ext = target[REDUX_EXTENSION_KEY];
    expect(typeof ext).toBe('function');
    const self = { app: true };
    const options = { name: 'Redux app' };
    expect(ext.call(self, options)).toBe(real.enhancer);
    expect(real.extension).toHaveBeenCalledWith(options);
    expect(real.extension.mock.contexts[0]).toBe(self);
    // `createStore(reducer, ext && ext())` gets the extension's enhancer.
    const createStore = (enhancer: (next: unknown) => unknown) => enhancer('createStore');
    expect(createStore(ext && ext())).toBe('createStore');
    expect(real.enhancer).toHaveBeenCalledWith('createStore');
  });

  it('returns an identity enhancer when there is no real extension', () => {
    const target: Target = {};
    installReduxDevtoolsHook(target);
    const ext = target[REDUX_EXTENSION_KEY];
    expect(typeof ext).toBe('function');
    const enhancer = ext({ name: 'x' });
    const next = () => 'store';
    expect(enhancer(next)).toBe(next);
    expect('connect' in ext).toBe(true);
    expect('open' in ext).toBe(false);
  });

  it('forwards to an extension that arrives after the stand-in', () => {
    const target: Target = {};
    installReduxDevtoolsHook(target);
    const real = fakeExtension();
    target[REDUX_EXTENSION_KEY] = real.extension;
    target[REDUX_EXTENSION_KEY].connect({ name: 'Late' }).send({ type: 'a' }, { a: 1 });
    expect(real.sent).toEqual([['send', { type: 'a' }, { a: 1 }]]);
    expect(target[REDUX_EXTENSION_KEY]()).toBe(real.enhancer);
  });

  it('puts the real extension back when it is removed, and drops what it held', () => {
    const real = fakeExtension();
    const target: Target = { [REDUX_EXTENSION_KEY]: real.extension };
    const hook = installReduxDevtoolsHook(target)!;
    const devtools = target[REDUX_EXTENSION_KEY].connect({});
    devtools.send({ type: 'a' }, { a: 1 });
    uninstallReduxDevtoolsHook(target);
    expect(target[REDUX_EXTENSION_KEY]).toBe(real.extension);
    expect(hook.connections[0].pending).toEqual([]);
    expect(reduxDevtoolsHook(target)).toBeNull();
    // A store that connected keeps reaching the extension.
    devtools.send({ type: 'b' }, { a: 2 });
    expect(real.sent.at(-1)).toEqual(['send', { type: 'b' }, { a: 2 }]);

    const empty: Target = {};
    installReduxDevtoolsHook(empty);
    uninstallReduxDevtoolsHook(empty);
    expect(REDUX_EXTENSION_KEY in empty).toBe(false);
  });

  it('keeps the same hook and connection ids when installed again', () => {
    const target: Target = {};
    const first = installReduxDevtoolsHook(target)!;
    target[REDUX_EXTENSION_KEY].connect({ name: 'A' });
    expect(installReduxDevtoolsHook(target)).toBe(first);
    first.uninstall();
    const second = installReduxDevtoolsHook(target)!;
    target[REDUX_EXTENSION_KEY].connect({ name: 'B' });
    expect(second.connections.map((c) => c.id)).toEqual(['r1', 'r2']);
  });

  it('leaves a property it cannot replace alone', () => {
    const target: Target = {};
    Object.defineProperty(target, REDUX_EXTENSION_KEY, { value: {}, configurable: false });
    expect(installReduxDevtoolsHook(target)).toBeNull();
  });

  it('keeps at most maxPending raw entries and counts the rest', () => {
    const target: Target = {};
    const hook = installReduxDevtoolsHook(target, { maxPending: 3 })!;
    const devtools = target[REDUX_EXTENSION_KEY].connect({});
    for (let i = 0; i < 5; i++) devtools.send({ type: `t${i}` }, { i });
    expect(hook.connections[0].pending.map((e) => e.type)).toEqual(['t2', 't3', 't4']);
    expect(hook.connections[0].dropped).toBe(2);
  });

  it('marks connections closed on unsubscribe and on disconnect', () => {
    const target: Target = {};
    const hook = installReduxDevtoolsHook(target)!;
    const a = target[REDUX_EXTENSION_KEY].connect({ name: 'A' });
    target[REDUX_EXTENSION_KEY].connect({ name: 'B' });
    a.unsubscribe();
    expect(hook.connections.map((c) => c.closed)).toEqual([true, false]);
    target[REDUX_EXTENSION_KEY].disconnect();
    expect(hook.connections.every((c) => c.closed)).toBe(true);
    a.send({ type: 'late' }, {});
    expect(hook.connections[0].pending).toEqual([]);
  });

  it('never lets a broken store value break the store', () => {
    const target: Target = {};
    installReduxDevtoolsHook(target);
    const devtools = target[REDUX_EXTENSION_KEY].connect({});
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('no');
        },
        has() {
          throw new Error('no');
        },
      },
    );
    expect(() => devtools.send(hostile, hostile)).not.toThrow();
  });
});

describe('libraryOf', () => {
  it('names the library from its connect name or its first action', () => {
    expect(libraryOf('NGXS')).toBe('NGXS');
    expect(libraryOf('MiniRx - Redux DevTools')).toBe('MiniRx');
    expect(libraryOf(undefined, { type: '[Todos] - @Init' })).toBe('Elf');
    expect(libraryOf('', { type: 'Add', action: null })).toBe('NGXS');
    expect(libraryOf('My app', { type: 'Add' })).toBeUndefined();
  });

  it('recognizes the @ngrx/store-devtools options', () => {
    expect(isNgrxDevtoolsOptions(NGRX_OPTIONS)).toBe(true);
    expect(isNgrxDevtoolsOptions({ name: 'NGXS' })).toBe(false);
    expect(isNgrxDevtoolsOptions(undefined)).toBe(false);
  });
});
