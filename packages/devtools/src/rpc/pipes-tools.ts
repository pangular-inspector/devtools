import { PAGE_TTL_MS, fixedTtl, type PageTtl } from './page-ttl.ts';
// Pages heartbeat every few seconds, so a closed tab whose `forget` message
// never arrived drops out of the panel (and its `| async` entries with it) fast.
const PAGE_EXPIRES_MS = PAGE_TTL_MS;
const MAX_MERGED_INSTANCES = 10;
const MAX_MERGED_TARGETS = 10;

function isRecord(value: unknown): value is object {
  return !!value && typeof value === 'object';
}

/** A component host element on one page, for highlighting it there. */
export interface PipeTarget {
  pageId: string;
  id: string;
}

export interface PipeComponentUsage {
  /** Owning component's class name, best-effort (falls back to "?"). */
  name: string;
  count: number;
  targets?: PipeTarget[];
}

/** Time spent in `transform` and the calls that threw, shared by a pipe's
 * totals and each of its instances. */
export interface PipeCallTiming {
  /** Milliseconds spent in `transform` over every recorded call. */
  totalMs?: number;
  /** The slowest single call, in milliseconds. */
  maxMs?: number;
  /** The most recent call, in milliseconds. */
  lastMs?: number;
  /** Calls whose `transform` threw. */
  errorCount?: number;
  /** The most recent error message, redacted and size-capped. */
  lastError?: string;
}

/** One pipe instance's most recent call, for when several usages of the same
 * pipe see different values. */
export interface PipeInstanceCall extends PipeCallTiming {
  component: string;
  callCount: number;
  lastArgs?: unknown[];
  lastResult?: unknown;
  lastCaller?: string;
  /** The component's host element, for highlighting it. */
  target?: PipeTarget;
}

export interface PipeCallInfo extends PipeCallTiming {
  callCount: number;
  /** Most recent call per instance (capped), present when more than one instance has been called. */
  instances?: PipeInstanceCall[];
  /** How many instances were called, present when `instances` was cut short. */
  instanceTotal?: number;
  lastArgs?: unknown[];
  lastResult?: unknown;
  lastCaller?: string;
}

export interface StaleFinding {
  detectedAt: number;
}

export interface PipeUsageInfo {
  name: string;
  className: string;
  isPure: boolean;
  instanceCount: number;
  components: PipeComponentUsage[];
  /** Present only once instrumentation is on and at least one real call happened. */
  call?: PipeCallInfo;
  /** Present only once a stale-pure-pipe finding has fired for this pipe. Experimental. */
  stale?: StaleFinding;
  /** The stale check could not read this pipe's template, e.g. in a minified
   * build, so it is off for this pipe while recording. */
  staleCheck?: 'unavailable';
}

export interface AsyncUsageInfo {
  /** Owning component's class name, best-effort. */
  component: string;
  hasSource: boolean;
  /** Best-effort, size-capped description of the latest emitted value. */
  latestValue?: string;
  /** Another `| async` usage on the page is subscribed to the same source. */
  duplicate: boolean;
  /** The source changed on several reports in a row, e.g. `getData() | async`
   * returning a new Observable on every check. */
  resubscribing?: boolean;
  target?: PipeTarget;
}

/** One page's own pipes and `| async` rows, so a panel bound to a tab can
 * show that tab alone. */
export interface PipesPageState {
  pageId: string;
  pipes: PipeUsageInfo[];
  async: AsyncUsageInfo[];
  /** Every `| async` usage on the page, present when `async` was cut short. */
  asyncTotal?: number;
}

export interface PipesState {
  /** Every connected page's pipes, merged by name. */
  pipes: PipeUsageInfo[];
  async: AsyncUsageInfo[];
  /** How many `| async` usages the pages hold, present when `async` was cut short. */
  asyncTotal?: number;
  reportedAt: number;
  /** Page ids that currently have instrumentation switched on. */
  instrumented: string[];
  /** The same data split by page, present when more than one page reports. */
  pages?: PipesPageState[];
}

export interface PipePageReport {
  pageId: string;
  pipes: PipeUsageInfo[];
  async?: AsyncUsageInfo[];
  /** Every `| async` usage on the page, present when `async` was cut short. */
  asyncTotal?: number;
  instrumented?: boolean;
}

function isPipeTarget(value: unknown): value is PipeTarget {
  if (!isRecord(value)) return false;
  const target: Partial<PipeTarget> = value;
  return typeof target.pageId === 'string' && typeof target.id === 'string';
}

