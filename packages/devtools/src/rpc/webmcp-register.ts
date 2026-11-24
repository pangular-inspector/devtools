import { createSharedState } from 'devframe/utils/shared-state';
import type { AgentRegistrar, Register } from '../devframe-env.ts';
import { redactMessage, redactUrl } from '../router.ts';
import { serialize } from '../serialize.ts';
import {
  claimsReadOnly,
  traceCall,
  type WebMcpCallEntry,
  type WebMcpEffect,
  type WebMcpEffectKey,
  type WebMcpEffectLayer,
  type WebMcpOutcome,
  type WebMcpPageTool,
  type WebMcpReport,
  type WebMcpTraceSources,
} from '../webmcp-trace.ts';
import { defaultPage } from './default-page.ts';
import { code, untrusted } from './forms-tools.ts';
import { trackPageSessions } from './page-sessions.ts';
import type { PageTtl } from './page-ttl.ts';
import { PAGE_ARGUMENT, byRecency, pageArgument, unknownPageText } from './pages.ts';

type AnyRecord = Record<string, unknown>;

export interface WebMcpPage extends WebMcpReport {
  reportedAt: number;
}

/** The `webmcp` shared state. */
export interface WebMcpState {
  pages: Record<string, WebMcpPage>;
}

const OUTCOMES: readonly WebMcpOutcome[] = ['running', 'submitted', 'failed', 'done', 'threw'];
const LAYERS: readonly WebMcpEffectLayer[] = ['http', 'ngrx', 'router', 'forms', 'signals'];
const STATUSES: readonly WebMcpPageTool['status'][] = ['registering', 'registered', 'failed'];
const SEEN: readonly WebMcpPageTool['seen'][] = ['register', 'list', 'error'];
const MAX_TOOLS = 40;
const MAX_CALLS = 1000;
const MAX_LINES = 50;
const VALUE_LIMITS = { depth: 6, keys: 50, items: 50, text: 1000, budget: 400 };

function oneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return (list as readonly unknown[]).includes(value);
}

function record(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function text(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value ? redactMessage(value.slice(0, max)) : undefined;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function strings(value: unknown, max: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value
    .filter((item): item is string => typeof item === 'string')
    .slice(0, max)
    .map((item) => item.slice(0, 300));
  return out.length ? out : undefined;
}

function annotations(value: unknown): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const [key, hint] of Object.entries(record(value)).slice(0, 20)) {
    if (typeof hint === 'boolean' || finite(hint)) out[key.slice(0, 60)] = hint;
    else if (typeof hint === 'string') out[key.slice(0, 60)] = redactMessage(hint.slice(0, 200));
  }
  return Object.keys(out).length ? out : undefined;
}

function toTool(value: unknown): WebMcpPageTool | null {
  const tool = record(value);
  const name = text(tool['name'], 200);
  if (!name) return null;
  const notes = annotations(tool['annotations']);
  const inputs = strings(tool['inputs'], 40);
  const required = strings(tool['required'], 40);
  const error = text(tool['error'], 300);
  const formId = text(tool['formId'], 200);
  const { status, seen } = tool;
  return {
    name,
    description: text(tool['description'], 500) ?? '',
    status: oneOf(STATUSES, status) ? status : 'registered',
    seen: oneOf(SEEN, seen) ? seen : 'register',
    ...(error ? { error } : {}),
    ...(notes ? { annotations: notes } : {}),
    ...(inputs ? { inputs } : {}),
    ...(required ? { required } : {}),
    ...(formId ? { formId } : {}),
    ...(tool['duplicate'] === true ? { duplicate: true } : {}),
    ...(finite(tool['registeredAt']) ? { registeredAt: tool['registeredAt'] } : {}),
  };
}

