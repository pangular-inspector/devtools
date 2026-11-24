import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ALL_PAGES,
  callRows,
  defaultWebMcpPage,
  droppedCalls,
  toolRows,
  traceRow,
  valueText,
  webMcpPages,
} from '../pages/webmcp-data';

vi.mock('devframe/client', () => ({ connectDevframe: () => new Promise(() => {}) }));

const { WebMcpInspector } = await import('../pages/webmcp-inspector');

/** One page with a read-only tool, a form tool and a failed duplicate, and four calls. */
function webmcpState() {
  return {
    pages: {
      p1: {
        pageId: 'p1',
        url: 'http://localhost/trips',
        title: 'Trips',
        modelContext: true,
        reportedAt: 2,
        dropped: 3,
        tools: [
          {
            name: 'search-trips',
            description: 'Finds trips by city',
            status: 'registered',
            seen: 'register',
            annotations: { readOnlyHint: true },
            inputs: ['query: string', 'limit: number'],
            required: ['query'],
          },
          {
            name: 'book-seat',
            description: 'Books a seat',
            status: 'registered',
            seen: 'register',
            formId: 'f1@p1',
          },
          {
            name: 'book-seat',
            description: '',
            status: 'failed',
            seen: 'register',
            error: 'A tool with this name exists',
            duplicate: true,
          },
        ],
        calls: [
          {
            id: 1,
            tool: 'search-trips',
            at: 10_000,
            ms: 50,
            outcome: 'done',
            args: { query: 'paris', token: '[masked]' },
            result: { count: 2 },
          },
          {
            id: 2,
            tool: 'book-seat',
            at: 20_000,
            ms: 12,
            outcome: 'threw',
            detail: 'Boom',
            formId: 'f1@p1',
            caused: [{ layer: 'forms', key: 'f1@p1:3' }],
          },
          { id: 3, tool: 'search-trips', at: 30_000, ms: 20, outcome: 'done' },
          { id: 4, tool: 'search-trips', at: 40_000, ms: 20, outcome: 'done', userInput: true },
        ],
      },
    },
  };
}

/** The other inspectors' states the trace reads, as the server sends them. */
function traceStates() {
  return {
    http: {
      pages: [
        {
          pageId: 'p1',
          calls: [
            { id: 'h1', url: '/api/trips', method: 'POST', status: 201, at: 10_010 },
            { id: 'h2', url: '/api/me', method: 'GET', status: 200, at: 40_010 },
          ],
        },
      ],
    },
    forms: {
      events: [
        { formId: 'f1@p1', seq: 3, type: 'submit', path: '', timestamp: 20_005, origin: 'agent' },
      ],
    },
    'signal-graph': {
      pages: {
        p1: {
          pageId: 'p1',
          nodes: [{ id: 'n1', label: 'count', kind: 'signal' }],
          history: { n1: [{ epoch: 2, value: 1, at: 30_005, source: 'write' }] },
        },
      },
    },
  };
}

const sources = () => {
  const states = traceStates();
  return { http: states.http, forms: states.forms, signals: states['signal-graph'] };
};

