import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { NetworkInspector } from '../pages/network-inspector';

let fixture: ComponentFixture<NetworkInspector>;

const host = () => fixture.nativeElement as HTMLElement;
const insights = () => host().querySelector('app-payload-insights')!;

async function mount(size: number, entries: { key: string; size: number; url?: string }[]) {
  fixture = TestBed.createComponent(NetworkInspector);
  document.body.append(fixture.nativeElement);
  const inspector = fixture.componentInstance;
  inspector.pages.set([
    { pageId: 'p1', url: '/', title: 'Home', hydration: null, reportedAt: 1, calls: [] },
  ]);
  inspector.payloads.set({
    p1: {
      found: true,
      size,
      entries: entries.map((e) => ({
        key: e.key,
        size: e.size,
        value: null,
        ...(e.url ? { http: { url: e.url, status: 200 } } : {}),
      })),
    },
  });
  await fixture.whenStable();
}

describe('NetworkInspector payload insights', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView ??= () => {};
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('shows the size against the budget and the largest entries with bars', async () => {
    await mount(2048, [
      { key: 'a', size: 512 },
      { key: 'k1', size: 1536, url: '/api/products' },
    ]);
    expect(insights().querySelector('.budget')!.textContent!.trim()).toBe(
      '2 KB, within the 100 KB budget.',
    );
    const rows = [...insights().querySelectorAll('.largest li')].map((li) => [
      li.querySelector('.name')!.textContent!.trim(),
      li.querySelector('.size')!.textContent!.trim(),
      (li.querySelector('.bar span') as HTMLElement).style.width,
    ]);
    expect(rows).toEqual([
      ['/api/products', '1.5 KB, 75%', '75%'],
      ['a', '512 B, 25%', '25%'],
    ]);
    expect(insights().querySelector('.bar')!.getAttribute('aria-hidden')).toBe('true');
    expect(insights().textContent).not.toContain('Same URL');
  });

  it('warns over the budget and lists a URL stored under more than one key', async () => {
    await mount(150_000, [
      { key: 'k1', size: 90_000, url: '/api/products' },
      { key: 'k2', size: 50_000, url: '/api/products' },
    ]);
    expect(insights().querySelector('.budget.over')!.textContent).toContain(
      '146.5 KB, over the 100 KB budget.',
    );
    const heading = insights().querySelector('#payload-same-url-heading')!;
    expect(heading.textContent!.trim()).toBe('Same URL stored more than once (1)');
    expect(insights().querySelector('.same-url li')!.textContent).toContain('2 keys, 136.7 KB');
  });
});
