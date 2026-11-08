import {
  moreChangesText,
  NGRX_DEVTOOLS_OPS,
  devtoolsProblem,
  type NgrxDevtoolsRequest,
  type NgrxDiffEntry,
  type NgrxLogEntry,
  type NgrxRequest,
  type NgrxRequestResult,
} from '../ngrx-shared.ts';
import { UNTRUSTED, untrusted } from './forms-tools.ts';
import type { NgrxPageRecord, NgrxPages } from './ngrx-tools.ts';
import { storeIdNamed } from './ngrx-live-tools.ts';
import { pageArgument, unknownPageText } from './pages.ts';
import { isRefusal, refusal } from './refusal.ts';
import { rankPages } from './default-page.ts';

/**
 * The Store DevTools history tool (`ngrx-store-devtools`, an action behind
 * `actions.ngrx`) and the read-only `ngrx-explain-change` tool, which answers
 * why a state path changed from the change log the server already holds.
 */

const MAX_TEXT = 15_000;
/** Most entries `ngrx-explain-change` lists for a path. */
export const EXPLAIN_MAX_ENTRIES = 5;

interface Deps {
  /** Sends a request to a page's NgRx collector (`requestNgrxAction`). */
  ask: (page: string | undefined, request: NgrxRequest) => Promise<NgrxRequestResult>;
  pages: () => NgrxPages;
}

export const NGRX_STORE_DEVTOOLS_DESCRIPTION =
  'Change the @ngrx/store Store DevTools history (dev only): `op` toggle skips or includes action `seq`, jump goes to `seq` or state `index` (0 is committed), commit, reset, or pause recording (`paused`). Commit and reset drop the history. Needs actions.ngrx.';

export const NGRX_EXPLAIN_CHANGE_DESCRIPTION =
  'Why an NgRx state value changed: the newest log entries that wrote a state `path` (like `cart.items`), or entry `seq`, with the action or method, arguments, origin, causing event and, with ngrx.trace on, the call site.';

const PAGE = {
  type: 'string',
  description: 'Page id, when more than one tab reports (see pangular:list-pages).',
} as const;

export const NGRX_DEVTOOLS_SCHEMAS = {
  devtools: {
    type: 'object',
    properties: {
      op: { type: 'string', enum: [...NGRX_DEVTOOLS_OPS], description: 'The operation.' },
      seq: {
        type: 'integer',
        description: 'toggle and jump: the log entry of an @ngrx/store action.',
      },
      index: {
        type: 'integer',
        description: 'jump: a Store DevTools state instead of seq; 0 is the committed state.',
      },
      paused: {
        type: 'boolean',
        description: 'pause: true stops recording, false starts it again. Toggles without it.',
      },
      page: PAGE,
    },
    required: ['op'],
  },
  explain: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description:
          'A state path as the diff shows it, such as `cart.items`, `items[0].done` or a signal store field like `filter`.',
      },
      store: {
        type: 'string',
        description:
          'Store id or name (`store` is the @ngrx/store Store). Omit to search every store.',
      },
      seq: { type: 'integer', description: 'Explain this log entry instead of a path.' },
      page: PAGE,
    },
  },
} as const;

function code(text: string): string {
  return `\`${text.replaceAll('`', "'")}\``;
}

function json(value: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(value) ?? 'undefined';
  } catch {
    text = String(value);
  }
  return text.length > 400 ? `${text.slice(0, 400)}…` : text;
}

/** The answer of `ngrx-store-devtools`. The page writes the message, so it sits behind the notice. */
export function devtoolsResultText(result: NgrxRequestResult): string {
  if (result.error) {
    const error = result.error.startsWith(UNTRUSTED)
      ? result.error.slice(UNTRUSTED.length).trimStart()
      : result.error;
    return refusal(untrusted(`Not done: ${error}`));
  }
  return untrusted(
    `${result.message ?? 'Done.'}\n\nRead pangular:ngrx-history for the new entry and pangular:ngrx-inspect-store for the state.`,
  );
}

