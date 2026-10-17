// @vitest-environment jsdom
import { isSignal, signal } from '@angular/core';
import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';
import { collectInjectorTree } from '../injector-tree.ts';
import {
  readProviderValue,
  registerProviderValues,
  toProviderValueRequest,
  WHOLE_VALUE,
  type ProviderDebugNg,
} from '../provider-values.ts';
import { createProviderValues, findProvider, providerValueText } from '../rpc/provider-values.ts';
import type { InjectorPage } from '../types.ts';
import { toolAnswer } from './tool-answer.ts';

const API_URL = { _desc: 'API_URL', toString: () => 'InjectionToken API_URL' };
const API_KEY = { _desc: 'API_KEY', toString: () => 'InjectionToken API_KEY' };

class CartService {
  readonly count = signal(2);
  items = [{ id: 1, name: 'Rome' }];
  password = 'hunter2';
  meta = new Map([['a', 1]]);
  add() {}
  get total() {
    throw new Error('getters never run');
  }
}

class LazyService {}
class Other {}

function page() {
  document.body.innerHTML = '<app-root ng-version="22"></app-root>';
  const root = document.querySelector('app-root')!;
  const cart = new CartService();
  const ownGetter = vi.fn(() => 'ran');
  Object.defineProperty(cart, 'secretless', { get: ownGetter, enumerable: true });
  const lazyFactory = vi.fn(() => new LazyService());
  const env = {
    scopes: new Set(['root']),
    records: new Map<unknown, { factory?: unknown; value: unknown }>([
      [CartService, { factory: () => new CartService(), value: cart }],
      // Angular's NOT_YET: an empty object, replaced by the instance on first `get`.
      [LazyService, { factory: lazyFactory, value: {} }],
      [API_URL, { factory: undefined, value: '/api' }],
      [API_KEY, { factory: undefined, value: 'sk-123' }],
    ]),
    get: vi.fn(() => {
      throw new Error('the reader must not call get on an environment injector');
    }),
  };
  const node = { get: vi.fn() };
  const providers = [CartService, LazyService, API_URL, API_KEY, Other].map((token) => ({
    token,
    provider: token,
  }));
  const ng: ProviderDebugNg = {
    getInjector: () => node,
    getComponent: (el: Element) => (el === root ? {} : null),
    getDirectives: () => [],
    isSignal,
    ɵgetInjectorMetadata: (inj: unknown) =>
      inj === env
        ? { type: 'environment', source: 'R3Injector' }
        : { type: 'element', source: root },
    ɵgetInjectorResolutionPath: () => [node, env],
    ɵgetInjectorProviders: (inj: unknown) => (inj === env ? providers : []),
    ɵgetDependenciesFromInjectable: () => ({ dependencies: [] }),
  };
  const report = collectInjectorTree(ng);
  const envId = report.environment[0].injector.id;
  const index = (name: string) =>
    report.environment[0].providers.findIndex((p) => p.token === name);
  const read = (token: string, path: string[] = []) =>
    readProviderValue(ng, { injectorId: envId, token, index: index(token), path });
  return { ng, env, cart, ownGetter, lazyFactory, envId, index, read, report };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('provider value reader', () => {
  it('lists the members of a created service like component properties', () => {
    const { read, ownGetter, env } = page();
    const result = read('CartService');
    expect(result).toMatchObject({ ok: true, token: 'CartService', type: 'CartService' });
    if (!result.ok) throw new Error(result.error);
    const byName = Object.fromEntries(result.members!.map((m) => [m.name, m]));
    expect(byName['count']).toEqual({ name: 'count', kind: 'signal', value: 2 });
    expect(byName['items'].value).toEqual([{ $collapsed: 'Object', size: 2 }]);
    expect(byName['password'].value).toBe('[redacted]');
    expect(byName['meta'].value).toMatchObject({ $type: 'Map', size: 1 });
    // Methods and getters are left out, and a getter never runs.
    expect(byName['add']).toBeUndefined();
    expect(byName['total']).toBeUndefined();
    expect(byName['secretless']).toBeUndefined();
    expect(ownGetter).not.toHaveBeenCalled();
    expect(env.get).not.toHaveBeenCalled();
  });

  it('reads a path inside a member, one level at a time', () => {
    const { read } = page();
    expect(read('CartService', ['items', '0'])).toMatchObject({
      ok: true,
      path: ['items', '0'],
      value: { id: 1, name: 'Rome' },
    });
    expect(read('CartService', ['count'])).toMatchObject({ ok: true, value: 2 });
  });

  it('refuses redacted names, getters and methods on a path', () => {
    const { read, ownGetter } = page();
    expect(read('CartService', ['password'])).toEqual({
      error: '`password` is redacted, so it is not read.',
    });
    expect(read('CartService', ['secretless'])).toEqual({
      error: '`secretless` is a getter, which the devtools never run.',
    });
    expect(read('CartService', ['add'])).toEqual({ error: '`add` is a method, not a value.' });
    expect(read('CartService', ['total'])).toEqual({
      error: '`total` is a getter, which the devtools never run.',
    });
    expect(read('CartService', ['missing'])).toEqual({
      error: 'The value has no member `missing`.',
    });
    expect(ownGetter).not.toHaveBeenCalled();
  });

  it('never creates a provider the injector has not created yet', () => {
    const { read, lazyFactory, env } = page();
    const result = read('LazyService');
    expect(result).toEqual({
      error:
        'LazyService has not been created yet, and reading it would create it. Read it once the app uses it.',
    });
    expect(lazyFactory).not.toHaveBeenCalled();
    expect(env.get).not.toHaveBeenCalled();
  });

  it('shows a value without members whole, and redacts a secret token', () => {
    const { read } = page();
    expect(read('API_URL')).toMatchObject({
      ok: true,
      type: 'string',
      members: [{ name: WHOLE_VALUE, value: '/api' }],
    });
    expect(read('API_URL', [WHOLE_VALUE])).toMatchObject({ ok: true, value: '/api' });
    expect(read('API_KEY')).toMatchObject({
      ok: true,
      members: [{ name: WHOLE_VALUE, value: '[redacted]' }],
    });
  });

  it('refuses a $value path under a secret token, like the members list redacts it', () => {
    const { read } = page();
    const refused = { error: '`API_KEY` is redacted, so its value is not read.' };
    expect(read('API_KEY', [WHOLE_VALUE])).toEqual(refused);
    expect(read('API_KEY', [WHOLE_VALUE, 'length'])).toEqual(refused);
    expect(JSON.stringify(read('API_KEY', [WHOLE_VALUE]))).not.toContain('sk-123');
  });

  it('refuses a provider whose token moved since the tree was reported', () => {
    const { ng, envId, index } = page();
    expect(
      readProviderValue(ng, {
        injectorId: envId,
        token: 'CartService',
        index: index('API_URL'),
        path: [],
      }),
    ).toEqual({ error: 'CartService is no longer provided there. Refresh and try again.' });
    expect(
      readProviderValue(ng, { injectorId: 'inj-gone', token: 'X', index: 0, path: [] }),
    ).toEqual({ error: 'This injector is no longer on the page.' });
  });

  it('checks a request before it reads', () => {
    expect(toProviderValueRequest({ token: 'A', index: 0 })).toMatch(/id of an injector/);
    expect(toProviderValueRequest({ injectorId: 'inj-1', index: 0 })).toMatch(/token name/);
    expect(toProviderValueRequest({ injectorId: 'inj-1', token: 'A', index: -1 })).toMatch(/index/);
    expect(
      toProviderValueRequest({ injectorId: 'inj-1', token: 'A', index: 0, path: [''] }),
    ).toMatch(/path/);
    expect(
      toProviderValueRequest({ injectorId: 'inj-1', token: 'A', index: 0, limit: 5000, depth: 9 }),
    ).toEqual({ injectorId: 'inj-1', token: 'A', index: 0, path: [], limit: 1000, depth: 5 });
  });

  it('answers only the requests for its own page', async () => {
    const { ng, envId, index } = page();
    let handler: ((message: unknown) => void) | undefined;
    const calls: unknown[][] = [];
    const rpc = {
      call: async (...args: unknown[]) => void calls.push(args),
      register: (definition: { handler: (message: never) => unknown }) => {
        handler = definition.handler as (message: unknown) => void;
      },
    };
    registerProviderValues(rpc, 'p1', () => ng);
    const request = { injectorId: envId, token: 'CartService', index: index('CartService') };
    handler!({ requestId: 'r1', pageId: 'p2', request });
    expect(calls).toEqual([]);
    handler!({ requestId: 'r2', pageId: 'p1', request });
    expect(calls[0][0]).toBe('provider-value-result');
    expect(calls[0][1]).toMatchObject({ requestId: 'r2', pageId: 'p1', result: { ok: true } });
  });
});

function injectorPage(): InjectorPage {
  return {
    pageId: 'p1',
    reportedAt: 1,
    roots: [
      {
        injector: {
          id: 'inj-2',
          type: 'element',
          name: 'app-card',
          component: 'Card',
          providerCount: 1,
        },
        providers: [{ token: 'CardState', type: 'class', isViewProvider: false }],
        children: [],
      },
    ],
    environment: [
      {
        injector: { id: 'inj-1', type: 'environment', name: 'Root', providerCount: 2 },
        providers: [
          { token: 'Router', type: 'class', isViewProvider: false },
          { token: 'CartService', type: 'class', isViewProvider: false },
        ],
        children: [],
      },
    ],
  };
}

describe('provider value server', () => {
  it('finds a provider by token and injector name, environment injectors first', () => {
    expect(findProvider(injectorPage(), 'cartservice')).toEqual({
      injectorId: 'inj-1',
      injectorName: 'Root',
      token: 'CartService',
      index: 1,
    });
    expect(findProvider(injectorPage(), 'CardState', '<app-card>')).toMatchObject({
      injectorId: 'inj-2',
      index: 0,
    });
    expect(findProvider(injectorPage(), 'CardState', 'Nowhere')).toMatchObject({
      error: expect.stringMatching(/No injector on page `p1` matches `Nowhere`/),
    });
    expect(findProvider(injectorPage(), 'Missing')).toMatchObject({
      error: expect.stringMatching(/^No injector on page `p1` provides `Missing`/),
    });
  });

  it('settles a read only from the connection that owns the page, and times out', async () => {
    const sent: { requestId: string; pageId: string }[] = [];
    const values = createProviderValues({
      pages: () => [injectorPage()],
      latest: () => injectorPage(),
      broadcast: (_method, message) => void sent.push(message as never),
      answersFor: (target, pageId) => target === pageId,
      timeoutMs: 50,
    });
    expect(await values.request('gone', {})).toMatchObject({
      error: expect.stringMatching(/gone/),
    });
    const pending = values.request('p1', { injectorId: 'inj-1', token: 'CartService', index: 1 });
    values.answer({ requestId: sent[0].requestId, pageId: 'p2', result: { ok: true } });
    values.answer({
      requestId: sent[0].requestId,
      pageId: 'p1',
      result: { ok: true, token: 'CartService', type: 'CartService', path: [], members: [] },
    });
    expect(await pending).toMatchObject({ ok: true, token: 'CartService', members: [] });
    expect(await values.request('p1', { injectorId: 'inj-1', token: 'A', index: 0 })).toMatchObject(
      { error: expect.stringMatching(/did not answer/) },
    );
    expect(values.pendingCount()).toBe(0);
  });

  it('writes the answer as untrusted markdown', () => {
    const target = { injectorId: 'inj-1', injectorName: 'Root', token: 'CartService', index: 1 };
    const text = providerValueText(
      {
        ok: true,
        token: 'CartService',
        type: 'CartService',
        path: [],
        members: [{ name: 'count', kind: 'signal', value: 2 }],
      },
      target,
      'p1',
    );
    expect(text).toContain('come from the running page');
    expect(text).toContain('"count (signal)": 2');
    expect(providerValueText({ error: 'not created yet' }, target, 'p1')).toContain(
      'Could not read `CartService` from Root',
    );
  });

  it('reads a provider through the read-provider-value tool', async () => {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await pangular.setup(ctx as never);
    const { roots, environment } = injectorPage();
    await ctx.rpc.invokeLocal(
      'pangular:push-injector-tree' as never,
      ...([{ pageId: 'p1', roots, environment }] as never),
    );
    const broadcast = vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: {
      method: string;
      args: { requestId: string; pageId: string; request: unknown }[];
    }) => {
      if (!options.method.endsWith('provider-value')) return;
      const { requestId, pageId, request } = options.args[0];
      expect(request).toEqual({
        injectorId: 'inj-1',
        token: 'CartService',
        index: 1,
        path: ['items', '0'],
        limit: 30,
        depth: 1,
      });
      setTimeout(
        () =>
          void ctx.rpc.invokeLocal(
            'pangular:provider-value-result' as never,
            ...([
              {
                requestId,
                pageId,
                result: {
                  ok: true,
                  token: 'CartService',
                  type: 'CartService',
                  path: ['items', '0'],
                  value: { id: 1 },
                },
              },
            ] as never),
          ),
        5,
      );
    }) as never);
    const answer = (await ctx.agent.invoke('pangular:read-provider-value', {
      token: 'CartService',
      path: 'items[0]',
    })) as { markdown: string };
    expect(answer.markdown, answer.markdown).toContain('`items[0]`');
    expect(broadcast).toHaveBeenCalled();
    expect(answer.markdown).toContain('`items[0]` of `CartService` from Root');
    expect(answer.markdown).toContain('"id": 1');
    const bad = await toolAnswer(
      ctx.agent.invoke('pangular:read-provider-value', { token: 'CartService', path: 'a..b' }),
    );
    expect(bad.isError).toBe(true);
    expect(bad.markdown).toMatch(/Pass `path`/);
  });
});
