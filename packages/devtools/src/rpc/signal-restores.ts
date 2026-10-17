import { actionBlockedMessage, type ResolvedPangularConfig } from '../config.ts';
import { toRestoreRequest, type SignalRestoreResult } from '../signal-restore.ts';
import type { SignalGraph } from '../types.ts';

/** How long a restore waits for its page to answer. */
export const RESTORE_TIMEOUT_MS = 10_000;

interface Deps {
  config: ResolvedPangularConfig;
  /** The signal graph each page reported last, by page id. */
  graphOf: (pageId: string) => SignalGraph | undefined;
  /** Sends an event to every connected page. */
  broadcast: (method: string, message: unknown) => void;
  /** Whether a result for `target` may come from the connection that sent it for `pageId`. */
  answersFor: (target: string, pageId: unknown) => boolean;
  timeoutMs?: number;
}

/**
 * Restores a past value from a signal's history: the panel's
 * `request-signal-restore` RPC. The server sends `signal-restore` to the page
 * and waits for its `signal-restore-result`, which only the connection that
 * owns the page can settle. The value itself stays on the page.
 */
export function createSignalRestores(deps: Deps) {
  const pending = new Map<string, { pageId: string; settle: (result: unknown) => void }>();
  let seq = 0;

  const answer = (message: { requestId?: unknown; pageId?: unknown; result?: unknown } | null) => {
    if (typeof message?.requestId !== 'string') return;
    const entry = pending.get(message.requestId);
    if (entry && deps.answersFor(entry.pageId, message.pageId)) entry.settle(message.result);
  };

  const request = (pageId: unknown, message: unknown) =>
    new Promise<SignalRestoreResult>((resolve) => {
      if (!deps.config.actions.components) {
        return resolve({ error: actionBlockedMessage('components') });
      }
      if (typeof pageId !== 'string' || !pageId || pageId.length > 50) {
        return resolve({ error: 'Pass the page id of the signal graph.' });
      }
      const graph = deps.graphOf(pageId);
      if (!graph) {
        return resolve({ error: `Page \`${pageId}\` reports no signal graph. Is it still open?` });
      }
      const restore = toRestoreRequest(message);
      if (!restore) {
        return resolve({ error: 'Pass the component id, the signal node id and the entry epoch.' });
      }
      const node = graph.nodes.find((n) => n.id === restore.node);
      if (!node?.locator || node.locator.id !== restore.component) {
        return resolve({
          error:
            'This signal is not a writable field of the shown component, so it cannot be restored.',
        });
      }
      const requestId = `r${++seq}`;
      const timeoutMs = deps.timeoutMs ?? RESTORE_TIMEOUT_MS;
      const timer = setTimeout(() => {
        pending.delete(requestId);
        resolve({
          error: `No page answered within ${Math.round(timeoutMs / 1000)}s. Is the app open in a browser, and its tab in the foreground?`,
        });
      }, timeoutMs);
      timer.unref?.();
      pending.set(requestId, {
        pageId,
        settle: (result) => {
          clearTimeout(timer);
          pending.delete(requestId);
          resolve(toResult(result));
        },
      });
      deps.broadcast('signal-restore', { requestId, pageId, request: restore });
    });

  return {
    answer,
    request,
    /** Restores waiting for an answer, for tests. */
    pendingCount: () => pending.size,
  };
}

function toResult(result: unknown): SignalRestoreResult {
  const r = (result ?? {}) as Record<string, unknown>;
  if (r['ok'] === true) {
    return {
      ok: true,
      component: typeof r['component'] === 'string' ? r['component'].slice(0, 200) : 'Component',
      key: typeof r['key'] === 'string' ? r['key'].slice(0, 200) : '',
      epoch: typeof r['epoch'] === 'number' ? r['epoch'] : 0,
      value: r['value'],
    };
  }
  return {
    error:
      typeof r['error'] === 'string' ? r['error'].slice(0, 2000) : 'The page did not restore it.',
  };
}
