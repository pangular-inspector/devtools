import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  chainOf,
  drawnIds,
  layoutGraph,
  moveFocus,
  type GraphLink,
} from '../pages/signal-graph-layout';
import { SignalInspector } from '../pages/signal-inspector';

// count -> doubled -> template, count -> logEffect, unrelated -> template.
const links: GraphLink[] = [
  { producer: 'count', consumer: 'doubled' },
  { producer: 'doubled', consumer: 'tpl' },
  { producer: 'count', consumer: 'log' },
  { producer: 'other', consumer: 'tpl' },
];
const ids = ['count', 'doubled', 'tpl', 'log', 'other'];

describe('layoutGraph', () => {
  it('puts every node one layer right of its furthest producer', () => {
    const layout = layoutGraph(ids, links);
    const layer = Object.fromEntries(layout.nodes.map((n) => [n.id, n.layer]));
    expect(layer).toEqual({ count: 0, other: 0, doubled: 1, log: 1, tpl: 2 });
    const x = Object.fromEntries(layout.nodes.map((n) => [n.id, n.x]));
    expect(x['count']).toBeLessThan(x['doubled']!);
    expect(layout.edges).toHaveLength(4);
    expect(layout.width).toBeGreaterThan(x['tpl']!);
  });

  it('orders a layer by the rows of its producers, so links stay short', () => {
    const layout = layoutGraph(
      ['a', 'b', 'fromB', 'fromA'],
      [
        { producer: 'a', consumer: 'fromA' },
        { producer: 'b', consumer: 'fromB' },
      ],
    );
    expect(layout.layers[1]).toEqual(['fromA', 'fromB']);
  });

  it('survives a cycle and ignores links to nodes it does not draw', () => {
    const layout = layoutGraph(
      ['a', 'b'],
      [
        { producer: 'a', consumer: 'b' },
        { producer: 'b', consumer: 'a' },
        { producer: 'gone', consumer: 'a' },
      ],
    );
    expect(layout.nodes).toHaveLength(2);
  });
});

describe('chainOf', () => {
  it('collects every producer upstream and every consumer downstream', () => {
    expect(chainOf('doubled', links)).toEqual({
      upstream: new Set(['count']),
      downstream: new Set(['tpl']),
    });
    expect(chainOf('count', links).downstream).toEqual(new Set(['doubled', 'tpl', 'log']));
  });
});

describe('drawnIds', () => {
  it('draws the selected chain first when the graph is over the cap', () => {
    expect(drawnIds(ids, links, null, 2)).toEqual(['count', 'doubled']);
    expect(drawnIds(ids, links, 'other', 2)).toEqual(['tpl', 'other']);
    expect(drawnIds(ids, links, 'other', 10)).toEqual(ids);
  });
});

describe('moveFocus', () => {
  const layout = layoutGraph(ids, links);
  it('moves to a consumer on the right and a producer on the left', () => {
    expect(moveFocus(layout, links, 'count', 'ArrowRight')).toMatch(/doubled|log/);
    expect(moveFocus(layout, links, 'tpl', 'ArrowLeft')).toMatch(/doubled|other/);
    expect(moveFocus(layout, links, 'doubled', 'ArrowLeft')).toBe('count');
  });

  it('moves inside a layer with up and down, and to the ends with Home and End', () => {
    const [first, second] = layout.layers[0]!;
    expect(moveFocus(layout, links, first!, 'ArrowDown')).toBe(second);
    expect(moveFocus(layout, links, first!, 'ArrowUp')).toBeNull();
    expect(moveFocus(layout, links, 'tpl', 'Home')).toBe(layout.nodes[0]!.id);
    expect(moveFocus(layout, links, 'count', 'End')).toBe(layout.nodes.at(-1)!.id);
  });
});

const graph = {
  pageId: 'p1',
  nodes: [
    { id: '1', kind: 'signal', label: 'count', epoch: 2, value: 2 },
    { id: '2', kind: 'computed', label: 'doubled', epoch: 2, value: 4 },
    { id: '3', kind: 'template', label: 'app-root', epoch: 1 },
    { id: '4', kind: 'computed', label: 'reactiveHref', epoch: 1, value: '/a', framework: true },
    { id: '5', kind: 'signal', label: 'other', epoch: 0, value: true },
  ],
  edges: [
    { consumer: 1, producer: 0 },
    { consumer: 2, producer: 1 },
    { consumer: 2, producer: 3 },
    { consumer: 2, producer: 4 },
  ],
  component: { id: 'c1', name: 'App', tag: 'app-root', path: 'app-root' },
  componentSelector: 'app-root',
  history: {
    '1': [
      { epoch: 1, value: 1, at: 1000, source: 'initial' },
      {
        epoch: 2,
        value: 2,
        at: 2000,
        source: 'write',
        stack: ['Counter.increment (src/app/counter.ts:12:5)'],
      },
    ],
  },
};

