import { referenceDiff, serialize } from './ngrx-shared.ts';
import {
  installReduxDevtoolsHook,
  type ReduxConnection,
  type ReduxDevtoolsHook,
} from './redux-devtools-hook.ts';
import type { ReduxLogEntry, ReduxStoreInfo, ReduxStoresReport } from './redux-stores-shared.ts';
import { redactMessage, redactUrl } from './router.ts';

interface RpcScope {
  rpc: { call(name: string, ...args: unknown[]): Promise<unknown> };
}

const HEARTBEAT_MS = 5000;
const MAX_DIFF = 50;
const SMALL = { depth: 4, maxKeys: 20, maxString: 300, budget: 400 };
const ACTION = { depth: 5, maxKeys: 50, maxString: 1000, budget: 2000 };
const STATE = { depth: 8, maxKeys: 100, maxString: 2000, budget: 20_000 };
const MAX_STORES = 50;

/**
 * Turns what the hook recorded into log entries and store summaries. The raw
 * states are read here, after `setRedaction()`, so the configured secret names
 * apply, and are dropped once diffed.
 */
export function createReduxStoresCollector(hook: ReduxDevtoolsHook, maxLog: number) {
  const log: ReduxLogEntry[] = [];
  const previous = new WeakMap<ReduxConnection, { state: unknown }>();
  let seq = 0;

  const read = (): void => {
    for (const connection of hook.connections) {
      const entries = connection.pending.splice(0);
      for (const entry of entries) {
        const before = previous.get(connection);
        const overflow = { more: 0 };
        const diff = before
          ? referenceDiff(before.state, entry.state, '', SMALL, MAX_DIFF, undefined, overflow).map(
              (change) => (change.path ? change : { ...change, path: '(root)' }),
            )
          : [];
        previous.set(connection, { state: entry.state });
        log.push({
          seq: ++seq,
          storeId: connection.id,
          type: redactMessage(entry.type),
          ...(entry.action !== undefined ? { action: serialize(entry.action, ACTION) } : {}),
          timestamp: entry.timestamp,
          diff,
          ...(overflow.more ? { diffTruncated: overflow.more } : {}),
        });
      }
    }
    if (log.length > maxLog) log.splice(0, log.length - maxLog);
  };

  const stores = (): ReduxStoreInfo[] =>
    hook.connections
      .filter((connection) => !connection.closed)
      .slice(0, MAX_STORES)
      .map((connection) => ({
        id: connection.id,
        name: redactMessage(connection.name || connection.library),
        library: connection.library,
        state: connection.hasState ? serialize(connection.state, STATE) : null,
        actions: connection.count,
      }));

  return {
    read,
    stores,
    /** Entries after `since`, oldest first. */
    logSince: (since: number) => log.filter((entry) => entry.seq > since),
    lastSeq: () => seq,
  };
}

export interface ReduxStoresOptions {
  maxLog: number;
  /** The page's `window`; tests pass their own. */
  target?: Record<PropertyKey, unknown>;
  describe?: () => { url: string; title: string };
}

/**
 * The page side of the other stores in the store inspector: installs the
 * Redux DevTools stand-in (so stores created from now on report too), and
 * pushes `push-redux-stores` when a store sends something, plus a keepalive.
 */
export function attachReduxStores(my: RpcScope, pageId: string, options: ReduxStoresOptions) {
  const hook = installReduxDevtoolsHook(options.target, { maxPending: options.maxLog });
  if (!hook) return null;
  const collector = createReduxStoresCollector(hook, options.maxLog);
  let sent = 0;
  let lastBody = '';
  let lastPushAt = 0;
  let pushing = false;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void push(), 50);
  };
  hook.listeners.add(schedule);

  const push = async (): Promise<void> => {
    if (pushing) {
      again = true;
      return;
    }
    pushing = true;
    try {
      collector.read();
      const stores = collector.stores();
      const log = collector.logSince(sent);
      if (!stores.length && !log.length && !lastBody) return;
      const body = JSON.stringify(stores);
      if (!log.length && body === lastBody && Date.now() - lastPushAt < HEARTBEAT_MS) return;
      lastBody = body;
      lastPushAt = Date.now();
      const page = options.describe?.() ?? {
        url: redactUrl(location.pathname + location.search),
        title: redactMessage(document.title),
      };
      const report: ReduxStoresReport = { pageId, ...page, stores, log, since: sent };
      const answer = (await my.rpc.call('push-redux-stores', report)) as
        { seq?: unknown } | undefined;
      const confirmed = typeof answer?.seq === 'number' ? answer.seq : collector.lastSeq();
      // A lower seq means the server forgot this page: send the held log again.
      const lost = confirmed < sent;
      sent = lost ? 0 : confirmed;
      if (lost) again = true;
    } catch {
      lastBody = '';
    } finally {
      pushing = false;
      if (again) {
        again = false;
        schedule();
      }
    }
  };

  return {
    push,
    leave: () => {
      sent = 0;
      lastBody = '';
      void my.rpc.call('forget-redux-stores-page', pageId).catch(() => {});
    },
    stop: () => {
      clearTimeout(timer);
      hook.listeners.delete(schedule);
    },
  };
}
