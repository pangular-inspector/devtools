// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { domTree } from '../host-tree.ts';
import { safeArgs, secretParams, touchesSecret } from '../ngrx-args.ts';
import { createNgrxCollector } from '../ngrx-collector.ts';

const SIGNAL = Symbol('SIGNAL');
const STATE_SOURCE = Symbol('STATE_SOURCE');

function writable<T>(initial: T) {
  const node = { value: initial };
  const getter = (() => node.value) as (() => T) & {
    set(v: T): void;
    update(fn: (v: T) => T): void;
  };
  (getter as unknown as Record<symbol, unknown>)[SIGNAL] = node;
  getter.set = (v: T) => {
    node.value = v;
  };
  getter.update = (fn: (v: T) => T) => {
    node.value = fn(node.value);
  };
  return getter;
}

type Store = Record<PropertyKey, any>;

function patchState(store: Store, patch: Record<string, unknown>) {
  for (const [key, value] of Object.entries(patch)) store[STATE_SOURCE][key].set(value);
}

class AuthStore {
  [STATE_SOURCE] = {
    user: writable(''),
    accessToken: writable('tok-initial-1'),
    session: writable({ id: 1, refreshToken: 'ref-initial-1' }),
  };
  rotate = (next: string) => patchState(this, { accessToken: next });
  login = (email: string, password: string) =>
    patchState(this, { user: `${email}:${password.length}` });
  renew = (value: string) => patchState(this, { session: { id: 2, refreshToken: value } });
  note = (text: string) => patchState(this, { user: text });
}

function setup() {
  document.body.innerHTML = '<app-root ng-version="22"></app-root>';
  const root = document.querySelector('app-root')!;
  const store = new AuthStore() as unknown as Store;
  const app = { store };
  const rootEnv = {
    scopes: new Set(['root']),
    records: new Map<unknown, { value: unknown }>([[AuthStore, { value: store }]]),
    get: () => null,
  };
  const node = { el: root, get: () => null };
  const ng = {
    getInjector: () => node,
    getComponent: (el: Element) => (el === root ? app : null),
    ɵgetInjectorMetadata: (inj: unknown) =>
      inj === rootEnv ? { type: 'environment', source: 'R3Injector' } : { type: 'element' },
    ɵgetInjectorResolutionPath: () => [node, rootEnv],
    ɵgetInjectorProviders: () => [],
  };
  const collector = createNgrxCollector(() => ng as never, vi.fn(), domTree());
  collector.collect();
  return { store, collector };
}

const argsOf = (collector: ReturnType<typeof setup>['collector'], type: string) =>
  collector.logSince(0).find((entry) => entry.type === type)?.args;

describe('signal store method arguments', () => {
  it('reads secret parameter names from the method source', () => {
    expect(secretParams((email: string, password: string) => [email, password])).toEqual([
      null,
      'password',
    ]);
    expect(
      secretParams(function login(user: string, { token }: { token: string }) {
        return [user, token];
      }),
    ).toEqual([null, 'token']);
    expect(secretParams((apiKey: string) => apiKey)).toEqual(['apiKey']);
    expect(secretParams((query: string, page = 1) => [query, page])).toEqual([null, null]);
    expect(secretParams(null)).toEqual([]);
  });

  it('masks every argument of a call that writes a secret state key', () => {
    const { store, collector } = setup();
    store['rotate']('tok-NEXT-42');
    expect(argsOf(collector, 'rotate')).toEqual(['[redacted]']);
    expect(JSON.stringify(collector.logSince(0))).not.toContain('tok-NEXT-42');
  });

  it('masks every argument of a call that writes a nested secret key', () => {
    const { store, collector } = setup();
    store['renew']('ref-NEXT-42');
    expect(argsOf(collector, 'renew')).toEqual(['[redacted]']);
  });

  it('masks an argument by its secret parameter name', () => {
    const { store, collector } = setup();
    store['login']('ada@example.com', 'hunter2-pw');
    expect(argsOf(collector, 'login')).toEqual(['ada@example.com', '[redacted]']);
  });

  it('hides secret state values and token text inside other arguments', () => {
    const { store, collector } = setup();
    store['note']('the old token was tok-initial-1, retry with token=abc123');
    const [text] = argsOf(collector, 'note') as string[];
    expect(text).not.toContain('tok-initial-1');
    expect(text).not.toContain('abc123');
    expect(text).toContain('the old token was');
  });

  it('keeps masking a method that wrote a secret before', () => {
    const rotate = (next: string) => next;
    const before = { accessToken: 'a-1-x' };
    const after = { accessToken: 'b-2-y' };
    expect(
      safeArgs(['b-2-y'], (v) => v, { method: rotate, before, after, keys: ['accessToken'] }),
    ).toEqual(['[redacted]']);
    expect(safeArgs(['plain'], (v) => v, { method: rotate })).toEqual(['[redacted]']);
    expect(safeArgs(['plain'], (v) => v, { method: (other: string) => other })).toEqual(['plain']);
  });

  it('tells a secret write from a harmless one', () => {
    const keys = ['user', 'auth'];
    expect(touchesSecret({ user: 'a', auth: null }, { user: 'b', auth: null }, keys)).toBe(false);
    expect(
      touchesSecret(
        { user: 'a', auth: { token: 'x-1-y' } },
        { user: 'a', auth: { token: 'z-2-w' } },
        keys,
      ),
    ).toBe(true);
  });
});
