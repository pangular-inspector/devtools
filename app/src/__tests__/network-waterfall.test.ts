import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NetworkInspector } from '../pages/network-inspector';
import { groupCalls } from '../pages/network-waterfall';

let fixture: ComponentFixture<NetworkInspector>;

const call = (overrides: Record<string, unknown>) => ({
  id: 'c',
  url: '/api/products',
  method: 'GET',
  status: 200,
  durationMs: 100,
  side: 'client' as const,
  cacheHit: false,
  faulted: false,
  at: 1000,
  pageUrl: '/shop',
  ...overrides,
});

const host = () => fixture.nativeElement as HTMLElement;
const waterfallRows = () => [...host().querySelectorAll<HTMLButtonElement>('button.wf-row')];
const viewButton = (name: string) =>
  [...host().querySelectorAll<HTMLButtonElement>('.view-toggle button')].find(
    (b) => b.textContent!.trim() === name,
  )!;

describe('groupCalls', () => {
  it('groups client calls by page URL in start order, newest navigation first', () => {
    const groups = groupCalls([
      call({ id: 'b', at: 1050, durationMs: 50 }),
      call({ id: 'a', at: 1000, durationMs: 200 }),
      call({ id: 's', side: 'server', at: 900 }),
      call({ id: 'c', at: 3000, durationMs: 10, pageUrl: '/shop/7' }),
    ]);
    expect(groups.map((g) => [g.index, g.url, g.spanMs])).toEqual([
      [2, '/shop/7', 10],
      [1, '/shop', 200],
    ]);
    const [first, second] = groups[1].rows;
    expect([first.call.id, first.left, first.width]).toEqual(['a', 0, 100]);
    expect([second.call.id, second.left, second.width]).toEqual(['b', 25, 25]);
    expect(second.label).toBe('GET /api/products, starts at +50 ms, takes 50 ms, status 200');
  });

  it('marks failed, cancelled and transfer cache calls', () => {
    const tones = groupCalls([
      call({ id: 'a', status: 503 }),
      call({ id: 'b', status: 0, cancelled: true, at: 1001 }),
      call({ id: 'c', cacheHit: true, at: 1002 }),
      call({ id: 'd', status: 0, at: 1003 }),
    ])[0].rows.map((r) => r.tone);
    expect(tones).toEqual(['bad', 'neutral', 'cache', 'bad']);
  });

  it('names each outcome in text, not only by bar colour', () => {
    const statuses = groupCalls([
      call({ id: 'a', status: 503 }),
      call({ id: 'b', status: 0, cancelled: true, at: 1001 }),
      call({ id: 'c', cacheHit: true, at: 1002 }),
      call({ id: 'd', status: 0, at: 1003 }),
      call({ id: 'e', at: 1004 }),
    ])[0].rows.map((r) => r.status);
    expect(statuses).toEqual(['503', 'cancelled', '200 cache', 'ERR', '200']);
  });
});

