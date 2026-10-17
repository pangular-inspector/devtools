type PanelLocation = Pick<Location, 'href' | 'origin'>;

/** Where devframe keeps the token it got for the code, one per panel origin. */
const DEVFRAME_TOKEN_KEY = '__DEVFRAME_CONNECTION_AUTH_TOKEN__';
const KEY_PREFIX = 'pangular-auth-token:';
/** The channel devframe tells its other clients on the origin about a new token on. */
const DEVFRAME_AUTH_CHANNEL = 'devframe-auth';

/** The globals devframe's client reaches for the token: storage and broadcast channels. */
export interface AuthScope {
  Storage?: typeof Storage;
  BroadcastChannel?: typeof BroadcastChannel;
}

export interface PanelAuth {
  /** The token this panel got for the server before, if any. */
  readonly token: string | undefined;
  /** Keeps the token the server gave for the one-time code. */
  remember(token: string | undefined): void;
}

const NO_STORE: PanelAuth = { token: undefined, remember: () => {} };

/** The origin of a server the panel reaches from another origin, such as the Chrome extension. */
export function crossServerOrigin(
  baseURL: string | string[] | undefined,
  loc: PanelLocation = location,
): string | null {
  if (typeof baseURL !== 'string') return null;
  try {
    const origin = new URL(baseURL, loc.href).origin;
    return origin === loc.origin || origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

/**
 * The token a panel on another origin than its server sends, kept per server
 * origin. A panel next to its server needs none of this: its storage belongs
 * to that origin already. The Chrome extension shares one origin across every
 * server it opens, so devframe's single slot would hand one server's token to
 * the next. That slot is cleared, so a token never goes to a server that did
 * not issue it, and devframe is kept from sharing tokens across the origin
 * (see {@link isolateDevframeAuth}).
 */
export function panelAuth(
  baseURL: string | string[] | undefined,
  loc: PanelLocation = location,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = safeLocalStorage(),
  scope: AuthScope = globalThis,
): PanelAuth {
  const origin = crossServerOrigin(baseURL, loc);
  if (!origin) return NO_STORE;
  isolateDevframeAuth(scope);
  if (!storage) return NO_STORE;
  const key = KEY_PREFIX + origin;
  try {
    storage.removeItem(DEVFRAME_TOKEN_KEY);
  } catch {
    // Storage is blocked; the code form still works for this session.
  }
  delete (globalThis as Record<string, unknown>)[DEVFRAME_TOKEN_KEY];
  let token: string | undefined;
  try {
    token = storage.getItem(key) || undefined;
  } catch {
    token = undefined;
  }
  return {
    get token() {
      return token;
    },
    remember(next) {
      try {
        // devframe copies the token it used into its shared slot on every connect.
        storage.removeItem(DEVFRAME_TOKEN_KEY);
        if (!next || next === token) return;
        token = next;
        storage.setItem(key, next);
      } catch {
        // Not kept: the panel asks for a code again next time.
      }
    },
  };
}

const isolated = new WeakSet<object>();

/**
 * Keeps devframe's client in this document from sharing a token with the other
 * documents on its origin. devframe posts the token it gets for a one-time
 * code on a `devframe-auth` broadcast channel, and every client on the origin
 * sends it to its own server; it also keeps the token in one `localStorage`
 * slot that it reads on the next connect. Next to its server that shares a
 * login between tabs. In the Chrome extension every panel shares one origin
 * but talks to its own server, so a code typed in one panel would send that
 * server's token to every other server and log them out.
 *
 * Here devframe cannot open that channel (it skips it when the constructor
 * throws), and its shared slot reads as empty and ignores writes. Other
 * channels and keys work as before. {@link panelAuth} keeps the token per
 * server instead. The guard stays for the life of the document, since the
 * panel's server origin does not change.
 */
export function isolateDevframeAuth(scope: AuthScope = globalThis): void {
  const Channel = scope.BroadcastChannel;
  if (typeof Channel === 'function' && !isolated.has(Channel)) {
    const Isolated = class extends Channel {
      constructor(name: string) {
        if (String(name) === DEVFRAME_AUTH_CHANNEL) {
          throw new Error('The devframe-auth channel is off in a panel on another origin.');
        }
        super(name);
      }
    };
    isolated.add(Isolated);
    scope.BroadcastChannel = Isolated;
  }
  const proto = scope.Storage?.prototype;
  if (proto && !isolated.has(proto)) {
    isolated.add(proto);
    const { getItem, setItem } = proto;
    proto.getItem = function (this: Storage, key: string) {
      return String(key) === DEVFRAME_TOKEN_KEY ? null : getItem.call(this, key);
    };
    proto.setItem = function (this: Storage, key: string, value: string) {
      if (String(key) !== DEVFRAME_TOKEN_KEY) setItem.call(this, key, value);
    };
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
