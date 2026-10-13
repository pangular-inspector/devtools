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
import { untrusted } from './forms-tools.ts';
import type { NgrxPageRecord } from './ngrx-tools.ts';
import { callerPage } from './page-scope.ts';
import { pageArgument, unknownPageText } from './pages.ts';

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
        query.storeId && query.storeId !== session.store.id ? { ...session, entries: [] } : session,
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

  const entryOf = (pageId: string | undefined, seq: number) =>
    (pageId ? deps.page(pageId) : deps.pages()[0])?.log.find((entry) => entry.seq === seq);

  /** The NgRx history agent tools; `restore-ngrx-state` is the one action among them. */
  const tools = [
    {
      id: 'pangular:inspect-ngrx-entry',
      description: INSPECT_NGRX_ENTRY_DESCRIPTION,
      inputSchema: NGRX_HISTORY_SCHEMAS.entry,
      handler: async (args: Record<string, unknown>) => {
        const seq = args?.['seq'];
        if (typeof seq !== 'number' || !Number.isInteger(seq)) {
          return { markdown: 'Pass `seq`, a log entry number.' };
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
      id: 'pangular:export-ngrx-session',
      description: EXPORT_NGRX_SESSION_DESCRIPTION,
      inputSchema: NGRX_HISTORY_SCHEMAS.export,
      handler: async (args: Record<string, unknown>) => ({
        markdown: exportText(
          await history({
            pageId: pageArgument(args),
            request: {
              type: 'export',
              storeId: args?.['storeId'],
              from: args?.['from'],
              to: args?.['to'],
            },
          }),
        ),
      }),
    },
    {
      id: 'pangular:import-ngrx-session',
      description: IMPORT_NGRX_SESSION_DESCRIPTION,
      inputSchema: NGRX_HISTORY_SCHEMAS.import,
      handler: async (args: Record<string, unknown>) => ({
        markdown: importText(importSession(args?.['session'])),
      }),
    },
    {
      id: 'pangular:generate-ngrx-test',
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
                storeId: args?.['storeId'],
                from: args?.['from'],
                to: args?.['to'],
              },
            }),
          ),
        };
      },
    },
    {
      id: 'pangular:restore-ngrx-state',
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
          return { markdown: 'Pass `seq` of a restorable log entry, or `latest: true`.' };
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
    return untrusted(`Could not read entry state ${where}. ${answer.error ?? ''}`.trim());
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
  const head = `Exported ${session.entries.length} ${session.entries.length === 1 ? 'entry' : 'entries'} of \`${session.store.id}\`${session.store.name ? ` (${session.store.name})` : ''}: the redacted state before the first entry, then each entry with the changes it made. Save it as a .json file; the NgRx Store page and pangular:import-ngrx-session read it back.`;
  if (body.length > MAX_TOOL_SESSION_CHARS) {
    return untrusted(
      `${head}\n\nThe session is ${body.length.toLocaleString('en-US')} characters, more than this answer carries (${MAX_TOOL_SESSION_CHARS.toLocaleString('en-US')}). Pass \`from\` and \`to\` to export a shorter range, or use **Export session** on the NgRx Store page.`,
    );
  }
  return untrusted(`${head}\n\n\`\`\`json\n${body}\n\`\`\``);
}

/** The import-ngrx-session answer. */
export function importText(result: ImportedSummary | { error: string }): string {
  if ('error' in result) return `Not imported: ${result.error}`;
  const first = result.entries[0]?.seq;
  const last = result.entries.at(-1)?.seq;
  return untrusted(
    `Imported session \`${result.id}\`: ${result.entries.length} ${result.entries.length === 1 ? 'entry' : 'entries'} of \`${result.store.id}\` (${result.store.kind}${result.store.name ? `, ${result.store.name}` : ''})${first !== undefined ? `, #${first} to #${last}` : ''}. Pass \`session: "${result.id}"\` to pangular:inspect-ngrx-entry or pangular:generate-ngrx-test. The server keeps it for an hour after its last use, and at most ${MAX_IMPORTED} sessions.\n\n${result.entries
      .slice(0, 100)
      .map((entry) => `- #${entry.seq} \`${entry.type}\``)
      .join(
        '\n',
      )}${result.entries.length > 100 ? `\n- … ${result.entries.length - 100} more` : ''}`,
  );
}

/** The generate-ngrx-test answer. */
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
    'Optional. The id pangular:import-ngrx-session returned, to read an imported session instead of the live page.',
} as const;
const RANGE = {
  storeId: {
    type: 'string',
    description:
      'Store id: `store` for @ngrx/store, or a signal store id such as `ngrx-1`. Defaults to @ngrx/store, or the one store with entries.',
  },
  from: { type: 'integer', description: 'Optional. First log entry `seq` to include.' },
  to: { type: 'integer', description: 'Optional. Last log entry `seq` to include.' },
} as const;

export const INSPECT_NGRX_ENTRY_DESCRIPTION =
  'The State, Diff and Action of one past NgRx entry: the full redacted state of its store right after it, every change from the state before it (up to 500), and the action, method arguments, origin and causing event. Pass `seq` from pangular:signal-store-history or the NgRx Store page. Reads the live page, which keeps the raw states of its most recent entries (the change log limit), or an imported session with `session`. Events have no state of their own.';
export const EXPORT_NGRX_SESSION_DESCRIPTION =
  'Export a recorded NgRx session of one store as JSON: the redacted state before the first entry, then each action or method call with the state changes it made, so it can be imported again later (pangular:import-ngrx-session, or the NgRx Store page) and turned into a test. Pass `storeId`, and `from`/`to` (log entry seqs) to cut the range. The page keeps its most recent entries only. Answers with the JSON when it fits in 60,000 characters.';
export const IMPORT_NGRX_SESSION_DESCRIPTION =
  'Import an NgRx session that pangular:export-ngrx-session or the NgRx Store page exported, to read it with pangular:inspect-ngrx-entry and pangular:generate-ngrx-test. Pass the JSON text as `session`. It is checked first: the format and version, at most 1000 entries and 4,000,000 characters, and change paths that cannot reach a prototype. Nothing in the app changes; the server keeps the session in memory for an hour after its last use, at most 5 at a time.';
export const GENERATE_NGRX_TEST_DESCRIPTION =
  'Generate a Vitest spec from a range of recorded NgRx entries: the state before the range, the dispatched actions (an @ngrx/store reducer spec, for one feature reducer when only one top-level key changed) or store method calls (a signalStore spec through TestBed, unprotected() and getState()), and the state after the range as the expectation. Pass `storeId` and `from`/`to`, from the live page or an imported `session`. The answer says which imports to point and which recorded values were cut or redacted.';
export const RESTORE_NGRX_STATE_DESCRIPTION =
  'Restore a past NgRx state in the running app (development only). Pass `seq` of a restorable log entry: a signal store gets its state keys set back to their values after that entry; @ngrx/store jumps Store DevTools to the state after that action (needs provideStoreDevtools(); new actions are logged but do not change the state until you go back). `latest: true` sends Store DevTools back to the latest state. Adds a Restore entry to the log. Without `page` it uses the one page that reports NgRx state; with several, it restores nothing and lists them. Needs actions.ngrx.';

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

/** The restore-ngrx-state answer. The page writes the message, so it sits behind the notice. */
export function restoreText(result: NgrxRequestResult): string {
  if (result.error) return untrusted(`Not restored: ${result.error}`);
  return untrusted(
    `${result.message ?? 'Restored.'}\n\nRead pangular:signal-store-history for the new Restore entry.`,
  );
}
