import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { NetworkInspector } from '../pages/network-inspector';

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

async function mount() {
  fixture = TestBed.createComponent(NetworkInspector);
  document.body.append(fixture.nativeElement);
  const inspector = fixture.componentInstance;
  inspector.serverCalls.set([
    call({ id: 's1', side: 'server', url: 'http://api.test/api/products', requestId: 'r1' }),
  ]);
  inspector.pages.set([
    {
      pageId: 'p1',
      url: 'http://localhost/shop',
      title: 'Shop',
      hydration: null,
      ssrRequestId: 'r1',
      reportedAt: 1,
      calls: [
        call({ id: 'c1' }),
        call({ id: 'c2', url: '/api/products/7', at: 1100 }),
        call({ id: 'c3', url: '/api/cart', method: 'POST', at: 1200 }),
      ],
    },
  ]);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const type = async (value: string) => {
    const input = host.querySelector<HTMLInputElement>('#rule-pattern')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const count = () =>
    host.querySelector('app-rule-match-count [role="status"]')!.textContent!.trim();
  return { inspector, type, count };
}

describe('NetworkInspector rule match count', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView ??= () => {};
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('says nothing until a pattern is typed', async () => {
    const { count } = await mount();
    expect(count()).toBe('');
  });

  it('counts the client and SSR calls the pattern matches as it is typed', async () => {
    const { type, count } = await mount();
    await type('/api/products');
    expect(count()).toBe('Matches 3 of the 4 recorded calls.');
    await type('^/api/cart');
    expect(count()).toBe('Matches 1 of the 4 recorded calls.');
    await type('/api/*');
    expect(count()).toBe('Matches all 4 recorded calls.');
    await type('/nothing');
    expect(count()).toBe(
      'Matches none of the 4 recorded calls. It can still match later requests.',
    );
  });

  it('applies the method and target of the draft', async () => {
    const { inspector, type, count } = await mount();
    await type('/api/*');
    inspector.setDraft('method', 'POST');
    await fixture.whenStable();
    expect(count()).toBe('Matches 1 of the 4 recorded calls.');
    inspector.setDraft('method', '');
    inspector.setDraft('target', 'server');
    await fixture.whenStable();
    expect(count()).toBe('Matches 1 of the 4 recorded calls.');
  });
});
