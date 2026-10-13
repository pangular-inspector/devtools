// @vitest-environment jsdom
import '@angular/compiler';
import { Component, Injectable, inject } from '@angular/core';
import { afterAll, describe, expect, it } from 'vitest';
import { installStartupRecorder, type StartupBuffer } from '../startup-recorder.ts';
import { readStartupTiming } from '../startup-timing.ts';
import { angularAtLeast, bootstrapRoot, STANDALONE, type BootedApp } from './angular-version.ts';

class TripService {
  readonly trips: string[] = [];
  constructor() {
    // Takes measurable time to construct.
    const until = performance.now() + 5;
    while (performance.now() < until) this.trips.length = 0;
  }
}
Injectable({ providedIn: 'root' })(TripService);

class Trips {
  readonly service = inject(TripService);
}
Component({ ...STANDALONE, selector: 'app-root', template: `<p>Trips</p>` })(Trips);

// `ng.enableProfiling` and the profiler with a remover need 20.0.
describe.runIf(angularAtLeast('20.0'))('the startup recorder with a real app', () => {
  let app: BootedApp | null = null;
  let buffer: StartupBuffer | undefined;
  const stamp = console.timeStamp;
  // Runs whether or not the test's assertions passed.
  afterAll(() => {
    buffer?.stop?.();
    console.timeStamp = stamp;
    delete (globalThis as { __PANGULAR_STARTUP__?: unknown }).__PANGULAR_STARTUP__;
    app?.destroy();
    document.body.innerHTML = '';
  });

  it('records ng, the root component, provider construction and the first stable state', async () => {
    // A stand-in for the browser's, which Angular profiling calls.
    console.timeStamp = () => {};
    const original = console.timeStamp;
    const recorder = installStartupRecorder();
    buffer = recorder;
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapRoot(Trips);
    await app.appRef.whenStable();
    for (let i = 0; i < 5 && !recorder.stable; i++) {
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    expect(recorder.ngAt).toBeGreaterThanOrEqual(recorder.hookAt);
    expect(recorder.bootstrapComponent?.end).toBeGreaterThanOrEqual(
      recorder.bootstrapComponent!.start!,
    );
    expect(recorder.stable).toMatchObject({ exact: true });
    const trip = recorder.providers.find((span) => span.name.replace(/^_/, '') === 'TripService');
    expect(trip?.ms).toBeGreaterThanOrEqual(4);
    recorder.stop!();
    expect(recorder.providerRecording).toBe('done');
    expect(console.timeStamp).toBe(original);
    const timing = readStartupTiming(0, undefined, { buffer: recorder });
    expect(timing.providers.status).toBe('measured');
    expect(timing.providers.slowest.map((entry) => entry.name)).toContain('TripService');
  });
});