async function render(value: Record<string, unknown>) {
  const calls: { name: string; args: unknown }[] = [];
  const rpc = {
    call: (name: string, args: unknown) => {
      calls.push({ name, args });
      return Promise.resolve([]);
    },
    sharedState: (name: string) =>
      Promise.resolve({
        value: () => (name === 'signal-graph' ? { graph: value, pages: { p1: value } } : {}),
        on: () => () => {},
      }),
  };
  const fixture = TestBed.createComponent(SignalInspector);
  fixture.componentRef.setInput('rpc', {
    connectionMeta: {},
    scope: () => ({ rpc }),
  } as unknown as DevframeRpcClient);
  await settle(fixture);
  return { fixture, calls, el: fixture.nativeElement as HTMLElement };
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

const graphNodes = (el: HTMLElement) => [
  ...el.querySelectorAll<HTMLButtonElement>('app-signal-graph-view button[data-node]'),
];
const byNode = (el: HTMLElement, id: string) =>
  graphNodes(el).find((button) => button.dataset['node'] === id)!;
const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('Signals graph view', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('hides framework signals by default and says how many', async () => {
    const { fixture, el } = await render(graph);
    expect(graphNodes(el).map((b) => b.dataset['node'])).not.toContain('4');
    const toggle = [...el.querySelectorAll('button.toggle')].find((b) =>
      text(b).startsWith('Show framework signals'),
    ) as HTMLButtonElement;
    expect(text(toggle)).toBe('Show framework signals 1 hidden');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    toggle.click();
    await settle(fixture);
    expect(graphNodes(el).map((b) => b.dataset['node'])).toContain('4');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('highlights the upstream and downstream chain of the selected node', async () => {
    const { fixture, el } = await render(graph);
    byNode(el, '2').click();
    await settle(fixture);
    expect(byNode(el, '2').getAttribute('aria-pressed')).toBe('true');
    expect(byNode(el, '1').classList).toContain('up');
    expect(byNode(el, '3').classList).toContain('down');
    expect(byNode(el, '5').classList).toContain('faded');
    expect(byNode(el, '1').getAttribute('aria-label')).toContain('upstream of the selected signal');
    expect(el.querySelectorAll('path.edge.up')).toHaveLength(1);
    expect(el.querySelectorAll('path.edge.down')).toHaveLength(1);
    expect(fixture.componentInstance.selectedId()).toBe('2');
  });

  it('is one Tab stop that arrow keys move through', async () => {
    const { fixture, el } = await render(graph);
    const tabbable = graphNodes(el).filter((b) => b.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
    const start = byNode(el, '1');
    start.focus();
    start.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await settle(fixture);
    expect(document.activeElement).toBe(byNode(el, '2'));
    expect(graphNodes(el).filter((b) => b.tabIndex === 0)).toEqual([byNode(el, '2')]);
    // Buttons select with Enter and Space natively; the click handler does the work.
    byNode(el, '2').click();
    await settle(fixture);
    expect(fixture.componentInstance.selectedId()).toBe('2');
  });

  it('labels each node with its kind, name and links', async () => {
    const { el } = await render(graph);
    expect(byNode(el, '2').getAttribute('aria-label')).toBe(
      'computed doubled, 1 producer, 1 consumer',
    );
    const group = el.querySelector('app-signal-graph-view [role="group"]')!;
    expect(group.getAttribute('aria-label')).toBe('Signal graph, 4 signals');
  });
});

describe('Signals watch and write stacks', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('asks the page to watch a signal and to record write stacks', async () => {
    const { fixture, el, calls } = await render(graph);
    fixture.componentInstance.select('1');
    await settle(fixture);
    const watch = el.querySelector<HTMLButtonElement>('button.watch-toggle')!;
    expect(watch.getAttribute('aria-pressed')).toBe('false');
    watch.click();
    const stacks = [...el.querySelectorAll<HTMLButtonElement>('button.toggle')].find(
      (b) => text(b) === 'Record write stacks',
    )!;
    stacks.click();
    expect(calls.filter((c) => c.name === 'set-signal-watch').map((c) => c.args)).toEqual([
      { id: '1', watch: true, pageId: 'p1' },
      { stacks: true, pageId: 'p1' },
    ]);
  });

  it('lists watched signals with their changes and the frames that wrote them', async () => {
    const { fixture, el } = await render({ ...graph, watch: { ids: ['1'], stacks: true } });
    const section = el.querySelector('section.watched')!;
    expect(text(section.querySelector('h2'))).toBe('Watched');
    expect(text(section.querySelector('.watched-list li'))).toContain('count');
    expect(section.querySelector('[role="log"] .stack li')?.textContent).toBe(
      'Counter.increment (src/app/counter.ts:12:5)',
    );
    expect(byNode(el, '1').getAttribute('aria-label')).toContain('watched');
    expect(text(el.querySelector('.graph-hint'))).toContain('Write stacks are on');

    fixture.componentInstance.select('1');
    await settle(fixture);
    expect(el.querySelector('button.watch-toggle')?.getAttribute('aria-pressed')).toBe('true');
    const history = el.querySelector('ol.history[aria-labelledby^="history-heading"]')!;
    expect(history.querySelector('.stack')?.getAttribute('aria-label')).toBe('Written from');
  });
});
