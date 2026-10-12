import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALL_PAGES,
  binTimeline,
  extentOf,
  filterTimeline,
  inRange,
  mergeTimeline,
  nearestEvent,
  panRange,
  rangeBetween,
  storedHiddenLayers,
  timelinePages,
  zoomRange,
  type TimelineLayer,
  type TimelineSources,
} from '../pages/timeline-data';

vi.mock('devframe/client', () => ({ connectDevframe: () => new Promise(() => {}) }));

const { Timeline, TIMELINE_LIST_CAP } = await import('../pages/timeline');

const ALL_LAYERS = new Set<TimelineLayer>(['router', 'http', 'ngrx', 'cd', 'forms', 'signals']);

/** One page of each source, with events spread over a few seconds. */
function sources(): TimelineSources {
  return {
    router: {
      pages: [
        {
          pageId: 'p1',
          reportedAt: 0,
          snapshot: { url: '/trips' },
          navigations: [
            {
              id: 1,
              url: '/trips',
              trigger: 'imperative',
              startedAt: 1_000,
              endedAt: 1_040,
              outcome: 'succeeded',
            },
            {
              id: 2,
              url: '/admin',
              trigger: 'imperative',
              startedAt: 5_000,
              endedAt: 5_010,
              outcome: 'failed',
            },
            {
              id: 3,
              url: '/probe',
              trigger: 'x',
              startedAt: 5_500,
              outcome: 'pending',
              probe: true,
            },
            {
              id: 4,
              url: '/early',
              trigger: 'x',
              startedAt: 600,
              outcome: 'succeeded',
              beforeConnect: true,
            },
          ],
        },
      ],
    },
    http: {
      serverCalls: [
        {
          id: 's1',
          url: 'http://localhost/api/trips',
          method: 'GET',
          status: 200,
          durationMs: 30,
          side: 'server',
          at: 500,
          pageUrl: '/trips',
        },
      ],
      pages: [
        {
          pageId: 'p1',
          url: '/trips',
          initialUrl: '/trips',
          title: 'Trips',
          calls: [
            {
              id: 'c1',
              url: '/api/seats?trip=42',
              method: 'POST',
              status: 503,
              durationMs: 120,
              side: 'client',
              at: 2_000,
            },
          ],
        },
        {
          pageId: 'p2',
          url: '/home',
          title: 'Home',
          calls: [
            { id: 'c1', url: '/api/me', method: 'GET', status: 200, durationMs: 5, at: 2_500 },
          ],
        },
      ],
    },
    ngrx: {
      pages: [
        {
          pageId: 'p1',
          url: '/trips',
          title: 'Trips',
          log: [
            {
              seq: 1,
              source: 'store',
              storeId: 'store',
              type: '[Trips] Load',
              timestamp: 3_000,
              diff: [{ path: 'trips.loading', op: 'change' }],
              restorable: true,
            },
          ],
        },
      ],
    },
    cd: {
      pages: {
        p1: {
          pageId: 'p1',
          cycles: [{ id: 7, at: 3_500, ms: 22, passes: 1, checks: 12, components: [] }],
        },
      },
    },
    forms: {
      events: [{ formId: 'f1@p1', path: 'email', type: 'value', timestamp: 4_000, origin: 'user' }],
    },
    signals: {
      pages: {
        p1: {
          pageId: 'p1',
          nodes: [{ id: 'n1', label: 'count', kind: 'signal' }],
          history: {
            n1: [
              { epoch: 1, value: 0, at: 100, source: 'initial' },
              { epoch: 2, value: 1, at: 4_500, source: 'write' },
            ],
          },
        },
      },
    },
  };
}

