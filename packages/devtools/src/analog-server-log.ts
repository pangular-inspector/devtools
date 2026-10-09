import type { IncomingMessage, ServerResponse } from 'node:http';
import { isRedactedKey } from './forms-privacy.ts';
import { redactJsonText } from './json-text-redact.ts';

const JWT = /\beyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/g;
const BEARER = /\bBearer\s+[\w.~+/=-]+/gi;
const QUERY_PAIR = /([?&])([^=&#\s"'\\]*)=([^&#\s"'\\]*)/g;
const SECRET_QUERY_KEY =
  /token|secret|password|key|code|session|^(sig|signature|auth|authorization|credentials?|jwt)$|^x-(amz|goog)-(signature|credential|security-token)$/i;

const SECRET_PAIR = /([A-Za-z_][\w.-]*)(\s*[=:]\s*)(["']?)[^\s&,;"']+\3/g;

function queryKey(key: string): string {
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

export function redactMessage(text: string): string {
  return text
    .replace(JWT, '[redacted]')
    .replace(BEARER, 'Bearer [redacted]')
    .replace(QUERY_PAIR, (whole, sep: string, key: string) => {
      const name = queryKey(key);
      return SECRET_QUERY_KEY.test(name) || isRedactedKey(name) ? `${sep}${key}=[redacted]` : whole;
    });
}

function redactPairs(text: string): string {
  return text.replace(SECRET_PAIR, (whole, key: string, sep: string, quote: string) =>
    isSecretJsonKey(key) ? `${key}${sep}${quote}[redacted]${quote}` : whole,
  );
}

export type AnalogCallKind = 'load' | 'action' | 'fn' | 'api' | 'page';

export type AnalogActionOutcome = 'success' | 'redirect' | 'invalid' | 'error';

export interface AnalogCall {
  id: number;
  at: number;
  kind: AnalogCallKind;
  method: string;
  url: string;
  route?: string;
  status: number;
  ms: number;
  bytes?: number;
  from: 'ssr' | 'browser' | 'devtools';
  render?: 'ssr' | 'client';
  outcome?: AnalogActionOutcome;
  location?: string;
  seeded?: boolean;
  preview?: string;
}

const MAX_CALLS = 200;
const MAX_PREVIEW = 1000;
const MAX_CAPTURE = 16_000;

let seq = 0;
const calls: AnalogCall[] = [];
const listeners = new Set<(calls: AnalogCall[]) => void>();
let origin: string | undefined;

export function recentCalls(): AnalogCall[] {
  return calls.slice();
}

export function onCalls(listener: (calls: AnalogCall[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function recordCall(call: Omit<AnalogCall, 'id'>): AnalogCall {
  const full = { ...call, id: ++seq };
  calls.push(full);
  if (calls.length > MAX_CALLS) calls.splice(0, calls.length - MAX_CALLS);
  for (const listener of listeners) {
    try {
      listener(recentCalls());
    } catch {
      // a broken listener must not break the dev server
    }
  }
  return full;
}

export function clearCalls() {
  calls.length = 0;
  for (const listener of listeners) {
    try {
      listener([]);
    } catch {
      // a broken listener must not break the dev server
    }
  }
}

export function setDevOrigin(value: string | undefined) {
  origin = value?.replace(/\/$/, '');
}

export function devOrigin(): string | undefined {
  return origin;
}

function isSecretJsonKey(key: string): boolean {
  return isRedactedKey(key);
}

function redactJson(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return redactPairs(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth > 6) return '[Truncated]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactJson(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
    out[key] = isSecretJsonKey(key) ? '[redacted]' : redactJson(item, depth + 1);
  }
  return out;
}

export function redactBody(body: string): string {
  let text = body;
  try {
    text = JSON.stringify(redactJson(JSON.parse(body)));
  } catch {
    text = redactPairs(redactJsonText(body, isSecretJsonKey));
  }
  return redactMessage(text);
}

export function previewOf(body: string, type: string | undefined): string | undefined {
  if (!body) return undefined;
  if (type && !/json|text\/plain/.test(type)) return undefined;
  const text = redactBody(body);
  return text.length > MAX_PREVIEW ? `${text.slice(0, MAX_PREVIEW)}…` : text;
}

/** Maps an Analog load endpoint path back to the page URL it serves. */
export function loadRoute(endpoint: string): string {
  return (
    endpoint
      .replace(/\/\([^/]*\)(?=\/|$)/g, '')
      .replace(/\/-[^/]+-$/, '')
      .replace(/\/index$/, '') || '/'
  );
}

export function classify(
  url: string,
  method: string,
  accept: string,
  apiPrefix = 'api',
): { kind: AnalogCallKind; route?: string } | null {
  const path = url.split('?')[0];
  const prefix = apiPrefix ? `/${apiPrefix}` : '';
  for (const base of [`${prefix}/_analog/pages`, '/_analog/pages']) {
    if (path.startsWith(`${base}/`) || path === base) {
      const read = method === 'GET' || method === 'HEAD';
      return { kind: read ? 'load' : 'action', route: loadRoute(path.slice(base.length)) };
    }
  }
  for (const base of [`${prefix}/_analog/fn`, '/_analog/fn']) {
    if (path.startsWith(`${base}/`)) return { kind: 'fn', route: path.slice(base.length + 1) };
  }
  if (prefix && (path === prefix || path.startsWith(`${prefix}/`)))
    return { kind: 'api', route: path };
  if (
    method === 'GET' &&
    accept.includes('text/html') &&
    !path.startsWith('/@') &&
    !path.startsWith('/__') &&
    !/\.\w{1,5}$/.test(path)
  ) {
    return { kind: 'page', route: path };
  }
  return null;
}

export const DEVTOOLS_HEADER = 'x-pangular';

const SEED = /__analog_fn_([0-9a-f]{16})_/g;
const SEED_TAIL = 40;

export function actionOutcome(status: number, validationErrors: boolean): AnalogActionOutcome {
  if (validationErrors) return 'invalid';
  if (status >= 300 && status < 400) return 'redirect';
  return status >= 200 && status < 300 ? 'success' : 'error';
}

function fromOf(req: IncomingMessage): AnalogCall['from'] {
  if (req.headers[DEVTOOLS_HEADER]) return 'devtools';
  const agent = String(req.headers['user-agent'] ?? '');
  return !agent || /node|undici/i.test(agent) ? 'ssr' : 'browser';
}

export function analogMiddleware(apiPrefix = 'api') {
  return (
    req: IncomingMessage & { originalUrl?: string },
    res: ServerResponse,
    next: () => void,
  ) => {
    const url = req.originalUrl ?? req.url ?? '';
    const match = classify(url, req.method ?? 'GET', String(req.headers.accept ?? ''), apiPrefix);
    if (!match) return next();
    const start = performance.now();
    const chunks: Buffer[] = [];
    let captured = 0;
    let bytes = 0;
    let serverRendered = false;
    let tail = '';
    const seeds = new Set<string>();
    const capture = match.kind !== 'page';
    const keep = (chunk: unknown, encoding?: unknown) => {
      if (chunk === undefined || chunk === null || typeof chunk === 'function') return;
      const buffer = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(
            String(chunk),
            typeof encoding === 'string' ? (encoding as BufferEncoding) : 'utf8',
          );
      bytes += buffer.length;
      if (!capture && !serverRendered && buffer.includes('ng-server-context'))
        serverRendered = true;
      if (!capture) {
        const text = tail + buffer.toString('utf8');
        for (const seed of text.matchAll(SEED)) seeds.add(seed[1]);
        tail = text.slice(-SEED_TAIL);
      }
      if (capture && captured < MAX_CAPTURE) {
        chunks.push(buffer.subarray(0, MAX_CAPTURE - captured));
        captured += Math.min(buffer.length, MAX_CAPTURE - captured);
      }
    };
    const write = res.write.bind(res);
    const end = res.end.bind(res);
    res.write = ((chunk: unknown, ...rest: unknown[]) => {
      keep(chunk, rest[0]);
      return (write as (...args: unknown[]) => boolean)(chunk, ...rest);
    }) as typeof res.write;
    res.end = ((chunk?: unknown, ...rest: unknown[]) => {
      keep(chunk, rest[0]);
      return (end as (...args: unknown[]) => ServerResponse)(chunk, ...rest);
    }) as typeof res.end;
    res.on('finish', () => {
      const call: Omit<AnalogCall, 'id'> = {
        at: Date.now(),
        kind: match.kind,
        method: req.method ?? 'GET',
        url: redactMessage(url),
        route: match.route,
        status: res.statusCode,
        ms: Math.round(performance.now() - start),
        bytes,
        from: fromOf(req),
      };
      if (match.kind === 'page') {
        call.render =
          serverRendered && res.getHeader('x-analog-no-ssr') !== 'true' ? 'ssr' : 'client';
        for (const id of seeds) {
          recordCall({
            at: call.at,
            kind: 'fn',
            method: 'SSR',
            url: `/_analog/fn/${id}`,
            route: id,
            status: 200,
            ms: 0,
            from: 'ssr',
            seeded: true,
          });
        }
      } else {
        if (match.kind === 'action') {
          call.outcome = actionOutcome(res.statusCode, !!res.getHeader('x-analog-errors'));
          const location = res.getHeader('location');
          if (call.outcome === 'redirect' && location)
            call.location = redactMessage(String(location));
        }
        const preview = previewOf(
          Buffer.concat(chunks).toString('utf8'),
          String(res.getHeader('content-type') ?? ''),
        );
        if (preview) call.preview = preview;
      }
      recordCall(call);
    });
    next();
  };
}

export interface DuplicateLoad {
  route: string;
  ssrAt: number;
  browserAt: number;
}

/**
 * Pairs the SSR load() of a server rendered page with the first browser load()
 * of the same route that follows the render. Any other navigation resets it.
 */
function rendersRoute(loadRoute: string, pageRoute: string): boolean {
  const load = loadRoute.replace(/\/+$/, '') || '/';
  const page = pageRoute.replace(/\/+$/, '') || '/';
  return load === page || load === '/' || page.startsWith(`${load}/`);
}

export function duplicateLoads(list: AnalogCall[], windowMs = 10_000): DuplicateLoad[] {
  const out: DuplicateLoad[] = [];
  let ssrLoads = new Map<string, number>();
  let armed = new Map<string, number>();
  let armedAt = 0;
  for (const call of list) {
    if (call.from === 'devtools' || !call.route) continue;
    if (call.kind === 'page') {
      const page = call.route;
      armed =
        call.from === 'browser' && call.render === 'ssr'
          ? new Map([...ssrLoads].filter(([route]) => rendersRoute(route, page)))
          : new Map();
      armedAt = call.at;
      ssrLoads = new Map();
    } else if (call.kind === 'load') {
      if (call.from === 'ssr') {
        ssrLoads.set(call.route, call.at);
      } else if (armed.has(call.route) && call.at - armedAt <= windowMs) {
        out.push({ route: call.route, ssrAt: armed.get(call.route)!, browserAt: call.at });
        armed.delete(call.route);
      } else {
        armed = new Map();
      }
    }
  }
  return out;
}

export interface ServerFnRefetch {
  id: string;
  ssrAt: number;
  browserAt: number;
}

/**
 * Pairs a server function read that server rendering seeded into TransferState
 * with the first browser call of the same function right after that render.
 */
export function refetchedServerFns(list: AnalogCall[], windowMs = 10_000): ServerFnRefetch[] {
  const out: ServerFnRefetch[] = [];
  let seeds = new Map<string, number>();
  let armed = new Map<string, number>();
  let armedAt = 0;
  for (const call of list) {
    if (call.from === 'devtools' || !call.route) continue;
    if (call.kind === 'page') {
      armed = call.from === 'browser' && call.render === 'ssr' ? seeds : new Map();
      armedAt = call.at;
      seeds = new Map();
    } else if (call.kind === 'fn') {
      if (call.seeded) seeds.set(call.route, call.at);
      else if (call.from === 'browser' && armed.has(call.route) && call.at - armedAt <= windowMs) {
        out.push({ id: call.route, ssrAt: armed.get(call.route)!, browserAt: call.at });
        armed.delete(call.route);
      }
    }
  }
  return out;
}
