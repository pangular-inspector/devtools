import type { CdPage } from './cd-tools.ts';
import { code } from './forms-tools.ts';
import type { PushAcks } from './push-acks.ts';
import { PUSH_ACK_MS } from './push-acks.ts';
import { refusedAnswer } from './refusal.ts';

export type CdRecordAction = 'start' | 'stop' | 'clear';

export interface CdRecordInput {
  record: CdRecordAction;
  /** The `page` the call passed. */
  page?: string;
  /** Pages that can record (they report a component tree, injectors or a recording). */
  connected: readonly string[];
  /** Pages that are recording now. */
  recording: readonly string[];
  /** Sends the request to the page, or to every page without `page`. */
  send: () => void;
  acks: PushAcks<CdPage>;
  ms?: number;
}

const VERB: Record<CdRecordAction, string> = {
  start: 'started',
  stop: 'stopped',
  clear: 'cleared',
};

const NEXT: Record<CdRecordAction, string> = {
  start: ' Use the app, then call this tool again without `record`.',
  stop: ' The cycles recorded so far stay available.',
  clear: '',
};

const pageList = (ids: readonly string[]) => ids.map(code).join(', ');

/**
 * `change-detection` with `record`: sends the request, then waits until the
 * pages push a report that shows it took (recording on, off, or emptied), and
 * names the pages that confirmed. Nothing to send it to, or no page
 * confirming, is a refusal.
 */
export async function cdRecordAnswer(input: CdRecordInput) {
  const { record, page } = input;
  const targets = page ? [page] : record === 'stop' ? input.recording : input.connected;
  if (!targets.length) {
    return refusedAnswer(
      record === 'stop'
        ? 'No page is recording change detection, so there is nothing to stop.'
        : `No page reports change detection, so no recording was ${VERB[record]}. Open the app in a browser with the overlay loaded, through the server that runs it.`,
    );
  }
  const accept = (report: CdPage) =>
    record === 'start'
      ? report.recording === true
      : record === 'stop'
        ? report.recording === false
        : report.cycles.length === 0;
  const confirmed = input.acks.wait(targets, accept, input.ms);
  input.send();
  const done = await confirmed;
  const seconds = Math.round((input.ms ?? PUSH_ACK_MS) / 1000);
  if (!done.length) {
    return refusedAnswer(
      `Recording was not ${VERB[record]}: ${targets.length === 1 ? 'page' : 'pages'} ${pageList(targets)} did not confirm within ${seconds}s. The tab may be in the background, closed, or on an Angular version without the profiler (Angular 20+, dev build).`,
    );
  }
  const silent = targets.filter((id) => !done.includes(id));
  const missing = silent.length
    ? ` ${silent.length === 1 ? 'Page' : 'Pages'} ${pageList(silent)} did not confirm within ${seconds}s.`
    : '';
  return {
    markdown: `Recording ${VERB[record]} on ${done.length === 1 ? 'page' : 'pages'} ${pageList(done)}.${missing}${NEXT[record]}`,
  };
}
