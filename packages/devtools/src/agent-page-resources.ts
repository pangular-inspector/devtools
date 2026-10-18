import type { DevframeNodeContext, McpRouteOptions } from 'devframe/types';
import { agentResourceOffered, type ResolvedPangularConfig } from './config.ts';
import type { NgrxState } from './ngrx-shared.ts';
import { code, formsResourceText, type FormsState } from './rpc/forms-tools.ts';
import { LIVE_RESOURCE_NOTE, liveResourceText } from './rpc/resource-text.ts';
import { injectorResourceText } from './rpc/injector-resource.ts';
import { routerResourceText, type RouterState } from './rpc/router-tools.ts';
import { withIdEdges } from './rpc/signal-tools.ts';
import type { ComponentPage, InjectorPage } from './types.ts';

/** One MCP resource template, as the patched `@devframes/agentic` server takes it. */
export type PangularMcpResourceTemplate = NonNullable<McpRouteOptions['resourceTemplates']>[number];

/**
 * The page-scoped agent resources that get a per-page template, by their
 * `AGENT_ENTRIES` name. Each one mirrors `pangular:<name>` filtered to one page.
 */
export const PAGE_RESOURCE_NAMES = [
  'component-tree',
  'signal-graph',
  'injector-tree',
  'ngrx-store',
  'forms',
  'router',
] as const;

export type PageResourceName = (typeof PAGE_RESOURCE_NAMES)[number];

/** How long page changes settle before one `list_changed` goes out. */
export const PAGE_LIST_DEBOUNCE_MS = 500;

interface PageResourceInfo {
  title: string;
  /** What the page reports, for the unknown-page answer. */
  what: string;
  description: string;
}

const INFO: Record<PageResourceName, PageResourceInfo> = {
  'component-tree': {
    title: 'Angular Component Tree of one page',
    what: 'a component tree',
    description: `The pangular:component-tree resource for one page: its rendered instances, counts and the selected instance's detail, as JSON. ${LIVE_RESOURCE_NOTE}`,
  },
  'signal-graph': {
    title: 'Angular Signal Graph of one page',
    what: 'a signal graph',
    description: `The pangular:signal-graph resource for one page: signal, computed, effect and linkedSignal nodes, their edges and recent values, as JSON. ${LIVE_RESOURCE_NOTE}`,
  },
  'injector-tree': {
    title: 'Angular Injector Tree of one page',
    what: 'an injector tree',
    description:
      'The pangular:injector-tree resource for one page: element and environment injectors with their providers, and the zone mode, as JSON. Past 100,000 characters an outline with provider counts.',
  },
  'ngrx-store': {
    title: 'NgRx Store State of one page',
    what: 'NgRx state',
    description: `The pangular:ngrx-store resource for one page: signal stores, classic store state and the change log, as JSON. ${LIVE_RESOURCE_NOTE}`,
  },
  forms: {
    title: 'Angular Forms of one page',
    what: 'forms',
    description:
      "The pangular:forms resource for one page: each form's fields with value, status, touched, dirty and errors, plus recent changes, as JSON. The JSON starts with an `_untrusted` notice.",
  },
  router: {
    title: 'Angular Router of one page',
    what: 'router state',
    description:
      'The pangular:router resource for one page: the active route tree and recent navigations, as JSON. The JSON starts with an `_untrusted` notice.',
  },
};

/** The URI of `name` for one page. */
export function pageResourceUri(name: PageResourceName, pageId: string): string {
  return `pangular://pages/${encodeURIComponent(pageId)}/${name}`;
}

/** A shared state the source reads and watches; `value()` is the live state. */
interface WatchedState {
  value(): unknown;
  on(event: 'updated', listener: () => void): () => void;
}

/** What the devframe setup hands the templates: per-page reads over its live state. */
export interface PageResourceSource {
  /** The ids of the pages that report `name` right now, sorted. */
  pageIds(name: PageResourceName): string[];
  /** The resource text of `name` for one page, or undefined when that page does not report it. */
  read(name: PageResourceName, pageId: string): Promise<string | undefined>;
  /**
   * Call `listener` when the pages that report any of `names` change: a page
   * appears or expires. Changes settle for {@link PAGE_LIST_DEBOUNCE_MS}
   * first, and a push that changes no page id calls nothing.
   */
  onPagesChanged(names: readonly PageResourceName[], listener: () => void): () => void;
}