/** Whether diff row `row` touches state path `path`: the same path, one inside it, or one around it. */
export function touchesPath(row: string, path: string): boolean {
  if (row === '(root)' || row === path) return true;
  const inside = (outer: string, inner: string) =>
    inner.startsWith(`${outer}.`) || inner.startsWith(`${outer}[`);
  return inside(path, row) || inside(row, path);
}

function diffRow(row: NgrxDiffEntry): string {
  const before = 'before' in row ? ` ${json(row.before)}` : '';
  const after = 'after' in row ? ` ${json(row.after)}` : '';
  const arrow = 'before' in row && 'after' in row ? ' →' : '';
  return `  - ${code(row.path)} ${row.op}${before}${arrow}${after}`;
}

function entryText(entry: NgrxLogEntry, rows: NgrxDiffEntry[], store: string): string {
  const what =
    entry.source === 'store'
      ? `action ${code(entry.type)}`
      : entry.source === 'event'
        ? `event ${code(entry.eventType ?? entry.type)}`
        : entry.type === 'patchState'
          ? `a ${code('patchState')} outside a store method`
          : `method ${code(entry.type)}`;
  const lines = [
    `### #${entry.seq}: ${what} on ${code(store)}, ${new Date(entry.timestamp).toISOString()}`,
  ];
  if (entry.origin) {
    lines.push(
      `- origin: ${
        {
          dispatch: 'store.dispatch(action)',
          effect: 'an NgRx effect',
          reactive: 'store.dispatch(() => action)',
        }[entry.origin]
      }`,
    );
  }
  if (entry.causedByEvent) lines.push(`- caused by event ${code(entry.causedByEvent.type)}`);
  if (entry.action !== undefined) lines.push(`- action: ${json(entry.action)}`);
  if (entry.args?.length) lines.push(`- arguments: ${json(entry.args)}`);
  if (entry.durationMs !== undefined) lines.push(`- duration: ${entry.durationMs}ms`);
  if (rows.length) {
    lines.push('- changed:');
    lines.push(...rows.map(diffRow));
  } else lines.push('- changed nothing');
  if (entry.diffTruncated) lines.push(`  - ${moreChangesText(entry.diffTruncated)}`);
  if (entry.trace?.length) {
    lines.push('- called from:');
    lines.push(...entry.trace.map((frame) => `  - ${code(frame)}`));
  }
  return lines.join('\n');
}

const NO_TRACE =
  'No call sites recorded. Set `ngrx: { trace: true }` in the devtools config to record where each change came from.';

/**
 * Why a state path changed, as markdown: the newest log entries on the
 * matching page(s) whose diff touches `path`, newest first, each with what
 * ran, its arguments, origin, causing event and call site. With `seq`, that
 * one entry with its whole diff, when it belongs to `storeId` (if given).
 */
