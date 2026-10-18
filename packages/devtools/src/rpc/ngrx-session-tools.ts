import {
  generateTest,
  parseSession,
  sessionEntryDetail,
  sessionJson,
  sliceSession,
  TEST_FRAMEWORK,
  type GeneratedTest,
  type NgrxEntryDetail,
  type NgrxSession,
} from '../ngrx-session.ts';
import {
  moreChangesText,
  type NgrxLogEntry,
  type NgrxRequest,
  type NgrxRequestResult,
} from '../ngrx-shared.ts';
import { UNTRUSTED, untrusted } from './forms-tools.ts';
import type { NgrxPageRecord } from './ngrx-tools.ts';
import { callerPage } from './page-scope.ts';
import { pageArgument, unknownPageText } from './pages.ts';
import { refusal } from './refusal.ts';

/**
 * The NgRx history on the server: the State, Diff and Action of a past entry
 * (from the live page, or from an imported session), session export and
 * import, generated tests, and restoring a past state. Imported sessions stay
 * in memory, at most {@link MAX_IMPORTED} of them, and expire after
 * {@link IMPORTED_TTL_MS} without use.
 */

export const MAX_IMPORTED = 5;
export const IMPORTED_TTL_MS = 60 * 60_000;
/** Most characters of session JSON an agent tool answer carries. */
export const MAX_TOOL_SESSION_CHARS = 60_000;
const MAX_TEXT = 15_000;

/** What the panel and the tools ask for. `session` reads an imported session instead of a page. */
export type HistoryQuery =
  | { type: 'entry'; seq: number }
  | { type: 'export'; storeId?: string; from?: number; to?: number }
  | { type: 'test'; storeId?: string; from?: number; to?: number };

export interface HistoryAnswer {
  ok?: boolean;
  error?: string;
  message?: string;
  detail?: NgrxEntryDetail;
  session?: NgrxSession;
  test?: GeneratedTest;
}

/** The entries of an imported session as the panel lists them: the log fields, no patches. */
export interface ImportedSummary {
  id: string;
  store: NgrxSession['store'];
  page?: NgrxSession['page'];
  exportedAt: number;
  entries: Omit<NgrxSession['entries'][number], 'changes'>[];
}

interface Deps {
  /** Sends a request to a page's NgRx collector (`requestNgrxAction`). */
  ask: (page: string | undefined, request: NgrxRequest) => Promise<NgrxRequestResult>;
  page: (pageId: string) => NgrxPageRecord | undefined;
  pages: () => NgrxPageRecord[];
  now?: () => number;
}

