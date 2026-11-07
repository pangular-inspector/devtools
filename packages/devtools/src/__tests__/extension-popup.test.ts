// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

const root = join(import.meta.dirname, '../../../../extension');
const source = [
  readFileSync(join(root, 'connection-probe.js'), 'utf8'),
  readFileSync(join(root, 'popup.js'), 'utf8'),
].join('\n');
const html = readFileSync(join(root, 'popup.html'), 'utf8');

interface Page {
  origin: string;
  version: string | null;
  angular: boolean;
  devMode: boolean;
  overlay: boolean;
}

interface Setup {
  url?: string;
  page?: Page | null;
  fetch?: (url: string) => Promise<Response>;
}

const APP: Page = {
  origin: 'http://localhost:4200',
  version: '21.0.3',
  angular: true,
  devMode: true,
  overlay: true,
};

const found = (path: string) => (url: string) =>
  Promise.resolve(
    new Response(url.endsWith(path) ? '{}' : '', { status: url.endsWith(path) ? 200 : 404 }),
  );

function open(setup: Setup = {}) {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  body.querySelectorAll('script').forEach((script) => script.remove());
  document.body.innerHTML = body.innerHTML;
  const executeScript = vi.fn(async (_options: { func: () => unknown; world: string }) => {
    if (setup.page === null) throw new Error('Cannot access contents of the page');
    return [{ frameId: 0, result: setup.page ?? APP }];
  });
  const openOptionsPage = vi.fn();
  const chrome = {
    tabs: {
      query: async () => [{ id: 3, url: setup.url ?? 'http://localhost:4200/hotels' }],
    },
    scripting: { executeScript },
    runtime: { openOptionsPage },
  };
  const fetch = vi.fn((url: string) =>
    (setup.fetch ?? (() => Promise.reject(new TypeError('Failed to fetch'))))(url),
  );
  runInNewContext(source, {
    chrome,
    document,
    window,
    location,
    fetch,
    AbortController,
    AbortSignal,
    URL,
    setTimeout,
    clearTimeout,
  });
  const text = (id: string) => document.getElementById(id)?.textContent?.trim();
  return { executeScript, openOptionsPage, fetch, text };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('extension toolbar popup', () => {
  it('shows the Angular version, the build, the overlay and the server it found', async () => {
    const popup = open({ fetch: found('/__devframes/pangular/__connection.json') });
    await vi.waitFor(() => expect(popup.text('fact-server')).toMatch(/^Answers/));
    expect(popup.text('summary')).toBe('Angular found on this tab.');
    expect(popup.text('fact-angular')).toBe('21.0.3');
    expect(popup.text('fact-build')).toBe('Development');
    expect(popup.text('fact-overlay')).toBe('Connected');
    expect(popup.text('fact-server')).toBe(
      'Answers at http://localhost:4200/__devframes/pangular/',
    );
    expect(popup.text('next')).toBe('Open Chrome DevTools and pick the Pangular Inspector tab.');
    // It reads the page in the app's own world, where window.ng lives.
    expect(popup.executeScript.mock.calls[0]![0].world).toBe('MAIN');
  });

  it('reads the page with a function that needs nothing from the popup', async () => {
    const popup = open();
    await vi.waitFor(() => expect(popup.text('fact-server')).toBe('No answer'));
    const read = popup.executeScript.mock.calls[0]![0].func;
    document.body.innerHTML = '<app-root ng-version="21.0.3"></app-root>';
    (window as unknown as { __pangularPageId?: string }).__pangularPageId = 'p1';
    try {
      expect(read()).toEqual({
        origin: location.origin,
        version: '21.0.3',
        angular: true,
        devMode: false,
        overlay: true,
      });
    } finally {
      delete (window as unknown as { __pangularPageId?: string }).__pangularPageId;
    }
  });

  it('points at a development build on a production one', async () => {
    const popup = open({ page: { ...APP, devMode: false, overlay: false } });
    await vi.waitFor(() => expect(popup.text('fact-server')).toBe('No answer'));
    expect(popup.text('fact-build')).toBe('Production');
    expect(popup.text('fact-overlay')).toBe('Not loaded');
    expect(popup.text('next')).toMatch(/production build/);
  });

  it('says how to set up the server when none answers, and names a refusal', async () => {
    const missing = open();
    await vi.waitFor(() => expect(missing.text('fact-server')).toBe('No answer'));
    expect(missing.text('next')).toMatch(/^Mount the devtools/);

    const refused = open({
      fetch: () => Promise.resolve(new Response('Host not allowed', { status: 403 })),
    });
    await vi.waitFor(() => expect(refused.text('fact-server')).toBe('Refused the request (403)'));
  });

  it('says when the tab has no Angular, and that the panel searches frames', async () => {
    const popup = open({ page: { ...APP, angular: false, version: null, devMode: false } });
    await vi.waitFor(() => expect(popup.text('next')).not.toBe(''));
    expect(popup.text('summary')).toBe('No Angular app found on this tab.');
    expect(popup.text('fact-angular')).toBe('Not found');
    expect(popup.text('next')).toMatch(/frame/);
  });

  it('asks for an http page, and says when the tab cannot be read', async () => {
    const internal = open({ url: 'chrome://extensions/' });
    await vi.waitFor(() => expect(internal.text('summary')).toMatch(/http or https/));
    expect(internal.executeScript).not.toHaveBeenCalled();
    expect(document.getElementById('facts')!.hidden).toBe(true);

    const blocked = open({ page: null });
    await vi.waitFor(() => expect(blocked.text('summary')).toMatch(/^Couldn't read this tab/));
  });

  it('opens the site access page', async () => {
    const popup = open();
    document.getElementById('site-access')!.click();
    expect(popup.openOptionsPage).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(popup.text('fact-server')).toBe('No answer'));
  });
});
