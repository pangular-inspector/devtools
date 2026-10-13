// No DOM here on purpose: the native overlays run where there is no
// `document`, `window` or `location`.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addProfilerListener, type Profiler } from '../change-detection.ts';
import { resolvePangularConfig } from '../config.ts';
import { elementId } from '../element-id.ts';
import {
  NATIVE_STARTUP_NOTE,
  attachNativeDiagnostics,
  createTreeDirty,
  errorUtilsTarget,
  hostAngularVersion,
} from '../native-diagnostics.ts';
import { angularNativeTree, type AngularNativeNode } from '../overlay-angular-native-views.ts';
import { registerPangularPlugin } from '../plugin.ts';
import {
  REDUX_EXTENSION_KEY,
  installReduxDevtoolsHook,
  uninstallReduxDevtoolsHook,
} from '../redux-devtools-hook.ts';
import { QueryClient } from '@tanstack/query-core';

const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');

interface FakeNode {
  kind: string;
  name: string;
  children: FakeNode[];
  parent: FakeNode | null;
  props: Record<string, unknown>;
}

function el(name: string, children: FakeNode[] = []): FakeNode {
  const node: FakeNode = { kind: 'element', name, children, parent: null, props: {} };
  for (const child of children) child.parent = node;
  return node;
}

class App {}
class Row {}
class ErrorHandler {
  handleError(error: unknown) {
    return error;
  }
}
class ApplicationRef {
  tick() {}
  isStable = {
    subscribe: (fn: (value: boolean) => void) => {
      fn(true);
      return { unsubscribe() {} };
    },
  };
}
Object.assign(App, { ɵcmp: { selectors: [['app-root']] } });
Object.assign(Row, { ɵcmp: { selectors: [['app-row']] } });

/**
 * An Angular Native app: root(app-root) > view > [app-row, app-row], with a
 * fake `ng` that answers through the nodes, a zoneless scheduler on the
 * environment injector and one profiler slot.
 */
function fixture(
  options: { providers?: boolean; version?: string; records?: [unknown, unknown][] } = {},
) {
  const first = el('app-row', [el('text')]);
  const second = el('app-row', [el('text')]);
  const list = el('view', [first, second]);
  const root = el('root', [list]);
  root.props['ng-version'] = options.version ?? '22.1.0';
  const app = new App();
  const rows = [new Row(), new Row()];
  const components = new Map<object, object>([
    [root, app],
    [first, rows[0]!],
    [second, rows[1]!],
  ]);
  const hosts = new Map([...components].map(([host, instance]) => [instance, host]));
  const handler = new ErrorHandler();
  const appRef = new ApplicationRef();
  const scheduler = { notify: vi.fn(), runningTick: false, appRef };
  const env = {
    records: new Map<unknown, { value: unknown }>([
      [Symbol('scheduler'), { value: scheduler }],
      ...(options.records ?? []).map(([token, value]): [unknown, { value: unknown }] => [
        token,
        { value },
      ]),
    ]),
    scopes: new Set(['root']),
  };
  const injector = (host: object) => ({
    host,
    get: (token: unknown) =>
      token === ErrorHandler ? handler : token === ApplicationRef ? appRef : null,
  });
  let profiler: Profiler | null = null;
  const ng = {
    getComponent: (host: object) => components.get(host) ?? null,
    getHostElement: (instance: object) => hosts.get(instance) ?? null,
    getOwningComponent: (host: object) => components.get(host) ?? null,
    getInjector: (host: object) => injector(host),
    getDirectiveMetadata: () => ({ inputs: {}, changeDetection: 0 }),
    ɵgetInjectorResolutionPath: (inj: unknown) => [inj, env],
    ...(options.providers
      ? {
          ɵgetInjectorProviders: (inj: unknown) =>
            inj === env ? [{ token: ErrorHandler }, { token: ApplicationRef }] : [],
        }
      : {}),
    ɵsetProfiler: vi.fn((next: Profiler | null) => {
      profiler = next;
      return () => {
        if (profiler === next) profiler = null;
      };
    }),
  };
  const tree = angularNativeTree(
    () => root as unknown as AngularNativeNode,
    () => ng as never,
  );
  return {
    root,
    first,
    second,
    list,
    app,
    rows,
    ng,
    tree,
    handler,
    scheduler,
    fire: (event: number, instance?: object) => profiler?.(event, instance),
  };
}

