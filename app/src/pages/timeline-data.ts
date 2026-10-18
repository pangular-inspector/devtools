import type {
  CdReport,
  PangularInspector,
  PanelLink,
  ResolvedPangularConfig,
} from '@pangular-inspector/devtools/internal/config';
import type { FormEvent } from './forms-types';
import { pageOf } from './forms-types';
import type { NavigationRecord, RouterPage } from './router-types';
import type { NgrxLogEntry, NgrxPage } from './store-types';

/** One source of events on the timeline. Each has its own lane and toggle. */
export type TimelineLayer = 'router' | 'http' | 'ngrx' | 'cd' | 'forms' | 'signals';

export interface TimelineLayerInfo {
  id: TimelineLayer;
  label: string;
  /** The tab that shows the event in full. */
  tab: string;
  tabLabel: string;
  /** The inspector that collects it, so a layer goes away with its inspector. */
  inspector: PangularInspector;
  /** The shared state the panel reads it from. */
  state: string;
}

export const TIMELINE_LAYERS: readonly TimelineLayerInfo[] = [
  {
    id: 'router',
    label: 'Router',
    tab: 'routes',
    tabLabel: 'Routes',
    inspector: 'router',
    state: 'router',
  },
  {
    id: 'http',
    label: 'HTTP',
    tab: 'network',
    tabLabel: 'SSR & HTTP',
    inspector: 'http',
    state: 'http',
  },
  {
    id: 'ngrx',
    label: 'NgRx',
    tab: 'store',
    tabLabel: 'Store',
    inspector: 'ngrx',
    state: 'ngrx-store',
  },
  {
    id: 'cd',
    label: 'Change detection',
    tab: 'components',
    tabLabel: 'Components',
    inspector: 'components',
    state: 'change-detection',
  },
  {
    id: 'forms',
    label: 'Forms',
    tab: 'forms',
    tabLabel: 'Forms',
    inspector: 'forms',
    state: 'forms',
  },
  {
    id: 'signals',
    label: 'Signals',
    tab: 'signals',
    tabLabel: 'Signals',
    inspector: 'signals',
    state: 'signal-graph',
  },
];

export const LAYER_INFO = Object.fromEntries(
  TIMELINE_LAYERS.map((layer) => [layer.id, layer]),
) as Record<TimelineLayer, TimelineLayerInfo>;

/** The layers whose inspector is on under `config`. */
export function enabledLayers(config: ResolvedPangularConfig): TimelineLayerInfo[] {
  return TIMELINE_LAYERS.filter((layer) => config.inspectors[layer.inspector]);
}

export type TimelineTone = 'warn' | 'danger';

export interface TimelineEvent {
  /** Unique over every layer, stable across updates. */
  key: string;
  layer: TimelineLayer;
  /** The page that reported it, or `''` for a server call no page claims. */
  pageId: string;
  /** Start, in ms since the epoch. */
  at: number;
  /** How long it took, when the source measures it. */
  ms?: number;
  title: string;
  detail: string;
  tone?: TimelineTone;
  /** Where the event shows in full: its tab, and the item when that tab can select one. */
  link: PanelLink;
}

/** The latest value of each shared state, as the server sent it. */
export type TimelineSources = Partial<Record<TimelineLayer, unknown>>;

interface HttpCallLike {
  id?: string;
  url?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  side?: string;
  cacheHit?: boolean;
  faulted?: boolean;
  mocked?: boolean;
  cancelled?: boolean;
  error?: string;
  pageUrl?: string;
  at?: number;
}

interface HttpPageLike {
  pageId?: string;
  url?: string;
  initialUrl?: string;
  title?: string;
  calls?: HttpCallLike[];
}

interface SignalChangeLike {
  epoch?: number;
  value?: unknown;
  at?: number;
  source?: string;
}

