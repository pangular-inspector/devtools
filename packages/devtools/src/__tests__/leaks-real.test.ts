// @vitest-environment jsdom
import '@angular/compiler';
import * as core from '@angular/core';
import { Component } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import { attachLeaks, type LeaksDebugNg } from '../leaks-collector.ts';
import type { LeaksReport } from '../rpc/leaks-tools.ts';
import {
  angularAtLeast,
  bootstrapRoot,
  writableSignal,
  STANDALONE,
  type BootedApp,
} from './angular-version.ts';

/** A long-lived source, like a store or a service's Subject. */
const updates = new Subject<number>();

const effect = (core as unknown as Record<string, unknown>)['effect'] as
  ((fn: () => void) => unknown) | undefined;

class LeakyCard {
  readonly seats = writableSignal(3);
  // Subscribed in the constructor with no teardown.
  readonly sub = updates.subscribe(() => {});
  hooked?: { unsubscribe(): void };
  constructor() {
    effect?.(() => void this.seats());
  }
  ngOnInit() {
    // Made inside a lifecycle hook, so the profiler names the instance (20.0+).
    this.hooked = updates.subscribe(() => {});
  }
}
Component({ ...STANDALONE, selector: 'app-leaky-card', template: `{{ seats() }}` })(LeakyCard);

class Trips {
  readonly show = writableSignal(false);
}
Component({
  ...STANDALONE,
  selector: 'app-root',
  imports: [LeakyCard],
  template: `@if (show()) {<app-leaky-card></app-leaky-card>}`,
})(Trips);

const settle = async (app: BootedApp) => {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    app.appRef.tick();
  }
};

// `@if` and standalone imports need 17.0.
describe.runIf(angularAtLeast('17.0'))('the leaks collector with a real app', () => {
  let app: BootedApp | null = null;
  let stop = () => {};
  afterEach(() => {
    stop();
    app?.destroy();
    app = null;
    document.body.innerHTML = '';
  });

  it('sees a destroyed component through the null injector, its effect, and its open subscription', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapRoot(Trips);
    await settle(app);
    const reports: LeaksReport[] = [];
    const route = { value: '/trips' };
    const my = {
      rpc: {
        call: async (name: string, report: unknown) => {
          if (name === 'push-leaks') reports.push(report as LeaksReport);
          return { known: true };
        },
      },
    };
    // Hides the DI debug data's marker, to read the destroyed list as on Angular 16.1 and earlier.
    let hideDiDebug = false;
    const ng = () => {
      const real = (globalThis as { ng?: LeaksDebugNg }).ng;
      if (!real || !hideDiDebug) return real;
      const { ɵgetInjectorProviders: _hidden, ...rest } = real;
      return rest as LeaksDebugNg;
    };
    const collector = attachLeaks(my, 'real-page', ng, {
      route: () => route.value,
      dirty: null,
      storage: null,
      target: null,
    });
    stop = collector.stop;
    await collector.push();
    const subscribe = Observable.prototype.subscribe;
    // The real RxJS, loaded the way the overlay loads it.
    expect(await collector.setTracking(true)).toMatchObject({ ok: true });

    const root = app.injector.get(core.ApplicationRef).components[0]!.instance as Trips;
    root.show.set(true);
    await settle(app);
    await collector.push();
    let report = reports.at(-1)!;
    const card = report.components.find((c) => c.name === 'LeakyCard');
    if (angularAtLeast('20.1')) {
      expect(report.support.effects).toBe(true);
      expect(card).toMatchObject({ effects: 1 });
    }
    expect(report.totals.subscriptions).toBe(2);
    // From 20.0 the profiler ties the ngOnInit subscription to the instance.
    const profiler = angularAtLeast('20.0');
    if (profiler) expect(card).toMatchObject({ subscriptions: 1 });

    root.show.set(false);
    await settle(app);
    route.value = '/about';
    await collector.push();
    report = reports.at(-1)!;
    expect(report.support.detached).toBe(true);
    // From 16.2 a development build's DI debug data keeps every destroyed instance.
    const diDebug = angularAtLeast('16.2');
    expect(report.support.retention).toBe(diDebug ? 'dev-di-debug' : true);
    if (diDebug) {
      expect(report.destroyed).toEqual([]);
      hideDiDebug = true;
      await collector.push(true);
      report = reports.at(-1)!;
      expect(report.support.retention).toBe(true);
    }
    expect(report.destroyed).toEqual([
      expect.objectContaining({ name: 'LeakyCard', route: '/trips', navigations: 1 }),
    ]);
    // Destroyed, not detached: Angular dropped its view.
    expect(report.destroyed[0]!.detached).toBeUndefined();
    const reasons = report.subscriptions.map((s) => [s.name, s.reason, s.count]);
    expect(reasons).toEqual(
      expect.arrayContaining(
        profiler
          ? [
              ['LeakyCard', 'no-live-instance', 1],
              ['LeakyCard', 'instance-destroyed', 1],
            ]
          : [['LeakyCard', 'no-live-instance', 2]],
      ),
    );
    for (const sub of report.subscriptions) expect(sub.source).toMatch(/LeakyCard/);

    expect(Observable.prototype.subscribe).not.toBe(subscribe);
    await collector.setTracking(false);
    expect(Observable.prototype.subscribe).toBe(subscribe);
  });
});
