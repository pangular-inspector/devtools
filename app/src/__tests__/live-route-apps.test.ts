import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { LiveRoute } from '../pages/live-route';
import type { RouterApp, RouterPage } from '../pages/router-types';

const root = { path: '', url: '', outlet: 'primary', params: {}, data: {}, children: [] };

function routerPage(extra: Partial<RouterPage> = {}): RouterPage {
  return {
    pageId: 'p1',
    reportedAt: 1,
    changedAt: 1,
    snapshot: { url: '/home', queryParams: {}, fragment: null, root },
    navigations: [
      {
        id: 1,
        url: '/home',
        trigger: 'imperative',
        startedAt: 1,
        endedAt: 2,
        outcome: 'succeeded',
      },
    ],
    ...extra,
  };
}

const apps: RouterApp[] = [
  { id: 'app-root', name: 'ShellApp', selector: 'app-root', primary: true },
  {
    id: 'cart-widget',
    name: 'CartWidget',
    selector: 'cart-widget',
    snapshot: { url: '/checkout', queryParams: {}, fragment: null, root },
    navigations: [
      {
        id: 4,
        url: '/checkout',
        trigger: 'imperative',
        startedAt: 3,
        endedAt: 4,
        outcome: 'failed',
      },
    ],
  },
];

function fakeClient(pages: RouterPage[]) {
  const calls: { name: string; arg: unknown }[] = [];
  const rpc = {
    call: (name: string, arg: unknown) => {
      calls.push({ name, arg });
      return Promise.resolve(null);
    },
    callEvent: () => Promise.resolve(),
    sharedState: () =>
      Promise.resolve({
        value: () => ({ pages }),
        on: () => () => {},
      }),
  };
  const client = { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
  return { client, calls };
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('LiveRoute on a page with several apps', () => {
  it('offers an app picker and shows the picked app', async () => {
    const { client } = fakeClient([routerPage({ apps })]);
    const fixture = TestBed.createComponent(LiveRoute);
    fixture.componentRef.setInput('rpc', client);
    document.body.append(fixture.nativeElement);
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('#live-route-app-label')?.textContent).toBe('App');
    expect(fixture.componentInstance.appId()).toBe('app-root');
    expect(fixture.componentInstance.page()?.snapshot?.url).toBe('/home');
    expect(fixture.componentInstance.appOptions().map((o) => o.label)).toEqual([
      'ShellApp <app-root>',
      'CartWidget <cart-widget>',
    ]);

    fixture.componentInstance.appId.set('cart-widget');
    await settle(fixture);
    const view = fixture.componentInstance.page();
    expect(view?.appId).toBe('cart-widget');
    expect(view?.pageId).toBe('p1');
    expect(view?.snapshot?.url).toBe('/checkout');
    expect(fixture.componentInstance.problems()).toBe(1);
  });

  it('shows no app picker on a page with one app', async () => {
    const page = routerPage();
    const { client } = fakeClient([page]);
    const fixture = TestBed.createComponent(LiveRoute);
    fixture.componentRef.setInput('rpc', client);
    document.body.append(fixture.nativeElement);
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('#live-route-app-label')).toBeNull();
    expect(fixture.componentInstance.appId()).toBeNull();
    expect(fixture.componentInstance.page()).toBe(page);
  });
});
