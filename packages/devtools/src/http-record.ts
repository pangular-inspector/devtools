// Stores one recorded HTTP call: on the server the devframe takes it right
// away (`registry.record`), in the browser it joins the page's capped list.

import { withCapturedHeaders } from './http-headers.ts';
import { MAX_CALLS, httpRegistry, type HttpCall } from './http-rules.ts';

export function recordHttpCall(call: HttpCall): void {
  const registry = httpRegistry();
  // The devframe server takes the call right away, so its headers are read now.
  if (registry.record) return registry.record(withCapturedHeaders(call));
  const calls = (registry.calls ??= []);
  calls.push(call);
  const extra = calls.length - (registry.maxCalls ?? MAX_CALLS);
  if (extra > 0) {
    calls.splice(0, extra);
    registry.dropped = (registry.dropped ?? 0) + extra;
  }
}

/** The key `clientPending` counts a request under. */
export function pendingKey(method: string, url: string): string {
  return `${method.toUpperCase()} ${url}`;
}

/** Notes an `HttpClient` request in flight; the returned function ends it once. */
export function notePendingClientRequest(method: string, url: string): () => void {
  const pending = (httpRegistry().clientPending ??= new Map());
  const key = pendingKey(method, url);
  pending.set(key, (pending.get(key) ?? 0) + 1);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const left = (pending.get(key) ?? 1) - 1;
    if (left > 0) pending.set(key, left);
    else pending.delete(key);
  };
}
