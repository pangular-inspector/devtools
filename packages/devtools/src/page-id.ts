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
