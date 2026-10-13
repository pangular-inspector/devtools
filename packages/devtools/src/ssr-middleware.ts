import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SSR_REQUEST_HEADER, ssrRegistry, touchSsrRequest } from './ssr-registry.ts';
import { runInSsrRequest } from './ssr-context.ts';
import {
  OVERRIDE_HEADER,
  SNIFF_BYTES,
  applyStateEdits,
  beginSsrTrace,
  clientRenderOverride,
  endSsrTrace,
  isHtmlType,
  mergeServerTiming,
  noteClientRender,
  ssrTimingEntries,
  stateEditsFor,
  wantsHtml,
} from './ssr-trace.ts';

export { renderModeOf } from './ssr-trace.ts';

type Next = (error?: unknown) => void;

function headerText(value: number | string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value.join(', ') : String(value);
}

/** Told to the user when a compression middleware ran before this one and encoded the body. */
export const COMPRESSED_NOTE =
  'the body was already compressed: mount ssrMiddleware after compression';

/**
 * The value the headers passed to writeHead give `name`, which wins over one set with setHeader.
 * Node takes an object, a flat `[name, value, ...]` array or `[name, value]` pairs.
 */
function passedHeader(args: unknown[], name: string): string | undefined {
  const headers = args.find((arg, i) => i > 0 && arg && typeof arg === 'object');
  if (!headers) return undefined;
  if (Array.isArray(headers)) {
    const flat: unknown[] = Array.isArray(headers[0]) ? headers.flat() : headers;
    let value: string | undefined;
    for (let i = 0; i + 1 < flat.length; i += 2) {
      if (String(flat[i]).toLowerCase() === name) {
        value = headerText(flat[i + 1] as string | string[]);
      }
    }
    return value;
  }
  const object = headers as OutgoingHttpHeaders;
  const key = Object.keys(object).find((k) => k.toLowerCase() === name);
  return key === undefined ? undefined : headerText(object[key]);
}

/** True when the body is encoded, so its bytes can't be read as HTML. */
function encoded(res: ServerResponse, passed?: string): boolean {
  const value = (passed ?? headerText(res.getHeader('content-encoding')))?.trim().toLowerCase();
  return !!value && value !== 'identity';
}

/**
 * Traces HTML requests that the Angular SSR engine answers. Each request gets
 * an id, sent to the render in a request header and back to the browser in
 * `Server-Timing`, so the panel can join the render to the page that loaded.
 */
export interface SsrMiddlewareOptions {
  skip?: string[];
  /** The app's browser build folder, which holds `index.csr.html`. Needed to force a Client render. */
  browserDistFolder?: string;
}

function readShell(folder: string | undefined): string | undefined {
  if (!folder) return undefined;
  try {
    return readFileSync(join(folder, 'index.csr.html'), 'utf8');
  } catch {
    return undefined;
  }
}

