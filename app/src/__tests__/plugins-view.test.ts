import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { travelView, type TravelSource } from '../../../src/app/devtools/travel-plugin';

const connection = vi.hoisted(() => ({ resolve: (_client: unknown) => {} }));

vi.mock('devframe/client', () => ({
  connectDevframe: () =>
    new Promise((resolve) => {
      connection.resolve = resolve;
    }),
}));

const { App } = await import('../app');
const { PluginsInspector, pluginsReporting, pluginsState } =
  await import('../pages/plugins-inspector');

const source = (saved = ['kyoto']): TravelSource => ({
  bookings: () => [
    {
      id: 'TRV-1041',
      destinationName: 'Kyoto',
      startDate: '2026-11-02',
      travelers: 2,
      total: 3120,
      email: 'ada@example.com',
    },
    {
      id: 'TRV-1042',
      destinationName: 'Lisbon',
      startDate: '2026-12-10',
      travelers: 1,
      total: 980,
      email: 'grace@example.com',
    },
  ],
  saved: () => saved,
  recentQueries: () => ['beach'],
  filters: () => ({ query: '', region: 'Europe', sort: 'price' }),
  unsaveAll: () => {},
});

const page = (pageId: string, extra: Record<string, unknown> = {}) => ({
  pageId,
  url: `http://localhost/${pageId}`,
  title: `Travel ${pageId}`,
  reportedAt: 5_000,
  plugins: [
    {
      id: 'travel',
      version: '1.0.0',
      title: 'Travel store',
      description: 'Bookings from the demo TravelStore.',
      apiVersion: 1,
      status: 'running',
      view: travelView(source()),
      actions: ['unsave-all'],
      ...extra,
    },
  ],
});

const serverTools = [
  {
    id: 'travel',
    version: '1.0.0',
    title: 'Travel store',
    tools: [
      {
        name: 'bookings',
        id: 'pangular:plugin:travel:bookings',
        safety: 'read',
        description: 'Bookings.',
        registered: true,
      },
      {
        name: 'clear-saved',
        id: 'pangular:plugin:travel:clear-saved',
        safety: 'action',
        description: 'Clears saved.',
        registered: false,
      },
    ],
  },
];

