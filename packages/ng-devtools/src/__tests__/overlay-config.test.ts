// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NgDevtoolsConfig } from '../config.ts';
import { isSecretKey, setRedaction } from '../forms-privacy.ts';
import { RULES_STORAGE_KEY, clientRules, httpRegistry, storeRules } from '../http-rules.ts';
import { noteFailedCall, setNavigationLimit, type NavigationRecord } from '../router.ts';

const calls: string[] = [];
const sentArgs = new Map<string, unknown>();
let configs: Record<string, unknown> | undefined;

vi.mock('devframe/client', () => ({
  connectDevframe: async () => ({
    connectionMeta: { backend: 'websocket', configs },
    scope: () => ({
      rpc: {
        call: async (name: string, arg?: unknown) => {
          calls.push(name);
          sentArgs.set(name, arg);
          return undefined;
        },
        register: () => {},
      },
    }),
  }),
}));

const stops: (() => void)[] = [];

async function start(config?: NgDevtoolsConfig) {
  calls.length = 0;
  configs = config ? { 'ng-devtools': config } : undefined;
  const { initOverlay } = await import('../overlay.ts');
  stops.push(await initOverlay());
  await new Promise((resolve) => setTimeout(resolve, 100));
  return new Set(calls);
}

afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  sessionStorage.clear();
  setRedaction();
  setNavigationLimit(50);
  delete httpRegistry().maxCalls;
  delete httpRegistry().rules;
  vi.restoreAllMocks();
});

describe('overlay collectors', () => {
  it('ping instead of resending unchanged trees and HTTP calls', async () => {
    await start({ limits: { refreshMs: 500 } });
    expect(calls).toContain('push-component-tree');
    expect(calls).toContain('push-http');
    calls.length = 0;
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.now() + 9000);
      await new Promise((resolve) => setTimeout(resolve, 700));
    } finally {
      vi.useRealTimers();
    }
    expect(calls).not.toContain('push-component-tree');
    expect(calls).not.toContain('push-injector-tree');
    expect(calls).not.toContain('push-http');
    expect(calls).toContain('ping-component-tree');
    expect(calls).toContain('ping-injector-tree');
    expect(calls).toContain('ping-http');
  });

  it('run every collector when the server sends no config', async () => {
    const called = await start();
    expect(called).toContain('push-component-tree');
    expect(called).toContain('push-injector-tree');
    expect(called).toContain('push-router');
  });

  it('skip the collectors of disabled inspectors', async () => {
    const called = await start({ inspectors: { components: false, router: false } });
    expect(called).not.toContain('push-component-tree');
    expect(called).not.toContain('push-router');
    expect(called).toContain('push-injector-tree');
  });

  it('install the Elements-panel lookup only with the components inspector', async () => {
    await start();
    expect(window.__ngDevtoolsComponentOf).toBeTypeOf('function');
    stops.splice(0).forEach((stop) => stop());
    expect(window.__ngDevtoolsComponentOf).toBeUndefined();

    await start({ inspectors: { components: false } });
    expect(window.__ngDevtoolsComponentOf).toBeUndefined();
  });

  it('only tell the server to forget pages for enabled inspectors', async () => {
    await start({ inspectors: { forms: false } });
    calls.length = 0;
    dispatchEvent(new Event('pagehide'));
    expect(calls).not.toContain('forget-forms-page');
    expect(calls).toContain('forget-router-page');
  });

  it('forget the signal page on pagehide and push the graph again when the page comes back', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    vi.stubGlobal('ng', {
      ɵgetSignalGraph: () => ({ nodes: [], edges: [] }),
      getInjector: () => ({}),
      getComponent: (el: Element) => (el.tagName === 'APP-ROOT' ? {} : null),
    });
    try {
      await start({ limits: { refreshMs: 500 } });
      expect(calls).toContain('push-signal-graph');
      calls.length = 0;
      dispatchEvent(new Event('pagehide'));
      expect(calls).toContain('forget-signal-page');
      calls.length = 0;
      dispatchEvent(new Event('pageshow'));
      await new Promise((resolve) => setTimeout(resolve, 700));
      expect(calls).toContain('push-signal-graph');
      expect(calls).not.toContain('ping-signal-graph');
    } finally {
      vi.unstubAllGlobals();
      document.body.innerHTML = '';
    }
  });

  it('poll on the default fallback interval without a config', async () => {
    const interval = vi.spyOn(globalThis, 'setInterval');
    await start();
    expect(interval).toHaveBeenCalledWith(expect.any(Function), 3000);
    expect(httpRegistry().maxCalls).toBe(200);
  });

  it('use the configured limits, with refreshMs as the fallback poll interval', async () => {
    const interval = vi.spyOn(globalThis, 'setInterval');
    await start({ limits: { refreshMs: 1000, navigations: 10, httpCalls: 20 } });
    expect(interval).toHaveBeenCalledWith(expect.any(Function), 1000);
    expect(interval).not.toHaveBeenCalledWith(expect.any(Function), 3000);
    expect(httpRegistry().maxCalls).toBe(20);
    const list: NavigationRecord[] = [];
    for (let i = 0; i < 15; i++) noteFailedCall(list, `/x/${i}`, new Error('nope'), i);
    expect(list).toHaveLength(10);
  });

  it('drop stored fault rules when the http inspector is off', async () => {
    storeRules([{ id: 'r1', pattern: '/api', enabled: true, target: 'client', status: 500 }]);
    await start({ inspectors: { http: false } });
    expect(sessionStorage.getItem(RULES_STORAGE_KEY)).toBeNull();
    delete httpRegistry().rules;
    expect(clientRules()).toEqual([]);
  });

  it('apply the redaction config from the server before collecting', async () => {
    await start({ redaction: { secretNames: ['voucher'] } });
    expect(isSecretKey('voucherCode')).toBe(true);
  });

  it('redact the page URL and title in the component tree report', async () => {
    const before = location.href;
    const title = document.title;
    history.replaceState(null, '', '/reset?token=s3cr3tvalue123&x=1#access_token=abcdefabcdef');
    document.title = 'Reset Bearer abcdefghijklmnop';
    try {
      await start();
    } finally {
      history.replaceState(null, '', before);
      document.title = title;
    }
    const report = sentArgs.get('push-component-tree') as { url: string; title: string };
    expect(report.url).toContain('?token=[redacted]&x=1#access_token=[redacted]');
    expect(report.url).not.toContain('s3cr3tvalue123');
    expect(report.title).toBe('Reset Bearer [redacted]');
  });
});