function isPipeComponentUsage(value: unknown): value is PipeComponentUsage {
  if (!isRecord(value)) return false;
  const usage: Partial<PipeComponentUsage> = value;
  return (
    typeof usage.name === 'string' &&
    typeof usage.count === 'number' &&
    (usage.targets === undefined ||
      (Array.isArray(usage.targets) && usage.targets.every(isPipeTarget)))
  );
}

const optional = (value: unknown, type: 'string' | 'number' | 'boolean') =>
  value === undefined || typeof value === type;

function isCallTiming(value: PipeCallTiming): boolean {
  return (
    optional(value.totalMs, 'number') &&
    optional(value.maxMs, 'number') &&
    optional(value.lastMs, 'number') &&
    optional(value.errorCount, 'number') &&
    optional(value.lastError, 'string')
  );
}

function isPipeInstanceCall(value: unknown): value is PipeInstanceCall {
  if (!isRecord(value)) return false;
  const call: Partial<PipeInstanceCall> = value;
  return (
    typeof call.component === 'string' &&
    typeof call.callCount === 'number' &&
    (call.lastArgs === undefined || Array.isArray(call.lastArgs)) &&
    optional(call.lastCaller, 'string') &&
    (call.target === undefined || isPipeTarget(call.target)) &&
    isCallTiming(call)
  );
}

function isPipeCallInfo(value: unknown): value is PipeCallInfo {
  if (!isRecord(value)) return false;
  const call: Partial<PipeCallInfo> = value;
  return (
    typeof call.callCount === 'number' &&
    (call.lastArgs === undefined || Array.isArray(call.lastArgs)) &&
    optional(call.lastCaller, 'string') &&
    optional(call.instanceTotal, 'number') &&
    (call.instances === undefined ||
      (Array.isArray(call.instances) && call.instances.every(isPipeInstanceCall))) &&
    isCallTiming(call)
  );
}

function isPipeUsageInfo(value: unknown): value is PipeUsageInfo {
  if (!isRecord(value)) return false;
  const info: Partial<PipeUsageInfo> = value;
  return (
    typeof info.name === 'string' &&
    typeof info.className === 'string' &&
    typeof info.isPure === 'boolean' &&
    typeof info.instanceCount === 'number' &&
    Array.isArray(info.components) &&
    info.components.every(isPipeComponentUsage) &&
    (info.call === undefined || isPipeCallInfo(info.call)) &&
    (info.stale === undefined ||
      (isRecord(info.stale) && typeof info.stale.detectedAt === 'number')) &&
    (info.staleCheck === undefined || info.staleCheck === 'unavailable')
  );
}

function isAsyncUsageInfo(value: unknown): value is AsyncUsageInfo {
  if (!isRecord(value)) return false;
  const usage: Partial<AsyncUsageInfo> = value;
  return (
    typeof usage.component === 'string' &&
    typeof usage.hasSource === 'boolean' &&
    typeof usage.duplicate === 'boolean' &&
    (usage.resubscribing === undefined || typeof usage.resubscribing === 'boolean') &&
    (usage.latestValue === undefined || typeof usage.latestValue === 'string') &&
    (usage.target === undefined || isPipeTarget(usage.target))
  );
}

export function isPipePageReport(value: unknown): value is PipePageReport {
  if (!isRecord(value)) return false;
  const report: Partial<PipePageReport> = value;
  return (
    typeof report.pageId === 'string' &&
    Array.isArray(report.pipes) &&
    report.pipes.every(isPipeUsageInfo) &&
    (report.async === undefined ||
      (Array.isArray(report.async) && report.async.every(isAsyncUsageInfo))) &&
    optional(report.asyncTotal, 'number') &&
    (report.instrumented === undefined || typeof report.instrumented === 'boolean')
  );
}

// A page builds its reports with these caps already; clamping again on the
// server keeps a misbehaving page from filling shared state and agent output.
const MAX_REPORT_PIPES = 500;
const MAX_REPORT_ASYNC = 200;
const MAX_REPORT_COMPONENTS = 100;
const MAX_REPORT_INSTANCES = 10;
const MAX_REPORT_ARGS = 10;
const MAX_REPORT_TEXT = 500;

function clampText(value: unknown): unknown {
  return typeof value === 'string' && value.length > MAX_REPORT_TEXT
    ? `${value.slice(0, MAX_REPORT_TEXT)}…`
    : value;
}

