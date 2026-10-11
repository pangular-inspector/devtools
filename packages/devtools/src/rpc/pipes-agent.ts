import { code } from './forms-tools.ts';
import { byRecency, unknownPageText } from './pages.ts';
import { explainPipeText } from './pipe-explain.ts';
import { currentPipes, type PipePageReport, type PipesState } from './pipes-tools.ts';

type PipePages = Map<string, PipePageReport & { reportedAt: number }>;

const WHAT = 'pipe usage';

/**
 * The live pipe data of one page: the one `page` names, or the page that
 * reported most recently. Returns the answer for an unknown `page` instead.
 */
export function pipePageFor(
  pages: PipePages,
  page: string | undefined,
): { pageId?: string; state: PipesState } | { markdown: string } {
  if (page && !pages.has(page)) {
    return { markdown: unknownPageText(page, [...pages.values()], WHAT) };
  }
  const pageId = page ?? byRecency(pages.values())[0]?.pageId;
  const one: PipePages = new Map();
  const report = pageId ? pages.get(pageId) : undefined;
  if (pageId && report) one.set(pageId, report);
  return { pageId: report ? pageId : undefined, state: currentPipes(one) };
}

/** `explain-pipe` for one page, so several open tabs never mix their counts. */
export function explainPipeOnPage(
  name: string,
  cwd: string,
  pages: PipePages,
  page: string | undefined,
): string {
  const picked = pipePageFor(pages, page);
  if ('markdown' in picked) return picked.markdown;
  const text = explainPipeText(name, cwd, picked.state, picked.pageId ? 1 : 0);
  if (!picked.pageId || pages.size < 2) return text;
  return `Live data from page ${code(picked.pageId)}; ${pages.size} pages report ${WHAT}, pass \`page\` to pick another.\n\n${text}`;
}

export type PipeRecordAction = 'start' | 'stop';

/**
 * What `record-pipes` sends through `request-instrument-pipes`, or the answer
 * when there is nothing to send. Start needs a page; stop without `page`
 * reaches every page.
 */
export function pipeRecordRequest(
  action: unknown,
  pages: PipePages,
  page: string | undefined,
): { request: { pageId?: string; on: boolean } } | { markdown: string } {
  if (action !== 'start' && action !== 'stop') {
    return { markdown: 'Pass `action`: "start" or "stop".' };
  }
  if (page && !pages.has(page)) {
    return { markdown: unknownPageText(page, [...pages.values()], WHAT) };
  }
  if (!pages.size) {
    return {
      markdown:
        'No page reports pipe usage, so there is nothing to record. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser.',
    };
  }
  const on = action === 'start';
  return { request: page ? { pageId: page, on } : { on } };
}

/** The answer once `request-instrument-pipes` has sent the request. */
export function pipeRecordText(request: { pageId?: string; on: boolean }, reached: number): string {
  const where = request.pageId ? `page ${code(request.pageId)}` : `${reached} page(s)`;
  if (request.on) {
    return `Recording pipe calls on ${where}. Use the app, then call pangular:explain-pipe with the pipe name${request.pageId ? ' and the same `page`' : ''} for call counts, the last input, output and caller, and stale-argument checks. Recording wraps each pipe's transform(), so stop it when you are done.`;
  }
  return `Recording stopped on ${where}. The calls recorded so far stay until recording starts again.`;
}
