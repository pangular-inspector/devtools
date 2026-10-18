/**
 * Waits for pages to confirm a request that the server broadcasts without a
 * reply, such as starting a change detection recording: the page answers by
 * pushing its report again, and the report shows whether the request took.
 * A tool then reports the pages that confirmed, not every page it asked.
 */

/** How long a tool waits for the pages it asked. */
export const PUSH_ACK_MS = 3000;

export interface PushAcks<T> {
  /** Call from the push handler with each report a page sends. */
  notify(pageId: string, report: T): void;
  /**
   * Resolves with the pages of `pageIds` that pushed a report `accept` likes
   * within `ms`, in the order of `pageIds`. Resolves early once all did.
   */
  wait(pageIds: readonly string[], accept: (report: T) => boolean, ms?: number): Promise<string[]>;
}

export function createPushAcks<T>(): PushAcks<T> {
  const waiters = new Set<(pageId: string, report: T) => void>();
  return {
    notify(pageId, report) {
      for (const waiter of [...waiters]) waiter(pageId, report);
    },
    wait(pageIds, accept, ms = PUSH_ACK_MS) {
      const wanted = new Set(pageIds);
      const confirmed = new Set<string>();
      if (!wanted.size) return Promise.resolve([]);
      return new Promise((resolve) => {
        const done = () => {
          clearTimeout(timer);
          waiters.delete(waiter);
          resolve(pageIds.filter((pageId) => confirmed.has(pageId)));
        };
        const waiter = (pageId: string, report: T) => {
          if (!wanted.has(pageId) || !accept(report)) return;
          confirmed.add(pageId);
          if (confirmed.size === wanted.size) done();
        };
        const timer = setTimeout(done, ms);
        timer.unref?.();
        waiters.add(waiter);
      });
    },
  };
}
