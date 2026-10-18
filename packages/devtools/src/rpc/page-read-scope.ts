import { AsyncLocalStorage } from 'node:async_hooks';
import { setPageReadNote } from './default-page.ts';
import { UNTRUSTED, code } from './forms-tools.ts';
import { callerPage } from './page-scope.ts';
import { pageArgument } from './pages.ts';
import { refusalOf } from './refusal.ts';

/** The pages the current tool call read, as `defaultPage` notes them. */
const reads = new AsyncLocalStorage<Set<string>>();
setPageReadNote((pageId) => reads.getStore()?.add(pageId));

/** How far into an answer a page id already counts as named. */
const NAMED_WITHIN = 300;

/**
 * Wraps a live tool's handler so that its answer names the page it read: the
 * `page` the call passed, or the default page the tool picked (see
 * `default-page.ts`). The first line becomes `Page <id>.`, or
 * `Page <id> (<url>).` when the answer already carries the untrusted-data
 * notice, since the URL comes from the page.
 *
 * Refusals, answers that are not one markdown text, answers that already name
 * the page near the top, and page tool calls (which answer for their own page
 * only) are left as they are.
 */
export function namingPageRead<R>(
  handler: (args: never) => R,
  urlOf: (pageId: string) => string | undefined,
): (args: never) => Promise<Awaited<R>> {
  return async (args: never): Promise<Awaited<R>> => {
    const noted = new Set<string>();
    const result = (await reads.run(noted, async () => handler(args))) as Awaited<R>;
    if (callerPage() !== undefined || refusalOf(result) !== undefined) return result;
    const asked = pageArgument(args as Record<string, unknown> | undefined);
    const pageId = asked ?? (noted.size === 1 ? [...noted][0] : undefined);
    if (!pageId) return result;
    return withPageLine(result, pageId, urlOf(pageId)) as Awaited<R>;
  };
}

/** `result` with a first line naming `pageId`, when it is a markdown answer that does not name it yet. */
export function withPageLine(result: unknown, pageId: string, url: string | undefined): unknown {
  const isText = typeof result === 'string';
  const record = result as { markdown?: unknown } | null;
  const markdown = isText ? result : record?.markdown;
  if (typeof markdown !== 'string') return result;
  const top = markdown.slice(0, NAMED_WITHIN);
  if (top.includes(code(pageId)) || top.includes(JSON.stringify(pageId))) return result;
  const notice = markdown.startsWith(UNTRUSTED);
  // A JSON answer stays JSON a client can parse; its data names the page.
  const body = notice ? markdown.slice(UNTRUSTED.length).trimStart() : markdown;
  if (body.startsWith('{') || body.startsWith('[')) return result;
  const line = `Page ${code(pageId)}${notice && url ? ` (${code(url)})` : ''}.`;
  const next = notice
    ? `${UNTRUSTED}\n\n${line}\n\n${markdown.slice(UNTRUSTED.length).replace(/^\n+/, '')}`
    : `${line}\n\n${markdown}`;
  return isText ? next : { ...record, markdown: next };
}
