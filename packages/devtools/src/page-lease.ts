// The activity lease, on the page: the component tree, injectors, change
// detection and forms are read and sent, and captured errors and console calls
// are sent, only while someone looks at them (a panel is open, or an agent
// asked recently). The server says when that changes; an idle page only keeps
// itself alive and sends everything again when interest comes back.

interface Rpc {
  rpc: {
    call(name: string, ...args: unknown[]): Promise<unknown>;
    register(definition: {
      name: string;
      type: 'event';
      jsonSerializable: boolean;
      handler: (...args: any[]) => unknown;
    }): void;
  };
}

/** How often an idle page asks again, in case it missed the server's word. */
export const LEASE_POLL_MS = 10_000;
/** Pushes of the leased collectors run at most this often, forced ones aside. */
export const LEASED_PUSH_MS = 1000;

export interface PageLease {
  /** Whether a panel or an agent is watching, so leased collectors push. True until the server says otherwise. */
  readonly active: boolean;
  /** Asks the server again (on start and when the tab comes back). */
  refresh(): Promise<void>;
  stop(): void;
}

export interface PageLeaseOptions {
  /**
   * Interest came back: send every leased report in full. The server waits
   * for it before it answers the agent that asked.
   */
  wake(): Promise<unknown>;
  pollMs?: number;
}

/**
 * Follows the server's `page-interest-changed` broadcast and answers it.
 * A server without the lease never says the page is idle, so it keeps
 * pushing as before.
 */
export function createPageLease(my: Rpc, pageId: string, options: PageLeaseOptions): PageLease {
  let active = true;
  let stopped = false;
  let waking: Promise<void> | null = null;

  const wake = () =>
    (waking ??= (async () => {
      try {
        await options.wake();
      } catch {
        // A report failed, so the server may still hold an old one. Leave its
        // wait to time out rather than say the page is synced.
        return;
      }
      await my.rpc.call('page-interest', { pageId, synced: true }).catch(() => {});
    })().finally(() => {
      waking = null;
    }));

  const set = (watching: unknown) => {
    if (stopped || typeof watching !== 'boolean') return;
    const was = active;
    active = watching;
    if (watching && !was) void wake();
  };

  my.rpc.register({
    name: 'page-interest-changed',
    type: 'event',
    jsonSerializable: true,
    handler: (message: { watching?: unknown; wake?: unknown; pageId?: unknown } | null) => {
      if (typeof message?.pageId === 'string' && message.pageId !== pageId) return;
      // A wake the server waits on is answered even when this page never went idle.
      if (message?.watching === true && message.wake === true && active && !stopped) {
        void wake();
        return;
      }
      set(message?.watching);
    },
  });

  const refresh = async () => {
    try {
      const answer = (await my.rpc.call('page-interest', { pageId })) as
        { watching?: unknown } | undefined;
      set(answer?.watching ?? true);
    } catch {
      set(true);
    }
  };

  const poll = setInterval(() => {
    if (!active) void refresh();
  }, options.pollMs ?? LEASE_POLL_MS);

  return {
    get active() {
      return active && !stopped;
    },
    refresh,
    stop() {
      stopped = true;
      clearInterval(poll);
    },
  };
}

/**
 * Runs `fn` at most once per `ms`: at once when it has been long enough,
 * otherwise once at the end of the wait, however many calls came in between.
 */
export function throttle(fn: () => void, ms: number, now: () => number = () => Date.now()) {
  let last = -Infinity;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    timer = undefined;
    last = now();
    fn();
  };
  const call = () => {
    if (timer) return;
    const wait = last + ms - now();
    if (wait <= 0) run();
    else timer = setTimeout(run, wait);
  };
  call.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  return call;
}
