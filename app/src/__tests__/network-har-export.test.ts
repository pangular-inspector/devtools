import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { NetworkInspector } from '../pages/network-inspector';
import { harFileName } from '../pages/network/har-export';

let fixture: ComponentFixture<NetworkInspector>;

const call = (overrides: Record<string, unknown>) => ({
  id: 'c',
  url: '/api/products',
  method: 'GET',
  status: 200,
  durationMs: 10,
  side: 'client' as const,
  cacheHit: false,
  faulted: false,
  at: 1000,
  pageUrl: '/shop',
  ...overrides,
});

const host = () => fixture.nativeElement as HTMLElement;
const exportButton = () =>
  [...host().querySelectorAll<HTMLButtonElement>('app-har-export button')].find(
    (b) => b.textContent!.trim() === 'Export HAR',
  )!;

describe('harFileName', () => {
  it('names the file after the page path', () => {
    expect(harFileName('/shop/7?tab=reviews')).toBe('pangular-shop-7.har');
    expect(harFileName('/')).toBe('pangular-home.har');
    expect(harFileName(undefined)).toBe('pangular-home.har');
  });
});

describe('NetworkInspector HAR export', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView ??= () => {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('is off until the timeline has a call', async () => {
    fixture = TestBed.createComponent(NetworkInspector);
    document.body.append(fixture.nativeElement);
    await fixture.whenStable();
    expect(exportButton().disabled).toBe(true);
  });

  it('saves the timeline and the SSR request as a HAR file', async () => {
    fixture = TestBed.createComponent(NetworkInspector);
    document.body.append(fixture.nativeElement);
    const inspector = fixture.componentInstance;
    inspector.requests.set([
      {
        id: 'r1',
        method: 'GET',
        url: '/shop',
        status: 200,
        at: 500,
        durationMs: 80,
        renderMs: 60,
        bytes: 100,
        renderMode: 'server',
        fetches: 1,
        fetchMs: 5,
        headers: { 'server-timing': 'render;dur=60' },
      },
    ]);
    inspector.serverCalls.set([call({ id: 's1', side: 'server', requestId: 'r1', at: 600 })]);
    inspector.pages.set([
      {
        pageId: 'p1',
        url: '/shop',
        title: 'Shop',
        hydration: null,
        ssrRequestId: 'r1',
        reportedAt: 1,
        calls: [call({ id: 'c1', requestHeaders: { authorization: '[redacted]' } })],
      },
    ]);
    await fixture.whenStable();

    let blob: Blob | undefined;
    const create = vi.fn((value: Blob) => {
      blob = value;
      return 'blob:har';
    });
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    let downloaded = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloaded = this.download;
    });

    exportButton().click();
    await fixture.whenStable();

    expect(downloaded).toBe('pangular-shop.har');
    const har = JSON.parse(await blob!.text());
    expect(har.log.entries.map((e: { _side: string }) => e._side)).toEqual([
      'document',
      'server',
      'client',
    ]);
    expect(har.log.entries[2].request.headers).toEqual([
      { name: 'authorization', value: '[redacted]' },
    ]);
    expect(host().querySelector('.toolbar .message')!.textContent!.trim()).toBe(
      'Saved 3 requests as pangular-shop.har.',
    );
  });
});
