import { CACHE_SKIP_TEXT } from '../config.ts';
import type { HttpCall } from '../http-rules.ts';
import { redactMessage, redactUrl } from '../router.ts';
import type { SsrNavigation } from '../ssr-navigation.ts';
import { isSsrRequestId, type SsrRenderMode, type SsrRequest } from '../ssr-registry.ts';
import type { HttpPage } from '../types.ts';
import { UNTRUSTED, code } from './forms-tools.ts';
import { capped } from './router-tools.ts';

const MODE_LABEL: Record<SsrRenderMode, string> = {
  server: 'Server',
  prerender: 'Prerender',
  client: 'Client (no server render)',
  unknown: 'unknown',
};

const KEPT_HEADERS = new Set([
  'content-type',
  'content-length',
  'cache-control',
  'location',
  'vary',
  'x-powered-by',
]);

const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;

const OUTCOMES = new Set(['pending', 'succeeded', 'redirected', 'cancelled', 'failed', 'skipped']);

function names(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((n): n is string => typeof n === 'string')
        .slice(0, 30)
        .map((n) => n.slice(0, 200))
    : [];
}

function phaseMs(value: unknown): { ms?: number } {
  return typeof value === 'number' && Number.isFinite(value) ? { ms: num(value) } : {};
}

function sanitizeNavigations(raw: unknown): SsrNavigation[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-5).flatMap((item): SsrNavigation[] => {
    if (!item || typeof item !== 'object') return [];
    const n = item as { [K in keyof SsrNavigation]?: unknown };
    if (typeof n.url !== 'string' || typeof n.outcome !== 'string' || !OUTCOMES.has(n.outcome)) {
      return [];
    }
    const guards = n.guards as { names?: unknown; passed?: unknown; ms?: unknown } | undefined;
    const resolvers = n.resolvers as { names?: unknown; ms?: unknown } | undefined;
    return [
      {
        url: redactUrl(n.url),
        ...(typeof n.finalUrl === 'string' ? { finalUrl: redactUrl(n.finalUrl) } : {}),
        outcome: n.outcome as SsrNavigation['outcome'],
        ...(typeof n.reason === 'string' ? { reason: redactMessage(n.reason) } : {}),
        ...(typeof n.durationMs === 'number' ? { durationMs: num(n.durationMs) } : {}),
        ...(guards && typeof guards === 'object'
          ? {
              guards: {
                names: names(guards.names),
                ...(typeof guards.passed === 'boolean' ? { passed: guards.passed } : {}),
                ...phaseMs(guards.ms),
              },
            }
          : {}),
        ...(resolvers && typeof resolvers === 'object'
          ? { resolvers: { names: names(resolvers.names), ...phaseMs(resolvers.ms) } }
          : {}),
        ...(names(n.lazyLoaded).length ? { lazyLoaded: names(n.lazyLoaded) } : {}),
      },
    ];
  });
}

/** Validates a request from the middleware and redacts its URL and headers. */
export function sanitizeSsrRequest(raw: unknown): SsrRequest | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as { [K in keyof SsrRequest]?: unknown };
  if (!isSsrRequestId(r.id) || typeof r.url !== 'string') return undefined;
  const headers: Record<string, string> = {};
  if (r.headers && typeof r.headers === 'object') {
    for (const [name, value] of Object.entries(r.headers)) {
      if (KEPT_HEADERS.has(name) && typeof value === 'string') {
        headers[name] = name === 'location' ? redactUrl(value) : value.slice(0, 500);
      }
    }
  }
  const mode = r.renderMode;
  const navigations = sanitizeNavigations(r.navigations);
  return {
    id: r.id,
    method: typeof r.method === 'string' ? r.method.slice(0, 10) : 'GET',
    url: redactUrl(r.url),
    status: num(r.status),
    at: num(r.at),
    durationMs: num(r.durationMs),
    renderMs: num(r.renderMs),
    bytes: num(r.bytes),
    renderMode: mode === 'server' || mode === 'prerender' || mode === 'client' ? mode : 'unknown',
    fetches: num(r.fetches),
    fetchMs: num(r.fetchMs),
    headers,
    ...(navigations.length ? { navigations } : {}),
    ...(r.aborted === true ? { aborted: true } : {}),
  };
}

export function cacheNote(call: HttpCall): string {
  if (call.cacheStored) return 'stored in the transfer cache';
  return call.cacheSkip ? `not cached: ${CACHE_SKIP_TEXT[call.cacheSkip]}` : '';
}

