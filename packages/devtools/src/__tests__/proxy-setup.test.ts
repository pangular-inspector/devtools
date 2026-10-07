// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const docs = readFileSync(
  join(import.meta.dirname, '../../../../apps/docs/src/content/getting-started/installation.md'),
  'utf8',
);

interface ProxyEntry {
  target: string;
  pathRewrite?: Record<string, string>;
  ws?: boolean;
}

function documentedProxy(): Record<string, ProxyEntry> {
  const block = /```json[^\n]*\n\/\/ proxy\.conf\.json\n([\s\S]*?)```/.exec(docs);
  if (!block) throw new Error('installation.md has no proxy.conf.json sample');
  return JSON.parse(block[1]!) as Record<string, ProxyEntry>;
}

/** Where `ng serve` sends a request under the documented config, or `null` when it serves it itself. */
function forwarded(url: string, upgrade = false): string | null {
  const { pathname, search } = new URL(url, location.href);
  for (const [prefix, entry] of Object.entries(documentedProxy())) {
    if (!pathname.startsWith(prefix)) continue;
    if (upgrade && !entry.ws) return null;
    let path = pathname;
    for (const [pattern, value] of Object.entries(entry.pathRewrite ?? {})) {
      path = path.replace(new RegExp(pattern), value);
    }
    return new URL(path + search, entry.target).href;
  }
  return null;
}

const DEV_SERVER = 'http://localhost:9999';

/** `pangular dev` serves the panel and its connection at its root. */
function reachesConnection(url: string): boolean {
  const target = forwarded(url);
  return target !== null && new URL(target).pathname === '/__connection.json';
}

function respond(url: string): Response {
  return reachesConnection(url)
    ? new Response('{}', { headers: { 'content-type': 'application/json' } })
    : new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } });
}

const connectionOf = (base: string) =>
  new URL('__connection.json', new URL(base, location.href)).href;

let tried: string[] = [];

vi.mock('devframe/client', () => ({
  connectDevframe: async ({ baseURL }: { baseURL: string | string[] }) => {
    tried = Array.isArray(baseURL) ? baseURL : [baseURL];
    const base = tried.find((b) => reachesConnection(connectionOf(b)));
    if (!base) throw new Error('no devtools server');
    return {
      connectionMeta: { backend: 'websocket', websocket: { path: '__ws' } },
      connection: { metaBaseUrl: connectionOf(base) },
      scope: () => ({ rpc: { call: async () => undefined, register: () => {} } }),
    };
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  sessionStorage.clear();
  localStorage.clear();
});

describe('client-only Angular CLI proxy setup in the docs', () => {
  it('forwards HTTP and WebSocket to the port the documented dev server listens on', () => {
    const proxy = documentedProxy();
    expect(Object.keys(proxy)).toEqual(['/__pangular']);
    const entry = proxy['/__pangular']!;
    expect(entry.target).toBe(DEV_SERVER);
    expect(entry.ws).toBe(true);
    expect(docs).toContain(`pangular dev --port ${new URL(DEV_SERVER).port}`);
  });

  it('lets the overlay find the dev server and open its WebSocket on the page origin', async () => {
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => respond(url)),
    );
    const { initOverlay } = await import('../overlay.ts');
    const stop = await initOverlay();
    const base = tried.find((b) => reachesConnection(connectionOf(b)));
    expect(base).toBe('/__pangular/');
    const ws = new URL('__ws', new URL(base!, location.href)).href;
    expect(forwarded(ws, true)).toBe(`${DEV_SERVER}/__ws`);
    stop();
  });

  it('opens the panel the dev server serves at its root from the popup', async () => {
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => respond(url)),
    );
    const popup = await import('../popup.ts');
    await popup.showDevtools();
    const shadow = document.getElementById('pangular-popup-root')!.shadowRoot!;
    (shadow.querySelector('.fab') as HTMLButtonElement).click();
    const frame = shadow.querySelector('iframe') as HTMLIFrameElement;
    await vi.waitFor(() => expect(frame.src).not.toBe(''));
    expect(frame.src.startsWith(`${location.origin}/__pangular/?baseURL=`)).toBe(true);
    expect(new URL(forwarded(frame.src)!).pathname).toBe('/');
    await popup.hideDevtools();
  });
});
