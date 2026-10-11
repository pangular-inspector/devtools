import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CapacitorCall, CapacitorPage } from '../pages/capacitor-types';

const connection = vi.hoisted(() => ({ resolve: (_client: unknown) => {} }));

vi.mock('devframe/client', () => ({
  connectDevframe: () =>
    new Promise((resolve) => {
      connection.resolve = resolve;
    }),
}));

const { App } = await import('../app');

function fakeClient(initial: Record<string, CapacitorPage>) {
  let pages = initial;
  const listeners = new Set<(value: unknown) => void>();
  const capacitor = {
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
      Promise.resolve(name === 'capacitor' ? capacitor : { value: () => null, on: () => () => {} }),
  };
  const client = {
    connectionMeta: { configs: {} },
    scope: () => ({ rpc }),
    events: { on: () => () => {} },
  } as unknown as DevframeRpcClient;
  const report = (next: Record<string, CapacitorPage>) => {
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

const host = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;
const text = (fixture: ComponentFixture<unknown>) => host(fixture).textContent ?? '';
const tabNames = (fixture: ComponentFixture<unknown>) =>
  [...host(fixture).querySelectorAll('nav button')].map((b) => b.textContent?.trim());

const call = (id: number, extra: Partial<CapacitorCall> = {}): CapacitorCall => ({
  id,
  plugin: 'Camera',
  method: 'getPhoto',
  kind: 'promise',
  via: 'native',
  args: { quality: 90 },
  status: 'ok',
  result: { format: 'jpeg' },
  startedAt: 1_000 + id,
  durationMs: 120,
  ...extra,
});

const page = (extra: Partial<CapacitorPage> = {}): CapacitorPage => ({
  pageId: 'cap1',
  url: '/trips',
  title: 'Trips',
  reportedAt: 5_000,
  info: {
    platform: 'android',
    native: true,
    bridge: true,
    webCalls: false,
    env: {
      serverUrl: 'https://localhost',
      debug: false,
      logging: false,
      capacitorHttp: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 15)',
    },
    plugins: [
      { name: 'Barcode', available: false, registered: true, native: false, methods: [] },
      { name: 'Camera', available: true, registered: true, native: true, methods: ['getPhoto'] },
      { name: 'Haptics', available: true, registered: false, native: true, methods: ['vibrate'] },
    ],
  },
  calls: [
    call(1),
    call(2, {
      method: 'pickLimitedLibraryPhotos',
      status: 'error',
      result: undefined,
      error: { message: 'Not implemented on Android', code: 'UNIMPLEMENTED' },
    }),
    call(3, {
      plugin: 'Preferences',
      method: 'set',
      status: 'error',
      result: undefined,
      error: { message: 'Disk full' },
    }),
  ],
  listeners: [{ id: '7', plugin: 'Network', event: 'networkStatusChange', addedAt: 1, events: 3 }],
  dropped: 0,
  ...extra,
});

afterEach(() => {
  document.body.innerHTML = '';
  history.replaceState(null, '', '/');
});

describe('Capacitor view', () => {
  beforeEach(() => history.replaceState(null, '', '/?view=capacitor'));

  it('shows the setup steps and links to the Capacitor guide while no app reports', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    connection.resolve(fakeClient({}).client);
    await settle(fixture);
    const el = host(fixture);

    expect(el.querySelector('h1')?.textContent).toContain('Capacitor');
    expect(el.querySelector('.badge')?.textContent).toContain('Available');
    expect(el.querySelector('#soon-title')?.textContent).toBe('Inspect Capacitor apps');
    expect(el.querySelector('.plans-title')?.textContent?.trim()).toBe('Set up an app');
    const steps = [...el.querySelectorAll('.plans li')].map((li) => li.textContent);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toContain('live reload');
    expect(steps[1]).toContain('@pangular-inspector/devtools/overlay-manual');
    expect(steps[1]).toContain('connectionMeta');
    const link = el.querySelector<HTMLAnchorElement>('a.cta');
    expect(link?.textContent).toContain('Capacitor setup guide');
    expect(link?.href).toBe('https://pangular-inspector.dev/guides/capacitor/');
    expect(link?.target).toBe('_blank');
    expect(el.textContent).not.toContain('Coming Soon');
    expect(tabNames(fixture)).toEqual([]);
  });

  it('shows the plugin calls once an app reports, and the setup steps again when it leaves', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    const { client, report } = fakeClient({});
    connection.resolve(client);
    await settle(fixture);

    report({ cap1: page() });
    await settle(fixture);
    const el = host(fixture);
    expect(el.querySelector('#soon-title')).toBeNull();
    expect(text(fixture)).toContain('Plugin calls');
    const rows = [...el.querySelectorAll('.calls .call')].map((b) => b.textContent);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('Preferences.set()');
    expect(rows[0]).toContain('Error');
    expect(rows[1]).toContain('Not implemented');
    expect(rows[2]).toContain('OK');
    expect(text(fixture)).toContain('Only native calls are logged');
    expect(text(fixture)).toContain('Native only');

    report({});
    await settle(fixture);
    expect(el.querySelector('#soon-title')?.textContent).toBe('Inspect Capacitor apps');
  });

  it('filters failed calls, shows a call in detail, and flags plugin problems', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    connection.resolve(fakeClient({ cap1: page() }).client);
    await settle(fixture);
    const el = host(fixture);

    const failed = el.querySelector<HTMLInputElement>('.check input')!;
    failed.click();
    await settle(fixture);
    expect(el.querySelectorAll('.calls .call')).toHaveLength(2);
    expect(text(fixture)).toContain('2 of 3 calls');

    el.querySelector<HTMLButtonElement>('.calls .call')!.click();
    await settle(fixture);
    const detail = el.querySelector('.detail')!;
    expect(detail.textContent).toContain('Preferences.set()');
    expect(detail.textContent).toContain('Disk full');

    const search = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'nothing';
    search.dispatchEvent(new Event('input'));
    await settle(fixture);
    expect(text(fixture)).toContain('No call matches the filters.');
    el.querySelector<HTMLButtonElement>('.empty button')!.click();
    await settle(fixture);
    expect(el.querySelectorAll('.calls .call')).toHaveLength(3);

    const plugins = el.querySelector('section[aria-labelledby="cap-plugins-title"]')!.textContent;
    expect(plugins).toContain('Run npx cap sync');
    expect(plugins).toContain('Installed, not imported by the app.');
    const listeners = el.querySelector('section[aria-labelledby="cap-listeners-title"]')!;
    expect(listeners.textContent).toContain('networkStatusChange');
    expect(listeners.textContent).toContain('Active');
  });

  it('says plainly that calls are not shown on the web', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    const web = page({
      calls: [],
      info: { ...page().info, platform: 'web', native: false, bridge: false },
    });
    connection.resolve(fakeClient({ cap1: web }).client);
    await settle(fixture);

    expect(text(fixture)).toContain("Plugin calls aren't shown on this page.");
    expect(host(fixture).querySelector('.toolbar')).toBeNull();
  });
});

describe('Capacitor tab in the panel', () => {
  it('appears only while a Capacitor app reports', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    const { client, report } = fakeClient({});
    connection.resolve(client);
    await settle(fixture);
    expect(tabNames(fixture)).not.toContain('Capacitor');

    report({ cap1: page() });
    await settle(fixture);
    expect(tabNames(fixture)).toContain('Capacitor');
  });

  it('opens the Capacitor tab from the URL once an app reports', async () => {
    history.replaceState(null, '', '/#tab=capacitor');
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    const { client, report } = fakeClient({});
    connection.resolve(client);
    await settle(fixture);
    expect(host(fixture).querySelector('nav button.active')?.textContent).toContain('Dashboard');

    report({ cap1: page() });
    await settle(fixture);
    expect(host(fixture).querySelector('nav button.active')?.textContent).toContain('Capacitor');
    expect(text(fixture)).toContain('Plugin calls');
  });
});
