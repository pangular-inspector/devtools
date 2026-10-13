import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeaksSection, type LeaksPage } from '../pages/leaks-section';

const NOW = 1_000_000;

function page(extra: Partial<LeaksPage> = {}): LeaksPage {
  return {
    pageId: 'p1',
    url: '/trips',
    title: 'Trips',
    at: NOW,
    reportedAt: NOW,
    support: { retention: true, effects: true, subscriptions: 'off', detached: true },
    navigations: 5,
    totals: { components: 3, effects: 3, subscriptions: 0, destroyed: 3, collected: 4, dropped: 0 },
    components: [
      { id: 'c1', name: 'TripList', effects: 2, subscriptions: 0 },
      { id: 'c2', name: 'Banner', effects: 0, sharedEffects: 1, subscriptions: 0 },
    ],
    destroyed: [
      { id: 'c9', name: 'TripCard', route: '/trips/7', destroyedAt: NOW - 60_000, navigations: 3 },
      { id: 'c10', name: 'TripMap', route: '/trips/8', destroyedAt: NOW - 1000, navigations: 0 },
      {
        id: 'c11',
        name: 'Cached',
        route: '/a',
        destroyedAt: NOW - 90_000,
        navigations: 4,
        detached: true,
      },
    ],
    subscriptions: [],
    ...extra,
  };
}

let fixture: ComponentFixture<LeaksSection>;
let rpcCall: ReturnType<typeof vi.fn>;
const host = () => fixture.nativeElement as HTMLElement;
const text = () => host().textContent!.replace(/\s+/g, ' ');
const button = (label: string) =>
  [...host().querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(label))!;

async function show(report: LeaksPage | null) {
  fixture.componentRef.setInput('report', report);
  await fixture.whenStable();
}

