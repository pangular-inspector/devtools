// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { elementId } from '../element-id.ts';
import {
  WRITE_WINDOW_MS,
  createRecentWrites,
  enrichExplain,
  explainError,
  formatLikeAngular,
  membersHolding,
  parseExpressionChanged,
  parseHydrationMismatch,
  parseMissingProvider,
  templateOf,
} from '../error-explain.ts';
import { serializeNamed } from '../serialize.ts';
import { createSignalHistory } from '../signal-history.ts';
import { attachErrors, ownerCandidates, type ErrorsDebugNg } from '../errors-collector.ts';
import { HYDRATION_INFO_KEY } from '../hydration.ts';
import type { ErrorsReport } from '../rpc/errors-tools.ts';

const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');

/** Angular's NG0100 message, as `throwErrorIfNoChangesMode` builds it. */
const NG0100 =
  "NG0100: ExpressionChangedAfterItHasBeenCheckedError: Expression has changed after it was checked. Previous value for 'title': 'Trips'. Current value: 'Trips (3)'. Expression location: TripList component. Find more at https://angular.dev/errors/NG0100";

const NG0100_STACK = `Error: NG0100: ExpressionChangedAfterItHasBeenCheckedError
    at throwErrorIfNoChangesMode (http://localhost:4200/@fs/node_modules/.vite/deps/@angular_core.js:100:11)
    at bindingUpdated (http://localhost:4200/@fs/node_modules/.vite/deps/@angular_core.js:200:7)
    at TripList_Conditional_2_Template (http://localhost:4200/src/app/trip-list.ts:40:9)
    at executeTemplate (http://localhost:4200/@fs/node_modules/.vite/deps/@angular_core.js:300:5)`;

/** Angular's NG0500 message, as `validateMatchingNode` builds it. */
const NG0500 = `NG0500: During hydration Angular expected <div> but found <span>.

Angular expected this DOM:

<app-price>
  …
  <div class="total">…</div>  <-- AT THIS LOCATION
  …
</app-price>

Actual DOM is:

<app-price>
  …
  <span class="total">…</span>  <-- AT THIS LOCATION
  …
</app-price>

Note: attributes are only displayed to better represent the DOM but have no effect on hydration mismatches.

To fix this problem:
  * check the "Price" component for hydration-related issues
  * check to see if your template has valid HTML structure
  * or skip hydration by adding the \`ngSkipHydration\` attribute to its host node in a template

Find more at https://angular.dev/errors/NG0500`;

class RuntimeError extends Error {
  constructor(
    readonly code: number,
    message: string,
    stack?: string,
  ) {
    super(message);
    if (stack) this.stack = stack;
  }
}

