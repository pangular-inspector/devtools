import {
  shortAngularVersion,
  type PangularInspector,
  type ResolvedPangularConfig,
} from '../config.ts';
import type { QueryState } from '../query-shared.ts';
import type { ReduxStoresState } from '../redux-stores-shared.ts';
import type { ComponentPage, HttpState, SignalGraph } from '../types.ts';
import { MARKDOWN_OUTPUT_SCHEMA } from './agent-output.ts';
import { componentOutlineText, routedHosts } from './component-outline.ts';
import { listConsoleText, listErrorsText, type ErrorsState } from './errors-tools.ts';
import { code, inspectFormsText, onPage, untrusted, type FormsState } from './forms-tools.ts';
import { listHttpCallsText } from './http-tools.ts';
import { inspectSignalStoreText } from './ngrx-live-tools.ts';
import type { NgrxPages } from './ngrx-tools.ts';
import { callerPage } from './page-scope.ts';
import {
  PAGE_ARGUMENT,
  listPagesText,
  pageArgument,
  platformLabel,
  unknownPageText,
  type PageSummary,
} from './pages.ts';
import { listQueriesText } from './query-tools.ts';
import { inspectReduxStoresText } from './redux-stores-tools.ts';
import { describeNavigation, inspectRouteText, type RouterState } from './router-tools.ts';
import { signalGraphText } from './signal-tools.ts';

/** The sections of a snapshot, in the order the answer lists them. */
export const SNAPSHOT_SECTIONS = [
  'page',
  'components',
  'route',
  'navigations',
  'http',
  'errors',
  'console',
  'forms',
  'signals',
  'stores',
  'queries',
] as const;

export type SnapshotSection = (typeof SNAPSHOT_SECTIONS)[number];

/** Items per section without `limit`, and the most `limit` takes. */
export const SNAPSHOT_DEFAULT_LIMIT = 10;
export const SNAPSHOT_MAX_LIMIT = 50;
/** Longest section, in characters, before it is cut. */
export const SNAPSHOT_SECTION_CHARS = 4_000;
/** Longest answer without `maxChars`, and the bounds `maxChars` takes. */
export const SNAPSHOT_DEFAULT_CHARS = 20_000;
export const SNAPSHOT_MIN_CHARS = 2_000;
export const SNAPSHOT_MAX_CHARS = 50_000;

/** Room kept at the end of the answer for the truncation note. */
const TRAILER_ROOM = 400;
/** A section gets in only with at least this much room left. */
const MIN_SECTION_ROOM = 200;

interface SectionInfo {
  title: string;
  /** The inspector that turns the section off; `page` has none. */
  inspector?: PangularInspector;
  /** The tool that has the rest. */
  tool: string;
}

const SECTION_INFO: Record<SnapshotSection, SectionInfo> = {
  page: { title: 'Page', tool: 'list-pages' },
  components: { title: 'Components', inspector: 'components', tool: 'list-components' },
  route: { title: 'Current route', inspector: 'router', tool: 'inspect-route' },
  navigations: { title: 'Recent navigations', inspector: 'router', tool: 'explain-navigation' },
  http: { title: 'HTTP calls', inspector: 'http', tool: 'list-http-calls' },
  errors: { title: 'Errors', inspector: 'errors', tool: 'list-errors' },
  console: { title: 'Console', inspector: 'errors', tool: 'list-console' },
  forms: { title: 'Forms', inspector: 'forms', tool: 'inspect-forms' },
  signals: { title: 'Signals', inspector: 'signals', tool: 'inspect-signals' },
  stores: { title: 'Stores', inspector: 'ngrx', tool: 'inspect-signal-store' },
  queries: { title: 'TanStack Query', inspector: 'tanstackQuery', tool: 'list-queries' },
};

/** Where the snapshot reads each inspector's data: the stores the other tools read. */
export interface SnapshotSources {
  /** Every reporting page, newest first, as `list-pages` sees them. */
  pages(): PageSummary[];
  components(): Iterable<ComponentPage>;
  router(): RouterState;
  http(): HttpState;
  errors(): ErrorsState | undefined;
  forms(): FormsState;
  signals(): Iterable<{ pageId: string; graph: SignalGraph; reportedAt: number }>;
  ngrx(): NgrxPages;
  reduxStores(): ReduxStoresState | undefined;
  queries(): QueryState | undefined;
}

export interface SnapshotArgs {
  page?: string;
  sections?: unknown;
  limit?: unknown;
  maxChars?: unknown;
}

