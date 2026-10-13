// The activity lease, on the server: pages send their component tree,
// injectors, change detection, forms and errors only while someone watches. A
// panel watches while it is connected and subscribed to one of those shared
// states; an agent watches for `leaseMs` after each tool call. The server
// tells pages when that changes (`page-interest-changed`), and an agent call
// that finds the pages idle wakes them and waits briefly for their fresh
// reports.

/** Shared states whose subscribers keep pages pushing. */
export const WATCHED_STATES = [
  'component-tree',
  'injector-tree',
  'change-detection',
  'forms',
  'errors',
];
/** How long an agent call waits for idle pages to send fresh reports. */
export const WAKE_WAIT_MS = 1500;
/** How often the server looks for panels that came or went. */
export const INTEREST_TICK_MS = 1000;
/** A page that has not asked for this long is not waited for. */
const PAGE_SEEN_MS = 60_000;

interface Client {
  $meta?: { subscribedStates?: Set<string> };
}

interface RpcHostLike {
  _rpcGroup?: { clients?: Client[] };
}

export interface PageInterestOptions {
  /** devframe's RPC host; its connected clients tell whether a panel is open. */
  rpcHost: unknown;
  /** Sends `page-interest-changed` to the pages. */
  broadcast(message: { watching: boolean; wake?: true }): void;
  /** How long an agent call keeps pages pushing, in ms. 0 turns the lease off. */
  leaseMs: number;
  /** Pages in the background report nothing, so they are not waited for. */
  hidden?: (pageId: string) => boolean;
  now?: () => number;
  waitMs?: number;
}

export interface PageInterest {
  /** Whether pages should push now. */
  watching(): boolean;
  /**
   * An agent is about to read page data. Renews the lease and, when pages
   * were idle, wakes them and waits (at most `waitMs`) until each answered.
   */
  touch(): Promise<void>;
  /** The `page-interest` RPC: a page asks, or says it sent its reports after a wake. */
  handle(message: unknown): { watching: boolean };
  /** The server forgot or expired this page, so a wake no longer waits for it. */
  forget(pageId: string): void;
  /** Forgets every page `keep` turns down (the expiry interval passes the pages it still holds). */
  prune(keep: (pageId: string) => boolean): void;
  /** Looks for panels that came or went; call it about once a second. */
  tick(): void;
  stop(): void;
}

/** True when a connected client is subscribed to a watched state, or when that can't be told. */
export function panelWatching(rpcHost: unknown): boolean {
  const clients = (rpcHost as RpcHostLike | undefined)?._rpcGroup?.clients;
  // A host that doesn't show its clients can't say nobody watches, so pages keep pushing.
  if (!Array.isArray(clients)) return true;
  return clients.some((client) => {
    const states = client?.$meta?.subscribedStates;
    if (!states || typeof states.has !== 'function') return false;
    for (const key of states) {
      if (WATCHED_STATES.some((name) => key === name || key.endsWith(`:${name}`))) return true;
    }
    return false;
  });
}

export function createPageInterest(options: PageInterestOptions): PageInterest {
  const now = options.now ?? (() => Date.now());
  const waitMs = options.waitMs ?? WAKE_WAIT_MS;
  const pages = new Map<string, number>();
  let agentAt = -Infinity;
  let last: boolean | null = null;
  let waiters: { pending: Set<string>; done: () => void }[] = [];
  // The wake in flight: an agent call that comes in meanwhile waits for it too.
  let waking: Promise<void> | null = null;

  const watching = () =>
    options.leaseMs <= 0 || panelWatching(options.rpcHost) || now() - agentAt < options.leaseMs;

  const announce = (wake = false) => {
    const value = watching();
    if (!wake && value === last) return;
    last = value;
    options.broadcast(wake ? { watching: value, wake: true } : { watching: value });
  };

  const livePages = () => {
    const at = now();
    return [...pages]
      .filter(([pageId, seen]) => at - seen < PAGE_SEEN_MS && !options.hidden?.(pageId))
      .map(([pageId]) => pageId);
  };

  // The page answered, or is gone: a waiting agent call stops waiting for it.
  const settle = (pageId: string) => {
    for (const waiter of [...waiters]) {
      waiter.pending.delete(pageId);
      if (!waiter.pending.size) waiter.done();
    }
  };

  return {
    watching,
    touch() {
      if (options.leaseMs <= 0) return Promise.resolve();
      // Another call is already waking the pages: its reports aren't in yet.
      if (waking) {
        agentAt = now();
        return waking;
      }
      const was = watching();
      agentAt = now();
      if (was) return Promise.resolve();
      const expected = livePages();
      if (!expected.length) {
        announce();
        return Promise.resolve();
      }
      const wake = new Promise<void>((resolve) => {
        const waiter = {
          pending: new Set(expected),
          done: () => {
            clearTimeout(timer);
            waiters = waiters.filter((w) => w !== waiter);
            resolve();
          },
        };
        const timer = setTimeout(waiter.done, waitMs);
        (timer as { unref?: () => void }).unref?.();
        waiters.push(waiter);
        announce(true);
      }).finally(() => {
        if (waking === wake) waking = null;
      });
      waking = wake;
      return wake;
    },
    handle(message) {
      const raw = (message && typeof message === 'object' ? message : {}) as {
        pageId?: unknown;
        synced?: unknown;
      };
      const pageId =
        typeof raw.pageId === 'string' && raw.pageId && raw.pageId.length < 50
          ? raw.pageId
          : undefined;
      if (pageId) {
        pages.set(pageId, now());
        if (raw.synced === true) settle(pageId);
      }
      return { watching: watching() };
    },
    forget(pageId) {
      pages.delete(pageId);
      settle(pageId);
    },
    prune(keep) {
      for (const pageId of [...pages.keys()]) {
        if (keep(pageId)) continue;
        pages.delete(pageId);
        settle(pageId);
      }
    },
    tick() {
      for (const [pageId, seen] of pages) if (now() - seen > PAGE_SEEN_MS * 5) pages.delete(pageId);
      announce();
    },
    stop() {
      for (const waiter of [...waiters]) waiter.done();
    },
  };
}

/**
 * Wraps an agent tool handler or resource read so it renews the lease first,
 * and waits for idle pages to send fresh reports before it reads them.
 */
export function leased<A extends unknown[], R>(
  interest: () => PageInterest | undefined,
  fn: (...args: A) => R,
): (...args: A) => Promise<Awaited<R>> {
  return async (...args: A): Promise<Awaited<R>> => {
    try {
      await interest()?.touch();
    } catch {
      // The lease never fails a tool call.
    }
    return await fn(...args);
  };
}
