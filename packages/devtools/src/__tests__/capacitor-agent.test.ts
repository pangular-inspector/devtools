import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPangular } from '../devframe.ts';
import {
  capacitorState,
  expireCapacitorPages,
  mergeCapacitorReport,
  patchCapacitorState,
  toCapacitorReport,
  type CapacitorCall,
  type CapacitorInfo,
  type CapacitorPage,
  type CapacitorReport,
} from '../rpc/capacitor-tools.ts';
import { answerText } from './tool-answer.ts';
import { PAGE_TTL_MS } from '../rpc/page-ttl.ts';

// The demo project does not depend on @capacitor/core, so the tools are turned on here.
async function boot(definition = createPangular({ inspectors: { capacitor: true } })) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await definition.setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const invoke = async (id: string, args: Record<string, unknown> = {}) =>
    await answerText(ctx.agent.invoke(`pangular:${id}`, args));
  const tool = (args: Record<string, unknown> = {}) => invoke('capacitor-list-calls', args);
  const plugins = (args: Record<string, unknown> = {}) => invoke('capacitor-list-plugins', args);
  const state = async () =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: {
            get: (key: string) => Promise<{ value: () => { pages: Record<string, unknown> } }>;
          };
        }
      ).sharedState.get('pangular:capacitor')
    ).value();
  return { ctx, push, tool, plugins, state };
}

const info: CapacitorInfo = {
  platform: 'android',
  native: true,
  bridge: true,
  webCalls: false,
  env: {
    serverUrl: 'https://localhost',
    debug: false,
    logging: true,
    capacitorHttp: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 15)',
  },
  plugins: [
    { name: 'Camera', available: true, registered: true, native: true, methods: ['getPhoto'] },
    { name: 'Barcode', available: false, registered: true, native: false, methods: [] },
    { name: 'Haptics', available: true, registered: false, native: true, methods: ['vibrate'] },
    {
      name: 'WebView',
      available: true,
      registered: false,
      native: true,
      methods: ['setServerBasePath'],
    },
  ],
};

const call = (id: number, extra: Partial<CapacitorCall> = {}): CapacitorCall => ({
  id,
  plugin: 'Camera',
  method: 'getPhoto',
  kind: 'promise',
  via: 'native',
  args: { quality: 90 },
  status: 'ok',
  result: { format: 'jpeg' },
  startedAt: Date.now() - 5_000,
  durationMs: 120,
  ...extra,
});

const report = (extra: Partial<CapacitorReport> = {}): CapacitorReport => ({
  pageId: 'cap1',
  url: '/trips',
  title: 'Trips',
  full: true,
  info,
  calls: [],
  listeners: [],
  dropped: 0,
  ...extra,
});

