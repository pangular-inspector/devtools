// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeferTracker } from '../defer-blocks.ts';
import { elementById } from '../element-id.ts';
import {
  controlFlowReader,
  createForTracker,
  MAX_FOR_BLOCKS,
  type ControlFlowDebugNg,
} from '../for-blocks.ts';
import { toComponentPage } from '../rpc/component-tools.ts';
import { FOR_ROWS, forBlocksText } from '../rpc/for-blocks-tools.ts';
import type { ComponentPage, ForBlockInfo } from '../types.ts';

class _TripList {}

function page() {
  document.body.innerHTML = `
    <app-root ng-version="22.0.0">
      <app-trip-list><ul><li>Rome</li><li>Oslo</li></ul></app-trip-list>
    </app-root>`;
  const root = document.querySelector('app-root')!;
  const list = document.querySelector('app-trip-list')!;
  const ul = list.querySelector('ul')!;
  const anchor = document.createComment('container');
  ul.appendChild(anchor);
  const instances = new Map<Element, object>([
    [root, {}],
    [list, new _TripList()],
  ]);
  return { root, list, ul, anchor, instances };
}

const forBlock = (overrides: Record<string, unknown>) => ({
  type: 1,
  items: [],
  hasEmptyBlock: false,
  rootNodes: [],
  trackExpression: 'function',
  ...overrides,
});

describe('createForTracker', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reports nothing when Angular has no ɵgetControlFlowBlocks (before 22.0)', () => {
    const { instances } = page();
    const ng: ControlFlowDebugNg = { getComponent: (el) => instances.get(el) ?? null };
    expect(createForTracker().collect(ng)).toBeUndefined();
    expect(createForTracker().collect(undefined)).toBeUndefined();
  });

  it('reads the owner, item count, track kind and @empty of each @for block', () => {
    const { root, list, ul, anchor, instances } = page();
    const [rome, oslo] = [...ul.querySelectorAll('li')];
    const emptyAnchor = document.createComment('container');
    list.appendChild(emptyAnchor);
    const raw = [
      { type: 0, state: 'complete', hostNode: anchor, rootNodes: [] },
      forBlock({
        items: [{ id: 1 }, { id: 2 }],
        hostNode: anchor,
        rootNodes: [rome, document.createTextNode(' '), oslo],
        trackExpression: '$index',
      }),
      forBlock({ hostNode: emptyAnchor, hasEmptyBlock: true, trackExpression: 'item' }),
    ];
    const ng: ControlFlowDebugNg = {
      getComponent: (el) => instances.get(el) ?? null,
      ɵgetControlFlowBlocks: (node) => (node === root ? raw : []),
    };
    const report = createForTracker().collect(ng)!;
    expect(report.forBlocksTruncated).toBeUndefined();
    const [loop, empty] = report.forBlocks;
    expect(report.forBlocks).toHaveLength(2);
    expect(loop).toMatchObject({
      count: 2,
      track: '$index',
      hasEmptyBlock: false,
      showingEmpty: false,
      owner: { name: 'TripList', tag: 'app-trip-list' },
    });
    expect(loop.rootIds.map((id) => elementById(id))).toEqual([rome, oslo]);
    expect(elementById(loop.owner!.id)).toBe(list);
    expect(empty).toMatchObject({
      count: 0,
      track: 'item',
      hasEmptyBlock: true,
      showingEmpty: true,
    });
    // Only the count leaves the page, never the items.
    expect(JSON.stringify(report)).not.toContain('"id":1');
  });

  it('keeps a block id while its items change and gives a new block a new id', () => {
    const { root, anchor, instances } = page();
    let raw: unknown[] = [forBlock({ hostNode: anchor, items: [1, 2] })];
    const ng: ControlFlowDebugNg = {
      getComponent: (el) => instances.get(el) ?? null,
      ɵgetControlFlowBlocks: (node) => (node === root ? raw : []),
    };
    const tracker = createForTracker();
    const first = tracker.collect(ng)!.forBlocks[0];
    raw = [forBlock({ hostNode: anchor, items: [1, 2, 3] })];
    const second = tracker.collect(ng)!.forBlocks[0];
    expect(second).toMatchObject({ id: first.id, count: 3 });
    const other = document.createComment('container');
    root.appendChild(other);
    raw = [forBlock({ hostNode: other }), forBlock({ hostNode: anchor })];
    const [added, kept] = tracker.collect(ng)!.forBlocks;
    expect(kept.id).toBe(first.id);
    expect(added.id).not.toBe(first.id);
  });

  it('gives an unknown track kind as null and ignores malformed entries', () => {
    const { root, anchor, instances } = page();
    const raw = [
      null,
      { type: 1 },
      forBlock({ hostNode: anchor, trackExpression: 'trackByName', items: 'nope' }),
    ];
    const ng: ControlFlowDebugNg = {
      getComponent: (el) => instances.get(el) ?? null,
      ɵgetControlFlowBlocks: (node) => (node === root ? raw : []),
    };
    expect(createForTracker().collect(ng)!.forBlocks).toEqual([
      expect.objectContaining({ track: null, count: 0, showingEmpty: false }),
    ]);
  });

  it(`stops at ${MAX_FOR_BLOCKS} blocks and says the list is truncated`, () => {
    const { root, instances } = page();
    const raw = Array.from({ length: MAX_FOR_BLOCKS + 3 }, () =>
      forBlock({ hostNode: root.appendChild(document.createComment('container')) }),
    );
    const ng: ControlFlowDebugNg = {
      getComponent: (el) => instances.get(el) ?? null,
      ɵgetControlFlowBlocks: (node) => (node === root ? raw : []),
    };
    const report = createForTracker().collect(ng)!;
    expect(report.forBlocks).toHaveLength(MAX_FOR_BLOCKS);
    expect(report.forBlocksTruncated).toBe(true);
  });

  it('shares one ɵgetControlFlowBlocks call per root with the defer tracker', () => {
    const { root, anchor, instances } = page();
    const util = vi.fn((node: Node) =>
      node === root
        ? [
            {
              type: 0,
              state: 'placeholder',
              incrementalHydrationState: 'not-configured',
              triggers: [],
              hostNode: anchor,
              rootNodes: [],
            },
            forBlock({ hostNode: anchor, items: [1] }),
          ]
        : [],
    );
    const ng: ControlFlowDebugNg = {
      getComponent: (el) => instances.get(el) ?? null,
      ɵgetControlFlowBlocks: util,
    };
    const blocksOf = controlFlowReader(ng);
    const defer = createDeferTracker().collect(ng, document, blocksOf);
    const loops = createForTracker().collect(ng, document, blocksOf);
    expect(defer).toHaveLength(1);
    expect(loops?.forBlocks).toHaveLength(1);
    expect(util).toHaveBeenCalledTimes(1);
  });
});

