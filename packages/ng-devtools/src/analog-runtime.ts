import { keepaliveDue } from './change-detection.ts';
import { hasStateScript, scanHydration } from './http-hydration.ts';
import { isRedactedKey } from './forms-privacy.ts';
import { createHydrationScanner } from './http-overlay.ts';
import { httpRegistry } from './http-rules.ts';
import { findRouters, type RouterDebugApi } from './router.ts';

type AnyRecord = Record<string, any>;

export const ANALOG_META_DESCRIPTION = '@analogjs/router Analog Route Metadata Key';

export interface AnalogPageInfo {
  path: string;
  file?: string;
  serverFile?: string;
}

export interface AnalogRuntimeReport {
  pageId: string;
  url: string;
  analog: boolean;
  chain: AnalogPageInfo[];
  load?: { preview: string; bytes: number; keys: string[] };
  loadFrom?: number;
  serverContext?: string;
  hydrated: number;
  transferState: boolean;
  hydrationErrors: string[];
  configPaths: string[];
}

const MAX_PREVIEW = 1000;
const MAX_PATHS = 500;
const MAX_ERRORS = 20;

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function analogMetaOf(route: unknown): { endpoint?: string; endpointKey?: string } | null {
  if (!route || typeof route !== 'object') return null;
  const symbol = read(
    () =>
      Object.getOwnPropertySymbols(route).find((s) => s.description === ANALOG_META_DESCRIPTION),
    undefined,
  );
  if (!symbol) return null;
  const meta = read(() => (route as AnyRecord)[symbol as unknown as string], null);
  return meta && typeof meta === 'object' ? meta : null;
}

export function fileOfEndpoint(endpointKey: string | undefined): {
  file?: string;
  serverFile?: string;
} {
  if (!endpointKey) return {};
  if (endpointKey.endsWith('.server.ts')) {
    return { file: endpointKey.replace(/\.server\.ts$/, '.page.ts'), serverFile: endpointKey };
  }
  return { file: endpointKey };
}

function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth > 5) return '[Truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as AnyRecord).slice(0, 30)) {
    out[key] = isRedactedKey(key) ? '[redacted]' : redact(item, depth + 1);
  }
  return out;
}

function isEmptyObject(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value as object).length === 0
  );
}

export function chainOf(root: AnyRecord | null): {
  chain: AnalogPageInfo[];
  data: unknown;
  loadFrom?: number;
} {
  const chain: AnalogPageInfo[] = [];
  let data: unknown;
  let loadFrom: number | undefined;
  const segments: string[] = [];
  for (let node = root, guard = 0; node && guard < 40; guard++) {
    const config = read(() => node!['routeConfig'] as AnyRecord | null, null);
    const path = read(() => String(config?.['path'] ?? ''), '');
    if (path) segments.push(path);
    const meta = analogMetaOf(config);
    if (meta) {
      chain.push({ path: `/${segments.join('/')}`, ...fileOfEndpoint(meta.endpointKey) });
      const load = read(() => node!['data']?.['load'], undefined);
      if (load !== undefined && (loadFrom === undefined || !isEmptyObject(load))) {
        data = load;
        loadFrom = chain.length - 1;
      }
    }
    node = read(() => node!['firstChild'] as AnyRecord | null, null);
  }
  return { chain, data, loadFrom };
}

export function configPathsOf(
  routes: unknown,
  prefix = '',
  out: string[] = [],
  depth = 0,
): string[] {
  if (!Array.isArray(routes) || depth > 20 || out.length >= MAX_PATHS) return out;
  for (const route of routes as AnyRecord[]) {
    const path = read(() => (typeof route['path'] === 'string' ? route['path'] : ''), '');
    const full = [prefix, path].filter(Boolean).join('/');
    if (path || !prefix) out.push(`/${full}`);
    configPathsOf(
      read(() => route['children'], null),
      full,
      out,
      depth + 1,
    );
    configPathsOf(
      read(() => route['_loadedRoutes'], null),
      full,
      out,
      depth + 1,
    );
  }
  return Array.from(new Set(out));
}

export function loadSummary(data: unknown): AnalogRuntimeReport['load'] | undefined {
  if (data === undefined) return undefined;
  let text = '';
  try {
    text = JSON.stringify(redact(data)) ?? 'undefined';
  } catch {
    text = String(data);
  }
  const bytes = read(() => (JSON.stringify(data) ?? '').length, text.length);
  return {
    preview: text.length > MAX_PREVIEW ? `${text.slice(0, MAX_PREVIEW)}…` : text,
    bytes,
    keys: data && typeof data === 'object' ? Object.keys(data as object).slice(0, 30) : [],
  };
}

export function hydrationErrorOf(args: unknown[]): string | null {
  const text = args
    .map((arg) => (arg instanceof Error ? arg.message : typeof arg === 'string' ? arg : ''))
    .join(' ');
  const match = text.match(/\bNG05\d\d\b[^\n]*/);
  return match ? match[0].slice(0, 300) : null;
}

