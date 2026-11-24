import { PANEL_TABS, type PanelLink } from '@pangular-inspector/devtools/internal/config';
import {
  claimsReadOnly,
  traceCall,
  type WebMcpCallEntry,
  type WebMcpCertainty,
  type WebMcpEffectLayer,
  type WebMcpOutcome,
  type WebMcpPageTool,
  type WebMcpReport,
  type WebMcpTraceSources,
} from '@pangular-inspector/devtools/internal/webmcp-trace';

/** The WebMCP tab's data, as the `webmcp` shared state holds it. */
export interface WebMcpPageView extends WebMcpReport {
  reportedAt?: number;
}

export const ALL_PAGES = 'all';

export type WebMcpTone = 'ok' | 'warn' | 'danger';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** The pages that report WebMCP, the most recent report first. */
export function webMcpPages(state: unknown): WebMcpPageView[] {
  const pages = record(state)['pages'];
  const list = Array.isArray(pages) ? pages : Object.values(record(pages));
  return list
    .filter(
      (page): page is WebMcpPageView =>
        !!page && typeof page === 'object' && typeof (page as WebMcpPageView).pageId === 'string',
    )
    .map((page) => ({
      ...page,
      tools: Array.isArray(page.tools) ? page.tools : [],
      calls: Array.isArray(page.calls) ? page.calls : [],
      modelContext: page.modelContext === true,
    }))
    .sort((a, b) => (b.reportedAt ?? 0) - (a.reportedAt ?? 0));
}

/** This tab's page while it reports, else the only page, else every page. */
export function defaultWebMcpPage(pages: WebMcpPageView[], hostPageId: string | null): string {
  if (hostPageId && pages.some((page) => page.pageId === hostPageId)) return hostPageId;
  return pages.length === 1 ? pages[0].pageId : ALL_PAGES;
}

export function pickPages(pages: WebMcpPageView[], pageId: string): WebMcpPageView[] {
  return pages.filter((page) => pageId === ALL_PAGES || page.pageId === pageId);
}

export function pageLabel(page: Pick<WebMcpPageView, 'pageId' | 'title' | 'url'>): string {
  return page.title || page.url || page.pageId;
}

const STATUS_TEXT: Record<WebMcpPageTool['status'], string> = {
  registering: 'registering',
  registered: 'registered',
  failed: 'failed',
};

const STATUS_TONE: Record<WebMcpPageTool['status'], WebMcpTone | undefined> = {
  registering: undefined,
  registered: 'ok',
  failed: 'danger',
};

export interface WebMcpInput {
  text: string;
  required: boolean;
}

export interface WebMcpToolRow {
  /** Unique over every page. */
  key: string;
  pageId: string;
  name: string;
  description: string;
  status: WebMcpPageTool['status'];
  statusText: string;
  tone?: WebMcpTone;
  error?: string;
  duplicate: boolean;
  /** The annotations the page claims, as `name: value` text. */
  claims: string[];
  /** Whether the tool claims `readOnlyHint: true`; any other tool may change data. */
  readOnly: boolean;
  inputs: WebMcpInput[];
  formId?: string;
  /** The tool was found in a tool list, so its calls from before the inspector are unknown. */
  listed: boolean;
}

function inputPath(line: string): string {
  return line.split(':')[0].trim();
}

export function toolRow(tool: WebMcpPageTool, pageId: string, index = 0): WebMcpToolRow {
  const required = new Set(tool.required ?? []);
  return {
    key: `${pageId}:${tool.name}:${index}`,
    pageId,
    name: tool.name,
    description: tool.description ?? '',
    status: tool.status,
    statusText: STATUS_TEXT[tool.status] ?? tool.status,
    ...(STATUS_TONE[tool.status] ? { tone: STATUS_TONE[tool.status] } : {}),
    ...(tool.error ? { error: tool.error } : {}),
    duplicate: tool.duplicate === true,
    claims: Object.entries(tool.annotations ?? {}).map(([name, value]) => `${name}: ${value}`),
    readOnly: claimsReadOnly(tool),
    inputs: (tool.inputs ?? []).map((text) => ({ text, required: required.has(inputPath(text)) })),
    ...(tool.formId ? { formId: tool.formId } : {}),
    listed: tool.seen === 'list',
  };
}

/** The tools of the picked pages, in the order each page registered them. */
export function toolRows(pages: WebMcpPageView[], pageId: string): WebMcpToolRow[] {
  return pickPages(pages, pageId).flatMap((page) =>
    page.tools.map((tool, index) => toolRow(tool, page.pageId, index)),
  );
}

const OUTCOME_TEXT: Record<WebMcpOutcome, string> = {
  running: 'running',
  submitted: 'submitted',
  failed: 'failed',
  done: 'done',
  threw: 'threw',
};

export function outcomeText(outcome: WebMcpOutcome): string {
  return OUTCOME_TEXT[outcome] ?? outcome;
}

export function outcomeTone(outcome: WebMcpOutcome): WebMcpTone | undefined {
  if (outcome === 'threw' || outcome === 'failed') return 'danger';
  if (outcome === 'done' || outcome === 'submitted') return 'ok';
  return undefined;
}