describe('capacitor-list-calls', () => {
  it('says how to connect an app when none reports', async () => {
    const { tool } = await boot();
    expect(await tool()).toMatch(/No Capacitor app reports to this server/);
  });

  it('lists the calls newest first, with failures and unimplemented methods marked', async () => {
    const { push, tool } = await boot();
    await push(
      'push-capacitor',
      report({
        calls: [
          call(1),
          call(2, {
            method: 'pickLimitedLibraryPhotos',
            status: 'error',
            result: undefined,
            error: { message: 'Not implemented on Android', code: 'UNIMPLEMENTED' },
            startedAt: Date.now() - 2_000,
          }),
          call(3, {
            plugin: 'Preferences',
            method: 'set',
            status: 'error',
            error: { message: 'Disk full' },
            startedAt: Date.now() - 1_000,
          }),
        ],
        listeners: [
          { id: '7', plugin: 'Network', event: 'networkStatusChange', addedAt: 1, events: 3 },
        ],
      }),
    );

    const all = await tool();
    expect(all).toContain('platform `android`, native');
    expect(all).toContain('Calls recorded: 3, 2 failed.');
    expect(all).toContain('Only native calls are logged');
    const rows = all
      .split('\n')
      .filter(
        (line) => line.startsWith('| ') && !line.startsWith('| When') && !line.startsWith('| ---'),
      );
    expect(rows[0]).toContain('`Preferences.set()`');
    expect(rows[1]).toContain('**not implemented** `UNIMPLEMENTED`');
    expect(rows[2]).toContain('ok: `{"format":"jpeg"}`');
    expect(rows[2]).toContain('| native |');
    expect(all).toContain('`Network networkStatusChange` (3 events)');

    const failed = await tool({ failed: true });
    expect(failed).not.toContain('`Camera.getPhoto()`');
    expect(failed).toContain('`Preferences.set()`');
    expect(await tool({ plugin: 'camera', limit: 1 })).toContain('1 more not shown.');
    const slow = await tool({ slowMs: 100 });
    expect(slow).toContain('`Camera.getPhoto()`');
    expect(await tool({ slowMs: 500 })).toContain('No call matches at least 500 ms.');
  });

  it('shows web calls and streams when the app logs them', async () => {
    const { push, tool } = await boot();
    await push(
      'push-capacitor',
      report({
        info: { ...info, webCalls: true },
        calls: [
          call(1, { plugin: 'Preferences', method: 'get', via: 'web' }),
          call(2, {
            plugin: 'Geolocation',
            method: 'watchPosition',
            kind: 'callback',
            callbacks: 4,
          }),
        ],
      }),
    );
    const all = await tool();
    expect(all).not.toContain('Only native calls are logged');
    expect(all).toContain('`Geolocation.watchPosition()` (stream)');
    expect(all).toContain('(4 callbacks)');
    expect(all).toMatch(/`Preferences.get\(\)` \| web \|/);
  });

  it("masks a value stored under a key the server's secretNames name, in arguments and result", async () => {
    const { push, tool } = await boot(
      createPangular({ inspectors: { capacitor: true }, redaction: { secretNames: ['voucher'] } }),
    );
    await push(
      'push-capacitor',
      report({
        calls: [
          call(1, {
            plugin: 'Preferences',
            method: 'set',
            args: { key: 'voucherCode', value: 'SAVE-50' },
            result: undefined,
          }),
          call(2, {
            plugin: 'Preferences',
            method: 'get',
            args: { key: 'voucherCode' },
            result: { value: 'SAVE-60' },
          }),
        ],
      }),
    );
    const all = await tool();
    expect(all).not.toContain('SAVE-50');
    expect(all).not.toContain('SAVE-60');
    expect(all).toContain('voucherCode');
  });

  it('masks string bodies the page sent unmasked, and the page URL and title', async () => {
    const { push, state } = await boot();
    await push(
      'push-capacitor',
      report({
        url: '/reset?token=opaque-reset-token-123',
        title: 'Bearer abc.def.ghi',
        calls: [
          call(1, {
            plugin: 'CapacitorHttp',
            method: 'request',
            args: { data: '{"password":"hunter2"}', url: 'https://x.example/?api_key=k-1' },
            result: { data: 'refresh_token=r-2&ok=1' },
          }),
        ],
      }),
    );
    const text = JSON.stringify((await state()).pages);
    for (const secret of ['hunter2', 'k-1', 'r-2', 'opaque-reset-token-123', 'abc.def.ghi']) {
      expect(text).not.toContain(secret);
    }
  });

  it("masks secrets with the server's own redaction, even when the page did not", async () => {
    const { push, tool } = await boot(
      createPangular({ inspectors: { capacitor: true }, redaction: { secretNames: ['voucher'] } }),
    );
    await push(
      'push-capacitor',
      report({ calls: [call(1, { args: { voucher: 'SAVE-50', quality: 90 } })] }),
    );
    const all = await tool();
    expect(all).not.toContain('SAVE-50');
    expect(all).toContain('"quality":90');
  });

  it("keeps each listener's last event, masked again with the server's redaction", async () => {
    const { push, tool, state } = await boot(
      createPangular({ inspectors: { capacitor: true }, redaction: { secretNames: ['voucher'] } }),
    );
    await push(
      'push-capacitor',
      report({
        calls: [call(1)],
        listeners: [
          {
            id: '7',
            plugin: 'Network',
            event: 'networkStatusChange',
            addedAt: 1,
            events: 2,
            lastEventAt: 2,
            last: { connected: true, voucher: 'SAVE-50', note: 'x'.repeat(500) },
          },
          { id: '8', plugin: 'App', event: 'pause', addedAt: 1, events: 1, lastEventAt: 2 },
        ],
      }),
    );
    const all = await tool();
    expect(all).toContain('`Network networkStatusChange` (2 events, last `{"connected":true,');
    expect(all).toContain('`App pause` (1 events)');
    expect(all).not.toContain('SAVE-50');
    const shown = (await state()).pages['cap1'] as {
      listeners: { last?: Record<string, unknown> }[];
    };
    expect(shown.listeners[0].last?.['connected']).toBe(true);
    expect(shown.listeners[0].last?.['voucher']).not.toBe('SAVE-50');
    expect(String(shown.listeners[0].last?.['note']).length).toBeLessThanOrEqual(201);
    expect(shown.listeners[1]).not.toHaveProperty('last');
  });

  it('answers a page argument that names no Capacitor page with the ones that report', async () => {
    const { push, tool } = await boot();
    await push('push-capacitor', report());
    expect(await tool({ page: 'nope' })).toContain(
      'No page `nope` is reporting Capacitor plugin calls',
    );
    expect(await tool({ page: 'cap1' })).toContain('No plugin calls yet.');
  });

  it('explains that a web page logs no calls', async () => {
    const { push, tool } = await boot();
    await push(
      'push-capacitor',
      report({ info: { ...info, platform: 'web', native: false, bridge: false } }),
    );
    expect(await tool()).toContain('No plugin calls are logged on this page');
  });

  it('merges partial pushes, asks for a full one when it lost the page, and forgets a page', async () => {
    const { push, state } = await boot();
    expect(
      await push('push-capacitor', report({ full: false, info: undefined, calls: [call(9)] })),
    ).toEqual({
      known: false,
    });
    expect(
      await push('push-capacitor', report({ calls: [call(1, { status: 'pending' })] })),
    ).toEqual({
      known: true,
    });
    await push(
      'push-capacitor',
      report({ full: false, info: undefined, calls: [call(1), call(2)] }),
    );

    const page = (await state()).pages['cap1'] as {
      calls: Record<string, CapacitorCall>;
      info: unknown;
    };
    expect(Object.values(page.calls).map((c) => [c.id, c.status])).toEqual([
      [1, 'ok'],
      [2, 'ok'],
    ]);
    expect(page.info).toEqual(info);

    await push('forget-capacitor-page', 'cap1');
    expect((await state()).pages).toEqual({});
  });

  it('is gone with the inspector turned off', async () => {
    const { ctx } = await boot(createPangular({ inspectors: { capacitor: false } }));
    const tools = ctx.agent.list().tools.map((entry: { id: string }) => entry.id);
    expect(tools).not.toContain('pangular:capacitor-list-calls');
    await expect(
      ctx.rpc.invokeLocal('pangular:push-capacitor' as never, ...([report()] as never)),
    ).rejects.toThrow();
  });
});

