// @vitest-environment jsdom
import '@angular/compiler';
import {
  Component,
  ErrorHandler,
  Injectable,
  computed,
  provideZonelessChangeDetection,
  signal,
  type ApplicationRef,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { elementById } from '../element-id.ts';
import { attachErrors, type ErrorsDebugNg } from '../errors-collector.ts';
import type { ErrorsReport } from '../rpc/errors-tools.ts';

class TripCard {
  readonly seats = signal(3);
  book(): void {
    throw new Error('No seats left on trip 42');
  }
  /** Writes a signal inside a computed, which Angular refuses with NG0600. */
  recount(): void {
    computed(() => this.seats.set(2))();
  }
}
Component({
  selector: 'app-trip-card',
  template: `<button type="button" (click)="book()">Book</button>
    <button type="button" class="recount" (click)="recount()">Recount</button>`,
})(TripCard);

class TripsApp {}
Component({
  selector: 'app-root',
  imports: [TripCard],
  template: `<h1>Trips</h1><app-trip-card />`,
})(TripsApp);

const handled: unknown[] = [];
class RecordingHandler extends ErrorHandler {
  override handleError(error: unknown): void {
    handled.push(error);
  }
}
Injectable()(RecordingHandler);

const settle = async (app: ApplicationRef) => {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    app.tick();
  }
};

function harness() {
  const reports: ErrorsReport[] = [];
  const my = {
    rpc: {
      call: async (name: string, report: unknown) => {
        if (name === 'push-errors') reports.push(report as ErrorsReport);
        return { known: true };
      },
    },
  };
  const ng = () => (globalThis as { ng?: ErrorsDebugNg }).ng;
  return { reports, collector: attachErrors(my, 'real-page', ng) };
}

describe('the errors collector with a real app', () => {
  let app: ApplicationRef | null = null;
  let stop = () => {};
  afterEach(() => {
    stop();
    app?.destroy();
    app = null;
    handled.length = 0;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it("wraps the default ErrorHandler, keeps it logging, and links the template's component", async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(TripsApp, { providers: [provideZonelessChangeDetection()] });
    await settle(app);
    const { reports, collector } = harness();
    stop = collector.stop;
    await collector.push();
    expect(reports.at(-1)?.handler).toBe('wrapped');

    document.querySelector('button')!.click();
    await collector.push();

    // Angular's own handler still ran and logged the error.
    expect(logged).toHaveBeenCalledWith('ERROR', expect.any(Error));
    const [group] = reports.at(-1)!.errors;
    expect(group).toMatchObject({
      message: 'Error: No seats left on trip 42',
      count: 1,
      sources: ['handler'],
      owner: { name: 'TripCard' },
    });
    expect(elementById(group!.owner!.id)).toBe(document.querySelector('app-trip-card'));
    // The console log has the handler's line too.
    expect(reports.at(-1)!.console.map((entry) => entry.level)).toContain('error');
  });

  it('reads the code of a real RuntimeError and links its reference page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(TripsApp, { providers: [provideZonelessChangeDetection()] });
    await settle(app);
    const { reports, collector } = harness();
    stop = collector.stop;
    document.querySelector<HTMLButtonElement>('button.recount')!.click();
    await collector.push();
    expect(reports.at(-1)!.errors[0]).toMatchObject({
      code: 'NG0600',
      docUrl: 'https://angular.dev/errors/NG0600',
      owner: { name: 'TripCard' },
    });
  });

  it('keeps a custom ErrorHandler running and restores it on stop', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(TripsApp, {
      providers: [
        provideZonelessChangeDetection(),
        { provide: ErrorHandler, useClass: RecordingHandler },
      ],
    });
    await settle(app);
    const { reports, collector } = harness();
    await collector.push();
    expect(reports.at(-1)?.handler).toBe('wrapped');

    stop = collector.stop;
    document.querySelector('button')!.click();
    document.querySelector('button')!.click();
    await collector.push();
    expect(handled).toHaveLength(2);
    expect(reports.at(-1)!.errors[0]).toMatchObject({ count: 2, owner: { name: 'TripCard' } });

    const handler = app.injector.get(ErrorHandler) as RecordingHandler;
    expect(Object.hasOwn(handler, 'handleError')).toBe(true);
    collector.stop();
    expect(Object.hasOwn(handler, 'handleError')).toBe(false);
    document.querySelector('button')!.click();
    expect(handled).toHaveLength(3);
  });
});
