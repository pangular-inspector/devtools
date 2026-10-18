import type { NavigationRecord } from '../router.ts';
import { refusal } from './refusal.ts';
import { decisiveRun, routerActionText } from './router-tools.ts';

type AnyRecord = Record<string, unknown>;

/** Navigation outcomes after which the app is not where the call asked it to go. */
const NOT_DONE = new Set(['cancelled', 'failed', 'skipped']);

const isRecord = (value: unknown): value is AnyRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Whether a navigation summary from the page says the navigation did not happen. */
function notDone(summary: unknown): boolean {
  if (!isRecord(summary)) return false;
  const outcome = summary['outcome'];
  return typeof outcome === 'string' && (NOT_DONE.has(outcome) || outcome.startsWith('unknown'));
}

/**
 * Whether the page's answer to a router action means nothing was done: an
 * `error`, or a navigation (or its replay) that was cancelled, failed,
 * skipped or never recorded.
 */
export function routerActionFailed(action: string, result: unknown): boolean {
  if (!isRecord(result)) return true;
  if (typeof result['error'] === 'string') return true;
  if (action === 'navigate') return notDone(result);
  if (action === 'replay') return notDone(result['replay']);
  return false;
}

/**
 * The `navigate` tool's answer: the page's result with the page it ran on
 * and, for a navigation a guard or resolver decided, which one. A result
 * that means nothing was done is a refusal, so it reaches the client with
 * `isError`.
 */
export function routerActionAnswer(
  action: string,
  pageId: string,
  result: unknown,
  navigations: readonly NavigationRecord[] = [],
): string {
  const failed = routerActionFailed(action, result);
  let shown: unknown = result;
  if (isRecord(result)) {
    const nav =
      typeof result['id'] === 'number' ? navigations.find((n) => n.id === result['id']) : undefined;
    const decidedBy = nav && nav.outcome !== 'succeeded' ? decisiveRun(nav) : undefined;
    shown = { page: pageId, ...result, ...(decidedBy ? { decidedBy } : {}) };
  }
  const text = routerActionText(shown);
  return failed ? refusal(text) : text;
}
