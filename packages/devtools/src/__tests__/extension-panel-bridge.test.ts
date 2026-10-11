// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const root = join(import.meta.dirname, '../../../../extension');
const source = [
  readFileSync(join(root, 'panel-actions.js'), 'utf8'),
  readFileSync(join(root, 'panel-bridge.js'), 'utf8'),
].join('\n');
const html = readFileSync(join(root, 'panel.html'), 'utf8');

type Listener = () => void;

interface Setup {
  origin?: string;
  pageId?: () => string | null;
  storedPageId?: string | null;
  extensionId?: string;
  granted?: boolean;
  grant?: boolean;
  fetch?: (url: string) => Promise<Response>;
  inspect?: (expression: string) => unknown;
}

const offline = () => Promise.reject(new TypeError('Failed to fetch'));

function open(setup: Setup = {}) {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  body.querySelectorAll('script').forEach((script) => script.remove());
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
    runtime: {
      getURL: (path: string) => `chrome-extension://${setup.extensionId ?? 'ext-id'}/${path}`,
    },
    permissions: { contains: vi.fn(async () => granted), request },
    devtools: {
      inspectedWindow: {
        eval: (expression: string, callback: (result: unknown, error?: unknown) => void) =>
          queueMicrotask(() =>
            callback(
              expression === 'location.origin'
                ? origin
                : expression.includes('__pangularPageId')
                  ? (setup.pageId?.() ?? null)
                  : expression.includes('pangular-page-id')
                    ? (setup.storedPageId ?? null)
                    : (setup.inspect?.(expression) ?? null),
            ),
          ),
        getResources: (callback: (resources: { url: string }[]) => void) => callback([]),
      },
      network: { onNavigated: { addListener: (l: Listener) => navigated.push(l) } },
      panels: {
        elements: { onSelectionChanged: { addListener: () => {} } },
        openResource: vi.fn(),
      },
    },
  };
  runInNewContext(source, {
    chrome,
    window,
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
    retry: $<HTMLButtonElement>('status-retry'),
    docs: $<HTMLAnchorElement>('status-docs'),
    frame: $<HTMLIFrameElement>('devtools-frame'),
  };
}

function fromFrame(frame: HTMLIFrameElement, data: unknown, origin = location.origin) {
  window.dispatchEvent(new MessageEvent('message', { data, origin, source: frame.contentWindow }));
}

const found = (path: string) => (url: string) =>
  url.endsWith(path)
    ? Promise.resolve(new Response('{}', { status: 200 }))
    : Promise.resolve(new Response('', { status: 404 }));