/** A masked value as text. The server masked it already; this never renders HTML. */
export function valueText(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

export interface WebMcpCallRow {
  /** Unique over every page: `<pageId>:<call id>`. */
  key: string;
  pageId: string;
  /** The call's id on its page, which deep links use. */
  id: string;
  tool: string;
  at: number;
  ms?: number;
  outcome: WebMcpOutcome;
  outcomeText: string;
  tone?: WebMcpTone;
  args?: string;
  result?: string;
  detail?: string;
  formId?: string;
  userInput: boolean;
  entry: WebMcpCallEntry;
}

export function callRow(call: WebMcpCallEntry, pageId: string): WebMcpCallRow {
  const tone = outcomeTone(call.outcome);
  return {
    key: `${pageId}:${call.id}`,
    pageId,
    id: String(call.id),
    tool: call.tool,
    at: call.at,
    ...(typeof call.ms === 'number' ? { ms: call.ms } : {}),
    outcome: call.outcome,
    outcomeText: outcomeText(call.outcome),
    ...(tone ? { tone } : {}),
    ...(call.args !== undefined ? { args: valueText(call.args) } : {}),
    ...(call.result !== undefined ? { result: valueText(call.result) } : {}),
    ...(call.detail ? { detail: call.detail } : {}),
    ...(call.formId ? { formId: call.formId } : {}),
    userInput: call.userInput === true,
    entry: call,
  };
}

/** The calls of the picked pages, newest first. */
export function callRows(pages: WebMcpPageView[], pageId: string): WebMcpCallRow[] {
  return pickPages(pages, pageId)
    .flatMap((page) => page.calls.map((call) => callRow(call, page.pageId)))
    .sort((a, b) => b.at - a.at || Number(b.id) - Number(a.id));
}

/** Older calls the picked pages dropped at `limits.webmcpCalls`. */
export function droppedCalls(pages: WebMcpPageView[], pageId: string): number {
  return pickPages(pages, pageId).reduce((sum, page) => sum + (page.dropped ?? 0), 0);
}

const LAYER_LABEL: Record<WebMcpEffectLayer, string> = {
  http: 'HTTP',
  ngrx: 'NgRx',
  router: 'Router',
  forms: 'Forms',
  signals: 'Signals',
};

const TAB_LABEL: Record<string, string> = Object.fromEntries(
  PANEL_TABS.map((tab) => [tab.id, tab.label]),
);

const CERTAINTY_TEXT: Record<WebMcpCertainty, string> = {
  caused: 'caused',
  during: 'probably caused',
};

export interface WebMcpEffectRow {
  key: string;
  layer: WebMcpEffectLayer;
  layerLabel: string;
  title: string;
  detail?: string;
  at: number;
  certainty: WebMcpCertainty;
  certaintyText: string;
  /** Whether the effect changed data: outside the component, or a signal write. */
  write: boolean;
  link: PanelLink;
  tabLabel: string;
}

export interface WebMcpCallTrace {
  effects: WebMcpEffectRow[];
  verdict?: 'warning' | 'info';
  verdictText?: string;
  userInput: boolean;
}

const VERDICT_TEXT = {
  warning: 'The tool claims readOnlyHint, but this call changed data outside signals.',
  info: "The tool claims readOnlyHint. This call changed local state: it wrote only the app's own signals.",
} as const;

/** The tool `call` ran on its page, when the page still lists it. */
export function toolOf(pages: WebMcpPageView[], call: WebMcpCallRow): WebMcpPageTool | undefined {
  return pages.find((page) => page.pageId === call.pageId)?.tools.find((t) => t.name === call.tool);
}

/** What `call` did on its page, joined from the other inspectors' shared states. */
export function traceRow(
  call: WebMcpCallRow,
  pages: WebMcpPageView[],
  sources: WebMcpTraceSources,
  now?: number,
): WebMcpCallTrace {
  const tool = toolOf(pages, call);
  const trace = traceCall(call.entry, call.pageId, sources, {
    ...(tool ? { tool } : {}),
    ...(now !== undefined ? { now } : {}),
  });
  return {
    effects: trace.effects.map((effect, index) => ({
      key: `${effect.layer}:${effect.key}:${index}`,
      layer: effect.layer,
      layerLabel: LAYER_LABEL[effect.layer] ?? effect.layer,
      title: effect.title,
      ...(effect.detail ? { detail: effect.detail } : {}),
      at: effect.at,
      certainty: effect.certainty,
      certaintyText: CERTAINTY_TEXT[effect.certainty],
      write: effect.change !== 'none',
      link: {
        tab: effect.tab,
        ...(effect.id ? { id: effect.id } : {}),
        ...(call.pageId ? { page: call.pageId } : {}),
      },
      tabLabel: TAB_LABEL[effect.tab] ?? effect.tab,
    })),
    ...(trace.verdict ? { verdict: trace.verdict, verdictText: VERDICT_TEXT[trace.verdict] } : {}),
    userInput: trace.userInput,
  };
}
