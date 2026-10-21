// The redaction config reaches the page over RPC, after the page is trusted.
//
// `__connection.json` answers before the one-time code is exchanged, so it
// leaves the redaction config out: the names an app treats as secret are not
// for anyone who can reach the server. Every overlay asks for them with the
// `redaction-config` function once trusted, before it reads anything from the
// app, and falls back to the config in the connection info for a server that
// predates the function.

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
 * its call and falls back. A client still waiting for the one-time code
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
 * Asks the server for its redaction config. Returns `fallback` when the
 * server has no such function or the call fails, so an older server's
 * config in `__connection.json` still applies.
 */
export async function serverRedaction(
  rpc: { call(name: string, ...args: unknown[]): Promise<unknown> },
  fallback: RedactionConfig,
): Promise<RedactionConfig> {
  let answer: unknown;
  try {
    answer = await rpc.call(REDACTION_CONFIG_RPC);
  } catch {
    return fallback;
  }
  if (!answer || typeof answer !== 'object') return fallback;
  const secretNames = names((answer as { secretNames?: unknown }).secretNames);
  const unmask = names((answer as { unmask?: unknown }).unmask);
  if (!secretNames || !unmask) return fallback;
  return { secretNames, unmask };
}
