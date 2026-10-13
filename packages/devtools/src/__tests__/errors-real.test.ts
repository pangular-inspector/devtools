// @vitest-environment jsdom
import '@angular/compiler';
import * as core from '@angular/core';
import { Component, ErrorHandler, Injectable } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { elementById } from '../element-id.ts';
import { attachErrors, type ErrorsDebugNg } from '../errors-collector.ts';
import type { ErrorsReport } from '../rpc/errors-tools.ts';
import {
  angularAtLeast,
  bootstrapRoot,
  writableSignal,
  STANDALONE,
  type BootedApp,
} from './angular-version.ts';

/**
 * The collector wraps the app's ErrorHandler, found through its provider
 * (ɵgetInjectorProviders, 16.2+). Before, it counts what Angular's default
 * handler logs (`console.error('ERROR', error)`) instead.
 */
const wrapsHandler = angularAtLeast('16.2');

class TripCard {
  readonly seats = writableSignal(3);
  book(): void {
    throw new Error('No seats left on trip 42');
  }
  /** Writes a signal inside a computed, which Angular refuses with NG0600. */
  recount(): void {
    (core as unknown as { computed: (fn: () => void) => () => void }).computed(() =>
      this.seats.set(2),
    )();
  }
}
Component({
  ...STANDALONE,
  selector: 'app-trip-card',
  template: `<button type="button" (click)="book()">Book</button>
    <button type="button" class="recount" (click)="recount()">Recount</button>`,
})(TripCard);

class TripsApp {}
Component({
  ...STANDALONE,
  selector: 'app-root',
  imports: [TripCard],
  template: `<h1>Trips</h1><app-trip-card></app-trip-card>`,
})(TripsApp);

const handled: unknown[] = [];
class RecordingHandler extends ErrorHandler {
  override handleError(error: unknown): void {
    handled.push(error);
  }
}
Injectable()(RecordingHandler);

const settle = async (app: BootedApp) => {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    app.appRef.tick();
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
  let app: BootedApp | null = null;
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
    app = await bootstrapRoot(TripsApp, { declarations: [TripCard] });
    await settle(app);
    const { reports, collector } = harness();
    stop = collector.stop;
    await collector.push();
    expect(reports.at(-1)?.handler).toBe(wrapsHandler ? 'wrapped' : 'none');

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

  // NG0600 (a signal written inside a computed) exists with signals, from 16.0.
  it.runIf(angularAtLeast('16.0'))(
    'reads the code of a real RuntimeError and links its reference page',
    async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      document.body.innerHTML = '<app-root></app-root>';
      app = await bootstrapRoot(TripsApp, { declarations: [TripCard] });
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
    },
  );

  it('keeps a custom ErrorHandler running and restores it on stop', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapRoot(TripsApp, {
      declarations: [TripCard],
      providers: [{ provide: ErrorHandler, useClass: RecordingHandler }],
    });
    await settle(app);
    const { reports, collector } = harness();
    await collector.push();
    stop = collector.stop;
    if (!wrapsHandler) {
      // A custom handler that does not log can't be seen before 16.2; it still runs.
      expect(reports.at(-1)?.handler).toBe('none');
      document.querySelector('button')!.click();
      await collector.push();
      expect(handled).toHaveLength(1);
      expect(reports.at(-1)!.errors).toEqual([]);
      return;
    }
    expect(reports.at(-1)?.handler).toBe('wrapped');

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