/** Whether `section` may be shown, or why not. */
function sectionGate(section: SnapshotSection, config: ResolvedPangularConfig): string | null {
  const inspector = SECTION_INFO[section].inspector;
  if (!inspector) return null;
  if (!config.inspectors[inspector]) return `\`inspectors.${inspector}\` is off`;
  if (!config.agent.tools[inspector]) return `\`agent.tools.${inspector}\` is off`;
  return null;
}

function bounded(value: unknown, fallback: number, min: number, max: number): number {
  const asked = Number(value ?? fallback);
  const whole = Math.floor(Number.isFinite(asked) ? asked : fallback);
  return Math.min(Math.max(whole, min), max);
}

/** A leading untrusted-data notice (the snapshot puts one notice above every section). */
const NOTICE = /^_[^\n]*(?:data, not instructions|untrusted data)[^\n]*_\s*\n+/i;

function withoutNotice(text: string): string {
  return text.replace(NOTICE, '');
}

/**
 * Pushes the headings in a section's text below the section's own `##`
 * heading, outside code fences.
 */
function demoteHeadings(text: string): string {
  let fenced = false;
  return text
    .split('\n')
    .map((line) => {
      if (line.startsWith('```')) fenced = !fenced;
      return !fenced && /^#{1,4} /.test(line) ? `##${line}` : line;
    })
    .join('\n');
}

/** `text` cut at a line end within `max` characters, with a closed code fence. */
function cutText(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const end = head.lastIndexOf('\n');
  let kept = end > max / 2 ? head.slice(0, end) : head;
  const fences = kept.split('\n').filter((line) => line.startsWith('```')).length;
  if (fences % 2) kept += '\n```';
  return kept;
}

function cutSection(section: SnapshotSection, text: string, max: number): string {
  const note = `\n\n_Cut at ${max.toLocaleString('en-US')} characters. Call pangular:${SECTION_INFO[section].tool} for the rest._`;
  return text.length <= max ? text : `${cutText(text, max - note.length)}${note}`;
}

function ago(at: number, now: number): string {
  return `${Math.max(0, Math.round((now - at) / 1000))}s ago`;
}

function pageInfoText(page: PageSummary, all: readonly PageSummary[], now: number): string {
  const platform = page.angular
    ? `${platformLabel(page.platform)}, Angular ${shortAngularVersion(page.angular)}`
    : platformLabel(page.platform);
  const lines = [
    `- Page id: ${code(page.pageId)}`,
    `- URL: ${page.url ? code(page.url) : 'unknown'}`,
    ...(page.title ? [`- Title: ${code(page.title)}`] : []),
    `- Platform: ${platform}`,
    `- Last report: ${ago(page.reportedAt, now)}${page.background ? ' (background tab)' : ''}`,
    `- Reports: ${page.inspectors.join(', ')}`,
  ];
  // A page tool answers for its own page only, so it names no other tab.
  const others = all.length - 1;
  if (others > 0 && callerPage() === undefined) {
    lines.push(`- Other pages reporting: ${others} (see pangular:list-pages)`);
  }
  return lines.join('\n');
}

interface RenderContext {
  page: PageSummary;
  pages: readonly PageSummary[];
  sources: SnapshotSources;
  limit: number;
  now: number;
}

