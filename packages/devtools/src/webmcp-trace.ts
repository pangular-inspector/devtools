/**
 * The WebMCP call trace: the shapes the `webmcp` collector reports, and the
 * pure join that links one tool call to what happened on the page around it.
 * The server's agent tools and the panel's WebMCP tab both run `traceCall`,
 * so they always agree. Nothing here touches the page.
 */

export type WebMcpOutcome = 'running' | 'submitted' | 'failed' | 'done' | 'threw';

/** The layers a call's effects come from; each matches a Timeline lane. */
export type WebMcpEffectLayer = 'http' | 'ngrx' | 'router' | 'forms' | 'signals';

/** One effect a collector saw start while a tool call ran (synchronously or in its zone). */
export interface WebMcpEffectKey {
  layer: WebMcpEffectLayer;
  key: string;
}

/** One call of a WebMCP tool, as the page reports it. Values are masked. */
export interface WebMcpCallEntry {
  id: number;
  tool: string;
  /** Start, in ms since the epoch. */
  at: number;
  /** How long `execute` took to settle; missing while it runs. */
  ms?: number;
  outcome: WebMcpOutcome;
  /** The arguments, masked by `serialize` (and the form's own masks for a form tool). */
  args?: unknown;
  /** What `execute` resolved with, masked the same way. */
  result?: unknown;
  /** The error or failure text. */
  detail?: string;
  /** The user pressed a key or the pointer while the call ran or just after it. */
  userInput?: boolean;
  /** Effects a collector tied to this call. */
  caused?: WebMcpEffectKey[];
  /** The form the tool submits, for a Signal Forms tool. */
  formId?: string;
  /** Started from the panel's Try this tool, not by an agent. */
  tried?: boolean;
  /** Whether the tool claimed `readOnlyHint: true` when it was called. */
  readOnly?: boolean;
}

/** One tool the app registered with `modelContext.registerTool()`. */
export interface WebMcpPageTool {
  name: string;
  description: string;
  status: 'registering' | 'registered' | 'failed';
  /** How the collector found it: its registration, a tool list, or Angular's schema error. */
  seen: 'register' | 'list' | 'error';
  error?: string;
  /** The annotations the page claims, such as `readOnlyHint`. */
  annotations?: Record<string, unknown>;
  /** One `path: type` line per input. */
  inputs?: string[];
  required?: string[];
  /** The form this tool belongs to, for a Signal Forms tool. */
  formId?: string;
  duplicate?: boolean;
  registeredAt?: number;
}

/** The `push-webmcp` report of one page. */
export interface WebMcpReport {
  pageId: string;
  url?: string;
  title?: string;
  /** The page has `document.modelContext` (or `navigator.modelContext`). */
  modelContext: boolean;
  tools: WebMcpPageTool[];
  /** Oldest first. */
  calls: WebMcpCallEntry[];
  /** Older calls removed at `limits.webmcpCalls`. */
  dropped?: number;
}

/** After a call settles, effects that start within this window may still be its own. */
export const WEBMCP_GRACE_MS = 500;
/** How long a zone keeps tying effects to a call after it settled (timers the call started). */
export const WEBMCP_CAUSED_AFTER_MS = 5000;

export type WebMcpCertainty = 'caused' | 'during';
/** `write`: changes data outside the component; `signal`: only a signal write; `none`: reads. */
export type WebMcpChange = 'write' | 'signal' | 'none';

export interface WebMcpEffect {
  layer: WebMcpEffectLayer;
  key: string;
  at: number;
  title: string;
  detail?: string;
  certainty: WebMcpCertainty;
  change: WebMcpChange;
  /** For a signal write: a signal Angular's own code created (`resource` state and so on). */
  framework?: boolean;
  /** The tab that shows the effect in full. */
  tab: string;
  /** The item that tab can select, when it can. */
  id?: string;
}

export interface WebMcpTrace {
  effects: WebMcpEffect[];
  /**
   * For a tool that claims `readOnlyHint`: `warning` when the call changed data
   * outside signals, `info` when it only wrote the app's own signals.
   */
  verdict?: 'warning' | 'info';
  /** The user was active during the call, so effects no collector tied to it are left out. */
  userInput: boolean;
}

