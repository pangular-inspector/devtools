import { shownPath, toValueRequest, type ComponentValueResult } from '../component-values.ts';
import type { ComponentPage } from '../types.ts';
import { untrusted } from './forms-tools.ts';
import { byRecency, unknownPageText } from './pages.ts';
import { capped } from './router-tools.ts';

/** How long a read waits for its page to answer. */
export const VALUE_TIMEOUT_MS = 5_000;

interface Deps {
  /** The pages that report a component tree. */
  pages: () => Iterable<ComponentPage>;
  /** Sends an event to every connected page. */
  broadcast: (method: string, message: unknown) => void;
  /** Whether a result for `target` may come from the connection that sent it for `pageId`. */
  answersFor: (target: string, pageId: unknown) => boolean;
  timeoutMs?: number;
}

/**
 * Reads one level of a component value on its page: the panel's
 * `request-component-value` RPC and `inspect-component` with `path`. The
 * server sends `component-value` to the page and waits for its
 * `component-value-result`, which only the connection that owns the page can
 * settle. It reads; nothing in the app changes.
 */
export function createComponentValues(deps: Deps) {
  const pending = new Map<string, { pageId: string; settle: (result: unknown) => void }>();
  let seq = 0;

  const answer = (message: { requestId?: unknown; pageId?: unknown; result?: unknown } | null) => {
    if (typeof message?.requestId !== 'string') return;
    const entry = pending.get(message.requestId);
    if (entry && deps.answersFor(entry.pageId, message.pageId)) entry.settle(message.result);
  };

  const request = (page: unknown, message: unknown) =>
    new Promise<ComponentValueResult>((resolve) => {
      const live = byRecency(deps.pages()).filter((entry) => entry.roots.length > 0);
      if (typeof page !== 'string' || !page) {
        return resolve({ error: 'Pass the page id of the component.' });
      }
      if (!live.some((entry) => entry.pageId === page)) {
        return resolve({ error: unknownPageText(page, live, 'a component tree') });
      }
      const read = toValueRequest(message);
      if (typeof read === 'string') return resolve({ error: read });
      const requestId = `v${++seq}`;
      const timeoutMs = deps.timeoutMs ?? VALUE_TIMEOUT_MS;
      const timer = setTimeout(() => {
        pending.delete(requestId);
        resolve({
          error: `The page did not answer within ${Math.round(timeoutMs / 1000)}s. Is the app open in a browser, and its tab in the foreground?`,
        });
      }, timeoutMs);
      timer.unref?.();
      pending.set(requestId, {
        pageId: page,
        settle: (result) => {
          clearTimeout(timer);
          pending.delete(requestId);
          resolve(toResult(result));
        },
      });
      deps.broadcast('component-value', { requestId, pageId: page, request: read });
    });

  return {
    answer,
    request,
    /** Reads waiting for an answer, for tests. */
    pendingCount: () => pending.size,
  };
}

function toResult(result: unknown): ComponentValueResult {
  const r = (result ?? {}) as Record<string, unknown>;
  if (r['ok'] === true) {
    return {
      ok: true,
      component: typeof r['component'] === 'string' ? r['component'].slice(0, 200) : '',
      path: Array.isArray(r['path'])
        ? r['path'].filter((key): key is string => typeof key === 'string').slice(0, 32)
        : [],
      value: r['value'],
    };
  }
  return {
    error: typeof r['error'] === 'string' ? r['error'].slice(0, 2000) : 'The page did not read it.',
  };
}

/** The inspect-component answer for one value path, as markdown. */
export function valueResultText(
  result: ComponentValueResult,
  hit: { id: string; name: string; pageId: string },
  path: string[],
): string {
  const where = `instance \`${hit.id}\` on page \`${hit.pageId}\``;
  if (!result.ok) {
    return untrusted(`Could not read \`${shownPath(path)}\` of ${where}. ${result.error}`);
  }
  let json: string;
  try {
    json = JSON.stringify(result.value, null, 2) ?? 'undefined';
  } catch {
    json = String(result.value);
  }
  return capped(
    untrusted(
      `\`${shownPath(path)}\` of \`${hit.name}\` (${where}), read from the running page. A \`{"$collapsed": type, "size": n}\` value was not read: add its key to \`path\`, or raise \`depth\`. A \`$more\` count is how many entries the level did not list: raise \`limit\` to read them.\n\n\`\`\`json\n${json}\n\`\`\``,
    ),
    'pass a longer `path`, or a lower `depth` or `limit`',
  );
}