interface SignalGraphLike {
  pageId?: string;
  nodes?: { id?: string; label?: string; kind?: string }[];
  history?: Record<string, SignalChangeLike[]>;
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function pagesOf<T>(state: unknown): T[] {
  const pages = record(state)['pages'];
  if (Array.isArray(pages)) return pages as T[];
  return Object.values(record(pages)) as T[];
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** A URL without its origin, so lists stay short. */
export function pathOf(url: string): string {
  try {
    const parsed = new URL(url, 'http://x');
    return url.startsWith('/') || parsed.host === 'x'
      ? `${parsed.pathname}${parsed.search}`
      : url.replace(/^[a-z]+:\/\/[^/]+/i, '') || url;
  } catch {
    return url;
  }
}

function ms(value: number): string {
  return value < 10 ? `${Math.round(value * 10) / 10} ms` : `${Math.round(value)} ms`;
}

function preview(value: unknown): string {
  let text: string;
  try {
    text = typeof value === 'string' ? JSON.stringify(value) : (JSON.stringify(value) ?? '');
  } catch {
    text = String(value);
  }
  return text.length > 80 ? `${text.slice(0, 79)}…` : text;
}

function routerEvents(state: unknown): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const page of pagesOf<RouterPage>(state)) {
    const pageId = typeof page?.pageId === 'string' ? page.pageId : '';
    for (const nav of list<NavigationRecord>(page?.navigations)) {
      // A navigation from before the overlay connected has no real start time,
      // which the Routes tab doesn't show either.
      if (!finite(nav?.startedAt) || nav.probe || nav.beforeConnect) continue;
      const took = finite(nav.endedAt) ? Math.max(0, nav.endedAt - nav.startedAt) : undefined;
      const to = nav.finalUrl && nav.finalUrl !== nav.url ? ` to ${nav.finalUrl}` : '';
      events.push({
        key: `router:${pageId}:${nav.id}`,
        layer: 'router',
        pageId,
        at: nav.startedAt,
        ...(took !== undefined ? { ms: took } : {}),
        title: `Navigation to ${nav.url}`,
        detail: [`${nav.outcome}${to}`, nav.trigger, took !== undefined ? ms(took) : '']
          .filter(Boolean)
          .join(' · '),
        ...(nav.outcome === 'failed'
          ? { tone: 'danger' as const }
          : nav.outcome === 'cancelled' || nav.outcome === 'redirected'
            ? { tone: 'warn' as const }
            : {}),
        link: { tab: 'routes', ...(pageId ? { page: pageId } : {}) },
      });
    }
  }
  return events;
}

function httpTone(call: HttpCallLike): TimelineTone | undefined {
  const status = call.status ?? 0;
  if (call.error || status >= 500 || (status === 0 && !call.cancelled)) return 'danger';
  if (status >= 400 || call.faulted || call.cancelled) return 'warn';
  return undefined;
}

function httpEvent(call: HttpCallLike, pageId: string): TimelineEvent | null {
  if (!finite(call?.at)) return null;
  const side = call.side === 'server' ? 'SSR' : 'client';
  const status = call.status ? String(call.status) : call.cancelled ? 'cancelled' : 'no response';
  const took = finite(call.durationMs) ? call.durationMs : undefined;
  const tone = httpTone(call);
  return {
    key: `http:${call.side === 'server' ? 'server' : pageId}:${call.id ?? call.at}`,
    layer: 'http',
    pageId,
    at: call.at,
    ...(took !== undefined ? { ms: took } : {}),
    title: `${call.method ?? 'GET'} ${pathOf(call.url ?? '')}`,
    detail: [
      status,
      side,
      took !== undefined ? ms(took) : '',
      call.cacheHit ? 'from cache' : '',
      call.mocked ? 'mocked' : call.faulted ? 'fault rule' : '',
    ]
      .filter(Boolean)
      .join(' · '),
    ...(tone ? { tone } : {}),
    link: { tab: 'network', ...(pageId ? { page: pageId } : {}) },
  };
}

function httpEvents(state: unknown): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const pages = pagesOf<HttpPageLike>(state);
  for (const page of pages) {
    const pageId = typeof page?.pageId === 'string' ? page.pageId : '';
    for (const call of list<HttpCallLike>(page?.calls)) {
      const event = httpEvent(call, pageId);
      if (event) events.push(event);
    }
  }
  // A server call belongs to the page its SSR request rendered, when one says so.
  for (const call of list<HttpCallLike>(record(state)['serverCalls'])) {
    const owner = call?.pageUrl
      ? pages.find((page) => page?.initialUrl && page.initialUrl === call.pageUrl)
      : undefined;
    const event = httpEvent({ ...call, side: 'server' }, owner?.pageId ?? '');
    if (event) events.push(event);
  }
  return events;
}

