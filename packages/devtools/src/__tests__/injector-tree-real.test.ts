// @vitest-environment jsdom
import '@angular/compiler';
import {
  Component,
  Injectable,
  InjectionToken,
  inject,
  provideZonelessChangeDetection,
  type ApplicationRef,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { afterEach, describe, expect, it } from 'vitest';
import { collectInjectorTree, type DebugNg } from '../injector-tree.ts';
import type { InjectorTreeNode } from '../types.ts';

const API_URL = new InjectionToken<string>('API_URL');

class TripStore {
  readonly api = inject(API_URL);
}
Injectable({ providedIn: 'root' })(TripStore);

class CardState {}
Injectable()(CardState);

class TripCard {
  readonly state = inject(CardState);
  readonly store = inject(TripStore);
}
Component({ selector: 'app-trip-card', template: 'card', providers: [CardState] })(TripCard);

class TripPage {}
Component({
  selector: 'app-root',
  imports: [TripCard],
  template: '<app-trip-card />',
})(TripPage);

const flatten = (nodes: InjectorTreeNode[]): InjectorTreeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

describe('collectInjectorTree with a real app', () => {
  let app: ApplicationRef | null = null;
  afterEach(() => {
    app?.destroy();
    app = null;
    document.body.innerHTML = '';
  });

  it('reads element and environment injectors through the private injector utils', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(TripPage, {
      providers: [provideZonelessChangeDetection(), { provide: API_URL, useValue: '/api' }],
    });
    app.tick();

    const ng = (globalThis as { ng?: DebugNg }).ng!;
    expect(typeof ng.ɵgetInjectorProviders).toBe('function');
    expect(typeof ng.ɵgetInjectorResolutionPath).toBe('function');
    const report = collectInjectorTree(ng);

    const elements = flatten(report.roots);
    const card = elements.find((n) => n.injector.component === 'TripCard');
    expect(card?.injector.type).toBe('element');
    expect(card?.providers).toContainEqual(
      expect.objectContaining({ token: 'CardState', type: 'class' }),
    );
    expect(card?.providers.map((p) => p.token)).not.toContain('ElementRef');
    const page = elements.find((n) => n.injector.component === 'TripPage');
    expect(page?.children).toContain(card);
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