function toCall(value: unknown): WebMcpCallEntry | null {
  const call = record(value);
  const tool = text(call['tool'], 200);
  // `at` must make a valid date: the answer prints it with `toISOString()`.
  if (!tool || !finite(call['id']) || !validTime(call['at'])) return null;
  const caused: WebMcpEffectKey[] = (Array.isArray(call['caused']) ? call['caused'] : [])
    .slice(0, 100)
    .flatMap((item: unknown) => {
      const { layer, key } = record(item);
      return oneOf(LAYERS, layer) && typeof key === 'string'
        ? [{ layer, key: key.slice(0, 300) }]
        : [];
    });
  const detail = text(call['detail'], 300);
  const formId = text(call['formId'], 200);
  const { outcome } = call;
  // The page masks values already; the server masks again with its own secret names.
  return {
    id: call['id'],
    tool,
    at: call['at'],
    ...(finite(call['ms']) && call['ms'] >= 0 ? { ms: call['ms'] } : {}),
    outcome: oneOf(OUTCOMES, outcome) ? outcome : 'done',
    ...(call['args'] !== undefined ? { args: serialize(call['args'], VALUE_LIMITS) } : {}),
    ...(call['result'] !== undefined ? { result: serialize(call['result'], VALUE_LIMITS) } : {}),
    ...(detail ? { detail } : {}),
    ...(call['userInput'] === true ? { userInput: true } : {}),
    ...(caused.length ? { caused } : {}),
    ...(formId ? { formId } : {}),
    ...(call['tried'] === true ? { tried: true } : {}),
    ...(call['readOnly'] === true ? { readOnly: true } : {}),
  };
}

/** The largest time a `Date` holds, in ms either side of the epoch. */
const MAX_TIME = 8.64e15;

function validTime(value: unknown): value is number {
  return finite(value) && Math.abs(value) <= MAX_TIME;
}

/** Reads a `push-webmcp` report; `null` when it is not one. */
export function toWebMcpPage(message: unknown, now = Date.now()): WebMcpPage | null {
  const report = record(message);
  const pageId = report['pageId'];
  if (typeof pageId !== 'string' || !pageId || pageId.length >= 50) return null;
  const tools = (Array.isArray(report['tools']) ? report['tools'] : [])
    .slice(0, MAX_TOOLS)
    .flatMap((tool: unknown) => toTool(tool) ?? []);
  const calls = (Array.isArray(report['calls']) ? report['calls'] : [])
    .slice(-MAX_CALLS)
    .flatMap((call: unknown) => toCall(call) ?? []);
  const url = typeof report['url'] === 'string' ? redactUrl(report['url'].slice(0, 2000)) : '';
  const title = text(report['title'], 200);
  return {
    pageId,
    ...(url ? { url } : {}),
    ...(title ? { title } : {}),
    modelContext: report['modelContext'] === true,
    tools,
    calls,
    ...(finite(report['dropped']) && report['dropped'] > 0 ? { dropped: report['dropped'] } : {}),
    reportedAt: now,
  };
}

function json(value: unknown, max = 600): string {
  let out: string;
  try {
    out = typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
  } catch {
    out = String(value);
  }
  return out.length > max ? `${out.slice(0, max - 1)}…` : out;
}

function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function pickPage(
  state: WebMcpState,
  page: string | undefined,
): { page?: WebMcpPage; text?: string; others: WebMcpPage[] } {
  const pages = byRecency(Object.values(state.pages));
  if (!pages.length) {
    return {
      text: 'No page reports WebMCP tools. Open the app with the overlay loaded in a browser that has `document.modelContext` (or a WebMCP polyfill), and register a tool with `registerTool()` or Angular Signal Forms (`provideExperimentalWebMcpForms()`).',
      others: [],
    };
  }
  const chosen = page ? pages.find((p) => p.pageId === page) : defaultPage(pages);
  if (!chosen) return { text: unknownPageText(page!, pages, 'WebMCP tools'), others: [] };
  return { page: chosen, others: page ? [] : pages.filter((p) => p !== chosen) };
}

function otherPages(others: WebMcpPage[]): string[] {
  return others.length
    ? [
        '',
        `Other pages report WebMCP too: ${others.map((p) => code(p.pageId)).join(', ')}. Pass one as \`page\`.`,
      ]
    : [];
}

function hints(tool: WebMcpPageTool): string {
  const entries = Object.entries(tool.annotations ?? {});
  return entries.length ? entries.map(([key, value]) => `${key}: ${String(value)}`).join(', ') : '';
}

