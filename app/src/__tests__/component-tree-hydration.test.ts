import { TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentTree } from '../pages/component-tree';
import {
  countText,
  directiveHostLabel,
  filterAnnouncement,
  filterTree,
  withoutDirectiveHosts,
  type TreeNode,
} from '../pages/component-tree-state';

function client(pages: Record<string, unknown>) {
  const calls: { name: string; args: unknown[] }[] = [];
  const rpc = {
    call: (name: string, ...args: unknown[]) => {
      calls.push({ name, args });
      return Promise.resolve([]);
    },
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({
        value: () => (name === 'component-tree' ? { pages } : null),
        on: () => () => {},
      }),
  };
  return {
    calls,
    client: { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient,
  };
}

const roots: TreeNode[] = [
  {
    id: 'c1',
    name: 'App',
    tag: 'app-root',
    hydration: 'hydrated',
    children: [
      {
        id: 'c2',
        name: 'RouterLink',
        tag: 'a',
        kind: 'directive',
        directives: ['RouterLink'],
        attributes: ['routerLink'],
        children: [
          { id: 'c3', name: 'Badge', tag: 'app-badge', hydration: 'hydrated', children: [] },
        ],
      },
      {
        id: 'c4',
        name: 'TripMap',
        tag: 'app-map',
        hydration: 'skipped',
        children: [
          {
            id: 'c5',
            name: 'MatTooltip',
            tag: 'button',
            kind: 'directive',
            directives: ['MatTooltip'],
            attributes: ['matTooltip'],
            children: [],
          },
        ],
      },
      { id: 'c6', name: 'Price', tag: 'app-price', hydration: 'mismatched', children: [] },
    ],
  },
];

const hydration = {
  hydrated: true,
  counts: { hydrated: 2, skipped: 1, mismatched: 1, client: 0, dehydratedBlocks: 1 },
  mismatches: [{ id: 'c6', name: 'Price', tag: 'app-price', expected: '<div>', actual: '<span>' }],
};

const page = (extra: Record<string, unknown> = {}) => ({
  pageId: 'p1',
  roots,
  count: 4,
  directiveHostCount: 2,
  detail: null,
  reportedAt: 1000,
  hydration,
  ...extra,
});

async function render(value: unknown) {
  const fixture = TestBed.createComponent(ComponentTree);
  const rpc = client({ p1: value });
  fixture.componentRef.setInput('rpc', rpc.client);
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { fixture, el, calls: rpc.calls, settle };
}

const rowIds = (el: HTMLElement) =>
  Array.from(el.querySelectorAll<HTMLElement>('.row')).map((row) => row.dataset['id']);

describe('tree search and directive hosts (state)', () => {
  it('filters with tag, directive and text tokens, keeping ancestors', () => {
    const { nodes, matches } = filterTree(roots, '<button> [matTooltip]');
    expect(matches).toBe(1);
    expect(nodes[0].children.map((n) => n.id)).toEqual(['c4']);
    expect(nodes[0].children[0].children.map((n) => n.id)).toEqual(['c5']);
    expect(filterTree(roots, '<app-map>').matches).toBe(1);
    expect(filterTree(roots, '[routerLink] badge').matches).toBe(0);
    expect(filterTree(roots, 'price').matches).toBe(1);
  });

  it('lifts the children of hidden directive hosts to their parent', () => {
    const shown = withoutDirectiveHosts(roots);
    expect(shown[0].children.map((n) => n.id)).toEqual(['c3', 'c4', 'c6']);
    expect(shown[0].children[1].children).toEqual([]);
  });

  it('labels a directive host by its attributes, else its classes, and counts hosts apart', () => {
    expect(directiveHostLabel(roots[0].children[0])).toBe('[routerLink]');
    expect(
      directiveHostLabel({
        id: 'x',
        name: 'Foo',
        tag: 'div',
        directives: ['Highlight'],
        children: [],
      }),
    ).toBe('[Highlight]');
    expect(countText(4, 0, false, false, 2)).toBe('4 instances · 2 directive hosts');
    expect(countText(4, 1, true, false, 2)).toBe('1 of 6');
    // With directive hosts shown, the filter result counts rows, not instances.
    expect(filterAnnouncement(4, 1, 'tip', false, 2)).toBe('1 of 6 rows match.');
    expect(filterAnnouncement(4, 1, 'tip')).toBe('1 of 4 instances match.');
  });
});

describe('component tree hydration and directive hosts', () => {
  beforeEach(() => {
    vi.stubGlobal('CSS', { escape: (value: string) => value });
    Element.prototype.scrollIntoView ??= () => {};
    try {
      localStorage.clear();
    } catch {
      // no storage in this environment
    }
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('shows a hydration badge with text on each component row', async () => {
    const { el } = await render(page());
    const badges = Array.from(el.querySelectorAll('.row .hyd')).map((b) =>
      b.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(badges).toEqual([
      'Hydration: Hydrated',
      'Hydration: Hydrated',
      'Hydration: Skipped',
      'Hydration: Mismatch',
    ]);
    expect(el.querySelector('.hyd-mismatched')).not.toBeNull();
  });

  it('shows directive hosts as their own rows, hidden by the toolbar toggle', async () => {
    const { el, settle } = await render(page());
    const host = el.querySelector('.row[data-id="c2"]')!;
    expect(host.querySelector('.host-tag')!.textContent).toBe('<a>');
    expect(host.querySelector('.host-dirs')!.textContent!.trim()).toBe('[routerLink]');
    expect(host.querySelector('.sr-only')!.textContent).toBe('directive host');
    expect(el.querySelectorAll('.row.dir-host')).toHaveLength(2);
    expect(el.querySelector('.count')!.textContent).toContain('4 instances · 2 directive hosts');

    const toggle = Array.from(el.querySelectorAll<HTMLButtonElement>('.tree-action')).find((b) =>
      b.textContent!.includes('Directive hosts'),
    )!;
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    toggle.click();
    await settle();
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(el.querySelectorAll('.row.dir-host')).toHaveLength(0);
    expect(rowIds(el)).toEqual(['c1', 'c3', 'c4', 'c6']);
    expect(localStorage.getItem('pangular:components:directive-hosts')).toBe('hidden');
  });

  it('filters the tree with the search syntax', async () => {
    const { el, fixture, settle } = await render(page());
    fixture.componentInstance.setFilter('<button> [matTooltip]');
    await settle();
    expect(rowIds(el)).toEqual(['c1', 'c4', 'c5']);
    expect(el.querySelector('.count')!.textContent!.trim()).toBe('1 of 6');
    expect(fixture.componentInstance.announcement()).toBe('1 of 6 rows match.');
  });

  it('selects a directive host locally and offers its owning component', async () => {
    const { el, calls, settle } = await render(page());
    const row = el.querySelector<HTMLElement>('.row[data-id="c5"]')!;
    row.click();
    await settle();
    expect(calls.some((c) => c.name === 'select-component')).toBe(false);
    const detail = el.querySelector('.detail')!;
    expect(detail.querySelector('.badge')!.textContent).toBe('directive host');
    expect(detail.textContent).toContain('MatTooltip');
    const owner = detail.querySelector<HTMLButtonElement>('.owner-action button')!;
    expect(owner.textContent!.trim()).toBe('Show TripMap');
    owner.focus();
    owner.click();
    await settle();
    expect(el.querySelector('.row.selected')!.getAttribute('data-id')).toBe('c4');
    // The button goes away with the host's detail, so focus moves to the owner's row.
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.getAttribute('data-id')).toBe('c4');
    expect(document.activeElement?.getAttribute('tabindex')).toBe('0');
  });

  it('reaches directive host rows with the arrow keys', async () => {
    const { el, settle } = await render(page());
    const tree = el.querySelector<HTMLElement>('[role="tree"]')!;
    el.querySelector<HTMLElement>('.row[data-id="c1"]')!.focus();
    tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await new Promise((resolve) => queueMicrotask(() => resolve(null)));
    await settle();
    expect(document.activeElement?.getAttribute('data-id')).toBe('c2');
    expect(document.activeElement?.getAttribute('role')).toBe('treeitem');
  });

  it('summarizes hydration and asks the page to outline it', async () => {
    const { el, calls, settle } = await render(page());
    const section = el.querySelector('app-hydration-section')!;
    const counts = Array.from(section.querySelectorAll('.counts li')).map((li) =>
      li.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(counts).toEqual([
      '2 hydrated',
      '1 skipped',
      '1 mismatched',
      '0 created on the client',
      '1 dehydrated @defer block',
    ]);
    expect(section.textContent).toContain('Expected <div>');
    const outline = section.querySelector<HTMLButtonElement>('.outline')!;
    expect(outline.getAttribute('aria-pressed')).toBe('false');
    outline.click();
    await settle();
    expect(outline.getAttribute('aria-pressed')).toBe('true');
    const call = calls.find((c) => c.name === 'request-hydration-overlay')!;
    expect(call.args[0]).toEqual({ pageId: 'p1', on: true });

    section.querySelector<HTMLButtonElement>('.mismatch')!.click();
    await settle();
    expect(el.querySelector('.row.selected')!.getAttribute('data-id')).toBe('c6');
  });

  it('says hydration does not apply to a page rendered in the browser only', async () => {
    const plain = (nodes: TreeNode[]): TreeNode[] =>
      nodes.map(({ hydration: _, ...node }) => ({ ...node, children: plain(node.children) }));
    const { el } = await render(page({ hydration: undefined, roots: plain(roots) }));
    const section = el.querySelector('app-hydration-section')!;
    expect(section.textContent).toContain('not rendered on the server');
    expect(section.querySelector('.outline')).toBeNull();
    expect(el.querySelector('.row .hyd')).toBeNull();
  });

  it('says client hydration is off when the server HTML was not hydrated', async () => {
    const { el } = await render(page({ hydration: { ...hydration, hydrated: false } }));
    expect(el.querySelector('app-hydration-section')!.textContent).toContain(
      'no component was hydrated',
    );
  });
});
