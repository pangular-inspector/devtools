// @vitest-environment jsdom
import '@angular/compiler';
import {
  Component,
  effect,
  inject,
  Injectable,
  provideZonelessChangeDetection,
  signal,
  type ApplicationRef,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { elementById } from '../element-id.ts';
import { serializeNamed } from '../serialize.ts';
import { collectSignalGraph, graphValue, type SignalDebugNg } from '../signal-graph.ts';
import { createSignalHistory, installSignalWriteHook } from '../signal-history.ts';
import { restoreSignalEntry } from '../signal-restore.ts';
import type { SignalGraph } from '../types.ts';
import { angularAtLeast, STANDALONE } from './angular-version.ts';

class TripStore {
  readonly trips = signal(1, { debugName: 'trips' });
  readonly log: number[] = [];
  constructor() {
    effect(() => this.log.push(this.trips()), { debugName: 'persistTrips' });
  }
}
Injectable({ providedIn: 'root' })(TripStore);

class App {
  readonly store = inject(TripStore);
}
Component({ ...STANDALONE, selector: 'app-root', template: `{{ store.trips() }}` })(App);

const settle = async (app: ApplicationRef) => {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    app.tick();
  }
};

describe.skipIf(!angularAtLeast('20.1.0'))('restoring a service signal from history', () => {
  let app: ApplicationRef | null = null;
  let unhook: (() => void) | null = null;
  let ng: SignalDebugNg;
  let history: ReturnType<typeof createSignalHistory>;

  const snapshot = (): SignalGraph => {
    const graph = collectSignalGraph(ng, { env: 'root' })!;
    history.collect(graph.nodes);
    return graph;
  };

  beforeEach(async () => {
    document.body.innerHTML = '<app-root></app-root>';
    history = createSignalHistory(
      (value, name) => serializeNamed(name, value, { budget: 1000 }),
      Date.now,
      (value, name) => graphValue(name, value),
      { restorable: true },
    );
    unhook = await installSignalWriteHook(history.onWrite);
    app = await bootstrapApplication(App, { providers: [provideZonelessChangeDetection()] });
    await settle(app);
    ng = (globalThis as { ng?: SignalDebugNg }).ng!;
  });

  afterEach(() => {
    app?.destroy();
    app = null;
    unhook?.();
    unhook = null;
  });

  it('gives a service field a service locator and restores a past value', async () => {
    const store = app!.injector.get(TripStore);
    const first = snapshot();
    expect(first.injector?.name).toBe('Root');
    const trips = first.nodes.find((n) => n.label === 'trips')!;
    expect(trips.locator).toEqual({
      id: first.injector!.id,
      key: 'trips',
      owner: 'service',
      service: 'TripStore',
    });
    store.trips.set(2);
    await settle(app!);
    const graph = snapshot();
    const initial = history.collect(graph.nodes)[trips.id]![0]!;
    expect(initial.value).toBe(1);

    const result = restoreSignalEntry(
      ng,
      { component: graph.injector!.id, owner: 'service', node: trips.id, epoch: initial.epoch },
      history,
      (id) => elementById(id),
    );
    expect(result).toMatchObject({ ok: true, component: 'TripStore', key: 'trips', value: 1 });
    expect(store.trips()).toBe(1);
  });

  it('refuses a service restore for an injector that is gone', () => {
    const graph = snapshot();
    const trips = graph.nodes.find((n) => n.label === 'trips')!;
    expect(
      restoreSignalEntry(
        ng,
        { component: 'inj-99999', owner: 'service', node: trips.id, epoch: 0 },
        history,
        (id) => elementById(id),
      ),
    ).toEqual({ error: 'The injector is no longer on the page, so nothing was restored.' });
  });
});
