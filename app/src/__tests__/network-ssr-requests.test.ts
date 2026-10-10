import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { NetworkInspector } from '../pages/network-inspector';

let fixture: ComponentFixture<NetworkInspector>;

const call = (overrides: Record<string, unknown>) => ({
  id: 'c',
  url: 'http://localhost/api/products',
  method: 'GET',
  status: 200,
  durationMs: 12,
  side: 'server' as const,
  cacheHit: false,
  faulted: false,
  at: 1001,
  ...overrides,
});

describe('NetworkInspector SSR requests', () => {
  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('shows the empty state until the middleware traces a request', async () => {
    fixture = TestBed.createComponent(NetworkInspector);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('#ssr-heading')!.textContent).toContain('SSR requests (0)');
    expect(host.textContent).toContain('devtools.ssrMiddleware');
  });

  it('opens the request that served the selected page and lists refetched calls', async () => {
    fixture = TestBed.createComponent(NetworkInspector);
    const inspector = fixture.componentInstance;
    inspector.requests.set([
      {
        id: 'r1',
        method: 'GET',
        url: '/examples/ssr',
        status: 200,
        at: 1000,
        durationMs: 40,
        renderMs: 35,
        bytes: 2048,
        renderMode: 'server',
        fetches: 2,
        fetchMs: 24,
        headers: {},
      },
    ]);
    inspector.serverCalls.set([
      call({ id: 's1', requestId: 'r1' }),
      call({ id: 's2', requestId: 'r1', method: 'POST', url: 'http://localhost/api/quote' }),
    ]);
    inspector.pages.set([
      {
        pageId: 'p1',
        url: '/examples/ssr',
        title: 'SSR requests',
        hydration: null,
        ssrRequestId: 'r1',
        reportedAt: 1100,
        calls: [
          call({ id: 'b1', side: 'client', url: '/api/products', cacheHit: true, at: 1200 }),
          call({ id: 'b2', side: 'client', url: '/api/quote', method: 'POST', at: 1200 }),
        ],
      },
    ]);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const detail = host.querySelector('#ssr-detail')!;
    expect(detail.textContent).toContain('r1');
    expect(detail.textContent).toContain('Server calls (2)');
    expect(detail.textContent).toContain('Fetched again in the browser (1)');
    expect(inspector.refetched().map((c) => c.id)).toEqual(['b2']);
    expect(host.querySelector('tr.selected .tag.server')!.textContent).toBe('this page');

    inspector.selectedRequestId.set('r2');
    inspector.pages.update((pages) => pages.map((p) => ({ ...p, reportedAt: 2000 })));
    await fixture.whenStable();
    expect(inspector.selectedRequestId()).toBe('r2');
  });
});