describe('NetworkInspector waterfall and headers', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView ??= () => {};
  });

  beforeEach(async () => {
    fixture = TestBed.createComponent(NetworkInspector);
    document.body.append(fixture.nativeElement);
    const inspector = fixture.componentInstance;
    inspector.serverCalls.set([call({ id: 's1', side: 'server', at: 900 })]);
    inspector.pages.set([
      {
        pageId: 'p1',
        url: '/shop',
        title: 'Shop',
        hydration: null,
        reportedAt: 1100,
        calls: [
          call({
            id: 'c1',
            requestHeaders: { accept: 'application/json', authorization: '[redacted]' },
            responseHeaders: { 'content-type': 'application/json' },
          }),
          call({ id: 'c2', url: '/api/cart', at: 1040, durationMs: 20, status: 500 }),
          call({ id: 'c3', url: '/api/item/7', at: 4000, pageUrl: '/shop/7' }),
        ],
      },
    ]);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('switches the timeline to a waterfall of client calls grouped by navigation', async () => {
    expect(viewButton('Table').getAttribute('aria-pressed')).toBe('true');
    viewButton('Waterfall').click();
    await fixture.whenStable();
    expect(viewButton('Waterfall').getAttribute('aria-pressed')).toBe('true');
    const headings = [...host().querySelectorAll('app-network-waterfall h3')].map((h) =>
      h.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(headings).toEqual([
      'Navigation 2, /shop/7, 1 call, 100 ms',
      'Navigation 1, /shop, 2 calls, 100 ms',
    ]);
    expect(waterfallRows().map((b) => b.getAttribute('aria-label'))).toEqual([
      'GET /api/item/7, starts at +0 ms, takes 100 ms, status 200',
      'GET /api/products, starts at +0 ms, takes 100 ms, status 200',
      'GET /api/cart, starts at +40 ms, takes 20 ms, status 500',
    ]);
    // One Tab stop for the whole waterfall.
    expect(waterfallRows().filter((b) => b.tabIndex === 0)).toHaveLength(1);
    // The status shows in each row, and the count says what the waterfall shows.
    expect(
      waterfallRows().map((b) =>
        b.querySelector('.time')!.textContent!.replace(/\s+/g, ' ').trim(),
      ),
    ).toEqual(['200 · +0 ms · 100 ms', '200 · +0 ms · 100 ms', '500 · +40 ms · 20 ms']);
    expect(waterfallRows()[2].querySelector('.status-bad')).not.toBeNull();
    expect(host().querySelector('.total')!.textContent).toBe('3 client calls of 4');
    viewButton('Table').click();
    await fixture.whenStable();
    expect(host().querySelector('.total')!.textContent).toBe('4 of 4');
  });

  it('opens a waterfall row in the preview with its redacted headers', async () => {
    viewButton('Waterfall').click();
    await fixture.whenStable();
    waterfallRows()[1].click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    expect(waterfallRows()[1].getAttribute('aria-pressed')).toBe('true');
    const preview = host().querySelector('#call-preview')!;
    expect(document.activeElement?.id).toBe('preview-heading');
    const sides = [...preview.querySelectorAll('app-http-headers section')].map((section) => ({
      title: section.querySelector('h4')!.textContent!.trim(),
      rows: [...section.querySelectorAll('.row')].map((row) => [
        row.querySelector('dt')!.textContent!.trim(),
        row.querySelector('dd')!.textContent!.trim(),
      ]),
    }));
    expect(sides).toEqual([
      {
        title: 'Request headers (2)',
        rows: [
          ['accept', 'application/json'],
          ['authorization', '[redacted]'],
        ],
      },
      { title: 'Response headers (1)', rows: [['content-type', 'application/json']] },
    ]);
    expect(preview.querySelector('dd.masked')!.textContent).toBe('[redacted]');
  });

  it('returns focus to the waterfall row when its preview closes', async () => {
    viewButton('Waterfall').click();
    await fixture.whenStable();
    waterfallRows()[2].click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.activeElement?.id).toBe('preview-heading');
    const close = [...host().querySelectorAll<HTMLButtonElement>('#call-preview button')].find(
      (b) => b.textContent!.trim() === 'Close',
    )!;
    close.click();
    await fixture.whenStable();
    expect(host().querySelector('#call-preview')).toBeNull();
    expect(document.activeElement).toBe(waterfallRows()[2]);
    expect(waterfallRows()[2].dataset['callId']).toBe('c2');
  });

  it('says when no headers were recorded', async () => {
    fixture.componentInstance.openCall('c2');
    await fixture.whenStable();
    const nones = [...host().querySelectorAll('app-http-headers .none')].map((p) =>
      p.textContent!.trim(),
    );
    expect(nones[0]).toBe('None recorded.');
    expect(nones[1]).toContain('CORS');
  });

  it('explains an empty waterfall when only server calls match', async () => {
    fixture.componentInstance.sideFilter.set('server');
    viewButton('Waterfall').click();
    await fixture.whenStable();
    expect(waterfallRows()).toHaveLength(0);
    expect(host().querySelector('app-network-waterfall .empty')!.textContent).toContain(
      'No client calls to show.',
    );
  });
});
