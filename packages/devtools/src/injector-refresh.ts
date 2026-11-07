import { forgetInjectorEntries } from './injector-tree.ts';

interface RefreshRpc {
  register(definition: {
    name: string;
    type: 'event';
    jsonSerializable: boolean;
    handler: (message: never) => unknown;
  }): void;
}

/** Longest injector id taken from a refresh request. */
const MAX_ID = 100;

/**
 * Answers the server's `injector-refresh` events for this page: the panel
 * selected an element injector (`injectorId`), or pressed Refresh (no id).
 * The collector forgets what it read for that injector, or for all of them,
 * and `push` sends a fresh injector tree. Element entries are cached because
 * reading their dependencies is costly, so only these requests re-read them.
 */
export function registerInjectorRefresh(
  rpc: RefreshRpc,
  pageId: string,
  push: () => Promise<unknown> | unknown,
) {
  rpc.register({
    name: 'injector-refresh',
    type: 'event',
    jsonSerializable: true,
    handler: (message: { pageId?: unknown; injectorId?: unknown } | null) => {
      if (!message || message.pageId !== pageId) return;
      const id = message.injectorId;
      if (id !== undefined && (typeof id !== 'string' || !id || id.length > MAX_ID)) return;
      if (!forgetInjectorEntries(id)) return;
      void Promise.resolve()
        .then(push)
        .catch(() => {});
    },
  });
}
