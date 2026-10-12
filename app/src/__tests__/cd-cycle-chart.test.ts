import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FRAME_BUDGET_MS,
  aggregateComponents,
  cyclesInRange,
  squarify,
} from '../pages/cd-chart-data';
import { CdCycleChart } from '../pages/cd-cycle-chart';
import { CdRecording, type CdCycle, type CdPage } from '../pages/cd-recording';
import { CdFlameGraph } from '../pages/cd-flame-graph';
import { CdTreemap } from '../pages/cd-treemap';

function cycle(id: number, ms: number, components: CdCycle['components'] = []): CdCycle {
  return { id, at: 1000 + id, ms, passes: 1, checks: components.length || 1, components };
}

const CYCLES: CdCycle[] = [
  cycle(5, 4, [{ name: 'Cart', checks: 1, ms: 3 }]),
  cycle(6, 20, [
    { name: 'List', checks: 2, ms: 12 },
    { name: 'Cart', checks: 1, ms: 5 },
  ]),
  { ...cycle(7, 2, [{ name: 'Row', checks: 4, ms: 1 }]), trigger: '(click) on Button' },
  cycle(8, 30, [{ name: 'List', checks: 2, ms: 25 }]),
  cycle(9, 1),
];

afterEach(() => TestBed.resetTestingModule());

describe('change detection chart data', () => {
  it('covers every cycle without a range and the picked ones with one', () => {
    expect(cyclesInRange(CYCLES, null).map((c) => c.id)).toEqual([5, 6, 7, 8, 9]);
    expect(cyclesInRange(CYCLES, { from: 8, to: 6 }).map((c) => c.id)).toEqual([6, 7, 8]);
    // A range whose cycles were all dropped falls back to every cycle.
    expect(cyclesInRange(CYCLES, { from: 1, to: 2 })).toHaveLength(5);
  });

  it('adds up component self time over a range, slowest first', () => {
    expect(aggregateComponents(cyclesInRange(CYCLES, { from: 5, to: 8 }))).toEqual([
      { name: 'List', checks: 4, ms: 37, maxMs: 25, cycles: 2 },
      { name: 'Cart', checks: 2, ms: 8, maxMs: 5, cycles: 2 },
      { name: 'Row', checks: 4, ms: 1, maxMs: 1, cycles: 1 },
    ]);
    expect(aggregateComponents(cyclesInRange(CYCLES, { from: 5, to: 5 }))).toEqual([
      { name: 'Cart', checks: 1, ms: 3, maxMs: 3, cycles: 1 },
    ]);
  });

  it('lays out a treemap whose areas follow the values and fill the box', () => {
    const cells = squarify([6, 6, 4, 3, 2, 2, 1], (v) => v, 3);
    expect(cells).toHaveLength(7);
    const area = (c: { w: number; h: number }) => c.w * c.h;
    const total = cells.reduce((sum, c) => sum + area(c), 0);
    expect(total).toBeCloseTo(100 * 100, 5);
    for (const cell of cells) {
      expect(area(cell) / total).toBeCloseTo(cell.item / 24, 5);
      expect(cell.x + cell.w).toBeLessThanOrEqual(100.0001);
      expect(cell.y + cell.h).toBeLessThanOrEqual(100.0001);
    }
    expect(squarify([0, -1], (v) => v)).toEqual([]);
  });
});