describe('timeline data', () => {
  it('merges every source on one time axis, oldest first', () => {
    const events = mergeTimeline(sources());
    expect(events.map((event) => event.layer)).toEqual([
      'http',
      'router',
      'http',
      'http',
      'ngrx',
      'cd',
      'forms',
      'signals',
      'router',
    ]);
    expect(events.map((event) => event.at)).toEqual(
      [...events.map((e) => e.at)].sort((a, b) => a - b),
    );
    // Probes, navigations without a real start and a signal's initial value are not events.
    expect(events.some((event) => event.title.includes('/probe'))).toBe(false);
    expect(events.some((event) => event.title.includes('/early'))).toBe(false);
    expect(events.filter((event) => event.layer === 'signals')).toHaveLength(1);
  });

  it('gives every event a unique key, a tone for problems and a link to its tab', () => {
    const events = mergeTimeline(sources());
    expect(new Set(events.map((event) => event.key)).size).toBe(events.length);
    const failed = events.find((event) => event.title === 'Navigation to /admin')!;
    expect(failed.tone).toBe('danger');
    expect(failed.link).toEqual({ tab: 'routes', page: 'p1' });
    const post = events.find((event) => event.title.startsWith('POST'))!;
    expect(post.title).toBe('POST /api/seats?trip=42');
    expect(post.tone).toBe('danger');
    expect(events.find((event) => event.layer === 'cd')!.tone).toBe('warn');
    // Forms can select the form itself through the deep link.
    expect(events.find((event) => event.layer === 'forms')!.link).toEqual({
      tab: 'forms',
      id: 'f1@p1',
      page: 'p1',
    });
  });

  it('gives a server call to the page its SSR request rendered', () => {
    const server = mergeTimeline(sources()).find((event) => event.key.startsWith('http:server'))!;
    expect(server.pageId).toBe('p1');
    expect(server.title).toBe('GET /api/trips');
  });

  it('keeps keys unique when a source repeats an id', () => {
    const repeated = {
      ngrx: {
        pages: [
          {
            pageId: 'p1',
            log: [
              { seq: 1, storeId: 's', type: 'a', timestamp: 1, diff: [] },
              { seq: 1, storeId: 's', type: 'b', timestamp: 2, diff: [] },
            ],
          },
        ],
      },
    };
    const keys = mergeTimeline(repeated).map((event) => event.key);
    expect(new Set(keys).size).toBe(2);
  });

  it('ignores sources it cannot read', () => {
    expect(
      mergeTimeline({ router: 'nope', http: { pages: 3 }, cd: null, forms: { events: {} } }),
    ).toEqual([]);
  });

  it('filters by layer, page and text', () => {
    const events = mergeTimeline(sources());
    const only = (layers: TimelineLayer[], pageId = ALL_PAGES, query = '') =>
      filterTimeline(events, { layers: new Set(layers), pageId, query });
    expect(only(['http']).length).toBe(3);
    expect(only(['http'], 'p2').map((event) => event.title)).toEqual(['GET /api/me']);
    expect(only([...ALL_LAYERS], ALL_PAGES, 'SEATS').map((event) => event.layer)).toEqual(['http']);
    expect(only([...ALL_LAYERS], 'p1').every((event) => event.pageId === 'p1')).toBe(true);
  });

  it('names pages from the sources that know their URL or title', () => {
    const merged = mergeTimeline(sources());
    expect(timelinePages(sources(), merged)).toEqual([
      { pageId: 'p1', label: 'Trips' },
      { pageId: 'p2', label: 'Home' },
    ]);
  });

  it('zooms, pans and selects a range inside the events', () => {
    const events = mergeTimeline(sources());
    const bounds = extentOf(events)!;
    expect(bounds).toEqual({ start: 500, end: 5_010 });
    const zoomed = zoomRange(bounds, 0.5, bounds)!;
    expect(zoomed.end - zoomed.start).toBeCloseTo((5_010 - 500) / 2);
    expect(zoomRange(zoomed, 4, bounds)).toBeNull();
    const earlier = panRange(zoomed, -10, bounds);
    expect(earlier.start).toBe(bounds.start);
    const picked = rangeBetween(bounds, 0.6, 0.2)!;
    expect(picked.start).toBeLessThan(picked.end);
    expect(inRange(events, picked).every((e) => e.at >= picked.start && e.at <= picked.end)).toBe(
      true,
    );
    expect(rangeBetween(bounds, 0.5, 0.5)).toBeNull();
  });

  it('draws a few thousand events as at most one mark per slice and layer', () => {
    const many = {
      ngrx: {
        pages: [
          {
            pageId: 'p1',
            log: Array.from({ length: 5_000 }, (_, i) => ({
              seq: i,
              storeId: 's',
              type: 'tick',
              timestamp: i,
              diff: [],
            })),
          },
        ],
      },
    };
    const events = mergeTimeline(many);
    const bins = binTimeline(events, extentOf(events)!, 240);
    expect(bins.length).toBeLessThanOrEqual(240);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(5_000);
  });

  it('marks a slice with the worst tone of its events, and finds the nearest event', () => {
    const events = mergeTimeline(sources());
    const bins = binTimeline(events, { start: 0, end: 10_000 }, 1);
    expect(bins.find((bin) => bin.layer === 'router')!.tone).toBe('danger');
    expect(nearestEvent(events, 'router', 4_000)!.title).toBe('Navigation to /admin');
  });
});

