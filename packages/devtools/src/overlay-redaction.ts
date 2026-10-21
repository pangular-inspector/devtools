// The redaction config reaches the page over RPC, after the page is trusted.
//
// `__connection.json` answers before the one-time code is exchanged, so it
// leaves the redaction config out: the names an app treats as secret are not
// for anyone who can reach the server. Every overlay asks for them with the
// `redaction-config` function once trusted, before it reads anything from the
// app. Only a server that predates the function still puts the config in the
// connection info, and only then does the overlay fall back to it: on a
// current server a failed call keeps the collectors off until a retry works.

import { PANGULAR_CONFIG_KEY, configFromConnection } from './config.ts';

/** The function the overlays call; it is `pangular:redaction-config` on the server. */
export const REDACTION_CONFIG_RPC = 'redaction-config';

export interface RedactionConfig {
  secretNames: string[];
  unmask: string[];
}

/** The part of a devframe client the overlay waits on. */
export interface TrustClient {
  readonly status?: string;
  readonly isTrusted?: boolean | null;
  events?: {
    on(event: 'connection:status', listener: (status: string) => void): (() => void) | void;
  };
}

const SETTLED = new Set(['connected', 'disconnected', 'error']);

/**
 * Resolves once `client` is trusted, or once it dropped, so the caller tries
 * its call (and, failing that, waits for a retry). A client still waiting for the one-time code
 * (`unauthorized`) keeps the promise open until a code entered in another tab
 * trusts it. A client that says nothing about trust (a static report, a test
 * double) resolves at once.
 */
export function whenTrusted(client: TrustClient): Promise<void> {
  if (client.isTrusted !== false || !client.events) return Promise.resolve();
  if (SETTLED.has(client.status ?? '')) return Promise.resolve();
  return new Promise((resolve) => {
    const off = client.events?.on('connection:status', (status) => {
      if (!SETTLED.has(status)) return;
      if (typeof off === 'function') off();
      resolve();
    });
  });
}

function names(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((name) => typeof name === 'string')
    ? [...value]
    : undefined;
}

/**
 * The redaction config in `__connection.json`, which only a server that
 * predates the `redaction-config` function sends. Undefined for a current
 * server, so a failed call is not mistaken for "no custom names".
 */
export function legacyRedaction(
  meta: { configs?: object } | undefined,
): RedactionConfig | undefined {
  const configs = meta?.configs as Record<string, unknown> | undefined;
  const pangular = configs?.[PANGULAR_CONFIG_KEY];
  if (!pangular || typeof pangular !== 'object' || !('redaction' in pangular)) return undefined;
  return configFromConnection(meta).redaction;
}

/** What a server that answers without a usable config has: the built-in rules only. */
const NO_EXTRA_NAMES: RedactionConfig = { secretNames: [], unmask: [] };

/**
 * Asks the server for its redaction config. A failed call (dropped, refused,
 * or a server without the function) returns `fallback`: the config an older
 * server sent in `__connection.json` (see `legacyRedaction`), or undefined for
 * a current server, so the caller keeps the collectors off and asks again
 * later. A call that is answered without a usable config means the server has
 * no extra names, so the built-in rules apply.
 */
export async function serverRedaction(
  rpc: { call(name: string, ...args: unknown[]): Promise<unknown> },
  fallback: RedactionConfig | undefined,
): Promise<RedactionConfig | undefined> {
  let answer: unknown;
  try {
    answer = await rpc.call(REDACTION_CONFIG_RPC);
  } catch {
    return fallback;
  }
  const answered = fallback ?? NO_EXTRA_NAMES;
  if (!answer || typeof answer !== 'object') return answered;
  const secretNames = names((answer as { secretNames?: unknown }).secretNames);
  const unmask = names((answer as { unmask?: unknown }).unmask);
  if (!secretNames || !unmask) return answered;
  return { secretNames, unmask };
}

export interface RedactionLoader {
  /** Resolves with the config once a call works; undefined once stopped. */
  readonly ready: Promise<RedactionConfig | undefined>;
  /** Asks again after a failed call, such as once a dropped connection is back and trusted. */
  retry(): void;
  stop(): void;
}

/**
 * Waits for `client` to be trusted, then asks for the redaction config, and
 * after a failed call waits for `retry()` before asking again. `onWait` runs
 * each time it has to wait, so a caller can stop blocking its own start.
 */
export function loadRedaction(
  client: TrustClient,
  rpc: { call(name: string, ...args: unknown[]): Promise<unknown> },
  fallback: RedactionConfig | undefined,
  onWait: () => void = () => {},
): RedactionLoader {
  let stopped = false;
  let wake: () => void = () => {};
  let halt: () => void = () => {};
  const halted = new Promise<void>((resolve) => (halt = resolve));
  const ready = (async () => {
    for (;;) {
      const trusted = whenTrusted(client);
      if (client.isTrusted === false && client.events && !SETTLED.has(client.status ?? '')) {
        onWait();
      }
      await Promise.race([trusted, halted]);
      if (stopped) return undefined;
      const config = await serverRedaction(rpc, fallback);
      if (stopped) return undefined;
      if (config) return config;
      onWait();
      await new Promise<void>((resolve) => (wake = resolve));
      if (stopped) return undefined;
    }
  })();
  return {
    ready,
    retry: () => wake(),
    stop: () => {
      stopped = true;
      halt();
      wake();
    },
  };
}