describe('CdCycleChart', () => {
  let fixture: ComponentFixture<CdCycleChart>;
  const host = () => fixture.nativeElement as HTMLElement;
  const options = () => [...host().querySelectorAll<HTMLElement>('[role="option"]')];
  const listbox = () => host().querySelector<HTMLElement>('[role="listbox"]')!;
  const selectedIds = () =>
    options()
      .filter((o) => o.getAttribute('aria-selected') === 'true')
      .map((o) => o.getAttribute('aria-label')!.split(',')[0]);

  async function make(cycles = CYCLES) {
    fixture = TestBed.createComponent(CdCycleChart);
    fixture.componentRef.setInput('cycles', cycles);
    await fixture.whenStable();
  }

  async function key(key: string, shiftKey = false) {
    listbox().dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }));
    await fixture.whenStable();
  }

  async function pointer(type: string, index: number) {
    const target = options()[index].querySelector('.bar')!;
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }));
    await fixture.whenStable();
  }

  it('draws one bar per cycle, scaled to the slowest, with the budget line', async () => {
    await make();
    expect(options()).toHaveLength(5);
    const heights = options().map((o) =>
      parseFloat((o.querySelector('.bar') as HTMLElement).style.height),
    );
    expect(heights[3]).toBeCloseTo(100);
    expect(heights[0]).toBeCloseTo((4 / 30) * 100);
    const budget = host().querySelector<HTMLElement>('.budget')!;
    expect(parseFloat(budget.style.bottom)).toBeCloseTo((FRAME_BUDGET_MS / 30) * 100);
    expect(budget.textContent).toContain('16.6 ms budget');
  });

  it('keeps the budget line inside the chart when every cycle is fast', async () => {
    await make([cycle(1, 1), cycle(2, 2)]);
    const bottom = parseFloat(host().querySelector<HTMLElement>('.budget')!.style.bottom);
    expect(bottom).toBeLessThan(100);
    expect(bottom).toBeGreaterThan(50);
  });

  it('marks over-budget cycles with a pattern, a marker and text', async () => {
    await make();
    const over = options().filter((o) => o.classList.contains('over'));
    expect(over.map((o) => o.getAttribute('aria-label')!.split(',')[0])).toEqual([
      'Cycle 6',
      'Cycle 8',
    ]);
    expect(over[0].getAttribute('aria-label')).toContain('over budget');
    expect(options()[0].getAttribute('aria-label')).not.toContain('over budget');
    expect(host().querySelectorAll('.markers span.over')).toHaveLength(2);
    expect(host().querySelector('.summary')!.textContent).toContain(
      'All 5 cycles. 2 over the 16.6 ms budget.',
    );
  });

  it('describes a cycle with its trigger and slowest component', async () => {
    await make();
    expect(options()[2].getAttribute('aria-label')).toBe(
      'Cycle 7, 2.00 ms, after (click) on Button, 1 check, slowest Row 1.00 ms',
    );
  });

  it('shows a tooltip on hover and on keyboard focus', async () => {
    await make();
    await pointer('pointermove', 1);
    const tip = host().querySelector('.tip')!;
    expect(tip.getAttribute('aria-hidden')).toBe('true');
    expect(tip.textContent).toContain('cycle 6');
    expect(tip.textContent).toContain('over budget');
    expect(tip.textContent).toContain('List');
    // On the side with more room, so it never covers the bar.
    expect(fixture.componentInstance.tip()).toMatchObject({ right: null });
    expect(fixture.componentInstance.tip()!.left).toContain('40%');
    await pointer('pointermove', 4);
    expect(fixture.componentInstance.tip()).toMatchObject({ left: null });
    expect(fixture.componentInstance.tip()!.right).toContain('20%');
    listbox().dispatchEvent(new PointerEvent('pointerleave'));
    await fixture.whenStable();
    expect(host().querySelector('.tip')).toBeNull();

    listbox().dispatchEvent(new FocusEvent('focus'));
    await fixture.whenStable();
    expect(host().querySelector('.tip')!.textContent).toContain('cycle 9');
    expect(listbox().getAttribute('aria-activedescendant')).toBe(options()[4].id);
  });

  it('picks a range with the arrow keys and Shift, and clears it with Escape', async () => {
    await make();
    listbox().dispatchEvent(new FocusEvent('focus'));
    await key('Home');
    await key('ArrowRight');
    expect(selectedIds()).toEqual([]);
    expect(fixture.componentInstance.range()).toBeNull();

    await key('ArrowRight', true);
    await key('ArrowRight', true);
    expect(fixture.componentInstance.range()).toEqual({ from: 6, to: 8 });
    expect(selectedIds()).toEqual(['Cycle 6', 'Cycle 7', 'Cycle 8']);
    expect(host().querySelector('.summary')!.textContent).toContain(
      'Cycles 6 to 8 (3). 2 over the 16.6 ms budget.',
    );
    const band = host().querySelector<HTMLElement>('.band')!;
    expect(parseFloat(band.style.left)).toBeCloseTo(20);
    expect(parseFloat(band.style.width)).toBeCloseTo(60);

    await key('ArrowLeft', true);
    expect(fixture.componentInstance.range()).toEqual({ from: 6, to: 7 });

    await key('End');
    await key('Enter');
    expect(fixture.componentInstance.range()).toEqual({ from: 9, to: 9 });

    await key('Escape');
    expect(fixture.componentInstance.range()).toBeNull();
    expect(host().querySelector('.band')).toBeNull();
  });

  it('picks a range by dragging across the bars', async () => {
    await make();
    await pointer('pointerdown', 3);
    expect(fixture.componentInstance.range()).toEqual({ from: 8, to: 8 });
    await pointer('pointermove', 2);
    await pointer('pointermove', 1);
    window.dispatchEvent(new MouseEvent('pointerup'));
    await fixture.whenStable();
    expect(fixture.componentInstance.range()).toEqual({ from: 6, to: 8 });
    // Moving after the button is up only hovers.
    await pointer('pointermove', 0);
    expect(fixture.componentInstance.range()).toEqual({ from: 6, to: 8 });
  });

  it('places a drag by position when the pointer is between bars', async () => {
    await make();
    vi.spyOn(listbox(), 'getBoundingClientRect').mockReturnValue({
      left: 100,
      width: 500,
    } as DOMRect);
    listbox().dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 110 }));
    listbox().dispatchEvent(new MouseEvent('pointermove', { clientX: 590 }));
    await fixture.whenStable();
    expect(fixture.componentInstance.range()).toEqual({ from: 5, to: 9 });
  });

  it('picks a range with the Start and End fields, kept within the recording', async () => {
    await make();
    const [start, end] = [...host().querySelectorAll<HTMLInputElement>('input[type="number"]')];
    expect(start.closest('label')!.textContent).toContain('Start');
    expect(start.value).toBe('5');
    expect(end.value).toBe('9');

    start.value = '7';
    start.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.componentInstance.range()).toEqual({ from: 7, to: 9 });

    end.value = '100';
    end.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.componentInstance.range()).toEqual({ from: 7, to: 9 });
    expect(end.value).toBe('9');

    end.value = '6';
    end.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.componentInstance.range()).toEqual({ from: 6, to: 7 });

    const showAll = [...host().querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Show all cycles',
    )!;
    showAll.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.range()).toBeNull();
  });

  it('lists the picked cycles in a table', async () => {
    await make();
    const rows = () =>
      [...host().querySelectorAll('.table tbody tr')].map((tr) =>
        [...tr.querySelectorAll('td')].map((td) => td.textContent!.trim()),
      );
    expect(rows()).toHaveLength(5);
    expect(rows()[1]).toEqual(['6', '20 ms', 'Over', '2', '1', '', 'List (12 ms)']);
    expect(rows()[2]).toEqual([
      '7',
      '2.00 ms',
      'Within',
      '1',
      '1',
      '(click) on Button',
      'Row (1.00 ms)',
    ]);

    fixture.componentInstance.range.set({ from: 8, to: 9 });
    await fixture.whenStable();
    expect(rows().map((r) => r[0])).toEqual(['8', '9']);
    const region = host().querySelector('.table-wrap')!;
    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('tabindex')).toBe('0');
  });
});