const urlOf = (line: string | null) => line?.replace(/ \(.*\)$/, '');

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
      fetch: found('/__pangular/__devframe/__connection.json'),
      pageId: () => 'page-1',
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(panel.message()).toBe(
      'Allow Pangular Inspector to reach the devtools server on app.example.com.',
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
    expect(panel.message()).toMatch(/^Allow Pangular Inspector/);
    expect(panel.fetch).not.toHaveBeenCalled();
  });

  it('lists every URL it tried once when no server answers', async () => {
    const panel = open();
    await vi.advanceTimersByTimeAsync(500);
    expect(panel.message()).toBe('No devtools server answered on http://localhost:4200. Tried:');
    const tried = panel.tried().map(urlOf);
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
      pageId: () => 'page-1',
      fetch: found('/__devframes/pangular/__connection.json'),
    });
    await vi.advanceTimersByTimeAsync(500);
    const src = new URL(panel.frame.src);
    expect(`${src.protocol}//${src.host}${src.pathname}`).toBe(
      'chrome-extension://ext-id/ui/index.html',
    );
    expect(src.searchParams.get('baseURL')).toBe('http://localhost:4200/__devframes/pangular/');
    expect(src.searchParams.get('pageId')).toBe('page-1');
    expect(panel.frame.style.display).toBe('block');
    expect(panel.status.classList.contains('hidden')).toBe(true);
  });

  it('leaves the page id out when the page has none after five seconds', async () => {
    const panel = open({ fetch: found('/__pangular/__devframe/__connection.json') });
    await vi.advanceTimersByTimeAsync(500);
    expect(panel.frame.style.display).toBe('none');
    expect(panel.message()).toBe('Detecting Angular app…');
    await vi.advanceTimersByTimeAsync(5000);
    expect(panel.frame.style.display).toBe('block');
    expect(new URL(panel.frame.src).searchParams.has('pageId')).toBe(false);
  });

  it('waits for a page id the overlay claims after the server answers', async () => {
    let pageId: string | null = null;
    const panel = open({
      pageId: () => pageId,
      storedPageId: 'other-tab',
      fetch: found('/__pangular/__devframe/__connection.json'),
    });
    await vi.advanceTimersByTimeAsync(2000);
    expect(panel.frame.style.display).toBe('none');
    pageId = 'late-page';
    await vi.advanceTimersByTimeAsync(250);
    expect(panel.frame.style.display).toBe('block');
    expect(new URL(panel.frame.src).searchParams.get('pageId')).toBe('late-page');
  });

  it('stops waiting for a page id when the page navigates', async () => {
    let pageId: string | null = null;
    const panel = open({
      pageId: () => pageId,
      fetch: found('/__pangular/__devframe/__connection.json'),
    });
    await vi.advanceTimersByTimeAsync(1000);
    panel.navigate();
    pageId = 'next-page';
    await vi.advanceTimersByTimeAsync(1000);
    expect(new URL(panel.frame.src).searchParams.get('pageId')).toBe('next-page');
    await vi.advanceTimersByTimeAsync(5000);
    expect(panel.fetch).toHaveBeenCalledTimes(2);
  });

  it('falls back to the stored page id of an overlay that sets no global', async () => {
    const panel = open({
      storedPageId: 'stored-page',
      fetch: found('/__pangular/__devframe/__connection.json'),
    });
    await vi.advanceTimersByTimeAsync(5500);
    expect(new URL(panel.frame.src).searchParams.get('pageId')).toBe('stored-page');
  });

  it('shows the status of each probe and tries again on request', async () => {
    let up = false;
    const panel = open({
      fetch: (url) =>
        up
          ? found('/__pangular/__devframe/__connection.json')(url)
          : url.endsWith('/__pangular/__devframe/__connection.json')
            ? Promise.resolve(new Response('', { status: 404 }))
            : offline(),
      pageId: () => 'page-1',
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(panel.tried()[0]).toBe(
      'http://localhost:4200/__pangular/__devframe/__connection.json (404)',
    );
    expect(panel.tried()[1]).toBe('http://localhost:4200/__pangular/__connection.json (no answer)');
    expect(panel.retry.hidden).toBe(false);
    expect(panel.retry.textContent).toBe('Try again');

    up = true;
    panel.retry.click();
    expect(panel.message()).toBe('Detecting Angular app…');
    expect(panel.retry.hidden).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(panel.frame.style.display).toBe('block');
    expect(new URL(panel.frame.src).searchParams.get('pageId')).toBe('page-1');
  });

  it('says the server refused the request when a probe gets a 403', async () => {
    const panel = open({
      origin: 'http://192.168.1.20:5173',
      fetch: (url) =>
        url.endsWith('/__devframes/pangular/__connection.json')
          ? Promise.resolve(
              new Response('Pangular Inspector only answers requests from this machine.', {
                status: 403,
              }),
            )
          : Promise.resolve(new Response('', { status: 404 })),
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(panel.message()).toBe(
      'The devtools server on http://192.168.1.20:5173 refused the request (403). It said: "Pangular Inspector only answers requests from this machine." If the page runs on this machine, add chrome-extension://ext-id to allowedOrigins to trust this extension. That does not change the rule that the server only answers this machine. Tried:',
    );
    expect(panel.tried()).toContain(
      'http://192.168.1.20:5173/__devframes/pangular/__connection.json (403)',
    );
    expect(panel.retry.hidden).toBe(false);
    expect(panel.docs.hidden).toBe(false);
    expect(panel.docs.textContent).toBe('Why the devtools server refuses requests');
    expect(panel.docs.href).toMatch(/getting-started\/vite\.md#answers-only-your-machine$/);
  });

  it('leaves out the allowedOrigins hint for the extension with the pinned ID', async () => {
    const panel = open({
      origin: 'http://192.168.1.20:5173',
      extensionId: 'dcogniffeelebaolkkfbopmjcblhblfk',
      fetch: (url) =>
        url.endsWith('/__devframes/pangular/__connection.json')
          ? Promise.resolve(new Response('', { status: 403 }))
          : Promise.resolve(new Response('', { status: 404 })),
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(panel.message()).toBe(
      'The devtools server on http://192.168.1.20:5173 refused the request (403). Tried:',
    );
  });

  it('restores the setup link after a refusal turns into no answer', async () => {
    let refuse = true;
    const panel = open({
      fetch: () => (refuse ? Promise.resolve(new Response('', { status: 401 })) : offline()),
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(panel.message()).toMatch(/refused the request \(401\)\. Tried:$/);
    refuse = false;
    panel.retry.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(panel.message()).toBe('No devtools server answered on http://localhost:4200. Tried:');
    expect(panel.docs.textContent).toBe('Set up the devtools server');
    expect(panel.docs.href).toBe('https://github.com/pangular-inspector/devtools#get-started');
  });

  it('drops a detection that finishes after a navigation and detects again', async () => {
    let answer: (response: Response) => void = () => {};
    let slow = true;
    const panel = open({
      pageId: () => 'page-1',
      fetch: (url) =>
        slow
          ? new Promise((resolve) => (answer = resolve))
          : found('/__pangular/__devframe/__connection.json')(url),
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
      'http://localhost:4200/__pangular/',
    );
  });
  it('reveals a component the UI frame asks for and answers with the request id', async () => {
    const inspect = vi.fn((expression: string) =>
      expression.includes('__pangularHostOf') ? true : null,
    );
    const panel = open({ inspect });
    const replies: unknown[] = [];
    vi.spyOn(panel.frame.contentWindow!, 'postMessage').mockImplementation((data) =>
      replies.push(data),
    );
    fromFrame(panel.frame, {
      type: 'pangular:reveal-element',
      requestId: 'r1',
      pageId: 'page-1',
      id: 'cab12-3',
    });
    await vi.advanceTimersByTimeAsync(0);
    const [expression] = inspect.mock.calls.at(-1)!;
    expect(expression).toContain('window.__pangularHostOf?.("page-1", "cab12-3")');
    expect(expression).toContain('inspect(target)');
    expect(replies).toEqual([{ type: 'pangular:panel-action-result', requestId: 'r1', ok: true }]);
  });

  it('ignores panel actions from other windows or origins', async () => {
    const inspect = vi.fn(() => true);
    const panel = open({ inspect });
    const post = vi.spyOn(panel.frame.contentWindow!, 'postMessage');
    const request = { type: 'pangular:reveal-element', requestId: 'r1', pageId: 'p', id: 'c' };
    fromFrame(panel.frame, request, 'https://evil.example');
    window.dispatchEvent(new MessageEvent('message', { data: request, origin: location.origin }));
    await vi.advanceTimersByTimeAsync(0);
    expect(inspect).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
});
