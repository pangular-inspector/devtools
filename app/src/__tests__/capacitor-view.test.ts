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

/** The shape the server sends: calls keyed by id. */
function wire(pages: Record<string, CapacitorPage>) {
  return Object.fromEntries(
    Object.entries(pages).map(([id, page]) => [
      id,
      { ...page, calls: Object.fromEntries(page.calls.map((c) => [String(c.id), c])) },
    ]),
  );
}

function fakeClient(initial: Record<string, CapacitorPage> | undefined) {
  let pages = initial;
  const listeners = new Set<(value: unknown) => void>();
  const capacitor = {
    value: () => (pages ? { pages: wire(pages) } : undefined),
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
    for (const listener of listeners) listener({ pages: wire(next) });
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
      {
        name: 'WebView',
        available: true,
        registered: false,
        native: true,
        methods: ['getServerBasePath'],
      },
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

    const failed = el.querySelector<HTMLButtonElement>('.strip [data-filter="failed"]')!;
    failed.click();
    await settle(fixture);
    expect(el.querySelectorAll('.calls .call')).toHaveLength(2);
    expect(text(fixture)).toContain('2 of 3 calls');

    el.querySelector<HTMLButtonElement>('.calls .call')!.click();
    await settle(fixture);
    const detail = el.querySelector('.detail')!;
    expect(detail.textContent).toContain('Preferences.set()');
    detail.querySelector<HTMLButtonElement>('#cap-tab-outcome')!.click();
    await settle(fixture);
    expect(detail.textContent).toContain('Disk full');

    const search = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'nothing';
    search.dispatchEvent(new Event('input'));
    await settle(fixture);
    expect(text(fixture)).toContain('No call matches the filters.');
    expect(el.querySelector('.empty')?.textContent).toContain(
      'hidden by the search “nothing” and the Failed filter',
    );
    el.querySelector<HTMLButtonElement>('.empty button')!.click();
    await settle(fixture);
    expect(el.querySelectorAll('.calls .call')).toHaveLength(3);

    const plugins = el.querySelector('section[aria-labelledby="cap-plugins-title"]')!.textContent;
    expect(plugins).toContain('Not available on android. Run npx cap sync android, then run');
    // Haptics gets the note; WebView, which Capacitor registers itself, does not.
    expect(plugins?.split('Installed, not imported by the app.')).toHaveLength(2);
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

describe('Capacitor view across pages and updates', () => {
  beforeEach(() => history.replaceState(null, '', '/?view=capacitor'));

  const web = (extra: Partial<CapacitorPage> = {}) =>
    page({
      pageId: 'desk',
      title: 'Desktop',
      url: '/home',
      calls: [],
      info: { ...page().info, platform: 'web', native: false, bridge: false },
      ...extra,
    });
  const shownTitle = (fixture: ComponentFixture<unknown>) =>
    host(fixture).querySelector('.page-picker .value')?.textContent?.trim();
  const options = async (fixture: ComponentFixture<unknown>) => {
    host(fixture).querySelector<HTMLButtonElement>('.page-picker [role="combobox"]')!.click();
    await settle(fixture);
    return [...host(fixture).querySelectorAll('.page-picker [role="option"]')];
  };

  it('starts on the device, keeps the picked page while others report, and falls back when it goes', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    const { client, report } = fakeClient({});
    connection.resolve(client);
    await settle(fixture);

    report({ cap1: page({ reportedAt: 1_000 }), desk: web({ reportedAt: 2_000 }) });
    await settle(fixture);
    expect(shownTitle(fixture)).toBe('Trips');

    let listed = await options(fixture);
    expect(listed.map((o) => o.querySelector('.label')?.textContent)).toEqual(['Desktop', 'Trips']);
    (listed[0] as HTMLElement).click();
    await settle(fixture);
    expect(shownTitle(fixture)).toBe('Desktop');

    // The device reports again and is now the newest: the panel stays put, in the same order.
    report({ cap1: page({ reportedAt: 9_000 }), desk: web({ reportedAt: 2_000 }) });
    await settle(fixture);
    expect(shownTitle(fixture)).toBe('Desktop');
    listed = await options(fixture);
    expect(listed.map((o) => o.querySelector('.label')?.textContent)).toEqual(['Desktop', 'Trips']);

    report({ cap1: page({ reportedAt: 9_500 }) });
    await settle(fixture);
    expect(text(fixture)).toContain('Plugin calls');
    expect(host(fixture).querySelectorAll('.calls .call')).toHaveLength(3);
  });

  it('announces the count when a filter changes, not when the app makes a call', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    const { client, report } = fakeClient({ cap1: page() });
    connection.resolve(client);
    await settle(fixture);
    const status = () =>
      host(fixture).querySelector('app-capacitor-inspector .strip[role="status"] .sr-only')!
        .textContent;
    const before = status();

    report({ cap1: page({ calls: [...page().calls, call(4)] }) });
    await settle(fixture);
    expect(host(fixture).querySelectorAll('.calls .call')).toHaveLength(4);
    expect(status()).toBe(before);

    host(fixture).querySelector<HTMLButtonElement>('.strip [data-filter="failed"]')!.click();
    await settle(fixture);
    expect(status()?.trim()).toBe('2 of 4 calls shown');
  });

  it('moves between calls with the arrow keys, Home and End', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    connection.resolve(fakeClient({ cap1: page() }).client);
    await settle(fixture);
    const rows = [...host(fixture).querySelectorAll<HTMLButtonElement>('.calls .call')];
    const list = host(fixture).querySelector('.calls')!;
    const press = (key: string) =>
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    rows[0].focus();
    press('ArrowDown');
    expect(document.activeElement).toBe(rows[1]);
    press('End');
    expect(document.activeElement).toBe(rows[2]);
    press('ArrowDown');
    expect(document.activeElement).toBe(rows[2]);
    press('ArrowUp');
    expect(document.activeElement).toBe(rows[1]);
    press('Home');
    expect(document.activeElement).toBe(rows[0]);
    expect(list.contains(document.activeElement)).toBe(true);
  });

  it('shows unknown states as Unknown and no sync hint for core plugins', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    const info = page().info;
    connection.resolve(
      fakeClient({
        cap1: page({
          info: {
            ...info,
            env: { ...info.env, capacitorHttp: null },
            plugins: [
              { name: 'WebView', available: false, registered: true, native: false, methods: [] },
              { name: 'Camera', available: true, registered: null, native: true, methods: [] },
            ],
          },
        }),
      }).client,
    );
    await settle(fixture);
    const env = host(fixture).querySelector('section[aria-labelledby="cap-env-title"]')!;
    expect(env.textContent).toMatch(/CapacitorHttp\s*Unknown/);
    const rows = [
      ...host(fixture).querySelectorAll('section[aria-labelledby="cap-plugins-title"] tbody tr'),
    ].map((row) =>
      [...row.children]
        .map((cell) => cell.textContent?.trim())
        .join(' ')
        .trim(),
    );
    expect(rows[0]).toBe('WebView No Yes No');
    expect(rows[1]).toBe('Camera Yes Unknown Yes');
  });

  it('waits for a real server value before it shows the setup steps', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    const { client, report } = fakeClient(undefined);
    connection.resolve(client);
    await settle(fixture);
    expect(host(fixture).querySelector('#soon-title')).toBeNull();

    report({});
    await settle(fixture);
    expect(host(fixture).querySelector('#soon-title')?.textContent).toBe('Inspect Capacitor apps');
  });

  it('says how many older calls were dropped and which limit to raise', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    connection.resolve(fakeClient({ cap1: page({ dropped: 12 }) }).client);
    await settle(fixture);
    const note = host(fixture).querySelector('app-limit-note')?.textContent ?? '';
    expect(note).toContain('12 older entries were dropped');
    expect(note).toContain('limits.capacitorCalls');
  });

  it('shows no setup steps before it knows whether an app reports', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    expect(host(fixture).querySelector('#soon-title')).toBeNull();
  });
});