describe('CdTreemap', () => {
  let fixture: ComponentFixture<CdTreemap>;
  const host = () => fixture.nativeElement as HTMLElement;
  const buttons = () => [...host().querySelectorAll<HTMLButtonElement>('button.cell')];

  it('draws a cell per component, the slowest first, and picks one by click or keys', async () => {
    fixture = TestBed.createComponent(CdTreemap);
    fixture.componentRef.setInput('stats', aggregateComponents(CYCLES));
    await fixture.whenStable();
    const picked: string[] = [];
    fixture.componentInstance.pick.subscribe((name) => picked.push(name));

    expect(buttons().map((b) => b.getAttribute('aria-label')!.split(',')[0])).toEqual([
      'List',
      'Cart',
      'Row',
    ]);
    expect(buttons()[0].getAttribute('aria-label')).toBe('List, 37 ms self time, 80%, 4 checks');
    expect(buttons().map((b) => b.tabIndex)).toEqual([0, -1, -1]);

    buttons()[1].click();
    expect(picked).toEqual(['Cart']);

    buttons()[0].focus();
    host()
      .querySelector('ul')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await fixture.whenStable();
    expect(document.activeElement).toBe(buttons()[2]);
    expect(buttons().map((b) => b.tabIndex)).toEqual([-1, -1, 0]);
    fixture.destroy();
  });

  it('folds components past the first 24 into one cell that is not a button', async () => {
    fixture = TestBed.createComponent(CdTreemap);
    fixture.componentRef.setInput(
      'stats',
      Array.from({ length: 30 }, (_, i) => ({
        name: `C${i}`,
        checks: 1,
        ms: 30 - i,
        maxMs: 1,
        cycles: 1,
      })),
    );
    await fixture.whenStable();
    expect(buttons()).toHaveLength(24);
    expect(host().querySelector('.other')!.textContent).toContain('6 more components');
    fixture.destroy();
  });
});

