import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fullPanelHref } from '../full-panel';

const connection = vi.hoisted(() => ({ resolve: (_client: unknown) => {} }));

vi.mock('devframe/client', () => ({
  connectDevframe: () =>
    new Promise((resolve) => {
      connection.resolve = resolve;
    }),
}));

const { App } = await import('../app');

const BASE = '/__devframes/pangular/';
const capacitorPage = {
  pageId: 'cap1',
  url: '/',
  title: 'Trips',
  reportedAt: 5_000,
  info: {
    platform: 'android',
    native: true,
    bridge: true,
    webCalls: false,
    env: { serverUrl: '', debug: false, logging: false, capacitorHttp: true, userAgent: 'UA' },
    plugins: [],
  },
  calls: {},
  listeners: [],
  dropped: 0,
};

function fakeClient(capacitorPages: Record<string, unknown>) {
  const rpc = {
    call: () => new Promise(() => {}),
    callEvent: () => Promise.resolve(),
    sharedState: (name: string) =>
      Promise.resolve(
        name === 'capacitor'
          ? { value: () => ({ pages: capacitorPages }), on: () => () => {} }
          : { value: () => null, on: () => () => {} },
      ),
  };
  return {
    connectionMeta: { configs: {} },
    scope: () => ({ rpc }),
    events: { on: () => () => {} },
  } as unknown as DevframeRpcClient;
}

/** The hub's client context on the parent window, which switches docks like the rail does. */
function fakeHub(selectedId: string) {
  const listeners = new Map<string, () => void>();
  const docks = {
    selectedId,
    getStateById: (id: string) => ({
      events: {
        on: (_event: 'entry:activated', listener: () => void) => {
          listeners.set(id, listener);
          return () => listeners.delete(id);
        },
      },
    }),
    switchEntry: vi.fn(async (id?: string | null) => {
      docks.selectedId = id ?? '';
      listeners.get(id ?? '')?.();
      return true;
    }),
  };
  const parent = { __DEVFRAME_HUB_CLIENT_CONTEXT__: { docks } };
  vi.spyOn(window, 'parent', 'get').mockReturnValue(parent as unknown as Window);
  return { docks, activate: (id: string) => docks.switchEntry(id) };
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

async function open(path: string, capacitorPages: Record<string, unknown> = {}) {
  history.replaceState(null, '', path);
  const fixture = TestBed.createComponent(App);
  await settle(fixture);
  connection.resolve(fakeClient(capacitorPages));
  await settle(fixture);
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const link = (el: HTMLElement) => el.querySelector<HTMLAnchorElement>('header a.full-panel');

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  history.replaceState(null, '', '/');
});

describe('Open full panel link', () => {
  it('links a hub view to the full panel on the tab with the same content', async () => {
    const { el } = await open(`${BASE}?view=capacitor`, { cap1: capacitorPage });
    const anchor = link(el);
    expect(anchor?.textContent?.trim()).toBe('Open full panel');
    expect(anchor?.getAttribute('href')).toBe(`${BASE}#tab=capacitor`);
  });

  it('keeps other parameters and links the Angular view to its current tab', async () => {
    const { el } = await open(`${BASE}?view=angular&theme=light`);
    expect(link(el)?.getAttribute('href')).toBe(`${BASE}?theme=light#tab=dashboard`);
  });

  it('links a view with nothing to show to the Dashboard, not to a remembered tab', async () => {
    const { el } = await open(`${BASE}?view=angular-native`);
    expect(el.textContent).toContain('No Angular Native app is connected');
    expect(link(el)?.getAttribute('href')).toBe(`${BASE}#tab=dashboard`);
  });

  it('links the Capacitor view to the Dashboard while no app reports', async () => {
    const { el } = await open(`${BASE}?view=capacitor`);
    expect(el.textContent).toContain('Inspect Capacitor apps');
    expect(link(el)?.getAttribute('href')).toBe(`${BASE}#tab=dashboard`);
  });

  it('is not shown on the full panel', async () => {
    const { el } = await open(BASE);
    expect(link(el)).toBeNull();
  });

  it('switches the hub to the All tools dock and shows the full panel in place', async () => {
    const hub = fakeHub('pangular:capacitor');
    const { fixture, el } = await open(`${BASE}?view=capacitor`, { cap1: capacitorPage });
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Capacitor');

    link(el)!.click();
    await settle(fixture);
    expect(hub.docks.switchEntry).toHaveBeenCalledWith('pangular:all');
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Pangular Inspector');
    expect(el.querySelector('nav button.active')?.textContent).toContain('Capacitor');
    expect(location.pathname + location.search + location.hash).toBe(`${BASE}#tab=capacitor`);
    expect(link(el)).toBeNull();
    expect(document.activeElement?.textContent).toContain('Capacitor');
  });

  it('lets the browser follow the link outside the hub', async () => {
    const { el } = await open(`${BASE}?view=capacitor`);
    let prevented: boolean | undefined;
    const record = (event: Event) => {
      prevented = event.defaultPrevented;
      // jsdom can't navigate, so stop it after the panel had its turn.
      event.preventDefault();
    };
    document.addEventListener('click', record);
    link(el)!.click();
    document.removeEventListener('click', record);
    expect(prevented).toBe(false);
  });
});

describe('Hub rail and the full panel', () => {
  it('moves between the full panel and a view as the rail selection changes', async () => {
    const hub = fakeHub('pangular:all');
    const { fixture, el } = await open(BASE);
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Pangular Inspector');

    await hub.activate('pangular:ngrx');
    await settle(fixture);
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('NgRx Store');
    expect(new URLSearchParams(location.search).get('view')).toBe('ngrx');

    await hub.activate('pangular:all');
    await settle(fixture);
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Pangular Inspector');
    expect(new URLSearchParams(location.search).get('view')).toBeNull();
  });
});

describe('fullPanelHref', () => {
  it('drops the view and sets or clears the tab', () => {
    expect(fullPanelHref(`http://localhost${BASE}?view=ngrx#tab=store`, 'store')).toBe(
      `${BASE}#tab=store`,
    );
    expect(fullPanelHref(`http://localhost${BASE}?view=nativescript#tab=x`)).toBe(BASE);
  });
});