export function explainChangeText(
  pages: NgrxPages,
  pageId: string | undefined,
  storeId: string | undefined,
  path: string | undefined,
  seq: number | undefined,
): string {
  const matching = rankPages(pages.values()).filter((p) => !pageId || p.pageId === pageId);
  if (!matching.length) {
    if (pageId && pages.size) return unknownPageText(pageId, [...pages.values()], 'NgRx state');
    return 'No NgRx state has been reported yet. Open the app in a browser through the server that runs it; the stdio MCP server has no page.';
  }
  const page: NgrxPageRecord = matching[0];
  const labels = new Map<string, string>([
    ['store', 'Store'],
    ['event', 'events'],
  ]);
  for (const store of page.stores) labels.set(store.id, store.name ?? store.className);
  const label = (id: string) => labels.get(id) ?? id;
  const where =
    matching.length > 1
      ? ` on page ${code(page.pageId)} (the newest; pass \`page\` for another)`
      : '';
  if (seq !== undefined) {
    const entry = page.log.find((e) => e.seq === seq);
    if (!entry) {
      return `No log entry #${seq}${where || ` on page ${code(page.pageId)}`}. It may be older than the kept log (limits.changeLog).`;
    }
    if (storeId && entry.storeId !== storeId) {
      return `Log entry #${seq}${where} belongs to ${code(label(entry.storeId))}, not ${code(label(storeId))}. Leave \`store\` out to explain it.`;
    }
    const body = entryText(entry, entry.diff, label(entry.storeId));
    return `${body}${entry.trace?.length ? '' : `\n\n${NO_TRACE}`}`;
  }
  const want = path?.trim();
  if (!want)
    return refusal('Pass `path`, a state path such as `cart.items`, or `seq`, a log entry.');
  const hits: { entry: NgrxLogEntry; rows: NgrxDiffEntry[] }[] = [];
  for (let i = page.log.length - 1; i >= 0 && hits.length < EXPLAIN_MAX_ENTRIES; i--) {
    const entry = page.log[i];
    if (storeId && entry.storeId !== storeId) continue;
    const rows = entry.diff.filter((row) => touchesPath(row.path, want));
    if (rows.length) hits.push({ entry, rows });
  }
  if (!hits.length) {
    const scope = storeId ? ` of ${code(label(storeId))}` : '';
    return `No entry in the kept log${scope}${where} changed ${code(want)}. The path is written as the diff shows it, from the state root (\`cart.items\`) or a signal store field (\`filter\`). An older change may have left the log (limits.changeLog).`;
  }
  const newest = hits[0].entry;
  const head = `${code(want)} last changed in #${newest.seq} (${newest.type})${where}. The ${
    hits.length === 1 ? 'entry' : `${hits.length} newest entries`
  } that wrote it, newest first:`;
  const body = hits.map(({ entry, rows }) => entryText(entry, rows, label(entry.storeId)));
  const traced = hits.some(({ entry }) => entry.trace?.length);
  const text = [head, ...body, ...(traced ? [] : [NO_TRACE])].join('\n\n');
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}\n…` : text;
}

function whole(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

/** `ngrx-store-devtools` and `ngrx-explain-change`, for `agent.registerTool`. */
export function createNgrxDevtoolsTools(deps: Deps) {
  return [
    {
      id: 'pangular:ngrx-store-devtools',
      title: 'Change the Store DevTools history',
      description: NGRX_STORE_DEVTOOLS_DESCRIPTION,
      inputSchema: NGRX_DEVTOOLS_SCHEMAS.devtools,
      handler: async (args: Record<string, unknown>) => {
        const page = pageArgument(args);
        const pages = deps.pages();
        if (page && !pages.has(page)) {
          return { markdown: unknownPageText(page, [...pages.values()], 'NgRx state') };
        }
        const request: NgrxDevtoolsRequest = {
          type: 'devtools',
          op: args?.['op'] as NgrxDevtoolsRequest['op'],
          ...(args?.['seq'] !== undefined ? { seq: args['seq'] as number } : {}),
          ...(args?.['index'] !== undefined ? { index: args['index'] as number } : {}),
          ...(args?.['paused'] !== undefined ? { paused: args['paused'] as boolean } : {}),
        };
        const problem = devtoolsProblem(request);
        if (problem) return { markdown: refusal(problem) };
        if (page && !pages.get(page)?.classic) {
          return {
            markdown: refusal(
              `Page ${code(page)} has no @ngrx/store Store, so it has no Store DevTools history.`,
            ),
          };
        }
        return { markdown: devtoolsResultText(await deps.ask(page, request)) };
      },
    },
    {
      id: 'pangular:ngrx-explain-change',
      title: 'Explain an NgRx state change',
      description: NGRX_EXPLAIN_CHANGE_DESCRIPTION,
      inputSchema: NGRX_DEVTOOLS_SCHEMAS.explain,
      handler: async (args: Record<string, unknown>) => {
        const pages = deps.pages();
        const page = pageArgument(args);
        const store = typeof args?.['store'] === 'string' ? args['store'] : undefined;
        const path = typeof args?.['path'] === 'string' ? args['path'].slice(0, 500) : undefined;
        const text = explainChangeText(
          pages,
          page,
          storeIdNamed(pages, page, store),
          path,
          whole(args?.['seq']),
        );
        // A refusal stays as built, so it keeps its marking and its own notice.
        return { markdown: isRefusal(text) ? text : untrusted(text) };
      },
    },
  ];
}
