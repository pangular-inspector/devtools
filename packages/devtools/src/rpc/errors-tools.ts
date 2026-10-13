import { CONSOLE_LEVELS, type ConsoleLevel } from '../console-tap.ts';
import { ERROR_REFERENCE_URL, ngCodeInfo, ngCodeUrl, normalizeNgCode } from '../ng-error-codes.ts';
import { redactMessage, redactUrl } from '../router.ts';
import { redactText } from '../serialize.ts';
import { clip } from '../text.ts';
import { explainSection, toErrorExplain, type ErrorExplain } from './error-explain-tools.ts';
import { code, untrusted } from './forms-tools.ts';
import { byRecency, unknownPageText } from './pages.ts';

/** Where an error came from on the page. */
export type ErrorSource = 'handler' | 'window' | 'promise';

/** The component whose template or class an error comes from. */
export interface ErrorOwner {
  /** The host element id, the same one the Components tab and `inspect-component` use. */
  id: string;
  name: string;
}

/** Every occurrence of one error message on a page, counted. */
export interface ErrorGroup {
  /** Stable on the page while it keeps the group. */
  id: string;
  /** `name: message`, masked and cut to 500 characters. */
  message: string;
  name?: string;
  /** The Angular error code, such as `NG0100`. */
  code?: string;
  /** The code's page in Angular's error reference, when it has one. */
  docUrl?: string;
  count: number;
  firstAt: number;
  lastAt: number;
  sources: ErrorSource[];
  /** The stack of the first occurrence, masked and cut. */
  stack?: string;
  owner?: ErrorOwner;
  /**
   * What the page read about the error, for NG0100 (binding, values, signal
   * writes), hydration mismatches (server and client DOM, with a diff) and
   * missing providers (token and dependency path). See `error-explain-tools.ts`.
   */
  explain?: ErrorExplain;
}

export interface ConsoleEntry {
  /** Grows with each new entry on the page. */
  id: number;
  level: ConsoleLevel;
  /** The arguments as text, masked and cut to 500 characters. */
  text: string;
  /** The time of the last call; repeated calls in a row count up instead of adding entries. */
  at: number;
  count: number;
  code?: string;
  /** The code's page in Angular's error reference, when it has one. */
  docUrl?: string;
}

/** What a page pushes. With `full` false, only what changed since the last push. */
export interface ErrorsReport {
  pageId: string;
  full: boolean;
  url: string;
  title: string;
  /** Whether the app's ErrorHandler is wrapped, so its errors are captured. */
  handler: 'wrapped' | 'none';
  errors: ErrorGroup[];
  /** Groups the page let go to stay under its cap. */
  removed?: string[];
  console: ConsoleEntry[];
  /** The oldest console entry the page still keeps. */
  firstConsoleId?: number;
  dropped: { errors: number; console: number };
}

export interface ErrorsPageView {
  pageId: string;
  url: string;
  title: string;
  reportedAt: number;
  handler: 'wrapped' | 'none';
  errors: Record<string, ErrorGroup>;
  console: Record<string, ConsoleEntry>;
  dropped: { errors: number; console: number };
}

export interface ErrorsState {
  pages: Record<string, ErrorsPageView>;
}

export type ErrorsPage = ErrorsPageView;

export const MAX_GROUPS = 100;
export const MAX_ENTRIES = 200;
const MAX_MESSAGE = 500;
const MAX_STACK = 4000;
const MAX_ID = 40;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const num = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const text = (value: unknown, max: number) =>
  typeof value === 'string' ? clip(redactText(value), max) : '';
const codeText = (value: unknown) =>
  typeof value === 'string' && /^NG\d{3,5}$/.test(value) ? value : undefined;

function toOwner(value: unknown): ErrorOwner | undefined {
  if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['name'] !== 'string') {
    return undefined;
  }
  return { id: clip(value['id'], MAX_ID), name: clip(value['name'], 120) };
}

function toGroup(value: unknown): ErrorGroup | null {
  if (!isRecord(value) || typeof value['id'] !== 'string') return null;
  const sources = Array.isArray(value['sources'])
    ? value['sources'].filter(
        (s): s is ErrorSource => s === 'handler' || s === 'window' || s === 'promise',
      )
    : [];
  const groupCode = codeText(value['code']);
  const owner = toOwner(value['owner']);
  const stack = text(value['stack'], MAX_STACK);
  const name = text(value['name'], 80);
  const explain = toErrorExplain(value['explain']);
  return {
    id: clip(value['id'], MAX_ID),
    message: text(value['message'], MAX_MESSAGE),
    count: Math.max(1, Math.floor(num(value['count'], 1))),
    firstAt: num(value['firstAt']),
    lastAt: num(value['lastAt']),
    sources,
    ...(name ? { name } : {}),
    ...(groupCode ? { code: groupCode } : {}),
    // The link is rebuilt here, so a page can't point it anywhere else.
    ...(groupCode && ngCodeUrl(groupCode) ? { docUrl: ngCodeUrl(groupCode) } : {}),
    ...(stack ? { stack } : {}),
    ...(owner ? { owner } : {}),
    ...(explain ? { explain } : {}),
  };
}

