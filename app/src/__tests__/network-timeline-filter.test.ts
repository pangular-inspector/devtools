import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NetworkInspector } from '../pages/network-inspector';

let fixture: ComponentFixture<NetworkInspector>;

const call = (overrides: Record<string, unknown>) => ({
  id: 'c',
  url: 'http://localhost/api/products',
  method: 'GET',
  status: 200,
  durationMs: 12,
  side: 'client' as const,
  cacheHit: false,
  faulted: false,
  at: 1000,
  ...overrides,
});

const host = () => fixture.nativeElement as HTMLElement;
const rows = () => [...host().querySelectorAll<HTMLElement>('button[data-call-id]')];
const rowIds = () => rows().map((b) => b.dataset['callId']);
const total = () => host().querySelector('.filters .total')!.textContent!.trim();
const search = () => host().querySelector<HTMLInputElement>('#timeline-search')!;

async function type(value: string) {
  search().value = value;
  search().dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

describe('NetworkInspector timeline filters', () => {
  beforeEach(async () => {
    fixture = TestBed.createComponent(NetworkInspector);
    const inspector = fixture.componentInstance;
    inspector.serverCalls.set([
      call({ id: 's1', side: 'server', url: 'http://localhost/api/products', at: 1001 }),
      call({ id: 's2', side: 'server', url: 'http://localhost/api/cart', status: 503, at: 1002 }),
    ]);
    inspector.pages.set([
      {
        pageId: 'p1',
        url: '/shop',
        title: 'Shop',
        hydration: null,
        reportedAt: 1100,
        calls: [
          call({ id: 'c1', url: '/api/products', at: 1003 }),
          call({ id: 'c2', method: 'POST', url: '/api/orders', status: 0, at: 1004 }),
          call({ id: 'c3', url: '/api/search', status: 0, cancelled: true, at: 1005 }),
          call({ id: 'c4', url: '/api/user', status: 304, at: 1006 }),
        ],
      },
    ]);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('labels every filter control and counts all calls', () => {
    expect(rows()).toHaveLength(6);
    expect(total()).toBe('6 of 6');
    expect(search().getAttribute('aria-label')).toBe('Find a URL or method');
    const failed = [...host().querySelectorAll<HTMLLabelElement>('.filters label')].find((l) =>
      l.textContent?.includes('Failed only'),
    );
    expect(failed?.querySelector('input[type="checkbox"]')).not.toBeNull();
  });

  it('matches the URL and the method, and Escape clears the search', async () => {
    await type('products');
    expect(rowIds()).toEqual(['c1', 's1']);
    expect(total()).toBe('2 of 6');

    await type('post');
    expect(rowIds()).toEqual(['c2']);
    expect(total()).toBe('1 of 6');

    search().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(search().value).toBe('');
    expect(rows()).toHaveLength(6);
    expect(total()).toBe('6 of 6');
  });

  it('keeps failed, ERR and cancelled calls with Failed only', async () => {
    const box = host().querySelector<HTMLInputElement>('.failed-toggle input')!;
    box.click();
    await fixture.whenStable();
    expect(rowIds()).toEqual(['c3', 'c2', 's2']);
    expect(total()).toBe('3 of 6');
  });

  it('filters by side and combines filters', async () => {
    fixture.componentInstance.sideFilter.set('server');
    await fixture.whenStable();
    expect(rowIds()).toEqual(['s2', 's1']);
    expect(total()).toBe('2 of 6');

    fixture.componentInstance.failedOnly.set(true);
    await fixture.whenStable();
    expect(rowIds()).toEqual(['s2']);

    fixture.componentInstance.sideFilter.set('client');
    await fixture.whenStable();
    expect(rowIds()).toEqual(['c3', 'c2']);
  });

  it('shows a no-match state whose Clear filters resets every filter', async () => {
    fixture.componentInstance.sideFilter.set('server');
    fixture.componentInstance.failedOnly.set(true);
    await type('nothing-here');
    expect(rows()).toHaveLength(0);
    expect(total()).toBe('0 of 6');
    expect(host().textContent).toContain('No requests match.');
    expect(host().textContent).not.toContain('No requests yet.');

    const clear = [...host().querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Clear filters',
    )!;
    clear.click();
    await fixture.whenStable();
    expect(rows()).toHaveLength(6);
    expect(search().value).toBe('');
    expect(fixture.componentInstance.sideFilter()).toBe('all');
    expect(fixture.componentInstance.failedOnly()).toBe(false);
    expect(document.activeElement).toBe(search());
  });

  it('hides the preview while its call is filtered out and brings it back after', async () => {
    rows()
      .find((b) => b.dataset['callId'] === 'c1')!
      .closest('tr')!
      .click();
    await fixture.whenStable();
    expect(host().querySelector('#call-preview')).not.toBeNull();

    await type('orders');
    expect(host().querySelector('#call-preview')).toBeNull();
    expect(host().querySelector('tr.selected')).toBeNull();

    await type('');
    expect(host().querySelector('#call-preview')).not.toBeNull();
    expect(host().querySelector('tr.selected button')?.getAttribute('data-call-id')).toBe('c1');
  });

  it('keeps the empty state when there are no calls at all', async () => {
    fixture.componentInstance.serverCalls.set([]);
    fixture.componentInstance.pages.set([]);
    await fixture.whenStable();
    expect(total()).toBe('0 of 0');
    expect(host().textContent).toContain('No requests yet.');
    expect(host().textContent).not.toContain('Clear filters');
  });
});
