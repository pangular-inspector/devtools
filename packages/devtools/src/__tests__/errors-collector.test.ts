// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { elementById, elementId } from '../element-id.ts';
import {
  MAX_CONSOLE_ENTRIES,
  MAX_ERROR_GROUPS,
  MAX_MESSAGE,
  MAX_STACK,
  attachErrors,
  consoleText,
  ownerCandidates,
  type ErrorsDebugNg,
} from '../errors-collector.ts';
import { ngCodeOf, normalizeNgCode, ngCodeUrl } from '../ng-error-codes.ts';
import { consoleTapInfo } from '../console-tap.ts';
import type { ErrorsReport } from '../rpc/errors-tools.ts';

const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');

/** Angular's ErrorHandler token, as `ɵgetInjectorProviders` lists it. */
class ErrorHandler {
  handleError(error: unknown) {
    console.error('ERROR', error);
  }
}

class TripList {}
class TripCard {}

interface Harness {
  reports: ErrorsReport[];
  calls: { name: string; args: unknown[] }[];
  collector: ReturnType<typeof attachErrors>;
  handler: ErrorHandler;
  answer: { known: boolean };
}

const stops: (() => void)[] = [];
const originalError = console.error;
const originalLog = console.log;

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  console.error = originalError;
  console.log = originalLog;
  document.body.innerHTML = '';
  delete (globalThis as { ng?: unknown }).ng;
  vi.useRealTimers();
});

function fakeNg(handler: ErrorHandler, extra: Partial<ErrorsDebugNg> = {}): ErrorsDebugNg {
  const injector = { get: (token: unknown) => (token === ErrorHandler ? handler : null) };
  return {
    getInjector: () => injector,
    ɵgetInjectorResolutionPath: () => [injector],
    ɵgetInjectorProviders: () => [{ token: ErrorHandler }],
    ...extra,
  } as ErrorsDebugNg;
}

function harness(ng?: ErrorsDebugNg | null, now?: () => number): Harness {
  document.body.innerHTML ||= '<app-root ng-version="22"></app-root>';
  const handler = new ErrorHandler();
  const reports: ErrorsReport[] = [];
  const calls: { name: string; args: unknown[] }[] = [];
  const answer = { known: true };
  const my = {
    rpc: {
      call: async (name: string, ...args: unknown[]) => {
        calls.push({ name, args });
        if (name === 'push-errors') reports.push(structuredClone(args[0]) as ErrorsReport);
        return { ...answer };
      },
    },
  };
  const theNg = ng === null ? undefined : (ng ?? fakeNg(handler));
  const collector = attachErrors(my, 'page-1', () => theNg, { now });
  stops.push(collector.stop);
  return { reports, calls, collector, handler, answer };
}

const quiet = () => (console.error = () => {});

describe('NG codes', () => {
  it('reads the code of a RuntimeError and of a message, and links documented codes only', () => {
    expect(ngCodeOf({ code: -100, message: 'whatever' })).toBe('NG0100');
    expect(ngCodeOf({ code: 1203 })).toBe('NG01203');
    expect(ngCodeOf(new Error('x'), 'NG0303: Can\'t bind to "foo"')).toBe('NG0303');
    expect(ngCodeOf(null, 'NG8001: not a known element')).toBe('NG8001');
    expect(ngCodeOf(null, 'XNG0100 inside a token')).toBeUndefined();
    expect(ngCodeOf(null, 'NG0100123 too many digits')).toBeUndefined();
    expect(ngCodeOf(null, 'no code')).toBeUndefined();
    expect(ngCodeUrl('NG0100')).toBe('https://angular.dev/errors/NG0100');
    expect(ngCodeUrl('NG0303')).toBeUndefined();
    expect(normalizeNgCode('ng100')).toBe('NG0100');
    expect(normalizeNgCode('NG01203')).toBe('NG01203');
    expect(normalizeNgCode('hello')).toBeUndefined();
  });
});