/** The shared states the trace reads, as the server holds them. */
export interface WebMcpTraceSources {
  http?: unknown;
  ngrx?: unknown;
  router?: unknown;
  forms?: unknown;
  signals?: unknown;
}

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const FORM_WRITES = new Set(['value', 'submit', 'reset']);
const MAX_EFFECTS = 100;

type AnyRecord = Record<string, unknown>;

function record(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function list(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? (value as AnyRecord[]) : [];
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** The page entries of a shared state that keeps them as an array or a record. */
function pagesOf(state: unknown): AnyRecord[] {
  const pages = record(state)['pages'];
  return (Array.isArray(pages) ? pages : Object.values(record(pages))).map(record);
}

function pageIn(state: unknown, pageId: string): AnyRecord | undefined {
  return pagesOf(state).find((page) => record(page)['pageId'] === pageId);
}

function pathOf(url: unknown): string {
  if (typeof url !== 'string') return '';
  try {
    return new URL(url, 'http://x').pathname;
  } catch {
    return url.split(/[?#]/)[0] ?? url;
  }
}

function shortUrl(url: unknown): string {
  if (typeof url !== 'string') return '';
  return url.replace(/^[a-z]+:\/\/[^/]+/i, '') || url;
}

/** Whether the tool claims to only read. Anything but `readOnlyHint: true` may change data. */
export function claimsReadOnly(tool: Pick<WebMcpPageTool, 'annotations'> | undefined): boolean {
  return tool?.annotations?.['readOnlyHint'] === true;
}

/**
 * The effects of `call` on page `pageId`: what a collector tied to it
 * (`caused`), and what started between its start and its end plus
 * {@link WEBMCP_GRACE_MS} (`during`), unless the user was active then.
 */
export function traceCall(
  call: WebMcpCallEntry,
  pageId: string,
  sources: WebMcpTraceSources,
  options: { tool?: WebMcpPageTool; now?: number } = {},
): WebMcpTrace {
  const now = options.now ?? Date.now();
  const end = call.at + (finite(call.ms) ? call.ms : Math.max(0, now - call.at));
  const duringEnd = end + WEBMCP_GRACE_MS;
  const causedEnd = end + WEBMCP_CAUSED_AFTER_MS;
  const userInput = call.userInput === true;
  const caused = new Set((call.caused ?? []).map((effect) => `${effect.layer}:${effect.key}`));
  const effects: WebMcpEffect[] = [];

  // `at` comes from another inspector's state, so it is checked here.
  const consider = (
    candidate: Omit<WebMcpEffect, 'certainty' | 'at'> & { at: unknown },
    tied: boolean,
  ): void => {
    const { at } = candidate;
    if (!finite(at)) return;
    const effect = { ...candidate, at };
    if (tied && effect.at >= call.at - 1 && effect.at <= causedEnd) {
      effects.push({ ...effect, certainty: 'caused' });
    } else if (!userInput && effect.at >= call.at && effect.at <= duringEnd) {
      effects.push({ ...effect, certainty: 'during' });
    }
  };

  const http = pageIn(sources.http, pageId);
  for (const item of list(http?.['calls'])) {
    const method = String(item['method'] ?? 'GET').toUpperCase();
    const status = finite(item['status']) && item['status'] ? String(item['status']) : '';
    consider(
      {
        layer: 'http',
        key: String(item['id'] ?? item['at']),
        at: item['at'],
        title: `${method} ${shortUrl(item['url'])}`,
        ...(status ? { detail: status } : {}),
        change: READ_METHODS.has(method) ? 'none' : 'write',
        tab: 'network',
      },
      caused.has(`http:${item['id']}`),
    );
  }

  const ngrx = pageIn(sources.ngrx, pageId);
  for (const entry of list(ngrx?.['log'])) {
    const title =
      entry['source'] === 'event' ? String(entry['eventType'] ?? entry['type']) : entry['type'];
    consider(
      {
        layer: 'ngrx',
        key: String(entry['seq']),
        at: entry['timestamp'],
        title: String(title ?? 'action'),
        ...(entry['storeId'] ? { detail: String(entry['storeId']) } : {}),
        // A method call or action that changed nothing is logged with an empty diff. An event
        // always has one: the stores it changes log their own entries.
        change:
          entry['source'] !== 'event' &&
          Array.isArray(entry['diff']) &&
          !entry['diff'].length &&
          !entry['diffTruncated']
            ? 'none'
            : 'write',
        tab: 'store',
      },
      caused.has(`ngrx:${entry['seq']}`),
    );
  }

  const router = pageIn(sources.router, pageId);
  const navigations = list(router?.['navigations']).filter((nav) => finite(nav['startedAt']));
  navigations.sort((a, b) => Number(a['startedAt']) - Number(b['startedAt']));
  let previousPath: string | undefined;
  for (const nav of navigations) {
    const target = nav['finalUrl'] ?? nav['url'];
    const fromPath = nav['from'] !== undefined ? pathOf(nav['from']) : previousPath;
    const moved = fromPath === undefined || pathOf(target) !== fromPath;
    if (!nav['probe'] && !nav['beforeConnect']) {
      consider(
        {
          layer: 'router',
          key: String(nav['id']),
          at: nav['startedAt'],
          title: `Navigation to ${shortUrl(nav['url'])}`,
          ...(nav['outcome'] ? { detail: String(nav['outcome']) } : {}),
          change:
            moved && nav['outcome'] !== 'cancelled' && nav['outcome'] !== 'failed'
              ? 'write'
              : 'none',
          tab: 'routes',
        },
        caused.has(`router:${nav['id']}`),
      );
    }
    if (nav['outcome'] !== 'cancelled' && nav['outcome'] !== 'failed')
      previousPath = pathOf(target);
  }

  for (const event of list(record(sources.forms)['events'])) {
    const formId = event['formId'];
    // Form ids end with `@<pageId>`.
    if (typeof formId !== 'string' || formId.split('@')[1] !== pageId) continue;
    // The forms collector notes the events a call made; `origin: 'agent'` alone names no call.
    consider(
      {
        layer: 'forms',
        key: `${formId}:${event['seq']}`,
        at: event['timestamp'],
        title: `${event['type']} ${event['path'] || 'form'}`,
        ...(event['outcome'] ? { detail: String(event['outcome']) } : {}),
        change: FORM_WRITES.has(String(event['type'])) ? 'write' : 'none',
        tab: 'forms',
        id: formId,
      },
      caused.has(`forms:${formId}:${event['seq']}`),
    );
  }

  const graph = record(record(record(sources.signals)['pages'])[pageId]);
  const nodes = new Map(list(graph['nodes']).map((node) => [String(node['id']), node] as const));
  for (const [nodeId, changes] of Object.entries(record(graph['history']))) {
    const node = nodes.get(nodeId);
    for (const change of list(changes)) {
      if (change['source'] === 'initial') continue;
      const key = `${nodeId}:${change['epoch'] ?? change['at']}`;
      consider(
        {
          layer: 'signals',
          key,
          at: change['at'],
          title: `${node?.['label'] || node?.['kind'] || 'signal'} ${change['source'] === 'write' ? 'set' : 'changed'}`,
          change: 'signal',
          ...(node?.['framework'] ? { framework: true } : {}),
          tab: 'signals',
        },
        caused.has(`signals:${key}`),
      );
    }
  }

  effects.sort((a, b) => a.at - b.at || a.layer.localeCompare(b.layer));
  // The claim recorded with the call, so the verdict stays once the tool is gone or replaced.
  const readOnly = call.readOnly ?? claimsReadOnly(options.tool);
  let verdict: WebMcpTrace['verdict'];
  // Every effect counts, not only the ones shown.
  if (readOnly) {
    if (effects.some((effect) => effect.change === 'write')) verdict = 'warning';
    else if (effects.some((effect) => effect.change === 'signal' && !effect.framework)) {
      verdict = 'info';
    }
  }
  return { effects: effects.slice(0, MAX_EFFECTS), ...(verdict ? { verdict } : {}), userInput };
}
