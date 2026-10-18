import {
  DEVTOOLS_HEADER,
  clearCalls,
  devOrigin,
  duplicateLoads,
  onCalls,
  recentCalls,
  redactBody,
  refetchedServerFns,
  type AnalogCall,
} from '../analog-server-log.ts';
import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
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
  UNTRUSTED,
} from './analog-tools.ts';
import type { PageOwners } from './page-owners.ts';
import { fixedTtl, PAGE_TTL_MS, type PageTtl } from './page-ttl.ts';
import { refusal } from './refusal.ts';

type AnyRecord = Record<string, any>;

const SCAN_CACHE_MS = 2000;
const CALL_TIMEOUT_MS = 10_000;
const MAX_BODY = 2000;

let disposeAnalog: (() => void) | undefined;
let analogOwner: unknown;
let findServerFn: ((id: string) => AnalogServerFn | undefined) | undefined;
let reportingPages: (() => { pageId: string; reportedAt: number }[]) | undefined;

/** The pages that sent an Analog report, for `list-pages`. */
export function analogPages(): { pageId: string; reportedAt: number }[] {
  return reportingPages?.() ?? [];
}

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

/** Query flags that make Vite serve a module or file instead of the app's response. */
const VITE_QUERY_FLAGS = new Set([
  'raw',
  'url',
  'import',
  'inline',
  'worker',
  'sharedworker',
  'html-proxy',
  'direct',
]);

function matchesApiPattern(pattern: string, path: string): boolean {
  const want = pattern.split('/').filter(Boolean);
  const got = path.split('/').filter(Boolean);
  for (let i = 0; i < want.length; i++) {
    if (want[i] === '**') return got.length > i;
    if (got[i] === undefined) return false;
    if (!want[i].startsWith(':') && want[i] !== got[i]) return false;
  }
  return got.length === want.length;
}

/** Whether the path names a file or folder in the project, which Vite would serve as source. */
function namesProjectFile(root: string, path: string): boolean {
  if (path === '/') return false;
  const full = join(root, path);
  if (existsSync(full)) return true;
  try {
    const name = basename(full);
    return readdirSync(dirname(full)).some((entry) => entry.startsWith(`${name}.`));
  } catch {
    return false;
  }
}

/**
 * Why `analog-run-api` refuses a path, or `undefined` when the path is an API route, an
 * `/_analog` URL or a page of the app. Vite internals (`/@fs/`, `/@id/`), `?raw` and other
 * Vite query flags, and paths that name a project file are refused, so the tool can't read
 * source or files outside the app.
 */
