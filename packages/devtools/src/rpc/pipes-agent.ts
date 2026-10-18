import { defaultPage } from './default-page.ts';
import { code } from './forms-tools.ts';
import { callerPage } from './page-scope.ts';
import { byRecency, unknownPageText } from './pages.ts';
import { explainPipeText } from './pipe-explain.ts';
import { currentPipes, type PipePageReport, type PipesState } from './pipes-tools.ts';
import { refusal } from './refusal.ts';

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
  const pageId = page ?? defaultPage(pages.values())?.pageId;
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
  // A page tool answers for its own page only, so it names no other tab.
  if (!picked.pageId || pages.size < 2 || callerPage() !== undefined) return text;
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
    return { markdown: refusal('Pass `action`: "start" or "stop".') };
  }
  if (page && !pages.has(page)) {
    return { markdown: unknownPageText(page, [...pages.values()], WHAT) };
  }
  if (!pages.size) {
    return {
      markdown: refusal(
        'No page reports pipe usage, so there is nothing to record. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser.',
      ),
    };
  }
  const on = action === 'start';
  if (!on && !page && ![...pages.values()].some((entry) => entry.instrumented)) {
    return { markdown: refusal('No page is recording pipe calls, so there is nothing to stop.') };
  }
  return { request: page ? { pageId: page, on } : { on } };
}

/**
 * The pages a `record-pipes` request is for: the page it names; else, to
 * start, the default page; to stop, every page that records.
 */
export function pipeRecordTargets(request: { pageId?: string; on: boolean }, pages: PipePages) {
  if (request.pageId) return [request.pageId];
  if (request.on) {
    const page = defaultPage(pages.values());
    return page ? [page.pageId] : [];
  }
  return [...pages.values()].filter((entry) => entry.instrumented).map((entry) => entry.pageId);
}

/**
 * The answer once the pages confirmed (`done`, by pushing their pipe report
 * with recording on or off). No page confirming is a refusal.
 */
export function pipeRecordText(
  on: boolean,
  targets: readonly string[],
  done: readonly string[],
): string {
  const list = (ids: readonly string[]) =>
    `${ids.length === 1 ? 'page' : 'pages'} ${ids.map(code).join(', ')}`;
  if (!done.length) {
    return refusal(
      `Recording was not ${on ? 'started' : 'stopped'}: ${list(targets)} did not confirm within 3s. The tab may be in the background or closed.`,
    );
  }
  const silent = targets.filter((id) => !done.includes(id));
  const missing = silent.length ? ` ${list(silent)} did not confirm within 3s.` : '';
  if (on) {
    return `Recording pipe calls on ${list(done)}.${missing} Use the app, then call pangular:explain-pipe with the pipe name for call counts, the last input, output and caller, and stale-argument checks. Recording wraps each pipe's transform(), so stop it when you are done.`;
  }
  return `Recording stopped on ${list(done)}.${missing} The calls recorded so far stay until recording starts again.`;
}
