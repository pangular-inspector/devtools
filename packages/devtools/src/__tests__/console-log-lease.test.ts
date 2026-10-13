// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { consoleTapInfo } from '../console-tap.ts';
import { attachErrors, type ErrorsDebugNg } from '../errors-collector.ts';
import { mergeErrorsReport, type ErrorsReport, type ErrorsState } from '../rpc/errors-tools.ts';

const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');

/** Angular's ErrorHandler token, as `ɵgetInjectorProviders` lists it. */
class ErrorHandler {
  handleError(error: unknown) {
    console.error('ERROR', error);
  }
}

const original = { ...console };
const stops: (() => void)[] = [];

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  Object.assign(console, original);
  document.body.innerHTML = '';
});

/** A page whose pushes land in a server-side state, merged like `push-errors`. */
function page(active: { value: boolean }) {
  document.body.innerHTML = '<app-root ng-version="22.1.0"></app-root>';
  const handler = new ErrorHandler();
  const injector = { get: (token: unknown) => (token === ErrorHandler ? handler : null) };
  const ng = {
    getInjector: () => injector,
    ɵgetInjectorResolutionPath: () => [injector],
    ɵgetInjectorProviders: () => [{ token: ErrorHandler }],
  } as ErrorsDebugNg;
  const reports: ErrorsReport[] = [];
  const state: ErrorsState = { pages: {} };
  let clock = 1_000;
  const my = {
    rpc: {
      call: async (name: string, report: ErrorsReport) => {
        if (name !== 'push-errors') return undefined;
        const copy = structuredClone(report);
        reports.push(copy);
        return mergeErrorsReport(state, copy, clock);
      },
    },
  };
  const collector = attachErrors(my as never, 'tab-1', () => ng, {
    now: () => clock,
    active: () => active.value,
  });
  stops.push(collector.stop);
  return {
    reports,
    state,
    collector,
    tick: (ms: number) => (clock += ms),
    texts: () => Object.values(state.pages['tab-1']?.console ?? {}).map((entry) => entry.text),
  };
}

describe('console log on an idle page', () => {
  it('keeps capturing while idle, sends only keepalives, and sends the backlog when woken', async () => {
    console.log = () => {};
    console.warn = () => {};
    const active = { value: true };
    const p = page(active);
    console.log('first load');
    await p.collector.push();
    expect(p.texts()).toEqual(['first load']);

    active.value = false;
    console.log('while idle', { token: 'abc123', jwt: JWT });
    console.warn('also idle');
    await p.collector.push();
    // Nothing new went out: no keepalive is due yet either.
    expect(p.reports).toHaveLength(1);
    p.tick(60_000);
    await p.collector.push();
    expect(p.reports).toHaveLength(2);
    expect(p.reports[1]).toMatchObject({ pageId: 'tab-1', full: false, errors: [], console: [] });
    expect(p.texts()).toEqual(['first load']);

    // A wake: the lease turns active again and the overlay pushes.
    active.value = true;
    await p.collector.push();
    const texts = p.texts();
    expect(texts).toHaveLength(3);
    expect(texts[1]).toContain('while idle');
    expect(texts[1]).not.toContain('abc123');
    expect(texts[1]).not.toContain(JWT);
    expect(texts[2]).toBe('also idle');
    // The shared console tap is patched once, however the collector pauses.
    expect(consoleTapInfo().listeners).toBe(1);
  });

  it('sends everything when the server forgot the page while it was idle', async () => {
    console.info = () => {};
    const active = { value: false };
    const p = page(active);
    // The first report goes out in full even on an idle page, so the page is listed.
    await p.collector.push();
    expect(p.reports[0]!.full).toBe(true);
    console.info('idle info');
    delete p.state.pages['tab-1'];
    p.tick(60_000);
    await p.collector.push();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(p.reports.at(-1)).toMatchObject({ full: true });
    expect(p.texts()).toEqual(['idle info']);
  });
});