function ngrxEvents(state: unknown): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const page of pagesOf<NgrxPage>(state)) {
    const pageId = typeof page?.pageId === 'string' ? page.pageId : '';
    for (const entry of list<NgrxLogEntry>(page?.log)) {
      if (!finite(entry?.timestamp)) continue;
      const changes = list(entry.diff).length + (entry.diffTruncated ?? 0);
      const took = finite(entry.durationMs) ? entry.durationMs : undefined;
      events.push({
        key: `ngrx:${pageId}:${entry.seq}`,
        layer: 'ngrx',
        pageId,
        at: entry.timestamp,
        ...(took !== undefined ? { ms: took } : {}),
        title: entry.source === 'event' ? (entry.eventType ?? entry.type) : entry.type,
        detail: [
          entry.storeId,
          entry.source === 'event'
            ? 'event'
            : changes
              ? `${changes} ${changes === 1 ? 'change' : 'changes'}`
              : 'no change',
          took !== undefined ? ms(took) : '',
        ]
          .filter(Boolean)
          .join(' · '),
        link: { tab: 'store', ...(pageId ? { page: pageId } : {}) },
      });
    }
  }
  return events;
}

/** A change detection cycle past one frame (16 ms) is marked slow. */
const SLOW_CYCLE_MS = 16;