function clampCall<T extends PipeInstanceCall | PipeCallInfo>(call: T): T {
  const out: T = { ...call };
  if (call.lastArgs) out.lastArgs = call.lastArgs.slice(0, MAX_REPORT_ARGS).map(clampText);
  if (call.lastResult !== undefined) out.lastResult = clampText(call.lastResult);
  if (call.lastCaller !== undefined) out.lastCaller = clampText(call.lastCaller) as string;
  if (call.lastError !== undefined) out.lastError = clampText(call.lastError) as string;
  return out;
}

/** A copy of `report` with every array and string cut to a fixed size. */
export function clampPipePageReport(report: PipePageReport): PipePageReport {
  const asyncRows = report.async?.slice(0, MAX_REPORT_ASYNC).map((row) => ({
    ...row,
    component: clampText(row.component) as string,
    ...(row.latestValue !== undefined ? { latestValue: clampText(row.latestValue) as string } : {}),
  }));
  const asyncCount = Math.max(report.asyncTotal ?? 0, report.async?.length ?? 0);
  return {
    pageId: report.pageId,
    pipes: report.pipes.slice(0, MAX_REPORT_PIPES).map((pipe) => ({
      ...pipe,
      name: clampText(pipe.name) as string,
      className: clampText(pipe.className) as string,
      components: pipe.components.slice(0, MAX_REPORT_COMPONENTS).map((c) => ({
        ...c,
        name: clampText(c.name) as string,
        ...(c.targets ? { targets: c.targets.slice(0, MAX_MERGED_TARGETS) } : {}),
      })),
      call: pipe.call && {
        ...clampCall(pipe.call),
        ...(pipe.call.instances
          ? { instances: pipe.call.instances.slice(0, MAX_REPORT_INSTANCES).map(clampCall) }
          : {}),
        ...(pipe.call.instances && pipe.call.instances.length > MAX_REPORT_INSTANCES
          ? {
              instanceTotal: Math.max(pipe.call.instanceTotal ?? 0, pipe.call.instances.length),
            }
          : {}),
      },
      ...(pipe.stale ? { stale: { detectedAt: pipe.stale.detectedAt } } : {}),
    })),
    ...(asyncRows ? { async: asyncRows } : {}),
    ...(asyncRows && asyncCount > asyncRows.length ? { asyncTotal: asyncCount } : {}),
    ...(report.instrumented !== undefined ? { instrumented: report.instrumented } : {}),
  };
}

type Pages = Map<string, PipePageReport & { reportedAt: number }>;

/** Same-named pipes reported by several pages collapse into one record so
 * consumers looking a pipe up by name see every page's data, not just the
 * first page's. */
function aggregatePipes(all: (PipePageReport & { reportedAt: number })[]): PipeUsageInfo[] {
  const byName = new Map<string, PipeUsageInfo>();
  const callAt = new Map<string, number>();
  for (const page of all) {
    for (const pipe of page.pipes) {
      const existing = byName.get(pipe.name);
      if (!existing) {
        byName.set(pipe.name, {
          ...pipe,
          components: pipe.components.map((c) => ({
            ...c,
            ...(c.targets ? { targets: [...c.targets] } : {}),
          })),
          call: pipe.call && { ...pipe.call },
        });
        if (pipe.call) callAt.set(pipe.name, page.reportedAt);
        continue;
      }
      existing.instanceCount += pipe.instanceCount;
      for (const component of pipe.components) {
        const match = existing.components.find((c) => c.name === component.name);
        if (!match) {
          existing.components.push({
            ...component,
            ...(component.targets ? { targets: [...component.targets] } : {}),
          });
          continue;
        }
        match.count += component.count;
        if (component.targets?.length) {
          const merged = [...(match.targets ?? [])];
          for (const target of component.targets) {
            if (merged.length >= MAX_MERGED_TARGETS) break;
            const seen = merged.some((m) => m.pageId === target.pageId && m.id === target.id);
            if (!seen) merged.push(target);
          }
          match.targets = merged;
        }
      }
      if (pipe.call) {
        if (!existing.call) {
          existing.call = { ...pipe.call };
          callAt.set(pipe.name, page.reportedAt);
        } else {
          const newer = page.reportedAt >= (callAt.get(pipe.name) ?? 0);
          const prev = existing.call;
          const errorCount = (prev.errorCount ?? 0) + (pipe.call.errorCount ?? 0);
          const instances = [...(prev.instances ?? []), ...(pipe.call.instances ?? [])];
          const instanceTotal =
            (prev.instanceTotal ?? prev.instances?.length ?? 0) +
            (pipe.call.instanceTotal ?? pipe.call.instances?.length ?? 0);
          existing.call = {
            ...(newer ? pipe.call : prev),
            callCount: prev.callCount + pipe.call.callCount,
            totalMs: (prev.totalMs ?? 0) + (pipe.call.totalMs ?? 0),
            maxMs: Math.max(prev.maxMs ?? 0, pipe.call.maxMs ?? 0),
            ...(errorCount
              ? {
                  errorCount,
                  lastError:
                    (newer ? pipe.call.lastError : prev.lastError) ??
                    prev.lastError ??
                    pipe.call.lastError,
                }
              : {}),
            instances: instances.slice(0, MAX_MERGED_INSTANCES),
            ...(instanceTotal > MAX_MERGED_INSTANCES ? { instanceTotal } : {}),
          };
          if (newer) callAt.set(pipe.name, page.reportedAt);
        }
      }
      // Off only when it is off on every page that reports the pipe.
      if (existing.staleCheck && !pipe.staleCheck) delete existing.staleCheck;
      if (pipe.stale && (!existing.stale || pipe.stale.detectedAt > existing.stale.detectedAt)) {
        existing.stale = pipe.stale;
      }
    }
  }
  return Array.from(byName.values());
}

