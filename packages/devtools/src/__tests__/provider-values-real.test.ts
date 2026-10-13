// @vitest-environment jsdom
import '@angular/compiler';
import * as core from '@angular/core';
import { Component, Injectable } from '@angular/core';
import { afterEach, describe, expect, it } from 'vitest';
import { collectInjectorTree } from '../injector-tree.ts';
import { readProviderValue, type ProviderDebugNg } from '../provider-values.ts';
import type { InjectorTreeNode } from '../types.ts';
import { angularAtLeast, bootstrapRoot, STANDALONE, type BootedApp } from './angular-version.ts';

const created = { lazy: 0, cart: 0, card: 0, helper: 0 };
const signalFn = (core as unknown as { signal?: <T>(value: T) => () => T }).signal;

class LazyService {
  constructor() {
    created.lazy++;
  }
}
Injectable()(LazyService);

class CartService {
  readonly count = signalFn ? signalFn(3) : 3;
  items = ['rome'];
  token = 'abc';
  constructor() {
    created.cart++;
  }
}
Injectable({ providedIn: 'root' })(CartService);

class CardState {
  open = true;
  constructor() {
    created.card++;
  }
}
Injectable()(CardState);

class CardHelper {
  constructor() {
    created.helper++;
  }
}
Injectable()(CardHelper);

// Constructor injection, as the CLI compiles it, so the classes work before inject() (14.0).
class TripCard {
  constructor(
    readonly state: CardState,
    readonly cart: CartService,
  ) {}
}
(TripCard as unknown as { ctorParameters: () => unknown[] }).ctorParameters = () => [
  { type: CardState },
  { type: CartService },
];
Component({
  ...STANDALONE,
  selector: 'app-trip-card',
  template: 'card',
  providers: [CardState, CardHelper],
})(TripCard);

class TripPage {}
Component({
  ...STANDALONE,
  selector: 'app-root',
  imports: [TripCard],
  template: '<app-trip-card></app-trip-card>',
})(TripPage);

const flatten = (nodes: InjectorTreeNode[]): InjectorTreeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

describe.runIf(angularAtLeast('16.2'))('provider values with a real app', () => {
  let app: BootedApp | null = null;
  afterEach(() => {
    app?.destroy();
    app = null;
    document.body.innerHTML = '';
  });

  it('reads created services and never creates one that is still waiting', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapRoot(TripPage, { declarations: [TripCard], providers: [LazyService] });
    app.appRef.tick();
    const before = { ...created };

    const ng = (globalThis as { ng?: ProviderDebugNg }).ng!;
    const report = collectInjectorTree(ng);
    const all = [...flatten(report.environment), ...flatten(report.roots)];
    const find = (token: string) => {
      for (const node of all) {
        const index = node.providers.findIndex((p) => p.token === token);
        if (index >= 0) return { injectorId: node.injector.id, token, index, path: [] };
      }
      throw new Error(`${token} is not in the injector tree`);
    };

    // The app lists LazyService, but nothing injected it: Angular's record holds NOT_YET.
    expect(readProviderValue(ng, find('LazyService'))).toMatchObject({
      error: expect.stringMatching(/has not been created yet/),
    });
    // The card provides CardHelper, but nothing injected it.
    expect(readProviderValue(ng, find('CardHelper'))).toMatchObject({
      error: expect.stringMatching(/Nothing on the page has injected CardHelper/),
    });
    expect(created).toEqual(before);
    expect(created.lazy).toBe(0);
    expect(created.helper).toBe(0);

    const cart = readProviderValue(ng, find('CartService'));
    if (!cart.ok) throw new Error(cart.error);
    const members = Object.fromEntries(cart.members!.map((m) => [m.name, m]));
    expect(members['items'].value).toEqual(['rome']);
    expect(members['token'].value).toBe('[redacted]');
    if (signalFn) expect(members['count']).toEqual({ name: 'count', kind: 'signal', value: 3 });

    expect(readProviderValue(ng, find('CardState'))).toMatchObject({
      ok: true,
      type: 'CardState',
      members: [{ name: 'open', value: true }],
    });
    expect(created).toEqual(before);
  });
});
