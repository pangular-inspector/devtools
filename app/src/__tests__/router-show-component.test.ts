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

const singlePage: Record<string, unknown> = {
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

function treePage(pageId: string, reportedAt: number, routedId: string) {
  return {
    pageId,
    title: `Demo ${pageId}`,
    url: '/shell',
    roots: [
      {
        id: `${pageId}-root`,
        name: 'App',
        tag: 'app-root',
        children: [{ id: routedId, name: 'Shell', tag: 'app-shell', children: [] }],
      },
    ],
    count: 2,
    detail: null,
    reportedAt,
  };
}

function routerPage(pageId: string, reportedAt: number, devtoolsId: string) {
  return {
    pageId,
    reportedAt,
    snapshot: {
      url: '/shell',
      queryParams: {},
      fragment: null,
      root: { path: '', url: '', outlet: 'primary', params: {}, data: {}, children: [] },
    },
    navigations: [],
    outlets: [
      { outlet: 'primary', activated: true, component: 'Shell', route: '/shell', devtoolsId },
    ],
  };
}

// Two app tabs: the older one reports a router snapshot first, so the Router tab
// shows it, while the Components tab shows the newest page.
const twoPages: Record<string, unknown> = {
  'component-tree': {
    pages: { old: treePage('old', 1, 'old-shell'), new: treePage('new', 2, 'new-shell') },
  },
  router: { pages: [routerPage('old', 1, 'old-shell'), routerPage('new', 2, 'new-shell')] },
};

// The router still reports a component the tree no longer has.
const gone: Record<string, unknown> = {
  'component-tree': { pages: { p1: treePage('p1', 1, 'c7') } },
  router: { pages: [routerPage('p1', 1, 'c9')] },
};

let state = singlePage;

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

async function openRoutes(data: Record<string, unknown>) {
  state = data;
  location.hash = '#tab=routes';
  const fixture = TestBed.createComponent(App);
  document.body.append(el(fixture));
  await settle(fixture);
  connection.resolve(fakeClient());
  await settle(fixture);
  return fixture;
}

function tree(fixture: ComponentFixture<unknown>) {
  return fixture.debugElement.query((node) => node.componentInstance instanceof ComponentTree)
    .componentInstance as InstanceType<typeof ComponentTree>;
}

afterEach(() => {
  state = singlePage;
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
    fixture.componentInstance.showComponent({ id: 'c7' });
    expect(fixture.componentInstance.tab()).toBe('components');
    expect(fixture.componentInstance.componentFocus()).toEqual({ id: 'c7' });
  });

  it('selects the component on the page the Router tab shows', async () => {
    const fixture = await openRoutes(twoPages);
    const show = el(fixture).querySelector<HTMLButtonElement>('.outlets li button');
    show!.click();
    await settle(fixture);

    expect(activeTab(fixture)).toBe('Components');
    expect(tree(fixture).page()?.pageId).toBe('old');
    expect(tree(fixture).selectedId()).toBe('old-shell');
    expect(el(fixture).querySelector('[data-id="old-shell"]')?.getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('says so when the component is no longer on the page', async () => {
    const fixture = await openRoutes(gone);
    el(fixture).querySelector<HTMLButtonElement>('.outlets li button')!.click();
    await settle(fixture);

    expect(activeTab(fixture)).toBe('Components');
    expect(tree(fixture).selectedId()).toBeNull();
    const status = [...el(fixture).querySelectorAll('[role="status"]')].map((n) =>
      n.textContent?.trim(),
    );
    expect(status).toContain('That component is no longer on the page.');
    expect(fixture.componentInstance.componentFocus()).toBeNull();
  });
});
