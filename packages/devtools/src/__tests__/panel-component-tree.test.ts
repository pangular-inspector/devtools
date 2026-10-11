import { describe, expect, it } from 'vitest';
import {
  countText,
  filterAnnouncement,
  filterTree,
  nearestRow,
  reconcileSelection,
  truncationNotice,
  type TreeNode,
} from '../../../../app/src/pages/component-tree-state.ts';
import { injectorTreeFor, pickPage, signalGraphFor } from '../../../../app/src/live-pages.ts';

const node = (id: string, name: string, children: TreeNode[] = []): TreeNode => ({
  id,
  name,
  tag: `app-${name.toLowerCase()}`,
  children,
});

const roots = [
  node('c1', 'App', [
    node('c2', 'Shell', [node('c3', 'Card'), node('c4', 'Card')]),
    node('c5', 'Footer'),
  ]),
];

describe('Components filter count', () => {
  it('counts matching nodes only, not the ancestors kept for context', () => {
    const { nodes, matches } = filterTree(roots, 'card');
    expect(matches).toBe(2);
    expect(nodes[0].children[0].children.map((n) => n.id)).toEqual(['c3', 'c4']);
    expect(filterTree(roots, '  ')).toEqual({ nodes: roots, matches: 0 });
  });

  it('shows the total without a filter and N of M while filtering', () => {
    expect(countText(5, 0, false)).toBe('5 instances');
    expect(countText(1, 0, false)).toBe('1 instance');
    expect(countText(5, 2, true)).toBe('2 of 5');
    expect(countText(5, 0, true)).toBe('0 of 5');
  });

  it('marks the count as a lower bound and names the cap when the tree is truncated', () => {
    expect(countText(2000, 0, false, true)).toBe('2000+ instances');
    expect(countText(2000, 3, true, true)).toBe('3 of 2000+');
    expect(filterAnnouncement(2000, 3, 'card', true)).toBe('3 of 2000+ instances match.');
    expect(truncationNotice({ components: 2000 })).toBe(
      'Showing the first 2000 component instances. Others are not listed or searchable.',
    );
    expect(truncationNotice({ depth: 256 })).toBe(
      'Components nested more than 256 elements deep are not listed or searchable.',
    );
    expect(truncationNotice({ components: 2000, depth: 256 })).toMatch(
      /first 2000 component instances, and none nested more than 256 elements deep\. Others/,
    );
    expect(truncationNotice()).toBe('The page has more components than the tree shows.');
  });

  it('announces the filter result, and nothing once the filter is cleared', () => {
    expect(filterAnnouncement(5, 2, 'card')).toBe('2 of 5 instances match.');
    expect(filterAnnouncement(5, 0, 'zzz')).toBe('No components match.');
    expect(filterAnnouncement(5, 0, '')).toBe('');
  });
});

describe('Components selection', () => {
  const page = (detail: string | null, tree = roots, pageId = 'p1') => ({
    pageId,
    roots: tree,
    detail: detail ? { id: detail } : null,
  });

  it('keeps the panel selection while the page still reports the previous one', () => {
    const next = reconcileSelection({ pageId: 'p1', selectedId: 'c3', detailId: 'c4' }, page('c4'));
    expect(next).toEqual({ pageId: 'p1', selectedId: 'c3', detailId: 'c4', destroyed: null });
  });

  it('follows a selection made on the page or by an agent', () => {
    const next = reconcileSelection({ pageId: 'p1', selectedId: 'c3', detailId: 'c3' }, page('c5'));
    expect(next.selectedId).toBe('c5');
  });

  it('takes the selection of the page it switches to', () => {
    const next = reconcileSelection(
      { pageId: 'p1', selectedId: 'c3', detailId: 'c3' },
      page('c2', roots, 'p2'),
    );
    expect(next).toEqual({ pageId: 'p2', selectedId: 'c2', detailId: 'c2', destroyed: null });
  });

  it('drops a selected instance that left the tree and reports it as destroyed', () => {
    const without = [node('c1', 'App', [node('c2', 'Shell', [node('c3', 'Card')])])];
    const next = reconcileSelection(
      { pageId: 'p1', selectedId: 'c4', detailId: 'c4' },
      page(null, without),
    );
    expect(next).toEqual({ pageId: 'p1', selectedId: null, detailId: null, destroyed: 'c4' });
    expect(
      reconcileSelection(
        { pageId: 'p1', selectedId: 'c4', detailId: 'c4' },
        { ...page(null, without), truncated: true },
      ).destroyed,
    ).toBeNull();
  });

  it('moves focus from a removed row to the next remaining row, else the one before', () => {
    const before = ['c1', 'c2', 'c3', 'c4', 'c5'];
    expect(nearestRow(before, new Set(['c1', 'c2', 'c3', 'c5']), 'c4')).toBe('c5');
    expect(nearestRow(before, new Set(['c1', 'c5']), 'c2')).toBe('c5');
    expect(nearestRow(before, new Set(['c1', 'c2', 'c3', 'c4']), 'c5')).toBe('c4');
    expect(nearestRow(before, new Set(), 'c3')).toBeNull();
  });
});

describe('page choice', () => {
  const pages = {
    a: { pageId: 'a', reportedAt: 100 },
    b: { pageId: 'b', reportedAt: 200 },
  };

  it('stays on the shown page when another tab reports later', () => {
    const shown = pickPage(pages, { chosen: null, host: null, previous: null });
    expect(shown).toBe('b');
    const later = { ...pages, a: { pageId: 'a', reportedAt: 300 } };
    expect(pickPage(later, { chosen: null, host: null, previous: shown })).toBe('b');
    const alternating = { a: later.a, b: { pageId: 'b', reportedAt: 400 } };
    expect(pickPage(alternating, { chosen: null, host: null, previous: 'b' })).toBe('b');
  });

  it('falls back to another page only when the shown one is gone', () => {
    expect(pickPage({ a: pages.a }, { chosen: null, host: null, previous: 'b' })).toBe('a');
    expect(pickPage({}, { chosen: null, host: null, previous: 'b' })).toBeNull();
  });

  it('prefers the page picked in the view, then the host page', () => {
    expect(pickPage(pages, { chosen: 'a', host: 'b', previous: 'b' })).toBe('a');
    expect(pickPage(pages, { chosen: 'gone', host: 'a', previous: 'b' })).toBe('a');
    expect(pickPage(pages, { chosen: null, host: 'c', previous: 'b' })).toBe('c');
  });
});

describe('Dashboard live cards', () => {
  const tree = (n: number) => ({ roots: Array.from({ length: n }, () => ({})) });

  it('count the injectors of the host page, not the newest page', () => {
    const state = { ...tree(5), pages: { p1: tree(2), p2: tree(5) } };
    expect(injectorTreeFor(state, 'p1')?.roots).toHaveLength(2);
    expect(injectorTreeFor(state, null)?.roots).toHaveLength(5);
    expect(injectorTreeFor(state, 'p3')).toBeNull();
  });

  it('count the signals of the host page and do not fall back to another page', () => {
    const graph = (n: number) => ({ nodes: Array.from({ length: n }, () => ({ kind: 'signal' })) });
    const state = { graph: graph(4), pages: { p1: graph(1) } };
    expect(signalGraphFor(state, 'p1')?.nodes).toHaveLength(1);
    expect(signalGraphFor(state, 'p2')).toBeNull();
    expect(signalGraphFor(state, null)?.nodes).toHaveLength(4);
  });
});
