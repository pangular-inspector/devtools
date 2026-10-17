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
const { DiInspector } = await import('../pages/di-inspector');

const element = (
  id: string,
  name: string,
  component: string,
  componentId: string,
  children = [],
) => ({
  injector: {
    id,
    type: 'element',
    name,
    providerCount: 0,
    component,
    componentId,
    directives: [component],
  },
  providers: [],
  children,
});

const state: Record<string, unknown> = {
  'component-tree': {
    pages: {
      p1: {
        pageId: 'p1',
        title: 'Demo',
        url: '/',
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
  'injector-tree': {
    pages: {
      p1: {
        pageId: 'p1',
        reportedAt: 1,
        roots: [
          {
            ...element('inj-1', 'app-root', 'App', 'c1'),
            children: [element('inj-2', 'app-shell', 'Shell', 'c7')],
          },
        ],
        environment: [],
      },
    },
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
    status: 'connected',
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

const el = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;
const activeTab = (fixture: ComponentFixture<unknown>) =>
  el(fixture).querySelector('nav button.active')?.textContent?.trim();
const button = (fixture: ComponentFixture<unknown>, text: string) =>
  [...el(fixture).querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.replace(/\s+/g, ' ').replace(/ :/g, ':').trim() === text,
  );

function child<T>(fixture: ComponentFixture<unknown>, type: abstract new (...args: never[]) => T) {
  return fixture.debugElement.query((node) => node.componentInstance instanceof type)
    .componentInstance as T;
}

async function open(tab: string) {
  location.hash = `#tab=${tab}`;
  const fixture = TestBed.createComponent(App);
  document.body.append(el(fixture));
  await settle(fixture);
  connection.resolve(fakeClient());
  await settle(fixture);
  return fixture;
}

afterEach(() => {
  document.body.innerHTML = '';
  location.hash = '';
  sessionStorage.clear();
});

describe('links between the Components and Injectors tabs', () => {
  it("opens the selected component's element injector from the Components tab", async () => {
    const fixture = await open('components');
    el(fixture).querySelector<HTMLElement>('.row[data-id="c7"]')!.click();
    await settle(fixture);

    const show = button(fixture, 'Show in Injectors: Shell');
    expect(show).toBeDefined();
    show!.click();
    await settle(fixture);

    expect(activeTab(fixture)).toBe('Injectors');
    const di = child(fixture, DiInspector);
    expect(di.selectedId()).toBe('inj-2');
    expect(el(fixture).querySelector('.row[data-id="inj-2"]')?.getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(fixture.componentInstance.injectorFocus()).toBeNull();
  });

  it('opens the owning component from an element injector', async () => {
    const fixture = await open('injectors');
    el(fixture).querySelector<HTMLElement>('.row[data-id="inj-2"]')!.click();
    await settle(fixture);

    button(fixture, 'Show in Components: Shell')!.click();
    await settle(fixture);

    expect(activeTab(fixture)).toBe('Components');
    expect(child(fixture, ComponentTree).selectedId()).toBe('c7');
  });

  it('says so when the component has no element injector on the page', async () => {
    const fixture = await open('injectors');
    fixture.componentInstance.showInjector({ componentId: 'c404', pageId: 'p1' });
    await settle(fixture);
    const status = [...el(fixture).querySelectorAll('[role="status"]')].map((n) =>
      n.textContent?.trim(),
    );
    expect(status).toContain("That component's injector is not on this page.");
    expect(fixture.componentInstance.injectorFocus()).toBeNull();
  });
});