describe('capacitor-list-plugins', () => {
  it('lists the environment and each plugin with hints', async () => {
    const { push, plugins } = await boot();
    await push('push-capacitor', report());
    const text = await plugins();
    expect(text).toContain('Server URL `https://localhost`, CapacitorHttp on, native logging on.');
    expect(text).toContain('User agent: `Mozilla/5.0 (Linux; Android 15)`.');
    expect(text).toMatch(/`Barcode` \| no \| yes \| no \|.*Run `npx cap sync`/);
    expect(text).toMatch(
      /`Haptics` \| yes \| no \| yes \| `vibrate` \| Installed in the native project/,
    );
    expect(text).toMatch(/`Camera` \| yes \| yes \| yes \| `getPhoto` \|  \|/);
    expect(text).toMatch(/`WebView` \| yes \| no \| yes \| `setServerBasePath` \|  \|/);
  });

  it('says how to connect an app when none reports', async () => {
    const { plugins } = await boot();
    expect(await plugins()).toMatch(/No Capacitor app reports to this server/);
  });

  it('answers a page argument that names no Capacitor page with the ones that report', async () => {
    const { push, plugins } = await boot();
    await push('push-capacitor', report());
    const text = await plugins({ page: 'nope' });
    expect(text).toContain('No page `nope` is reporting Capacitor plugins');
    expect(text).toContain('`cap1`');
  });

  it('says so when the app has no plugins', async () => {
    const { push, plugins } = await boot();
    await push('push-capacitor', report({ info: { ...info, plugins: [] } }));
    expect(await plugins()).toContain('No plugins are registered or installed.');
  });

  it('shows an unknown CapacitorHttp state and imported state as unknown', async () => {
    const { push, plugins } = await boot();
    await push(
      'push-capacitor',
      report({
        info: {
          ...info,
          env: { ...info.env, capacitorHttp: null },
          plugins: [
            { name: 'Camera', available: true, registered: null, native: true, methods: [] },
          ],
        },
      }),
    );
    const text = await plugins();
    expect(text).toContain('CapacitorHttp unknown');
    expect(text).toMatch(/`Camera` \| yes \| unknown \| yes \|/);
  });

  it('is gone with the inspector turned off', async () => {
    const { ctx } = await boot(createPangular({ inspectors: { capacitor: false } }));
    const tools = ctx.agent.list().tools.map((entry: { id: string }) => entry.id);
    expect(tools).not.toContain('pangular:capacitor-list-plugins');
  });
});

