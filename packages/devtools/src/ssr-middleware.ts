import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { editTransferState, matchingOverrides } from './ssr-overrides.ts';
import {
  SSR_REQUEST_HEADER,
  SSR_TIMING_NAME,
  ssrRegistry,
  noteOverride,
  type ActiveRequest,
  type SsrRenderMode,
  type SsrRequest,
} from './ssr-registry.ts';

const SNIFF_BYTES = 64 * 1024;
const KEPT_HEADERS = [
  'content-type',
  'content-length',
  'cache-control',
  'location',
  'vary',
  'x-powered-by',
] as const;

type Next = (error?: unknown) => void;

function wantsHtml(req: IncomingMessage, skip: string[]): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const url = req.url ?? '/';
  if (skip.some((prefix) => url.startsWith(prefix))) return false;
  return /\btext\/html\b/.test(req.headers.accept ?? '');
}

/**
 * What kind of answer this was. The HTML wins over the status, so a not-found
 * page that Angular rendered with status 404 still counts as Server.
 */
export function renderModeOf(html: string, status = 200): SsrRenderMode {
  const match = /<[^>]*\sng-server-context="([^"]*)"/.exec(html);
  if (match) {
    // `ssr|hydration` style lists come from older versions.
    const values = match[1].split('|');
    if (values.includes('ssr')) return 'server';
    if (values.includes('ssg')) return 'prerender';
    return 'unknown';
  }
  // index.csr.html: an empty custom-element root and the app's module script.
  if (
    /<[a-z]+-[\w-]*[^>]*>\s*<\/[a-z]+-[\w-]*>/i.test(html) &&
    /<script[^>]*type="module"/.test(html)
  ) {
    return 'client';
  }
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400) return 'not-rendered';
  return 'unknown';
}