function fakeRpc() {
  const calls: [string, Record<string, unknown>][] = [];
  const handlers = new Map<string, (message: unknown) => unknown>();
  const my = {
    rpc: {
      call: vi.fn(async (name: string, payload?: unknown) => {
        calls.push([name, payload as Record<string, unknown>]);
        return undefined;
      }),
      register: (definition: { name: string; handler: (message: unknown) => unknown }) =>
        handlers.set(definition.name, definition.handler),
    },
  };
  const sent = (name: string) => calls.filter(([each]) => each === name).map(([, p]) => p);
  return { my, calls, handlers, sent };
}

function attach(
  f: ReturnType<typeof fixture>,
  inspectors: Record<string, boolean> = {},
): ReturnType<typeof fakeRpc> & { diagnostics: ReturnType<typeof attachNativeDiagnostics> } {
  const rpc = fakeRpc();
  const diagnostics = attachNativeDiagnostics(rpc.my, 'n1', {
    getNg: () => f.ng,
    tree: f.tree,
    config: resolvePangularConfig({ inspectors }),
    tickMs: () => 3000,
    describe: () => ({ url: '/', title: 'Angular Native' }),
  });
  attached.push(diagnostics);
  return { ...rpc, diagnostics };
}

const attached: ReturnType<typeof attachNativeDiagnostics>[] = [];

async function pushAll(diagnostics: ReturnType<typeof attachNativeDiagnostics>) {
  for (const collect of diagnostics.collectors) await collect();
}

afterEach(() => {
  for (const diagnostics of attached.splice(0)) diagnostics.stop();
  vi.restoreAllMocks();
});

describe('hostAngularVersion', () => {
  it('reads the version a native renderer left as a prop, an attribute or a property', () => {
    expect(hostAngularVersion({ props: { 'ng-version': '22.1.0' } })).toBe('22.1.0');
    expect(hostAngularVersion({ getAttribute: () => '21.0.3' })).toBe('21.0.3');
    expect(hostAngularVersion({ 'ng-version': '20.2.1' })).toBe('20.2.1');
    expect(hostAngularVersion({ props: { 'ng-version': 'latest' } })).toBeUndefined();
    expect(hostAngularVersion(null)).toBeUndefined();
  });
});

describe('the profiler gate without a DOM', () => {
  it('tries the slot on an app of unknown version and gives it back without a remover', () => {
    const setProfiler = vi.fn(() => undefined);
    const ng = { ɵsetProfiler: setProfiler };
    expect(addProfilerListener(ng, () => {}, { major: 0, alone: true })).toBeNull();
    expect(setProfiler).toHaveBeenCalledTimes(2);
    expect(setProfiler).toHaveBeenLastCalledWith(null);
  });

  it('leaves the slot alone when it may be shared or Angular is older than 20', () => {
    const setProfiler = vi.fn(() => () => {});
    expect(addProfilerListener({ ɵsetProfiler: setProfiler }, () => {}, { major: 0 })).toBeNull();
    expect(
      addProfilerListener({ ɵsetProfiler: setProfiler }, () => {}, { major: 19, alone: true }),
    ).toBeNull();
    expect(setProfiler).not.toHaveBeenCalled();
  });
});