function whole(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

/** The request with its fields checked, or the problem. */
export function toHistoryQuery(raw: unknown): HistoryQuery | string {
  const r = (raw ?? {}) as Record<string, unknown>;
  const range = {
    ...(typeof r['storeId'] === 'string' && r['storeId'] && r['storeId'].length <= 100
      ? { storeId: r['storeId'] }
      : {}),
    ...(whole(r['from']) !== undefined ? { from: whole(r['from']) } : {}),
    ...(whole(r['to']) !== undefined ? { to: whole(r['to']) } : {}),
  };
  if (r['type'] === 'entry') {
    const seq = whole(r['seq']);
    return seq === undefined ? 'Pass `seq`, the number of a log entry.' : { type: 'entry', seq };
  }
  if (r['type'] === 'export' || r['type'] === 'test') return { type: r['type'], ...range };
  return 'Unknown request.';
}

function summary(id: string, session: NgrxSession): ImportedSummary {
  return {
    id,
    store: session.store,
    ...(session.page ? { page: session.page } : {}),
    exportedAt: session.exportedAt,
    entries: session.entries.map(({ changes: _changes, ...entry }) => entry),
  };
}

export function createNgrxHistory(deps: Deps) {
  const now = deps.now ?? Date.now;
  const imported = new Map<string, { session: NgrxSession; usedAt: number }>();
  let nextId = 0;

  const expire = () => {
    const at = now();
    for (const [id, entry] of imported) {
      if (at - entry.usedAt > IMPORTED_TTL_MS) imported.delete(id);
    }
  };

  const importedSession = (id: string) => {
    expire();
    const entry = imported.get(id);
    if (entry) entry.usedAt = now();
    return entry?.session;
  };

  /** Checks and keeps a session; the oldest goes when more than {@link MAX_IMPORTED} are kept. */
  const importSession = (input: unknown): (ImportedSummary & { ok: true }) | { error: string } => {
    const session = parseSession(input);
    if (typeof session === 'string') return { error: session };
    expire();
    const id = `session-${++nextId}`;
    imported.set(id, { session, usedAt: now() });
    while (imported.size > MAX_IMPORTED) imported.delete(imported.keys().next().value!);
    return { ok: true, ...summary(id, session) };
  };

  /** A page's session for one store, with the page and the store name the server knows. */
  const exportFromPage = async (
    pageId: string | undefined,
    range: { storeId?: string; from?: number; to?: number },
  ): Promise<HistoryAnswer> => {
    const result = await deps.ask(pageId, { type: 'export', ...range });
    if (!result.ok || !result.session)
      return { error: result.error ?? 'The page sent no session.' };
    const parsed = parseSession(result.session);
    if (typeof parsed === 'string')
      return { error: `The page sent a session that does not check out: ${parsed}` };
    const record = pageId ? deps.page(pageId) : deps.pages()[0];
    const store = record?.stores.find((s) => s.id === parsed.store.id);
    const session: NgrxSession = {
      ...parsed,
      ...(record ? { page: { url: record.url, title: record.title } } : {}),
      store: { ...parsed.store, ...(store ? { name: store.name ?? store.className } : {}) },
    };
    return { ok: true, message: result.message, session };
  };

  /** Answers `request-ngrx-history` for a live page or an imported session. */
  const history = async (message: unknown): Promise<HistoryAnswer> => {
    const m = (message ?? {}) as Record<string, unknown>;
    const query = toHistoryQuery(m['request']);
    if (typeof query === 'string') return { error: query };
    const sessionId = typeof m['session'] === 'string' ? m['session'] : undefined;
    const pageId = typeof m['pageId'] === 'string' ? m['pageId'] : undefined;
    if (sessionId) {
      const session = importedSession(sessionId);
      if (!session) {
        return { error: 'That imported session is no longer kept. Import the file again.' };
      }
      if (query.type === 'entry') {
        const detail = sessionEntryDetail(session, query.seq);
        return detail ? { ok: true, detail } : { error: `The session has no entry #${query.seq}.` };
      }
      const sliced = sliceSession(
        query.storeId && query.storeId !== session.store.id && query.storeId !== session.store.name
          ? { ...session, entries: [] }
          : session,
        query.from,
        query.to,
      );
      if (query.type === 'export') return { ok: true, session: sliced };
      const test = generateTest(sliced);
      return typeof test === 'string' ? { error: test } : { ok: true, test };
    }
    if (pageId && !deps.page(pageId)) {
      return { error: unknownPageText(pageId, deps.pages(), 'NgRx state') };
    }
    if (query.type === 'entry') {
      const result = await deps.ask(pageId, query);
      return result.ok && result.detail
        ? { ok: true, detail: result.detail }
        : { error: result.error ?? 'The page sent no state for this entry.' };
    }
    const { type: _type, ...range } = query;
    const exported = await exportFromPage(pageId, range);
    if (!exported.session || query.type === 'export') return exported;
    const test = generateTest(exported.session);
    return typeof test === 'string' ? { error: test } : { ok: true, test };
  };

  const text = (value: unknown) => (typeof value === 'string' ? value : undefined);

  /**
   * Imported sessions are kept for the whole server, so a page tool call
   * (see `callerPage()`) reads its own page only and never an imported one.
   */
  const sessionArgument = (args: Record<string, unknown>) => {
    const session = text(args?.['session']);
    return session && callerPage() !== undefined ? null : session;
  };

  /** The store id a `store` argument names: an id as it is, or the id of the store with that name. */
  const storeOf = (args: Record<string, unknown>, pageId: string | undefined) => {
    const store = text(args?.['store']);
    if (!store) return undefined;
    const stores = (pageId ? deps.page(pageId) : deps.pages()[0])?.stores ?? [];
    if (stores.some((s) => s.id === store)) return store;
    return stores.find((s) => s.name === store || s.className === store)?.id ?? store;
  };

  const entryOf = (pageId: string | undefined, seq: number) =>
    (pageId ? deps.page(pageId) : deps.pages()[0])?.log.find((entry) => entry.seq === seq);

  /** The NgRx history agent tools; `ngrx-restore` is the one action among them. */
  const tools = [
    {
      id: 'pangular:ngrx-inspect-entry',
      title: 'Inspect an NgRx log entry',
      description: INSPECT_NGRX_ENTRY_DESCRIPTION,
      inputSchema: NGRX_HISTORY_SCHEMAS.entry,
      handler: async (args: Record<string, unknown>) => {
        const seq = args?.['seq'];
        if (typeof seq !== 'number' || !Number.isInteger(seq)) {
          return { markdown: refusal('Pass `seq`, a log entry number.') };
        }
        const session = sessionArgument(args);
        if (session === null) return { markdown: PAGE_TOOL_SESSION_TEXT };
        // Picked once, so the state and the action shown come from the same page.
        const page = pageArgument(args) ?? (session ? undefined : deps.pages()[0]?.pageId);
        const answer = await history({ pageId: page, session, request: { type: 'entry', seq } });
        const where = session ? `in session \`${session}\`` : page ? `on page \`${page}\`` : '';
        return {
          markdown: entryDetailText(answer, where, session ? undefined : entryOf(page, seq)),
        };
      },
    },
    {
      id: 'pangular:ngrx-export-session',
      title: 'Export an NgRx session',
      description: EXPORT_NGRX_SESSION_DESCRIPTION,
      inputSchema: NGRX_HISTORY_SCHEMAS.export,
      handler: async (args: Record<string, unknown>) => ({
        markdown: exportText(
          await history({
            pageId: pageArgument(args),
            request: {
              type: 'export',
              storeId: storeOf(args, pageArgument(args)),
              from: args?.['from'],
              to: args?.['to'],
            },
          }),
        ),
      }),
    },
    {
      id: 'pangular:ngrx-import-session',
      title: 'Import an NgRx session',
      description: IMPORT_NGRX_SESSION_DESCRIPTION,
      inputSchema: NGRX_HISTORY_SCHEMAS.import,
      handler: async (args: Record<string, unknown>) => ({
        markdown: importText(importSession(args?.['session'])),
      }),
    },
    {
      id: 'pangular:ngrx-generate-test',
      title: 'Generate an NgRx test',
      description: GENERATE_NGRX_TEST_DESCRIPTION,
      inputSchema: NGRX_HISTORY_SCHEMAS.test,
      handler: async (args: Record<string, unknown>) => {
        const session = sessionArgument(args);
        if (session === null) return { markdown: PAGE_TOOL_SESSION_TEXT };
        return {
          markdown: testText(
            await history({
              pageId: pageArgument(args),
              session,
              request: {
                type: 'test',
                storeId: session ? text(args?.['store']) : storeOf(args, pageArgument(args)),
                from: args?.['from'],
                to: args?.['to'],
              },
            }),
          ),
        };
      },
    },
    {
      id: 'pangular:ngrx-restore',
      title: 'Restore NgRx state',
      description: RESTORE_NGRX_STATE_DESCRIPTION,
      inputSchema: NGRX_HISTORY_SCHEMAS.restore,
      handler: async (args: Record<string, unknown>) => {
        const page = pageArgument(args);
        if (page && !deps.page(page)) {
          return { markdown: unknownPageText(page, deps.pages(), 'NgRx state') };
        }
        const seq = args?.['seq'];
        const latest = args?.['latest'] === true;
        if (!latest && (typeof seq !== 'number' || !Number.isInteger(seq))) {
          return { markdown: refusal('Pass `seq` of a restorable log entry, or `latest: true`.') };
        }
        const request: NgrxRequest = latest
          ? { type: 'latest' }
          : { type: 'restore', seq: seq as number };
        return { markdown: restoreText(await deps.ask(page, request)) };
      },
    },
  ];

  return {
    importSession,
    history,
    tools,
    /** Imported sessions kept now, for tests. */
    importedCount: () => (expire(), imported.size),
  };
}

function json(value: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(value, null, 2) ?? 'undefined';
  } catch {
    text = String(value);
  }
  return '```json\n' + (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}\n…` : text) + '\n```';
}

