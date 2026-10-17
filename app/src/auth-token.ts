type PanelLocation = Pick<Location, 'href' | 'origin'>;

/** Where devframe keeps the token it got for the code, one per panel origin. */
const DEVFRAME_TOKEN_KEY = '__DEVFRAME_CONNECTION_AUTH_TOKEN__';
const KEY_PREFIX = 'pangular-auth-token:';

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
 * not issue it.
 */
export function panelAuth(
  baseURL: string | string[] | undefined,
  loc: PanelLocation = location,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = safeLocalStorage(),
): PanelAuth {
  const origin = crossServerOrigin(baseURL, loc);
  if (!origin || !storage) return NO_STORE;
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

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