function toEntry(value: unknown): ConsoleEntry | null {
  if (!isRecord(value) || typeof value['id'] !== 'number') return null;
  const level = CONSOLE_LEVELS.find((l) => l === value['level']);
  if (!level) return null;
  const entryCode = codeText(value['code']);
  return {
    id: value['id'],
    level,
    text: text(value['text'], MAX_MESSAGE),
    at: num(value['at']),
    count: Math.max(1, Math.floor(num(value['count'], 1))),
    ...(entryCode ? { code: entryCode } : {}),
    ...(entryCode && ngCodeUrl(entryCode) ? { docUrl: ngCodeUrl(entryCode) } : {}),
  };
}

/** Checks and masks a pushed report again on the server; `null` when it is not one. */
export function toErrorsReport(message: unknown): ErrorsReport | null {
  if (!isRecord(message) || typeof message['pageId'] !== 'string' || !message['pageId']) {
    return null;
  }
  const list = <T>(value: unknown, map: (item: unknown) => T | null, max: number): T[] =>
    Array.isArray(value)
      ? value
          .slice(-max)
          .map(map)
          .filter((item): item is T => item !== null)
      : [];
  const dropped = isRecord(message['dropped']) ? message['dropped'] : {};
  return {
    pageId: message['pageId'],
    full: message['full'] === true,
    url: typeof message['url'] === 'string' ? redactUrl(message['url']) : '',
    title: typeof message['title'] === 'string' ? redactMessage(message['title']) : '',
    handler: message['handler'] === 'wrapped' ? 'wrapped' : 'none',
    errors: list(message['errors'], toGroup, MAX_GROUPS),
    removed: Array.isArray(message['removed'])
      ? message['removed'].filter((id): id is string => typeof id === 'string').slice(0, MAX_GROUPS)
      : [],
    console: list(message['console'], toEntry, MAX_ENTRIES),
    ...(typeof message['firstConsoleId'] === 'number'
      ? { firstConsoleId: message['firstConsoleId'] }
      : {}),
    dropped: { errors: num(dropped['errors']), console: num(dropped['console']) },
  };
}

function trim<T>(record: Record<string, T>, max: number, order: (item: T) => number): number {
  const keys = Object.keys(record);
  if (keys.length <= max) return 0;
  const sorted = keys.sort((a, b) => order(record[a]!) - order(record[b]!));
  const extra = sorted.slice(0, keys.length - max);
  for (const key of extra) delete record[key];
  return extra.length;
}

/**
 * Applies a report to the page's entry in place, so a shared state with
 * patches sends the panel only what changed. Returns `known: false` for a
 * partial report from a page the server does not hold, so it sends all of it.
 */
export function mergeErrorsReport(
  draft: ErrorsState,
  report: ErrorsReport,
  now = Date.now(),
): { known: boolean } {
  const held = draft.pages[report.pageId];
  if (!report.full && !held) return { known: false };
  const page: ErrorsPageView =
    report.full || !held
      ? {
          pageId: report.pageId,
          url: report.url,
          title: report.title,
          reportedAt: now,
          handler: report.handler,
          errors: {},
          console: {},
          dropped: report.dropped,
        }
      : held;
  if (page.url !== report.url) page.url = report.url;
  if (page.title !== report.title) page.title = report.title;
  if (page.handler !== report.handler) page.handler = report.handler;
  page.reportedAt = now;
  if (
    page.dropped.errors !== report.dropped.errors ||
    page.dropped.console !== report.dropped.console
  ) {
    page.dropped = report.dropped;
  }
  for (const id of report.removed ?? []) delete page.errors[id];
  for (const group of report.errors) page.errors[group.id] = group;
  if (report.firstConsoleId !== undefined) {
    for (const id of Object.keys(page.console)) {
      if (Number(id) < report.firstConsoleId) delete page.console[id];
    }
  }
  for (const entry of report.console) page.console[String(entry.id)] = entry;
  trim(page.errors, MAX_GROUPS, (group) => group.lastAt);
  trim(page.console, MAX_ENTRIES, (entry) => entry.id);
  if (draft.pages[report.pageId] !== page) draft.pages[report.pageId] = page;
  return { known: true };
}

