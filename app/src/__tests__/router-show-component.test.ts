import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const connection = vi.hoisted(() => ({
  resolve: (_client: unknown) => {},
}));

vi.mock('devframe/client', () => ({
  connectDevframe: () =>
    new Promise((resolve) => {
      connection.resolve = resolve;
    }),
}));

const { App } = await import('../app');
const { ComponentTree } = await import('../pages/component-tree');

const state: Record<string, unknown> = {
  'component-tree': {
    pages: {
      p1: {
        pageId: 'p1',
        title: 'Demo',
        url: '/shell',
        roots: [
          {
            id: 'c1',
            name: 'App',
            tag: 'app-root',
            children: [{ id: 'c7', name: 'Shell', tag: 'app-shell', children: [] }],
          },
        ],
        count: 2,
        detail: null,
        reportedAt: 1,
      },
    },
  },
  router: {
    pages: [
      {
        pageId: 'p1',
        reportedAt: 1,
        snapshot: {
          url: '/shell',
          queryParams: {},
          fragment: null,
          root: { path: '', url: '', outlet: 'primary', params: {}, data: {}, children: [] },
        },
        navigations: [],
        outlets: [
          {
            outlet: 'primary',
            activated: true,
            component: 'Shell',
            route: '/shell',
            devtoolsId: 'c7',
          },
        ],
      },
    ],
  },
};

function fakeClient(): DevframeRpcClient {
  const rpc = {
    call: () => Promise.resolve([]),
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve({ value: () => state[name] ?? null, on: () => () => {} }),
  };
  return {
    connectionMeta: { configs: {} },
    scope: () => ({ rpc }),
    events: { on: () => () => {} },
  } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

function el(fixture: ComponentFixture<unknown>) {
  return fixture.nativeElement as HTMLElement;
}

function activeTab(fixture: ComponentFixture<unknown>) {
  return el(fixture).querySelector('nav button.active')?.textContent?.trim();
}

afterEach(() => {
  document.body.innerHTML = '';
  location.hash = '';
  sessionStorage.clear();
});

describe('Show in Components from the Router Current view', () => {
  it('opens the Components tab with the routed component selected', async () => {
    location.hash = '#tab=routes';
    const fixture = TestBed.createComponent(App);
    document.body.append(el(fixture));
    await settle(fixture);
    connection.resolve(fakeClient());
    await settle(fixture);
    expect(activeTab(fixture)).toBe('Routes');

    const show = el(fixture).querySelector<HTMLButtonElement>('.outlets li button');
    expect(show?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Show in Components: Shell');
    show!.click();
    await settle(fixture);

    expect(activeTab(fixture)).toBe('Components');
    const tree = fixture.debugElement.query(
      (node) => node.componentInstance instanceof ComponentTree,
    );
    expect(tree.componentInstance.selectedId()).toBe('c7');
    expect(el(fixture).querySelector('[data-id="c7"]')?.getAttribute('aria-selected')).toBe('true');
    // The tree took the focus, so it is not applied again on a later visit.
    expect(fixture.componentInstance.componentFocus()).toBeNull();
  });

  it('applies the focus after the tab switch so the switch does not clear it', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.showComponent('c7');
    expect(fixture.componentInstance.tab()).toBe('components');
    expect(fixture.componentInstance.componentFocus()).toEqual({ id: 'c7' });
  });
});
