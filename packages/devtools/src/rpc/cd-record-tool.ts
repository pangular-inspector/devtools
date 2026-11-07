import type { AngularPageInfo } from '../config.ts';
import { cdUnsupportedText, type CdPage } from './cd-tools.ts';
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
  /** The page's capability report, so a page that answered unsupported is told why. */
  angularOf?: (pageId: string) => AngularPageInfo | undefined;
}

const VERB: Record<CdRecordAction, string> = {
  start: 'started',
  stop: 'stopped',
  clear: 'cleared',
};

const NEXT: Record<CdRecordAction, string> = {
  start:
    ' Use the app, then read the recording with `pangular:change-detection`, or `pangular:diagnose-change-detection` for what started the cycles.',
  stop: ' The cycles recorded so far stay available.',
  clear: '',
};

const pageList = (ids: readonly string[]) => ids.map(code).join(', ');

/**
 * `record-change-detection` with `record`: sends the request, then waits until the
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
  // A start the page answered with `supported: false` is an answer too: the
  // page says why, instead of the tool waiting out the timeout and guessing a version.
  const unsupported = new Set<string>();
  const accept = (report: CdPage) => {
    if (record === 'start' && report.supported === false) {
      unsupported.add(report.pageId);
      return true;
    }
    if (record === 'start') unsupported.delete(report.pageId);
    return record === 'start'
      ? report.recording === true
      : record === 'stop'
        ? report.recording === false
        : report.cycles.length === 0;
  };
  const confirmed = input.acks.wait(targets, accept, input.ms);
  input.send();
  const answered = await confirmed;
  const done = answered.filter((id) => !unsupported.has(id));
  const refusedBy = answered.filter((id) => unsupported.has(id));
  const why = refusedBy.map((id) => cdUnsupportedText(id, input.angularOf?.(id))).join('\n\n');
  const seconds = Math.round((input.ms ?? PUSH_ACK_MS) / 1000);
  const silent = targets.filter((id) => !answered.includes(id));
  if (!done.length) {
    const quiet = silent.length
      ? `${silent.length === 1 ? 'page' : 'pages'} ${pageList(silent)} did not confirm within ${seconds}s. The tab may be in the background, closed or reloading.`
      : '';
    return refusedAnswer(
      `Recording was not ${VERB[record]}${quiet ? `: ${quiet}` : '.'}${why ? `\n\n${why}` : ''}`,
    );
  }
  const missing = silent.length
    ? ` ${silent.length === 1 ? 'Page' : 'Pages'} ${pageList(silent)} did not confirm within ${seconds}s.`
    : '';
  return {
    markdown: `Recording ${VERB[record]} on ${done.length === 1 ? 'page' : 'pages'} ${pageList(done)}.${missing}${NEXT[record]}${why ? `\n\n${why}` : ''}`,
  };
}