describe('CdRecording with the chart', () => {
  it('drives the treemap and the component totals from the picked cycles', async () => {
    const page: CdPage = {
      pageId: 'p1',
      supported: true,
      recording: false,
      startedAt: null,
      dropped: 0,
      cycles: CYCLES,
      components: [
        { name: 'List', checks: 9, ms: 99, maxMs: 25, cycles: 3 },
        { name: 'Cart', checks: 3, ms: 8, maxMs: 5, cycles: 2 },
      ],
      hosts: {},
    };
    const fixture = TestBed.createComponent(CdRecording);
    fixture.componentRef.setInput('page', page);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const table = () =>
      [...host.querySelectorAll('.cd-grid table tbody tr')].map(
        (tr) => tr.querySelector('td')!.textContent,
      );
    expect(host.querySelector('app-cd-cycle-chart')).not.toBeNull();
    expect(table()).toEqual(['List', 'Cart']);
    expect(host.querySelector('.cd-grid h3')!.textContent!.trim()).toBe('Slowest components');

    fixture.componentInstance.range.set({ from: 5, to: 5 });
    await fixture.whenStable();
    expect(table()).toEqual(['Cart']);
    expect(host.querySelector('.cd-grid h3')!.textContent!.trim()).toBe(
      'Slowest components in the picked cycles',
    );
    expect(host.querySelector('app-cd-treemap ul')!.getAttribute('aria-label')).toContain(
      'cycle 5',
    );

    const shown: string[] = [];
    fixture.componentInstance.showComponent.subscribe((name) => shown.push(name));
    host.querySelector<HTMLButtonElement>('app-cd-treemap button')!.click();
    expect(shown).toEqual(['Cart']);
    fixture.destroy();
  });
});