describe('Capacitor summary, details and plugin state', () => {
  beforeEach(() => history.replaceState(null, '', '/?view=capacitor'));
  afterEach(() => {
    delete (navigator as { clipboard?: unknown }).clipboard;
  });

  const clipboard = () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    return writeText;
  };
  const open = async (pages: Record<string, CapacitorPage>) => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    const fake = fakeClient(pages);
    connection.resolve(fake.client);
    await settle(fixture);
    return { fixture, el: host(fixture), report: fake.report };
  };
  const stat = (el: HTMLElement, filter: string) =>
    el.querySelector<HTMLButtonElement>(`.strip [data-filter="${filter}"]`)!;
  const status = (el: HTMLElement) =>
    el.querySelector('.strip[role="status"] .sr-only')?.textContent?.trim();
  const busy = () =>
    page({
      calls: [
        ...page().calls,
        call(4, { plugin: 'Filesystem', method: 'readFile', durationMs: 900 }),
        call(5, {
          plugin: 'Geolocation',
          method: 'getCurrentPosition',
          status: 'pending',
          result: undefined,
          durationMs: undefined,
          startedAt: Date.now(),
        }),
      ],
    });

  it('sums up the page in a status strip whose counts filter the calls', async () => {
    const { fixture, el } = await open({ cap1: busy() });
    const strip = el.querySelector('.strip')!;
    expect(strip.getAttribute('role')).toBe('status');
    const stats = [...strip.querySelectorAll('.stat')].map((s) =>
      s.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(stats).toEqual([
      'Platform android native',
      'Calls 5',
      'Failed 2',
      'Slow, 500 ms+ 1',
      'Pending 1',
      'CapacitorHttp On',
      'Plugin hints 2',
    ]);
    // The call list is not a live region.
    expect(el.querySelector('.calls')!.closest('[role="status"], [aria-live]')).toBeNull();
    expect(stat(el, 'all').getAttribute('aria-pressed')).toBe('true');

    stat(el, 'slow').click();
    await settle(fixture);
    expect(stat(el, 'slow').getAttribute('aria-pressed')).toBe('true');
    expect(stat(el, 'all').getAttribute('aria-pressed')).toBe('false');
    let rows = [...el.querySelectorAll('.calls .call')].map((b) => b.textContent);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('Filesystem.readFile()');
    expect(status(el)).toBe('1 of 5 calls shown');

    stat(el, 'pending').click();
    await settle(fixture);
    rows = [...el.querySelectorAll('.calls .call')].map((b) => b.textContent);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatch(/Pending\s+waiting \d+ ms/);

    // Pressing the filter that is on shows every call again.
    stat(el, 'pending').click();
    await settle(fixture);
    expect(el.querySelectorAll('.calls .call')).toHaveLength(5);
    expect(stat(el, 'all').getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps one tab stop in the call list and the selection on its call when calls arrive', async () => {
    const { fixture, el, report } = await open({ cap1: page() });
    const rows = () => [...el.querySelectorAll<HTMLButtonElement>('.calls .call')];
    expect(rows().filter((row) => row.tabIndex === 0)).toHaveLength(1);
    rows()[2].click();
    await settle(fixture);
    expect(rows()[2].tabIndex).toBe(0);
    const picked = rows()[2];
    expect(picked.textContent).toContain('Camera.getPhoto()');

    report({
      cap1: page({ calls: [...page().calls, call(4, { method: 'checkPermissions' }), call(5)] }),
    });
    await settle(fixture);
    expect(rows()).toHaveLength(5);
    const pressed = rows().filter((row) => row.getAttribute('aria-pressed') === 'true');
    expect(pressed).toEqual([picked]);
    expect(rows().filter((row) => row.tabIndex === 0)).toEqual([picked]);
    expect(el.querySelector('#cap-detail-title')?.textContent).toContain('Camera.getPhoto()');
  });

  it('shows a call in tabs that follow the tabs pattern', async () => {
    const { fixture, el } = await open({ cap1: page() });
    el.querySelector<HTMLButtonElement>('.calls .call')!.click();
    await settle(fixture);
    const tabs = () => [...el.querySelectorAll<HTMLButtonElement>('#cap-detail [role="tab"]')];
    expect(tabs().map((t) => t.textContent?.trim())).toEqual(['Arguments', 'Error', 'Timing']);
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(tabs().map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    const panel = () => el.querySelector('#cap-detail [role="tabpanel"]')!;
    expect(panel().getAttribute('aria-labelledby')).toBe('cap-tab-args');
    expect(panel().textContent).toContain('"quality": 90');

    tabs()[0].focus();
    tabs()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await settle(fixture);
    expect(document.activeElement).toBe(tabs()[1]);
    expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
    expect(panel().textContent).toContain('Disk full');

    tabs()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await settle(fixture);
    expect(document.activeElement).toBe(tabs()[2]);
    expect(panel().id).toBe('cap-panel-timing');
    expect(panel().textContent).toContain('Duration');
    expect(panel().textContent).toContain('120 ms');
    expect(panel().getAttribute('tabindex')).toBe('0');
  });

  it('copies a call as JSON and as code with the masked values it shows, and says so', async () => {
    const writeText = clipboard();
    const masked = call(1, {
      plugin: 'Preferences',
      method: 'set',
      args: { key: 'authToken', value: '[redacted]', 'x-mode': 1 },
      result: undefined,
    });
    const { fixture, el } = await open({ cap1: page({ calls: [masked] }) });
    el.querySelector<HTMLButtonElement>('.calls .call')!.click();
    await settle(fixture);
    const button = (name: string) =>
      [...el.querySelectorAll<HTMLButtonElement>('#cap-detail button')].find(
        (b) => b.textContent?.trim() === name,
      )!;

    button('Copy as code').click();
    await settle(fixture);
    expect(writeText).toHaveBeenLastCalledWith(
      'await Preferences.set({\n  key: "authToken",\n  value: "[redacted]",\n  "x-mode": 1,\n});',
    );
    expect(status(el)).toBe('Copied Preferences.set() as code.');

    button('Copy as JSON').click();
    await settle(fixture);
    const copied = JSON.parse((writeText.mock.calls.at(-1) as unknown as [string])[0]);
    expect(copied).toEqual(JSON.parse(JSON.stringify(masked)));
    expect(status(el)).toBe('Copied Preferences.set() as JSON.');
  });

  it("gives the sync command for the page's platform, with a copy button", async () => {
    const writeText = clipboard();
    const info = page().info;
    const { fixture, el } = await open({ cap1: page({ info: { ...info, platform: 'ios' } }) });
    const plugins = el.querySelector('section[aria-labelledby="cap-plugins-title"]')!;
    expect(plugins.textContent).toContain('Not available on ios. Run npx cap sync ios, then run');
    const copy = plugins.querySelector<HTMLButtonElement>('button.copy')!;
    expect(copy.getAttribute('aria-label')).toBe('Copy npx cap sync ios');
    copy.click();
    await settle(fixture);
    expect(writeText).toHaveBeenCalledWith('npx cap sync ios');
    expect(status(el)).toBe('Copied npx cap sync ios.');
    // Only the one plugin gets a command.
    expect(plugins.querySelectorAll('button.copy')).toHaveLength(1);
  });

  it('shows the last event of each listener and flags a possible leak', async () => {
    const now = Date.now();
    const { el } = await open({
      cap1: page({
        listeners: [
          {
            id: '1',
            plugin: 'Network',
            event: 'networkStatusChange',
            addedAt: 1,
            events: 2,
            lastEventAt: now - 1000,
            last: { connected: true, connectionType: 'wifi' },
          },
          { id: '2', plugin: 'Network', event: 'networkStatusChange', addedAt: 2, events: 0 },
          { id: '3', plugin: 'App', event: 'pause', addedAt: 2, events: 1, lastEventAt: now },
          { id: '4', plugin: 'App', event: 'pause', addedAt: 2, events: 0, removed: true },
        ],
      }),
    });
    const rows = [
      ...el.querySelectorAll('section[aria-labelledby="cap-listeners-title"] tbody tr'),
    ].map((row) => row.textContent?.replace(/\s+/g, ' ').trim());
    expect(rows[0]).toContain('{"connected":true,"connectionType":"wifi"}');
    expect(rows[0]).toContain('2 active listeners: possible leak');
    expect(rows[1]).toContain('None yet');
    expect(rows[1]).toContain('2 active listeners: possible leak');
    expect(rows[2]).toContain('No data');
    expect(rows[2]).not.toContain('possible leak');
    expect(rows[3]).toContain('Removed');
  });

  it('shows the Foldable state from call results and listener events, newest first', async () => {
    const now = Date.now();
    const foldable = {
      name: 'Foldable',
      available: true,
      registered: true,
      native: true,
      methods: [],
    };
    const info = page().info;
    const { el } = await open({
      cap1: page({
        info: { ...info, plugins: [...info.plugins, foldable] },
        calls: [
          call(1, {
            plugin: 'Foldable',
            method: 'getFoldState',
            args: undefined,
            startedAt: now - 10_000,
            durationMs: 5,
            result: {
              state: 'flat',
              isSeparating: false,
              posture: 'flat',
              hingeOrientation: 'vertical',
              activeDisplay: 'inner',
            },
          }),
          call(2, {
            plugin: 'Foldable',
            method: 'getHingeAngle',
            args: undefined,
            status: 'error',
            result: undefined,
            error: { message: 'No hinge sensor' },
          }),
        ],
        listeners: [
          {
            id: '9',
            plugin: 'Foldable',
            event: 'foldStateChange',
            addedAt: 1,
            events: 1,
            lastEventAt: now - 3000,
            last: { state: 'half-opened', isSeparating: true, posture: 'tabletop' },
          },
        ],
      }),
    });
    const card = el.querySelector('app-capacitor-state article')!;
    expect(card.querySelector('h3')?.textContent?.trim()).toBe('Foldable');
    const fields = Object.fromEntries(
      [...card.querySelectorAll('dl > div')].map((item) => [
        item.querySelector('dt')?.textContent?.trim(),
        item.querySelector('dd')?.textContent?.replace(/\s+/g, ' ').trim(),
      ]),
    );
    expect(fields).toEqual({
      'Fold state': 'half-opened from foldStateChange, 3 s ago',
      Posture: 'tabletop from foldStateChange, 3 s ago',
      'Hinge orientation': 'vertical from getFoldState(), 10 s ago',
      'Hinge angle': 'Not reported yet',
      'Active display': 'inner from getFoldState(), 10 s ago',
      'Size class': 'Not reported yet',
    });
  });

  it('shows no plugin state without a plugin that has a card', async () => {
    const { el } = await open({ cap1: page() });
    expect(el.querySelector('#cap-state-title')).toBeNull();
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