type PageId = { pageId: string };
type Pages<T> = Record<string, T>;

const recordIds = (pages: unknown) =>
  pages && typeof pages === 'object' && !Array.isArray(pages) ? Object.keys(pages) : [];
const arrayIds = (pages: unknown) =>
  Array.isArray(pages) ? (pages as PageId[]).map((page) => page.pageId) : [];

/** Page ids in one state, by resource. */
function idsIn(name: PageResourceName, state: unknown): string[] {
  const value = (state ?? {}) as Record<string, unknown>;
  switch (name) {
    case 'ngrx-store':
    case 'router':
      return arrayIds(value['pages']);
    case 'forms':
      return recordIds(value['pagesReportedAt']);
    default:
      return recordIds(value['pages']);
  }
}

const formOn = (id: string, pageId: string) => id.endsWith(`@${pageId}`);

/** The forms state cut down to one page; form ids end with `@<pageId>`. */
function formsOf(state: FormsState, pageId: string): FormsState {
  const reportedAt = state.pagesReportedAt?.[pageId] ?? 0;
  const dropped = state.dropped?.[pageId];
  return {
    forms: state.forms.filter((form) => formOn(form.id, pageId)),
    events: state.events.filter((event) => formOn(event.formId, pageId)),
    reportedAt,
    pagesReportedAt: { [pageId]: reportedAt },
    setupErrors: (state.setupErrors ?? []).filter((error) => error.pageId === pageId),
    instrumented: (state.instrumented ?? []).filter((id) => id === pageId),
    dropped: dropped === undefined ? {} : { [pageId]: dropped },
    ...(state.webMcp ? { webMcp: state.webMcp.filter((page) => page.pageId === pageId) } : {}),
  };
}

/**
 * The text of `name` for one page: the state of the matching `pangular:<name>`
 * resource with only that page in it, through the same formatter. Panel
 * selection (`selectedId` and the like) is left out, since it belongs to no page.
 */
export function pageResourceText(name: PageResourceName, state: unknown, pageId: string) {
  if (!idsIn(name, state).includes(pageId)) return undefined;
  const value = state as Record<string, unknown>;
  switch (name) {
    case 'component-tree': {
      const page = (value['pages'] as Pages<ComponentPage>)[pageId]!;
      return liveResourceText(
        { nodes: page.roots, pages: { [pageId]: page } },
        'pangular:list-components and pangular:inspect-component',
      );
    }
    case 'signal-graph': {
      const graph = withIdEdges((value['pages'] as Pages<unknown>)[pageId]);
      return liveResourceText({ graph, pages: { [pageId]: graph } }, 'pangular:inspect-signals');
    }
    case 'injector-tree': {
      const page = (value['pages'] as Pages<InjectorPage>)[pageId]!;
      return injectorResourceText(
        {
          roots: page.roots,
          environment: page.environment,
          pages: { [pageId]: page },
          truncated: page.truncated === true,
          zone: page.zone ?? null,
        },
        { [pageId]: page },
      );
    }
    case 'ngrx-store':
      return liveResourceText(
        { pages: (value as unknown as NgrxState).pages.filter((page) => page.pageId === pageId) },
        'pangular:ngrx-inspect-store and pangular:ngrx-history',
      );
    case 'forms':
      return formsResourceText(formsOf(state as FormsState, pageId));
    case 'router':
      return routerResourceText({
        pages: (value as unknown as RouterState).pages.filter((page) => page.pageId === pageId),
      });
  }
}

/**
 * Per-page reads over the six live shared states. `touch` renews the agent
 * lease first, like the `pangular:*` resources do, so idle pages send fresh
 * reports before the read.
 */
