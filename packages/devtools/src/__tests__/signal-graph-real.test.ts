// @vitest-environment jsdom
import '@angular/compiler';
import {
  Component,
  Injectable,
  afterRenderEffect,
  computed,
  effect,
  inject,
  linkedSignal,
  provideZonelessChangeDetection,
  resource,
  signal,
  type ApplicationRef,
} from '@angular/core';
import { httpResource, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { bootstrapApplication } from '@angular/platform-browser';
import { afterEach, describe, expect, it } from 'vitest';
import { collectSignalGraph, type SignalDebugNg } from '../signal-graph.ts';

class TripStore {
  readonly trips = signal(['Lisbon'], { debugName: 'trips' });
  readonly saved = signal(0, { debugName: 'saved' });
  constructor() {
    effect(
      () => {
        this.trips();
        this.saved.update((n) => n + 1);
      },
      { debugName: 'persistTrips' },
    );
  }
}

Injectable({ providedIn: 'root' })(TripStore);

let rejectForecast: (error: Error) => void = () => {};

class TripPage {
  readonly store = inject(TripStore);
  readonly city = signal('Paris', { debugName: 'city' });
  readonly selected = linkedSignal(() => this.city().toUpperCase(), { debugName: 'selected' });
  readonly weather = resource({
    params: () => ({ city: this.city() }),
    loader: async ({ params }) => `Sunny in ${params.city}`,
    debugName: 'weather',
  });
  readonly forecast = resource({
    params: () => this.city(),
    loader: () =>
      new Promise<string>((_, reject) => {
        rejectForecast = reject;
      }),
    debugName: 'forecast',
  });
  readonly unnamed = resource({ params: () => this.city(), loader: async () => 1 });
  readonly airport = httpResource<{ code: string }>(() => `/api/airports/${this.city()}`, {
    debugName: 'airport',
  });
  readonly log = computed(() => `${this.city()} ${this.store.trips().length}`, {
    debugName: 'log',
  });
  constructor() {
    effect(() => this.log(), { debugName: 'logEffect' });
    afterRenderEffect(() => this.selected(), { debugName: 'measure' } as never);
  }
}

Component({
  selector: 'app-root',
  template: `{{ city() }} {{ weather.value() }} {{ weather.status() }} {{ forecast.error() }}
    {{ unnamed.value() }} {{ airport.value() }} {{ airport.statusCode() }} {{ selected() }}`,
})(TripPage);

const settle = async (app: ApplicationRef) => {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    app.tick();
  }
};

describe('collectSignalGraph with a real app', () => {
  let app: ApplicationRef | null = null;
  afterEach(() => {
    app?.destroy();
    app = null;
  });

  it('folds resource and httpResource internals into entries with status, params, value and error', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(TripPage, {
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    await settle(app);
    const http = app.injector.get(HttpTestingController);
    http.expectOne('/api/airports/Paris').flush({ code: 'CDG' }, { status: 200, statusText: 'OK' });
    rejectForecast(new Error('Forecast service down'));
    await settle(app);

    const ng = (globalThis as { ng?: SignalDebugNg }).ng!;
    const graph = collectSignalGraph(ng)!;
    const byName = Object.fromEntries((graph.resources ?? []).map((r) => [r.name, r]));
    expect(Object.keys(byName).sort()).toEqual(['airport', 'forecast', 'resource 1', 'weather']);

    expect(byName['weather']).toMatchObject({
      named: true,
      status: 'resolved',
      isLoading: false,
      params: { city: 'Paris' },
      value: 'Sunny in Paris',
    });
    expect(byName['forecast']).toMatchObject({ status: 'error', params: 'Paris' });
    expect(byName['forecast'].error).toContain('Forecast service down');
    expect('value' in byName['forecast']).toBe(false);
    expect(byName['resource 1']).toMatchObject({ named: false, status: 'resolved', value: 1 });
    expect(byName['airport']).toMatchObject({
      status: 'resolved',
      params: { method: 'GET', url: '/api/airports/Paris' },
      value: { code: 'CDG' },
      statusCode: 200,
    });

    const internals = new Set(graph.resources!.flatMap((r) => r.nodeIds));
    const outside = graph.nodes.filter((n) => !internals.has(n.id)).map((n) => n.label);
    expect(outside).not.toContainEqual(expect.stringMatching(/^Resource|^_statusCode|^stream$/));
    expect(outside).toEqual(expect.arrayContaining(['city', 'selected', 'log', 'logEffect']));
    const selected = graph.nodes.find((n) => n.label === 'selected');
    expect(selected).toMatchObject({ kind: 'linkedSignal', value: 'PARIS' });
    expect(graph.nodes.some((n) => n.kind === 'afterRenderEffectPhase')).toBe(true);
  });

  it('reports the effects of root services for the root target', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(TripPage, {
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    await settle(app);
    const ng = (globalThis as { ng?: SignalDebugNg }).ng!;
    const component = collectSignalGraph(ng)!;
    expect(component.environments?.map((e) => e.name)).toContain('Root');
    const root = collectSignalGraph(ng, { env: 'root' })!;
    expect(root.injector?.name).toBe('Root');
    expect(root.nodes.map((n) => n.label)).toEqual(
      expect.arrayContaining(['persistTrips', 'trips']),
    );
  });
});
