// Errors the dev server hits, which no page can report: a server render that
// throws (Angular's ErrorHandler logs it with `console.error` on the server)
// and Vite's transform, compile and SSR module errors (the payloads Vite
// sends to its browser overlay). They are kept in one registry on
// `globalThis`, so the Vite plugin, the app's server bundle and the devframe
// server share it even when they load separate copies of this package. The
// devframe server sets `record` while the Errors inspector is on; before that
// the registry keeps the last few, so an error from the first render shows up.

import { tapConsole } from './console-tap.ts';
import { ssrRegistry } from './ssr-registry.ts';

export type ServerErrorKind = 'ssr' | 'vite';

/** One error as a capture hands it over, before grouping and masking. */
export interface ServerErrorInput {
  kind: ServerErrorKind;
  message: string;
  stack?: string;
  /** The page path of the server render it happened in. */
  url?: string;
  /** The traced SSR request (`ssrMiddleware`), so the SSR & HTTP tab can be cross-checked. */
  requestId?: string;
  /** Vite: the plugin that threw, such as `vite:esbuild`. */
  plugin?: string;
  /** Vite: the file, without a query. */
  file?: string;
  line?: number;
  column?: number;
  /** Vite: the code frame around the error. */
  frame?: string;
  at?: number;
}

export interface ServerErrorsRegistry {
  /** Set by the devframe server while the Errors inspector is on. */
  record?: (error: ServerErrorInput) => void;
  /** Errors from before `record` was set, oldest first. */
  pending: ServerErrorInput[];
  /** Stops the console capture `captureSsrConsoleErrors` started. */
  stopConsole?: () => void;
}

/** Errors kept until the devframe server takes them. */
const MAX_PENDING = 20;

export function serverErrorsRegistry(): ServerErrorsRegistry {
  const g = globalThis as { __PANGULAR_SERVER_ERRORS__?: ServerErrorsRegistry };
  return (g.__PANGULAR_SERVER_ERRORS__ ??= { pending: [] });
}

/** Hands an error to the devframe server, or keeps it until one starts. */
export function recordServerError(error: ServerErrorInput): void {
  const registry = serverErrorsRegistry();
  const stamped = { ...error, at: error.at ?? Date.now() };
  if (registry.record) {
    try {
      registry.record(stamped);
    } catch {
      // The devtools never break the dev server.
    }
    return;
  }
  registry.pending.push(stamped);
  if (registry.pending.length > MAX_PENDING) registry.pending.shift();
}

/** Starts handing errors to `record`, the kept ones first. Returns the stop function. */
export function takeServerErrors(record: (error: ServerErrorInput) => void): () => void {
  const registry = serverErrorsRegistry();
  registry.record = record;
  for (const error of registry.pending.splice(0)) record(error);
  return () => {
    if (registry.record === record) registry.record = undefined;
  };
}

function textOf(value: unknown): string {
  try {
    if (value instanceof Error) return value.message || value.name;
    return typeof value === 'string' ? value : String(value);
  } catch {
    return '';
  }
}

/**
 * Turns the arguments of a server `console.error` into an SSR error, or
 * `undefined` when it is not one. A call counts when it runs inside a server
 * render a tracer marked (`ssr-context.ts`), or when it is Angular's
 * ErrorHandler format, `console.error('ERROR', error)`, which it uses on
 * every platform.
 */
export function ssrErrorFromConsole(args: readonly unknown[]): ServerErrorInput | undefined {
  if (!args.length) return undefined;
  const context = ssrRegistry().context?.getStore();
  const requestId = context?.requestId;
  const active = requestId ? ssrRegistry().active.get(requestId) : undefined;
  const angular = args[0] === 'ERROR' && args.length > 1;
  if (!active && !angular) return undefined;
  const parts = angular ? args.slice(1) : args;
  const error = parts.find((part) => part instanceof Error) as Error | undefined;
  const message = parts.map(textOf).filter(Boolean).join(' ').trim();
  if (!message) return undefined;
  return {
    kind: 'ssr',
    message,
    ...(error?.stack ? { stack: error.stack } : {}),
    ...(active?.url ? { url: active.url } : {}),
    ...(active && requestId ? { requestId } : {}),
  };
}

/**
 * Listens to the server's `console.error` for SSR errors, through the shared
 * console tap, so the calls still print as before. Safe to call more than
 * once; the returned function stops it.
 */
export function captureSsrConsoleErrors(): () => void {
  const registry = serverErrorsRegistry();
  if (registry.stopConsole) return registry.stopConsole;
  const stop = tapConsole(['error'], (_level, args) => {
    const error = ssrErrorFromConsole(args);
    if (error) recordServerError(error);
  });
  registry.stopConsole = () => {
    stop();
    registry.stopConsole = undefined;
  };
  return registry.stopConsole;
}

/** The `err` of a Vite `{ type: 'error' }` payload, as `ErrorPayload` in `vite/types/hmrPayload.d.ts`. */
interface ViteErrorBody {
  message?: unknown;
  stack?: unknown;
  id?: unknown;
  frame?: unknown;
  plugin?: unknown;
  loc?: { file?: unknown; line?: unknown; column?: unknown };
}

const str = (value: unknown, max: number) =>
  typeof value === 'string' && value ? value.slice(0, max) : undefined;
const int = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : undefined;

/** A Vite error payload as a server error, or `undefined` for any other payload. */
export function viteErrorFromPayload(payload: unknown): ServerErrorInput | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const { type, err } = payload as { type?: unknown; err?: ViteErrorBody };
  if (type !== 'error' || !err || typeof err !== 'object') return undefined;
  const message = str(err.message, 5000);
  if (!message) return undefined;
  const file = str(err.loc?.file, 2000) ?? str(err.id, 2000);
  const line = int(err.loc?.line);
  const column = int(err.loc?.column);
  return {
    kind: 'vite',
    message,
    ...(str(err.stack, 20_000) ? { stack: str(err.stack, 20_000) } : {}),
    ...(str(err.plugin, 200) ? { plugin: str(err.plugin, 200) } : {}),
    ...(file ? { file: file.replace(/\?.*$/, '') } : {}),
    ...(line !== undefined ? { line } : {}),
    ...(column !== undefined ? { column } : {}),
    ...(str(err.frame, 5000) ? { frame: str(err.frame, 5000) } : {}),
  };
}

/** The part of Vite's dev server the error capture uses. */
export interface ViteErrorSource {
  ws?: { send: (...args: unknown[]) => unknown };
}

/**
 * Records the errors Vite sends to its browser overlay: transform, compile
 * and SSR module errors. It wraps `server.ws.send` and passes every payload
 * on as before. The returned function puts `send` back.
 */
export function watchViteErrors(server: ViteErrorSource): () => void {
  const ws = server.ws;
  if (!ws || typeof ws.send !== 'function') return () => {};
  const send = ws.send;
  const watched = function (this: unknown, ...args: unknown[]) {
    try {
      const error = viteErrorFromPayload(args[0]);
      if (error) recordServerError(error);
    } catch {
      // The payload still goes out.
    }
    return send.apply(this, args);
  };
  ws.send = watched;
  return () => {
    if (ws.send === watched) ws.send = send;
  };
}
