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

/** For tests: lets the next missing config warn again. */
export function resetConnectionWarnings() {
  warnedNoConfig = false;
}
