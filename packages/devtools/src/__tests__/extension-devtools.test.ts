import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../../../../extension/devtools.js', import.meta.url), 'utf8');

type Listener = (...args: unknown[]) => void;

function open({ page }: { page: () => unknown }) {
  const panels: string[] = [];
  const navigationListeners: Listener[] = [];
  const chrome = {
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
  return {
    panels,
    navigated: () => navigationListeners.forEach((l) => l('http://localhost/')),
  };
}

describe('extension devtools page', () => {
  afterEach(() => vi.useRealTimers());

  it('asks the inspected page directly and creates the panel on an Angular page', () => {
    const page = vi.fn(() => true);
    const { panels } = open({ page });
    expect(panels).toEqual(['Pangular Inspector']);
    expect(page).toHaveBeenCalledTimes(1);
  });

  it('does not rely on a background worker or content script', () => {
    expect(source).not.toMatch(/chrome\.runtime/);
  });

  it('treats an eval error as no Angular', () => {
    vi.useFakeTimers();
    const panels: string[] = [];
    const chrome = {
      devtools: {
        inspectedWindow: {
          eval: (_e: string, callback: (result: unknown, error?: unknown) => void) =>
            callback(true, { isException: true }),
        },
        network: { onNavigated: { addListener: () => undefined } },
        panels: { create: (title: string) => panels.push(title) },
      },
    };
    runInNewContext(source, { chrome, setTimeout, clearTimeout });
    vi.advanceTimersByTime(10_000);
    expect(panels).toEqual([]);
  });

  it('keeps asking while a lazy app bootstraps, then stops', () => {
    vi.useFakeTimers();
    let angular = false;
    const page = vi.fn(() => angular);
    const { panels } = open({ page });
    vi.advanceTimersByTime(1000);
    expect(panels).toEqual([]);
    angular = true;
    vi.advanceTimersByTime(500);
    expect(panels).toEqual(['Pangular Inspector']);
    const checks = page.mock.calls.length;
    vi.advanceTimersByTime(10_000);
    expect(page).toHaveBeenCalledTimes(checks);
  });

  it('gives up on a page without Angular', () => {
    vi.useFakeTimers();
    const page = vi.fn(() => false);
    const { panels } = open({ page });
    vi.advanceTimersByTime(60_000);
    expect(panels).toEqual([]);
    expect(page).toHaveBeenCalledTimes(10);
  });

  it('checks again after a navigation and creates the panel once', () => {
    vi.useFakeTimers();
    let angular = false;
    const { panels, navigated } = open({ page: () => angular });
    vi.advanceTimersByTime(60_000);
    expect(panels).toEqual([]);
    angular = true;
    navigated();
    navigated();
    expect(panels).toEqual(['Pangular Inspector']);
  });
});
