// The axe pass on the server: checks and masks again what a page sends, and
// runs one pass on a page by asking it (`axe-run`) and waiting for its
// `axe-result`, which only the connection that owns the page can settle.

import {
  MAX_AXE_NODES,
  MAX_AXE_RULES,
  type AxeImpact,
  type AxeNode,
  type AxeReport,
  type AxeRunResult,
  type AxeViolation,
} from '../axe-runner.ts';
import { redactUrl } from '../router.ts';
import { redactText } from '../serialize.ts';
import { clip } from '../text.ts';

/**
 * How long a pass may take before the server stops waiting. axe on a large
 * page takes seconds. Shorter than devframe's own RPC timeout (60 s), so the
 * panel gets this error, which says what to check, instead of a generic one.
 */
export const AXE_TIMEOUT_MS = 45_000;

const IMPACTS: readonly AxeImpact[] = ['critical', 'serious', 'moderate', 'minor'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const str = (value: unknown, max: number) =>
  typeof value === 'string' ? clip(redactText(value), max) : '';
const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
const impact = (value: unknown): AxeImpact | undefined =>
  IMPACTS.includes(value as AxeImpact) ? (value as AxeImpact) : undefined;
const id = (value: unknown) =>
  typeof value === 'string' && /^[\w-]{1,60}$/.test(value) ? value : undefined;

function toNode(value: unknown): AxeNode | null {
  if (!isRecord(value)) return null;
  const owner = isRecord(value['owner']) ? value['owner'] : undefined;
  const ownerId = id(owner?.['id']);
  const ownerName = str(owner?.['name'], 120);
  const elementId = id(value['elementId']);
  const summary = str(value['summary'], 400);
  const level = impact(value['impact']);
  return {
    target: str(value['target'], 200),
    html: str(value['html'], 240),
    ...(summary ? { summary } : {}),
    ...(level ? { impact: level } : {}),
    ...(elementId ? { elementId } : {}),
    ...(ownerId && ownerName ? { owner: { id: ownerId, name: ownerName } } : {}),
  };
}

function toViolation(value: unknown): AxeViolation | null {
  if (!isRecord(value)) return null;
  const rule = id(value['id']);
  if (!rule) return null;
  const nodes = Array.isArray(value['nodes'])
    ? value['nodes']
        .slice(0, MAX_AXE_NODES)
        .map(toNode)
        .filter((node): node is AxeNode => node !== null)
    : [];
  const level = impact(value['impact']);
  const helpUrl = typeof value['helpUrl'] === 'string' ? value['helpUrl'] : '';
  return {
    id: rule,
    ...(level ? { impact: level } : {}),
    help: str(value['help'], 200) || rule,
    // Only Deque's rule pages: the link is shown to people and agents as is.
    ...(/^https:\/\/dequeuniversity\.com\//.test(helpUrl) ? { helpUrl: clip(helpUrl, 300) } : {}),
    tags: Array.isArray(value['tags'])
      ? value['tags']
          .filter((tag): tag is string => typeof tag === 'string' && /^[\w.-]{1,40}$/.test(tag))
          .slice(0, 8)
      : [],
    count: Math.max(nodes.length, Math.floor(num(value['count']))),
    nodes,
  };
}

/** Checks and masks an axe report from a page; `null` when it is not one. */
export function toAxeReport(value: unknown): AxeReport | null {
  if (!isRecord(value) || !Array.isArray(value['violations'])) return null;
  const violations = value['violations']
    .slice(0, MAX_AXE_RULES)
    .map(toViolation)
    .filter((item): item is AxeViolation => item !== null);
  const dropped = Math.floor(num(value['droppedRules']));
  const version = typeof value['version'] === 'string' ? clip(value['version'], 20) : '';
  return {
    at: num(value['at']) || Date.now(),
    ms: Math.round(num(value['ms'])),
    url: typeof value['url'] === 'string' ? redactUrl(value['url']) : '',
    ...(version ? { version } : {}),
    violations,
    ...(dropped ? { droppedRules: dropped } : {}),
  };
}

/** Checks a page's answer to `axe-run`. */
export function toAxeRunResult(value: unknown): AxeRunResult {
  if (isRecord(value) && value['ok'] === true) {
    const report = toAxeReport(value['report']);
    if (report) return { ok: true, report };
  }
  const error = isRecord(value) ? str(value['error'], 400) : '';
  return { ok: false, error: error || 'The page sent no axe result.' };
}

interface AxeRequestDeps {
  /** Sends an event to every connected page. */
  broadcast: (method: string, message: unknown) => void;
  /** Whether a result for `target` may come from the connection that sent it for `pageId`. */
  answersFor: (target: string, pageId: unknown) => boolean;
  /** Called when a pass starts and ends on a page. */
  onRunning?: (pageId: string, running: boolean) => void;
  timeoutMs?: number;
}

/** Asks pages for axe passes and waits for their answers. */
export function createAxeRequests(deps: AxeRequestDeps) {
  const pending = new Map<string, { pageId: string; settle: (result: AxeRunResult) => void }>();
  // One pass per page at a time: a second request joins the first.
  const inFlight = new Map<string, Promise<AxeRunResult>>();
  let seq = 0;

  const answer = (message: unknown) => {
    if (!isRecord(message) || typeof message['requestId'] !== 'string') return;
    const entry = pending.get(message['requestId']);
    if (entry && deps.answersFor(entry.pageId, message['pageId'])) {
      entry.settle(toAxeRunResult(message['result']));
    }
  };

  const run = (pageId: string): Promise<AxeRunResult> => {
    const running = inFlight.get(pageId);
    if (running) return running;
    const promise = new Promise<AxeRunResult>((resolve) => {
      const requestId = `a${++seq}`;
      const timeoutMs = deps.timeoutMs ?? AXE_TIMEOUT_MS;
      const timer = setTimeout(() => {
        pending.delete(requestId);
        resolve({
          ok: false,
          error: `The page did not answer within ${Math.round(timeoutMs / 1000)}s. Is the app open in a browser, with an overlay that has the axe pass (this version of the devtools)?`,
        });
      }, timeoutMs);
      timer.unref?.();
      pending.set(requestId, {
        pageId,
        settle: (result) => {
          clearTimeout(timer);
          pending.delete(requestId);
          resolve(result);
        },
      });
      deps.broadcast('axe-run', { requestId, pageId });
    }).finally(() => {
      inFlight.delete(pageId);
      deps.onRunning?.(pageId, false);
    });
    inFlight.set(pageId, promise);
    deps.onRunning?.(pageId, true);
    return promise;
  };

  return { answer, run, pendingCount: () => pending.size };
}
