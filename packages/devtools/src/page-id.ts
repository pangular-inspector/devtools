/**
 * A fresh id for a page that reports to the server. Pages from other devices
 * (a phone, a simulator) can report to the same server, so the id has to be
 * long enough not to collide across them, and stay under the server's
 * 50-character limit.
 */
export function newPageId(): string {
  try {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return uuid.slice(0, 8);
  } catch {
    // randomUUID needs a secure context; fall back below.
  }
  const part = () => Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return part() + part();
}

/**
 * A secret minted together with a page id. The page shows it to the server
 * (`claim-page`) so that, after a reload, it gets its own page id back at once
 * while the old connection is still seen as open. Another client that only
 * knows the page id can't take the page over.
 */
export function newPageKey(): string {
  try {
    const bytes = globalThis.crypto?.getRandomValues?.(new Uint8Array(16));
    if (bytes) return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // no Web Crypto: fall back below.
  }
  let key = '';
  while (key.length < 32) key += Math.random().toString(16).slice(2);
  return key.slice(0, 32);
}

/** Shows the page's secret to the server. An older server without `claim-page` is fine. */
export async function claimPageOnServer(
  rpc: { call: (name: string, ...args: unknown[]) => Promise<unknown> },
  pageId: string,
  key: string,
): Promise<void> {
  try {
    await rpc.call('claim-page', { pageId, key });
  } catch {
    // The server predates page keys, or the call failed: the page still reports.
  }
}
