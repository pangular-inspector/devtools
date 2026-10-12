// @vitest-environment jsdom
import '@angular/compiler';
import {
  Component,
  afterEveryRender,
  provideZonelessChangeDetection,
  signal,
  type ApplicationRef,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { afterEach, describe, expect, it } from 'vitest';
import { attachChangeDetection, type CdReport } from '../cd-overlay.ts';
import { PROFILER_EVENT as E } from '../cd-recorder.ts';
import { addProfilerListener } from '../change-detection.ts';
import { elementId } from '../element-id.ts';
import { angularAtLeast } from './angular-version.ts';

class TripCart {
  readonly items = signal(0);
  add() {
    this.items.update((n) => n + 1);
  }
}
Component({
  selector: 'app-trip-cart',
  template: '<button type="button" (click)="add()">Add</button> {{ items() }} items',
})(TripCart);

class TripShell {}
Component({ selector: 'app-root', imports: [TripCart], template: '<app-trip-cart />' })(TripShell);

// Plain inputs: JIT without the CLI transform cannot see signal inputs.
class HookBadge {
  count = 0;
  ngOnChanges() {}
  ngOnInit() {}
  ngDoCheck() {}
  ngAfterViewChecked() {}
}
Component({ selector: 'app-hook-badge', inputs: ['count'], template: 'n={{ count }}' })(HookBadge);

class HookShell {
  readonly count = signal(0);
  rendered = 0;
  constructor() {
    afterEveryRender(() => this.rendered++);
  }
  bump() {
    this.count.update((n) => n + 1);
  }
}
Component({
  selector: 'app-root',
  imports: [HookBadge],
  template:
    '<button type="button" (click)="bump()">Bump</button><app-hook-badge [count]="count()" />',
})(HookShell);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ngOf = () => (globalThis as { ng?: unknown }).ng;

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

describe('change detection recorder with a real app', () => {
  let app: ApplicationRef | null = null;
  let cleanup: (() => void) | null = null;
  afterEach(() => {
    cleanup?.();
    cleanup = null;
    app?.destroy();
    app = null;
    document.body.innerHTML = '';
  });

  async function boot() {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(TripShell, {
      providers: [provideZonelessChangeDetection()],
    });
    app.tick();
  }

  it('gets the profiler events the recorder reads, with the numbers it expects', async () => {
    await boot();
    const events: { event: number; instance: unknown }[] = [];
    const remove = addProfilerListener(ngOf(), (event, instance) =>
      events.push({ event, instance }),
    );
    if (!angularAtLeast('20.0')) {
      expect(remove).toBeNull();
      return;
    }
    cleanup = remove;
    document.querySelector('button')!.click();
    await wait(40);

    const seen = events.map(({ event }) => event);
    for (const event of [
      E.OutputStart,
      E.OutputEnd,
      E.ChangeDetectionStart,
      E.ChangeDetectionSyncStart,
      E.ComponentStart,
      E.ComponentEnd,
      E.ChangeDetectionEnd,
    ])
      expect(seen).toContain(event);
    const output = events.find(({ event }) => event === E.OutputStart);
    expect(output?.instance).toBeInstanceOf(TripCart);
    const ended = events.filter(({ event }) => event === E.ComponentEnd);
    expect(ended.some(({ instance }) => instance instanceof TripCart)).toBe(true);
    expect(seen.indexOf(E.OutputEnd)).toBeLessThan(seen.indexOf(E.ChangeDetectionStart));
  });

  it('records a real cycle with its trigger, components and host ids, and stops on request', async () => {
    await boot();
    const { my, handlers, reports } = fakeRpc();
    const cd = attachChangeDetection(my, 'pg1', ngOf, 50);
    cleanup = () => cd.stop();
    const record = handlers.get('change-detection-record')!;

    record({ pageId: 'pg1', on: true });
    await wait(0);
    const started = reports.at(-1)!;
    if (!angularAtLeast('20.0')) {
      expect(started).toMatchObject({ pageId: 'pg1', supported: false, recording: false });
      return;
    }
    expect(started).toMatchObject({ pageId: 'pg1', supported: true, recording: true, cycles: [] });

    document.querySelector('button')!.click();
    await wait(40);
    expect(document.body.textContent).toContain('1 items');
    await cd.push();
    const report = reports.at(-1)!;
    expect(report.cycles.length).toBeGreaterThan(0);
    const cycle = report.cycles.find((each) => each.trigger?.startsWith('TripCart'));
    expect(cycle).toBeDefined();
    expect(cycle!.passes).toBeGreaterThan(0);
    expect(cycle!.components.map((c) => c.name)).toContain('TripCart');
    expect(report.components.find((c) => c.name === 'TripCart')?.checks).toBeGreaterThan(0);
    const host = document.querySelector('app-trip-cart')!;
    expect(report.hosts[elementId(host)]).toBeGreaterThan(0);

    const sent = reports.length;
    await cd.push();
    expect(reports.length).toBe(sent);

    record({ pageId: 'pg1', on: false });
    await wait(0);
    const cycles = reports.at(-1)!.cycles.length;
    expect(reports.at(-1)!.recording).toBe(false);
    document.querySelector('button')!.click();
    await wait(40);
    expect(document.body.textContent).toContain('2 items');
    await cd.push(true);
    expect(reports.at(-1)!.cycles.length).toBe(cycles);
  });

  it('times real lifecycle hooks, outputs and afterRender callbacks', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(HookShell, {
      providers: [provideZonelessChangeDetection()],
    });
    app.tick();
    const events: number[] = [];
    const removeSpy = addProfilerListener(ngOf(), (event) => events.push(event));
    const { my, handlers, reports } = fakeRpc();
    const cd = attachChangeDetection(my, 'pg2', ngOf, 50);
    cleanup = () => {
      removeSpy?.();
      cd.stop();
    };
    handlers.get('change-detection-record')!({ pageId: 'pg2', on: true });
    await wait(0);
    if (!angularAtLeast('20.0')) {
      expect(reports.at(-1)).toMatchObject({ supported: false });
      return;
    }

    document.querySelector('button')!.click();
    await wait(40);
    expect(document.body.textContent).toContain('n=1');
    for (const event of [
      E.LifecycleHookStart,
      E.LifecycleHookEnd,
      E.AfterRenderHooksStart,
      E.AfterRenderHooksEnd,
    ])
      expect(events).toContain(event);

    await cd.push();
    const report = reports.at(-1)!;
    const hooks = (report.hooks ?? []).filter((h) => h.name === 'HookBadge').map((h) => h.hook);
    // ngOnInit ran before recording started; the click runs the check hooks and ngOnChanges.
    expect(hooks).toEqual(
      expect.arrayContaining(['ngOnChanges', 'ngDoCheck', 'ngAfterViewChecked']),
    );
    expect(report.outputs).toEqual([expect.objectContaining({ name: 'HookShell', calls: 1 })]);
    expect(report.afterRender?.runs).toBeGreaterThan(0);
    const cycle = report.cycles.find((each) => each.trigger?.startsWith('HookShell'))!;
    expect(cycle).toBeDefined();
    const names = report.spanNames ?? [];
    const kinds = (cycle.spans ?? []).map(([name, , , , kind]) => `${kind}:${names[name]}`);
    expect(kinds).toEqual(
      expect.arrayContaining(['c:HookBadge', 'h:HookBadge.ngDoCheck', 'r:afterRender']),
    );
    expect(kinds.some((kind) => kind.startsWith('o:HookShell'))).toBe(true);
  });
});