describe('@for blocks on the server', () => {
  const block = (id: string, overrides: Partial<ForBlockInfo> = {}): ForBlockInfo => ({
    id,
    owner: { id: 'c2', name: 'TripList', tag: 'app-trip-list' },
    count: 3,
    track: 'function',
    hasEmptyBlock: true,
    showingEmpty: false,
    rootIds: [],
    ...overrides,
  });
  const pageWith = (extra: Partial<ComponentPage>): ComponentPage =>
    toComponentPage({ pageId: 'p1', roots: [], count: 0, detail: null, ...extra });

  it('keeps the blocks and the truncation flag the page sent', () => {
    const kept = pageWith({ forBlocks: [block('f1')], forBlocksTruncated: true });
    expect(kept.forBlocks).toHaveLength(1);
    expect(kept.forBlocksTruncated).toBe(true);
    expect(pageWith({}).forBlocks).toBeUndefined();
  });

  it('lists each block with its owner, items, track kind and @empty', () => {
    const text = forBlocksText([
      pageWith({
        url: 'http://localhost/trips',
        forBlocks: [
          block('f1', { track: '$index' }),
          block('f2', { count: 0, showingEmpty: true }),
          block('f3', { count: 0, hasEmptyBlock: false }),
        ],
      }),
    ]);
    expect(text).toContain('Page `p1` (http://localhost/trips): 3 `@for` blocks.');
    expect(text).toContain('| `f1` | TripList (`c2`) | 3 | `$index` | yes |  |');
    expect(text).toContain(
      '| `f2` | TripList (`c2`) | 0 | an expression | showing | showing @empty |',
    );
    expect(text).toContain('no items and no @empty block, so it renders nothing');
  });

  it('says when the page has no util, no blocks or more blocks than it lists', () => {
    expect(forBlocksText([])).toMatch(/^No component tree has been reported/);
    expect(forBlocksText([pageWith({})])).toMatch(/Angular 22\.0 added/);
    expect(forBlocksText([pageWith({ forBlocks: [] })])).toContain('no `@for` blocks are rendered');
    const many = Array.from({ length: FOR_ROWS + 2 }, (_, i) => block(`f${i}`));
    const text = forBlocksText([pageWith({ forBlocks: many, forBlocksTruncated: true })]);
    expect(text).toContain(`${FOR_ROWS + 2} or more`);
    expect(text).toContain('2 more blocks not shown.');
  });
});
