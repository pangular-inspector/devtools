import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import {
  SSR_REQUEST_HEADER,
  SSR_TIMING_NAME,
  ssrRegistry,
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

export function renderModeOf(html: string): SsrRenderMode {
  const match = /<[^>]*\sng-server-context="([^"]*)"/.exec(html);
  if (!match) return /<\w[^>]*\sng-version=/.test(html) ? 'unknown' : 'client';
  // `ssr|hydration` style lists come from older versions.
  const values = match[1].split('|');
  if (values.includes('ssr')) return 'server';
  if (values.includes('ssg')) return 'prerender';
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
export function createSsrMiddleware(options: { skip?: string[] } = {}) {
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
        const passed = headers ? headerText(headers['server-timing']) : undefined;
        const value = [existing, passed, ...timing].filter(Boolean).join(', ');
        if (headers && passed !== undefined) headers['server-timing'] = value;
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
        renderMode: /\btext\/html\b/.test(type) && sniff ? renderModeOf(sniff) : 'unknown',
        fetches: active.fetches,
        fetchMs: active.fetchMs,
        headers,
        ...(active.navigations?.length ? { navigations: active.navigations } : {}),
        ...(aborted ? { aborted: true } : {}),
      };
      registry.record?.(request);
    };
    res.once('finish', () => finish(false));
    res.once('close', () => finish(!res.writableFinished));
    next();
  };
}