export function apiPathRefusal(
  path: string,
  project: Pick<AnalogProject, 'root' | 'routes' | 'api' | 'config'>,
): string | undefined {
  const base = 'http://dev.invalid';
  let url: URL;
  let pathname: string;
  try {
    url = new URL(path, base);
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return 'The path is not a valid URL path.';
  }
  const rawPath = path.split(/[?#]/)[0];
  if (url.origin !== base || /[\\\0]/.test(rawPath) || /[\\\0]/.test(pathname)) {
    return 'Pass a path on the dev server, for example /api/v1/hello.';
  }
  const segments = [...rawPath.split('/'), ...pathname.split('/')];
  if (segments.some((segment) => /^(\.|%2e){1,2}$/i.test(segment))) {
    return 'The path may not contain . or .. segments.';
  }
  const first = pathname.split('/')[1] ?? '';
  if (first.startsWith('@') || first.startsWith('__') || first === 'node_modules') {
    return `${pathname} is a dev server internal, not an API route or page.`;
  }
  const flag = [...url.searchParams.keys()].find((key) => VITE_QUERY_FLAGS.has(key));
  if (flag) return `The ?${flag} query makes Vite serve a file, so it is not allowed.`;
  if (namesProjectFile(project.root, pathname)) {
    return `${pathname} names a file in the project, not an API route or page.`;
  }
  const prefix = project.config.apiPrefix.replace(/^\/+|\/+$/g, '');
  const under = (dir: string) => pathname === `/${dir}` || pathname.startsWith(`/${dir}/`);
  if (prefix && under(prefix)) return undefined;
  if (under('_analog')) return undefined;
  if (project.api.some((route) => matchesApiPattern(route.path, pathname))) return undefined;
  if (explainUrl(project.routes, pathname).matched) return undefined;
  return `${pathname} is not an API route, an /_analog URL or a page of this app.`;
}

export async function callApi(
  request: ApiRequest,
  origin = devOrigin(),
  refuse: (path: string) => string | undefined = () => undefined,
): Promise<AnyRecord> {
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
  const refusal = refuse(request.path);
  if (refusal) return { ok: false, error: refusal };
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
    const text = redactBody(await response.text());
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
  options: { blockCalls?: string; owner?: unknown; ttl?: PageTtl; owners?: PageOwners } = {},
) {
  disposeAnalog?.();
  const ttl = options.ttl ?? fixedTtl(PAGE_TTL_MS);
  analogOwner = options.owner;
  const sendApi = (request: ApiRequest): Promise<AnyRecord> =>
    options.blockCalls
      ? Promise.resolve({ error: options.blockCalls })
      : callApi(request, devOrigin(), (path) => apiPathRefusal(path, project()));
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
    reportingPages = undefined;
  };
  reportingPages = () =>
    current().pages.map((p) => ({ pageId: p.pageId, reportedAt: seenAt.get(p.pageId) ?? 0 }));

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
      if (options.owners && !options.owners.write(report.pageId)) return;
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
      if (typeof pageId !== 'string') return;
      if (options.owners && !options.owners.forget(pageId)) return;
      dropPages([pageId]);
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
    handler: (page: unknown) =>
      analogLint(project(), current(), typeof page === 'string' ? page : undefined),
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
    id: 'pangular:analog-scan-routes',
    title: 'List Analog routes',
    description:
      'List the Analog file-based routes in match order: URL pattern, page or layout file, route groups, [param] and catch-all segments, sibling .server.ts (load/action), routeMeta keys and titles. Pass `filter` to narrow by path or file.',
    inputSchema: { type: 'object', properties: { filter: { type: 'string' } } },
    handler: async (args: { filter?: string }) => text(analogRoutesText(project(), args?.filter)),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-scan-url',
    title: 'Explain an Analog URL',
    description:
      'Explain which Analog files render a URL (layout chain, page, .server.ts load and its endpoint), the params, or why nothing matches with the closest candidates.',
    inputSchema: { type: 'object', required: ['url'], properties: { url: { type: 'string' } } },
    handler: async (args: { url?: string }) =>
      text(
        typeof args?.url === 'string'
          ? analogExplainUrlText(project(), args.url, current())
          : 'Pass a url.',
      ),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-inspect-page',
    title: 'Show the current Analog page',
    description:
      'The Analog page open in the browser: its files (layouts first), load() data it received, server rendering and hydration state, hydration errors, and page files the running router does not know yet (restart needed).',
    inputSchema: { type: 'object', properties: { page } },
    handler: async (args: { page?: string }) =>
      text(analogCurrentPageText(project(), current(), args?.page)),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-list-server-calls',
    title: 'List Analog server calls',
    description:
      'Recent Analog server calls: page renders, load() fetches, form actions, server functions and API routes, with status, time, size, caller and a masked preview. Flags load() fetched twice and server reads repeated in the browser.',
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
    id: 'pangular:analog-scan-server-functions',
    title: 'List Analog server functions',
    description:
      'Analog server functions (serverFn in *.server.ts): name, method, file, route id, call counts over HTTP and during SSR, and reads repeated after hydration.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => text(analogServerFnsText(project(), current())),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-scan-api-routes',
    title: 'List Analog API routes',
    description:
      'List Analog/Nitro server routes under src/server/routes with method, URL and file, plus server middleware.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => text(analogApiRoutesText(project())),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-run-api',
    title: 'Call an Analog API route',
    description:
      'Send a request to a route on the running dev server (for example GET /api/v1/hello) and return status, time and body. Methods other than GET, HEAD and OPTIONS need confirm: true.',
    inputSchema: {
      type: 'object',
      required: ['path'],
      properties: {
        path: {
          type: 'string',
          description:
            'Path on the dev server, starting with a single /, with an optional query string, e.g. /api/v1/hello?id=1. Not a full URL: the request always goes to the dev server.',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
          description: 'HTTP method. Defaults to GET.',
        },
        body: { description: 'Request body, sent as JSON with content-type application/json.' },
        confirm: {
          type: 'boolean',
          description:
            'Must be true for POST, PUT, PATCH and DELETE, which can change data. Not needed for GET, HEAD and OPTIONS.',
        },
      },
    },
    handler: async (args: ApiRequest) => {
      const result = await sendApi(args ?? { path: '' });
      if (result['error']) return text(refusal(`Refused: ${result['error']}`));
      // The response body comes from the dev server's routes, so it sits behind the notice.
      return text(
        `${UNTRUSTED}\n\n${args.method ?? 'GET'} ${args.path}: ${result['status']} in ${result['ms']}ms (${result['type'] || 'no content type'})\n\n${result['body']}`,
      );
    },
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-explain-render-modes',
    title: 'Show Analog render modes',
    description:
      'How each Analog page is rendered (SSR, prerendered, cached, redirected or client only), the config that decides it, and what the last request did.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => text(analogRenderModesText(project(), current())),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-scan-prerender',
    title: 'Check the Analog prerender plan',
    description:
      'Compare prerender.routes with the page files and the build output: static pages left out, dynamic pages that need explicit entries, and listed routes missing from dist. Ends with a "Config read in part" note when vite.config could not be read in full.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => text(analogPrerenderText(project())),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-scan-content',
    title: 'List Analog content files',
    description:
      'List markdown content files with slug, frontmatter, the route that serves them and parse errors. Pass `filter` to narrow.',
    inputSchema: { type: 'object', properties: { filter: { type: 'string' } } },
    handler: async (args: { filter?: string }) => text(analogContentText(project(), args?.filter)),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-lint',
    title: 'Lint the Analog project',
    description:
      'Analog checks: conflicting page files, missing exports, layouts without router-outlet, server file mistakes, API route issues, prerender entries matching nothing, content frontmatter, plus live problems from the default page.',
    inputSchema: { type: 'object', properties: { page } },
    handler: async (args: { page?: string }) =>
      text(analogLintText(project(), current(), args?.page)),
  });
}