describe('native diagnostics', () => {
  it('records change detection with host ids from the tree and the scheduler from its roots', async () => {
    const f = fixture();
    const { diagnostics, handlers, sent } = attach(f);
    handlers.get('change-detection-record')!({ pageId: 'n1', on: true });
    expect(f.ng.ɵsetProfiler).toHaveBeenCalled();
    // A template listener asked for the tick.
    f.scheduler.notify(5);
    f.fire(12);
    f.fire(18, f.rows[0]);
    f.fire(2, f.rows[0]);
    f.fire(19, f.rows[0]);
    f.fire(13);
    await diagnostics.collectors[0]!();
    const report = sent('push-change-detection').at(-1)!;
    expect(report['pageId']).toBe('n1');
    expect(report['supported']).toBe(true);
    expect(report['hosts']).toEqual({ [elementId(f.first)]: 1 });
    expect(report['options']).toBeUndefined();
    expect(report['diagnosis']).toMatchObject({ triggers: true, waste: false, major: 22 });
  });

  it('ignores change detection requests for another page', () => {
    const f = fixture();
    const { handlers } = attach(f);
    handlers.get('change-detection-record')!({ pageId: 'other', on: true });
    expect(f.ng.ɵsetProfiler).not.toHaveBeenCalled();
  });

  it('lists live and destroyed components, and walks again only when the tree changed', async () => {
    const f = fixture();
    const { diagnostics, sent } = attach(f);
    await pushAll(diagnostics);
    const first = sent('push-leaks').at(-1)!;
    expect(first).toMatchObject({ pageId: 'n1', url: '/', title: 'Angular Native' });
    expect(first['totals']).toMatchObject({ components: 3, destroyed: 0 });
    expect(first['support']).not.toHaveProperty('detached');

    // The row leaves the view, but something still holds its instance.
    f.list.children.splice(1, 1);
    await pushAll(diagnostics);
    expect(sent('push-leaks')).toHaveLength(1);

    diagnostics.treeChanged();
    await pushAll(diagnostics);
    const after = sent('push-leaks').at(-1)!;
    expect(after['totals']).toMatchObject({ components: 2, destroyed: 1 });
    expect(after['destroyed']).toEqual([expect.objectContaining({ name: 'Row' })]);
    expect(f.rows[1]).toBeDefined();
  });

  it('reports errors and the console with the page id, the owner from the tree and masked text', async () => {
    const f = fixture({ providers: true });
    // Before the collector taps the console, so the tap wraps the stand-in.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { diagnostics, sent } = attach(f);
    await pushAll(diagnostics);
    expect(sent('push-errors')[0]).toMatchObject({
      pageId: 'n1',
      url: '/',
      title: 'Angular Native',
      handler: 'wrapped',
    });

    console.warn(`token Bearer ${JWT}`);
    f.handler.handleError(
      new Error(
        "NG0100: ExpressionChangedAfterItHasBeenCheckedError: Expression has changed after it was checked. Previous value: '1'. Current value: '2'. Expression location: Row component.",
      ),
    );
    await diagnostics.collectors[2]!();
    await vi.waitFor(() => expect(sent('push-errors').length).toBeGreaterThan(1));
    const reports = sent('push-errors');
    const errors = reports.flatMap((report) => report['errors'] as Record<string, unknown>[]);
    const group = errors.find((each) => each['code'] === 'NG0100')!;
    expect(group['owner']).toEqual({ id: elementId(f.first), name: 'Row' });
    expect(group['explain']).toMatchObject({ kind: 'expression-changed' });
    const lines = reports.flatMap((report) => report['console'] as { text: string }[]);
    expect(lines.some((line) => line.text.includes('token'))).toBe(true);
    expect(JSON.stringify(lines)).not.toContain(JWT);
  });

  it('skips an unchanged errors report until a keepalive is due', async () => {
    const f = fixture({ providers: true });
    const { diagnostics, sent } = attach(f, { components: false });
    await pushAll(diagnostics);
    await pushAll(diagnostics);
    expect(sent('push-errors')).toHaveLength(1);
  });

  it('reports the first stable state and why provider times are missing', async () => {
    const f = fixture({ providers: true });
    const { diagnostics, sent } = attach(f);
    await pushAll(diagnostics);
    await vi.waitFor(() => expect(sent('push-startup').at(-1)?.['firstStable']).toBeDefined());
    expect(sent('push-startup').at(-1)).toMatchObject({
      pageId: 'n1',
      url: '/',
      title: 'Angular Native',
      angularVersion: '22.1.0',
      hook: false,
      providers: { status: 'unavailable', note: NATIVE_STARTUP_NOTE },
    });
    expect(sent('report-page-angular').at(-1)).toMatchObject({ pageId: 'n1', version: '22.1.0' });
  });

  it('answers provider value requests for its own page only', async () => {
    const f = fixture();
    const { handlers, sent } = attach(f);
    const request = { injectorId: 'i-gone', token: 'TripStore', index: 0, path: [] };
    handlers.get('provider-value')!({ requestId: 'r1', pageId: 'other', request });
    handlers.get('provider-value')!({ requestId: 'r2', pageId: 'n1', request });
    await vi.waitFor(() => expect(sent('provider-value-result')).toHaveLength(1));
    expect(sent('provider-value-result')[0]).toMatchObject({
      requestId: 'r2',
      pageId: 'n1',
      result: { error: expect.stringContaining('no longer on the page') },
    });
  });

  it('collects nothing for inspectors the config turns off', async () => {
    const f = fixture();
    const { diagnostics, handlers, calls } = attach(f, {
      components: false,
      errors: false,
      injectors: false,
      ngrx: false,
      tanstackQuery: false,
      plugins: false,
    });
    await pushAll(diagnostics);
    expect(calls.map(([name]) => name)).toEqual(['report-page-angular']);
    expect(handlers.has('change-detection-record')).toBe(false);
    expect(handlers.has('provider-value')).toBe(false);
  });

  it('forgets every report it sent when the app leaves, and puts the console back', async () => {
    const f = fixture();
    const before = console.error;
    const { diagnostics, calls } = attach(f);
    expect(console.error).not.toBe(before);
    calls.length = 0;
    diagnostics.leave();
    diagnostics.stop();
    expect(console.error).toBe(before);
    expect(calls.map(([name]) => name)).toEqual(
      expect.arrayContaining([
        'forget-change-detection-page',
        'forget-leaks-page',
        'forget-errors-page',
        'forget-startup-page',
        'forget-tanstack-query-page',
        'forget-redux-stores-page',
        'forget-page-angular',
      ]),
    );
    for (const [, pageId] of calls) expect(pageId).toBe('n1');
  });
});

