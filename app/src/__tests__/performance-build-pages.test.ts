import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PerformanceInspector,
  formatPerf,
  perfPages,
  type PerfPage,
} from '../pages/performance-inspector';
import {
  BuildInspector,
  formatBytes,
  formatMs,
  timeBreakdown,
  type BuildGraph,
} from '../pages/build-inspector';

function client(options: { state?: unknown; call?: (name: string) => unknown }) {
  const call = vi.fn(async (name: string) => options.call?.(name));
  const scoped = {
    rpc: {
      call,
      sharedState: async () => ({ value: () => options.state ?? null, on: () => () => {} }),
    },
  };
  return { rpc: { scope: () => scoped } as unknown as DevframeRpcClient, call };
}

const page = (extra: Partial<PerfPage> = {}): PerfPage => ({
  pageId: 'tab1',
  url: '/trips',
  title: 'Trips',
  reportedAt: 1000,
  metrics: {
    LCP: {
      value: 3100,
      rating: 'needs-improvement',
      target: 'img#hero',
      owner: { id: 'c1-2', name: 'TripCard' },
    },
    CLS: { value: 0.02, rating: 'good' },
  },
  interactions: [{ event: 'click', durationMs: 240, at: 5000, target: 'button#book' }],
  longTasks: [
    { at: 100, durationMs: 120, kind: 'longtask' },
    { at: 900, durationMs: 80, kind: 'long-animation-frame', source: 'main.js' },
  ],
  longTaskCount: 2,
  totalBlockingMs: 100,
  supported: ['largest-contentful-paint', 'layout-shift', 'longtask'],
  ...extra,
});

async function settle(fixture: ComponentFixture<unknown>) {
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await fixture.whenStable();
}

describe('Performance tab', () => {
  let fixture: ComponentFixture<PerformanceInspector>;
  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  async function render(state: unknown) {
    fixture = TestBed.createComponent(PerformanceInspector);
    fixture.componentRef.setInput('rpc', client({ state }).rpc);
    document.body.append(fixture.nativeElement);
    await settle(fixture as ComponentFixture<unknown>);
    return fixture.nativeElement as HTMLElement;
  }

  it('says when no page reports', async () => {
    const host = await render({ pages: {} });
    expect(host.textContent).toContain('No page reports performance yet.');
  });

  it('shows each vital with its rating, owner and why a metric is missing', async () => {
    const shown: unknown[] = [];
    const host = await render({ pages: { tab1: page() } });
    fixture.componentInstance.showComponent.subscribe((focus) => shown.push(focus));
    const cards = [...host.querySelectorAll<HTMLElement>('.metric')];
    const card = (name: string) =>
      cards.find((c) => c.querySelector('abbr')!.textContent === name)!;
    expect(card('LCP').dataset['rating']).toBe('needs-improvement');
    expect(card('LCP').textContent).toContain('3.10 s');
    expect(card('LCP').textContent).toContain('Needs improvement');
    expect(card('INP').textContent).toContain('Not measured by this browser');
    expect(card('TTFB').textContent).toContain('Not measured yet');
    card('LCP').querySelector<HTMLButtonElement>('button.link')!.click();
    expect(shown).toEqual([{ id: 'c1-2', pageId: 'tab1' }]);
    expect(host.textContent).toContain('2 long tasks, total blocking time 100 ms.');
    // Newest long task first.
    expect(host.querySelectorAll('section')[2]!.querySelector('tbody tr')!.textContent).toContain(
      'main.js',
    );
  });

  it('reads only well-formed pages, newest first, and formats values', () => {
    expect(
      perfPages({
        pages: { a: page({ reportedAt: 1 }), b: page({ pageId: 'b', reportedAt: 2 }), c: {} },
      }).map((p) => p.pageId),
    ).toEqual(['b', 'tab1']);
    expect(formatPerf('CLS', 0.1234)).toBe('0.123');
    expect(formatPerf('INP', 240.4)).toBe('240 ms');
  });
});