/** The `webmcp-tools` answer. */
export function webMcpToolsText(state: WebMcpState, args: { page?: string } = {}): string {
  const { page, text: empty, others } = pickPage(state, args.page);
  if (!page) return empty!;
  const lines = [
    `WebMCP tools of page ${code(page.pageId)}${page.url ? ` (${code(page.url)})` : ''}. ${
      page.modelContext
        ? 'The page has `modelContext`.'
        : 'The page has no `modelContext`, so a browser agent sees none of these tools.'
    } Annotations are what the page claims; a tool without \`readOnlyHint: true\` may change data.`,
  ];
  if (!page.tools.length) {
    lines.push('', 'No tool is registered right now.');
  } else {
    lines.push(
      '',
      '| Tool | Status | Annotations | Form | Inputs |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const tool of page.tools) {
      const status = `${tool.status}${tool.duplicate ? ', duplicate name' : ''}${tool.error ? `: ${tool.error}` : ''}`;
      lines.push(
        `| ${code(tool.name)} | ${cell(status)} | ${cell(hints(tool)) || '—'} | ${tool.formId ? code(tool.formId) : '—'} | ${cell((tool.inputs ?? []).join(', ')) || '—'} |`,
      );
    }
    lines.push('', '### Descriptions', '');
    for (const tool of page.tools) {
      lines.push(`- ${code(tool.name)}: ${tool.description || '(no description)'}`);
    }
  }
  lines.push(...otherPages(others));
  // Names, descriptions and annotations come from the page.
  return untrusted(lines.join('\n'));
}

export interface WebMcpCallsArgs {
  page?: string;
  tool?: string;
  limit?: unknown;
}

function effectLine(effect: WebMcpEffect): string {
  const certainty = effect.certainty === 'caused' ? 'caused' : 'probably caused';
  const change =
    effect.change === 'write'
      ? ', changes data'
      : effect.change === 'signal'
        ? effect.framework
          ? ', Angular signal'
          : ', app signal'
        : '';
  return `  - ${effect.layer}: ${effect.title}${effect.detail ? ` (${effect.detail})` : ''}, ${certainty}${change}`;
}

/** The `webmcp-calls` answer: calls newest first, each with its trace. */
export function webMcpCallsText(
  state: WebMcpState,
  sources: WebMcpTraceSources,
  args: WebMcpCallsArgs = {},
  now = Date.now(),
): string {
  const { page, text: empty, others } = pickPage(state, args.page);
  if (!page) return empty!;
  const limit = finite(args.limit) ? Math.max(1, Math.min(MAX_LINES, Math.round(args.limit))) : 10;
  const calls = page.calls
    .filter((call) => !args.tool || call.tool === args.tool)
    .slice()
    .reverse()
    .slice(0, limit);
  const lines = [
    `WebMCP tool calls of page ${code(page.pageId)}, newest first. Values are masked. An effect is *caused* when a collector saw it start while the call ran (or in its Zone.js zone), and *probably caused* when it started between the call's start and its end plus 500 ms with no user input. Signal writes are seen only for the component the Signals tab inspects.`,
  ];
  if (!calls.length) {
    lines.push(
      '',
      args.tool ? `No call of ${code(args.tool)} is recorded.` : 'No tool has been called yet.',
    );
  }
  for (const call of calls) {
    const tool = page.tools.find((t) => t.name === call.tool);
    const readOnly = call.readOnly ?? claimsReadOnly(tool);
    const trace = traceCall(call, page.pageId, sources, { tool, now });
    const when = new Date(call.at).toISOString();
    lines.push(
      '',
      `### ${code(call.tool)} #${call.id}: ${call.outcome}${finite(call.ms) ? ` in ${call.ms} ms` : ''}${call.tried ? ' (tried from the panel)' : ''}`,
      '',
      `- At: ${when}${call.formId ? `, form ${code(call.formId)}` : ''}`,
    );
    if (call.args !== undefined) lines.push(`- Arguments: \`${cell(json(call.args))}\``);
    if (call.result !== undefined) lines.push(`- Result: \`${cell(json(call.result))}\``);
    if (call.detail) lines.push(`- Detail: ${call.detail}`);
    if (trace.verdict === 'warning') {
      lines.push(
        `- **Warning:** the tool claims \`readOnlyHint\`, but this call changed data outside signals.`,
      );
    } else if (trace.verdict === 'info') {
      lines.push(`- Note: the tool claims \`readOnlyHint\` and this call wrote app signals.`);
    } else if (!readOnly && tool) {
      lines.push('- The tool does not claim `readOnlyHint`.');
    }
    if (trace.userInput) {
      lines.push('- The user was active during the call, so only caused effects are listed.');
    }
    if (trace.effects.length) {
      lines.push('- Effects:');
      for (const effect of trace.effects) lines.push(effectLine(effect));
    } else {
      lines.push('- No effects seen.');
    }
  }
  if (page.dropped) {
    lines.push(
      '',
      `_${page.dropped} older calls were dropped at the limit. Raise \`limits.webmcpCalls\` in the Pangular Inspector configuration to keep more._`,
    );
  }
  lines.push(...otherPages(others));
  // Tool names, values and effect titles come from the page.
  return untrusted(lines.join('\n'));
}