describe('WebMCP data', () => {
  it('reads pages and picks this tab page, the only page, or all pages', () => {
    const pages = webMcpPages(webmcpState());
    expect(pages.map((page) => page.pageId)).toEqual(['p1']);
    expect(webMcpPages({ pages: 'nope' })).toEqual([]);
    expect(webMcpPages(null)).toEqual([]);
    expect(defaultWebMcpPage(pages, null)).toBe('p1');
    expect(defaultWebMcpPage([...pages, { ...pages[0], pageId: 'p2' }], null)).toBe(ALL_PAGES);
    expect(defaultWebMcpPage([...pages, { ...pages[0], pageId: 'p2' }], 'p2')).toBe('p2');
  });

  it('maps tools with their status, claims and inputs', () => {
    const [search, book, duplicate] = toolRows(webMcpPages(webmcpState()), ALL_PAGES);
    expect(search).toMatchObject({
      name: 'search-trips',
      statusText: 'registered',
      tone: 'ok',
      readOnly: true,
      claims: ['readOnlyHint: true'],
      inputs: [
        { text: 'query: string', required: true },
        { text: 'limit: number', required: false },
      ],
    });
    // A tool without readOnlyHint is treated as able to change data.
    expect(book).toMatchObject({ readOnly: false, claims: [], formId: 'f1@p1' });
    expect(duplicate).toMatchObject({
      tone: 'danger',
      duplicate: true,
      error: 'A tool with this name exists',
    });
    expect(new Set([search.key, book.key, duplicate.key]).size).toBe(3);
  });

  it('lists calls newest first with masked values as text', () => {
    const calls = callRows(webMcpPages(webmcpState()), ALL_PAGES);
    expect(calls.map((call) => call.id)).toEqual(['4', '3', '2', '1']);
    const first = calls[3];
    expect(first).toMatchObject({ key: 'p1:1', outcomeText: 'done', tone: 'ok', ms: 50 });
    expect(first.args).toContain('"token": "[masked]"');
    expect(first.result).toContain('"count": 2');
    expect(calls[2]).toMatchObject({ outcomeText: 'threw', tone: 'danger', detail: 'Boom' });
    expect(valueText('<b>x</b>')).toBe('<b>x</b>');
    expect(droppedCalls(webMcpPages(webmcpState()), ALL_PAGES)).toBe(3);
  });

  it('warns when a read-only tool changed data outside signals', () => {
    const pages = webMcpPages(webmcpState());
    const call = callRows(pages, ALL_PAGES).find((c) => c.id === '1')!;
    const trace = traceRow(call, pages, sources());
    expect(trace.verdict).toBe('warning');
    expect(trace.effects).toEqual([
      expect.objectContaining({
        layer: 'http',
        title: 'POST /api/trips',
        certainty: 'during',
        certaintyText: 'probably caused',
        link: { tab: 'network', page: 'p1' },
        tabLabel: 'SSR & HTTP',
      }),
    ]);
  });

  it('marks effects a collector tied to the call as caused and links the form', () => {
    const pages = webMcpPages(webmcpState());
    const call = callRows(pages, ALL_PAGES).find((c) => c.id === '2')!;
    const trace = traceRow(call, pages, sources());
    expect(trace.verdict).toBeUndefined();
    expect(trace.effects[0]).toMatchObject({
      layer: 'forms',
      certainty: 'caused',
      certaintyText: 'caused',
      link: { tab: 'forms', id: 'f1@p1', page: 'p1' },
    });
  });

  it('calls a signal write by a read-only tool local state, not a warning', () => {
    const pages = webMcpPages(webmcpState());
    const call = callRows(pages, ALL_PAGES).find((c) => c.id === '3')!;
    const trace = traceRow(call, pages, sources());
    expect(trace.verdict).toBe('info');
    expect(trace.verdictText).toContain('changed local state');
    expect(trace.effects[0]).toMatchObject({ layer: 'signals', tabLabel: 'Signals' });
  });

  it('lists only caused effects while the user was active', () => {
    const pages = webMcpPages(webmcpState());
    const call = callRows(pages, ALL_PAGES).find((c) => c.id === '4')!;
    const trace = traceRow(call, pages, sources());
    expect(trace.userInput).toBe(true);
    expect(trace.effects).toEqual([]);
  });
});