function headerText(value: number | string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value.join(', ') : String(value);
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
    const registry = ssrRegistry();
    if (!registry.record) return next();
    if (!wantsHtml(req, skip)) {
      delete req.headers[SSR_REQUEST_HEADER];
      return next();
    }
    const id = randomBytes(8).toString('hex');
    const at = Date.now();
    const active: ActiveRequest = { fetches: 0, fetchMs: 0 };
    registry.active.set(id, active);
    req.headers[SSR_REQUEST_HEADER] = id;

    let renderMs = 0;
    let bytes = 0;
    let sniff = '';
    let done = false;

    const writeHead = res.writeHead;
    res.writeHead = function (this: ServerResponse, ...args: unknown[]) {
      if (!renderMs) {
        renderMs = Date.now() - at;
        const timing = [
          `${SSR_TIMING_NAME};desc="${id}"`,
          `render;dur=${renderMs}`,
          `fetch;desc="${active.fetches} calls";dur=${active.fetchMs}`,
        ];
        const navs = active.navigations ?? [];
        const sum = (pick: (n: (typeof navs)[number]) => number | undefined) =>
          navs.reduce((total, n) => total + (pick(n) ?? 0), 0);
        if (navs.some((n) => n.guards?.ms !== undefined)) {
          timing.push(`guards;dur=${sum((n) => n.guards?.ms)}`);
        }
        if (navs.some((n) => n.resolvers?.ms !== undefined)) {
          timing.push(`resolve;dur=${sum((n) => n.resolvers?.ms)}`);
        }
        const existing = headerText(res.getHeader('server-timing'));
        // A headers object passed to writeHead would override setHeader, so merge into it.
        const headers = args.find(
          (arg, i) => i > 0 && arg && typeof arg === 'object' && !Array.isArray(arg),
        ) as OutgoingHttpHeaders | undefined;
        // Header names are case-insensitive, so `Server-Timing` counts as the same header.
        const passedKey = headers
          ? Object.keys(headers).find((key) => key.toLowerCase() === 'server-timing')
          : undefined;
        const passed = passedKey ? headerText(headers?.[passedKey]) : undefined;
        const value = [existing, passed, ...timing].filter(Boolean).join(', ');
        if (headers && passedKey && passed !== undefined) headers[passedKey] = value;
        else res.setHeader('server-timing', value);
      }
      return (writeHead as (...a: unknown[]) => ServerResponse).apply(this, args);
    } as typeof res.writeHead;

    const count = (chunk: unknown) => {
      if (chunk === undefined || chunk === null || typeof chunk === 'function') return;
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
    function bufferForEdits(list: ReturnType<typeof matchingOverrides>) {
      const chunks: Buffer[] = [];
      const flushEnd = res.end;
      const flushHeaders = res.flushHeaders;
      // Angular's Node adapter flushes headers before the body, which would fix the old content-length.
      res.flushHeaders = function () {} as typeof res.flushHeaders;
      res.setHeader('x-pangular-override', 'state-edit');
      res.write = function (this: ServerResponse, chunk: unknown) {
        if (chunk !== undefined && chunk !== null && typeof chunk !== 'function') {
          chunks.push(
            typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk as Uint8Array),
          );
        }
        return true;
      } as typeof res.write;
      res.end = function (this: ServerResponse, chunk?: unknown, ...rest: unknown[]) {
        if (chunk !== undefined && chunk !== null && typeof chunk !== 'function') {
          chunks.push(
            typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk as Uint8Array),
          );
        }
        const html = Buffer.concat(chunks).toString('utf8');
        const isHtml = /\btext\/html\b/.test(headerText(res.getHeader('content-type')) ?? '');
        const hasState = isHtml && /<script\b[^>]*\bid="[^"]*-state"/.test(html);
        const edited = hasState ? editTransferState(html, list) : null;
        // Error pages and redirects carry no TransferState, so an edit there is not worth a note.
        for (const o of hasState ? list : []) {
          const done = !!edited?.keys.includes(o.key ?? '');
          noteOverride(id, {
            id: o.id,
            kind: 'state-edit',
            applied: done,
            note: done
              ? `${o.value === undefined ? 'removed' : 'set'} ${o.key}`
              : o.value === undefined
                ? `no entry ${o.key} to remove`
                : `could not edit the TransferState script for ${o.key}`,
          });
        }
        const out = edited ? edited.html : html;
        if (!res.headersSent) {
          res.removeHeader('content-length');
          res.setHeader('content-length', Buffer.byteLength(out));
        }
        res.flushHeaders = flushHeaders;
        const last = rest.find((arg) => typeof arg === 'function');
        return (flushEnd as (...a: unknown[]) => ServerResponse).call(this, out, last);
      } as typeof res.end;
    }

    const finish = (aborted: boolean) => {
      if (done) return;
      done = true;
      registry.active.delete(id);
      res.writeHead = writeHead;
      res.write = write;
      res.end = end;
      const type = headerText(res.getHeader('content-type')) ?? '';
      // Static files and API answers that reach this far are not renders.
      if (!aborted && !/\btext\/html\b/.test(type) && res.statusCode < 300) return;
      const headers: Record<string, string> = {};
      for (const name of KEPT_HEADERS) {
        const value = headerText(res.getHeader(name));
        if (value !== undefined) headers[name] = value.slice(0, 500);
      }
      const request: SsrRequest = {
        id,
        method: req.method ?? 'GET',
        url: (req.url ?? '/').slice(0, 2000),
        status: res.statusCode,
        at,
        durationMs: Date.now() - at,
        renderMs: renderMs || Date.now() - at,
        bytes,
        renderMode: renderModeOf(/\btext\/html\b/.test(type) ? sniff : '', res.statusCode),
        fetches: active.fetches,
        fetchMs: active.fetchMs,
        headers,
        ...(active.navigations?.length ? { navigations: active.navigations } : {}),
        ...(active.overrides?.length ? { overrides: active.overrides } : {}),
        ...(aborted ? { aborted: true } : {}),
      };
      registry.record?.(request);
    };
    res.once('finish', () => finish(false));
    res.once('close', () => finish(!res.writableFinished));

    const url = req.url ?? '/';
    const overrides = registry.overrides;
    const forceClient = matchingOverrides(overrides, url, 'client-render')[0];
    if (forceClient) {
      const shell = readShell(options.browserDistFolder);
      noteOverride(id, {
        id: forceClient.id,
        kind: 'client-render',
        applied: !!shell,
        note: shell
          ? 'served index.csr.html instead of rendering'
          : 'no index.csr.html: pass browserDistFolder to initPangularHub',
      });
      if (shell) {
        res.statusCode = 200;
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.setHeader('x-pangular-override', 'client-render');
        res.end(req.method === 'HEAD' ? undefined : shell);
        return;
      }
    }
    const edits = matchingOverrides(overrides, url, 'state-edit');
    if (edits.length) bufferForEdits(edits);
    next();
  };
}