interface Scoped {
  rpc: { sharedState(name: string, options: AnyRecord): Promise<unknown> };
}

/** The parts of devframe's shared state this inspector uses. */
interface SharedWebMcp {
  value(): WebMcpState;
  mutate(change: (draft: WebMcpState) => void): void;
}

export interface WebMcpHost {
  my: Scoped;
  rpcHost: unknown;
  register: Register;
  agent: AgentRegistrar;
  owns(pageId: unknown): pageId is string;
  mayForget(pageId: unknown): pageId is string;
  ttl: PageTtl;
  /** The shared states the trace joins: HTTP, NgRx, router, forms and signals. */
  sources(): WebMcpTraceSources;
}

export interface WebMcpRegistration {
  pages(): { pageId: string; reportedAt: number; url?: string; title?: string }[];
  expire(now?: number): void;
}

/**
 * The `webmcp` inspector on the server: the `webmcp` shared state, the
 * `push-webmcp` and `forget-webmcp-page` RPC functions and the `webmcp-tools`
 * and `webmcp-calls` agent tools.
 */
export async function registerWebMcp(host: WebMcpHost): Promise<WebMcpRegistration> {
  const shared = (await host.my.rpc.sharedState('webmcp', {
    sharedState: createSharedState<WebMcpState>({
      initialValue: { pages: {} },
      enablePatches: true,
    }),
  })) as SharedWebMcp;
  const state = () => shared.value();
  const drop = (pageIds: readonly string[]) => {
    const present = pageIds.filter((id) => state().pages[id]);
    if (!present.length) return;
    shared.mutate((draft) => {
      for (const id of present) delete draft.pages[id];
    });
  };
  const sessions = trackPageSessions(host.rpcHost, drop);

  host.register({
    name: 'push-webmcp',
    type: 'action',
    jsonSerializable: true,
    handler: (message: unknown) => {
      const page = toWebMcpPage(message);
      if (!page || !host.owns(page.pageId)) return;
      sessions.bind(page.pageId);
      shared.mutate((draft) => {
        draft.pages[page.pageId] = page;
      });
    },
  });

  host.register({
    name: 'forget-webmcp-page',
    type: 'action',
    jsonSerializable: true,
    handler: (pageId: unknown) => {
      if (!host.mayForget(pageId)) return;
      sessions.unbind(pageId);
      drop([pageId]);
    },
  });

  host.agent.registerTool({
    id: 'pangular:webmcp-tools',
    title: 'List WebMCP tools',
    description:
      'The WebMCP tools the page registered with `modelContext.registerTool()` (Signal Forms tools included): name, description, status, the annotations the page claims (`readOnlyHint`), inputs and the form each belongs to. Only reads.',
    inputSchema: { type: 'object', properties: { page: PAGE_ARGUMENT } },
    handler: async (args: AnyRecord) => ({
      markdown: webMcpToolsText(state(), { page: pageArgument(args) }),
    }),
  });

  host.agent.registerTool({
    id: 'pangular:webmcp-calls',
    title: 'List WebMCP tool calls',
    description:
      "Calls of the page's WebMCP tools, newest first: masked arguments and result, outcome, and the HTTP requests, NgRx actions, navigations, form changes and signal writes each caused or probably caused. Warns when a `readOnlyHint` tool changed data. Filter by `tool`. Only reads.",
    inputSchema: {
      type: 'object',
      properties: {
        page: PAGE_ARGUMENT,
        tool: { type: 'string', description: 'Only calls of this tool.' },
        limit: { type: 'integer', description: 'How many calls to list (1-50, default 10).' },
      },
    },
    handler: async (args: AnyRecord) => ({
      markdown: webMcpCallsText(state(), host.sources(), {
        page: pageArgument(args),
        tool: typeof args?.['tool'] === 'string' ? args['tool'] : undefined,
        limit: args?.['limit'],
      }),
    }),
  });

  return {
    pages: () =>
      Object.values(state().pages).map((page) => ({
        pageId: page.pageId,
        reportedAt: page.reportedAt,
        url: page.url,
        title: page.title,
      })),
    expire: (now = Date.now()) =>
      drop(
        Object.values(state().pages)
          .filter((page) => now - page.reportedAt > host.ttl(page.pageId))
          .map((page) => page.pageId),
      ),
  };
}