/** The State, Diff and Action of one entry, as markdown. */
export function entryDetailText(
  answer: HistoryAnswer,
  where: string,
  entry?: Partial<NgrxLogEntry> | Omit<NgrxSession['entries'][number], 'changes'>,
): string {
  if (!answer.ok || !answer.detail) {
    const error = (answer.error ?? '').replace(/^_[^\n]*_\n\n/, '');
    const place = where ? ` ${where}` : '';
    // Nothing was read, so it is a refusal; an imported session reads without a page.
    return refusal(
      untrusted(
        `Could not read entry state${place}. ${error} To read a recorded session without a page, import it with pangular:ngrx-import-session and pass its id as \`session\`.`.trim(),
      ),
    );
  }
  const { detail } = answer;
  const lines = [`## Entry #${detail.seq} on \`${detail.storeId}\` ${where}`];
  if (entry) {
    lines.push('', '### Action');
    const action: Record<string, unknown> = { type: entry.type };
    if (entry.action !== undefined) action['action'] = entry.action;
    if (entry.args?.length) action['args'] = entry.args;
    if (entry.origin) action['origin'] = entry.origin;
    if (entry.causedByEvent) action['causedByEvent'] = entry.causedByEvent;
    lines.push(json(action));
  }
  lines.push('', '### Diff');
  lines.push(
    detail.diff.length
      ? detail.diff
          .map(
            (d) =>
              `- \`${d.path}\` ${d.op}${'before' in d ? ` ${JSON.stringify(d.before)}` : ''}${'before' in d && 'after' in d ? ' →' : ''}${'after' in d ? ` ${JSON.stringify(d.after)}` : ''}`,
          )
          .join('\n') + (detail.diffTruncated ? `\n- ${moreChangesText(detail.diffTruncated)}` : '')
      : '_The state did not change._',
  );
  lines.push('', '### State after', json(detail.after));
  return untrusted(lines.join('\n'));
}