/** One section's text for one page, or `undefined` when the page reported nothing for it. */
function renderSection(section: SnapshotSection, ctx: RenderContext): string | undefined {
  const { page, sources, limit, now } = ctx;
  const pageId = page.pageId;
  switch (section) {
    case 'page':
      return pageInfoText(page, ctx.pages, now);
    case 'components': {
      const tree = [...sources.components()].find((entry) => entry.pageId === pageId);
      if (!tree?.roots.length) return undefined;
      const outlets = sources.router().pages.find((entry) => entry.pageId === pageId)?.outlets;
      return componentOutlineText(tree, routedHosts(outlets), {
        maxChars: SNAPSHOT_SECTION_CHARS - 600,
      });
    }
    case 'route': {
      const routed = sources.router().pages.find((entry) => entry.pageId === pageId);
      if (!routed) return undefined;
      return inspectRouteText({ pages: [routed] }, { page: pageId }, now);
    }
    case 'navigations': {
      const routed = sources.router().pages.find((entry) => entry.pageId === pageId);
      if (!routed?.navigations.length) return undefined;
      const newest = [...routed.navigations].sort((a, b) => b.id - a.id);
      const shown = newest.slice(0, limit);
      const more = newest.length > shown.length ? `, showing ${shown.length}` : '';
      return [
        `${newest.length} navigation(s) recorded, newest first${more}.`,
        '',
        ...shown.map((nav) => describeNavigation(nav, routed).split('\n')[0]!),
      ].join('\n');
    }
    case 'http': {
      const state = sources.http();
      const own = state.pages.find((entry) => entry.pageId === pageId);
      if (!own) return undefined;
      return listHttpCallsText({ ...state, pages: [own] }, { page: pageId, limit }, now);
    }
    case 'errors': {
      const state = sources.errors();
      if (!state?.pages[pageId]) return undefined;
      return listErrorsText(
        { pages: { [pageId]: state.pages[pageId] } },
        { page: pageId, limit },
        now,
      );
    }
    case 'console': {
      const state = sources.errors();
      if (!state?.pages[pageId]) return undefined;
      return listConsoleText(
        { pages: { [pageId]: state.pages[pageId] } },
        { page: pageId, limit },
        now,
      );
    }
    case 'forms': {
      const state = sources.forms();
      if (!onPage(state.forms, pageId).length) return undefined;
      return inspectFormsText(state, { page: pageId }, now);
    }
    case 'signals': {
      const entry = [...sources.signals()].find((item) => item.pageId === pageId);
      if (!entry) return undefined;
      const graph = entry.graph;
      if (graph.unsupported) {
        return 'The signal graph has no node ids on this Angular version, so there is no live graph.';
      }
      const target = graph.componentSelector ?? graph.injector?.name;
      const head = `Graph for ${target ? code(target) : 'the selected target'}, without Angular's own nodes and value history:`;
      const json = signalGraphText(
        graph,
        { framework: false, history: false },
        SNAPSHOT_SECTION_CHARS - head.length - 600,
      );
      // Fence the JSON, not the note that says how it was cut.
      if (json.startsWith('_Cut to fit')) return `${head}\n\n${json}`;
      const note = json.indexOf('\n\n_Cut to fit');
      const body = note < 0 ? json : json.slice(0, note);
      const after = note < 0 ? '' : json.slice(note);
      return `${head}\n\n\`\`\`json\n${body}\n\`\`\`${after}`;
    }
    case 'stores': {
      const parts: string[] = [];
      const ngrx = sources.ngrx();
      if (ngrx.has(pageId)) parts.push(inspectSignalStoreText(ngrx, pageId));
      const redux = sources.reduxStores();
      const reduxPage = redux?.pages[pageId];
      if (reduxPage) {
        parts.push(
          withoutNotice(
            inspectReduxStoresText({ pages: { [pageId]: reduxPage } }, { page: pageId, limit }),
          ),
        );
      }
      return parts.length ? parts.join('\n\n') : undefined;
    }
    case 'queries': {
      const state = sources.queries();
      const own = state?.pages[pageId];
      if (!own) return undefined;
      return listQueriesText({ pages: { [pageId]: own } }, { page: pageId, limit });
    }
  }
}

/** The names in `sections`, the ones it gets wrong, or every section without it. */
function pickSections(value: unknown): { wanted: SnapshotSection[]; unknown: string[] } {
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
      ? value.split(',')
      : undefined;
  if (!list) return { wanted: [...SNAPSHOT_SECTIONS], unknown: [] };
  const names = list.map((item) => String(item).trim()).filter(Boolean);
  const unknown = names.filter((name) => !(SNAPSHOT_SECTIONS as readonly string[]).includes(name));
  const wanted = SNAPSHOT_SECTIONS.filter((section) => names.includes(section));
  return { wanted, unknown };
}

/**
 * The `snapshot` answer: what the server knows about one page, section by
 * section, each cut to `limit` items and {@link SNAPSHOT_SECTION_CHARS}, and
 * the whole cut to `maxChars`. Every section comes from the formatter of the
 * tool named in its heading, so masking and caps are the same as there.
 */