describe('reading Angular error messages', () => {
  it('reads the binding, both values and the creation hint of an NG0100', () => {
    expect(parseExpressionChanged(NG0100)).toEqual({
      binding: 'title',
      previous: 'Trips',
      current: 'Trips (3)',
      creation: false,
    });
    expect(
      parseExpressionChanged(
        "Expression has changed after it was checked. Previous value: 'false'. Current value: 'true'. It seems like the view has been created after its parent and its children have been dirty checked.",
      ),
    ).toEqual({ previous: 'false', current: 'true', creation: true });
    expect(parseExpressionChanged('NG0100: something else')).toBeNull();
  });

  it('finds the template function the binding sits in, not a listener', () => {
    expect(templateOf(NG0100_STACK)).toBe('TripList_Conditional_2_Template');
    expect(templateOf('    at App_Template_button_click_0_listener (main.ts:3:1)')).toBeUndefined();
    expect(templateOf('App_Template@http://localhost/main.js:1:1')).toBe('App_Template');
  });

  it('splits a hydration message into its sentence, the expected DOM and the actual DOM', () => {
    const parts = parseHydrationMismatch(NG0500);
    expect(parts.summary).toBe('During hydration Angular expected <div> but found <span>.');
    expect(parts.expected).toContain('<div class="total">…</div>  <-- AT THIS LOCATION');
    expect(parts.expected).not.toContain('Actual DOM');
    expect(parts.actual).toContain('<span class="total">…</span>');
    expect(parts.actual).not.toContain('Note:');
    expect(parts.external).toBe(false);
  });

  it('reads the expected DOM of NG0502, which has no label', () => {
    const parts = parseHydrationMismatch(
      'NG0502: During hydration, Angular expected an element to be present at this location.\n\n<ul>\n  <li>…</li>  <-- AT THIS LOCATION\n</ul>\n\nTo fix this problem:\n  * check',
    );
    expect(parts.expected).toBe('<ul>\n  <li>…</li>  <-- AT THIS LOCATION\n</ul>');
    expect(parts.actual).toBeUndefined();
  });

  it('reads the token, path and source of every missing provider message shape', () => {
    expect(
      parseMissingProvider(
        'NG0201: No provider found for `TripApi`. Source: Standalone[App]. Path: TripList -> TripApi. Find more at https://angular.dev/errors/NG0201',
      ),
    ).toEqual({ token: 'TripApi', path: ['TripList', 'TripApi'], source: 'Standalone[App]' });
    expect(
      parseMissingProvider(
        'R3InjectorError(AppModule)[TripApi -> InjectionToken API_URL -> InjectionToken API_URL]: \n  NullInjectorError: No provider for InjectionToken API_URL!',
      ),
    ).toEqual({
      token: 'API_URL',
      path: ['TripApi', 'API_URL', 'API_URL'],
      source: 'AppModule',
    });
    expect(parseMissingProvider('NG0201: No provider for Tooltip found in NodeInjector.')).toEqual({
      token: 'Tooltip',
      source: 'NodeInjector',
    });
    expect(parseMissingProvider('NG0201: something unexpected')).toBeNull();
  });

  it('masks NG0100 values when the binding has a secret name, and tokens in any value', () => {
    const secret = explainError(
      'NG0100',
      "Previous value for 'password': 'hunter2'. Current value: 'hunter3'.",
      undefined,
    );
    expect(secret).toMatchObject({ previous: '[redacted]', current: '[redacted]', masked: true });
    const token = explainError(
      'NG0100',
      `Previous value for 'title': 'none'. Current value: 'Bearer ${JWT}'.`,
      undefined,
    );
    expect(JSON.stringify(token)).not.toContain(JWT);
  });

  it('names the requester of a missing provider as an owner candidate, and the hydration footer component', () => {
    expect(
      ownerCandidates('NG0201: No provider found for `TripApi`. Path: TripList -> TripApi.', ''),
    ).toEqual(['TripList']);
    expect(ownerCandidates(NG0500, '')).toEqual(['Price']);
  });
});

describe('membersHolding', () => {
  it('names plain fields and signals holding the value, without running getters or computeds', () => {
    const getter = vi.fn(() => 'Trips (3)');
    const signalNode = { value: 'Trips (3)' };
    const sig = Object.assign(() => 'never called', { [Symbol('SIGNAL')]: signalNode });
    const component = Object.defineProperties(
      { heading: 'Trips (3)', count: 3, other: 'x', label: sig },
      { computedTitle: { get: getter, enumerable: true } },
    );
    expect(membersHolding(component, 'Trips (3)')).toEqual(['heading', 'label']);
    expect(membersHolding(component, '3')).toEqual(['count']);
    expect(getter).not.toHaveBeenCalled();
  });

  it('prints values the way Angular does in NG0100', () => {
    expect(formatLikeAngular({ a: 1 })).toBe('{"a":1}');
    expect(formatLikeAngular([1, 2])).toBe('[1,2]');
    expect(formatLikeAngular(null)).toBe('null');
    expect(formatLikeAngular('x'.repeat(300))).toHaveLength(201);
  });
});