export function createSsrMiddleware(options: SsrMiddlewareOptions = {}) {
  const skip = options.skip ?? [];
  return (req: IncomingMessage, res: ServerResponse, next: Next) => {
    if (!ssrRegistry().record) return next();
    const url = req.url ?? '/';
    if (!wantsHtml(req.method, url, req.headers.accept, skip)) {
      delete req.headers[SSR_REQUEST_HEADER];
      // Untraced, so its server calls never link to a render running alongside.
      return runInSsrRequest(undefined, () => next());
    }
    const trace = beginSsrTrace(url)!;
    const { id } = trace;
    req.headers[SSR_REQUEST_HEADER] = id;

    let renderMs = 0;
    let bytes = 0;
    let sniff = '';
    let done = false;
    // Whether the body was encoded before it reached this middleware, read when the headers go
    // out. A compression() mounted before this one sets its header inside that writeHead call, so
    // its later `Content-Encoding` does not count; one mounted after has already set it.
    let encodedAtHead: boolean | undefined;
    const bodyEncoded = () => encodedAtHead ?? encoded(res);

    const writeHead = res.writeHead;
    res.writeHead = function (this: ServerResponse, ...args: unknown[]) {
      encodedAtHead ??= encoded(res, passedHeader(args, 'content-encoding'));
      if (!renderMs) {
        renderMs = Date.now() - trace.at;
        const timing = ssrTimingEntries(trace, renderMs);
        const existing = headerText(res.getHeader('server-timing'));
        const merge = (passed?: string) => mergeServerTiming([existing, passed], timing);
        // Header names are case-insensitive, so `Server-Timing` counts as the same header.
        const isTiming = (name: unknown) => String(name).toLowerCase() === 'server-timing';
        // Headers passed to writeHead would override setHeader, so merge into them. Node takes
        // an object, a flat `[name, value, ...]` array or `[name, value]` pairs.
        const slot = args.findIndex((arg, i) => i > 0 && arg && typeof arg === 'object');
        const headers = args[slot];
        if (Array.isArray(headers)) {
          // Work on a copy so the caller's array is left as it was.
          const raw = [...headers] as unknown[];
          const pairs = Array.isArray(raw[0]);
          const i = raw.findIndex((entry, n) =>
            pairs ? isTiming((entry as unknown[])[0]) : n % 2 === 0 && isTiming(entry),
          );
          // Added to the array, not with setHeader: Node rejects pairs once a header is set.
          if (i < 0)
            raw.push(...(pairs ? [['server-timing', merge()]] : ['server-timing', merge()]));
          else if (pairs) {
            const [name, value] = raw[i] as [string, string | string[]];
            raw[i] = [name, merge(headerText(value))];
          } else raw[i + 1] = merge(headerText(raw[i + 1] as string | string[]));
          args[slot] = raw;
        } else {
          const object = headers as OutgoingHttpHeaders | undefined;
          const passedKey = object ? Object.keys(object).find(isTiming) : undefined;
          const passed = passedKey ? headerText(object?.[passedKey]) : undefined;
          if (object && passedKey && passed !== undefined) object[passedKey] = merge(passed);
          else res.setHeader('server-timing', merge());
        }
      }
      return (writeHead as (...a: unknown[]) => ServerResponse).apply(this, args);
    } as typeof res.writeHead;

    const count = (chunk: unknown) => {
      if (chunk === undefined || chunk === null || typeof chunk === 'function') return;
      touchSsrRequest(trace.active);
      const buffer =
        typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk as Uint8Array);
      bytes += buffer.length;
      if (sniff.length < SNIFF_BYTES) sniff += buffer.toString('utf8', 0, SNIFF_BYTES);
    };
    // Node sends implicit headers through writeHead, so the wrapper above sees every response.
    const write = res.write;
    res.write = function (this: ServerResponse, chunk: unknown, ...rest: unknown[]) {
      count(chunk);
      return (write as (...a: unknown[]) => boolean).call(this, chunk, ...rest);
    } as typeof res.write;
    const end = res.end;
    res.end = function (this: ServerResponse, chunk?: unknown, ...rest: unknown[]) {
      count(chunk);
      return (end as (...a: unknown[]) => ServerResponse).call(this, chunk, ...rest);
    } as typeof res.end;

    // Holds the HTML until it ends, so the TransferState script can be rewritten before it is sent.
    function bufferForEdits(list: ReturnType<typeof stateEditsFor>) {
      const chunks: Buffer[] = [];
      const flushEnd = res.end;
      const flushHeaders = res.flushHeaders;
      // Angular's Node adapter flushes headers before the body, which would fix the old content-length.
      res.flushHeaders = function () {} as typeof res.flushHeaders;
      res.setHeader(OVERRIDE_HEADER, 'state-edit');
      // A browser that has the page sends its ETag, and a prerendered page then answers 304, which
      // would leave the cached copy without the edit.
      delete req.headers['if-none-match'];
      delete req.headers['if-modified-since'];
      // Callbacks wait until the held HTML is really sent.
      const callbacks: ((error?: Error | null) => void)[] = [];
      res.write = function (this: ServerResponse, chunk: unknown, ...rest: unknown[]) {
        if (chunk !== undefined && chunk !== null && typeof chunk !== 'function') {
          touchSsrRequest(trace.active);
          chunks.push(
            typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk as Uint8Array),
          );
        }
        const callback = [chunk, ...rest].find((arg) => typeof arg === 'function');
        if (callback) callbacks.push(callback as (typeof callbacks)[number]);
        return true;
      } as typeof res.write;
      res.end = function (this: ServerResponse, chunk?: unknown, ...rest: unknown[]) {
        if (chunk !== undefined && chunk !== null && typeof chunk !== 'function') {
          chunks.push(
            typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk as Uint8Array),
          );
        }
        const body = Buffer.concat(chunks);
        const isHtml = isHtmlType(headerText(res.getHeader('content-type')));
        // A compression middleware that wraps res.write outside this one hands over encoded
        // bytes, where the TransferState script can't be found. They are sent as they are.
        const { out, edited } = applyStateEdits(trace, body, list, {
          isHtml,
          compressed: isHtml && bodyEncoded(),
          compressedNote: COMPRESSED_NOTE,
        });
        if (!res.headersSent) {
          res.removeHeader('content-length');
          res.setHeader('content-length', Buffer.byteLength(out));
          // The validators describe the unedited page. Kept, they would let the browser revalidate
          // its edited copy with a 304 after the override is removed.
          if (edited) {
            res.removeHeader('etag');
            res.removeHeader('last-modified');
          }
        }
        res.flushHeaders = flushHeaders;
        const last = [chunk, ...rest].find((arg) => typeof arg === 'function');
        if (last) callbacks.push(last as (typeof callbacks)[number]);
        const onSent = callbacks.length
          ? (error?: Error | null) => callbacks.forEach((callback) => callback(error))
          : undefined;
        return (flushEnd as (...a: unknown[]) => ServerResponse).call(this, out, onSent);
      } as typeof res.end;
    }

    const finish = (aborted: boolean) => {
      if (done) return;
      done = true;
      res.writeHead = writeHead;
      res.write = write;
      res.end = end;
      endSsrTrace(trace, {
        method: req.method ?? 'GET',
        url,
        status: res.statusCode,
        renderMs,
        bytes,
        sniff,
        header: (name) => headerText(res.getHeader(name)),
        compressed: bodyEncoded(),
        aborted,
      });
    };
    res.once('finish', () => finish(false));
    res.once('close', () => finish(!res.writableFinished));

    const forceClient = clientRenderOverride(url);
    const shell =
      forceClient &&
      noteClientRender(
        trace,
        forceClient,
        readShell(options.browserDistFolder),
        'no index.csr.html: pass browserDistFolder to the SSR options',
      );
    if (shell) {
      res.statusCode = 200;
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.setHeader(OVERRIDE_HEADER, 'client-render');
      res.end(req.method === 'HEAD' ? undefined : shell);
      return;
    }
    const edits = stateEditsFor(url);
    if (edits.length) bufferForEdits(edits);
    // A render without Angular's `REQUEST` finds its request id through this context.
    runInSsrRequest(id, () => next());
  };
}
