import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { scopeToPage } from '../page-id';
import { LiveRoute } from '../pages/live-route';
import type { RouterPage } from '../pages/router-types';

function routerPage(pageId: string): RouterPage {
  return {
    pageId,
    reportedAt: 1,
    snapshot: {
      url: `/${pageId}`,
      queryParams: {},
      fragment: null,
      root: { path: '', url: '', outlet: 'primary', params: {}, data: {}, children: [] },
    },
    navigations: [],
  };
}

function fakeClient(initial: RouterPage[]) {
  let pages = initial;
  const listeners = new Set<(value: unknown) => void>();
  const rpc = {
    call: () => Promise.resolve(null),
    callEvent: () => Promise.resolve(),
    sharedState: () =>
      Promise.resolve({
        value: () => ({ pages }),
        on: (_event: string, listener: (value: unknown) => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      }),
  };
  const client = { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
  const report = (next: RouterPage[]) => {
    pages = next;
    for (const listener of listeners) listener({ pages });
  };
  return { client, report };
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

afterEach(() => {
  scopeToPage(null);
  document.body.innerHTML = '';
});

describe('LiveRoute pinned to a page', () => {
  it('shows the empty state instead of another tab until its own page reports', async () => {
    scopeToPage('A');
    const { client, report } = fakeClient([routerPage('B')]);
    const fixture = TestBed.createComponent(LiveRoute);
    fixture.componentRef.setInput('rpc', client);
    document.body.append(fixture.nativeElement);
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('No page is reporting router state yet.');
    expect(host.querySelector('app-route-current')).toBeNull();

    report([routerPage('B'), routerPage('A')]);
    await settle(fixture);
    expect(host.querySelector('app-route-current')).not.toBeNull();
    expect(fixture.componentInstance.page()?.pageId).toBe('A');
  });

  it('still follows the first reporting page when not pinned', async () => {
    const { client } = fakeClient([routerPage('B')]);
    const fixture = TestBed.createComponent(LiveRoute);
    fixture.componentRef.setInput('rpc', client);
    await settle(fixture);
    expect(fixture.componentInstance.page()?.pageId).toBe('B');
  });
});