describe('ownerCandidates', () => {
  it('reads component names from Angular messages and stack frames', () => {
    expect(
      ownerCandidates("NG0303: Can't bind to 'x' (used in the 'TripCard' component template).", ''),
    ).toEqual(['TripCard']);
    expect(ownerCandidates('NG0100: Expression location: _TripList component', '')).toEqual([
      'TripList',
    ]);
    const stack = [
      'Error: boom',
      '    at _TripCard.book (http://localhost/main.js:10:5)',
      '    at TripList_Conditional_2_Template_button_click_0_listener (http://localhost/main.js:20:3)',
      '    at Object.next (http://localhost/rxjs.js:1:1)',
      'handle@http://localhost/main.js:3:1',
    ].join('\n');
    const names = ownerCandidates('Error: boom', stack);
    expect(names.slice(0, 2)).toEqual([
      'TripCard',
      'TripList_Conditional_2_Template_button_click_0',
    ]);
    expect(names).toContain('TripList');
    expect(names).not.toContain('Object');
  });
});

describe('consoleText', () => {
  it('drops %c styles and masks tokens', () => {
    expect(consoleText(['%cHello%c world', 'color: red', 'color: blue', 42])).toBe(
      'Hello world 42',
    );
    expect(consoleText(['token', `Bearer ${JWT}`])).not.toContain('eyJ');
    expect(consoleText([{ password: 'hunter2', user: 'ada' }])).not.toContain('hunter2');
    expect(consoleText([new TypeError('bad')])).toBe('TypeError: bad');
  });
});