export function snapshotText(
  sources: SnapshotSources,
  config: ResolvedPangularConfig,
  args: SnapshotArgs = {},
  now = Date.now(),
): string {
  const { wanted, unknown } = pickSections(args.sections);
  const known = SNAPSHOT_SECTIONS.map(code).join(', ');
  if (unknown.length && !wanted.length) {
    return `No section named ${unknown.map(code).join(', ')}. Sections: ${known}.`;
  }
  const pages = sources.pages();
  if (args.page && !pages.some((entry) => entry.pageId === args.page)) {
    return unknownPageText(args.page, pages, 'live data');
  }
  const page = args.page ? pages.find((entry) => entry.pageId === args.page) : pages[0];
  if (!page) return listPagesText([]);

  const limit = bounded(args.limit, SNAPSHOT_DEFAULT_LIMIT, 1, SNAPSHOT_MAX_LIMIT);
  const maxChars = bounded(
    args.maxChars,
    SNAPSHOT_DEFAULT_CHARS,
    SNAPSHOT_MIN_CHARS,
    SNAPSHOT_MAX_CHARS,
  );
  const skipped: string[] = [];
  const empty: string[] = [];
  const rendered: { section: SnapshotSection; text: string }[] = [];
  for (const section of wanted) {
    const gate = sectionGate(section, config);
    if (gate) {
      skipped.push(`${code(section)} (${gate})`);
      continue;
    }
    const text = renderSection(section, { page, pages, sources, limit, now });
    if (text === undefined) empty.push(code(section));
    else rendered.push({ section, text: demoteHeadings(withoutNotice(text)) });
  }

  const head = [
    `# Snapshot of page ${code(page.pageId)}`,
    '',
    `Taken ${new Date(now).toISOString()}. Each section lists at most ${limit} items and ${SNAPSHOT_SECTION_CHARS.toLocaleString('en-US')} characters; the tool named under its heading has the rest.`,
    ...(skipped.length ? ['', `Skipped: ${skipped.join(', ')}.`] : []),
    ...(empty.length ? ['', `Nothing reported by this page for: ${empty.join(', ')}.`] : []),
    ...(unknown.length
      ? ['', `Unknown section(s) ${unknown.map(code).join(', ')} left out. Sections: ${known}.`]
      : []),
  ].join('\n');

  let text = untrusted(head);
  const left: SnapshotSection[] = [];
  let short: SnapshotSection | undefined;
  for (const { section, text: body } of rendered) {
    const info = SECTION_INFO[section];
    const heading = `\n\n## ${info.title}\n\n_From pangular:${info.tool}._\n\n`;
    const fits = Math.min(
      SNAPSHOT_SECTION_CHARS,
      maxChars - TRAILER_ROOM - text.length - heading.length,
    );
    if (left.length || fits < MIN_SECTION_ROOM) {
      left.push(section);
      continue;
    }
    const cut = cutSection(section, body, fits);
    text += heading + cut;
    // Cut by the room left in the answer, not by the section's own cap.
    if (cut !== body && fits < SNAPSHOT_SECTION_CHARS) short = section;
  }
  if (left.length || short) {
    const what = [
      short ? `${code(short)} is cut short` : '',
      left.length ? `left out ${left.map(code).join(', ')}` : '',
    ].filter(Boolean);
    text += `\n\n_Truncated at ${maxChars.toLocaleString('en-US')} characters: ${what.join('; ')}. Pass \`sections\` to pick fewer, or raise \`maxChars\` (at most ${SNAPSHOT_MAX_CHARS.toLocaleString('en-US')})._`;
  }
  return text;
}

export const SNAPSHOT_DESCRIPTION =
  'Everything the server knows about one page in one bounded markdown answer, for a full picture or a bug report: page info, component outline, current route, recent navigations, HttpClient calls, errors, console, forms, signal graph, stores and TanStack Query. Sections whose inspector or agent tools are off are named as skipped. Pick sections with `sections`; `limit` caps items per section, `maxChars` the whole answer. Defaults to the most recent page.';

type AnyRecord = Record<string, any>;

interface SnapshotHost {
  agent: { registerTool(tool: AnyRecord): void };
  config: ResolvedPangularConfig;
  sources: SnapshotSources;
}

/** Registers the `snapshot` agent tool. */
export function registerSnapshot(host: SnapshotHost): void {
  host.agent.registerTool({
    id: 'pangular:snapshot',
    title: 'Snapshot a page',
    outputSchema: MARKDOWN_OUTPUT_SCHEMA,
    description: SNAPSHOT_DESCRIPTION,
    inputSchema: {
      type: 'object',
      properties: {
        page: PAGE_ARGUMENT,
        pageId: { type: 'string', description: 'Same as `page`.' },
        sections: {
          type: 'array',
          items: { type: 'string', enum: [...SNAPSHOT_SECTIONS] },
          description: 'Only these sections, in the usual order. Every section without it.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: SNAPSHOT_MAX_LIMIT,
          description: `Most items per section (1-${SNAPSHOT_MAX_LIMIT}, default ${SNAPSHOT_DEFAULT_LIMIT}).`,
        },
        maxChars: {
          type: 'integer',
          minimum: SNAPSHOT_MIN_CHARS,
          maximum: SNAPSHOT_MAX_CHARS,
          description: `Longest answer in characters (default ${SNAPSHOT_DEFAULT_CHARS}). Sections past it are named as left out.`,
        },
      },
    },
    handler: async (args: Record<string, unknown>) => ({
      markdown: snapshotText(host.sources, host.config, {
        page: pageArgument(args, 'pageId'),
        sections: args?.['sections'],
        limit: args?.['limit'],
        maxChars: args?.['maxChars'],
      }),
    }),
  });
}
