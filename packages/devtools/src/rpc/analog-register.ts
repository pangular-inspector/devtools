import {
  DEVTOOLS_HEADER,
  clearCalls,
  devOrigin,
  duplicateLoads,
  onCalls,
  recentCalls,
  refetchedServerFns,
  type AnalogCall,
} from '../analog-server-log.ts';
import { redactAnalogReport } from '../analog-redact.ts';
import type { PayloadSummary } from '../http-payload.ts';
import {
  explainUrl,
  scanAnalog,
  servedAnalogRoot,
  type AnalogProject,
  type AnalogServerFn,
} from './analog-scan.ts';
import {
  analogApiRoutesText,
  analogContentText,
  analogCurrentPageText,
  analogExplainUrlText,
  analogLint,
  analogLintText,
  analogPrerenderText,
  analogRenderModesText,
  analogRoutesText,
  analogServerCallsText,
  analogServerFnsText,
  isAnalogReport,
  mergeAnalogReport,
  prerenderPlan,
  renderRows,
  resolveAnalogReport,
  type AnalogState,
} from './analog-tools.ts';
import { fixedTtl, PAGE_TTL_MS, type PageTtl } from './page-ttl.ts';

type AnyRecord = Record<string, any>;

const SCAN_CACHE_MS = 2000;
const CALL_TIMEOUT_MS = 10_000;
const MAX_BODY = 2000;

let disposeAnalog: (() => void) | undefined;
let analogOwner: unknown;
let findServerFn: ((id: string) => AnalogServerFn | undefined) | undefined;

/** Adds the name and file of each Analog server function seeded into a TransferState payload. */
export function nameServerFns(payload: PayloadSummary): PayloadSummary {
  if (!findServerFn || !payload.entries.some((e) => e.fn)) return payload;
  const entries = payload.entries.map((entry) => {
    const fn = entry.fn && findServerFn?.(entry.fn.id);
    return fn ? { ...entry, fn: { id: fn.id, name: fn.name, file: fn.file } } : entry;
  });
  return { ...payload, entries };
}

interface Scoped {
  rpc: {
    register(definition: AnyRecord): void;
    sharedState(name: string, options: AnyRecord): Promise<AnyRecord>;
  };
}

interface AgentHost {
  cwd: string;
  agent: { registerTool(tool: AnyRecord): void };
}

export interface ApiRequest {
  method?: string;
  path: string;
  body?: unknown;
  confirm?: boolean;
}

