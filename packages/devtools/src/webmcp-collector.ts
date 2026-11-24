import { keepaliveDue } from './change-detection.ts';
import { shareWebMcp } from './forms-webmcp.ts';
import { redactMessage, redactUrl } from './router.ts';
import type { WebMcpReport } from './webmcp-trace.ts';

interface Rpc {
  rpc: { call(name: string, ...args: unknown[]): Promise<unknown> };
}

export interface WebMcpCollector {
  push(force?: boolean): Promise<void>;
  leave(): void;
  resume(): void;
  stop(): void;
}

export interface WebMcpCollectorOptions {
  /** The page-wide call log size, `limits.webmcpCalls`. */
  maxCalls?: number;
  tickMs?: () => number;
  now?: () => number;
}

/** Changes arrive in bursts (register, call, settle); one push covers each burst. */
const PUSH_DELAY_MS = 100;

/**
 * The `webmcp` inspector's collector: every tool the app registers with
 * `modelContext.registerTool()` and the page-wide log of their calls, sent as
 * `push-webmcp`. It shares the watcher with the forms collector, so
 * `registerTool` is replaced once. A page without `modelContext` and without
 * tools sends nothing.
 */
export function attachWebMcp(
  my: Rpc,
  pageId: string,
  options: WebMcpCollectorOptions = {},
): WebMcpCollector {
  const tickMs = options.tickMs ?? (() => 0);
  const now = options.now ?? Date.now;
  let lastJson = '';
  let sentAt = 0;
  let left = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = () => {
    if (stopped || left || timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      void push().catch(() => {});
    }, PUSH_DELAY_MS);
  };
  const shared = shareWebMcp(schedule);
  if (options.maxCalls) shared.watcher.setMaxCalls(options.maxCalls);

  const push = async (force = false) => {
    if (stopped || left) return;
    const state = shared.watcher.report();
    if (!state.modelContext && !state.tools.length && !state.calls.length) return;
    const report: WebMcpReport = {
      pageId,
      ...(typeof location === 'undefined' ? {} : { url: redactUrl(location.href) }),
      ...(typeof document === 'undefined' ? {} : { title: redactMessage(document.title) }),
      modelContext: state.modelContext,
      tools: state.tools,
      calls: state.calls,
      ...(state.dropped ? { dropped: state.dropped } : {}),
    };
    const json = JSON.stringify(report);
    if (!force && json === lastJson && !keepaliveDue(sentAt, tickMs(), now())) return;
    lastJson = json;
    sentAt = now();
    try {
      await my.rpc.call('push-webmcp', report);
    } catch (error) {
      lastJson = '';
      throw error;
    }
  };

  return {
    push,
    leave() {
      if (left) return;
      left = true;
      lastJson = '';
      clearTimeout(timer);
      timer = undefined;
      void my.rpc.call('forget-webmcp-page', pageId).catch(() => {});
    },
    resume() {
      left = false;
      lastJson = '';
      // The server may have lost this page (a restart, a back-forward cache restore): send it again.
      schedule();
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = undefined;
      shared.release();
    },
  };
}