describe('Build tab', () => {
  let fixture: ComponentFixture<BuildInspector>;
  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  const graph: BuildGraph = {
    vite: {
      modules: Array.from({ length: 30 }, (_, i) => ({
        url: `/src/m${i}.ts`,
        file: `src/m${i}.ts`,
        type: 'js' as const,
        size: 1000 - i,
        importers: 1,
        imports: 0,
        dynamicImports: [],
      })),
      totalSize: 30_000,
      entries: ['/src/main.ts'],
      initialSize: 5000,
      lazy: [
        {
          url: '/src/trips.ts',
          file: 'src/trips.ts',
          importers: ['src/app.routes.ts'],
          modules: 3,
          size: 4200,
        },
      ],
    },
    outputNote: 'No production build found.',
  };

  async function render(answer: unknown) {
    const fake = client({ call: () => answer });
    fixture = TestBed.createComponent(BuildInspector);
    fixture.componentRef.setInput('rpc', fake.rpc);
    document.body.append(fixture.nativeElement);
    await settle(fixture as ComponentFixture<unknown>);
    return { host: fixture.nativeElement as HTMLElement, call: fake.call };
  }

  it('shows lazy boundaries, a capped module list, a filter and the build note', async () => {
    const { host, call } = await render(graph);
    expect(call).toHaveBeenCalledWith('get-build-graph');
    expect(host.textContent).toContain('src/trips.ts');
    expect(host.textContent).toContain('4.2 kB');
    const rows = () =>
      host
        .querySelectorAll('section')[0]!
        .querySelectorAll('table')[1]!
        .querySelectorAll('tbody tr');
    expect(rows()).toHaveLength(25);
    [...host.querySelectorAll('button')].find((b) => b.textContent!.includes('Show all'))!.click();
    await fixture.whenStable();
    expect(rows()).toHaveLength(30);
    fixture.componentInstance.filter.set('m29');
    await fixture.whenStable();
    expect(rows()).toHaveLength(1);
    fixture.componentInstance.filter.set('nothing');
    await fixture.whenStable();
    expect(host.textContent).toContain('No module matches');
    expect(host.textContent).toContain('No production build found.');
  });

  it('formats bytes', () => {
    expect(formatBytes(4200)).toBe('4.2 kB');
  });

  it('shows the time per module and sorts the module list by time', async () => {
    const timed: BuildGraph = {
      ...graph,
      vite: {
        ...graph.vite!,
        modules: graph.vite!.modules.map((mod, i) =>
          i === 0 ? mod : { ...mod, time: { resolve: 0.2, load: 1, transform: i, total: i + 1.2 } },
        ),
        timings: { modules: 29, capped: false },
      },
    };
    const { host } = await render(timed);
    const table = () => host.querySelectorAll('section')[0]!.querySelectorAll('table')[1]!;
    const firstCells = () =>
      [...table().querySelectorAll('tbody tr')].slice(0, 2).map((row) => {
        const cells = row.querySelectorAll('td');
        return [cells[0]!.textContent!.trim(), cells[2]!.textContent!.trim()];
      });
    expect(host.textContent).toContain('Time is what the dev server spent on 29 modules');
    // Biggest first, as the server sends them; m0 was not timed.
    expect(firstCells()).toEqual([
      ['src/m0.ts', ''],
      ['src/m1.ts', '2.2 ms'],
    ]);
    expect(table().querySelectorAll('tbody tr td')[7]!.getAttribute('title')).toBe(
      'Resolve 0.2 ms, load 1.0 ms, transform 1.0 ms',
    );
    const timeHeader = [...table().querySelectorAll('th')].find((th) =>
      th.textContent!.includes('Time'),
    )!;
    const sortButton = timeHeader.querySelector('button')!;
    sortButton.click();
    await fixture.whenStable();
    expect(timeHeader.getAttribute('aria-sort')).toBe('ascending');
    expect(firstCells()[0]).toEqual(['src/m1.ts', '2.2 ms']);
    sortButton.click();
    await fixture.whenStable();
    expect(timeHeader.getAttribute('aria-sort')).toBe('descending');
    expect(firstCells()[0]).toEqual(['src/m29.ts', '30.2 ms']);
    // The module without a time stays last in both directions.
    [...host.querySelectorAll('button')].find((b) => b.textContent!.includes('Show all'))!.click();
    await fixture.whenStable();
    const rows = table().querySelectorAll('tbody tr');
    expect(rows[rows.length - 1]!.querySelector('td')!.textContent!.trim()).toBe('src/m0.ts');
  });

  it('formats milliseconds and the time breakdown', () => {
    expect(formatMs(12.34)).toBe('12.3 ms');
    expect(formatMs(2500)).toBe('2.50 s');
    expect(timeBreakdown({ resolve: 0.1, load: 2, transform: 40.5, total: 42.6 })).toBe(
      'Resolve 0.1 ms, load 2.0 ms, transform 40.5 ms',
    );
  });
});