/** An exported session as markdown, with the JSON when it fits. */
export function exportText(answer: HistoryAnswer): string {
  if (!answer.ok || !answer.session) {
    return untrusted(`Nothing exported. ${answer.error ?? ''}`.trim());
  }
  const { json: body } = sessionJson(answer.session);
  const { session } = answer;
  const head = `Exported ${session.entries.length} ${session.entries.length === 1 ? 'entry' : 'entries'} of \`${session.store.id}\`${session.store.name ? ` (${session.store.name})` : ''}: the redacted state before the first entry, then each entry with the changes it made. Save it as a .json file; the NgRx Store page and pangular:ngrx-import-session read it back.`;
  if (body.length > MAX_TOOL_SESSION_CHARS) {
    return untrusted(
      `${head}\n\nThe session is ${body.length.toLocaleString('en-US')} characters, more than this answer carries (${MAX_TOOL_SESSION_CHARS.toLocaleString('en-US')}). Pass \`from\` and \`to\` to export a shorter range, or use **Export session** on the NgRx Store page.`,
    );
  }
  return untrusted(`${head}\n\n\`\`\`json\n${body}\n\`\`\``);
}

/** The ngrx-import-session answer. */
export function importText(result: ImportedSummary | { error: string }): string {
  if ('error' in result) return `Not imported: ${result.error}`;
  const first = result.entries[0]?.seq;
  const last = result.entries.at(-1)?.seq;
  return untrusted(
    `Imported session \`${result.id}\`: ${result.entries.length} ${result.entries.length === 1 ? 'entry' : 'entries'} of \`${result.store.id}\` (${result.store.kind}${result.store.name ? `, ${result.store.name}` : ''})${first !== undefined ? `, #${first} to #${last}` : ''}. Pass \`session: "${result.id}"\` to pangular:ngrx-inspect-entry or pangular:ngrx-generate-test. The server keeps it for an hour after its last use, and at most ${MAX_IMPORTED} sessions.\n\n${result.entries
      .slice(0, 100)
      .map((entry) => `- #${entry.seq} \`${entry.type}\``)
      .join(
        '\n',
      )}${result.entries.length > 100 ? `\n- … ${result.entries.length - 100} more` : ''}`,
  );
}

/** The ngrx-generate-test answer. */
export function testText(answer: HistoryAnswer): string {
  if (!answer.ok || !answer.test)
    return untrusted(`No test generated. ${answer.error ?? ''}`.trim());
  const { test } = answer;
  return untrusted(
    `A ${TEST_FRAMEWORK} spec that replays the range: the state before it, the recorded actions or method calls in order, and the state after it as the expectation. Save it as \`${test.file}\` next to the code it tests and point the import there.${test.notes.length ? `\n\n${test.notes.map((note) => `- ${note}`).join('\n')}` : ''}\n\n\`\`\`ts\n${test.code}\`\`\``,
  );
}

