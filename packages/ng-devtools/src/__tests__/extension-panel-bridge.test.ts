// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const root = join(import.meta.dirname, '../../../../extension');
const source = readFileSync(join(root, 'panel-bridge.js'), 'utf8');
const html = readFileSync(join(root, 'panel.html'), 'utf8');

type Listener = () => void;

interface Setup {
  origin?: string;
  pageId?: string | null;
  granted?: boolean;
  grant?: boolean;
  fetch?: (url: string) => Promise<Response>;
}

const offline = () => Promise.reject(new TypeError('Failed to fetch'));

function open(setup: Setup = {}) {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  body.querySelector('script')?.remove();
  document.body.innerHTML = body.innerHTML;

  const origin = setup.origin ?? 'http://localhost:4200';
  let granted = setup.granted ?? true;
  const navigated: Listener[] = [];
  const fetch = vi.fn((url: string) => (setup.fetch ?? offline)(url));
  const request = vi.fn(async () => {
    granted = setup.grant ?? false;
    return granted;
  });
  const chrome = {
    runtime: { getURL: (path: string) => `chrome-extension://ext-id/${path}` },
    permissions: { contains: vi.fn(async () => granted), request },
    devtools: {
      inspectedWindow: {
        eval: (expression: string, callback: (result: unknown, error?: unknown) => void) =>
          queueMicrotask(() =>
            callback(
              expression === 'location.origin'
                ? origin
                : expression.includes('ng-devtools-page-id')
                  ? (setup.pageId ?? null)
                  : null,
            ),
          ),
      },
      network: { onNavigated: { addListener: (l: Listener) => navigated.push(l) } },
      panels: { elements: { onSelectionChanged: { addListener: () => {} } } },
    },
  };
  runInNewContext(source, {
    chrome,
    document,
    location,
    fetch,
    AbortSignal,
    URL,
    setTimeout,
  });

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  return {
    fetch,
    request,
    navigate: () => navigated.forEach((l) => l()),
    status: $('status'),
    message: () => $('status-message').textContent,
    tried: () => [...$('status-tried').querySelectorAll('li')].map((li) => li.textContent),
    triedList: $('status-tried'),
    allow: $<HTMLButtonElement>('status-allow'),
    docs: $<HTMLAnchorElement>('status-docs'),
    frame: $<HTMLIFrameElement>('devtools-frame'),
  };
}

const found = (path: string) => (url: string) =>
  url.endsWith(path)
    ? Promise.resolve(new Response('{}', { status: 200 }))
    : Promise.resolve(new Response('', { status: 404 }));

describe('extension panel bridge', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('announces detection in a status region without the setup link', () => {
    const panel = open();
    expect(panel.status.getAttribute('role')).toBe('status');
    expect(panel.message()).toBe('Detecting Angular app…');
    expect(panel.frame.style.display).toBe('none');
  });

  it('explains that only http and https pages can connect', async () => {
    const panel = open({ origin: 'chrome://newtab' });
    await vi.advanceTimersByTimeAsync(500);
    expect(panel.message()).toMatch(/pages served over http or https/);
    expect(panel.docs.hidden).toBe(false);
    expect(panel.allow.hidden).toBe(true);
    expect(panel.fetch).not.toHaveBeenCalled();
  });

  it('asks for access to a non-loopback host, then detects once granted', async () => {
    const panel = open({
      origin: 'https://app.example.com',
      granted: false,
      grant: true,
      fetch: found('/__ng-devtools/__devframe/__connection.json'),
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(panel.message()).toBe(
      'Allow Angular DevTools to reach the devtools server on app.example.com.',
    );
    expect(panel.allow.hidden).toBe(false);
    expect(panel.fetch).not.toHaveBeenCalled();

    panel.allow.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(panel.request).toHaveBeenCalledWith({ origins: ['https://app.example.com/*'] });
    expect(panel.frame.style.display).toBe('block');
    expect(panel.status.classList.contains('hidden')).toBe(true);
  });

  it('stays on the prompt when access is declined', async () => {
    const panel = open({ origin: 'https://app.example.com', granted: false, grant: false });
    await vi.advanceTimersByTimeAsync(500);
    panel.allow.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(panel.message()).toMatch(/^Allow Angular DevTools/);
    expect(panel.fetch).not.toHaveBeenCalled();
  });

  it('lists every URL it tried once when no server answers', async () => {
    const panel = open();
    await vi.advanceTimersByTimeAsync(500);
    expect(panel.message()).toBe('No devtools server answered on http://localhost:4200. Tried:');
    const tried = panel.tried();
    expect(tried.length).toBeGreaterThan(1);
    expect(new Set(tried).size).toBe(tried.length);
    expect(tried).toContain('http://localhost:4200/__devframe/__connection.json');
    expect(panel.fetch.mock.calls.map(([url]) => url)).toEqual(tried);
    expect(panel.triedList.hidden).toBe(false);
    expect(panel.triedList.getAttribute('aria-label')).toBe('URLs tried');
    expect(panel.docs.hidden).toBe(false);
  });

  it('loads the panel with the base URL and page id of the server it found', async () => {
    const panel = open({
      pageId: 'page-1',
      fetch: found('/__devframes/ng-devtools/__connection.json'),
    });
    await vi.advanceTimersByTimeAsync(500);
    const src = new URL(panel.frame.src);
    expect(`${src.protocol}//${src.host}${src.pathname}`).toBe(
      'chrome-extension://ext-id/ui/index.html',
    );
    expect(src.searchParams.get('baseURL')).toBe('http://localhost:4200/__devframes/ng-devtools/');
    expect(src.searchParams.get('pageId')).toBe('page-1');
    expect(panel.frame.style.display).toBe('block');
    expect(panel.status.classList.contains('hidden')).toBe(true);
  });

  it('leaves the page id out when the page has none', async () => {
    const panel = open({ fetch: found('/__ng-devtools/__devframe/__connection.json') });
    await vi.advanceTimersByTimeAsync(500);
    expect(new URL(panel.frame.src).searchParams.has('pageId')).toBe(false);
  });

  it('drops a detection that finishes after a navigation and detects again', async () => {
    let answer: (response: Response) => void = () => {};
    let slow = true;
    const panel = open({
      fetch: (url) =>
        slow
          ? new Promise((resolve) => (answer = resolve))
          : found('/__ng-devtools/__devframe/__connection.json')(url),
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(panel.fetch).toHaveBeenCalledTimes(1);

    panel.navigate();
    expect(panel.message()).toBe('Detecting Angular app…');
    slow = false;
    answer(new Response('{}', { status: 200 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(panel.frame.style.display).toBe('none');
    expect(panel.message()).toBe('Detecting Angular app…');

    await vi.advanceTimersByTimeAsync(1000);
    expect(panel.frame.style.display).toBe('block');
    expect(new URL(panel.frame.src).searchParams.get('baseURL')).toBe(
      'http://localhost:4200/__ng-devtools/',
    );
  });
});