describe('stores, queries and plugins on a native page', () => {
  it('reports NGXS, Elf and MiniRx stores through the Redux DevTools stand-in', async () => {
    installReduxDevtoolsHook();
    try {
      const f = fixture();
      const { diagnostics, sent } = attach(f);
      const extension = (globalThis as unknown as Record<string, { connect: Function }>)[
        REDUX_EXTENSION_KEY
      ]!;
      const devtools = extension.connect({ name: 'Trips' });
      devtools.init({ booked: [] });
      devtools.send({ type: 'book' }, { booked: [1] });
      await pushAll(diagnostics);
      expect(sent('push-redux-stores').at(-1)).toMatchObject({
        pageId: 'n1',
        url: '/',
        title: 'Angular Native',
        stores: [expect.objectContaining({ name: 'Trips' })],
      });
    } finally {
      uninstallReduxDevtoolsHook();
    }
  });

  it('reads the QueryClient through the tree roots', async () => {
    const client = new QueryClient();
    client.mount();
    try {
      client.setQueryData(['trips'], [1, 2]);
      const f = fixture({ records: [[class QueryClient {}, client]] });
      const { diagnostics, sent } = attach(f);
      await pushAll(diagnostics);
      const report = sent('push-tanstack-query').at(-1)!;
      expect(report).toMatchObject({ pageId: 'n1', url: '/', title: 'Angular Native' });
      expect(report['clients']).toEqual([expect.objectContaining({ scope: 'root', queries: 1 })]);
      expect(JSON.stringify(report['queries'])).toContain('trips');
    } finally {
      client.clear();
      client.unmount();
    }
  });

  it("runs the app's page plugins", async () => {
    const unregister = registerPangularPlugin({
      id: 'trips',
      version: '1',
      collect: () => ({ sections: [{ kind: 'stats', items: [{ label: 'Booked', value: 2 }] }] }),
    } as never);
    try {
      const f = fixture();
      const { diagnostics, sent } = attach(f);
      await vi.waitFor(async () => {
        await pushAll(diagnostics);
        expect(sent('push-plugins').length).toBeGreaterThan(0);
      });
      expect(sent('push-plugins').at(-1)).toMatchObject({
        pageId: 'n1',
        url: '/',
        title: 'Angular Native',
        plugins: [expect.objectContaining({ id: 'trips' })],
      });
    } finally {
      unregister();
    }
  });
});

describe('createTreeDirty', () => {
  it('reads again when bumped, forced or past the heartbeat', () => {
    let now = 0;
    const dirty = createTreeDirty(1000, () => now);
    const read = vi.fn(() => now);
    const cached = dirty.cached(read);
    cached();
    cached();
    expect(read).toHaveBeenCalledTimes(1);
    dirty.bump();
    cached();
    cached(true);
    now = 1500;
    cached();
    expect(read).toHaveBeenCalledTimes(4);
  });
});

describe('errorUtilsTarget', () => {
  it("hears React Native's global errors, keeps the app's handler and puts it back", () => {
    const appHandler = vi.fn();
    let current: ((error: unknown, isFatal?: boolean) => void) | undefined = appHandler;
    const utils = {
      getGlobalHandler: () => current,
      setGlobalHandler: (next: (error: unknown, isFatal?: boolean) => void) => {
        current = next;
      },
    };
    const target = errorUtilsTarget(utils)!;
    const heard: unknown[] = [];
    const listener = (event: Event) => heard.push((event as ErrorEvent).error);
    target.addEventListener('error', listener);
    const boom = new Error('boom');
    current!(boom, true);
    expect(heard).toEqual([boom]);
    expect(appHandler).toHaveBeenCalledWith(boom, true);
    target.removeEventListener('error', listener);
    expect(current).toBe(appHandler);
  });

  it('is undefined without ErrorUtils', () => {
    expect(errorUtilsTarget(undefined)).toBeUndefined();
  });
});