/** The answer when a page tool passes `session`: imported sessions are read over MCP only. */
export const PAGE_TOOL_SESSION_TEXT =
  'Imported NgRx sessions are read over MCP only. From the page, leave `session` out to read the live page.';

const PAGE = {
  type: 'string',
  description: 'Page id, when more than one tab reports NgRx state.',
} as const;
const SESSION = {
  type: 'string',
  description:
    'Optional. The id pangular:ngrx-import-session returned, to read an imported session instead of the live page.',
} as const;
const RANGE = {
  store: {
    type: 'string',
    description:
      'Store id or name: `store` for @ngrx/store, or a signal store id such as `ngrx-1` or its name. Defaults to @ngrx/store, or the one store with entries.',
  },
  from: { type: 'integer', description: 'Optional. First log entry `seq` to include.' },
  to: { type: 'integer', description: 'Optional. Last log entry `seq` to include.' },
} as const;

export const INSPECT_NGRX_ENTRY_DESCRIPTION =
  "One past NgRx entry (`seq`): the store's state right after it, the diff from before it and the action or method call. Reads the live page or an imported `session`.";
export const EXPORT_NGRX_SESSION_DESCRIPTION =
  "Export one store's recorded NgRx session as JSON (`store`, optional `from`/`to`) to import later or turn into a test. Answers with the JSON up to 60,000 characters.";
export const IMPORT_NGRX_SESSION_DESCRIPTION =
  'Import an exported NgRx session (`session`, JSON text) to read with ngrx-inspect-entry and ngrx-generate-test. Checked first; kept in server memory for an hour, 5 at most. Changes nothing in the app.';
export const GENERATE_NGRX_TEST_DESCRIPTION =
  'Generate a Vitest spec from recorded NgRx entries (`store`, `from`/`to`, live or `session`): the state before, the actions or method calls, and the state after as the expectation.';
export const RESTORE_NGRX_STATE_DESCRIPTION =
  'Restore a past NgRx state (dev only): `seq` sets a signal store back, or jumps Store DevTools for @ngrx/store; `latest: true` returns to the latest. Needs `page` when several tabs report NgRx, and actions.ngrx.';

/** The input schemas of the NgRx history tools. */
export const NGRX_HISTORY_SCHEMAS = {
  entry: {
    type: 'object',
    properties: {
      seq: { type: 'integer', description: 'Log entry number.' },
      page: PAGE,
      session: SESSION,
    },
    required: ['seq'],
  },
  export: { type: 'object', properties: { ...RANGE, page: PAGE } },
  import: {
    type: 'object',
    properties: {
      session: {
        type: 'string',
        description: 'The exported session as JSON text.',
      },
    },
    required: ['session'],
  },
  test: { type: 'object', properties: { ...RANGE, page: PAGE, session: SESSION } },
  restore: {
    type: 'object',
    properties: {
      seq: { type: 'integer', description: 'Log entry number of a restorable entry.' },
      latest: {
        type: 'boolean',
        description: 'Send Store DevTools back to the latest state instead of restoring an entry.',
      },
      page: PAGE,
    },
  },
} as const;

/** The ngrx-restore answer. The page writes the message, so it sits behind the notice. */
export function restoreText(result: NgrxRequestResult): string {
  if (result.error) {
    // A refusal from the request may carry the notice already; it is shown once.
    const error = result.error.startsWith(UNTRUSTED)
      ? result.error.slice(UNTRUSTED.length).trimStart()
      : result.error;
    return refusal(untrusted(`Not restored: ${error}`));
  }
  return untrusted(
    `${result.message ?? 'Restored.'}\n\nRead pangular:ngrx-history for the new Restore entry.`,
  );
}
