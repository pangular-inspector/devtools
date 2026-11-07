import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

const source = [
  readFileSync(new URL('../../../../extension/frames.js', import.meta.url), 'utf8'),
  readFileSync(new URL('../../../../extension/devtools.js', import.meta.url), 'utf8'),
].join('\n');

type Listener = (...args: unknown[]) => void;
type Callback = (result: unknown, error?: unknown) => void;

interface Options {
  /** Whether the top frame runs Angular; an expression it does not know gets `undefined`. */
  page: () => unknown;
  /** The page's frames and whether each runs Angular. */
  frames?: { url: string; angular: boolean }[];
  /** `false` leaves the Elements sidebar API out, as an older Chrome would. */
  sidebar?: boolean;
}

function open({ page, frames = [], sidebar = true }: Options) {
  const panels: string[] = [];
  const navigationListeners: Listener[] = [];
  const selectionListeners: Listener[] = [];
  const panes: { title: string; expressions: string[] }[] = [];
  const evals: { expression: string; frameURL: string | null }[] = [];
  const chrome = {
    devtools: {
      inspectedWindow: {
        tabId: 7,
        eval: (expression: string, ...rest: [unknown, Callback?]) => {
          const callback = (typeof rest[0] === 'function' ? rest[0] : rest[1]) as Callback;
          const frameURL = typeof rest[0] === 'object' ? (rest[0] as { frameURL: string }) : null;
          evals.push({ expression, frameURL: frameURL?.frameURL ?? null });
          if (frameURL) {
            callback(frames.find((f) => f.url === frameURL.frameURL)?.angular ?? false);
          } else if (expression === 'location.href') {
            callback('http://localhost:4200/');
          } else {
            callback(page());
          }
        },
        getResources: (callback: (resources: { url: string; type: string }[]) => void) =>
          callback([
            { url: 'http://localhost:4200/', type: 'document' },
            { url: 'http://localhost:4200/main.js', type: 'script' },
            ...frames.map(({ url }) => ({ url, type: 'document' })),
          ]),
      },
      network: { onNavigated: { addListener: (l: Listener) => navigationListeners.push(l) } },
      panels: {
        create: (title: string) => panels.push(title),
        elements: {
          onSelectionChanged: { addListener: (l: Listener) => selectionListeners.push(l) },
          ...(sidebar
            ? {
                createSidebarPane: (title: string, done: (pane: unknown) => void) => {
                  const pane = { title, expressions: [] as string[] };
                  panes.push(pane);
                  done({
                    setExpression: (expression: string) => pane.expressions.push(expression),
                  });
                },
              }
            : {}),
        },
      },
    },
  };
  runInNewContext(source, { chrome, setTimeout, clearTimeout });
  return {
    panels,
    panes,
    evals,
    select: () => selectionListeners.forEach((l) => l()),
    navigated: () => navigationListeners.forEach((l) => l('http://localhost/')),
  };
}

const angularChecks = (evals: { expression: string }[]) =>
  evals.filter((e) => e.expression.includes('ng-version')).length;

describe('extension devtools page', () => {
  afterEach(() => vi.useRealTimers());

  it('asks the inspected page directly and creates the panel on an Angular page', async () => {
    const page = vi.fn(() => true);
    const { panels } = open({ page });
    await vi.waitFor(() => expect(panels).toEqual(['Pangular Inspector']));
    expect(page).toHaveBeenCalledTimes(1);
  });

  it('does not rely on a background worker or content script', () => {
    expect(source).not.toMatch(/chrome\.runtime/);
  });

  it('treats an eval error as no Angular', async () => {
    vi.useFakeTimers();
    const panels: string[] = [];
    const chrome = {
      devtools: {
        inspectedWindow: {
          eval: (_e: string, callback: Callback) => callback(true, { isException: true }),
        },
        network: { onNavigated: { addListener: () => undefined } },
        panels: { create: (title: string) => panels.push(title) },
      },
    };
    runInNewContext(source, { chrome, setTimeout, clearTimeout });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(panels).toEqual([]);
  });

  it('keeps asking while a lazy app bootstraps, then stops', async () => {
    vi.useFakeTimers();
    let angular = false;
    const page = vi.fn(() => angular);
    const { panels, evals } = open({ page });
    await vi.advanceTimersByTimeAsync(1000);
    expect(panels).toEqual([]);
    angular = true;
    await vi.advanceTimersByTimeAsync(500);
    expect(panels).toEqual(['Pangular Inspector']);
    const checks = angularChecks(evals);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(angularChecks(evals)).toBe(checks);
  });

  it('gives up on a page without Angular', async () => {
    vi.useFakeTimers();
    const { panels, evals } = open({ page: () => false });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(panels).toEqual([]);
    expect(angularChecks(evals)).toBe(10);
  });

  it('checks again after a navigation and creates the panel once', async () => {
    vi.useFakeTimers();
    let angular = false;
    const { panels, navigated } = open({ page: () => angular });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(panels).toEqual([]);
    angular = true;
    navigated();
    navigated();
    await vi.advanceTimersByTimeAsync(0);
    expect(panels).toEqual(['Pangular Inspector']);
  });

  it('creates the panel when Angular runs only in a frame of the page', async () => {
    const { panels, evals } = open({
      page: () => false,
      frames: [
        { url: 'http://localhost:4200/ads.html', angular: false },
        { url: 'http://localhost:6006/iframe.html', angular: true },
      ],
    });
    await vi.waitFor(() => expect(panels).toEqual(['Pangular Inspector']));
    expect(evals.filter((e) => e.frameURL).map((e) => e.frameURL)).toEqual([
      'http://localhost:4200/ads.html',
      'http://localhost:6006/iframe.html',
    ]);
  });

  it('adds an Elements sidebar that shows the component of the selected element', async () => {
    const { panes, select } = open({ page: () => true });
    await vi.waitFor(() => expect(panes).toHaveLength(1));
    const [pane] = panes;
    expect(pane.title).toBe('Angular component');
    expect(pane.expressions).toHaveLength(1);
    // The overlay answers with a masked summary; without it the pane says how to get one.
    expect(pane.expressions[0]).toContain('window.__pangularComponentDetail');
    expect(pane.expressions[0]).toContain('read($0)');
    expect(pane.expressions[0]).toContain('not connected');
    select();
    expect(pane.expressions).toHaveLength(2);
  });

  it('adds no sidebar on a page without Angular, or where Chrome has no sidebar API', async () => {
    vi.useFakeTimers();
    const none = open({ page: () => false });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(none.panes).toEqual([]);
    vi.useRealTimers();
    const old = open({ page: () => true, sidebar: false });
    await vi.waitFor(() => expect(old.panels).toEqual(['Pangular Inspector']));
    expect(old.panes).toEqual([]);
  });
});