export function createPageResourceSource(options: {
  states: Record<PageResourceName, WatchedState>;
  touch: () => unknown;
  debounceMs?: number;
}): PageResourceSource {
  const { states, touch, debounceMs = PAGE_LIST_DEBOUNCE_MS } = options;
  const pageIds = (name: PageResourceName) => idsIn(name, states[name].value()).sort();
  return {
    pageIds,
    async read(name, pageId) {
      try {
        await touch();
      } catch {
        // The lease never fails a read.
      }
      return pageResourceText(name, states[name].value(), pageId);
    },
    onPagesChanged(names, listener) {
      const signature = () => names.map((name) => `${name}:${pageIds(name).join(',')}`).join('|');
      let last = signature();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const check = () => {
        timer = undefined;
        const next = signature();
        if (next === last) return;
        last = next;
        listener();
      };
      // Pushes come often; the page ids are compared once per window.
      const schedule = () => {
        if (timer) return;
        timer = setTimeout(check, debounceMs);
        timer.unref?.();
      };
      const offs = [...new Set(names)].map((name) => states[name].on('updated', schedule));
      return () => {
        for (const off of offs) off();
        if (timer) clearTimeout(timer);
        timer = undefined;
      };
    },
  };
}

/**
 * The source each devframe context serves, keyed by its agent host, which the
 * setup and the MCP route share. The route options are built before setup
 * runs, so the templates look the source up when they are read.
 */
const sources = new WeakMap<object, PageResourceSource>();

export function providePageResources(ctx: { agent: object }, source: PageResourceSource): void {
  sources.set(ctx.agent, source);
}

const sourceOf = (ctx: DevframeNodeContext) => sources.get(ctx.agent);

/** The answer for a page id that reports no such data. */
function unknownPageResourceText(name: PageResourceName, pageId: string, others: string[]) {
  const what = INFO[name].what;
  const list = others.length
    ? `Pages that report ${what}: ${others.map(code).join(', ')}. Read ${code(pageResourceUri(name, '<pageId>'))} with one of these ids, or call pangular_list-pages.`
    : `No page reports ${what} right now.`;
  return `No page ${code(pageId)} is reporting ${what}. ${list}`;
}

/** The resources each offered template stands for. */
export function offeredPageResources(config: ResolvedPangularConfig): PageResourceName[] {
  return PAGE_RESOURCE_NAMES.filter((name) => agentResourceOffered(name, config));
}

/**
 * The per-page resource templates the MCP server offers under `config`:
 * `pangular://pages/{pageId}/<name>` for each page-scoped resource that is on
 * for agents (`inspectors`, `agent.tools`). `resources/list` also names one
 * concrete resource per reporting page, for clients without template support.
 */
export function pangularMcpResourceTemplates(
  config: ResolvedPangularConfig,
): PangularMcpResourceTemplate[] {
  return offeredPageResources(config).map((name) => ({
    uriTemplate: `pangular://pages/{pageId}/${name}`,
    name: `pangular:${name}-of-page`,
    title: INFO[name].title,
    description: INFO[name].description,
    mimeType: 'application/json',
    list: (ctx) =>
      (sourceOf(ctx)?.pageIds(name) ?? []).map((pageId) => ({
        uri: pageResourceUri(name, pageId),
        name: `pangular:${name}-of-page:${pageId}`,
        title: `${INFO[name].title} (${pageId})`,
        description: `${INFO[name].title}, for page ${pageId}.`,
        mimeType: 'application/json',
      })),
    read: async ({ pageId = '' }, _uri, ctx) => {
      const source = sourceOf(ctx);
      const text = await source?.read(name, pageId);
      if (text !== undefined) return { text };
      return {
        text: unknownPageResourceText(name, pageId, source?.pageIds(name) ?? []),
        mimeType: 'text/markdown',
      };
    },
  }));
}

/**
 * The `onResourcesChanged` route option: one `list_changed` when the pages
 * behind the offered templates change.
 */
export function pangularMcpPagesChanged(
  config: ResolvedPangularConfig,
): NonNullable<McpRouteOptions['onResourcesChanged']> {
  const names = offeredPageResources(config);
  return (notify, ctx) => sourceOf(ctx)?.onPagesChanged(names, notify) ?? (() => {});
}
