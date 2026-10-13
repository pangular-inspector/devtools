// @vitest-environment jsdom
import '@angular/compiler';
import { Component, Inject, Injectable, InjectionToken } from '@angular/core';
import { afterEach, describe, expect, it } from 'vitest';
import { collectInjectorTree, type DebugNg } from '../injector-tree.ts';
import type { InjectorTreeNode } from '../types.ts';
import { angularAtLeast, bootstrapRoot, STANDALONE, type BootedApp } from './angular-version.ts';

const API_URL = new InjectionToken<string>('API_URL');

// Constructor injection, as the CLI compiles it, so the classes work before inject() (14.0).
class TripStore {
  constructor(readonly api: string) {}
}
Injectable({ providedIn: 'root' })(TripStore);
(TripStore as unknown as { ctorParameters: () => unknown[] }).ctorParameters = () => [
  { type: String, decorators: [{ type: Inject, args: [API_URL] }] },
];

class CardState {}
Injectable()(CardState);

class TripCard {
  constructor(
    readonly state: CardState,
    readonly store: TripStore,
  ) {}
}
(TripCard as unknown as { ctorParameters: () => unknown[] }).ctorParameters = () => [
  { type: CardState },
  { type: TripStore },
];
Component({ ...STANDALONE, selector: 'app-trip-card', template: 'card', providers: [CardState] })(
  TripCard,
);

class TripPage {}
Component({
  ...STANDALONE,
  selector: 'app-root',
  imports: [TripCard],
  template: '<app-trip-card></app-trip-card>',
})(TripPage);

const flatten = (nodes: InjectorTreeNode[]): InjectorTreeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

describe('collectInjectorTree with a real app', () => {
  let app: BootedApp | null = null;
  afterEach(() => {
    app?.destroy();
    app = null;
    document.body.innerHTML = '';
  });

  it('reads element and environment injectors through the private injector utils', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapRoot(TripPage, {
      declarations: [TripCard],
      providers: [{ provide: API_URL, useValue: '/api' }],
    });
    app.appRef.tick();

    const ng = (globalThis as { ng?: DebugNg }).ng!;
    const report = collectInjectorTree(ng);
    const elements = flatten(report.roots);
    const card = elements.find((n) => n.injector.component === 'TripCard');
    const page = elements.find((n) => n.injector.component === 'TripPage');
    expect(card?.injector.type).toBe('element');
    expect(page?.children).toContain(card);
    if (!angularAtLeast('16.2')) {
      // Before 16.2 there are no provider or resolution path utils: element
      // injectors with their components only.
      expect(ng.ɵgetInjectorProviders).toBeUndefined();
      expect(card?.providers).toEqual([]);
      expect(card?.injector.path).toEqual([]);
      expect(card?.dependencies ?? []).toEqual([]);
      expect(report.environment).toEqual([]);
      return;
    }
    expect(typeof ng.ɵgetInjectorProviders).toBe('function');
    expect(typeof ng.ɵgetInjectorResolutionPath).toBe('function');
    expect(card?.providers).toContainEqual(
      expect.objectContaining({ token: 'CardState', type: 'class' }),
    );
    expect(card?.providers.map((p) => p.token)).not.toContain('ElementRef');
    expect(card?.injector.path?.slice(0, 2)).toEqual([card?.injector.id, page?.injector.id]);
    expect(card?.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'TripCard',
          token: 'CardState',
          providedBy: card?.injector.id,
        }),
        expect.objectContaining({ from: 'TripCard', token: 'TripStore' }),
      ]),
    );

    const environments = flatten(report.environment);
    expect(environments.length).toBeGreaterThan(0);
    expect(environments.every((n) => n.injector.type === 'environment')).toBe(true);
    const tokens = environments.flatMap((n) => n.providers.map((p) => p.token));
    expect(tokens).toContain('API_URL');
  });
});
