import { describe, expect, it } from 'vitest';
import { crossServerOrigin, panelAuth } from '../auth-token';

const DEVFRAME_KEY = '__DEVFRAME_CONNECTION_AUTH_TOKEN__';
const extension = {
  href: 'chrome-extension://dcogniffeelebaolkkfbopmjcblhblfk/ui/index.html?baseURL=x',
  origin: 'chrome-extension://dcogniffeelebaolkkfbopmjcblhblfk',
};

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe('panel auth tokens', () => {
  it('treats a server on the panel origin as its own', () => {
    const hub = {
      href: 'http://localhost:4000/__devframes/pangular/',
      origin: 'http://localhost:4000',
    };
    expect(crossServerOrigin('/__devframes/pangular/', hub)).toBeNull();
    expect(crossServerOrigin(['/__pangular/', './'], hub)).toBeNull();
    expect(crossServerOrigin(undefined, hub)).toBeNull();
    const storage = memoryStorage({ [DEVFRAME_KEY]: 'own' });
    expect(panelAuth('/__devframes/pangular/', hub, storage).token).toBeUndefined();
    // devframe keeps managing the token of its own origin.
    expect(storage.data.get(DEVFRAME_KEY)).toBe('own');
  });

  it('keeps one token per server origin in the extension', () => {
    const storage = memoryStorage();
    const vite = 'http://localhost:5173/__devframes/pangular/';
    const hub = 'http://localhost:4000/__devframes/pangular/';
    expect(crossServerOrigin(vite, extension)).toBe('http://localhost:5173');

    const first = panelAuth(vite, extension, storage);
    expect(first.token).toBeUndefined();
    first.remember('vite-token');
    panelAuth(hub, extension, storage).remember('hub-token');

    expect(panelAuth(vite, extension, storage).token).toBe('vite-token');
    expect(panelAuth(hub, extension, storage).token).toBe('hub-token');
  });

  it("never leaves devframe's shared slot for the next server to send", () => {
    const storage = memoryStorage({ [DEVFRAME_KEY]: 'token-of-another-server' });
    const auth = panelAuth('http://localhost:5173/', extension, storage);
    expect(storage.data.has(DEVFRAME_KEY)).toBe(false);
    storage.data.set(DEVFRAME_KEY, 'copied-by-devframe');
    auth.remember('new-token');
    expect(storage.data.has(DEVFRAME_KEY)).toBe(false);
    expect(auth.token).toBe('new-token');
  });

  it('ignores an empty token', () => {
    const storage = memoryStorage();
    panelAuth('http://localhost:5173/', extension, storage).remember(undefined);
    expect(storage.data.size).toBe(0);
  });
});
