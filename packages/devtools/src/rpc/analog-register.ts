import {
  DEVTOOLS_HEADER,
  bindRenderCalls,
  clearCalls,
  dropCalls,
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
import { redactHeaders, redactStrings } from '../http-redact.ts';
import { forgetRenders, setPagesAtPath } from '../analog-call-pages.ts';
import type { PayloadSummary } from '../http-payload.ts';
import {
  analogWorkspace,
  explainUrl,
  flattenRoutes,
  scanAnalog,
  servedAnalogRoot,
  type AnalogProject,
  type AnalogServerFn,
} from './analog-scan.ts';
import { analogBuildText, analyzeBuild } from './analog-build.ts';
import { contentPreview, loadContentSchema } from './analog-content.ts';
import { nitroInternals, nitroText, purgeNitroCache, runNitroTask } from './analog-nitro.ts';
import { checkRenderMode } from './analog-render-check.ts';
import { runtimeConfigText, runtimeConfigView } from './analog-runtime-config.ts';
import { traceTransform, type TransformTrace } from '../analog-transform.ts';
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
import { LOAD_DATA_EVENT, LOAD_DATA_RESULT, type AnalogRuntimeReport } from '../analog-runtime.ts';
import { createScanCache } from './analog-scan-cache.ts';
import { defaultPage } from './default-page.ts';
import type { PageOwners } from './page-owners.ts';
import { fixedTtl, PAGE_TTL_MS, type PageTtl } from './page-ttl.ts';
import { refusal } from './refusal.ts';

type AnyRecord = Record<string, any>;

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
    broadcast?(message: { method: string; args: unknown[]; optional?: boolean }): unknown;
  };
}

const LOAD_DATA_TIMEOUT_MS = 4000;

export interface LoadDataAnswer {
  found: boolean;
  value?: unknown;
  bytes?: number;
  error?: string;
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
  /** Extra request headers. Hop-by-hop headers, `host` and the devtools header are dropped. */
  headers?: Record<string, string>;
  /** Cookies to send, joined into one `cookie` header. */
  cookies?: Record<string, string>;
}

const MAX_REQUEST_HEADERS = 30;
const MAX_REQUEST_HEADER_VALUE = 4000;
/** Headers the playground may not set: fetch or the dev server owns them. */
const BLOCKED_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'keep-alive',
  'upgrade',
  'te',
  'trailer',
  'proxy-connection',
  'expect',
  DEVTOOLS_HEADER,
]);
const HEADER_NAME = /^[\w!#$%&'*+.^`|~-]{1,100}$/;
const COOKIE_NAME = /^[\w!#$%&'*+.^`|~-]{1,200}$/;

/**
 * The request headers `callApi` sends for `headers` and `cookies`, or why it
 * refuses them. Values with line breaks are refused, so a header can't smuggle another.
 */
export function requestHeaders(
  request: Pick<ApiRequest, 'headers' | 'cookies'>,
): { headers: Record<string, string> } | { error: string } {
  const headers: Record<string, string> = {};
  const entries = Object.entries(
    request.headers && typeof request.headers === 'object' ? request.headers : {},
  );
  if (entries.length > MAX_REQUEST_HEADERS) {
    return { error: `Send at most ${MAX_REQUEST_HEADERS} headers.` };
  }
  for (const [rawName, value] of entries) {
    const name = rawName.trim().toLowerCase();
    if (!HEADER_NAME.test(name)) return { error: `${rawName.slice(0, 60)} is not a header name.` };
    if (typeof value !== 'string' || /[\r\n\0]/.test(value)) {
      return { error: `The ${name} header needs a one-line text value.` };
    }
    if (value.length > MAX_REQUEST_HEADER_VALUE)
      return { error: `The ${name} header is too long.` };
    if (BLOCKED_REQUEST_HEADERS.has(name)) {
      return { error: `The ${name} header is set by the dev server or fetch, not the playground.` };
    }
    headers[name] = value;
  }
  const cookies = Object.entries(
    request.cookies && typeof request.cookies === 'object' ? request.cookies : {},
  );
  if (cookies.length) {
    const parts: string[] = [];
    for (const [name, value] of cookies.slice(0, MAX_REQUEST_HEADERS)) {
      if (!COOKIE_NAME.test(name)) return { error: `${name.slice(0, 60)} is not a cookie name.` };
      if (typeof value !== 'string' || /[\r\n\0;]/.test(value)) {
        return { error: `The ${name} cookie needs a value without ; or line breaks.` };
      }
      parts.push(`${name}=${value}`);
    }
    const joined = [headers['cookie'], ...parts].filter(Boolean).join('; ');
    if (joined.length > MAX_REQUEST_HEADER_VALUE) return { error: 'The cookies are too long.' };
    headers['cookie'] = joined;
  }
  return { headers };
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
  const extra = requestHeaders(request);
  if ('error' in extra) return { ok: false, error: extra.error };
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
        ...(request.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...extra.headers,
        [DEVTOOLS_HEADER]: '1',
      },
      body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      redirect: 'manual',
    });
    // Time to the response headers, then the whole body.
    const headersMs = Math.round(performance.now() - started);
    const raw = await response.text();
    const text = redactBody(raw);
    return {
      ok: response.ok,
      status: response.status,
      ms: Math.round(performance.now() - started),
      headersMs,
      type: response.headers.get('content-type') ?? '',
      headers: redactHeaders(Object.fromEntries(response.headers)),
      size: Buffer.byteLength(raw),
      body: text.length > MAX_BODY ? `${text.slice(0, MAX_BODY)}…` : text,
    };
  } catch (error) {
    return { ok: false, error: String((error as Error)?.message ?? error) };
  }
}