describe('CdFlameGraph', () => {
  const names = ['App', 'Cart', 'Cart.ngOnInit', 'Button (onClick)', 'Row', 'afterRender'];
  // Cycle 1: an output 2 ms before the tick, App (0 to 6) holding Cart (1 to 4)
  // holding a hook (2 to 3), then Row (4 to 6) inside App, then afterRender (6 to 7).
  const withSpans = (id: number, extra: object = {}): CdCycle =>
    ({
      ...cycle(id, 6),
      spans: [
        [3, -2, 1, 0, 'o'],
        [0, 0, 6, 0, 'c'],
        [1, 1, 3, 1, 'c'],
        [2, 2, 1, 2, 'h'],
        [4, 4, 2, 1, 'c'],
        [5, 6, 1, 0, 'r'],
      ],
      ...extra,
    }) as CdCycle;

  it('lays spans out on one time axis with nesting and self time', async () => {
    const { buildFlame } = await import('../pages/cd-chart-data');
    expect(buildFlame([cycle(1, 3)], names)).toBeNull();
    const graph = buildFlame([withSpans(1), withSpans(2)], names)!;
    // Each cycle runs from the output at -2 ms to afterRender's end at 7 ms: 9 ms, 18 ms in all.
    expect(graph.totalMs).toBe(18);
    expect(graph.depth).toBe(3);
    expect(graph.cycles.map((c) => [c.id, c.x, c.w])).toEqual([
      [1, 0, 50],
      [2, 50, 50],
    ]);
    const [output, app, cart, hook, row, after] = graph.blocks;
    expect(output).toMatchObject({
      name: 'Button (onClick)',
      kind: 'o',
      x: 0,
      parent: null,
      component: 'Button',
    });
    expect(app.x).toBeCloseTo((2 / 18) * 100);
    expect(app.w).toBeCloseTo((6 / 18) * 100);
    expect(app).toMatchObject({ name: 'App', ms: 6, selfMs: 1, parent: null, component: 'App' });
    expect(cart).toMatchObject({ name: 'Cart', selfMs: 2, parent: app.index, depth: 1 });
    expect(hook).toMatchObject({ kind: 'h', parent: cart.index, depth: 2, component: 'Cart' });
    expect(row).toMatchObject({ name: 'Row', parent: app.index });
    expect(after).toMatchObject({ kind: 'r', depth: 0, component: null });
    expect(graph.blocks[7]).toMatchObject({ name: 'App', cycleId: 2 });
    expect(graph.blocks[7].x).toBeCloseTo(50 + (2 / 18) * 100);
  });

  let fixture: ComponentFixture<CdFlameGraph>;
  const host = () => fixture.nativeElement as HTMLElement;
  const blocks = () => [...host().querySelectorAll<HTMLButtonElement>('button.block')];

  async function make(cycles: CdCycle[]) {
    fixture = TestBed.createComponent(CdFlameGraph);
    fixture.componentRef.setInput('cycles', cycles);
    fixture.componentRef.setInput('names', names);
    await fixture.whenStable();
  }

  it('shows nothing when the cycles carry no spans', async () => {
    await make([cycle(1, 3)]);
    expect(host().textContent!.trim()).toBe('');
  });

  it('asks for a smaller range past the cycle limit', async () => {
    await make(Array.from({ length: 31 }, (_, i) => withSpans(i + 1)));
    expect(blocks()).toHaveLength(0);
    expect(host().querySelector('.note')!.textContent).toContain('Pick 30 cycles or fewer');
  });

  it('moves with the arrow keys and picks components with Enter or click', async () => {
    await make([withSpans(1, { droppedSpans: 3 })]);
    const picked: string[] = [];
    fixture.componentInstance.pick.subscribe((name) => picked.push(name));
    expect(blocks()).toHaveLength(6);
    expect(blocks().map((b) => [...b.classList].find((c) => c.startsWith('kind-')))).toEqual([
      'kind-o',
      'kind-c',
      'kind-c',
      'kind-h',
      'kind-c',
      'kind-r',
    ]);
    expect([...host().querySelectorAll('.legend li')].map((li) => li.textContent!.trim())).toEqual([
      'component',
      'hook',
      'afterRender',
      'output',
    ]);
    expect(blocks()[1].getAttribute('aria-label')).toBe(
      'App, component, 6.00 ms total, 1.00 ms self, cycle 1 at 0.00 ms',
    );
    expect(blocks()[0].getAttribute('aria-label')).toBe(
      'Button (onClick), output, 1.00 ms total, cycle 1, 2.00 ms before it started',
    );
    expect(blocks()[0].getAttribute('aria-disabled')).toBeNull();
    expect(blocks()[5].getAttribute('aria-disabled')).toBe('true');
    expect(blocks().filter((b) => b.tabIndex === 0)).toHaveLength(1);
    expect(host().querySelector('.note')!.textContent).toContain('3 shorter spans were left out');

    const group = host().querySelector('[role="group"]')!;
    const press = async (key: string) => {
      group.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      await fixture.whenStable();
    };
    blocks()[0].focus();
    await press('ArrowRight');
    expect(document.activeElement).toBe(blocks()[1]);
    await press('ArrowDown');
    expect(document.activeElement).toBe(blocks()[2]);
    await press('ArrowRight');
    expect(document.activeElement).toBe(blocks()[4]);
    await press('ArrowUp');
    expect(document.activeElement).toBe(blocks()[1]);
    expect(host().querySelector('.readout')!.textContent).toContain('App, component');

    blocks()[5].click();
    expect(picked).toEqual([]);
    blocks()[2].click();
    blocks()[3].click();
    blocks()[0].click();
    expect(picked).toEqual(['Cart', 'Cart', 'Button']);
    fixture.destroy();
  });

  it('lists the spans in a table when it is opened', async () => {
    await make([withSpans(1)]);
    const details = host().querySelector('details')!;
    expect(details.querySelector('table')).toBeNull();
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    await fixture.whenStable();
    const rows = [...details.querySelectorAll('tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent!.trim()),
    );
    expect(rows).toHaveLength(6);
    expect(rows[0]).toEqual([
      '1',
      'Button (onClick)',
      'output',
      '0',
      '-2.00 ms',
      '1.00 ms',
      '1.00 ms',
    ]);
    expect(rows[1]).toEqual(['1', 'App', 'component', '0', '0.00 ms', '6.00 ms', '1.00 ms']);
    fixture.destroy();
  });
});

describe('CdRecording with spans', () => {
  it('draws the picked cycles as a flame graph when the recording has spans', async () => {
    const spanned = { ...cycle(1, 4), spans: [[0, 0, 4, 0, 'c']] } as CdCycle;
    const base: CdPage = {
      pageId: 'p1',
      supported: true,
      recording: false,
      startedAt: null,
      dropped: 0,
      cycles: [cycle(1, 4)],
      components: [],
      hosts: {},
    };
    const fixture = TestBed.createComponent(CdRecording);
    fixture.componentRef.setInput('page', base);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('app-cd-flame-graph button')).toBeNull();

    fixture.componentRef.setInput('page', { ...base, cycles: [spanned], spanNames: ['Shell'] });
    await fixture.whenStable();
    const block = host.querySelector('app-cd-flame-graph button')!;
    expect(block.getAttribute('aria-label')).toContain('Shell, component, 4.00 ms total');
    const shown: string[] = [];
    fixture.componentInstance.showComponent.subscribe((name) => shown.push(name));
    (block as HTMLButtonElement).click();
    expect(shown).toEqual(['Shell']);
    expect(host.querySelector('.spans-note')).toBeNull();
    fixture.destroy();
  });

  it('says why there is no flame graph when the cycles have no spans', async () => {
    const fixture = TestBed.createComponent(CdRecording);
    fixture.componentRef.setInput('page', {
      pageId: 'p1',
      supported: true,
      recording: false,
      startedAt: null,
      dropped: 0,
      cycles: [cycle(1, 4)],
      components: [],
      hosts: {},
    } satisfies CdPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('app-cd-flame-graph button')).toBeNull();
    expect(host.querySelector('app-cd-treemap')).not.toBeNull();
    expect(host.querySelector('.spans-note')!.textContent).toContain(
      'This recording has no timed spans',
    );
    fixture.destroy();
  });
});
