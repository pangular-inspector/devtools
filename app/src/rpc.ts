import type { DevframeRpcClient } from 'devframe/client';

/** Calls an `ng-devtools` RPC; resolves `null` without a client, rejections propagate. */
export function rpcCall(
  client: DevframeRpcClient | null,
  name: string,
  arg?: unknown,
): Promise<unknown> {
  if (!client) return Promise.resolve(null);
  const rpc = client.scope('ng-devtools').rpc as unknown as {
    call: (name: string, ...args: unknown[]) => Promise<unknown>;
  };
  return rpc.call(name, ...(arg === undefined ? [] : [arg]));
}

/** Like `rpcCall`, but resolves `null` on failure. */
export function rpcTry<T>(
  client: DevframeRpcClient | null,
  name: string,
  arg?: unknown,
): Promise<T | null> {
  return rpcCall(client, name, arg).then(
    (value) => value as T | null,
    () => null,
  );
}

/** True when the panel reads a report written by `ng-devtools build`, not a live server. */
export function isStaticReport(client: DevframeRpcClient | null): boolean {
  return client?.connectionMeta.backend === 'static';
}

/** Clears the boxes the panel drew in the app when the panel page goes away; returns the cleanup. */
export function clearHighlightsOnHide(client: () => DevframeRpcClient | null): () => void {
  const clear = () => {
    const rpc = client()?.scope('ng-devtools').rpc;
    if (!rpc) return;
    void rpc.callEvent('request-page-highlight', null);
    void rpc.callEvent('request-form-highlight', null);
  };
  addEventListener('pagehide', clear);
  return () => {
    removeEventListener('pagehide', clear);
    clear();
  };
}