export async function callApi(request: ApiRequest, origin = devOrigin()): Promise<AnyRecord> {
  const method = (request.method ?? 'GET').toUpperCase();
  if (!/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(method)) {
    return { ok: false, error: `Unsupported method ${method}.` };
  }
  if (
    typeof request.path !== 'string' ||
    !request.path.startsWith('/') ||
    request.path.startsWith('//') ||
    request.path.length > 2000
  ) {
    return { ok: false, error: 'Pass a path that starts with /, for example /api/v1/hello.' };
  }
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && request.confirm !== true) {
    return { ok: false, error: `${method} can change data; call again with confirm: true.` };
  }
  if (!origin) {
    return {
      ok: false,
      error:
        'The dev server address is unknown. This works only through the pangular() Vite plugin.',
    };
  }
  const started = performance.now();
  try {
    const response = await fetch(`${origin}${request.path}`, {
      method,
      headers: {
        [DEVTOOLS_HEADER]: '1',
        ...(request.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      redirect: 'manual',
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      ms: Math.round(performance.now() - started),
      type: response.headers.get('content-type') ?? '',
      body: text.length > MAX_BODY ? `${text.slice(0, MAX_BODY)}…` : text,
    };
  } catch (error) {
    return { ok: false, error: String((error as Error)?.message ?? error) };
  }
}

export function stopAnalog(owner?: unknown) {
  if (owner !== undefined && owner !== analogOwner) return;
  disposeAnalog?.();
  disposeAnalog = undefined;
  analogOwner = undefined;
}

export async function registerAnalog(
  my: Scoped,
  ctx: AgentHost,
  options: { blockCalls?: string; owner?: unknown; ttl?: PageTtl } = {},
) {
  disposeAnalog?.();
  const ttl = options.ttl ?? fixedTtl(PAGE_TTL_MS);
  analogOwner = options.owner;
  const sendApi = (request: ApiRequest): Promise<AnyRecord> =>
    options.blockCalls ? Promise.resolve({ error: options.blockCalls }) : callApi(request);
  const state = await my.rpc.sharedState('analog', {
    initialValue: {
      pages: [],
      calls: [],
      duplicates: [],
      refetches: [],
      reportedAt: 0,
    } as AnalogState,
  });
  const current = () => state['value']() as AnalogState;
  const apply = (next: AnalogState) =>
    state['mutate']((draft: AnalogState) => {
      draft.pages = next.pages;
      draft.calls = next.calls;
      draft.duplicates = next.duplicates;
      draft.refetches = next.refetches ?? [];
      draft.reportedAt = next.reportedAt;
    });
  const withCalls = (calls: AnalogCall[]) =>
    apply({
      ...current(),
      calls,
      duplicates: duplicateLoads(calls),
      refetches: refetchedServerFns(calls),
    });
  withCalls(recentCalls());
  const stopCalls = onCalls(withCalls);

  const seenAt = new Map<string, number>();
  const dropPages = (ids: string[]) => {
    if (!ids.length) return;
    for (const id of ids) seenAt.delete(id);
    const now = current();
    apply({ ...now, pages: now.pages.filter((p) => !ids.includes(p.pageId)) });
  };
  const expiry = setInterval(() => {
    const now = Date.now();
    dropPages(
      current()
        .pages.map((p) => p.pageId)
        .filter((id) => now - (seenAt.get(id) ?? 0) > ttl(id)),
    );
  }, 5000);
  expiry.unref?.();
  disposeAnalog = () => {
    clearInterval(expiry);
    stopCalls();
    findServerFn = undefined;
  };

  let cache: { at: number; project: AnalogProject } | null = null;
  const project = () => {
    if (!cache || Date.now() - cache.at > SCAN_CACHE_MS) {
      cache = { at: Date.now(), project: scanAnalog(servedAnalogRoot(ctx.cwd)) };
    }
    return cache.project;
  };
  findServerFn = (id) => project().serverFns.find((fn) => fn.id === id);

  my.rpc.register({
    name: 'push-analog',
    type: 'action',
    jsonSerializable: true,
    handler: (report: unknown) => {
      if (!isAnalogReport(report)) return;
      seenAt.set(report.pageId, Date.now());
      apply(
        mergeAnalogReport(current(), resolveAnalogReport(project(), redactAnalogReport(report))),
      );
    },
  });
  my.rpc.register({
    name: 'forget-analog-page',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      if (typeof pageId === 'string') dropPages([pageId]);
    },
  });
  my.rpc.register({
    name: 'analog-clear-calls',
    type: 'action',
    jsonSerializable: true,
    handler: () => clearCalls(),
  });
  my.rpc.register({
    name: 'analog-project',
    type: 'query',
    jsonSerializable: true,
    handler: () => project(),
  });
  my.rpc.register({
    name: 'analog-explain-url',
    type: 'query',
    jsonSerializable: true,
    handler: (url: unknown) =>
      typeof url === 'string' ? explainUrl(project().routes, url.slice(0, 2000)) : null,
  });
  my.rpc.register({
    name: 'analog-lint',
    type: 'query',
    jsonSerializable: true,
    handler: () => analogLint(project(), current()),
  });
  my.rpc.register({
    name: 'analog-render',
    type: 'query',
    jsonSerializable: true,
    handler: () => ({ rows: renderRows(project(), current()), plan: prerenderPlan(project()) }),
  });
  my.rpc.register({
    name: 'analog-text',
    type: 'query',
    jsonSerializable: true,
    handler: (kind: unknown) => {
      const p = project();
      if (kind === 'render') return analogRenderModesText(p, current());
      if (kind === 'prerender') return analogPrerenderText(p);
      if (kind === 'page') return analogCurrentPageText(p, current());
      return '';
    },
  });
  my.rpc.register({
    name: 'analog-call-api',
    type: 'action',
    jsonSerializable: true,
    handler: (request: unknown) =>
      request && typeof request === 'object'
        ? sendApi(request as ApiRequest)
        : { ok: false, error: 'Bad request.' },
  });

  const page = { type: 'string', description: 'Page id when several tabs are connected.' };
  const text = (markdown: string) => ({ markdown });

  ctx.agent.registerTool({
    id: 'pangular:analog-routes',
    description:
      'List the Analog file-based routes in match order: URL pattern, page or layout file, route groups, [param] and catch-all segments, sibling .server.ts (load/action), routeMeta keys and titles. Pass `filter` to narrow by path or file.',
    safety: 'read',
    inputSchema: { type: 'object', properties: { filter: { type: 'string' } } },
    handler: async (args: { filter?: string }) => text(analogRoutesText(project(), args?.filter)),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-explain-url',
    description:
      'Explain which Analog files render a URL (layout chain, page, .server.ts load and its endpoint), the params, or why nothing matches with the closest candidates.',
    safety: 'read',
    inputSchema: { type: 'object', required: ['url'], properties: { url: { type: 'string' } } },
    handler: async (args: { url?: string }) =>
      text(
        typeof args?.url === 'string'
          ? analogExplainUrlText(project(), args.url, current())
          : 'Pass a url.',
      ),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-current-page',
    description:
      'The Analog page open in the browser: its files (layouts first), load() data it received, server rendering and hydration state, hydration errors, and page files the running router does not know yet (restart needed).',
    safety: 'read',
    inputSchema: { type: 'object', properties: { page } },
    handler: async (args: { page?: string }) =>
      text(analogCurrentPageText(project(), current(), args?.page)),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-server-calls',
    description:
      'Recent server calls seen by the dev server: page renders (with render mode), load() fetches (GET /_analog/pages), form action submissions (other methods on /_analog/pages, with success, redirect or validation error outcome), server functions by name (including reads that ran during server rendering, seen through their TransferState seed) and API routes, with status, time, size, who called (ssr or browser) and a redacted response preview. Flags load() fetched twice and seeded server function reads called again in the browser.',
    safety: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['page', 'load', 'action', 'fn', 'api'] },
        route: { type: 'string' },
        limit: { type: 'number' },
      },
    },
    handler: async (args: { kind?: string; route?: string; limit?: number }) =>
      text(analogServerCallsText(current(), args ?? {}, project().serverFns)),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-server-functions',
    description:
      'List Analog server functions (serverFn exports in src/**/*.server.ts) with name, HTTP method, file and the id Analog routes them under (/_analog/fn/<id>), how often each was called over HTTP and during server rendering, and reads called again in the browser right after hydration. Empty when no .server.ts file exports serverFn.',
    safety: 'read',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => text(analogServerFnsText(project(), current())),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-api-routes',
    description:
      'List Analog/Nitro server routes under src/server/routes with method, URL and file, plus server middleware.',
    safety: 'read',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => text(analogApiRoutesText(project())),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-call-api',
    description:
      'Send a request to a route on the running dev server (for example GET /api/v1/hello) and return status, time and body. Methods other than GET, HEAD and OPTIONS need confirm: true.',
    safety: 'action',
    inputSchema: {
      type: 'object',
      required: ['path'],
      properties: {
        path: { type: 'string' },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
        },
        body: { description: 'JSON body.' },
        confirm: { type: 'boolean' },
      },
    },
    handler: async (args: ApiRequest) => {
      const result = await sendApi(args ?? { path: '' });
      if (result['error']) return text(`Refused: ${result['error']}`);
      return text(
        `${args.method ?? 'GET'} ${args.path}: ${result['status']} in ${result['ms']}ms (${result['type'] || 'no content type'})\n\n${result['body']}`,
      );
    },
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-render-modes',
    description:
      'For each Analog page: how it is rendered (server rendered per request, prerendered, cached, redirected or client only) with the routeRules entry, prerender.routes or build output that decides it, and what the last request to that page (including dynamic and catch-all URLs) actually did.',
    safety: 'read',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => text(analogRenderModesText(project(), current())),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-prerender-plan',
    description:
      'Compare prerender.routes with the page files and the build output: static pages left out, dynamic pages that need explicit entries, and listed routes missing from dist.',
    safety: 'read',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => text(analogPrerenderText(project())),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-content',
    description:
      'List markdown content files with slug, frontmatter, the route that serves them and parse errors. Pass `filter` to narrow.',
    safety: 'read',
    inputSchema: { type: 'object', properties: { filter: { type: 'string' } } },
    handler: async (args: { filter?: string }) => text(analogContentText(project(), args?.filter)),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-lint',
    description:
      'Analog checks: two files for one URL, sibling [param] files, missing default export, layout without router-outlet, .server.ts without load, action or server functions, or without a page, redirect mistakes, bad API method suffix, duplicate API routes, routes outside the API prefix, prerender entries that match nothing, frontmatter errors, duplicate slugs, plus live problems (load fetched twice, seeded server function read called again, hydration errors, restart needed, API 404/405).',
    safety: 'read',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => text(analogLintText(project(), current())),
  });
}
