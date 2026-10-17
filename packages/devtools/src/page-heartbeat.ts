// The page heartbeat, on the page: one small `page-heartbeat` call every few
// seconds keeps all of this page's data alive on the server, so the collectors
// send a report only when it changed. The answer says when the server lost the
// page (it expired or the server restarted); every collector then sends its
// report again on its next cycle. It also carries the activity lease
// (`page-lease.ts`), so an idle page asks for nothing else.

interface Rpc {
  rpc: { call(name: string, ...args: unknown[]): Promise<unknown> };
}

/**
 * How often the page says it is there. Under the server's page expiry
 * (`PAGE_TTL_MS`, 15 s) with room for a late timer, and at most 6 calls a minute.
 */
export const PAGE_HEARTBEAT_MS = 10_000;

const state = { running: false, lostAt: -Infinity };

/**
 * Whether a collector must send an unchanged report again. While the
 * heartbeat keeps the page alive, only after the server lost it (`sentAt` is
 * from before the loss). Without a heartbeat (an older server, or before its
 * first answer), `fallback`: the collector's own keepalive rule.
 */
export function resendDue(sentAt: number, fallback: boolean): boolean {
  return state.running ? sentAt <= state.lostAt : fallback;
}

/** Whether a heartbeat keeps this page alive, so collectors skip their keepalives. */
export function heartbeatRunning(): boolean {
  return state.running;
}

export interface PageHeartbeatOptions {
  /** The server's word on the activity lease, carried by each answer. */
  watching?(watching: boolean): void;
  intervalMs?: number;
  now?(): number;
}

export interface PageHeartbeat {
  /** Beats at once, then every `intervalMs`. */
  start(): void;
  /** Stops beating (a tab in the background, a page that left); collectors keep skipping keepalives. */
  pause(): void;
  /** One beat now. */
  beat(): Promise<void>;
  /** The server lost what the page sent (a restart, a page back from the cache): send everything again. */
  lost(): void;
  /** Stops for good; collectors go back to their own keepalives. */
  stop(): void;
}

interface Answer {
  known?: unknown;
  watching?: unknown;
}

export function createPageHeartbeat(
  my: Rpc,
  pageId: string,
  options: PageHeartbeatOptions = {},
): PageHeartbeat {
  const now = options.now ?? (() => Date.now());
  const intervalMs = options.intervalMs ?? PAGE_HEARTBEAT_MS;
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;

  const lost = () => {
    state.lostAt = now();
  };

  const beat = async () => {
    if (stopped) return;
    let answer: Answer | undefined;
    try {
      answer = (await my.rpc.call('page-heartbeat', { pageId })) as Answer | undefined;
    } catch {
      // The server is away or predates the heartbeat: keep the collectors as they are.
      return;
    }
    if (stopped || !answer || typeof answer.known !== 'boolean') return;
    state.running = true;
    if (!answer.known) lost();
    if (typeof answer.watching === 'boolean') options.watching?.(answer.watching);
  };

  const pause = () => {
    clearInterval(timer);
    timer = undefined;
  };

  return {
    start() {
      if (stopped || timer) return;
      void beat();
      timer = setInterval(() => void beat(), intervalMs);
    },
    pause,
    beat,
    lost,
    stop() {
      stopped = true;
      pause();
      state.running = false;
      state.lostAt = -Infinity;
    },
  };
}

/** `resendDue` for a collector with its own fixed keepalive of `ms`. */
export function keepaliveAfter(sentAt: number, ms: number, now = Date.now()): boolean {
  return resendDue(sentAt, now - sentAt >= ms);
}