function fakeClient(states: Record<string, unknown>, configs: Record<string, unknown> = {}) {
  const rpc = {
    call: () => Promise.resolve([]),
    sharedState: (name: string) =>
      name in states
        ? Promise.resolve({ value: () => states[name], on: () => () => {} })
        : Promise.reject(new Error('no state')),
  };
  return {
    connectionMeta: { configs },
    scope: () => ({ rpc }),
  } as unknown as DevframeRpcClient;
}

function wire(source: TimelineSources) {
  return {
    router: source.router,
    http: source.http,
    'ngrx-store': source.ngrx,
    'change-detection': source.cd,
    forms: source.forms,
    'signal-graph': source.signals,
  };
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

const host = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;
const text = (fixture: ComponentFixture<unknown>) =>
  (host(fixture).textContent ?? '').replace(/\s+/g, ' ');

async function mount(states: Record<string, unknown>) {
  const fixture = TestBed.createComponent(Timeline);
  fixture.componentRef.setInput('rpc', fakeClient(states));
  document.body.append(host(fixture));
  await settle(fixture);
  return fixture;
}

function layerButton(fixture: ComponentFixture<unknown>, label: string): HTMLButtonElement {
  const found = [...host(fixture).querySelectorAll<HTMLButtonElement>('button.layer')].find(
    (button) => (button.textContent ?? '').trim().startsWith(label),
  );
  if (!found) throw new Error(`No layer ${label}`);
  return found;
}

const rows = (fixture: ComponentFixture<unknown>) => [
  ...host(fixture).querySelectorAll<HTMLButtonElement>('button.row'),
];

beforeEach(() => localStorage.clear());
afterEach(() => {
  document.body.innerHTML = '';
});

describe('the Timeline tab', () => {
  it('says where events come from when there are none', async () => {
    const fixture = await mount(wire({}));
    expect(text(fixture)).toContain('Nothing on the timeline yet.');
  });

  it('offers Retry when the server sends no state at all', async () => {
    const fixture = await mount({});
    expect(host(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      "Can't read the timeline",
    );
  });

  it('lists every event newest first, with an accessible chart summary', async () => {
    const fixture = await mount(wire(sources()));
    const titles = rows(fixture).map((row) => row.querySelector('.title')!.textContent);
    expect(titles[0]).toBe('Navigation to /admin');
    expect(titles.at(-1)).toBe('GET /api/trips');
    expect(text(fixture)).toContain('9 of 9 events');
    const chart = host(fixture).querySelector('[role="img"]')!;
    expect(chart.getAttribute('aria-label')).toContain('Router 2');
    expect(host(fixture).querySelectorAll('h2')[0].textContent).toBe('Time axis');
  });

  it('turns a layer off and remembers it', async () => {
    const fixture = await mount(wire(sources()));
    const http = layerButton(fixture, 'HTTP');
    expect(http.getAttribute('aria-pressed')).toBe('true');
    http.click();
    await settle(fixture);
    expect(layerButton(fixture, 'HTTP').getAttribute('aria-pressed')).toBe('false');
    expect(rows(fixture).some((row) => row.textContent!.includes('POST'))).toBe(false);
    expect(text(fixture)).toContain('6 of 9 events');
    expect(storedHiddenLayers()).toEqual(['http']);

    const again = await mount(wire(sources()));
    expect(layerButton(again, 'HTTP').getAttribute('aria-pressed')).toBe('false');
  });

  it('hides the layer of an inspector that is turned off', async () => {
    const fixture = TestBed.createComponent(Timeline);
    fixture.componentRef.setInput(
      'rpc',
      fakeClient(wire(sources()), { pangular: { inspectors: { ngrx: false } } }),
    );
    await settle(fixture);
    const labels = [...host(fixture).querySelectorAll('button.layer')].map((b) =>
      b.textContent!.trim(),
    );
    expect(labels.some((label) => label.startsWith('NgRx'))).toBe(false);
  });

  it('moves through the list with the arrow keys and opens an event in its tab', async () => {
    const fixture = await mount(wire(sources()));
    const opened: unknown[] = [];
    fixture.componentInstance.open.subscribe((link) => opened.push(link));
    const [first, second] = rows(fixture);
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(second);
    second.click();
    await settle(fixture);
    expect(second.getAttribute('aria-current')).toBe('true');
    const open = [...host(fixture).querySelectorAll('button')].find((b) =>
      b.textContent!.includes('Open in'),
    )!;
    expect(open.textContent!.trim()).toBe('Open in Signals');
    open.click();
    expect(opened).toEqual([{ tab: 'signals', page: 'p1' }]);
  });

  it('filters by text, says when nothing matches, and clears the filters', async () => {
    const fixture = await mount(wire(sources()));
    const search = host(fixture).querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'no such thing';
    search.dispatchEvent(new Event('input'));
    await settle(fixture);
    expect(text(fixture)).toContain('No event matches the filters.');
    const clear = [...host(fixture).querySelectorAll('button')].find(
      (b) => b.textContent!.trim() === 'Clear filters',
    )!;
    clear.click();
    await settle(fixture);
    expect(rows(fixture)).toHaveLength(9);
  });

  it('zooms in from the toolbar and back out to everything', async () => {
    const fixture = await mount(wire(sources()));
    const button = (name: string) =>
      [...host(fixture).querySelectorAll<HTMLButtonElement>('.zoom button')].find(
        (b) => b.textContent!.trim() === name,
      )!;
    expect(button('Show all').disabled).toBe(true);
    button('Zoom in').click();
    await settle(fixture);
    expect(button('Show all').disabled).toBe(false);
    expect(rows(fixture).length).toBeLessThan(9);
    button('Show all').click();
    await settle(fixture);
    expect(rows(fixture)).toHaveLength(9);
  });

  it('filters to one page', async () => {
    const fixture = await mount(wire(sources()));
    fixture.componentInstance.pageId.set('p2');
    await settle(fixture);
    expect(rows(fixture).map((row) => row.querySelector('.title')!.textContent)).toEqual([
      'GET /api/me',
    ]);
  });

  it('renders a capped list for thousands of events and says so', async () => {
    const log = Array.from({ length: 3_000 }, (_, i) => ({
      seq: i,
      storeId: 's',
      type: `tick ${i}`,
      timestamp: i * 10,
      diff: [],
    }));
    const fixture = await mount(wire({ ngrx: { pages: [{ pageId: 'p1', log }] } }));
    expect(rows(fixture)).toHaveLength(TIMELINE_LIST_CAP);
    expect(text(fixture)).toContain(`Showing the newest ${TIMELINE_LIST_CAP} of 3000 events`);
    expect(host(fixture).querySelectorAll('rect.mark').length).toBeLessThanOrEqual(240);
  });
});
