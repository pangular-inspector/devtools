// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { registerInjectorRefresh } from '../injector-refresh.ts';
import { collectInjectorTree } from '../injector-tree.ts';
import { requestInjectorRefresh } from '../rpc/injector-refresh.ts';
import { sanitizeInjectorTree } from '../rpc/injector-report.ts';

class Card {}

function page() {
  document.body.innerHTML = '<app-card></app-card>';
  const card = document.querySelector('app-card')!;
  const env = { kind: 'env', scopes: new Set(['root']) };
  let reads = 0;
  const ng = {
    getInjector: (el: Element) => ({ kind: 'node', el }),
    getComponent: (el: Element) => (el === card ? new Card() : null),
    getDirectives: (el: Element) => (el === card ? [new Card()] : []),
    ɵgetInjectorMetadata: (inj: { kind: string; el?: Element }) =>
      inj.kind === 'node'
        ? { type: 'element', source: inj.el }
        : { type: 'environment', source: 'R' },
    ɵgetInjectorResolutionPath: (inj: unknown) => [inj, env],
    ɵgetInjectorProviders: (inj: { kind: string }) => {
      if (inj.kind === 'node') reads++;
      return [];
    },
  };
  return { ng, reads: () => reads };
}

function fakeRpc() {
  const handlers = new Map<string, (message: never) => unknown>();
  return {
    register: (definition: { name: string; handler: (message: never) => unknown }) =>
      void handlers.set(definition.name, definition.handler),
    send: (name: string, message: unknown) => handlers.get(name)!(message as never),
  };
}

describe('injector refresh on the page', () => {
  it('forgets the selected element and pushes a fresh tree', async () => {
    const { ng, reads } = page();
    const id = collectInjectorTree(ng as never).roots[0].injector.id;
    const rpc = fakeRpc();
    const push = vi.fn(() => collectInjectorTree(ng as never));
    registerInjectorRefresh(rpc, 'p1', push);

    rpc.send('injector-refresh', { pageId: 'other', injectorId: id });
    rpc.send('injector-refresh', { pageId: 'p1', injectorId: 42 });
    rpc.send('injector-refresh', { pageId: 'p1', injectorId: 'inj-unknown' });
    await Promise.resolve();
    expect(push).not.toHaveBeenCalled();

    const before = reads();
    rpc.send('injector-refresh', { pageId: 'p1', injectorId: id });
    await vi.waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(reads()).toBe(before + 1);

    rpc.send('injector-refresh', { pageId: 'p1' });
    await vi.waitFor(() => expect(push).toHaveBeenCalledTimes(2));
    expect(reads()).toBe(before + 2);
  });
});

describe('request-injector-refresh', () => {
  it('sends the refresh to a page that reported a tree', () => {
    const broadcast = vi.fn();
    expect(
      requestInjectorRefresh({ pageId: 'p1', injectorId: 'inj-3' }, ['p1'], broadcast),
    ).toEqual({ ok: true });
    expect(broadcast).toHaveBeenLastCalledWith('injector-refresh', {
      pageId: 'p1',
      injectorId: 'inj-3',
    });
    expect(requestInjectorRefresh({ pageId: 'p1' }, ['p1'], broadcast)).toEqual({ ok: true });
    expect(broadcast).toHaveBeenLastCalledWith('injector-refresh', { pageId: 'p1' });
  });

  it('refuses a request without a known page or with a bad id', () => {
    const broadcast = vi.fn();
    expect(requestInjectorRefresh(null, ['p1'], broadcast).ok).toBe(false);
    expect(requestInjectorRefresh({ pageId: 'p2' }, ['p1'], broadcast).ok).toBe(false);
    expect(
      requestInjectorRefresh({ pageId: 'p1', injectorId: 'x'.repeat(101) }, ['p1'], broadcast).ok,
    ).toBe(false);
    expect(requestInjectorRefresh({ pageId: 'p1', injectorId: 7 }, ['p1'], broadcast).ok).toBe(
      false,
    );
    expect(broadcast).not.toHaveBeenCalled();
  });
});

describe('inactive environment injectors in a report', () => {
  it('keeps the inactive flag through the server check', () => {
    const node = {
      injector: {
        id: 'inj-1',
        type: 'environment',
        name: 'Route: admin',
        providerCount: 0,
        inactive: true,
      },
      providers: [],
      children: [],
    };
    expect(sanitizeInjectorTree([], [node]).environment[0].injector.inactive).toBe(true);
  });
});
