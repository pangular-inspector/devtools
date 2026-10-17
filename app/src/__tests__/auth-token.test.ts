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

/** Two documents on one origin: a shared storage area and a shared broadcast bus. */
function sharedOrigin() {
  const data = new Map<string, string>();
  const bus = new Set<{ name: string; onmessage: ((event: { data: unknown }) => void) | null }>();
  const panel = () => {
    class PanelStorage {
      getItem(key: string) {
        return data.get(key) ?? null;
      }
      setItem(key: string, value: string) {
        data.set(key, value);
      }
      removeItem(key: string) {
        data.delete(key);
      }
    }
    class PanelChannel {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      constructor(readonly name: string) {
        bus.add(this);
      }
      postMessage(message: unknown) {
        for (const other of bus) {
          if (other !== this && other.name === this.name) other.onmessage?.({ data: message });
        }
      }
      close() {
        bus.delete(this);
      }
    }
    const scope = {
      Storage: PanelStorage as unknown as typeof Storage,
      BroadcastChannel: PanelChannel as unknown as typeof BroadcastChannel,
    };
    return { scope, storage: new PanelStorage() };
  };
  return { data, panel };
}

/** What devframe's client does with the one-time code token, as in devframe/client. */
function devframeClient(
  scope: { BroadcastChannel: typeof BroadcastChannel },
  storage: Pick<Storage, 'setItem'>,
  sentToServer: string[],
) {
  let channel: BroadcastChannel | undefined;
  try {
    channel = new scope.BroadcastChannel('devframe-auth');
  } catch {
    // devframe leaves the channel out when it cannot open one.
  }
  const store = (token: string) => {
    try {
      storage.setItem(DEVFRAME_KEY, token);
    } catch {
      // As devframe: storage may be blocked.
    }
  };
  if (channel) {
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; authToken?: string };
      if (data?.type === 'auth-update' && data.authToken) {
        store(data.authToken);
        sentToServer.push(data.authToken);
      }
    };
  }
  return {
    trustWithCode(token: string) {
      store(token);
      try {
        channel?.postMessage({ type: 'auth-update', authToken: token });
      } catch {
        // As devframe.
      }
    },
  };
}

describe('two extension panels on different servers', () => {
  it("never hand one server's token to the other", () => {
    const origin = sharedOrigin();
    const first = origin.panel();
    const second = origin.panel();
    const authA = panelAuth('http://localhost:4000/', extension, first.storage, first.scope);
    const authB = panelAuth('http://localhost:5173/', extension, second.storage, second.scope);
    const sentToA: string[] = [];
    const sentToB: string[] = [];
    const clientA = devframeClient(first.scope, first.storage, sentToA);
    devframeClient(second.scope, second.storage, sentToB);

    clientA.trustWithCode('token-of-a');
    authA.remember('token-of-a');

    expect(sentToB).toEqual([]);
    expect(origin.data.has(DEVFRAME_KEY)).toBe(false);
    expect(authB.token).toBeUndefined();
    expect(panelAuth('http://localhost:5173/', extension, second.storage, second.scope).token).toBe(
      undefined,
    );
    expect(panelAuth('http://localhost:4000/', extension, first.storage, first.scope).token).toBe(
      'token-of-a',
    );
  });

  it('leave the channel and the slot to devframe for panels next to their server', () => {
    const origin = sharedOrigin();
    const hub = {
      href: 'http://localhost:4000/__devframes/pangular/',
      origin: 'http://localhost:4000',
    };
    const first = origin.panel();
    const second = origin.panel();
    panelAuth('/__devframes/pangular/', hub, first.storage, first.scope);
    panelAuth('/__devframes/pangular/', hub, second.storage, second.scope);
    const sent: string[] = [];
    const client = devframeClient(first.scope, first.storage, []);
    devframeClient(second.scope, second.storage, sent);
    client.trustWithCode('hub-token');
    // Same server: devframe shares the token between its tabs, as it should.
    expect(sent).toEqual(['hub-token']);
    expect(origin.data.get(DEVFRAME_KEY)).toBe('hub-token');
  });

  it('keep other broadcast channels and storage keys working', () => {
    const origin = sharedOrigin();
    const panel = origin.panel();
    panelAuth('http://localhost:4000/', extension, panel.storage, panel.scope);
    expect(() => new panel.scope.BroadcastChannel('other')).not.toThrow();
    panel.storage.setItem('pangular-tab', 'routes');
    expect(panel.storage.getItem('pangular-tab')).toBe('routes');
  });
});
