// Which traced request the code running now belongs to. The tracers
// (`ssr-middleware.ts`, `ssr-fetch.ts`, `pangularSsrEventHandler`) set it for
// every request they see, traced or not, and the server side of
// `withPangular()` reads it when the render has no Angular `REQUEST` to carry
// the id header, as in Analog. Overlapping renders each keep their own value,
// so a server call is linked only to the request it ran under.
//
// This module is bundled into the app too, so it imports nothing from Node:
// the storage is created on the server through `process.getBuiltinModule`.

import { activeSsrRequest, ssrRegistry } from './ssr-registry.ts';

/** What a tracer knows about the request being handled. No `requestId` means it was not traced. */
export interface SsrRequestContext {
  readonly requestId?: string;
}

/** The part of Node's `AsyncLocalStorage` used here. */
export interface SsrContextStorage {
  getStore(): SsrRequestContext | undefined;
  run<R>(store: SsrRequestContext, callback: () => R): R;
  enterWith(store: SsrRequestContext): void;
}

const UNTRACED: SsrRequestContext = Object.freeze({});

type AsyncHooks = { AsyncLocalStorage: new () => SsrContextStorage };

/**
 * The storage, kept on the SSR registry so every copy of this package in the
 * process (the Vite plugin, the app's server bundle, a middleware loaded by
 * Vite) shares one. Undefined where there is no `AsyncLocalStorage`.
 */
function storage(): SsrContextStorage | undefined {
  const registry = ssrRegistry();
  if (registry.context) return registry.context;
  try {
    const process = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } })
      .process;
    const hooks = process?.getBuiltinModule?.('node:async_hooks') as AsyncHooks | undefined;
    if (hooks?.AsyncLocalStorage) registry.context = new hooks.AsyncLocalStorage();
  } catch {
    // No async context on this runtime: server calls stay unlinked.
  }
  return registry.context;
}

function contextFor(requestId: string | undefined): SsrRequestContext {
  return requestId ? { requestId } : UNTRACED;
}

/** Runs `callback`, and everything it starts, as part of the request `requestId` (none: untraced). */
export function runInSsrRequest<R>(requestId: string | undefined, callback: () => R): R {
  const context = storage();
  return context ? context.run(contextFor(requestId), callback) : callback();
}

/**
 * Marks the rest of the current call, and everything it starts, as part of
 * the request `requestId` (none: untraced). For a middleware that returns
 * before the render runs, such as an h3 one, where there is no callback to
 * wrap. Each request runs in its own async context, so this never reaches
 * another request.
 */
export function enterSsrRequest(requestId: string | undefined): void {
  storage()?.enterWith(contextFor(requestId));
}

const pinned = new WeakMap<object, SsrRequestContext>();

/**
 * The traced request that `app` (one render's environment injector) runs
 * under, while that request is still in flight. The context is read once,
 * when the app first asks, and kept for it, so a call that runs where the
 * async context was not carried along (a zone.js microtask, for one) still
 * finds its own request and never another one. Undefined when no tracer saw
 * the request or it was not traced.
 */
export function currentSsrRequest(app?: object): string | undefined {
  let context = app ? pinned.get(app) : undefined;
  if (!context) {
    context = ssrRegistry().context?.getStore();
    if (context && app) pinned.set(app, context);
  }
  return activeSsrRequest(context?.requestId);
}