/** The server call a browser call repeated. */
export function serverCallFor(call: HttpCall, serverCalls: HttpCall[]): HttpCall | undefined {
  const key = `${call.method} ${pathOf(call.url)}`;
  return serverCalls.find((c) => `${c.method} ${pathOf(c.url)}` === key);
}

function pathOf(url: string): string {
  try {
    const parsed = new URL(url, 'http://x');
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

export interface SsrRequestStory {
  request: SsrRequest;
  serverCalls: HttpCall[];
  page: HttpPage | undefined;
  /** Browser calls that repeated a server call instead of reading the transfer cache. */
  refetched: HttpCall[];
}

export function ssrRequestStory(
  request: SsrRequest,
  serverCalls: HttpCall[],
  pages: HttpPage[],
): SsrRequestStory {
  const own = serverCalls.filter((c) => c.requestId === request.id);
  const page = pages.find((p) => p.ssrRequestId === request.id);
  const fetched = new Set(own.filter((c) => c.status).map((c) => `${c.method} ${pathOf(c.url)}`));
  const refetched = (page?.calls ?? []).filter(
    (c) =>
      c.side === 'client' &&
      !c.cacheHit &&
      !c.mocked &&
      c.at >= request.at &&
      fetched.has(`${c.method} ${pathOf(c.url)}`),
  );
  return { request, serverCalls: own, page, refetched };
}

function ms(value: number): string {
  return `${value} ms`;
}

function size(bytes: number): string {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
}

function age(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  return seconds < 60 ? `${seconds}s ago` : `${Math.round(seconds / 60)}m ago`;
}

const NO_REQUESTS =
  'No SSR requests recorded. Add `app.use(devtools.ssrMiddleware)` before the Angular request handler in `server.ts`, then load a page. Prerendered pages served as static files are not traced.';

export function listSsrRequestsText(
  requests: SsrRequest[],
  pages: HttpPage[],
  args: { limit?: number },
  now = Date.now(),
): string {
  if (!requests.length) return NO_REQUESTS;
  const limit = Math.min(Math.max(Math.floor(args.limit ?? 20), 1), 100);
  const recent = [...requests].sort((a, b) => b.at - a.at).slice(0, limit);
  const rows = recent.map((r) => {
    const linked = pages.some((p) => p.ssrRequestId === r.id) ? 'yes' : 'no';
    return `| ${code(r.id)} | ${r.method} ${code(r.url)} | ${r.status}${r.aborted ? ' (aborted)' : ''} | ${MODE_LABEL[r.renderMode]} | ${ms(r.renderMs)} | ${r.fetches} (${ms(r.fetchMs)}) | ${linked} | ${age(r.at, now)} |`;
  });
  return capped(
    [
      UNTRUSTED,
      '',
      `${requests.length} SSR request${requests.length === 1 ? '' : 's'} recorded, newest first. Pass an id to \`explain-ssr-request\` for the full story.`,
      '',
      '| Id | Request | Status | Render mode | Render | Server calls | Page linked | When |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      ...rows,
    ].join('\n'),
  );
}

export function pickSsrRequest(
  requests: SsrRequest[],
  args: { id?: string; url?: string },
): SsrRequest | undefined {
  const newest = [...requests].sort((a, b) => b.at - a.at);
  if (args.id) return newest.find((r) => r.id === args.id);
  if (args.url) {
    const want = pathOf(args.url);
    return newest.find((r) => pathOf(r.url) === want);
  }
  return newest[0];
}

export function explainSsrRequestText(
  requests: SsrRequest[],
  serverCalls: HttpCall[],
  pages: HttpPage[],
  args: { id?: string; url?: string },
): string {
  if (!requests.length) return NO_REQUESTS;
  const request = pickSsrRequest(requests, args);
  if (!request) {
    return `No SSR request matches ${code(args.id ?? args.url ?? '')}. Call \`list-ssr-requests\` for the recorded ids.`;
  }
  const story = ssrRequestStory(request, serverCalls, pages);
  const r = story.request;
  const lines = [
    UNTRUSTED,
    '',
    `## ${r.method} ${code(r.url)}`,
    '',
    `- Id: ${code(r.id)}`,
    `- Status: ${r.status}${r.aborted ? ' (the connection closed before the response finished)' : ''}`,
    `- Render mode: ${MODE_LABEL[r.renderMode]}`,
    `- Render (arrival to headers): ${ms(r.renderMs)}; total ${ms(r.durationMs)}; ${size(r.bytes)} sent`,
    `- Server HttpClient calls: ${r.fetches}, ${ms(r.fetchMs)} in total`,
  ];
  const headers = Object.entries(r.headers);
  if (headers.length) {
    lines.push('', '### Response headers', ...headers.map(([k, v]) => `- ${k}: ${code(v)}`));
  }
  if (r.navigations?.length) {
    lines.push('', '### Router during the render');
    for (const n of r.navigations) {
      const parts = [
        `- ${code(n.url)}${n.finalUrl ? ` to ${code(n.finalUrl)}` : ''}: ${n.outcome}${n.durationMs !== undefined ? ` in ${ms(n.durationMs)}` : ''}`,
      ];
      if (n.guards) {
        parts.push(
          `  - Guards${n.guards.names.length ? ` ${n.guards.names.map(code).join(', ')}` : ''}: ${n.guards.passed === false ? (n.outcome === 'redirected' ? 'redirected' : 'rejected') : n.guards.passed ? 'passed' : 'ran'}${n.guards.ms !== undefined ? ` in ${ms(n.guards.ms)}` : ''}`,
        );
      }
      if (n.resolvers) {
        parts.push(
          `  - Resolvers${n.resolvers.names.length ? ` ${n.resolvers.names.map(code).join(', ')}` : ''}${n.resolvers.ms !== undefined ? `: ${ms(n.resolvers.ms)}` : ''}`,
        );
      }
      if (n.lazyLoaded) parts.push(`  - Lazy loaded: ${n.lazyLoaded.map(code).join(', ')}`);
      if (n.reason) parts.push(`  - Reason: ${code(n.reason)}`);
      lines.push(...parts);
    }
  }
  if (story.serverCalls.length) {
    lines.push(
      '',
      '### Server calls',
      ...story.serverCalls.map((c) => {
        const note = cacheNote(c);
        return `- ${c.method} ${code(c.url)}: ${c.status || 'ERR'} in ${ms(c.durationMs)}${c.faulted ? ' (faulted by a rule)' : ''}${c.mocked ? ' (mocked by a rule)' : ''}${c.error ? `, ${code(c.error)}` : ''}${note ? `; ${note}` : ''}`;
      }),
    );
  } else if (r.renderMode === 'server') {
    lines.push('', 'The render made no HttpClient calls through `withPangular()`.');
  }
  lines.push('', '### In the browser');
  if (!story.page) {
    lines.push(
      'No connected page reported this request id. The tab may be closed, the page may not load the overlay, or the response was not a document navigation.',
    );
  } else {
    const p = story.page;
    lines.push(`Page ${code(p.pageId)} (${code(p.url)}) loaded from this response.`);
    const h = p.hydration;
    if (h?.enabled) {
      lines.push(
        `- Hydration: ${h.nodes?.hydrated ?? h.hydratedNodes ?? 0} nodes hydrated, ${h.nodes?.mismatched ?? 0} mismatched, ${h.componentsSkippedHydration ?? h.nodes?.skipped ?? 0} skipped.`,
      );
      for (const m of h.mismatches.slice(0, 10)) {
        lines.push(`  - Mismatch in ${code(m.component)}`);
      }
      for (const w of h.warnings.slice(0, 5)) lines.push(`  - ${code(w)}`);
    } else if (r.renderMode === 'server' || r.renderMode === 'prerender') {
      lines.push(
        '- Hydration: not active. Add `provideClientHydration()` to reuse the server DOM.',
      );
    }
    if (story.refetched.length) {
      lines.push(
        `- ${story.refetched.length} call${story.refetched.length === 1 ? '' : 's'} ran again in the browser instead of reading the transfer cache:`,
        ...story.refetched.map((c) => {
          const server = serverCallFor(c, story.serverCalls);
          const why = server?.cacheSkip ? `: ${CACHE_SKIP_TEXT[server.cacheSkip]}` : '';
          return `  - ${c.method} ${code(c.url)}${why}`;
        }),
      );
      if (story.refetched.some((c) => !serverCallFor(c, story.serverCalls)?.cacheSkip)) {
        lines.push(
          '  The transfer cache skips non-GET requests unless `includePostRequests` is set, requests with `Authorization` or `Cookie` headers, `transferCache: false`, and anything the `filter` option rejects.',
        );
      }
    } else if (story.serverCalls.length) {
      lines.push('- No server call ran again in the browser.');
    }
  }
  return capped(lines.join('\n'));
}