describe('attachErrors', () => {
  it('wraps the ErrorHandler, keeps the original running and puts it back on stop', async () => {
    const logged: unknown[][] = [];
    console.error = (...args: unknown[]) => void logged.push(args);
    const h = harness();
    expect(Object.hasOwn(h.handler, 'handleError')).toBe(true);
    const error = new Error('Payment failed');
    h.handler.handleError(error);
    expect(logged).toEqual([['ERROR', error]]);
    await h.collector.push();
    const report = h.reports.at(-1)!;
    expect(report).toMatchObject({ pageId: 'page-1', full: true, handler: 'wrapped' });
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toMatchObject({
      message: 'Error: Payment failed',
      name: 'Error',
      count: 1,
      sources: ['handler'],
    });
    expect(report.errors[0]!.stack).toContain('Payment failed');
    h.collector.stop();
    expect(Object.hasOwn(h.handler, 'handleError')).toBe(false);
    expect(h.handler.handleError).toBe(ErrorHandler.prototype.handleError);
  });

  it('counts the default handler logging ERROR when no handler can be wrapped', async () => {
    quiet();
    const h = harness(null);
    console.error('ERROR', new Error('Bootstrap failed'));
    await h.collector.push();
    expect(h.reports.at(-1)).toMatchObject({ handler: 'none' });
    expect(h.reports.at(-1)!.errors[0]).toMatchObject({
      message: 'Error: Bootstrap failed',
      sources: ['handler'],
    });
  });

  it('captures window errors and unhandled rejections', async () => {
    quiet();
    const h = harness();
    window.dispatchEvent(
      new ErrorEvent('error', { error: new RangeError('Index out of range'), message: 'x' }),
    );
    window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }));
    const rejection = new Event('unhandledrejection') as Event & { reason?: unknown };
    rejection.reason = 'quota exceeded';
    window.dispatchEvent(rejection);
    await h.collector.push();
    const errors = h.reports.at(-1)!.errors;
    expect(errors.map((e) => [e.message, e.sources])).toEqual([
      ['RangeError: Index out of range', ['window']],
      ['Script error.', ['window']],
      ['quota exceeded', ['promise']],
    ]);
  });

  it('counts one occurrence once when Angular forwards a window error to its handler', async () => {
    quiet();
    const h = harness();
    const error = new Error('Seen twice');
    window.dispatchEvent(new ErrorEvent('error', { error }));
    h.handler.handleError(error);
    await h.collector.push();
    expect(h.reports.at(-1)!.errors).toEqual([
      expect.objectContaining({ message: 'Error: Seen twice', count: 1, sources: ['window'] }),
    ]);
  });

  it('groups repeated errors by message with a count and the last time', async () => {
    quiet();
    let clock = 1000;
    const h = harness(undefined, () => clock);
    for (let i = 0; i < 3; i++) {
      clock += 5000;
      h.handler.handleError(new Error('Trip not found'));
    }
    await h.collector.push();
    expect(h.reports.at(-1)!.errors).toEqual([
      expect.objectContaining({ count: 3, firstAt: 6000, lastAt: 16000 }),
    ]);
  });

  it('parses NG codes and links the reference page', async () => {
    quiet();
    const h = harness();
    const runtime = Object.assign(
      new Error('NG0100: ExpressionChangedAfterItHasBeenCheckedError'),
      {
        code: -100,
      },
    );
    h.handler.handleError(runtime);
    h.handler.handleError(
      new Error("NG0303: Can't bind to 'tripId' since it isn't a known property"),
    );
    await h.collector.push();
    const [first, second] = h.reports.at(-1)!.errors;
    expect(first).toMatchObject({ code: 'NG0100', docUrl: 'https://angular.dev/errors/NG0100' });
    expect(second).toMatchObject({ code: 'NG0303' });
    expect(second!.docUrl).toBeUndefined();
  });

  it('masks tokens in messages and stacks and caps their length', async () => {
    quiet();
    const h = harness();
    const error = new Error(`Auth failed for Bearer ${JWT} ${'x'.repeat(2000)}`);
    error.stack = `Error: token=${JWT}\n${'    at frame (main.js:1:1)\n'.repeat(500)}`;
    h.handler.handleError(error);
    await h.collector.push();
    const [group] = h.reports.at(-1)!.errors;
    expect(group!.message).not.toContain('eyJ');
    expect(group!.message.length).toBeLessThanOrEqual(MAX_MESSAGE + 1);
    expect(group!.stack).not.toContain('eyJ');
    expect(group!.stack!.length).toBeLessThanOrEqual(MAX_STACK + 1);
  });

  it(`keeps at most ${MAX_ERROR_GROUPS} groups and counts the ones it dropped`, async () => {
    quiet();
    let clock = 0;
    const h = harness(undefined, () => ++clock);
    for (let i = 0; i < MAX_ERROR_GROUPS + 5; i++) h.handler.handleError(new Error(`Error ${i}`));
    await h.collector.push();
    const report = h.reports.at(-1)!;
    expect(report.errors).toHaveLength(MAX_ERROR_GROUPS);
    expect(report.errors[0]!.message).toBe('Error: Error 5');
    expect(report.dropped.errors).toBe(5);
  });

  it('links the component whose template listener threw, by its host element id', async () => {
    quiet();
    document.body.innerHTML =
      '<app-root ng-version="22"><app-trip-card><button>Book</button></app-trip-card></app-root>';
    const card = document.querySelector('app-trip-card')!;
    const button = document.querySelector('button')!;
    const instance = new TripCard();
    const handler = new ErrorHandler();
    const ng = fakeNg(handler, {
      getOwningComponent: (el) => (el === button ? instance : null),
      getHostElement: (component) => (component === instance ? card : null),
    });
    const h = harness(ng);
    button.addEventListener('click', () => handler.handleError(new Error('No seats')));
    button.click();
    await h.collector.push();
    const [group] = h.reports.at(-1)!.errors;
    expect(group!.owner).toEqual({ id: elementId(card), name: 'TripCard' });
    expect(elementById(group!.owner!.id)).toBe(card);
    expect(card.getAttributeNames()).toEqual([]);
  });

  it('finds the owner from the stack when the error did not come from a listener', async () => {
    quiet();
    document.body.innerHTML =
      '<app-root ng-version="22"><app-trip-list></app-trip-list></app-root>';
    const list = document.querySelector('app-trip-list')!;
    const handler = new ErrorHandler();
    const instance = new TripList();
    const ng = fakeNg(handler, { getComponent: (el) => (el === list ? instance : null) });
    const h = harness(ng);
    const error = new Error('Cannot read properties of undefined');
    error.stack =
      'TypeError: x\n    at TripList_Template (main.js:1:1)\n    at refreshView (core.js:1:1)';
    handler.handleError(error);
    await h.collector.push();
    expect(h.reports.at(-1)!.errors[0]!.owner).toEqual({ id: elementId(list), name: 'TripList' });
  });

  it('logs console calls by level, counts repeats in a row and skips its own messages', async () => {
    console.log = () => {};
    quiet();
    const h = harness();
    console.log('Loaded trips', { count: 3 });
    console.log('Loaded trips', { count: 3 });
    console.error('NG0500: During hydration Angular expected <div>');
    console.log('[pangular] Connected');
    await h.collector.push();
    expect(h.reports.at(-1)!.console).toEqual([
      expect.objectContaining({ id: 1, level: 'log', text: 'Loaded trips {"count":3}', count: 2 }),
      expect.objectContaining({ id: 2, level: 'error', code: 'NG0500' }),
    ]);
  });

  it(`keeps the last ${MAX_CONSOLE_ENTRIES} console calls and sends only new ones after the first push`, async () => {
    console.log = () => {};
    const h = harness();
    for (let i = 0; i < MAX_CONSOLE_ENTRIES + 10; i++) console.log(`line ${i}`);
    await h.collector.push();
    const first = h.reports.at(-1)!;
    expect(first.console).toHaveLength(MAX_CONSOLE_ENTRIES);
    expect(first.console[0]!.text).toBe('line 10');
    expect(first.dropped.console).toBe(10);
    console.log('one more');
    await h.collector.push();
    const next = h.reports.at(-1)!;
    expect(next.full).toBe(false);
    expect(next.console.map((entry) => entry.text)).toEqual(['one more']);
    expect(next.firstConsoleId).toBe(12);
  });

  it('skips unchanged pushes, sends a keepalive when due, and resends all when the server forgot the page', async () => {
    quiet();
    let clock = 0;
    const h = harness(undefined, () => clock);
    h.handler.handleError(new Error('once'));
    await h.collector.push();
    await h.collector.push();
    expect(h.reports).toHaveLength(1);
    clock += 60_000;
    await h.collector.push();
    expect(h.reports).toHaveLength(2);
    expect(h.reports[1]).toMatchObject({ full: false, errors: [], console: [] });
    h.answer.known = false;
    clock += 60_000;
    await h.collector.push();
    h.answer.known = true;
    await h.collector.push();
    expect(h.reports.at(-1)).toMatchObject({
      full: true,
      errors: [expect.objectContaining({ message: 'Error: once' })],
    });
    expect(h.reports.every((report) => report.pageId === 'page-1')).toBe(true);
  });

  it('forgets the page on leave, stays quiet until it resumes, and restores everything on stop', async () => {
    quiet();
    const before = console.error;
    const h = harness();
    h.collector.leave();
    expect(h.calls.at(-1)).toEqual({ name: 'forget-errors-page', args: ['page-1'] });
    h.handler.handleError(new Error('while away'));
    await h.collector.push();
    expect(h.reports).toHaveLength(0);
    h.collector.resume();
    await h.collector.push();
    expect(h.reports.at(-1)).toMatchObject({ full: true });
    h.collector.stop();
    expect(console.error).toBe(before);
    expect(consoleTapInfo().listeners).toBe(0);
    const swallow = (event: Event) => event.preventDefault();
    window.addEventListener('error', swallow);
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('after stop') }));
    window.removeEventListener('error', swallow);
    await h.collector.push();
    expect(h.reports.at(-1)!.errors.map((e) => e.message)).not.toContain('Error: after stop');
  });
});