describe('recent signal writes', () => {
  it('keeps only writes to a signal the binding or a holding field names, when there are any', () => {
    const writes = createRecentWrites();
    writes.add('n1', 'count', { epoch: 1, value: '3', at: 1000, source: 'write' });
    writes.add('n2', 'value', { epoch: 1, value: '3', at: 1100, source: 'write' });
    expect(writes.matching(1200, '3', ['count']).map((w) => w.signal)).toEqual(['count']);
    expect(writes.matching(1200, '3', ['total']).map((w) => w.signal)).toEqual(['value', 'count']);
    expect(writes.matching(1200, '3').map((w) => w.signal)).toEqual(['value', 'count']);

    const explain = enrichExplain(
      { kind: 'expression-changed', binding: 'count', previous: '2', current: '3' },
      { at: 1200, writes },
    );
    expect(explain.kind === 'expression-changed' && explain.writes?.map((w) => w.signal)).toEqual([
      'count',
    ]);
  });

  it('matches a Date or an object by the value as written, not its serialized copy', async () => {
    const writes = createRecentWrites();
    const history = createSignalHistory(
      (value, name) => serializeNamed(name, value, { budget: 1000 }),
      () => 1000,
      undefined,
      { onChange: (id, label, change, raw) => writes.add(id, label, change, raw) },
    );
    const when = new Date(Date.UTC(2026, 9, 13, 12));
    class Trip {
      constructor(readonly to: string) {}
    }
    const deep = { a: { b: { c: { d: { e: { f: 'deep' } } } } } };
    history.onWrite({ debugName: 'departure', kind: 'signal', value: when, version: 1 });
    history.onWrite({ debugName: 'trip', kind: 'signal', value: new Trip('Oslo'), version: 1 });
    history.onWrite({ debugName: 'filters', kind: 'signal', value: deep, version: 1 });
    history.onWrite({ debugName: 'password', kind: 'signal', value: { p: 'hunter2' }, version: 1 });
    await Promise.resolve();
    await Promise.resolve();

    const signals = (current: string) => writes.matching(1000, current).map((w) => w.signal);
    expect(signals(formatLikeAngular(when))).toEqual(['departure']);
    expect(signals(formatLikeAngular(new Trip('Oslo')))).toEqual(['trip']);
    expect(signals(formatLikeAngular(deep))).toEqual(['filters']);
    // A secret-named signal keeps its masked value, so it is never matched.
    expect(signals('{"p":"hunter2"}')).toEqual([]);
  });

  it('matches writes of the current value in the window before the error, newest first', () => {
    const writes = createRecentWrites();
    writes.add('n1', 'title', { epoch: 1, value: 'Trips (3)', at: 1000, source: 'write' });
    writes.add('n1', 'title', {
      epoch: 2,
      value: 'Trips (3)',
      at: 1500,
      source: 'write',
      stack: ['TripList.ngAfterViewInit (src/app/trip-list.ts:22:5)'],
    });
    writes.add('n2', 'other', { epoch: 1, value: 'nope', at: 1500, source: 'write' });
    writes.add('n1', 'title', { epoch: 3, value: 'Trips (3)', at: 1600, source: 'sample' });
    expect(writes.matching(1700, 'Trips (3)')).toEqual([
      {
        signal: 'title',
        at: 1500,
        stack: ['TripList.ngAfterViewInit (src/app/trip-list.ts:22:5)'],
      },
      { signal: 'title', at: 1000 },
    ]);
    expect(writes.matching(1500 + WRITE_WINDOW_MS + 1, 'Trips (3)')).toEqual([]);
  });

  it('keeps a bounded number of writes', () => {
    const writes = createRecentWrites(3);
    for (let i = 0; i < 10; i++) {
      writes.add(undefined, `s${i}`, { epoch: i, value: 'v', at: 100, source: 'write' });
    }
    expect(writes.matching(100, 'v').map((w) => w.signal)).toEqual(['s9', 's8', 's7']);
  });
});