/** The pages that stopped reporting, to drop. */
export function staleErrorPages(
  state: ErrorsState,
  now: number,
  ttl: (pageId: string) => number,
): string[] {
  return Object.values(state.pages)
    .filter((page) => now - page.reportedAt > ttl(page.pageId))
    .map((page) => page.pageId);
}

const NO_PAGE =
  'No page reports errors. Live data needs a page: connect through the MCP endpoint of the server that runs the app, with the app open in a browser and the overlay loaded.';

const cell = (value: string) => value.replace(/\|/g, '\\|').replace(/\s+/g, ' ');

function pickPage(
  state: ErrorsState,
  page: string | undefined,
): { page: ErrorsPageView; note: string } | { markdown: string } {
  const pages = byRecency(Object.values(state.pages));
  if (page && !state.pages[page]) {
    return { markdown: unknownPageText(page, pages, 'errors') };
  }
  const picked = page ? state.pages[page]! : pages[0];
  if (!picked) return { markdown: NO_PAGE };
  const note =
    pages.length > 1 && !page
      ? `Page ${code(picked.pageId)}; ${pages.length} pages report errors, pass \`page\` to pick another.\n\n`
      : '';
  return { page: picked, note };
}

function ago(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 120) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return minutes < 120 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
}

function codeCell(group: { code?: string; docUrl?: string }): string {
  if (!group.code) return '';
  return group.docUrl ? `[${group.code}](${group.docUrl})` : group.code;
}

function handlerNote(page: ErrorsPageView): string {
  return page.handler === 'wrapped'
    ? ''
    : "\n\nThe app's ErrorHandler is not wrapped (no Angular debug API found yet), so errors Angular catches are counted only when the default handler logs them.";
}

/** `list-errors`: the page's errors grouped by message, most recent first. */
export function listErrorsText(
  state: ErrorsState,
  args: { page?: string; code?: string; limit?: number } = {},
  now = Date.now(),
): string {
  const picked = pickPage(state, args.page);
  if ('markdown' in picked) return picked.markdown;
  const { page, note } = picked;
  const wanted = args.code ? (normalizeNgCode(args.code) ?? args.code.toUpperCase()) : undefined;
  const all = Object.values(page.errors)
    .filter((group) => !wanted || group.code === wanted)
    .sort((a, b) => b.lastAt - a.lastAt);
  const limit = Math.min(Math.max(Math.floor(num(args.limit, 30)), 1), MAX_GROUPS);
  if (!all.length) {
    const what = wanted ? `no ${wanted} errors` : 'no errors';
    return `${note}Page ${code(page.pageId)} reported ${what} since it loaded (Angular ErrorHandler, window errors and unhandled promise rejections).${handlerNote(page)}`;
  }
  const rows = all.slice(0, limit).map((group) => {
    const owner = group.owner ? `${code(group.owner.name)} (${code(group.owner.id)})` : '';
    return `| ${code(group.id)} | ${group.count} | ${ago(group.lastAt, now)} | ${codeCell(group)} | ${cell(code(clip(group.message, 200)))} | ${owner} | ${group.sources.join(', ')} |`;
  });
  const more =
    all.length > limit ? `\n\n${all.length - limit} more; raise \`limit\` to see them.` : '';
  const dropped = page.dropped.errors
    ? `\n\n${page.dropped.errors} older error group(s) were dropped to stay under ${MAX_GROUPS}.`
    : '';
  return untrusted(
    `${note}${all.length} error group(s) on page ${code(page.pageId)}, most recent first. Sources: \`handler\` is Angular's ErrorHandler, \`window\` an uncaught error, \`promise\` an unhandled rejection. Pass an id or code to pangular:explain-error for the stack, the owning component and the known cause; pass the owner id to pangular:inspect-component.\n\n| Id | Count | Last | Code | Message | Component | Source |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}${more}${dropped}${handlerNote(page)}`,
  );
}