function fakeClient(states: Record<string, unknown>) {
  const rpc = {
    call: () => Promise.resolve([]),
    sharedState: (name: string) =>
      name in states
        ? Promise.resolve({ value: () => states[name], on: () => () => {} })
        : Promise.reject(new Error('no state')),
  };
  return {
    connectionMeta: { configs: {} },
    scope: () => ({ rpc }),
  } as unknown as DevframeRpcClient;
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
const rows = (fixture: ComponentFixture<unknown>) => [
  ...host(fixture).querySelectorAll<HTMLButtonElement>('button.row'),
];
const button = (fixture: ComponentFixture<unknown>, label: string) =>
  [...host(fixture).querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    (b.textContent ?? '').replace(/\s+/g, ' ').trim().startsWith(label),
  )!;

async function mount(states: Record<string, unknown>) {
  const fixture = TestBed.createComponent(WebMcpInspector);
  fixture.componentRef.setInput('rpc', fakeClient(states));
  document.body.append(host(fixture));
  await settle(fixture);
  return fixture;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the WebMCP tab', () => {
  it('says how to get data when no page reports WebMCP', async () => {
    const fixture = await mount({ webmcp: { pages: {} } });
    expect(text(fixture)).toContain('No page reports WebMCP yet.');
  });

  it('offers Retry when the server has no WebMCP state', async () => {
    const fixture = await mount({});
    expect(host(fixture).querySelector('[role="alert"]')?.textContent).toContain(
      "Can't read WebMCP tools",
    );
  });

  it('says a browser agent sees no tools without modelContext', async () => {
    const state = webmcpState();
    const page = { ...state.pages.p1, modelContext: false, tools: [], calls: [] };
    const fixture = await mount({ webmcp: { pages: { p1: page } } });
    expect(text(fixture)).toContain('a browser agent sees none of these tools');
    expect(text(fixture)).toContain('No tools.');
    button(fixture, 'Calls').click();
    await settle(fixture);
    expect(text(fixture)).toContain('No calls yet.');
  });

  it('lists tools and shows what a tool claims', async () => {
    const fixture = await mount({ webmcp: webmcpState(), ...traceStates() });
    expect(host(fixture).querySelector('h2')!.textContent).toBe('Tools');
    expect(rows(fixture)).toHaveLength(3);
    expect(text(fixture)).toContain('3 of 3 tools');
    rows(fixture)[1].click();
    await settle(fixture);
    const opened: unknown[] = [];
    fixture.componentInstance.open.subscribe((link) => opened.push(link));
    expect(text(fixture)).toContain('Annotations claimed by the page');
    expect(text(fixture)).toContain('may change data');
    button(fixture, 'Show form').click();
    expect(opened).toEqual([{ tab: 'forms', id: 'f1@p1', page: 'p1' }]);
  });

  it('lists calls newest first and shows a call with its effects and verdict', async () => {
    const fixture = await mount({ webmcp: webmcpState(), ...traceStates() });
    button(fixture, 'Calls').click();
    await settle(fixture);
    expect(text(fixture)).toContain('3 older entries were dropped');
    const calls = rows(fixture);
    expect(calls.map((row) => row.getAttribute('data-key'))).toEqual([
      'p1:4',
      'p1:3',
      'p1:2',
      'p1:1',
    ]);
    // The read-only tool that posted is flagged in the list.
    expect(calls[3].textContent).toContain('changed data');
    calls[3].click();
    await settle(fixture);
    expect(text(fixture)).toContain('claims readOnlyHint, but this call changed data');
    expect(text(fixture)).toContain('probably caused');
    expect(host(fixture).querySelector('pre')!.textContent).toContain('[masked]');
    const opened: unknown[] = [];
    fixture.componentInstance.open.subscribe((link) => opened.push(link));
    button(fixture, 'Open in SSR & HTTP').click();
    expect(opened).toEqual([{ tab: 'network', page: 'p1' }]);

    rows(fixture)[0].click();
    await settle(fixture);
    expect(text(fixture)).toContain(
      'The user was active during this call, so only caused effects are listed.',
    );
  });

  it('selects the call a deep link names', async () => {
    const fixture = TestBed.createComponent(WebMcpInspector);
    fixture.componentRef.setInput('rpc', fakeClient({ webmcp: webmcpState(), ...traceStates() }));
    fixture.componentRef.setInput('focus', { id: '2', page: 'p1' });
    let handled = 0;
    fixture.componentInstance.focusHandled.subscribe(() => handled++);
    await settle(fixture);
    expect(handled).toBe(1);
    expect(fixture.componentInstance.view()).toBe('calls');
    const selected = host(fixture).querySelector('button.row[aria-current="true"]')!;
    expect(selected.getAttribute('data-key')).toBe('p1:2');
    expect(text(fixture)).toContain('Boom');
  });
});