function cdEvents(state: unknown): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const page of pagesOf<CdReport>(state)) {
    const pageId = typeof page?.pageId === 'string' ? page.pageId : '';
    for (const cycle of list<CdReport['cycles'][number]>(page?.cycles)) {
      if (!finite(cycle?.at)) continue;
      const took = finite(cycle.ms) ? cycle.ms : 0;
      events.push({
        key: `cd:${pageId}:${cycle.id}`,
        layer: 'cd',
        pageId,
        at: cycle.at,
        ms: took,
        title: `Change detection cycle ${cycle.id}`,
        detail: [
          ms(took),
          `${cycle.checks} ${cycle.checks === 1 ? 'check' : 'checks'}`,
          cycle.trigger ? `after ${cycle.trigger}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        ...(took > SLOW_CYCLE_MS ? { tone: 'warn' as const } : {}),
        link: { tab: 'components', ...(pageId ? { page: pageId } : {}) },
      });
    }
  }
  return events;
}

function formsEvents(state: unknown): TimelineEvent[] {
  return list<FormEvent>(record(state)['events']).flatMap((event, index) => {
    if (!finite(event?.timestamp) || typeof event.formId !== 'string') return [];
    const pageId = pageOf(event.formId);
    const detail = [event.detail, event.origin, event.outcome].filter(Boolean).join(' · ');
    return [
      {
        key: `forms:${event.formId}:${event.seq ?? `i${index}`}`,
        layer: 'forms' as const,
        pageId,
        at: event.timestamp,
        ...(finite(event.ms) ? { ms: event.ms } : {}),
        title: `${event.type} ${event.path || 'form'}`,
        detail,
        ...(event.type === 'submit' && event.outcome === 'invalid'
          ? { tone: 'warn' as const }
          : {}),
        link: { tab: 'forms', id: event.formId, ...(pageId ? { page: pageId } : {}) },
      },
    ];
  });
}

const SIGNAL_SOURCE: Record<string, string> = { write: 'set', sample: 'sampled' };

function signalEvents(state: unknown): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const pages = record(record(state)['pages']);
  // Older servers send only the newest graph.
  const graphs: [string, unknown][] = Object.keys(pages).length
    ? Object.entries(pages)
    : [['', record(state)['graph']]];
  for (const [key, value] of graphs) {
    const graph = record(value) as SignalGraphLike;
    const pageId = typeof graph.pageId === 'string' ? graph.pageId : String(key);
    const names = new Map(
      list<{ id?: string; label?: string; kind?: string }>(graph.nodes).map((node) => [
        node?.id,
        node?.label || node?.kind || 'signal',
      ]),
    );
    for (const [nodeId, changes] of Object.entries(record(graph.history))) {
      for (const change of list<SignalChangeLike>(changes)) {
        // The first value is not a change; it only says where history starts.
        if (!finite(change?.at) || change.source === 'initial') continue;
        const name = names.get(nodeId) ?? nodeId;
        events.push({
          key: `signals:${pageId}:${nodeId}:${change.epoch ?? change.at}`,
          layer: 'signals',
          pageId,
          at: change.at,
          title: `${name} ${SIGNAL_SOURCE[change.source ?? ''] ?? 'changed'}`,
          detail: preview(change.value),
          link: { tab: 'signals', ...(pageId ? { page: pageId } : {}) },
        });
      }
    }
  }
  return events;
}

const READERS: Record<TimelineLayer, (state: unknown) => TimelineEvent[]> = {
  router: routerEvents,
  http: httpEvents,
  ngrx: ngrxEvents,
  cd: cdEvents,
  forms: formsEvents,
  signals: signalEvents,
};

/**
 * Every event the sources hold, on one time axis, oldest first. Events at the
 * same time keep the layer order, so the list doesn't reshuffle on an update.
 */
export function mergeTimeline(sources: TimelineSources): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const layer of TIMELINE_LAYERS) {
    const state = sources[layer.id];
    if (state !== undefined && state !== null) events.push(...READERS[layer.id](state));
  }
  const order = new Map(TIMELINE_LAYERS.map((layer, index) => [layer.id, index]));
  events.sort(
    (a, b) =>
      a.at - b.at ||
      order.get(a.layer)! - order.get(b.layer)! ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
  // A source that repeats an id must not break the list, which tracks by key.
  const seen = new Set<string>();
  for (const event of events) {
    let key = event.key;
    for (let n = 2; seen.has(key); n++) key = `${event.key}#${n}`;
    event.key = key;
    seen.add(key);
  }
  return events;
}

export interface TimelinePage {
  pageId: string;
  label: string;
}

/** The pages any source reports, labelled by the best name a source gives. */
export function timelinePages(sources: TimelineSources, events: TimelineEvent[]): TimelinePage[] {
  const labels = new Map<string, string>();
  const name = (pageId: unknown, label: unknown) => {
    if (typeof pageId !== 'string' || !pageId) return;
    if (typeof label === 'string' && label && !labels.get(pageId)) labels.set(pageId, label);
    else if (!labels.has(pageId)) labels.set(pageId, '');
  };
  for (const page of pagesOf<HttpPageLike>(sources.http))
    name(page?.pageId, page?.title || page?.url);
  for (const page of pagesOf<RouterPage>(sources.router)) name(page?.pageId, page?.snapshot?.url);
  for (const page of pagesOf<NgrxPage>(sources.ngrx)) name(page?.pageId, page?.title || page?.url);
  for (const event of events) name(event.pageId, '');
  return [...labels].map(([pageId, label]) => ({ pageId, label: label || pageId }));
}

export const ALL_PAGES = 'all';

export interface TimeRange {
  start: number;
  end: number;
}

export interface TimelineFilter {
  layers: ReadonlySet<TimelineLayer>;
  /** A `pageId`, or `ALL_PAGES`. */
  pageId: string;
  query: string;
}

/** The events on the visible layers and the picked page that match the query. */
export function filterTimeline(events: TimelineEvent[], filter: TimelineFilter): TimelineEvent[] {
  const query = filter.query.trim().toLowerCase();
  return events.filter(
    (event) =>
      filter.layers.has(event.layer) &&
      (filter.pageId === ALL_PAGES || event.pageId === filter.pageId) &&
      (!query ||
        event.title.toLowerCase().includes(query) ||
        event.detail.toLowerCase().includes(query)),
  );
}

/** The events that start inside `range`; all of them without one. */
export function inRange(events: TimelineEvent[], range: TimeRange | null): TimelineEvent[] {
  if (!range) return events;
  return events.filter((event) => event.at >= range.start && event.at <= range.end);
}

/** The time the events cover, from the first start to the last end. */
export function extentOf(events: TimelineEvent[]): TimeRange | null {
  if (!events.length) return null;
  let start = Infinity;
  let end = -Infinity;
  for (const event of events) {
    start = Math.min(start, event.at);
    end = Math.max(end, event.at + (event.ms ?? 0));
  }
  // A single instant still needs some width to draw.
  return end - start < MIN_SPAN
    ? { start: start - MIN_SPAN / 2, end: start + MIN_SPAN / 2 }
    : { start, end };
}

/** The narrowest range zooming goes to, in ms. */
export const MIN_SPAN = 20;

/** Zooms around the middle of `range` by `factor` (below 1 zooms in), inside `bounds`. */
export function zoomRange(range: TimeRange, factor: number, bounds: TimeRange): TimeRange | null {
  const span = Math.max(MIN_SPAN, (range.end - range.start) * factor);
  if (span >= bounds.end - bounds.start) return null;
  const middle = (range.start + range.end) / 2;
  return clampRange({ start: middle - span / 2, end: middle + span / 2 }, bounds);
}

/** Moves `range` by a share of its width (negative is earlier), inside `bounds`. */
export function panRange(range: TimeRange, share: number, bounds: TimeRange): TimeRange {
  const shift = (range.end - range.start) * share;
  return clampRange({ start: range.start + shift, end: range.end + shift }, bounds);
}

function clampRange(range: TimeRange, bounds: TimeRange): TimeRange {
  const span = range.end - range.start;
  if (range.start < bounds.start) return { start: bounds.start, end: bounds.start + span };
  if (range.end > bounds.end) return { start: bounds.end - span, end: bounds.end };
  return range;
}

/** The range between two points of the chart, as shares of its width (0 to 1). */
export function rangeBetween(view: TimeRange, from: number, to: number): TimeRange | null {
  const [a, b] = from < to ? [from, to] : [to, from];
  const clamp = (share: number) => Math.min(1, Math.max(0, share));
  const span = view.end - view.start;
  const start = view.start + clamp(a) * span;
  const end = view.start + clamp(b) * span;
  return end - start < MIN_SPAN ? null : { start, end };
}

export interface TimelineBin {
  layer: TimelineLayer;
  /** Index of the first slot the bin covers. */
  slot: number;
  count: number;
  tone?: TimelineTone;
}

/**
 * Groups the events of each layer into `slots` equal slices of `view`, so the
 * chart draws at most one mark per slice and layer however many events there
 * are. A bin takes the worst tone of its events.
 */
export function binTimeline(
  events: TimelineEvent[],
  view: TimeRange,
  slots: number,
): TimelineBin[] {
  const span = Math.max(1, view.end - view.start);
  const bins = new Map<string, TimelineBin>();
  for (const event of events) {
    if (event.at < view.start || event.at > view.end) continue;
    const slot = Math.min(slots - 1, Math.floor(((event.at - view.start) / span) * slots));
    const id = `${event.layer}:${slot}`;
    let bin = bins.get(id);
    if (!bin) {
      bin = { layer: event.layer, slot, count: 0 };
      bins.set(id, bin);
    }
    bin.count++;
    if (event.tone === 'danger' || (event.tone === 'warn' && bin.tone !== 'danger')) {
      bin.tone = event.tone;
    }
  }
  return [...bins.values()];
}

/** The event of `layer` that starts closest to `at`. */
export function nearestEvent(
  events: TimelineEvent[],
  layer: TimelineLayer,
  at: number,
): TimelineEvent | null {
  let best: TimelineEvent | null = null;
  for (const event of events) {
    if (event.layer !== layer) continue;
    if (!best || Math.abs(event.at - at) < Math.abs(best.at - at)) best = event;
  }
  return best;
}

const HIDDEN_KEY = 'pangular-timeline-hidden-layers';

/** The layers the viewer turned off, kept across reloads. */
export function storedHiddenLayers(): TimelineLayer[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]');
    return Array.isArray(value)
      ? value.filter((layer): layer is TimelineLayer =>
          TIMELINE_LAYERS.some((info) => info.id === layer),
        )
      : [];
  } catch {
    return [];
  }
}

export function storeHiddenLayers(layers: readonly TimelineLayer[]) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(layers));
  } catch {
    // Blocked storage only forgets the layers on the next reload.
  }
}

/** A wall clock time with milliseconds, which events close together need. */
export function clockTime(at: number): string {
  const date = new Date(at);
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

/** A span of time in the unit that reads best. */
export function spanText(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${Math.round(ms / 100) / 10} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return seconds ? `${minutes} min ${seconds} s` : `${minutes} min`;
}
