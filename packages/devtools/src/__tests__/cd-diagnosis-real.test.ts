// @vitest-environment jsdom
import '@angular/compiler';
import * as core from '@angular/core';
import { Component } from '@angular/core';
import { setPostSignalSetFn } from '@angular/core/primitives/signals';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachChangeDetection, type CdReport } from '../cd-overlay.ts';
import { findCdScheduler } from '../cd-diagnosis.ts';
import { angularAtLeast, bootstrapRoot, STANDALONE, type BootedApp } from './angular-version.ts';

const ngOf = () => (globalThis as { ng?: unknown }).ng;
const supported = angularAtLeast('20.0');
const signal = <T>(value: T, debugName: string) =>
  (core.signal as (v: T, o: { debugName: string }) => core.WritableSignal<T>)(value, {
    debugName,
  });

class StaticNote {}
Component({
  ...STANDALONE,
  selector: 'app-static-note',
  changeDetection: core.ChangeDetectionStrategy.Default,
  template: '<p>Static</p>',
})(StaticNote);

class ItemCount {
  items: number[] = [];
}
Component({
  ...STANDALONE,
  selector: 'app-item-count',
  inputs: ['items'],
  template: '{{ items.length }} items',
})(ItemCount);

class Options {
  options: { size: number } = { size: 0 };
}
Component({
  ...STANDALONE,
  selector: 'app-options',
  inputs: ['options'],
  template: 'size {{ options.size }}',
})(Options);

class Counter {
  readonly count = signal(0, 'count');
  bump() {
    this.count.update((n) => n + 1);
  }
}
Component({
  ...STANDALONE,
  selector: 'app-counter',
  template: '<button type="button" (click)="bump()">Bump</button> {{ count() }}',
})(Counter);

class Shell {
  readonly items = [1, 2];
  readonly ticks = signal(0, 'ticks');
  options() {
    return { size: 1 };
  }
  addInPlace() {
    this.items.push(this.items.length + 1);
    this.ticks.update((n) => n + 1);
  }
}
Component({
  ...STANDALONE,
  selector: 'app-root',
  imports: [StaticNote, ItemCount, Options, Counter],
  changeDetection: core.ChangeDetectionStrategy.Default,
  template: `<button type="button" id="add" (click)="addInPlace()">Add</button>
    <app-static-note></app-static-note>
    <app-item-count [items]="items"></app-item-count>
    <app-options [options]="options()"></app-options>
    <app-counter></app-counter>`,
})(Shell);

/** Whether a signal write hook is set, such as the one a recording adds once its import resolves. */
function hasSignalWriteHook(): boolean {
  const hook = setPostSignalSetFn(null);
  setPostSignalSetFn(hook);
  return hook !== null;
}

function fakeRpc() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const reports: CdReport[] = [];
  const my = {
    rpc: {
      call: async (name: string, ...args: unknown[]) => {
        if (name === 'push-change-detection') reports.push(args[0] as CdReport);
        return undefined;
      },
      register: (definition: { name: string; handler: (...args: unknown[]) => unknown }) => {
        handlers.set(definition.name, definition.handler);
      },
    },
  };
  return { my, handlers, reports };
}

describe.skipIf(!supported)('change detection diagnosis with a real app', () => {
  let app: BootedApp | null = null;
  let stop: (() => void) | null = null;
  afterEach(() => {
    stop?.();
    stop = null;
    app?.destroy();
    app = null;
    document.body.innerHTML = '';
  });

  async function record() {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapRoot(Shell);
    app.appRef.tick();
    await app.appRef.whenStable();
    const { my, handlers, reports } = fakeRpc();
    const cd = attachChangeDetection(my, 'p1', ngOf, 50);
    stop = cd.stop;
    handlers.get('change-detection-record')!({ pageId: 'p1', on: true });
    // The signal write hook loads with a dynamic import.
    await vi.waitFor(() => expect(hasSignalWriteHook()).toBe(true), { timeout: 3000 });
    return {
      async report() {
        await cd.push(true);
        return reports.at(-1)!;
      },
    };
  }

  it("finds Angular's scheduler through the root injector", async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapRoot(Shell);
    const scheduler = findCdScheduler(ngOf(), document.querySelectorAll('[ng-version]'));
    expect(typeof scheduler?.notify).toBe('function');
  });

  it('credits a click to its event, target and listener component, with the signal it wrote', async () => {
    const recording = await record();
    (document.querySelector('app-counter button') as HTMLButtonElement).click();
    await app!.appRef.whenStable();
    const report = await recording.report();
    const cycle = report.cycles.find((c) => c.cause?.kind === 'event');
    expect(cycle?.cause).toMatchObject({
      kind: 'event',
      event: 'click',
      target: 'button',
      component: 'Counter',
      signal: 'count',
    });
    expect(report.diagnosis?.triggers).toBe(true);
    expect(report.diagnosis?.causes.event).toBeGreaterThanOrEqual(1);
  });

  it('credits a signal written in a timer to the signal and the app frame that wrote it', async () => {
    const recording = await record();
    const counter = (ngOf() as { getComponent(el: Element): Counter }).getComponent(
      document.querySelector('app-counter')!,
    );
    await new Promise<void>((resolve) =>
      setTimeout(() => {
        counter.bump();
        resolve();
      }, 0),
    );
    // The write schedules a tick, which Angular tracks as a pending task.
    await app!.appRef.whenStable();
    const report = await recording.report();
    const cause = report.cycles.find((c) => c.cause?.signal === 'count')?.cause;
    expect(cause?.kind).toBe('signal');
    expect(cause?.signal).toBe('count');
    expect(cause?.stack?.[0]).toMatch(/Counter\.bump/);
    expect(cause?.component).toBe('Counter');
  });

  it('counts unchanged checks, an input mutated in place and an equal new reference', async () => {
    const recording = await record();
    for (let i = 0; i < 3; i++) {
      (document.getElementById('add') as HTMLButtonElement).click();
      await app!.appRef.whenStable();
    }
    const report = await recording.report();
    const diagnosis = report.diagnosis!;
    expect(diagnosis.waste).toBe(true);
    const note = diagnosis.components.find((c) => c.name === 'StaticNote');
    expect(note).toMatchObject({ refreshed: 3, unchanged: 3, strategy: 'Eager' });
    // The first check of an instance in a recording is the baseline its inputs are compared with.
    const inPlace = diagnosis.inputs?.find((i) => i.name === 'ItemCount');
    expect(inPlace).toMatchObject({ input: 'items', parent: 'Shell', inPlace: 2, sameContents: 0 });
    const renewed = diagnosis.inputs?.find((i) => i.name === 'Options');
    expect(renewed).toMatchObject({
      input: 'options',
      parent: 'Shell',
      inPlace: 0,
      sameContents: 2,
    });
    // The new reference means the Shell's check did something, from the second check on.
    const shell = diagnosis.components.find((c) => c.name === 'Shell');
    expect(shell).toMatchObject({ refreshed: 3, unchanged: 1, strategy: 'Eager' });
    expect(report.cycles.at(-1)?.unchanged).toBeGreaterThanOrEqual(1);
  });

  it('unwraps the scheduler when the recording stops', async () => {
    const recording = await record();
    const scheduler = findCdScheduler(ngOf(), document.querySelectorAll('[ng-version]'))!;
    expect(Object.prototype.hasOwnProperty.call(scheduler, 'notify')).toBe(true);
    stop!();
    stop = null;
    expect(Object.prototype.hasOwnProperty.call(scheduler, 'notify')).toBe(false);
    await recording.report();
  });
});