describe('capacitor tools across pages and long answers', () => {
  const webInfo: CapacitorInfo = { ...info, platform: 'web', native: false, bridge: false };

  it('answers for the device, not a newer desktop tab, and names the other pages', async () => {
    const { push, tool, plugins } = await boot();
    await push('push-capacitor', report({ calls: [call(1)] }));
    await push('push-capacitor', report({ pageId: 'desk', url: '/home', info: webInfo }));
    const calls = await tool();
    expect(calls).toContain('Page `cap1` (`/trips`): platform `android`, native.');
    expect(calls).toContain('Other pages report too: `desk` (web, `/home`).');
    expect(await plugins()).toContain('Other pages report too: `desk` (web, `/home`).');
    const asked = await tool({ page: 'desk' });
    expect(asked).toContain('Page `desk`');
    expect(asked).not.toContain('Other pages report too');
  });

  it('labels a native Capacitor page in list-pages', async () => {
    const { ctx, push } = await boot();
    await push('push-capacitor', report());
    await push('push-capacitor', report({ pageId: 'desk', info: webInfo }));
    const text = await answerText(ctx.agent.invoke('pangular:list-pages', {}));
    expect(text).toMatch(/\| `cap1` \|.*\| Capacitor \(android\) \|/);
    expect(text).toMatch(/\| `desk` \|.*\| browser \|/);
  });

  it('counts the time a pending call has waited for slowMs', async () => {
    const { push, tool } = await boot();
    await push(
      'push-capacitor',
      report({
        calls: [
          call(1, { status: 'pending', durationMs: undefined, startedAt: Date.now() - 9_000 }),
          call(2, { method: 'checkPermissions', durationMs: 5 }),
        ],
      }),
    );
    const text = await tool({ slowMs: 5_000 });
    expect(text).toContain('`Camera.getPhoto()`');
    expect(text).not.toContain('checkPermissions');
  });

  it('cuts a long answer and lists at most 20 methods a plugin', async () => {
    const { push, tool, plugins } = await boot();
    const big = 'x'.repeat(390);
    await push(
      'push-capacitor',
      report({
        info: {
          ...info,
          plugins: Array.from({ length: 150 }, (_, at) => ({
            name: `Plugin${at}`,
            available: true,
            registered: true,
            native: true,
            methods: Array.from({ length: 30 }, (_, m) => `method${m}WithALongName`),
          })),
        },
        calls: Array.from({ length: 200 }, (_, at) =>
          call(at + 1, { args: { a: big, b: big }, result: { c: big } }),
        ),
      }),
    );
    const calls = await tool({ limit: 200 });
    expect(calls.length).toBeLessThanOrEqual(20_000);
    expect(calls).toMatch(
      /\(truncated; pass `page`, `plugin`, `failed`, `slowMs` or a smaller `limit`\)$/,
    );
    const list = await plugins();
    expect(list.length).toBeLessThanOrEqual(20_000);
    expect(list).toContain('`method19WithALongName` +10 more');
    expect(list).not.toContain('method20WithALongName');
  });

  it('puts the web-calls notice in its own paragraph', async () => {
    const { push, tool } = await boot();
    await push('push-capacitor', report());
    expect(await tool()).toContain('platform `android`, native.\n\nOnly native calls are logged');
  });

  it('says how many calls the page and the server dropped', async () => {
    const { push, tool } = await boot();
    await push('push-capacitor', report({ calls: [call(1)], dropped: 7 }));
    expect(await tool()).toContain('7 older calls were dropped (`limits.capacitorCalls`).');
  });

  it('names both entry points when no app reports', async () => {
    const { tool } = await boot();
    const text = await tool();
    expect(text).toContain('`@pangular-inspector/devtools/overlay`');
    expect(text).toContain('`@pangular-inspector/devtools/overlay-manual`');
  });
});

