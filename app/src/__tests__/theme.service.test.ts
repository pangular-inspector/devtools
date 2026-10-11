// @vitest-environment jsdom
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeService, themeTargets } from '../theme.service';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // already initialized
}

afterEach(() => {
  delete document.documentElement.dataset['theme'];
  TestBed.resetTestingModule();
  vi.unstubAllGlobals();
});

function stubColorScheme(light: boolean) {
  let listener: ((e: { matches: boolean }) => void) | undefined;
  const query = {
    matches: light,
    addEventListener: (_: string, fn: typeof listener) => (listener = fn),
    removeEventListener: () => (listener = undefined),
  };
  vi.stubGlobal('matchMedia', () => query);
  return (next: boolean) => listener?.({ matches: next });
}

describe('ThemeService', () => {
  it('defaults to dark when no data-theme attribute is present', () => {
    const svc = TestBed.inject(ThemeService);
    expect(svc.current()).toBe('dark');
  });

  it('reads dark from the data-theme attribute on bootstrap', () => {
    document.documentElement.dataset['theme'] = 'dark';
    const svc = TestBed.inject(ThemeService);
    expect(svc.current()).toBe('dark');
  });

  it('reads light from the data-theme attribute on bootstrap', () => {
    document.documentElement.dataset['theme'] = 'light';
    const svc = TestBed.inject(ThemeService);
    expect(svc.current()).toBe('light');
  });

  it('updates to light on a pangular:theme-change postMessage', () => {
    const svc = TestBed.inject(ThemeService);
    expect(svc.current()).toBe('dark');

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'pangular:theme-change', theme: 'default' },
        source: window.parent,
      }),
    );

    expect(svc.current()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('updates to dark on a pangular:theme-change postMessage', () => {
    document.documentElement.dataset['theme'] = 'light';
    const svc = TestBed.inject(ThemeService);
    expect(svc.current()).toBe('light');

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'pangular:theme-change', theme: 'dark' },
        source: window.parent,
      }),
    );

    expect(svc.current()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('ignores postMessages not from the parent frame', () => {
    const svc = TestBed.inject(ThemeService);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'pangular:theme-change', theme: 'default' },
        source: null,
      }),
    );

    expect(svc.current()).toBe('dark');
  });

  it('ignores postMessages with unknown types', () => {
    const svc = TestBed.inject(ThemeService);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'some-other-type', theme: 'default' },
        source: window.parent,
      }),
    );

    expect(svc.current()).toBe('dark');
  });

  it('follows the system color scheme when nothing pins a theme', () => {
    const flip = stubColorScheme(true);
    const svc = TestBed.inject(ThemeService);
    expect(svc.current()).toBe('light');

    flip(false);
    expect(svc.current()).toBe('dark');
  });

  it('stops following the system once DevTools sends a theme', () => {
    const flip = stubColorScheme(false);
    const svc = TestBed.inject(ThemeService);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'pangular:theme-change', theme: 'dark' },
        source: window.parent,
      }),
    );
    flip(true);

    expect(svc.current()).toBe('dark');
  });

  it('ignores the system color scheme when the URL pinned a theme', () => {
    document.documentElement.dataset['theme'] = 'dark';
    const flip = stubColorScheme(true);
    const svc = TestBed.inject(ThemeService);

    flip(true);
    expect(svc.current()).toBe('dark');
  });
});

describe('themeTargets', () => {
  /** A window stand-in: `origin` readable as on a same origin page, or throwing. */
  function fakeWindow(origin: string | null, parent?: Window, referrer = '') {
    const win = {
      document: { referrer },
      location: {
        get origin(): string {
          if (origin === null) throw new DOMException('Blocked', 'SecurityError');
          return origin;
        },
      },
    } as unknown as Window & { parent: Window };
    win.parent = parent ?? win;
    return win;
  }

  it('names each ancestor by the origins the browser lists, never "*"', () => {
    const top = fakeWindow(null);
    const parent = fakeWindow(null, top);
    const panel = fakeWindow('http://localhost:4000', parent);
    const origins = ['http://localhost:4000', 'https://host.test'];
    Object.assign(panel.location, {
      ancestorOrigins: { item: (i: number) => origins[i] ?? null, length: 2 },
    });

    expect(themeTargets(panel)).toEqual([
      { win: parent, origin: 'http://localhost:4000' },
      { win: top, origin: 'https://host.test' },
    ]);
  });

  it('falls back to a same origin read, then the referrer for the parent', () => {
    const top = fakeWindow(null);
    const parent = fakeWindow(null, top);
    const panel = fakeWindow('http://localhost:4000', parent, 'https://embedder.test/page');

    expect(themeTargets(panel)).toEqual([{ win: parent, origin: 'https://embedder.test' }]);

    const sameOrigin = fakeWindow('http://localhost:4000', top);
    const inner = fakeWindow('http://localhost:4000', sameOrigin);
    expect(themeTargets(inner)).toEqual([{ win: sameOrigin, origin: 'http://localhost:4000' }]);
  });

  it('sends nothing from a top level page', () => {
    expect(themeTargets(fakeWindow('http://localhost:4000'))).toEqual([]);
  });
});
