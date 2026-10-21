// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls: { name: string; args: unknown[] }[] = [];

vi.mock('devframe/client', () => ({
  connectDevframe: vi.fn(async (options: { baseURL: string | string[] }) => {
    const base = [options.baseURL].flat()[0];
    return {
      close: vi.fn(),
      connection: { metaBaseUrl: new URL(`${base}__connection.json`, location.href).href },
      scope: () => ({
        rpc: {
          call: vi.fn(async (name: string, ...args: unknown[]) => {
            calls.push({ name, args });
            return undefined;
          }),
          register: vi.fn(),
        },
      }),
    };
  }),
}));

async function start() {
  vi.resetModules();
  const { initOverlay } = await import('../overlay.ts');
  const dispose = await initOverlay();
  await vi.advanceTimersByTimeAsync(0);
  return dispose;
}

const claims = () =>
  calls.filter((call) => call.name === 'claim-page').map((call) => call.args[0]) as {
    pageId: string;
    key: string;
  }[];

describe.sequential('overlay page key', () => {
  beforeEach(() => {
    calls.length = 0;
    sessionStorage.clear();
    document.body.innerHTML = '';
    delete window.__pangularPageId;
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows the page key before any report and keeps it for the tab', async () => {
    const dispose = await start();
    const [claim] = claims();
    expect(claim.pageId).toBe(window.__pangularPageId);
    expect(claim.key).toMatch(/^[0-9a-f]{32}$/);
    // Before any report. Only the redaction config, which the page needs to read anything, comes first.
    expect(calls.find((call) => call.name !== 'redaction-config')?.name).toBe('claim-page');
    expect(sessionStorage.getItem('pangular-page-key')).toBe(claim.key);
    dispose();

    // A reload in the same tab shows the same id and key again.
    calls.length = 0;
    const again = await start();
    expect(claims()).toEqual([claim]);
    again();
  });

  it('mints a new key with a new page id', async () => {
    sessionStorage.setItem('pangular-page-key', 'left-over');
    const dispose = await start();
    expect(claims()[0].key).not.toBe('left-over');
    dispose();
  });
});
