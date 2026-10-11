import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { angularNativePage } from '../native-page';
import { hostPageId, scopeToPage } from '../page-id';

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

type Pages = Record<string, { pageId: string; reportedAt: number; platform?: string }>;

function fakeClient(initial: Pages) {
  let pages = initial;
  const listeners = new Set<(value: unknown) => void>();
  const componentTree = {
    value: () => ({ pages }),
    on: (_event: string, listener: (value: unknown) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const rpc = {
    call: () => new Promise(() => {}),
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve(
        name === 'component-tree' ? componentTree : { value: () => null, on: () => () => {} },
      ),
  };
  const client = {
    connectionMeta: { configs: {} },
    scope: () => ({ rpc }),
    events: { on: () => () => {} },
  } as unknown as DevframeRpcClient;
  const report = (next: Pages) => {
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

function host(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

const tabNames = (fixture: ComponentFixture<unknown>) =>
  [...host(fixture).querySelectorAll('nav button')].map((b) => b.textContent?.trim());

const page = { roots: [], count: 0, detail: null };
const browser = { ...page, pageId: 'web1', reportedAt: 3000 };
const native = { ...page, pageId: 'an42', reportedAt: 2000, platform: 'angular-native' };

describe('angularNativePage', () => {
  it('picks the newest Angular Native page and ignores browser pages', () => {
    const older = { pageId: 'an01', reportedAt: 1000, platform: 'angular-native' };
    expect(angularNativePage({ web1: browser, an42: native, an01: older }, null)).toBe('an42');
    expect(angularNativePage({ web1: browser }, null)).toBeNull();
    expect(angularNativePage(undefined, null)).toBeNull();
  });

  it('keeps the page shown before while it still reports', () => {
    const newer = { pageId: 'an99', reportedAt: 9000, platform: 'angular-native' };
    expect(angularNativePage({ an42: native, an99: newer }, 'an42')).toBe('an42');
    expect(angularNativePage({ an99: newer }, 'an42')).toBe('an99');
  });
});

describe('Angular Native view', () => {
  beforeEach(() => history.replaceState(null, '', '/?view=angular-native'));
  afterEach(() => {
    document.body.innerHTML = '';
    history.replaceState(null, '', '/');
    scopeToPage(null);
  });

  it('shows the setup empty state while no Angular Native app reports', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    connection.resolve(fakeClient({ web1: browser }).client);
    await settle(fixture);
    const text = host(fixture).textContent ?? '';
    expect(host(fixture).querySelector('h1')?.textContent).toContain('Angular Native');
    expect(text).toContain('No Angular Native app is connected');
    const link = host(fixture).querySelector<HTMLAnchorElement>('a.cta');
    expect(link?.textContent).toContain('Set up Angular Native');
    expect(link?.href).toContain('guides/angular-native/');
    expect(tabNames(fixture)).toEqual([]);
  });

  it('opens the live tabs scoped to the app once it reports, and goes back when it leaves', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    const { client, report } = fakeClient({ web1: browser });
    connection.resolve(client);
    await settle(fixture);

    report({ web1: browser, an42: native });
    await settle(fixture);
    expect(tabNames(fixture)).toEqual(['Components', 'Signals', 'Injectors', 'Store', 'Pipes']);
    expect(host(fixture).querySelector('nav button.active')?.textContent).toContain('Components');
    expect(host(fixture).textContent).not.toContain('No Angular Native app is connected');
    expect(hostPageId()).toBe('an42');

    report({ web1: browser });
    await settle(fixture);
    expect(host(fixture).textContent).toContain('No Angular Native app is connected');
  });
});
