import { keepaliveDue } from './change-detection.ts';
import { createDeltaSender, type DeltaShape } from './push-delta.ts';

export interface DeltaChannelOptions {
  call(name: string, ...args: unknown[]): Promise<unknown>;
  pageId: string;
  /** The push RPC, such as `push-component-tree`. */
  push: string;
  /** The keepalive RPC answering `{known}`; without one, an empty delta keeps the page alive. */
  ping?: string;
  shape: DeltaShape;
  /** The refresh interval, so keepalives come before the server expires the page. */
  tickMs?: () => number;
  /** How long an unchanged report may go unsent; `keepaliveDue` decides by default. */
  keepaliveMs?: number;
  now?: () => number;
}

export interface DeltaChannel {
  /**
   * Sends `report`: in full the first time and after the server lost track,
   * then only what changed. An unchanged report is not sent; a keepalive goes
   * out instead when one is due. `force` sends even an unchanged report.
   */
  send(report: Record<string, unknown>, force?: boolean): Promise<void>;
  /** Keeps the page alive without reading it: a ping, or a full send when the server forgot it. */
  keepalive(collect: () => Record<string, unknown>): Promise<void>;
  /** The next report goes in full, such as after the page came back from the back/forward cache. */
  resync(): void;
}

interface Answer {
  known?: boolean;
  delta?: boolean;
}

/**
 * One kind of report on its way to the server as deltas (`push-delta.ts`).
 * A server that answers a full report without `{delta: true}` keeps getting
 * full reports, so a page and an older server still work together.
 */
export function createDeltaChannel(options: DeltaChannelOptions): DeltaChannel {
  const now = options.now ?? (() => Date.now());
  const tickMs = options.tickMs ?? (() => 0);
  const sender = createDeltaSender(options.shape);
  let sentAt = 0;
  let forceFull = true;

  const due = () =>
    options.keepaliveMs === undefined
      ? keepaliveDue(sentAt, tickMs(), now())
      : now() - sentAt >= options.keepaliveMs;

  const ping = async (): Promise<boolean> => {
    sentAt = now();
    const answer = (await options.call(options.ping!, options.pageId)) as Answer | undefined;
    return answer?.known !== false;
  };

  const send = async (report: Record<string, unknown>, force = false, retry = true) => {
    const full = forceFull;
    const next = sender.next({ ...report, pageId: options.pageId }, full);
    if (!next.changed && !force) {
      if (!due()) return;
      if (options.ping) {
        if (await ping()) return;
        sender.reset();
        forceFull = true;
        return send(report, true, false);
      }
    }
    forceFull = false;
    sentAt = now();
    let answer: Answer | undefined;
    try {
      answer = (await options.call(options.push, next.message)) as Answer | undefined;
    } catch (error) {
      sender.reset();
      forceFull = true;
      throw error;
    }
    if (answer?.known === false) {
      sender.reset();
      forceFull = true;
      if (retry) await send(report, true, false);
      return;
    }
    if (answer?.delta === true) sender.confirm(next.seq);
    else if (next.full) sender.fullOnly();
  };

  return {
    send: (report, force = false) => send(report, force),
    async keepalive(collect) {
      if (!due()) return;
      if (options.ping) {
        if (await ping()) return;
        sender.reset();
        forceFull = true;
      }
      await send(collect(), true, false);
    },
    resync() {
      sender.reset();
      forceFull = true;
    },
  };
}
