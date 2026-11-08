import { createSharedState } from 'devframe/utils/shared-state';
import { ngCodeOf } from '../ng-error-codes.ts';
import { redactMessage, redactUrl } from '../router.ts';
import {
  captureSsrConsoleErrors,
  takeServerErrors,
  type ServerErrorInput,
  type ServerErrorKind,
} from '../server-errors.ts';
import { clip } from '../text.ts';
import { code, untrusted } from './forms-tools.ts';

type AnyRecord = Record<string, unknown>;

/** The part of devframe's shared state used here. */
interface ServerErrorsShared {
  value(): ServerErrorsState;
  mutate(recipe: (draft: ServerErrorsState) => void): void;
}

/** One group of server errors with the same kind, message and place. */
export interface ServerErrorGroup {
  id: string;
  kind: ServerErrorKind;
  message: string;
  count: number;
  firstAt: number;
  lastAt: number;
  code?: string;
  stack?: string;
  url?: string;
  requestId?: string;
  plugin?: string;
  file?: string;
  line?: number;
  column?: number;
  frame?: string;
}

export interface ServerErrorsState {
  /** Most recent first. */
  errors: ServerErrorGroup[];
  /** Groups dropped at {@link MAX_SERVER_ERRORS} since the last clear. */
  dropped: number;
}

/** Groups kept; older ones are dropped. */
export const MAX_SERVER_ERRORS = 100;
/** A group with no repeat for this long expires, like page data does. */
export const SERVER_ERROR_TTL_MS = 30 * 60_000;

const mask = (text: string | undefined, max: number) =>
  text ? clip(redactMessage(text.slice(0, max * 2)), max) : undefined;

/** Masks and caps one captured error, as it is stored and shown. */
export function maskServerError(
  error: ServerErrorInput,
): Omit<ServerErrorGroup, 'id' | 'count' | 'firstAt' | 'lastAt'> {
  const message = mask(error.message, 1000) ?? '';
  const ngCode = ngCodeOf(undefined, message);
  return {
    kind: error.kind === 'vite' ? 'vite' : 'ssr',
    message,
    ...(ngCode ? { code: ngCode } : {}),
    ...(error.stack ? { stack: mask(error.stack, 8000) } : {}),
    ...(error.url ? { url: redactUrl(error.url.slice(0, 2000)) } : {}),
    ...(error.requestId ? { requestId: error.requestId.slice(0, 40) } : {}),
    ...(error.plugin ? { plugin: error.plugin.slice(0, 200) } : {}),
    ...(error.file ? { file: redactUrl(error.file.slice(0, 2000)) } : {}),
    ...(error.line !== undefined ? { line: error.line } : {}),
    ...(error.column !== undefined ? { column: error.column } : {}),
    ...(error.frame ? { frame: mask(error.frame, 4000) } : {}),
  };
}

const groupKey = (e: Pick<ServerErrorGroup, 'kind' | 'message' | 'file' | 'line' | 'url'>) =>
  `${e.kind}\u0000${e.message}\u0000${e.file ?? ''}:${e.line ?? ''}\u0000${e.kind === 'ssr' ? (e.url ?? '') : ''}`;

/** Adds one error to the state, as a new group or a repeat of one. */
export function mergeServerError(
  state: ServerErrorsState,
  error: ServerErrorInput,
  nextId: () => string,
): void {
  const masked = maskServerError(error);
  const at = error.at ?? Date.now();
  const key = groupKey(masked);
  const index = state.errors.findIndex((group) => groupKey(group) === key);
  if (index >= 0) {
    const [group] = state.errors.splice(index, 1);
    state.errors.unshift({ ...group!, ...masked, count: group!.count + 1, lastAt: at });
    return;
  }
  state.errors.unshift({ id: nextId(), ...masked, count: 1, firstAt: at, lastAt: at });
  if (state.errors.length > MAX_SERVER_ERRORS) {
    state.dropped += state.errors.length - MAX_SERVER_ERRORS;
    state.errors.length = MAX_SERVER_ERRORS;
  }
}

/** Ids of groups with no repeat for {@link SERVER_ERROR_TTL_MS}. */
export function staleServerErrors(state: ServerErrorsState, now = Date.now()): string[] {
  return state.errors.filter((group) => now - group.lastAt > SERVER_ERROR_TTL_MS).map((g) => g.id);
}

