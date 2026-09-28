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
