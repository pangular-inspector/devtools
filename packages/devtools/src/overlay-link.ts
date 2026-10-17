// The overlay's link to the devtools server. The devframe client has no
// reconnect of its own: once the server stops, its socket is closed for good.
// The link hands the collectors one `rpc` that follows the live client, so
// when the server comes back it connects again with backoff, registers the
// page's functions on the new client and lets the overlay send everything
// again, without a page reload.

/** A function the server can call on the page. */
export interface PageFunction {
  name: string;
  type: 'event' | 'action' | 'query' | 'static';
  jsonSerializable?: boolean;
  handler: (...args: any[]) => unknown;
}

/** The part of a devframe client the link uses. */
export interface LinkClient {
  readonly status: string;
  readonly isTrusted: boolean;
  events?: {
    on(event: 'connection:status', listener: (status: string) => void): (() => void) | void;
  };
  scope(namespace: 'pangular'): {
    rpc: {
      call(name: string, ...args: unknown[]): Promise<unknown>;
      register(definition: PageFunction): void;
    };
  };
  close?(): void;
}

/** What the collectors call: always the live client, or a quick rejection while there is none. */
export interface LinkRpc {
  call(name: string, ...args: unknown[]): Promise<unknown>;
  register(definition: PageFunction): void;
}

export interface LinkHooks {
  /** The connection dropped: stop sending until `restored`. */
  dropped(): void;
  /** A new connection is trusted: claim the page and send every report in full. */
  restored(): Promise<void> | void;
}

export interface OverlayLinkOptions {
  connect(): Promise<LinkClient>;
  /** Waits between attempts; the last one repeats. */
  delaysMs?: readonly number[];
  /** How long a new connection may take to be trusted before it is dropped and tried again. */
  trustTimeoutMs?: number;
  warn?: (message: string) => void;
}

export interface OverlayLink {
  readonly scope: { rpc: LinkRpc };
  /** Sets what happens on a drop and on a reconnect. */
  follow(hooks: LinkHooks): void;
  stop(): void;
}

/** Calls made while the link has no connection reject with this, and nothing logs it. */
export class OverlayOfflineError extends Error {
  override readonly name = 'OverlayOfflineError';
  constructor() {
    super('[pangular] Not connected to the devtools server');
  }
}

export const RECONNECT_DELAYS_MS: readonly number[] = [500, 1000, 2000, 4000, 5000];
const TRUST_TIMEOUT_MS = 10_000;

const DROPPED = new Set(['disconnected', 'error']);

const UNTRUSTED_WARNING =
  '[pangular] The devtools server came back but did not trust this page, so the overlay stopped reporting. Reload the page and enter the one-time code from the terminal.';

const REVOKED_WARNING =
  "[pangular] The devtools server revoked this page's access, so the overlay stopped reporting. Reload the page and enter the one-time code from the terminal.";