function ago(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 120) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min ago`;
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function placeOf(group: ServerErrorGroup): string {
  if (group.kind === 'ssr') return group.url ? code(group.url) : 'a server render';
  if (!group.file) return group.plugin ? code(group.plugin) : '';
  const line =
    group.line !== undefined
      ? `:${group.line}${group.column !== undefined ? `:${group.column}` : ''}`
      : '';
  return `${code(`${group.file}${line}`)}${group.plugin ? ` (${code(group.plugin)})` : ''}`;
}

/** `list-server-errors`: the dev server's SSR and Vite errors, most recent first. */
export function listServerErrorsText(
  state: ServerErrorsState,
  args: { kind?: unknown; id?: unknown; limit?: unknown } = {},
  now = Date.now(),
): string {
  const kind = args.kind === 'ssr' || args.kind === 'vite' ? args.kind : undefined;
  if (typeof args.id === 'string' && args.id) {
    const group = state.errors.find((g) => g.id === args.id);
    if (!group) {
      return `No server error with the id ${code(args.id)}. Call pangular:list-server-errors without \`id\` for the current ones; groups expire 30 minutes after their last repeat.`;
    }
    const parts = [
      `**${group.kind === 'ssr' ? 'SSR' : 'Vite'} error ${code(group.id)}**, ${group.count} time(s), last ${ago(group.lastAt, now)}, at ${placeOf(group) || 'an unknown place'}.`,
      '',
      '```text',
      group.message,
      '```',
    ];
    if (group.code)
      parts.push(
        '',
        `Angular code ${code(group.code)}: pass it to pangular:explain-error for the known cause.`,
      );
    if (group.requestId)
      parts.push(
        '',
        `SSR request ${code(group.requestId)}: pangular:explain-ssr-request shows its render.`,
      );
    if (group.frame) parts.push('', 'Code frame:', '', '```text', group.frame, '```');
    if (group.stack) parts.push('', 'Stack:', '', '```text', group.stack, '```');
    return untrusted(parts.join('\n'));
  }
  const all = state.errors.filter((group) => !kind || group.kind === kind);
  const limit = Math.min(Math.max(Math.floor(Number(args.limit) || 30), 1), MAX_SERVER_ERRORS);
  if (!all.length) {
    const what = kind === 'ssr' ? 'SSR errors' : kind === 'vite' ? 'Vite errors' : 'server errors';
    return `No ${what} in the last 30 minutes. SSR errors are what the server logs with console.error during a render (Angular's ErrorHandler); Vite errors are the transform and compile errors Vite shows in its browser overlay, captured only with the Vite plugin.`;
  }
  const rows = all
    .slice(0, limit)
    .map(
      (group) =>
        `| ${code(group.id)} | ${group.kind === 'ssr' ? 'SSR' : 'Vite'} | ${group.count} | ${ago(group.lastAt, now)} | ${cell(code(clip(group.message, 200)))} | ${cell(placeOf(group))} |`,
    );
  const more =
    all.length > limit ? `\n\n${all.length - limit} more; raise \`limit\` to see them.` : '';
  const dropped = state.dropped
    ? `\n\n${state.dropped} older group(s) were dropped to stay under ${MAX_SERVER_ERRORS}.`
    : '';
  return untrusted(
    `${all.length} server error group(s), most recent first. Pass an \`id\` for the message, code frame and stack.\n\n| Id | Kind | Count | Last | Message | Where |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}${more}${dropped}`,
  );
}

interface Scoped {
  rpc: { sharedState(name: string, options: AnyRecord): Promise<unknown> };
}

/**
 * devframe's RPC and agent definitions, as loose as `errors-register.ts`
 * takes them: the devframe server passes its own typed `register`.
 */
// oxlint-disable-next-line typescript/no-explicit-any
type Definition = Record<string, any>;

export interface ServerErrorsHost {
  my: Scoped;
  /** Registers an RPC function, skipped when the Errors inspector is off. */
  register(definition: Definition): void;
  agent: { registerTool(tool: Definition): void };
  /** Captures in this process. Off for the stdio MCP server, which renders nothing. */
  capture: boolean;
}

export interface ServerErrorsRegistration {
  /** Drops groups past their expiry; call it from the shared expiry interval. */
  expire(now?: number): void;
  state(): ServerErrorsState;
  /** Stops the captures this registration started. */
  dispose(): void;
}

/**
 * The server errors on the devframe server: the `server-errors` shared
 * state, the `clear-server-errors` RPC function and the
 * `list-server-errors` agent tool. It takes what `server-errors.ts` captured
 * in this process.
 */
export async function registerServerErrors(
  host: ServerErrorsHost,
): Promise<ServerErrorsRegistration> {
  const shared = (await host.my.rpc.sharedState('server-errors', {
    sharedState: createSharedState<ServerErrorsState>({
      initialValue: { errors: [], dropped: 0 },
      enablePatches: true,
    }),
  })) as unknown as ServerErrorsShared;
  const state = () => shared.value();
  let seq = 0;
  const nextId = () => `s${++seq}`;
  const stops: (() => void)[] = [];
  if (host.capture) {
    stops.push(captureSsrConsoleErrors());
    stops.push(
      takeServerErrors((error) =>
        shared.mutate((draft: ServerErrorsState) => mergeServerError(draft, error, nextId)),
      ),
    );
  }

  host.register({
    name: 'clear-server-errors',
    type: 'action',
    jsonSerializable: true,
    handler: () => {
      shared.mutate((draft: ServerErrorsState) => {
        draft.errors = [];
        draft.dropped = 0;
      });
    },
  });

  host.agent.registerTool({
    id: 'pangular:list-server-errors',
    title: 'List server errors',
    description:
      "Dev server errors no page reports, newest first: SSR errors (console.error during a render, Angular's ErrorHandler) and Vite transform errors (Vite plugin only). Repeats grouped; `id` shows one with its code frame and stack. Masked; expire 30 min after the last repeat.",
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['ssr', 'vite'],
          description: 'Only SSR or only Vite errors.',
        },
        id: {
          type: 'string',
          description: 'A group id from the list, such as s3, for its details.',
        },
        limit: { type: 'integer', description: 'How many groups to list (1-100, default 30).' },
      },
    },
    handler: async (args: AnyRecord) => ({ markdown: listServerErrorsText(state(), args ?? {}) }),
  });

  return {
    state,
    expire: (now = Date.now()) => {
      const stale = staleServerErrors(state(), now);
      if (!stale.length) return;
      shared.mutate((draft: ServerErrorsState) => {
        draft.errors = draft.errors.filter((group) => !stale.includes(group.id));
      });
    },
    dispose: () => {
      for (const stop of stops.splice(0)) stop();
    },
  };
}
