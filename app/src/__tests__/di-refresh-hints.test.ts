import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { DiInspector } from '../pages/di-inspector';

const provider = (token: string) => ({ token, type: 'class', isViewProvider: false });

const element = (id: string, name: string, children: unknown[] = [], deps: string[] = []) => ({
  injector: { id, type: 'element', name, providerCount: 0, component: name },
  providers: [],
  children,
  dependencies: deps.map((token) => ({ from: name, token, flags: [], providedBy: 'inj-r' })),
});

const liveTree = {
  pages: {
    p1: {
      pageId: 'p1',
      reportedAt: 1,
      roots: [element('inj-1', 'app-root', [element('inj-2', 'app-card', [], ['CartStore'])])],
      environment: [
        {
          injector: { id: 'inj-r', type: 'environment', name: 'Root', providerCount: 2 },
          providers: [provider('CartStore'), provider('Settings')],
          children: [
            {
              injector: {
                id: 'inj-a',
                type: 'environment',
                name: 'Route: admin',
                providerCount: 1,
                inactive: true,
              },
              providers: [provider('AdminApi')],
              children: [],
            },
          ],
        },
      ],
    },
  },
};

const source = [
  {
    token: 'CartStore',
    source: 'class',
    file: 'src/cart.ts',
    line: 3,
    providedIn: 'root',
    type: 'injectable',
  },
  {
    token: 'Settings',
    source: 'class',
    file: 'src/settings.ts',
    line: 1,
    providedIn: 'root',
    type: 'injectable',
  },
  {
    token: 'Unused',
    source: 'class',
    file: 'src/unused.ts',
    line: 2,
    providedIn: 'root',
    type: 'injectable',
  },
  {
    token: 'PANEL_TITLE',
    source: 'providers array',
    file: 'src/app.ts',
    line: 9,
    type: 'provider',
  },
  {
    token: 'Router',
    source: 'provideRouter()',
    file: 'src/app.config.ts',
    line: 4,
    providedIn: 'root',
    type: 'root-provider',
  },
  {
    token: 'provideFeature()',
    source: 'provideFeature()',
    file: 'src/app.config.ts',
    line: 5,
    type: 'helper',
  },
  { token: 'CartStore', source: 'cart', file: 'src/card.ts', line: 7, type: 'injection' },
];

const calls: { name: string; payload: unknown }[] = [];

function client(tree: unknown): DevframeRpcClient {
  const rpc = {
    call: (name: string, payload: unknown) => {
      calls.push({ name, payload });
      if (name === 'get-providers') return Promise.resolve(source);
      if (name === 'request-injector-refresh') return Promise.resolve({ ok: true });
      return Promise.resolve([]);
    },
    callEvent: () => Promise.resolve(),
    sharedState: () => Promise.resolve({ value: () => tree, on: () => () => {} }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function render(tree: unknown = liveTree) {
  const fixture = TestBed.createComponent(DiInspector);
  fixture.componentRef.setInput('rpc', client(tree));
  document.body.append(fixture.nativeElement);
  await settle(fixture);
  return fixture;
}

const host = (fixture: ComponentFixture<DiInspector>) => fixture.nativeElement as HTMLElement;
const refreshes = () => calls.filter((c) => c.name === 'request-injector-refresh');

describe('Injectors refresh, inactive route injectors and hints', () => {
  afterEach(() => {
    calls.length = 0;
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('asks the page to read the selected element again, once per selection', async () => {
    const fixture = await render();
    // The first row is selected while nothing else is chosen.
    expect(refreshes().map((c) => c.payload)).toEqual([{ pageId: 'p1', injectorId: 'inj-1' }]);
    fixture.componentInstance.select('inj-2');
    await settle(fixture);
    fixture.componentInstance.select('inj-2');
    await settle(fixture);
    expect(refreshes().map((c) => c.payload)).toEqual([
      { pageId: 'p1', injectorId: 'inj-1' },
      { pageId: 'p1', injectorId: 'inj-2' },
    ]);
    // An environment injector is never cached on its own, so selecting one asks for nothing.
    fixture.componentInstance.setView('environment');
    await settle(fixture);
    expect(refreshes()).toHaveLength(2);
  });

  it('reads every injector again on Refresh', async () => {
    const fixture = await render();
    calls.length = 0;
    const button = [...host(fixture).querySelectorAll<HTMLButtonElement>('.toolbar button')].find(
      (b) => b.textContent?.trim() === 'Refresh',
    )!;
    button.click();
    await settle(fixture);
    expect(refreshes().map((c) => c.payload)).toEqual([{ pageId: 'p1' }]);
    expect(host(fixture).querySelector('[role="status"]')?.textContent).toContain(
      'Reading the injectors again.',
    );
  });

  it('marks a lazy route injector off the rendered path as inactive', async () => {
    const fixture = await render();
    fixture.componentInstance.setView('environment');
    await settle(fixture);
    const admin = [...host(fixture).querySelectorAll('.row')].find((r) =>
      r.textContent?.includes('Route: admin'),
    )!;
    expect(admin.querySelector('.inactive-flag')?.textContent?.trim()).toBe('inactive');
    fixture.componentInstance.select('inj-a');
    await settle(fixture);
    expect(host(fixture).querySelector('.inactive-note')?.textContent).toContain('Inactive');
  });

  it('hints at source providers nothing on the page injected, collapsed', async () => {
    const fixture = await render();
    const toggle = host(fixture).querySelector<HTMLButtonElement>('.orphans-toggle')!;
    expect(toggle.textContent).toContain('2 providers in source are never injected on this page');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const body = host(fixture).querySelector<HTMLElement>('#di-orphans')!;
    expect(body.hidden).toBe(true);
    toggle.click();
    await settle(fixture);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(body.hidden).toBe(false);
    // CartStore is injected; Settings was created by Root; the rest never were.
    expect([...body.querySelectorAll('.token')].map((t) => t.textContent?.trim())).toEqual([
      'Unused',
      'PANEL_TITLE',
    ]);
  });

  it('lists unresolved provide*() helpers in source mode, collapsed until opened', async () => {
    const fixture = await render({ pages: {} });
    const toggle = host(fixture).querySelector<HTMLButtonElement>('.group-toggle')!;
    expect(toggle.textContent).toContain('Helpers (unresolved)');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const list = host(fixture).querySelector<HTMLElement>('#di-helpers')!;
    expect(list.hidden).toBe(true);
    toggle.click();
    await settle(fixture);
    expect(list.hidden).toBe(false);
    expect(list.textContent).toContain('provideFeature()');
    expect(list.textContent).toContain('helper (unresolved)');
  });
});