function asyncTotalOf(page: PipePageReport): number {
  return Math.max(page.asyncTotal ?? 0, page.async?.length ?? 0);
}

function stateOf(pages: Pages): PipesState {
  const all = Array.from(pages.values());
  const async = all.flatMap((page) => page.async ?? []);
  const asyncTotal = all.reduce((sum, page) => sum + asyncTotalOf(page), 0);
  return {
    pipes: aggregatePipes(all),
    async,
    ...(asyncTotal > async.length ? { asyncTotal } : {}),
    reportedAt: all.length ? Math.min(...all.map((page) => page.reportedAt)) : 0,
    instrumented: all.filter((page) => page.instrumented).map((page) => page.pageId),
    // With one page the merged lists are that page's own, so it is not sent twice.
    ...(all.length > 1
      ? {
          pages: all.map((page) => ({
            pageId: page.pageId,
            pipes: page.pipes,
            async: page.async ?? [],
            ...(asyncTotalOf(page) > (page.async?.length ?? 0)
              ? { asyncTotal: asyncTotalOf(page) }
              : {}),
          })),
        }
      : {}),
  };
}

export function currentPipes(pages: Pages): PipesState {
  return stateOf(pages);
}

export interface PipeInstrumentRequest {
  /** The page to patch; without one, `on: false` stops every page. */
  pageId?: string;
  on: boolean;
}

/**
 * Reads a `request-instrument-pipes` message: `{ pageId, on }`, or a bare
 * boolean from an older panel. Starting without a page id picks the page that
 * reported most recently, so one request never patches every open tab.
 */
export function pipeInstrumentRequest(message: unknown, pages: Pages): PipeInstrumentRequest {
  const record = isRecord(message) ? (message as Record<string, unknown>) : undefined;
  const on = record ? record['on'] !== false : message !== false;
  const asked = record?.['pageId'];
  if (typeof asked === 'string' && asked.length > 0 && asked.length < 50) {
    return { pageId: asked, on };
  }
  if (!on) return { on };
  let latest: (PipePageReport & { reportedAt: number }) | undefined;
  for (const page of pages.values()) {
    if (!latest || page.reportedAt > latest.reportedAt) latest = page;
  }
  return latest ? { pageId: latest.pageId, on } : { on };
}

export function expirePipePages(
  pages: Pages,
  now = Date.now(),
  ttl: PageTtl = fixedTtl(PAGE_EXPIRES_MS),
): PipesState | null {
  let expired = false;
  for (const [id, page] of pages) {
    if (now - page.reportedAt > ttl(id)) {
      pages.delete(id);
      expired = true;
    }
  }
  return expired ? stateOf(pages) : null;
}

export function mergePipePageReport(
  pages: Pages,
  report: PipePageReport,
  now = Date.now(),
  ttl: PageTtl = fixedTtl(PAGE_EXPIRES_MS),
): PipesState {
  pages.set(report.pageId, { ...clampPipePageReport(report), reportedAt: now });
  expirePipePages(pages, now, ttl);
  return stateOf(pages);
}