export function routerOf(ng: AnyRecord | undefined): AnyRecord | null {
  if (!ng) return null;
  const roots = Array.from(
    typeof document !== 'undefined' ? document.querySelectorAll('[ng-version]') : [],
  );
  if (typeof ng['ɵgetRouterInstance'] === 'function') {
    for (const el of roots) {
      const router = read(() => ng['ɵgetRouterInstance'](ng['getInjector'](el)), null);
      if (router) return router as AnyRecord;
    }
  }
  return read(() => findRouters(ng as RouterDebugApi, roots)[0] ?? null, null);
}

export function hasAnalogMeta(routes: unknown, depth = 0): boolean {
  if (!Array.isArray(routes) || depth > 20) return false;
  return (routes as AnyRecord[]).some(
    (route) =>
      !!analogMetaOf(route) ||
      hasAnalogMeta(
        read(() => route['children'], null),
        depth + 1,
      ) ||
      hasAnalogMeta(
        read(() => route['_loadedRoutes'], null),
        depth + 1,
      ),
  );
}

export function mergeHydrationErrors(early: unknown, own: string[]): string[] {
  const merged: string[] = [];
  for (const text of [...(Array.isArray(early) ? early : []), ...own]) {
    const error = typeof text === 'string' ? hydrationErrorOf([text]) : null;
    if (error && !merged.includes(error)) merged.push(error);
  }
  return merged.slice(-MAX_ERRORS);
}

type HydrationScanner = (counters: Record<string, unknown> | undefined) => { hydrated: number };

function hydratedNodes(scanner?: HydrationScanner): number {
  const counters = (globalThis as { ngDevMode?: unknown }).ngDevMode;
  const record =
    counters && typeof counters === 'object' ? (counters as Record<string, unknown>) : undefined;
  const scanned = scanner ? scanner(record).hydrated : scanHydration(document).hydrated;
  if (scanned) return scanned;
  const counted = record?.['hydratedNodes'];
  return typeof counted === 'number' ? counted : 0;
}

export function collectAnalog(
  ng: AnyRecord | undefined,
  pageId: string,
  hydrationErrors: string[],
  scanner?: HydrationScanner,
): AnalogRuntimeReport | null {
  const router = routerOf(ng);
  if (!router) return null;
  const root = read(() => router['routerState']['snapshot']['root'] as AnyRecord, null);
  const { chain, data, loadFrom } = chainOf(root);
  const paths = configPathsOf(read(() => router['config'], []));
  const analog = chain.length > 0 || hasAnalogMeta(read(() => router['config'], null));
  const rootEl = document.querySelector('[ng-version]');
  const report: AnalogRuntimeReport = {
    pageId,
    url: read(() => String(router['url']), location.pathname),
    analog,
    chain,
    hydrated: analog ? hydratedNodes(scanner) : 0,
    transferState: hasStateScript(document),
    hydrationErrors: mergeHydrationErrors(
      read(() => httpRegistry().warnings, undefined),
      hydrationErrors,
    ),
    configPaths: paths,
  };
  const context = rootEl?.getAttribute('ng-server-context');
  if (context) report.serverContext = context;
  const load = loadSummary(data);
  if (load) {
    report.load = load;
    if (loadFrom !== undefined) report.loadFrom = loadFrom;
  }
  return report;
}

interface Rpc {
  rpc: { call(name: string, ...args: unknown[]): Promise<unknown> };
}

export function attachAnalog(
  my: Rpc,
  pageId: string,
  getNg: () => AnyRecord | undefined,
  refreshMs = 3000,
) {
  const hydrationErrors: string[] = [];
  const scanner = createHydrationScanner();
  let last = '';
  let lastAt = 0;
  let subscription: { unsubscribe(): void } | null = null;
  const record = (args: unknown[]) => {
    const error = read(() => hydrationErrorOf(args), null);
    if (error && !hydrationErrors.includes(error)) {
      hydrationErrors.push(error);
      if (hydrationErrors.length > MAX_ERRORS) hydrationErrors.shift();
    }
  };
  const patches = (['error', 'warn'] as const).map((level) => {
    const original = console[level];
    const patched = function (this: unknown, ...args: unknown[]) {
      record(args);
      return original.apply(this, args as []);
    };
    console[level] = patched;
    return { level, original, patched };
  });

  const push = () => {
    const report = read(() => collectAnalog(getNg(), pageId, hydrationErrors, scanner), null);
    if (!report || !report.analog) return;
    const text = JSON.stringify(report);
    if (text === last && !keepaliveDue(lastAt, refreshMs)) return;
    last = text;
    lastAt = Date.now();
    void my.rpc.call('push-analog', report).catch(() => {});
  };

  const watch = () => {
    if (subscription) return;
    const router = routerOf(getNg());
    const events = read(() => router?.['events'] as AnyRecord | undefined, undefined);
    if (!events || typeof events['subscribe'] !== 'function') return;
    subscription = read(
      () =>
        events['subscribe']((event: AnyRecord) => {
          if (
            event?.['type'] === 1 ||
            read(() => String(event?.['constructor']?.name ?? ''), '').includes('NavigationEnd')
          ) {
            setTimeout(push, 50);
          }
        }) as { unsubscribe(): void },
      null,
    );
  };

  const tick = () => {
    watch();
    push();
  };
  tick();
  const interval = setInterval(tick, refreshMs);
  return () => {
    clearInterval(interval);
    subscription?.unsubscribe();
    for (const { level, original, patched } of patches) {
      if (console[level] === patched) console[level] = original;
    }
  };
}
