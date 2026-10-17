import type { connectDevframe } from 'devframe/client';
import { PANGULAR_CONFIG_KEY } from './config.ts';

type ConnectOptions = NonNullable<Parameters<typeof connectDevframe>[0]>;
type ConnectionMeta = NonNullable<ConnectOptions['connectionMeta']>;

export interface OverlayConnectionInput {
  baseURL?: string | string[];
  connectionMeta?: { configs?: Record<string, unknown> };
  authToken?: string;
}

let warnedNoConfig = false;

/**
 * The options the overlay passes to `connectDevframe()`.
 *
 * - With `connectionMeta`, devframe resolves the server's paths against the
 *   first base URL only, so a list (or none) is refused instead of being cut
 *   down quietly.
 * - With Capacitor's CapacitorHttp plugin on, `window.fetch` goes through the
 *   native layer, which can't stream server-sent events. The bridge keeps the
 *   browser's own fetch as `window.CapacitorWebFetch`; the SSE channel uses it.
 */
export function overlayConnectOptions(
  options: OverlayConnectionInput,
  defaultBases: string[],
  win: { CapacitorWebFetch?: unknown } = globalThis as { CapacitorWebFetch?: unknown },
): ConnectOptions {
  const meta = options.connectionMeta;
  if (meta) {
    const base = Array.isArray(options.baseURL) ? undefined : options.baseURL;
    if (!base) {
      throw new Error(
        '[pangular] Pass one baseURL with connectionMeta, such as initOverlay({baseURL: "http://192.168.1.20:9999/", connectionMeta}). The overlay resolves the server\'s paths against it, so a list or no baseURL does not work.',
      );
    }
    if (!meta.configs?.[PANGULAR_CONFIG_KEY] && !warnedNoConfig) {
      warnedNoConfig = true;
      console.warn(
        "[pangular] connectionMeta has no configs, so the overlay uses the default inspectors, limits and redaction, and the server's redaction.secretNames are not applied on the page. Pass the whole __connection.json of the server as connectionMeta to use its config.",
      );
    }
  }
  const webFetch = win.CapacitorWebFetch;
  return {
    baseURL: options.baseURL ?? defaultBases,
    ...(meta ? { connectionMeta: meta as ConnectionMeta } : {}),
    ...(options.authToken ? { authToken: options.authToken } : {}),
    ...(typeof webFetch === 'function'
      ? { sseOptions: { fetch: (webFetch as typeof fetch).bind(globalThis) } }
      : {}),
  };
}

/**
 * The options for connecting again after the server dropped: only the mount
 * that answered the first time (`metaUrl`, where its `__connection.json` came
 * from), and no blocking prompt for the one-time code.
 */
export function overlayReconnectOptions(
  options: OverlayConnectionInput,
  defaultBases: string[],
  metaUrl: string | undefined,
  win?: { CapacitorWebFetch?: unknown },
): ConnectOptions {
  let base: string | undefined;
  try {
    base = !options.connectionMeta && metaUrl ? new URL('.', metaUrl).href : undefined;
  } catch {
    base = undefined;
  }
  return {
    ...overlayConnectOptions(base ? { ...options, baseURL: base } : options, defaultBases, win),
    simpleAuth: false,
  };
}

/**
 * Drops the connection devframe keeps on this window, so the next
 * `connectDevframe()` reads `__connection.json` again. A restarted server can
 * listen on another WebSocket port (the default one may be taken meanwhile),
 * and the kept one could then reach another server.
 */
export function forgetDevframeConnection(
  win: Record<string, unknown> = globalThis as unknown as Record<string, unknown>,
) {
  delete win['__DEVFRAME_CONNECTION__'];
  delete win['__DEVFRAME_CONNECTION_META__'];
}

/** For tests: lets the next missing config warn again. */
export function resetConnectionWarnings() {
  warnedNoConfig = false;
}

interface ConnectionEvents {
  events: {
    on(event: 'connection:error', listener: (error: Error) => void): (() => void) | void;
  };
}

/**
 * Warns once when a manually started overlay can't use its connection: the
 * server refused the `authToken`, or the transport failed. `connectDevframe()`
 * resolves before either shows, so without this the overlay just stays quiet.
 */
export function warnOnConnectionTrouble(
  rpc: ConnectionEvents,
  options: OverlayConnectionInput,
  warn: (message: string) => void = console.warn,
): () => void {
  const manual = !!options.connectionMeta;
  if (!manual && !options.authToken) return () => {};
  let warnedAuth = false;
  let warnedConnection = false;
  const off = rpc.events.on('connection:error', (error) => {
    const kind = (error as { kind?: string }).kind;
    if (kind === 'auth') {
      if (!options.authToken || warnedAuth) return;
      warnedAuth = true;
      warn(
        "[pangular] The devtools server refused the authToken. Pass one of the server's pairing tokens (auth: {tokens} on the hub or Vite plugin, --auth-token or PANGULAR_AUTH_TOKEN on the CLI). The server ignores them with auth off, as with --no-auth.",
      );
      return;
    }
    if (!manual || warnedConnection) return;
    warnedConnection = true;
    const base = Array.isArray(options.baseURL) ? options.baseURL[0] : options.baseURL;
    warn(
      `[pangular] Can't reach the devtools server at ${base ?? 'the given baseURL'} (${error.message}). From a device, check that it is on the same network, that the server listens on it (--host 0.0.0.0) and allows the app's origin, and that the WebView may load http: an https page blocks it as mixed content, and Android blocks cleartext unless the app allows it.`,
    );
  });
  return typeof off === 'function' ? off : () => {};
}