describe('capacitor page store', () => {
  it('keeps at most maxCalls per page and counts the ones it dropped', () => {
    const pages = new Map<string, CapacitorPage>();
    mergeCapacitorReport(pages, report({ calls: [call(1), call(2), call(3)], dropped: 4 }), 2);
    const page = pages.get('cap1')!;
    expect([...page.calls.keys()]).toEqual([2, 3]);
    expect(page.dropped + page.serverDropped).toBe(5);
  });

  it('drops pages that stopped reporting', () => {
    const pages = new Map<string, CapacitorPage>();
    mergeCapacitorReport(pages, report(), 50, 1_000);
    expect(expireCapacitorPages(pages, 10_000, () => 15_000)).toBe(false);
    expect(expireCapacitorPages(pages, 20_000, () => 15_000)).toBe(true);
    expect(pages.size).toBe(0);
  });

  it('rejects malformed reports and keeps only well-formed calls', () => {
    expect(toCapacitorReport(null)).toBeNull();
    expect(toCapacitorReport({ pageId: 'x'.repeat(60), calls: [] })).toBeNull();
    expect(toCapacitorReport({ pageId: 'p', calls: [], info: 'nope' })).toBeNull();
    const parsed = toCapacitorReport({
      ...report(),
      calls: [call(1), { id: 'two' }, { ...call(3), status: 'weird' }],
    });
    expect(parsed?.calls.map((c) => c.id)).toEqual([1]);
  });
});

describe('capacitor pages over time', () => {
  afterEach(() => vi.useRealTimers());

  it('drops a page that stopped reporting', async () => {
    vi.useFakeTimers();
    const { push, state } = await boot();
    await push('push-capacitor', report());
    expect(Object.keys((await state()).pages)).toEqual(['cap1']);

    await vi.advanceTimersByTimeAsync(PAGE_TTL_MS + 6000);
    expect((await state()).pages).toEqual({});
  });

  it('drops a page the moment its connection closes', async () => {
    const { ctx, push, state } = await boot();
    const host = ctx.rpc as unknown as {
      getCurrentRpcSession: () => unknown;
      _emitSessionDisconnected: (meta: { id: number }) => void;
    };
    host.getCurrentRpcSession = () => ({ meta: { id: 1 } });
    await push('push-capacitor', report());
    host.getCurrentRpcSession = () => ({ meta: { id: 2 } });
    await push('push-capacitor', report({ pageId: 'cap2' }));

    host._emitSessionDisconnected({ id: 1 });
    expect(Object.keys((await state()).pages)).toEqual(['cap2']);
  });
});

describe('patchCapacitorState', () => {
  it('changes only the calls a push carries, and keeps the rest as they were', () => {
    const pages = new Map<string, CapacitorPage>();
    mergeCapacitorReport(pages, report({ calls: [call(1), call(2, { status: 'pending' })] }), 50);
    const draft = capacitorState(pages);
    const shown = draft.pages['cap1'];
    const first = shown.calls['1'];
    const info = shown.info;

    const partial = report({
      full: false,
      info: undefined,
      listeners: undefined,
      calls: [call(2)],
    });
    mergeCapacitorReport(pages, partial, 50);
    patchCapacitorState(draft, pages, partial);

    expect(draft.pages['cap1']).toBe(shown);
    expect(shown.calls['1']).toBe(first);
    expect(shown.info).toBe(info);
    expect(Object.values(shown.calls).map((c) => [c.id, c.status])).toEqual([
      [1, 'ok'],
      [2, 'ok'],
    ]);
  });

  it('removes the calls the server dropped to stay under the limit', () => {
    const pages = new Map<string, CapacitorPage>();
    mergeCapacitorReport(pages, report({ calls: [call(1), call(2)] }), 2);
    const draft = capacitorState(pages);
    const partial = report({ full: false, info: undefined, calls: [call(3)] });
    mergeCapacitorReport(pages, partial, 2);
    patchCapacitorState(draft, pages, partial);

    expect(Object.keys(draft.pages['cap1'].calls)).toEqual(['2', '3']);
    expect(draft.pages['cap1'].dropped).toBe(1);
  });
});
