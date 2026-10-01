import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../../../../extension/devtools.js', import.meta.url), 'utf8');

type Listener = (...args: unknown[]) => void;

async function open({ worker, page }: { worker: boolean | undefined; page: () => unknown }) {
  const panels: string[] = [];
  const messageListeners: Listener[] = [];
  const navigationListeners: Listener[] = [];
  const chrome = {
    runtime: {
      lastError: undefined as unknown,
      sendMessage: (_message: unknown, reply: (response: unknown) => void) =>
        queueMicrotask(() => {
          if (worker === undefined) {
            chrome.runtime.lastError = { message: 'Receiving end does not exist.' };
            reply(undefined);
            chrome.runtime.lastError = undefined;
          } else {
            reply({ isAngular: worker });
          }
        }),
      onMessage: { addListener: (listener: Listener) => messageListeners.push(listener) },
    },
    devtools: {
      inspectedWindow: {
        tabId: 7,
        eval: (_expression: string, callback: (result: unknown, error?: unknown) => void) =>
          callback(page()),
      },
      network: { onNavigated: { addListener: (l: Listener) => navigationListeners.push(l) } },
      panels: { create: (title: string) => panels.push(title) },
    },
  };
  runInNewContext(source, { chrome, setTimeout, clearTimeout });
  await Promise.resolve();
  return {
    panels,
    detected: (tabId: number) =>
      messageListeners.forEach((l) => l({ type: 'angular-detected', tabId })),
    navigated: () => navigationListeners.forEach((l) => l('http://localhost/')),
  };
}

describe('extension devtools page', () => {
  afterEach(() => vi.useRealTimers());

  it('creates the panel when the worker knows the tab', async () => {
    const page = vi.fn(() => false);
    const { panels } = await open({ worker: true, page });
    expect(panels).toEqual(['Angular DevTools']);
    expect(page).not.toHaveBeenCalled();
  });

  it('asks the page when the worker restarted and forgot the tab', async () => {
    const { panels } = await open({ worker: false, page: () => true });
    expect(panels).toEqual(['Angular DevTools']);
  });

  it('asks the page when no worker answers', async () => {
    const { panels } = await open({ worker: undefined, page: () => true });
    expect(panels).toEqual(['Angular DevTools']);
  });

  it('keeps asking while a lazy app bootstraps, then stops', async () => {
    vi.useFakeTimers();
    let angular = false;
    const page = vi.fn(() => angular);
    const { panels } = await open({ worker: false, page });
    vi.advanceTimersByTime(1000);
    expect(panels).toEqual([]);
    angular = true;
    vi.advanceTimersByTime(500);
    expect(panels).toEqual(['Angular DevTools']);
    const checks = page.mock.calls.length;
    vi.advanceTimersByTime(10_000);
    expect(page).toHaveBeenCalledTimes(checks);
  });

  it('gives up on a page without Angular', async () => {
    vi.useFakeTimers();
    const page = vi.fn(() => false);
    const { panels } = await open({ worker: false, page });
    vi.advanceTimersByTime(60_000);
    expect(panels).toEqual([]);
    expect(page).toHaveBeenCalledTimes(10);
  });

  it('checks again after a navigation and creates the panel once', async () => {
    let angular = false;
    const { panels, navigated, detected } = await open({ worker: false, page: () => angular });
    angular = true;
    navigated();
    detected(7);
    detected(8);
    expect(panels).toEqual(['Angular DevTools']);
  });
});
