import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { NetworkInspector } from '../pages/network-inspector';

// Long lists render only the rows near view: the HTTP call table here; the
// component tree has its own test.

const COUNT = 2000;

const call = (i: number) => ({
  id: `c${i}`,
  url: `/api/items/${i}`,
  method: 'GET',
  status: 200,
  durationMs: 12,
  side: 'client' as const,
  cacheHit: false,
  faulted: false,
  at: 1000 + i,
});

async function settle(fixture: { whenStable(): Promise<unknown> }) {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function network(count: number) {
  const fixture = TestBed.createComponent(NetworkInspector);
  document.body.appendChild(fixture.nativeElement);
  fixture.componentInstance.pages.set([
    {
      pageId: 'p1',
      url: '/shop',
      title: 'Shop',
      hydration: null,
      reportedAt: 1100,
      calls: Array.from({ length: count }, (_, i) => call(i)),
    },
  ]);
  await settle(fixture);
  return fixture;
}

afterEach(() => TestBed.resetTestingModule());

describe('a long HTTP call table', () => {
  it('renders the rows near view and keeps the row count for screen readers', async () => {
    const fixture = await network(COUNT);
    const host = fixture.nativeElement as HTMLElement;
    const rows = host.querySelectorAll('tbody tr[data-vindex]');
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.length).toBeLessThan(200);
    expect(host.querySelector('table')!.getAttribute('aria-rowcount')).toBe(String(COUNT + 1));
    expect(rows[3]!.getAttribute('aria-rowindex')).toBe('5');
    const spacer = host.querySelector<HTMLElement>('tbody tr.spacer:last-child td')!;
    expect(parseFloat(spacer.style.height)).toBeGreaterThan(50_000);
    expect(host.querySelector('.filters .total')!.textContent!.trim()).toBe(`${COUNT} of ${COUNT}`);
    fixture.destroy();
  });

  it('goes to the last call with End', async () => {
    const fixture = await network(COUNT);
    const host = fixture.nativeElement as HTMLElement;
    const first = host.querySelector<HTMLElement>('button[data-call-id]')!;
    first.focus();
    first.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }),
    );
    await settle(fixture);
    const focused = document.activeElement as HTMLElement;
    expect(focused.closest('tr')!.getAttribute('aria-rowindex')).toBe(String(COUNT + 1));
    // One Tab stop in the table.
    expect(host.querySelectorAll('button[data-call-id][tabindex="0"]')).toHaveLength(1);
    fixture.destroy();
  });

  it('renders a short table whole, without spacers', async () => {
    const fixture = await network(20);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('tbody tr[data-vindex]')).toHaveLength(20);
    expect(host.querySelector('tbody tr.spacer')).toBeNull();
    fixture.destroy();
  });
});