function codeSection(ngCode: string): string {
  const info = ngCodeInfo(ngCode);
  if (!info) {
    return `**${ngCode}** has no page in Angular's error reference (${ERROR_REFERENCE_URL}), so there is no known cause to show. Read the message itself, and search the Angular source or changelog for the code.`;
  }
  return `**${ngCode}: ${info.title}**. Reference: ${info.url}${info.note ? `\n\nKnown cause (from Angular's error reference): ${info.note}` : ''}`;
}

/**
 * `explain-error`: one error group by id, or an Angular code with the
 * errors that carry it.
 */
export function explainErrorText(
  state: ErrorsState,
  args: { id?: string; code?: string; page?: string },
  now = Date.now(),
): string {
  const query = (args.id ?? args.code ?? '').trim();
  if (!query) return 'Pass `id` (from pangular:list-errors) or `code` (such as NG0100).';
  const asCode = normalizeNgCode(query);
  if (!args.id && asCode) {
    const matches = Object.values(state.pages)
      .filter((page) => !args.page || page.pageId === args.page)
      .flatMap((page) =>
        Object.values(page.errors)
          .filter((group) => group.code === asCode)
          .map((group) => ({ page, group })),
      );
    const seen = matches.length
      ? `\n\nSeen on the page: ${matches
          .slice(0, 10)
          .map(
            ({ page, group }) =>
              `${code(group.id)} on ${code(page.pageId)}, ${group.count}x: ${code(clip(group.message, 200))}`,
          )
          .join('; ')}`
      : '\n\nNo connected page reported this code.';
    const body = `${codeSection(asCode)}${seen}`;
    return matches.length ? untrusted(body) : body;
  }
  const picked = pickPage(state, args.page);
  if ('markdown' in picked) return picked.markdown;
  const pages = args.page ? [picked.page] : byRecency(Object.values(state.pages));
  for (const page of pages) {
    const group = page.errors[query];
    if (!group) continue;
    const lines = [
      `**Error ${code(group.id)}** on page ${code(page.pageId)}: seen ${group.count} time(s), first ${ago(group.firstAt, now)}, last ${ago(group.lastAt, now)}, from ${group.sources.join(', ')}.`,
      '',
      `Message: ${code(group.message)}`,
      '',
      group.owner
        ? `Component: ${code(group.owner.name)}, instance id ${code(group.owner.id)} (pass it to pangular:inspect-component).`
        : 'Component: not found (the error did not come from a template listener, and no component on the page matches its message or stack).',
      '',
      group.code
        ? codeSection(group.code)
        : 'No Angular error code in this error, so it comes from app code or a library.',
    ];
    if (group.explain) lines.push('', explainSection(group.explain, group.owner));
    if (group.stack) {
      const stack = group.stack.split('\n').slice(0, 15).join('\n').replace(/```/g, "'''");
      lines.push('', 'Stack (first occurrence):', '', '```text', stack, '```');
    }
    return untrusted(lines.join('\n'));
  }
  return `No error ${code(query)} on ${args.page ? `page ${code(args.page)}` : 'any page'}. Ids come from pangular:list-errors and last while the page keeps the error; pass a code such as NG0100 as \`code\` for its reference entry.`;
}

/** `list-console`: the page's console calls, newest first. */
export function listConsoleText(
  state: ErrorsState,
  args: { page?: string; level?: string; search?: string; limit?: number } = {},
  now = Date.now(),
): string {
  const picked = pickPage(state, args.page);
  if ('markdown' in picked) return picked.markdown;
  const { page, note } = picked;
  const level = args.level ? CONSOLE_LEVELS.find((l) => l === args.level) : undefined;
  if (args.level && !level) {
    return `Unknown level ${code(args.level)}. Use one of ${CONSOLE_LEVELS.map(code).join(', ')}.`;
  }
  const search = args.search?.toLowerCase();
  const all = Object.values(page.console)
    .filter((entry) => !level || entry.level === level)
    .filter((entry) => !search || entry.text.toLowerCase().includes(search))
    .sort((a, b) => b.id - a.id);
  if (!all.length) {
    return `${note}Page ${code(page.pageId)} has no console calls${level ? ` at level ${code(level)}` : ''}${search ? ' matching the search' : ''}. The page keeps its last ${MAX_ENTRIES} calls, from when the overlay connected.`;
  }
  const limit = Math.min(Math.max(Math.floor(num(args.limit, 50)), 1), MAX_ENTRIES);
  const rows = all.slice(0, limit).map((entry) => {
    const times = entry.count > 1 ? ` (${entry.count}x)` : '';
    return `| ${ago(entry.at, now)} | ${entry.level} | ${cell(code(clip(entry.text, 300)))}${times} | ${codeCell({ code: entry.code, docUrl: entry.code ? ngCodeUrl(entry.code) : undefined })} |`;
  });
  const more =
    all.length > limit ? `\n\n${all.length - limit} more; raise \`limit\` to see them.` : '';
  const dropped = page.dropped.console
    ? `\n\n${page.dropped.console} older call(s) were dropped to stay under ${MAX_ENTRIES}.`
    : '';
  return untrusted(
    `${note}${all.length} console call(s) on page ${code(page.pageId)}, newest first. Calls repeated in a row are counted on one line. Values are masked like other live values.\n\n| When | Level | Text | Code |\n| --- | --- | --- | --- |\n${rows.join('\n')}${more}${dropped}`,
  );
}
