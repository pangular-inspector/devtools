// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createDeferTracker, type DeferDebugNg } from '../defer-blocks.ts';
import { elementById } from '../element-id.ts';
import { deferBlocksText, toComponentPage } from '../rpc/component-tools.ts';
import type { ComponentPage, DeferBlockInfo } from '../types.ts';

class _TripReviews {}

function page() {
  document.body.innerHTML = `
    <app-root ng-version="22.0.0">
      <app-trip-reviews><section class="reviews"></section></app-trip-reviews>
    </app-root>`;
  const root = document.querySelector('app-root')!;
  const reviews = document.querySelector('app-trip-reviews')!;
  const anchor = document.createComment('container');
  reviews.appendChild(anchor);
  const lazy = document.createComment('container');
  reviews.appendChild(lazy);
  const instances = new Map<Element, object>([
    [root, {}],
    [reviews, new _TripReviews()],
  ]);
  return { root, reviews, anchor, lazy, instances };
}

const block = (overrides: Record<string, unknown>) => ({
  type: 0,
  state: 'placeholder',
  incrementalHydrationState: 'not-configured',
  hasErrorBlock: false,
  loadingBlock: { exists: false, minimumTime: null, afterTime: null },
  placeholderBlock: { exists: true, minimumTime: 500 },
  triggers: ['on viewport'],
  rootNodes: [],
  ...overrides,
});

describe('createDeferTracker', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reports nothing when Angular exposes no defer block util', () => {
    const { instances } = page();
    const ng: DeferDebugNg = { getComponent: (el) => instances.get(el) ?? null };
    expect(createDeferTracker().collect(ng)).toBeUndefined();
    expect(createDeferTracker().collect(undefined)).toBeUndefined();
  });

  it('reads defer blocks with their owner, state, triggers and root elements', () => {
    const { root, reviews, anchor, lazy, instances } = page();
    const section = reviews.querySelector('section')!;
    let raw: unknown[] = [
      block({ hostNode: anchor, rootNodes: [section, document.createTextNode(' ')] }),
      { type: 1, items: [], hostNode: anchor, trackExpression: 'item' },
      block({
        hostNode: lazy,
        state: 'complete',
        incrementalHydrationState: 'dehydrated',
        triggers: ['hydrate on interaction'],
        hasErrorBlock: true,
        loadingBlock: { exists: true, minimumTime: 500, afterTime: 100 },
        placeholderBlock: { exists: false, minimumTime: null },
      }),
    ];
    const calls: Node[] = [];
    const ng: DeferDebugNg = {
      getComponent: (el) => instances.get(el) ?? null,
      ɵgetControlFlowBlocks: (node) => {
        calls.push(node);
        return raw;
      },
    };
    let clock = 1000;
    const tracker = createDeferTracker(() => clock);
    const first = tracker.collect(ng)!;
    expect(calls).toEqual([root]);
    expect(first).toHaveLength(2);
    expect(first[0]).toMatchObject({
      owner: { name: 'TripReviews', tag: 'app-trip-reviews' },
      state: 'placeholder',
      hydration: 'not-configured',
      triggers: ['on viewport'],
      placeholder: { minimumTime: 500 },
      since: 1000,
    });
    expect(first[0].rootIds.map((id) => elementById(id))).toEqual([section]);
    expect(first[1]).toMatchObject({
      state: 'complete',
      hydration: 'dehydrated',
      hasErrorBlock: true,
      loading: { minimumTime: 500, afterTime: 100 },
    });
    expect(first[1].placeholder).toBeUndefined();

    clock = 5000;
    raw = [
      block({ hostNode: anchor }),
      block({
        hostNode: lazy,
        state: 'complete',
        incrementalHydrationState: 'hydrated',
        triggers: ['hydrate on interaction'],
      }),
    ];
    const second = tracker.collect(ng)!;
    expect(second.map((b) => b.id)).toEqual(first.map((b) => b.id));
    expect(second[0].since).toBe(1000);
    expect(second[1]).toMatchObject({ hydration: 'hydrated', since: 5000, hydratedAt: 5000 });
  });

  it('flags hydrate never blocks and falls back to ɵgetDeferBlocks', () => {
    const { anchor, instances } = page();
    const ng: DeferDebugNg = {
      getComponent: (el) => instances.get(el) ?? null,
      ɵgetDeferBlocks: () => [
        { ...block({ hostNode: anchor, triggers: ['hydrate never'] }), type: undefined },
      ],
    };
    expect(createDeferTracker().collect(ng)).toMatchObject([
      { hydrateNever: true, hydration: 'not-configured' },
    ]);
  });
});

describe('deferBlocksText', () => {
  const info = (overrides: Partial<DeferBlockInfo>): DeferBlockInfo => ({
    id: 'd1',
    owner: { id: 'c2', name: 'TripReviews', tag: 'app-trip-reviews' },
    state: 'complete',
    hydration: 'not-configured',
    triggers: ['on viewport'],
    hasErrorBlock: false,
    rootIds: [],
    since: 0,
    ...overrides,
  });
  const report = (deferBlocks?: DeferBlockInfo[]): ComponentPage => ({
    pageId: 'p1',
    roots: [],
    count: 0,
    detail: null,
    reportedAt: 0,
    ...(deferBlocks ? { deferBlocks } : {}),
  });

  it('flags failed blocks and blocks stuck on their placeholder', () => {
    const text = deferBlocksText(
      [
        report([
          info({ id: 'd1', state: 'error' }),
          info({ id: 'd2', state: 'placeholder', since: 1000, triggers: ['when <expression>'] }),
          info({ id: 'd3', state: 'placeholder', since: 25_000 }),
          info({ id: 'd4', hydration: 'dehydrated' }),
          info({ id: 'd5', hydrateNever: true, triggers: ['hydrate never'] }),
        ]),
      ],
      30_000,
    );
    expect(text).toContain('5 defer blocks');
    expect(text).toContain('`d1` in TripReviews (`c2`): failed to load. Triggers: on viewport');
    expect(text).toContain('`d2` in TripReviews (`c2`): on its placeholder for 29s');
    expect(text).not.toContain('`d3` in');
    expect(text).toMatch(/\| `d4` .*\| still dehydrated \|/);
    expect(text).toMatch(/\| `d5` .*hydrate never: the server HTML stays static/);
  });

  it('says when a page has no util, no blocks, or no page reported', () => {
    expect(deferBlocksText([])).toMatch(/no component tree has been reported/i);
    expect(deferBlocksText([report()])).toMatch(/exposes no defer block util/);
    expect(deferBlocksText([report([])])).toMatch(/no `@defer` blocks are rendered/);
  });

  it('prints the page URL and title redacted even when the page sent them raw', () => {
    const page = toComponentPage({
      pageId: 'p1',
      roots: [],
      count: 0,
      detail: null,
      url: 'http://localhost/reset?token=s3cr3tvalue123&x=1#access_token=abcdefabcdef',
      title: 'Reset Bearer abcdefghijklmnop',
      deferBlocks: [info({})],
    });
    expect(page.url).toBe('http://localhost/reset?token=[redacted]&x=1#access_token=[redacted]');
    expect(page.title).toBe('Reset Bearer [redacted]');
    const text = deferBlocksText([page]);
    expect(text).not.toContain('s3cr3tvalue123');
    expect(text).not.toContain('abcdefabcdef');
  });
});