function fakeClient(value: unknown, configs: Record<string, unknown> = {}) {
  const calls: { name: string; args: unknown[] }[] = [];
  const rpc = {
    call: (name: string, ...args: unknown[]) => {
      calls.push({ name, args });
      return Promise.resolve(name === 'request-plugin-action' ? { ok: true } : []);
    },
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({
        value: () => (name === 'plugins' ? value : null),
        on: () => () => {},
      }),
  };
  const client = {
    status: 'connected',
    connectionMeta: { configs },
    scope: () => ({ rpc }),
    events: { on: () => () => {} },
  } as unknown as DevframeRpcClient;
  return { client, calls };
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

async function mount(value: unknown, configs: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(PluginsInspector);
  const fake = fakeClient(value, configs);
  fixture.componentRef.setInput('rpc', fake.client);
  document.body.append(host(fixture));
  await settle(fixture);
  return { fixture, calls: fake.calls };
}

function button(fixture: ComponentFixture<unknown>, name: string): HTMLButtonElement {
  const found = [...host(fixture).querySelectorAll('button')].find((b) =>
    (b.textContent ?? '').replace(/\s+/g, ' ').trim().startsWith(name),
  );
  if (!found) throw new Error(`No button ${name}`);
  return found;
}

afterEach(() => {
  document.body.innerHTML = '';
  location.hash = '';
  sessionStorage.clear();
});

describe('the plugins state', () => {
  it('lists pages newest first and knows when a plugin reports', () => {
    const state = pluginsState({
      pages: { a: { ...page('a'), reportedAt: 1 }, b: page('b') },
      server: [],
    });
    expect(state.pages.map((p) => p.pageId)).toEqual(['b', 'a']);
    expect(pluginsReporting({ pages: {}, server: [] })).toBe(false);
    expect(pluginsReporting({ pages: { a: page('a') }, server: [] })).toBe(true);
    expect(pluginsReporting({ pages: {}, server: serverTools })).toBe(true);
    expect(pluginsReporting(undefined)).toBe(false);
  });
});

describe('the Plugins tab', () => {
  it('says how to add a plugin when none reports', async () => {
    const { fixture } = await mount({ pages: {}, server: [] });
    expect(text(fixture)).toContain('No plugin reports yet.');
    expect(text(fixture)).toContain('registerPangularPlugin()');
  });

  it("renders the example plugin's stats, table, list and tree from its view", async () => {
    const { fixture } = await mount({ pages: { p1: page('p1') }, server: serverTools });
    const root = host(fixture);
    expect(root.querySelector('h2')?.textContent).toContain('Travel store');
    expect(text(fixture)).toContain('2 bookings, 1 saved destination');
    expect(text(fixture)).toContain('Region: Europe');
    expect([...root.querySelectorAll('h3')].map((h) => h.textContent?.trim())).toEqual([
      'Totals',
      'Bookings',
      'Recent searches',
      'Filters',
    ]);
    const headers = [...root.querySelectorAll('th')].map((th) => th.textContent?.trim());
    expect(headers).toEqual(['Booking', 'Destination', 'Starts', 'Travelers', 'Total', 'Email']);
    expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(root.querySelector('summary')).toBeNull();
    expect(text(fixture)).toContain('"Europe"');
    // The server plugin's tools, with the hidden one marked.
    expect(text(fixture)).toContain('pangular:plugin:travel:bookings');
    expect(text(fixture)).toContain('Hidden from agents by the config');
    expect(text(fixture)).toContain('3 of 3 rows and items');
  });

  it('filters rows and items, and offers Clear filter when nothing matches', async () => {
    const { fixture } = await mount({ pages: { p1: page('p1') }, server: [] });
    const search = host(fixture).querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'lisbon';
    search.dispatchEvent(new Event('input'));
    await settle(fixture);
    expect(host(fixture).querySelectorAll('tbody tr')).toHaveLength(1);
    expect(text(fixture)).toContain('1 of 3 rows and items');
    search.value = 'zzz';
    search.dispatchEvent(new Event('input'));
    await settle(fixture);
    expect(text(fixture)).toContain('No row or item matches “zzz”.');
    button(fixture, 'Clear filters').click();
    await settle(fixture);
    expect(host(fixture).querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('asks before an action that says so, then runs it on the page', async () => {
    const { fixture, calls } = await mount({ pages: { p1: page('p1') }, server: [] });
    button(fixture, 'Clear saved destinations').click();
    await settle(fixture);
    expect(text(fixture)).toContain('Remove every saved destination from the store?');
    button(fixture, 'Cancel').click();
    await settle(fixture);
    expect(calls.filter((call) => call.name === 'request-plugin-action')).toEqual([]);
    button(fixture, 'Clear saved destinations').click();
    await settle(fixture);
    button(fixture, 'Clear saved destinations').click();
    await settle(fixture);
    expect(calls.filter((call) => call.name === 'request-plugin-action')).toEqual([
      {
        name: 'request-plugin-action',
        args: [{ pageId: 'p1', pluginId: 'travel', action: 'unsave-all' }],
      },
    ]);
    expect(host(fixture).querySelector('[role="status"].result')?.textContent).toBe('Done.');
  });

  it('says actions are off when the config blocks them', async () => {
    const { fixture } = await mount(
      { pages: { p1: page('p1') }, server: [] },
      { pangular: { plugins: { travel: { actions: false } } } },
    );
    expect(text(fixture)).toContain('Actions of this plugin are turned off');
    expect(() => button(fixture, 'Clear saved destinations')).toThrow();
  });

  it('shows why a plugin failed', async () => {
    const { fixture } = await mount({
      pages: {
        p1: page('p1', { status: 'error', error: 'TypeError: store is undefined', view: null }),
      },
      server: [],
    });
    expect(text(fixture)).toContain('Failed');
    expect(host(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      'store is undefined',
    );
    expect(text(fixture)).toContain('has not reported a view yet');
  });

  it('switches between plugins and pages', async () => {
    const other = {
      ...page('p2'),
      plugins: [
        {
          id: 'query',
          version: '5.0.0',
          title: 'Query cache',
          status: 'running',
          view: { sections: [{ kind: 'text', title: 'Note', text: 'Two queries' }] },
          actions: [],
        },
      ],
    };
    const { fixture } = await mount({
      pages: { p1: page('p1'), p2: other, p3: { ...page('p3'), reportedAt: 1 } },
      server: [],
    });
    const plugins = [...host(fixture).querySelectorAll('[aria-label="Plugin"] button')];
    expect(plugins.map((b) => b.textContent?.trim())).toEqual(['Query cache', 'Travel store']);
    // Query cache comes first and runs on one page only.
    expect(text(fixture)).toContain('Two queries');
    expect(host(fixture).querySelector('[aria-label="Page"]')).toBeNull();
    button(fixture, 'Travel store').click();
    await settle(fixture);
    expect(text(fixture)).toContain('2 bookings');
    expect(host(fixture).querySelector('[aria-label="Page"]')).not.toBeNull();
  });
});

describe('the Plugins tab in the shell', () => {
  async function open(value: unknown, configs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(App);
    document.body.append(host(fixture));
    await settle(fixture);
    connection.resolve(fakeClient(value, configs).client);
    await settle(fixture);
    return fixture;
  }
  const tabs = (fixture: ComponentFixture<unknown>) =>
    [...host(fixture).querySelectorAll('nav button')].map((b) => b.textContent?.trim());

  it('appears once a plugin reports, and not with the inspector off', async () => {
    const none = await open({ pages: {}, server: [] });
    expect(tabs(none)).not.toContain('Plugins');
    none.destroy();
    document.body.innerHTML = '';

    const some = await open({ pages: { p1: page('p1') }, server: [] });
    expect(tabs(some)).toContain('Plugins');
    some.destroy();
    document.body.innerHTML = '';

    const off = await open(
      { pages: { p1: page('p1') }, server: [] },
      { pangular: { inspectors: { plugins: false } } },
    );
    expect(tabs(off)).not.toContain('Plugins');
  });
});
