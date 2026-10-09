import { describe, expect, it } from 'vitest';
import {
  INSPECT_SIGNAL_STORE_DESCRIPTION,
  SIGNAL_STORE_HISTORY_DESCRIPTION,
  NGRX_LIVE_TOOL_MAX,
  inspectSignalStoreText,
  signalStoreHistoryText,
  withUntrustedPreamble,
} from '../ngrx-live-tools.ts';
import { mergeNgrxReport, type NgrxPages } from '../ngrx-tools.ts';
import type { NgrxLogEntry, NgrxPageReport, NgrxSignalStoreInfo } from '../../ngrx-shared.ts';

function store(overrides: Partial<NgrxSignalStoreInfo> = {}): NgrxSignalStoreInfo {
  return {
    id: 'ngrx-1',
    kind: 'signal-store',
    className: 'CounterStore',
    scope: 'root',
    stateKeys: ['count'],
    state: { count: 0 },
    computed: {},
    methods: [{ name: 'increment', calls: 1 }],
    references: ['App.store'],
    writable: true,
    ...overrides,
  };
}

function logEntry(overrides: Partial<NgrxLogEntry> & Pick<NgrxLogEntry, 'seq'>): NgrxLogEntry {
  return {
    source: 'signal-store',
    storeId: 'ngrx-1',
    type: 'increment',
    timestamp: overrides.seq,
    diff: [{ path: 'count', op: 'change', before: 0, after: 1 }],
    restorable: true,
    ...overrides,
  };
}

function pagesWith(stores: NgrxSignalStoreInfo[], log: NgrxLogEntry[] = []): NgrxPages {
  const pages: NgrxPages = new Map();
  const report: NgrxPageReport = {
    pageId: 'p1',
    session: 's1',
    url: '/app',
    title: 'My App',
    stores,
    classic: null,
    log,
  };
  mergeNgrxReport(pages, report, []);
  return pages;
}

