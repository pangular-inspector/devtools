import { documentTree, type HostTree } from './host-tree.ts';
import { createNgrxCollector, type NgrxDebugNg } from './ngrx-collector.ts';
import type { NgrxPageReport, NgrxRequest } from './ngrx-shared.ts';
import { redactMessage, redactUrl } from './router.ts';

interface RpcScope {
  rpc: {
    call(name: string, ...args: unknown[]): Promise<unknown>;
    register(definition: {
      name: string;
      type: 'event';
      jsonSerializable: boolean;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: (...args: any[]) => unknown;
    }): void;
  };
}

const HEARTBEAT_MS = 5000;

export interface NgrxPageOptions<H extends object> {
  tree?: HostTree<H>;
  describe?: () => { url: string; title: string };
}

export function attachNgrx<H extends object = Element>(
  my: RpcScope,
  pageId: string,
  getNg: () => NgrxDebugNg<H> | undefined,
  maxLog?: number,
  options: NgrxPageOptions<H> = {},
) {
  const session = Math.random().toString(36).slice(2, 10);
  let sentSeq = 0;
  let sentLost = 0;
  let lastBody = '';
  let lastPushAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pushing = false;
  let pendingRediscover = false;

  const schedule = (rediscover = false) => {
    pendingRediscover ||= rediscover;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const again = pendingRediscover;
      pendingRediscover = false;
      void push(again);
    }, 50);
  };

  const collector = createNgrxCollector(
    getNg,
    () => schedule(),
    options.tree ?? documentTree<H>(),
    maxLog,
  );

  const push = async (rediscover = true) => {
    if (pushing) return schedule(rediscover);
    pushing = true;
    try {
      const { stores, classic } = collector.collect(rediscover);
      const log = collector.logSince(sentSeq);
      const lost = collector.unrestorableSince(sentLost);
      if (!stores.length && !classic && !log.length && !lastBody) return;
      const body = JSON.stringify({ stores, classic });
      const quiet = !log.length && !lost.updates.length;
      if (quiet && body === lastBody && Date.now() - lastPushAt < HEARTBEAT_MS) return;
      lastBody = body;
      lastPushAt = Date.now();
      const page = options.describe?.() ?? {
        url: redactUrl(location.pathname + location.search),
        title: redactMessage(document.title),
      };
      const report: NgrxPageReport = {
        pageId,
        session,
        ...page,
        stores,
        classic,
        log,
        ...(lost.updates.length ? { unrestorable: lost.updates } : {}),
      };
      const answer = (await my.rpc.call('push-ngrx-state', report)) as
        { seq?: unknown } | undefined;
      sentSeq = typeof answer?.seq === 'number' ? answer.seq : collector.lastSeq();
      sentLost = lost.last;
    } catch {
      return;
    } finally {
      pushing = false;
    }
  };

  my.rpc.register({
    name: 'ngrx-action',
    type: 'event',
    jsonSerializable: true,
    handler: (message: { requestId?: string; pageId?: string; request?: NgrxRequest }) => {
      if (!message || typeof message.requestId !== 'string') return;
      if (message.pageId && message.pageId !== pageId) return;
      let result;
      try {
        result = collector.run(message.request as NgrxRequest);
      } catch (error) {
        result = { error: String((error as Error)?.message ?? error) };
      }
      void my.rpc
        .call('ngrx-action-result', { requestId: message.requestId, pageId, result })
        .catch(() => {});
      schedule();
    },
  });

  return {
    push,
    leave: () => void my.rpc.call('forget-ngrx-page', pageId).catch(() => {}),
    stop: () => {
      clearTimeout(timer);
      collector.stop();
    },
  };
}