describe('LeaksSection', () => {
  beforeEach(() => {
    rpcCall = vi.fn(() => Promise.resolve({ pages: 1 }));
    const client = { scope: () => ({ rpc: { call: rpcCall } }) };
    fixture = TestBed.createComponent(LeaksSection);
    fixture.componentRef.setInput('pageId', 'p1');
    fixture.componentRef.setInput('rpc', client as unknown as DevframeRpcClient);
    fixture.componentRef.setInput('now', () => NOW);
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('says when the page has not reported yet, with the track button disabled', async () => {
    await show(null);
    expect(text()).toContain('No leak data from this page yet');
    expect(button('Track subscriptions').disabled).toBe(true);
  });

  it('lists retained instances apart from recent and detached ones, and says it is a hint', async () => {
    await show(page());
    const retained = host().querySelectorAll('.rows')[0]!;
    expect(retained.textContent).toContain('TripCard');
    expect(retained.textContent).toContain('/trips/7');
    expect(retained.textContent).toContain('3 navigations ago');
    expect(retained.textContent).toContain('60 s old');
    expect(retained.textContent).not.toContain('TripMap');
    expect(text()).toContain('destroyed recently and not collected yet: TripMap');
    expect(text()).toContain('not destroyed (detached views, such as a route reuse cache): Cached');
    expect(text()).toContain('Memory panel');
    expect(text()).toContain('5 navigations · 1 still retained · 4 instances collected');
    // h2 then h3, never skipping a level.
    expect(host().querySelector('h2')!.textContent).toContain('Leaks');
    expect(host().querySelectorAll('h3')).toHaveLength(3);
  });

  it('says retention is unavailable where DI debug data keeps every instance, and still lists detached views', async () => {
    await show(
      page({
        support: { retention: 'dev-di-debug', effects: true, subscriptions: 'off', detached: true },
      }),
    );
    expect(text()).toContain(
      "In a development build, Angular's DI debug data keeps every destroyed component in memory, so Pangular can't tell a leak from that.",
    );
    expect(text()).toContain('Chrome DevTools Memory panel');
    // No instance is listed as retained or recent, and no collected count is claimed.
    expect(text()).not.toContain('still retained ·');
    expect(text()).not.toContain('collected');
    expect(text()).not.toContain('destroyed recently');
    expect(text()).not.toContain('TripCard');
    expect(text()).toContain('5 navigations');
    expect(text()).toContain('not destroyed (detached views, such as a route reuse cache): Cached');
    expect(host().querySelectorAll('h3')).toHaveLength(3);
    expect(host().querySelectorAll('h3')[0]!.textContent!.trim()).toBe('Still retained');
  });

  it('lists live effects, with the shared note, and selects or highlights a component', async () => {
    await show(page());
    const shown: string[] = [];
    const lit: (string | null)[] = [];
    fixture.componentInstance.showComponent.subscribe((id) => shown.push(id));
    fixture.componentInstance.highlight.subscribe((id) => lit.push(id));
    const row = button('TripList');
    expect(row.textContent).toContain('2 effects');
    expect(button('Banner').textContent).toContain('0 effects, 1 shared');
    expect(text()).toContain('show as shared');
    row.dispatchEvent(new Event('mouseenter'));
    row.click();
    row.dispatchEvent(new Event('mouseleave'));
    expect(shown).toEqual(['c1']);
    expect(lit).toEqual(['c1', null]);
  });

  it('starts and stops subscription tracking for its page and announces it', async () => {
    await show(page());
    expect(text()).toContain('Off. Track subscriptions wraps Observable.prototype.subscribe');
    const track = button('Track subscriptions');
    expect(track.getAttribute('aria-pressed')).toBe('false');
    track.click();
    await fixture.whenStable();
    expect(rpcCall).toHaveBeenLastCalledWith('request-leak-tracking', { pageId: 'p1', on: true });
    expect(host().querySelector('[role="status"]')!.textContent).toContain(
      'Tracking subscriptions',
    );

    await show(
      page({
        support: { retention: true, effects: true, subscriptions: 'on', instances: true },
        subscriptions: [
          {
            name: 'TripCard',
            instanceId: 'c9',
            count: 2,
            source: 'TripCard.ngOnInit (trip-card.ts:12:7)',
            route: '/trips/7',
            openedAt: NOW - 70_000,
            reason: 'instance-destroyed',
          },
        ],
      }),
    );
    expect(text()).toMatch(/TripCard\s*2 open\s*instance destroyed\s*TripCard\.ngOnInit/);
    expect(text()).toContain('takeUntilDestroyed()');
    const stop = button('Track subscriptions');
    expect(stop.textContent!.trim()).toBe('Track subscriptions');
    expect(stop.getAttribute('aria-pressed')).toBe('true');
    stop.click();
    await fixture.whenStable();
    expect(rpcCall).toHaveBeenLastCalledWith('request-leak-tracking', { pageId: 'p1', on: false });
  });

  it('keeps the track button enabled and focused while busy, and ignores clicks then', async () => {
    let resolve!: (value: unknown) => void;
    rpcCall.mockImplementation(() => new Promise((r) => (resolve = r)));
    await show(page());
    const track = button('Track subscriptions');
    track.focus();
    track.click();
    fixture.detectChanges();
    expect(track.disabled).toBe(false);
    expect(track.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(track);
    track.click();
    expect(rpcCall).toHaveBeenCalledTimes(1);
    resolve({ pages: 1 });
    await fixture.whenStable();
    expect(track.hasAttribute('aria-disabled')).toBe(false);
  });

  it('shows the unavailable states', async () => {
    await show(
      page({
        support: { retention: false, effects: false, subscriptions: 'unavailable' },
        components: [],
      }),
    );
    expect(text()).toContain('cannot track destroyed components');
    expect(text()).toContain('no RxJS the overlay can load');
    fixture.componentRef.setInput('angular', {
      version: '19.2.0',
      capabilities: { signalGraph: true },
    });
    await fixture.whenStable();
    expect(text()).toContain('The live signal graph needs Angular 20.1 or later');
  });
});
