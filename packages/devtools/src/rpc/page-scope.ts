/**
 * The page a page tool call (`call-browser-tool`) answers for. While it is
 * set, tool answers leave out other pages: no ids, URLs or counts of the
 * other tabs that report.
 *
 * This module has no Node imports, because page-side collectors import the
 * tool text helpers that read it. `rpc/browser-tools.ts` (server only)
 * installs a reader backed by `AsyncLocalStorage`; without one, every call
 * answers for the whole server, as MCP calls do.
 */
let reader: () => string | undefined = () => undefined;

/** The calling page's id during a page tool call, else `undefined`. */
export function callerPage(): string | undefined {
  return reader();
}

/** Installs how {@link callerPage} finds the calling page. */
export function setCallerPageReader(read: () => string | undefined): void {
  reader = read;
}