describe('inspect-signal-store', () => {
  it('says live data needs a connected page when nothing has been reported', () => {
    expect(inspectSignalStoreText(new Map())).toMatch(/no ngrx state has been reported/i);
  });

  it('lists every store on every page when no storeId is given', () => {
    const pages = pagesWith([store(), store({ id: 'ngrx-2', className: 'OtherStore' })]);
    const text = inspectSignalStoreText(pages);
    expect(text).toMatch(/ngrx-1/);
    expect(text).toMatch(/CounterStore/);
    expect(text).toMatch(/ngrx-2/);
    expect(text).toMatch(/OtherStore/);
  });

  it('returns the full detail of one store, including an entities summary', () => {
    const pages = pagesWith([
      store({
        entities: [{ idsKey: 'ids', entityMapKey: 'entityMap', ids: ['a'], count: 1 }],
      }),
    ]);
    const text = inspectSignalStoreText(pages, undefined, 'ngrx-1');
    expect(text).toMatch(/CounterStore/);
    expect(text).toMatch(/"count": 0/);
    expect(text).toMatch(/entityMap/);
    expect(text).toMatch(/1 entity/);
  });

  it('shows avg/last call duration per method when present, and omits it when absent', () => {
    const pages = pagesWith([
      store({
        methods: [
          { name: 'increment', calls: 3, avgDurationMs: 2, lastDurationMs: 4 },
          { name: 'reset', calls: 1 },
        ],
      }),
    ]);
    const text = inspectSignalStoreText(pages, undefined, 'ngrx-1');
    expect(text).toMatch(/`increment`: 3 call\(s\), avg 2ms, last 4ms/);
    expect(text).toMatch(/`reset`: 1 call\(s\)/);
    expect(text).not.toMatch(/reset`: 1 call\(s\), avg/);
  });

  it('says when a storeId is unknown and lists the known ids', () => {
    const pages = pagesWith([store()]);
    const text = inspectSignalStoreText(pages, undefined, 'nope');
    expect(text).toMatch(/no store `nope`/i);
    expect(text).toMatch(/ngrx-1/);
  });

  it('filters to one page, and says when that page is not reporting', () => {
    const pages = pagesWith([store()]);
    expect(inspectSignalStoreText(pages, 'p1')).toMatch(/ngrx-1/);
    expect(inspectSignalStoreText(pages, 'p2')).toMatch(/no page `p2`/i);
  });

  it('exposes a description that explains the live @ngrx/signals state', () => {
    expect(INSPECT_SIGNAL_STORE_DESCRIPTION).toMatch(/live @ngrx\/signals state/i);
  });

  it('includes the classic @ngrx/store state, not just its scope and devtools status', () => {
    const pages: NgrxPages = new Map();
    mergeNgrxReport(
      pages,
      {
        pageId: 'p1',
        session: 's1',
        url: '/app',
        title: 'My App',
        stores: [],
        classic: { state: { todos: ['a', 'b'] }, devtools: true, scope: 'root' },
        log: [],
      },
      [],
    );
    const text = inspectSignalStoreText(pages);
    expect(text).toMatch(/classic @ngrx\/store on page `p1`/);
    expect(text).toMatch(/"todos"/);
    expect(text).toMatch(/"a"/);
  });
});

describe('signal-store-history', () => {
  it('says nothing has changed yet when the page has no log', () => {
    const pages = pagesWith([store()]);
    expect(signalStoreHistoryText(pages)).toMatch(/no ngrx changes/i);
  });

  it('lists entries oldest first, across sources', () => {
    const pages = pagesWith(
      [store()],
      [
        logEntry({ seq: 2, timestamp: 200 }),
        logEntry({ seq: 1, timestamp: 100 }),
        logEntry({
          seq: 3,
          source: 'event',
          storeId: 'event',
          type: 'increment',
          eventType: 'increment',
          payload: 1,
          diff: [],
          restorable: false,
          timestamp: 300,
        }),
      ],
    );
    const text = signalStoreHistoryText(pages);
    const order = [...text.matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
    expect(order).toEqual([1, 2, 3]);
    expect(text).toMatch(/dispatched event `increment`/);
  });

  it('filters by storeId, excluding unrelated events', () => {
    const pages = pagesWith(
      [store(), store({ id: 'ngrx-2' })],
      [
        logEntry({ seq: 1, storeId: 'ngrx-1' }),
        logEntry({ seq: 2, storeId: 'ngrx-2' }),
        logEntry({
          seq: 3,
          source: 'event',
          storeId: 'event',
          type: 'x',
          eventType: 'x',
          diff: [],
          restorable: false,
        }),
      ],
    );
    const text = signalStoreHistoryText(pages, undefined, 'ngrx-1');
    expect(text).toMatch(/#1/);
    expect(text).not.toMatch(/#2/);
    expect(text).not.toMatch(/#3/);
  });

  it('filters by since, returning only later entries', () => {
    const pages = pagesWith(
      [store()],
      [logEntry({ seq: 1 }), logEntry({ seq: 2 }), logEntry({ seq: 3 })],
    );
    const text = signalStoreHistoryText(pages, undefined, undefined, 2);
    expect(text).not.toMatch(/#1\b/);
    expect(text).not.toMatch(/#2\b/);
    expect(text).toMatch(/#3\b/);
  });

  it('puts an arrow only between a before and an after value', () => {
    const pages = pagesWith(
      [store()],
      [
        logEntry({
          seq: 1,
          diff: [
            { path: 'ids[0]', op: 'remove', before: 'a' },
            { path: 'ids[1]', op: 'add', after: 'b' },
            { path: 'count', op: 'change', before: 0, after: 1 },
          ],
        }),
      ],
    );
    expect(signalStoreHistoryText(pages)).toContain(
      ': ids[0] remove "a"; ids[1] add "b"; count change 0 → 1',
    );
  });

  it('shows duration on a method-call entry when present, and omits it when absent', () => {
    const pages = pagesWith(
      [store()],
      [
        logEntry({ seq: 1, durationMs: 12 }),
        logEntry({ seq: 2, type: 'patchState', args: undefined }),
      ],
    );
    const text = signalStoreHistoryText(pages);
    expect(text).toMatch(/`increment` \(12ms\) on/);
    expect(text).toMatch(/`patchState` on/);
    expect(text).not.toMatch(/`patchState` \(/);
  });

  it('shows causedByEvent correlation on a signal-store entry', () => {
    const pages = pagesWith(
      [store()],
      [logEntry({ seq: 1, causedByEvent: { type: 'increment', payload: 1 } })],
    );
    expect(signalStoreHistoryText(pages)).toMatch(/caused by event `increment`/);
  });

  it('exposes a description that explains the change log and tagged events', () => {
    expect(SIGNAL_STORE_HISTORY_DESCRIPTION).toMatch(/change log/i);
    expect(SIGNAL_STORE_HISTORY_DESCRIPTION).toMatch(/withReducer/);
    expect(SIGNAL_STORE_HISTORY_DESCRIPTION).toMatch(
      /from the method.s start to that specific patch/,
    );
  });

  it('keeps the newest rows when the log exceeds the budget and notes the dropped count', () => {
    const long = 'x'.repeat(200);
    const log = Array.from({ length: 200 }, (_, i) => logEntry({ seq: i + 1, type: long }));
    const pages = pagesWith([store()], log);
    const text = signalStoreHistoryText(pages);
    // The oldest entries were dropped; the newest (#200) must still be present
    expect(text).toMatch(/#200\b/);
    expect(text).toMatch(/older.*omitted/i);
  });

  it('still shows the newest entry, clipped, when it alone exceeds the budget', () => {
    const huge = 'y'.repeat(40_000);
    const pages = pagesWith(
      [store()],
      [logEntry({ seq: 1 }), logEntry({ seq: 2, type: huge, args: undefined })],
    );
    const text = signalStoreHistoryText(pages);
    expect(text).toMatch(/#2\b/);
    expect(text).toMatch(/1 older entry was omitted/);
    expect(text.length).toBeLessThan(NGRX_LIVE_TOOL_MAX + 200);
  });

  it('requires page when since is supplied for multiple connected pages', () => {
    const pages: NgrxPages = new Map();
    for (const pid of ['p1', 'p2']) {
      mergeNgrxReport(
        pages,
        {
          pageId: pid,
          session: 's',
          url: '/',
          title: '',
          stores: [store()],
          classic: null,
          log: [logEntry({ seq: 1 })],
        },
        [],
      );
    }
    const text = signalStoreHistoryText(pages, undefined, undefined, 0);
    expect(text).toMatch(/pass `page`/i);
  });
});

describe('withUntrustedPreamble', () => {
  it('prefixes the untrusted-data line and leaves short text intact', () => {
    const text = withUntrustedPreamble('hello');
    expect(text).toMatch(/untrusted data/i);
    expect(text).toContain('hello');
  });

  it('caps text past NGRX_LIVE_TOOL_MAX so one giant store cannot blow out the context', () => {
    const big = 'x'.repeat(NGRX_LIVE_TOOL_MAX + 500);
    const text = withUntrustedPreamble(big);
    expect(text.endsWith('…')).toBe(true);
    expect(text.length).toBeLessThanOrEqual(NGRX_LIVE_TOOL_MAX + 200);
  });
});