const MAX_LOAD_VALUE = 200_000;
/** Most characters of the load() JSON an agent answer shows, like other tool answers. */
export const MAX_LOAD_ANSWER_CHARS = 20_000;

/**
 * The full load() value for an agent answer. JSON past {@link MAX_LOAD_ANSWER_CHARS}
 * is cut, and a line after the block says so, so a cut answer is never read as whole JSON.
 */
export function loadValueText(value: unknown): string {
  const json = JSON.stringify(value, null, 2) ?? 'undefined';
  if (json.length <= MAX_LOAD_ANSWER_CHARS)
    return `### Full load() value\n\n\`\`\`json\n${json}\n\`\`\``;
  return `### Full load() value\n\n\`\`\`text\n${json.slice(0, MAX_LOAD_ANSWER_CHARS)}\n\`\`\`\n\nTruncated: the value is ${json.length.toLocaleString('en-US')} characters of JSON and this shows the first ${MAX_LOAD_ANSWER_CHARS.toLocaleString('en-US')}, so it is not valid JSON. The Data view in the Analog tab shows all of it.`;
}

/** Masks strings in a load() value from the page again and caps its size. */
export function redactLoadValue(value: unknown): unknown {
  const masked = redactStrings(value);
  const text = JSON.stringify(masked) ?? '';
  return text.length > MAX_LOAD_VALUE ? `${text.slice(0, MAX_LOAD_VALUE)}…` : masked;
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
  options: {
    blockCalls?: string;
    owner?: unknown;
    ttl?: PageTtl;
    owners?: PageOwners;
    rules?: Record<string, boolean>;
    /** `analog.contentSchema` from the devtools config. */
    contentSchema?: string;
  } = {},
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
    for (const id of ids) {
      seenAt.delete(id);
      reports.delete(id);
    }
    const now = current();
    apply({ ...now, pages: now.pages.filter((p) => !ids.includes(p.pageId)) });
    // A page's calls leave with it.
    forgetRenders(ids);
    dropCalls((call) => !!call.pageId && ids.includes(call.pageId));
  };
  const expiry = setInterval(() => {
    const now = Date.now();
    dropPages(
      current()
        .pages.map((p) => p.pageId)
        .filter((id) => now - (seenAt.get(id) ?? 0) > ttl(id)),
    );
    // Calls tagged with a page that never reported Analog data expire on the same clock.
    const live = new Set(current().pages.map((p) => p.pageId));
    dropCalls(
      (call) => !!call.pageId && !live.has(call.pageId) && now - call.at > ttl(call.pageId),
    );
  }, 5000);
  setPagesAtPath((path) =>
    current()
      .pages.filter((p) => p.url.split(/[?#]/)[0] === path)
      .map((p) => p.pageId),
  );
  expiry.unref?.();
  disposeAnalog = () => {
    clearInterval(expiry);
    stopCalls();
    stopRefresh();
    scans.dispose();
    setPagesAtPath(undefined);
    findServerFn = undefined;
    reportingPages = undefined;
  };
  reportingPages = () =>
    current().pages.map((p) => ({ pageId: p.pageId, reportedAt: seenAt.get(p.pageId) ?? 0 }));

  // The scan is kept until a file it reads changes. Queries and tools read it fresh;
  // pushes take the last one and the rescan runs on a later tick.
  const scans = createScanCache(() =>
    scanAnalog(servedAnalogRoot(ctx.cwd), { contentSchema: options.contentSchema }),
  );
  const project = () => scans.get();
  /** Each page's last report before it was checked against the project, to check it again after a rescan. */
  const reports = new Map<string, AnalogRuntimeReport>();
  const stopRefresh = scans.onRefresh((next) => {
    const now = current();
    const pages = now.pages.map((p) => {
      const report = reports.get(p.pageId);
      return report ? resolveAnalogReport(next, report) : p;
    });
    apply({ ...now, pages });
  });
  findServerFn = (id) => scans.peek().serverFns.find((fn) => fn.id === id);

  my.rpc.register({
    name: 'push-analog',
    type: 'action',
    jsonSerializable: true,
    handler: (report: unknown) => {
      if (!isAnalogReport(report)) return;
      if (options.owners && !options.owners.write(report.pageId)) return;
      seenAt.set(report.pageId, Date.now());
      const redacted = redactAnalogReport(report);
      reports.set(report.pageId, redacted);
      apply(mergeAnalogReport(current(), resolveAnalogReport(scans.peek(), redacted)));
      const kept = new Set(current().pages.map((p) => p.pageId));
      for (const id of reports.keys()) if (!kept.has(id)) reports.delete(id);
      if (report.renderId) bindRenderCalls(report.renderId, report.pageId);
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
      analogLint(project(), current(), typeof page === 'string' ? page : undefined, {
        rules: options.rules,
      }),
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

  /** Project files a transform trace may name: page, layout, server and content files. */
  const traceable = (file: string) => {
    const p = project();
    return (
      p.files.includes(file) ||
      p.serverFiles.includes(file) ||
      p.serverFns.some((fn) => fn.file === file) ||
      flattenRoutes(p.routes).some((r) => r.file === file || r.serverFile === file)
    );
  };
  const trace = async (file: unknown, ssr: unknown): Promise<TransformTrace> => {
    const name = typeof file === 'string' ? file.slice(0, 500) : '';
    if (!name || !traceable(name)) {
      return {
        file: name,
        ssr: ssr === true,
        steps: [],
        code: '',
        error:
          'Pass a page, layout or .server.ts file of the project, as the Routes view lists it.',
      };
    }
    return traceTransform(name, ssr === true);
  };
  const purge = (files: unknown, confirm: unknown) => {
    if (options.blockCalls) return { ok: false, removed: 0, error: options.blockCalls };
    if (confirm !== true) {
      return {
        ok: false,
        removed: 0,
        error: 'Purging deletes cache entries; call again with confirm: true.',
      };
    }
    if (files !== undefined && !Array.isArray(files)) {
      return { ok: false, removed: 0, error: 'Pass entry paths as a list of strings.' };
    }
    return purgeNitroCache(project(), files as string[] | undefined);
  };
  const runTask = async (name: unknown, payload: unknown, confirm: unknown) => {
    const task = typeof name === 'string' ? name.slice(0, 100) : '';
    if (options.blockCalls) return { ok: false, name: task, error: options.blockCalls };
    if (confirm !== true) {
      return {
        ok: false,
        name: task,
        error: 'A task can change data; call again with confirm: true.',
      };
    }
    return runNitroTask(project(), name, payload, devOrigin());
  };
  const pagePaths = () =>
    new Set(
      flattenRoutes(project().routes)
        .filter((r) => r.file && r.kind !== 'layout')
        .map((r) => r.fullPath),
    );

  // The full load() value of one page, asked for on demand.
  const loadRequests = new Map<string, { pageId: string; done: (a: LoadDataAnswer) => void }>();
  let loadSeq = 0;
  const loadData = (pageId: unknown): Promise<LoadDataAnswer> => {
    const pages = current().pages;
    const page =
      typeof pageId === 'string' && pageId
        ? pages.find((p) => p.pageId === pageId)
        : defaultPage(pages);
    if (!page) {
      return Promise.resolve({ found: false, error: 'No page sends Analog data right now.' });
    }
    if (!my.rpc.broadcast) {
      return Promise.resolve({ found: false, error: 'This server cannot ask the page.' });
    }
    return new Promise((resolve) => {
      const requestId = `load${++loadSeq}`;
      const timer = setTimeout(
        () => done({ found: false, error: 'The page did not answer in time.' }),
        LOAD_DATA_TIMEOUT_MS,
      );
      (timer as { unref?: () => void }).unref?.();
      const done = (answer: LoadDataAnswer) => {
        clearTimeout(timer);
        loadRequests.delete(requestId);
        resolve(answer);
      };
      loadRequests.set(requestId, { pageId: page.pageId, done });
      void my.rpc.broadcast!({
        method: LOAD_DATA_EVENT,
        args: [{ requestId, pageId: page.pageId }],
        optional: true,
      });
    });
  };
  my.rpc.register({
    name: LOAD_DATA_RESULT,
    type: 'action',
    jsonSerializable: true,
    handler: (message: unknown) => {
      if (!message || typeof message !== 'object') return;
      const { requestId, pageId, found, value, bytes } = message as Record<string, unknown>;
      const pending = typeof requestId === 'string' ? loadRequests.get(requestId) : undefined;
      if (!pending || pending.pageId !== pageId) return;
      if (options.owners && !options.owners.write(pending.pageId)) return;
      // The page serialized and masked the value; mask the text once more on the way out.
      pending.done({
        found: found === true,
        ...(found === true ? { value: redactLoadValue(value) } : {}),
        ...(typeof bytes === 'number' ? { bytes } : {}),
      });
    },
  });
  my.rpc.register({
    name: 'analog-load-data',
    type: 'query',
    jsonSerializable: true,
    handler: (pageId: unknown) => loadData(pageId),
  });
  my.rpc.register({
    name: 'analog-content-preview',
    type: 'query',
    jsonSerializable: true,
    handler: (file: unknown) => {
      const p = project();
      const schema = options.contentSchema
        ? loadContentSchema(p.root, options.contentSchema).schema
        : undefined;
      return contentPreview(p.root, typeof file === 'string' ? file.slice(0, 500) : '', schema);
    },
  });
  my.rpc.register({
    name: 'analog-transform',
    type: 'query',
    jsonSerializable: true,
    handler: (args: unknown) => {
      const request = (args && typeof args === 'object' ? args : {}) as {
        file?: unknown;
        ssr?: unknown;
      };
      return trace(request.file, request.ssr);
    },
  });
  my.rpc.register({
    name: 'analog-build',
    type: 'query',
    jsonSerializable: true,
    handler: () => {
      const p = project();
      return analyzeBuild(p, analogWorkspace(p.root));
    },
  });
  my.rpc.register({
    name: 'analog-nitro',
    type: 'query',
    jsonSerializable: true,
    handler: () => nitroInternals(project()),
  });
  my.rpc.register({
    name: 'analog-nitro-purge',
    type: 'action',
    jsonSerializable: true,
    handler: (args: unknown) => {
      const request = (args && typeof args === 'object' ? args : {}) as {
        files?: unknown;
        confirm?: unknown;
      };
      return purge(request.files, request.confirm);
    },
  });
  my.rpc.register({
    name: 'analog-run-nitro-task',
    type: 'action',
    jsonSerializable: true,
    handler: (args: unknown) => {
      const request = (args && typeof args === 'object' ? args : {}) as {
        name?: unknown;
        payload?: unknown;
        confirm?: unknown;
      };
      return runTask(request.name, request.payload, request.confirm);
    },
  });
  my.rpc.register({
    name: 'analog-runtime-config',
    type: 'query',
    jsonSerializable: true,
    handler: () => runtimeConfigView(project()),
  });
  my.rpc.register({
    name: 'analog-render-check',
    type: 'query',
    jsonSerializable: true,
    handler: (path: unknown) =>
      typeof path === 'string' && pagePaths().has(path)
        ? checkRenderMode(project(), path)
        : {
            path: String(path).slice(0, 200),
            headers: {},
            error: 'Pass a page route from the Render view.',
          },
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
      'The Analog page open in the browser: its files (layouts first, then pages in named outlets), load() data it received, server rendering and hydration state, hydration errors, and page files the running router does not know yet (restart needed).',
    inputSchema: {
      type: 'object',
      properties: {
        page,
        data: {
          type: 'boolean',
          description:
            'Also ask the page for the full load() value (masked, up to 200 KB) instead of the 1000-character preview. The answer shows the first 20,000 characters of its JSON and says when it cut it.',
        },
      },
    },
    handler: async (args: { page?: string; data?: boolean }) => {
      const summary = analogCurrentPageText(project(), current(), args?.page);
      if (args?.data !== true) return text(summary);
      const answer = await loadData(args.page);
      const full = answer.error
        ? `Full load() value: ${answer.error}`
        : answer.found
          ? loadValueText(answer.value)
          : 'The page has no load() data.';
      return text(`${summary}\n\n${UNTRUSTED}\n\n${full}`);
    },
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-list-server-calls',
    title: 'List Analog server calls',
    description:
      "Recent Analog server calls: page renders, load() fetches, form actions, server functions and API routes, with status, time, size, caller, the tab it came from when known, and a masked preview. Flags load() fetched twice and server reads repeated in the browser. Pass `page` for one tab's calls only.",
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['page', 'load', 'action', 'fn', 'api'] },
        route: { type: 'string' },
        limit: { type: 'number' },
        page: {
          type: 'string',
          description:
            'Page id (see pangular:list-pages): only the calls the dev server tied to that tab. Leave it out for every call, including those tied to no tab.',
        },
      },
    },
    handler: async (args: { kind?: string; route?: string; limit?: number; page?: string }) =>
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
        headers: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Extra request headers, such as {"accept-language": "de"}.',
        },
        cookies: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Cookies to send, by name.',
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
      text(analogLintText(project(), current(), args?.page, { rules: options.rules })),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-scan-build',
    title: 'Analyze the Analog build',
    description:
      'Read the last client build in dist/analog/public: total JS and CSS (raw and gzip), the entry chunk, the chunk each page compiles to with what it loads beyond the entry, its lazy chunks, and the largest chunks. Says to run analog build first when there is no build.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const p = project();
      return text(`${UNTRUSTED}\n\n${analogBuildText(analyzeBuild(p, analogWorkspace(p.root)))}`);
    },
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-scan-nitro',
    title: 'Show Nitro internals',
    description:
      'Nitro internals of the Analog app, from the project files: server plugins, tasks, storage mounts in vite.config, the routes cached by isr, swr or cache rules, and the cache entries Nitro wrote to disk (purge them with pangular:analog-purge-nitro-cache).',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => text(`${UNTRUSTED}\n\n${nitroText(nitroInternals(project()))}`),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-purge-nitro-cache',
    title: 'Purge the Nitro cache',
    description:
      'Delete Nitro cache entry files from disk, so cached (isr, swr, cache) routes render again on the next request. Pass `files` from pangular:analog-scan-nitro to delete some, or leave it out to delete every entry. Needs confirm: true and actions.analog.',
    inputSchema: {
      type: 'object',
      required: ['confirm'],
      properties: {
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Entry paths as pangular:analog-scan-nitro lists them. Leave out for all.',
        },
        confirm: { type: 'boolean', description: 'Must be true: the entries are deleted.' },
      },
    },
    handler: async (args: { files?: unknown; confirm?: unknown }) => {
      const result = purge(args?.files, args?.confirm);
      if (!result.ok) return text(refusal(`Refused: ${result.error}`));
      if (!result.removed) {
        return text(refusal('Nothing deleted: there are no Nitro cache entries on disk.'));
      }
      return text(
        `Deleted ${result.removed} Nitro cache entr${result.removed === 1 ? 'y' : 'ies'}. The next request to those routes renders them again.`,
      );
    },
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-run-nitro-task',
    title: 'Run a Nitro task',
    description:
      'Run a Nitro task from src/server/tasks on the dev server (POST /_nitro/tasks/<name>, which needs nitro.experimental.tasks) and return its masked answer. Tasks can change data, so it needs confirm: true and actions.analog. It stops waiting after 30 seconds.',
    inputSchema: {
      type: 'object',
      required: ['name', 'confirm'],
      properties: {
        name: {
          type: 'string',
          description: 'The task name as pangular:analog-scan-nitro lists it, e.g. db:migrate.',
        },
        payload: { type: 'object', description: 'The payload the task receives.' },
        confirm: { type: 'boolean', description: 'Must be true: the task runs for real.' },
      },
    },
    handler: async (args: { name?: unknown; payload?: unknown; confirm?: unknown }) => {
      const result = await runTask(args?.name, args?.payload, args?.confirm);
      if (!result.ok) {
        const detail = result.output ? `\n\n${UNTRUSTED}\n\n${result.output}` : '';
        return text(refusal(`Refused or failed: ${result.error}${detail}`));
      }
      return text(
        `${UNTRUSTED}\n\nTask ${result.name}: ${result.status} in ${result.ms} ms\n\n${result.output || '(no output)'}`,
      );
    },
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-scan-runtime-config',
    title: 'Show the Analog runtime config',
    description:
      'The import.meta.env keys (VITE_, ANALOG_), Nitro runtimeConfig from vite.config with NITRO_ env overrides, and the resolved analog() options. Secret names, tokens and redaction.secretNames are masked.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => text(`${UNTRUSTED}\n\n${runtimeConfigText(runtimeConfigView(project()))}`),
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-inspect-transform',
    title: 'Trace a Vite transform',
    description:
      'Transform a page, layout or .server.ts file again on the Vite dev server and list each plugin that changed it, in order, with the code it returned and the final code, so the .analog/.ag compile and the serverFn id rewrite can be seen. Pass `ssr: true` for the server build.',
    inputSchema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          description:
            'Project path as pangular:analog-scan-routes lists it, e.g. /src/app/pages/index.page.ts.',
        },
        ssr: {
          type: 'boolean',
          description: 'Trace the SSR transform instead of the browser one.',
        },
      },
    },
    handler: async (args: { file?: unknown; ssr?: unknown }) => {
      const result = await trace(args?.file, args?.ssr);
      if (result.error && !result.steps.length) return text(refusal(result.error));
      const steps = result.steps
        .filter((step) => step.changed)
        .map((step, i) => `${i + 1}. ${step.plugin} (${step.ms} ms, ${step.size} chars)`);
      const unchanged = result.steps.length - steps.length;
      const fns = project().serverFns.filter((fn) => fn.file === result.file);
      const ids = fns.map(
        (fn) =>
          `- ${fn.name}: id ${fn.id} ${result.code.includes(fn.id) ? 'is in the output' : 'is not in the output'}`,
      );
      return text(
        [
          UNTRUSTED,
          '',
          `## ${result.file} (${result.ssr ? 'SSR' : 'browser'})`,
          '',
          steps.length ? steps.join('\n') : 'No plugin changed the code.',
          unchanged ? `\n${unchanged} more plugins ran without a change.` : '',
          ids.length ? `\n### Server functions\n${ids.join('\n')}` : '',
          result.error ? `\nNote: ${result.error}` : '',
          '',
          '### Final code',
          '',
          '```js',
          result.code.slice(0, 6000),
          '```',
        ].join('\n'),
      );
    },
  });
  ctx.agent.registerTool({
    id: 'pangular:analog-inspect-render-mode',
    title: 'Check an Analog render mode',
    description:
      'Request a page route from the dev server with Accept: text/html and compare cache-control, x-nitro-prerender, x-analog-no-ssr and the HTML with the mode the config gives it. Dynamic segments get a sample value.',
    inputSchema: {
      type: 'object',
      required: ['path'],
      properties: {
        path: {
          type: 'string',
          description:
            'A page route as pangular:analog-explain-render-modes lists it, e.g. /products/:id.',
        },
      },
    },
    handler: async (args: { path?: unknown }) => {
      const path = typeof args?.path === 'string' ? args.path : '';
      if (!pagePaths().has(path)) return text(refusal('Pass a page route of the app, such as /.'));
      const check = await checkRenderMode(project(), path);
      if (check.error) return text(refusal(`Could not check ${path}: ${check.error}`));
      const headers = Object.entries(check.headers).map(([k, v]) => `- ${k}: ${v}`);
      return text(
        [
          UNTRUSTED,
          '',
          `## ${path}`,
          '',
          `Configured: ${check.configured} (${check.reason}). Observed: ${check.observed}, ${check.status} in ${check.ms} ms. ${check.matches ? 'Fits the config.' : 'Does not fit the config.'}`,
          check.note ? `\n${check.note}` : '',
          headers.length ? `\n${headers.join('\n')}` : '',
        ].join('\n'),
      );
    },
  });
}