describe('the errors collector explainers', () => {
  const stops: (() => void)[] = [];
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  class TripList {
    title = 'Trips (3)';
    password = 'Trips (3)';
  }
  class Price {}

  function setup(component: object, writes = createRecentWrites()) {
    document.body.innerHTML =
      '<app-root ng-version="22"><app-trip-list></app-trip-list></app-root>';
    const host = document.querySelector('app-trip-list')!;
    const ng: ErrorsDebugNg = {
      getComponent: (el) => (el === host ? component : null),
    };
    const reports: ErrorsReport[] = [];
    const my = {
      rpc: {
        call: async (name: string, report: unknown) => {
          if (name === 'push-errors') reports.push(structuredClone(report) as ErrorsReport);
          return { known: true };
        },
      },
    };
    const target = new EventTarget();
    const collector = attachErrors(my, 'page-1', () => ng, {
      target: target as never,
      now: () => 5000,
      writes,
    });
    stops.push(collector.stop);
    const fire = (error: unknown) => {
      const event = new Event('error') as ErrorEvent;
      Object.defineProperty(event, 'error', { value: error });
      target.dispatchEvent(event);
    };
    return { reports, collector, host, fire };
  }

  it('sends an NG0100 with its component, binding, values, matching fields and the signal write behind it', async () => {
    const writes = createRecentWrites();
    writes.listening();
    writes.add('n1', 'heading', {
      epoch: 4,
      value: 'Trips (3)',
      at: 4900,
      source: 'write',
      stack: ['TripList.ngAfterViewInit (src/app/trip-list.ts:22:5)'],
    });
    const component = new (class TripList {
      title = 'Trips (3)';
    })();
    const { reports, collector, host, fire } = setup(component, writes);
    fire(new RuntimeError(-100, NG0100, NG0100_STACK));
    await collector.push();
    const [group] = reports.at(-1)!.errors;
    expect(group!.owner).toEqual({ id: elementId(host), name: 'TripList' });
    expect(group!.explain).toEqual({
      kind: 'expression-changed',
      binding: 'title',
      template: 'TripList_Conditional_2_Template',
      previous: 'Trips',
      current: 'Trips (3)',
      members: ['title'],
      writes: [
        {
          signal: 'heading',
          at: 4900,
          stack: ['TripList.ngAfterViewInit (src/app/trip-list.ts:22:5)'],
        },
      ],
      writesKnown: true,
    });
  });

  it('hides NG0100 values when a component field holding them has a secret name', async () => {
    const { reports, collector, fire } = setup(new TripList());
    fire(new RuntimeError(-100, NG0100));
    await collector.push();
    const explain = reports.at(-1)!.errors[0]!.explain;
    expect(explain).toMatchObject({
      kind: 'expression-changed',
      previous: '[redacted]',
      current: '[redacted]',
      masked: true,
      members: ['title', 'password'],
      writesKnown: false,
    });
    expect(explain).not.toHaveProperty('writes');
  });

  it('sends the expected and actual DOM of a hydration mismatch with the component Angular names', async () => {
    document.body.innerHTML = '';
    const { reports, collector, fire } = setup(new Price());
    // The footer names Price, so the owner search looks for that class.
    document.body.innerHTML = '<app-root ng-version="22"><app-price></app-price></app-root>';
    fire(new RuntimeError(-500, NG0500));
    await collector.push();
    const explain = reports.at(-1)!.errors[0]!.explain;
    expect(explain).toMatchObject({
      kind: 'hydration-mismatch',
      summary: 'During hydration Angular expected <div> but found <span>.',
    });
    expect(explain && 'expected' in explain && explain.expected).toContain('<div class="total">');
    expect(explain && 'actual' in explain && explain.actual).toContain('<span class="total">');
  });

  it('falls back to the hydration info Angular left on the host when the message has no DOM', async () => {
    const component = new TripList();
    const { reports, collector, host, fire } = setup(component);
    (host as unknown as Record<string, unknown>)[HYDRATION_INFO_KEY] = {
      status: 'mismatched',
      expectedNodeDetails: '<app-trip-list>\n  <ul>…</ul>\n</app-trip-list>',
      actualNodeDetails: '<app-trip-list>\n  <ol>…</ol>\n</app-trip-list>',
    };
    fire(
      new RuntimeError(
        -502,
        'NG0502: During hydration Angular was unable to locate a node using the "firstChild" path. To fix this problem:\n  * check the "TripList" component',
      ),
    );
    await collector.push();
    expect(reports.at(-1)!.errors[0]!.explain).toMatchObject({
      kind: 'hydration-mismatch',
      expected: '<app-trip-list>\n  <ul>…</ul>\n</app-trip-list>',
      actual: '<app-trip-list>\n  <ol>…</ol>\n</app-trip-list>',
    });
  });

  it('sends the missing token and path of an NG0201 and finds the requesting component', async () => {
    const { reports, collector, host, fire } = setup(new TripList());
    fire(
      new RuntimeError(
        -201,
        'NG0201: No provider found for `TripApi`. Source: Standalone[App]. Path: TripList -> TripApi. Find more at https://angular.dev/errors/NG0201',
      ),
    );
    await collector.push();
    const [group] = reports.at(-1)!.errors;
    expect(group!.owner).toEqual({ id: elementId(host), name: 'TripList' });
    expect(group!.explain).toEqual({
      kind: 'missing-provider',
      token: 'TripApi',
      path: ['TripList', 'TripApi'],
      source: 'Standalone[App]',
    });
  });

  it('adds no explainer to other errors', async () => {
    const { reports, collector, fire } = setup(new TripList());
    fire(new Error('No seats left'));
    await collector.push();
    expect(reports.at(-1)!.errors[0]).not.toHaveProperty('explain');
  });
});
