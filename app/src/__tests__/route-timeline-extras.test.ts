import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { RouteTimeline } from '../pages/route-timeline';
import type { NavigationRecord, RouterPage } from '../pages/router-types';

function fakeClient(): DevframeRpcClient {
  const rpc = { call: () => Promise.resolve(undefined), callEvent: () => Promise.resolve() };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

function nav(extra: Partial<NavigationRecord> = {}): NavigationRecord {
  return {
    id: 1,
    url: '/orders/7',
    trigger: 'imperative',
    startedAt: 1,
    endedAt: 2,
    outcome: 'succeeded',
    ...extra,
  };
}

function mount(page: Partial<RouterPage>) {
  const fixture = TestBed.createComponent(RouteTimeline);
  fixture.componentRef.setInput('page', {
    pageId: 'p1',
    reportedAt: 1,
    snapshot: null,
    navigations: [],
    ...page,
  });
  fixture.componentRef.setInput('rpc', fakeClient());
  document.body.append(fixture.nativeElement as HTMLElement);
  return fixture;
}

function text(fixture: ComponentFixture<unknown>): string {
  return ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('RouteTimeline extras', () => {
  it('marks a navigation whose target came from a query param', async () => {
    const fixture = mount({
      navigations: [nav({ queryRedirect: { param: 'returnUrl', by: 'navigateByUrl()' } })],
    });
    await settle(fixture);
    expect(text(fixture)).toContain('open redirect risk');
    expect(text(fixture)).toContain(
      'The target came from query param returnUrl (navigateByUrl()).',
    );
  });

  it('asks for the Compare view from a row', async () => {
    const fixture = mount({ navigations: [nav()] });
    const asked: number[] = [];
    fixture.componentInstance.compare.subscribe((id) => asked.push(id));
    await settle(fixture);
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[aria-label^="Compare navigation 1"]')!
      .click();
    expect(asked).toEqual([1]);
  });
});