/** Resolves once `client` is trusted; rejects when it drops, is refused or takes too long. */
export function untilTrusted(client: LinkClient, timeoutMs = TRUST_TIMEOUT_MS): Promise<void> {
  if (client.isTrusted && client.status === 'connected') return Promise.resolve();
  return new Promise((resolve, reject) => {
    let off: (() => void) | void = undefined;
    const done = (error?: Error) => {
      clearTimeout(timer);
      if (typeof off === 'function') off();
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(() => done(new Error('trust timeout')), timeoutMs);
    off = client.events?.on('connection:status', (status) => {
      if (status === 'connected') done();
      else if (status === 'unauthorized') done(new UntrustedError());
      else if (DROPPED.has(status)) done(new Error(status));
    });
    // The status may have settled before the listener was added.
    if (client.status === 'connected') done();
    else if (client.status === 'unauthorized') done(new UntrustedError());
    else if (DROPPED.has(client.status)) done(new Error(client.status));
  });
}

class UntrustedError extends Error {}

/**
 * Follows `first`, and replaces it with a new connection from `connect()`
 * whenever it drops, trying again after each of `delaysMs` until one is
 * trusted. A server that refuses the page's credentials ends the retries.
 */
export function createOverlayLink(first: LinkClient, options: OverlayLinkOptions): OverlayLink {
  const delays = options.delaysMs ?? RECONNECT_DELAYS_MS;
  const warn = options.warn ?? ((message: string) => console.warn(message));
  const functions = new Map<string, PageFunction>();
  let hooks: LinkHooks | null = null;
  let live: LinkClient | null = null;
  let unwatch: (() => void) | void = undefined;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let offline = false;
  let warnedRevoked = false;

  const adopt = (client: LinkClient) => {
    live = client;
    // Whether the server trusted this client: only then does `unauthorized` mean it
    // revoked that trust. A first client still waiting for its code is left alone.
    let trusted = client.isTrusted && client.status === 'connected';
    // A client without events (a static report) never drops.
    unwatch = client.events?.on('connection:status', (status) => {
      if (live !== client) return;
      if (DROPPED.has(status)) drop();
      else if (status === 'unauthorized' && trusted) revoked();
      else if (status === 'connected') {
        trusted = true;
        if (offline) void regained();
      }
    });
  };

  /**
   * The server revoked the trust of the live client (devframe's `authRevoked`):
   * calls would reject with an auth error, so the link goes offline as on a
   * drop, but keeps the client and does not reconnect, since a new connection
   * would be refused as well. If the same client is trusted again, such as
   * after a code entered in another tab, `regained` sends everything again.
   */
  const revoked = () => {
    if (stopped || offline) return;
    offline = true;
    try {
      hooks?.dropped();
    } catch {
      // A collector that fails to pause must not stop the others.
    }
    if (warnedRevoked) return;
    warnedRevoked = true;
    warn(REVOKED_WARNING);
  };

  const regained = async () => {
    if (stopped) return;
    offline = false;
    try {
      await hooks?.restored();
    } catch {
      // The next refresh sends what this one could not.
    }
  };

  const release = () => {
    if (typeof unwatch === 'function') unwatch();
    unwatch = undefined;
    const client = live;
    live = null;
    try {
      client?.close?.();
    } catch {
      // Already closed.
    }
  };

  const drop = () => {
    release();
    if (stopped) return;
    if (!offline) {
      offline = true;
      try {
        hooks?.dropped();
      } catch {
        // A collector that fails to pause must not stop the reconnect.
      }
    }
    schedule();
  };

  const schedule = () => {
    if (stopped || timer) return;
    const delay = delays[Math.min(attempt++, delays.length - 1)] ?? 5000;
    timer = setTimeout(() => {
      timer = undefined;
      void reconnect();
    }, delay);
  };

  const reconnect = async () => {
    let client: LinkClient | null = null;
    try {
      client = await options.connect();
      if (stopped) {
        client.close?.();
        return;
      }
      await untilTrusted(client, options.trustTimeoutMs);
    } catch (error) {
      try {
        client?.close?.();
      } catch {
        // Already closed.
      }
      if (stopped) return;
      if (error instanceof UntrustedError) {
        warn(UNTRUSTED_WARNING);
        return;
      }
      schedule();
      return;
    }
    if (stopped) {
      client.close?.();
      return;
    }
    attempt = 0;
    adopt(client);
    const rpc = client.scope('pangular').rpc;
    for (const definition of functions.values()) rpc.register(definition);
    offline = false;
    try {
      await hooks?.restored();
    } catch {
      // The next refresh sends what this one could not.
    }
  };

  adopt(first);
  // A client that already dropped before the link saw it.
  if (DROPPED.has(first.status)) queueMicrotask(() => live === first && drop());

  const rpc: LinkRpc = {
    call(name, ...args) {
      const client = live;
      if (!client || offline) return Promise.reject(new OverlayOfflineError());
      return client.scope('pangular').rpc.call(name, ...args);
    },
    register(definition) {
      functions.set(definition.name, definition);
      live?.scope('pangular').rpc.register(definition);
    },
  };

  return {
    scope: { rpc },
    follow(next) {
      hooks = next;
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = undefined;
      release();
    },
  };
}
