import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { filterAnnouncement } from '../ui/filter-status';
import type { PanelLink } from '@pangular-inspector/devtools/internal/config';
import type { DevframeRpcClient } from 'devframe/client';
import { panelConfig } from '../devtools-config';
import { hostPageId } from '../page-id';
import { RovingList } from '../ui/roving-list';
import { Select, type SelectOption } from '../ui/select';
import {
  ALL_PAGES,
  LAYER_INFO,
  TIMELINE_LAYERS,
  binTimeline,
  clockTime,
  enabledLayers,
  extentOf,
  filterTimeline,
  inRange,
  mergeTimeline,
  nearestEvent,
  panRange,
  rangeBetween,
  spanText,
  storeHiddenLayers,
  storedHiddenLayers,
  timelinePages,
  zoomRange,
  type TimeRange,
  type TimelineEvent,
  type TimelineLayer,
  type TimelineSources,
} from './timeline-data';

/** How many rows the list renders, newest first. The chart always draws every event. */
export const TIMELINE_LIST_CAP = 200;
/** Slices of the chart's width; each layer draws at most one mark per slice. */
const SLOTS = 240;
/** Width of the chart's drawing, in its own units. */
const CHART_WIDTH = 1000;
/** A pointer that moves less than this many pixels clicks rather than selects a range. */
const DRAG_THRESHOLD = 4;

@Component({
  selector: 'app-timeline',
  imports: [Select, RovingList],
  template: `
    <p class="intro">
      Navigations, HTTP calls, NgRx actions, change detection cycles, form events and signal changes
      from the live page on one time axis. Turn layers on and off, drag across the chart to look at
      a range, and open an event in its own tab.
    </p>
    @if (loading()) {
      <p class="state" role="status">Loading the timeline…</p>
    } @else if (failed()) {
      <div class="state" role="alert">
        <p>Can't read the timeline from the devtools server.</p>
        <button type="button" class="small" (click)="retry()">Retry</button>
      </div>
    } @else {
      <div class="toolbar">
        <div class="search">
          <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            #search
            type="search"
            aria-label="Filter events"
            placeholder="Filter by name, URL or detail"
            autocomplete="off"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            (keydown.escape)="query.set('')"
          />
        </div>
        @if (pageOptions().length > 2) {
          <app-select
            class="page-select"
            ariaLabel="Page"
            [options]="pageOptions()"
            [value]="pageId()"
            (valueChange)="pageId.set($event ?? allPages)"
          />
        }
        <span class="count">{{ countText() }}</span>
        <p class="sr-only" role="status">{{ countStatus() }}</p>
      </div>
      <div class="controls">
        <div class="layers" role="group" aria-label="Layers">
          @for (layer of layers(); track layer.id) {
            <button
              type="button"
              class="layer"
              [attr.aria-pressed]="!hidden().includes(layer.id)"
              (click)="toggleLayer(layer.id)"
            >
              <span class="check" aria-hidden="true"></span>
              {{ layer.label }}
              <span class="badge">{{ layerCounts()[layer.id] }}</span>
            </button>
          }
        </div>
        <div class="zoom" role="group" aria-label="Time range">
          <button type="button" class="small" [disabled]="!canZoomIn()" (click)="zoom(0.5)">
            Zoom in
          </button>
          <button type="button" class="small" [disabled]="!range()" (click)="zoom(2)">
            Zoom out
          </button>
          <button type="button" class="small" [disabled]="!canPan(-1)" (click)="pan(-1)">
            Earlier
          </button>
          <button type="button" class="small" [disabled]="!canPan(1)" (click)="pan(1)">
            Later
          </button>
          <button type="button" class="small" [disabled]="!range()" (click)="range.set(null)">
            Show all
          </button>
        </div>
      </div>

      @if (!events().length) {
        <div class="state" role="status">
          <p>Nothing on the timeline yet.</p>
          <p class="muted">
            Use the app with the overlay loaded. Navigations, HTTP calls, NgRx actions and form
            events show up as they happen. Record change detection on the Components tab, and pick a
            component on the Signals tab to follow its signals.
          </p>
        </div>
      } @else if (!shown().length) {
        <div class="state" role="status">
          <p>No event matches the filters{{ range() ? ' in this range' : '' }}.</p>
          <button type="button" class="small" (click)="clearFilters(); search.focus()">
            Clear filters
          </button>
        </div>
      } @else {
        <section class="chart-card" aria-labelledby="timeline-chart-heading">
          <div class="chart-head">
            <h2 id="timeline-chart-heading">Time axis</h2>
            <span class="muted">{{ viewText() }}</span>
          </div>
          <div class="chart">
            <ul class="lane-labels" aria-hidden="true">
              @for (layer of lanes(); track layer.id) {
                <li>{{ layer.label }}</li>
              }
            </ul>
            <div
              #tracks
              class="tracks"
              role="img"
              [attr.aria-label]="chartLabel()"
              [style.height.px]="lanes().length * laneHeight"
              (pointerdown)="onPointerDown($event)"
              (pointermove)="onPointerMove($event)"
              (pointerup)="onPointerUp($event)"
              (pointercancel)="brush.set(null)"
            >
              <svg
                [attr.viewBox]="'0 0 ' + chartWidth + ' ' + lanes().length * laneHeight"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                @for (layer of lanes(); track layer.id; let i = $index) {
                  <line
                    class="lane-line"
                    x1="0"
                    [attr.x2]="chartWidth"
                    [attr.y1]="i * laneHeight + laneHeight / 2"
                    [attr.y2]="i * laneHeight + laneHeight / 2"
                  />
                }
                @for (bin of bins(); track bin.layer + bin.slot) {
                  <rect
                    class="mark"
                    [attr.data-tone]="bin.tone ?? null"
                    [attr.x]="bin.slot * slotWidth"
                    [attr.y]="laneIndex()[bin.layer] * laneHeight + 4"
                    [attr.width]="slotWidth - 1"
                    [attr.height]="laneHeight - 8"
                    [attr.opacity]="binOpacity(bin.count)"
                  />
                }
                @if (selectedMark(); as mark) {
                  <rect
                    class="selected-mark"
                    [attr.x]="mark.x - 2"
                    [attr.y]="mark.y + 1"
                    [attr.width]="slotWidth + 3"
                    [attr.height]="laneHeight - 2"
                  />
                }
              </svg>
              @if (brushBox(); as box) {
                <div class="brush" [style.left.%]="box.left" [style.width.%]="box.width"></div>
              }
            </div>
          </div>
          <div class="axis" aria-hidden="true">
            <span>{{ clock(view()!.start) }}</span>
            <span>{{ clock(view()!.end) }}</span>
          </div>
          <p class="hint">
            Drag across the chart to look at a range, and click a mark to select the nearest event.
            The list below holds the same events.
          </p>
        </section>

        <div class="split">
          <section class="events" aria-labelledby="timeline-events-heading">
            <h2 id="timeline-events-heading">Events</h2>
            @if (shown().length > listed().length) {
              <p class="note">
                Showing the newest {{ listed().length }} of {{ shown().length }} events. Zoom in or
                filter to see older ones.
              </p>
            }
            <ol class="rows" appRovingList="button.row" aria-label="Events, newest first">
              @for (event of listed(); track event.key) {
                <li>
                  <button
                    type="button"
                    class="row"
                    [class.selected]="event.key === selectedKey()"
                    [attr.aria-current]="event.key === selectedKey() ? 'true' : null"
                    [attr.data-key]="event.key"
                    (click)="select(event)"
                    (dblclick)="openEvent(event)"
                  >
                    <time class="when">{{ clock(event.at) }}</time>
                    <span class="chip" [attr.data-tone]="event.tone ?? null">{{
                      layerLabel(event.layer)
                    }}</span>
                    <span class="title">{{ event.title }}</span>
                    @if (event.detail) {
                      <span class="detail">{{ event.detail }}</span>
                    }
                    @if (showPage()) {
                      <span class="page">{{ pageLabel(event.pageId) }}</span>
                    }
                  </button>
                </li>
              }
            </ol>
          </section>
          <aside class="detail-panel" aria-labelledby="timeline-detail-heading">
            <h2 id="timeline-detail-heading">Selected event</h2>
            @if (selected(); as event) {
              <p class="detail-title">{{ event.title }}</p>
              <dl>
                <dt>Layer</dt>
                <dd>{{ layerLabel(event.layer) }}</dd>
                <dt>Time</dt>
                <dd>{{ clock(event.at) }}</dd>
                @if (event.ms !== undefined) {
                  <dt>Took</dt>
                  <dd>{{ span(event.ms) }}</dd>
                }
                @if (event.detail) {
                  <dt>Detail</dt>
                  <dd class="mono">{{ event.detail }}</dd>
                }
                <dt>Page</dt>
                <dd>{{ event.pageId ? pageLabel(event.pageId) : 'Server, no page' }}</dd>
              </dl>
              <button type="button" class="primary" (click)="openEvent(event)">
                Open in {{ tabLabel(event.layer) }}
              </button>
            } @else {
              <p class="muted">
                Select an event in the list or on the chart to see it here. Double click a row to
                open it in its own tab.
              </p>
            }
          </aside>
        </div>
      }
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
      font-size: 13px;
    }
    h2 {
      margin: 0;
      @include m.label;
    }
    .intro {
      margin: 0 0 12px;
      color: var(--text-2);
      line-height: 1.5;
    }
    .muted {
      color: var(--text-2);
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
      margin: 0 0 8px;
      padding: 8px;
      background: color-mix(in srgb, var(--surface) 85%, transparent);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    .search {
      position: relative;
      flex: 1 1 200px;
      min-width: 0;
    }
    .search-icon {
      position: absolute;
      top: 50%;
      left: 12px;
      width: 14px;
      height: 14px;
      transform: translateY(-50%);
      fill: none;
      stroke: var(--text-3);
      stroke-width: 2.2;
      stroke-linecap: round;
      pointer-events: none;
    }
    input[type='search'] {
      width: 100%;
      height: var(--control-h);
      padding: 0 12px 0 34px;
      background: var(--bg);
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 13px;
    }
    input[type='search']:focus {
      @include m.field-focus;
    }
    .page-select {
      flex: 0 1 200px;
      min-width: 0;
    }
    .count {
      margin-left: auto;
      color: var(--text-2);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      align-items: center;
      justify-content: space-between;
      margin: 0 0 12px;
    }
    .layers,
    .zoom {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .layer {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      height: var(--control-h);
      padding: 0 10px;
      border: 1px solid var(--control-border);
      border-radius: 99px;
      background: var(--surface);
      color: var(--text-2);
      font: inherit;
      cursor: pointer;
      transition: background-color 150ms var(--ease);
    }
    .layer:hover {
      background: var(--surface-2);
    }
    .layer[aria-pressed='true'] {
      border-color: var(--accent-line);
      background: var(--accent-soft);
      color: var(--text-strong);
    }
    .layer:focus-visible {
      @include m.focus-ring;
    }
    .check {
      width: 12px;
      height: 12px;
      border: 1.5px solid var(--control-border);
      border-radius: 3px;
    }
    .layer[aria-pressed='true'] .check {
      border-color: var(--accent);
      background: var(--accent);
      box-shadow: inset 0 0 0 2px var(--surface);
    }
    .badge {
      color: var(--text-2);
      font-variant-numeric: tabular-nums;
    }
    .small,
    .primary {
      height: var(--control-h);
      padding: 0 12px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      cursor: pointer;
    }
    .small:disabled {
      color: var(--text-3);
      cursor: default;
    }
    .primary {
      border-color: var(--accent);
      background: var(--accent);
      color: var(--accent-ink);
      font-weight: 600;
    }
    .primary:hover {
      background: var(--accent-hover);
    }
    .small:focus-visible,
    .primary:focus-visible {
      @include m.focus-ring;
    }
    .state {
      margin: 0 0 12px;
      color: var(--text-2);
    }
    .state p {
      margin: 0 0 8px;
    }
    .chart-card {
      @include m.panel;
      margin: 0 0 12px;
      padding: 10px 12px;
    }
    .chart-head {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      align-items: baseline;
      justify-content: space-between;
      margin: 0 0 8px;
      font-size: 12px;
    }
    .chart {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 8px;
    }
    .lane-labels {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .lane-labels li {
      height: 24px;
      color: var(--text-2);
      font-size: 11.5px;
      line-height: 24px;
      white-space: nowrap;
    }
    .tracks {
      position: relative;
      min-width: 0;
      border-radius: var(--radius-sm);
      background: var(--bg);
      cursor: crosshair;
      touch-action: none;
      user-select: none;
    }
    .tracks svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .lane-line {
      stroke: var(--border);
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }
    /* Plain events are neutral, so warnings stand out in every accent. */
    .mark {
      fill: var(--text-2);
    }
    .mark[data-tone='warn'] {
      fill: var(--warn);
    }
    .mark[data-tone='danger'] {
      fill: var(--danger);
    }
    .selected-mark {
      fill: none;
      stroke: var(--text-strong);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
    }
    .brush {
      position: absolute;
      top: 0;
      bottom: 0;
      border: 1px solid var(--accent-line);
      background: var(--accent-soft);
      pointer-events: none;
    }
    .axis {
      display: flex;
      justify-content: space-between;
      margin: 4px 0 0;
      color: var(--text-2);
      font-size: 11.5px;
      font-variant-numeric: tabular-nums;
    }
    .hint {
      margin: 6px 0 0;
      color: var(--text-2);
      font-size: 12px;
    }
    .split {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
      gap: 12px;
      align-items: start;
    }
    @media (max-width: 880px) {
      .split {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .events h2,
    .detail-panel h2 {
      margin: 0 0 8px;
    }
    .note {
      margin: 0 0 8px;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text-2);
      line-height: 1.5;
    }
    .rows {
      display: grid;
      margin: 0;
      padding: 0;
      list-style: none;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .rows li + li {
      border-top: 1px solid var(--border);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 2px 10px;
      align-items: baseline;
      width: 100%;
      min-width: 0;
      padding: 6px 10px;
      border: 0;
      background: var(--surface);
      color: var(--text);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .row:hover {
      background: var(--surface-2);
    }
    .row.selected {
      background: var(--accent-soft);
      box-shadow: inset 3px 0 0 var(--accent);
    }
    .row:focus-visible {
      @include m.focus-ring(-2px);
    }
    .when {
      color: var(--text-2);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      padding: 0 8px;
      border: 1px solid transparent;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
      border-color: var(--border);
      background: var(--surface-2);
      color: var(--text-2);
    }
    .chip[data-tone='warn'] {
      @include m.tint(warn);
    }
    .chip[data-tone='danger'] {
      @include m.tint(danger);
    }
    .title {
      flex: 1 1 200px;
      min-width: 0;
      color: var(--text-strong);
      font-family: var(--font-mono);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .detail,
    .page {
      color: var(--text-2);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .detail-panel {
      @include m.panel;
      position: sticky;
      top: 64px;
      display: grid;
      gap: 8px;
      min-width: 0;
      padding: 12px;
    }
    .detail-title {
      margin: 0;
      color: var(--text-strong);
      font-family: var(--font-mono);
      font-size: 12.5px;
      overflow-wrap: anywhere;
    }
    dl {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 4px 12px;
      margin: 0;
    }
    dt {
      color: var(--text-2);
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .mono {
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .detail-panel p {
      margin: 0;
    }
    @media (prefers-reduced-motion: reduce) {
      .layer {
        transition: none;
      }
    }
  `,
})
export class Timeline {
  readonly rpc = input<DevframeRpcClient | null>(null);
  /** Opens an event in its own tab, through the panel's deep links. */
  readonly open = output<PanelLink>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly tracks = viewChild<ElementRef<HTMLElement>>('tracks');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly hostPageId = hostPageId();
  private cleanups: (() => void)[] = [];
  private loads = 0;

  protected readonly allPages = ALL_PAGES;
  protected readonly clock = clockTime;
  protected readonly span = spanText;
  protected readonly laneHeight = 24;
  protected readonly chartWidth = CHART_WIDTH;
  protected readonly slotWidth = CHART_WIDTH / SLOTS;

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly sources = signal<TimelineSources>({});
  readonly query = signal('');
  readonly hidden = signal<TimelineLayer[]>(storedHiddenLayers());
  /** The range the viewer zoomed into, or `null` for everything, which follows new events. */
  readonly range = signal<TimeRange | null>(null);
  readonly selectedKey = signal<string | null>(null);
  /** The range being dragged on the chart, as shares of its width. */
  readonly brush = signal<{ from: number; to: number; id: number } | null>(null);

  /** The layers of the inspectors that are on. */
  readonly layers = computed(() => enabledLayers(panelConfig(this.rpc())));
  readonly events = computed(() => {
    const on = new Set(this.layers().map((layer) => layer.id));
    return mergeTimeline(this.sources()).filter((event) => on.has(event.layer));
  });
  readonly pages = computed(() => timelinePages(this.sources(), this.events()));
  /** Keeps the picked page while it reports, else this tab's page, else all pages. */
  readonly pageId = linkedSignal<string[], string>({
    source: () => this.pages().map((page) => page.pageId),
    computation: (pages, previous) => {
      if (previous && (previous.value === ALL_PAGES || pages.includes(previous.value))) {
        return previous.value;
      }
      return this.hostPageId && pages.includes(this.hostPageId) ? this.hostPageId : ALL_PAGES;
    },
  });
  readonly pageOptions = computed<SelectOption[]>(() => [
    { value: ALL_PAGES, label: 'All pages' },
    ...this.pages().map((page) => ({
      value: page.pageId,
      label: page.label,
      ...(page.label !== page.pageId ? { hint: page.pageId } : {}),
    })),
  ]);
  readonly showPage = computed(() => this.pageId() === ALL_PAGES && this.pages().length > 1);

  /** Events on the picked page that match the query, on every layer. */
  private readonly matching = computed(() =>
    filterTimeline(this.events(), {
      layers: new Set(TIMELINE_LAYERS.map((layer) => layer.id)),
      pageId: this.pageId(),
      query: this.query(),
    }),
  );
  readonly layerCounts = computed(() => {
    const counts = Object.fromEntries(TIMELINE_LAYERS.map((layer) => [layer.id, 0])) as Record<
      TimelineLayer,
      number
    >;
    for (const event of inRange(this.matching(), this.range())) counts[event.layer]++;
    return counts;
  });
  /** The events on the visible layers, before the range. */
  private readonly visible = computed(() => {
    const hidden = new Set(this.hidden());
    return this.matching().filter((event) => !hidden.has(event.layer));
  });
  readonly lanes = computed(() => {
    const hidden = new Set(this.hidden());
    return this.layers().filter((layer) => !hidden.has(layer.id));
  });
  readonly laneIndex = computed(
    () =>
      Object.fromEntries(this.lanes().map((layer, index) => [layer.id, index])) as Record<
        TimelineLayer,
        number
      >,
  );
  readonly bounds = computed(() => extentOf(this.visible()));
  readonly view = computed(() => this.range() ?? this.bounds());
  readonly shown = computed(() => inRange(this.visible(), this.range()));
  readonly listed = computed(() => this.shown().slice(-TIMELINE_LIST_CAP).reverse());
  readonly bins = computed(() => {
    const view = this.view();
    return view ? binTimeline(this.shown(), view, SLOTS) : [];
  });
  private readonly maxBin = computed(() =>
    this.bins().reduce((max, bin) => Math.max(max, bin.count), 1),
  );
  readonly selected = computed(
    () => this.events().find((event) => event.key === this.selectedKey()) ?? null,
  );
  readonly selectedMark = computed(() => {
    const event = this.selected();
    const view = this.view();
    const lane = event ? this.laneIndex()[event.layer] : undefined;
    if (!event || !view || lane === undefined || event.at < view.start || event.at > view.end) {
      return null;
    }
    const span = Math.max(1, view.end - view.start);
    const slot = Math.min(SLOTS - 1, Math.floor(((event.at - view.start) / span) * SLOTS));
    return { x: slot * this.slotWidth, y: lane * this.laneHeight };
  });
  readonly brushBox = computed(() => {
    const brush = this.brush();
    if (!brush) return null;
    const from = Math.min(brush.from, brush.to);
    const to = Math.max(brush.from, brush.to);
    return { left: from * 100, width: (to - from) * 100 };
  });

  readonly countText = computed(() => {
    const total = this.events().length;
    return `${this.shown().length} of ${total} ${total === 1 ? 'event' : 'events'}`;
  });
  /** Speaks the count only after the user changes the search, layers, page or range. */
  readonly countStatus = filterAnnouncement(
    () => [this.query(), this.hidden(), this.pageId(), this.range()],
    () => this.countText(),
  );
  readonly viewText = computed(() => {
    const view = this.view();
    if (!view) return '';
    const span = spanText(view.end - view.start);
    return this.range() ? `Range of ${span}` : `All ${span}`;
  });
  readonly chartLabel = computed(() => {
    const view = this.view();
    if (!view) return 'Timeline';
    const counts = this.layerCounts();
    const parts = this.lanes().map((layer) => `${layer.label} ${counts[layer.id]}`);
    return (
      `Timeline from ${clockTime(view.start)} to ${clockTime(view.end)}: ` +
      `${parts.join(', ')}. The Events list holds the same events.`
    );
  });
  readonly canZoomIn = computed(() => {
    const view = this.view();
    return !!view && view.end - view.start > 40;
  });

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client) void this.load(client);
    });
    this.destroyRef.onDestroy(() => this.stop());
  }

  layerLabel(layer: TimelineLayer): string {
    return LAYER_INFO[layer].label;
  }

  tabLabel(layer: TimelineLayer): string {
    return LAYER_INFO[layer].tabLabel;
  }

  pageLabel(pageId: string): string {
    if (!pageId) return 'Server';
    return this.pages().find((page) => page.pageId === pageId)?.label ?? pageId;
  }

  binOpacity(count: number): number {
    // Denser slices read darker, but one event stays clearly visible.
    return (
      Math.round(
        (0.55 + 0.45 * Math.min(1, Math.log2(count + 1) / Math.log2(this.maxBin() + 1))) * 100,
      ) / 100
    );
  }

  toggleLayer(layer: TimelineLayer) {
    const hidden = this.hidden().includes(layer)
      ? this.hidden().filter((other) => other !== layer)
      : [...this.hidden(), layer];
    this.hidden.set(hidden);
    storeHiddenLayers(hidden);
  }

  clearFilters() {
    this.query.set('');
    this.range.set(null);
    this.hidden.set([]);
    storeHiddenLayers([]);
    this.pageId.set(ALL_PAGES);
  }

  zoom(factor: number) {
    const view = this.view();
    const bounds = this.bounds();
    if (!view || !bounds) return;
    this.range.set(zoomRange(view, factor, bounds));
  }

  canPan(direction: -1 | 1): boolean {
    const range = this.range();
    const bounds = this.bounds();
    if (!range || !bounds) return false;
    return direction < 0 ? range.start > bounds.start : range.end < bounds.end;
  }

  pan(direction: -1 | 1) {
    const range = this.range();
    const bounds = this.bounds();
    if (range && bounds) this.range.set(panRange(range, direction * 0.5, bounds));
  }

  select(event: TimelineEvent) {
    this.selectedKey.set(event.key);
  }

  openEvent(event: TimelineEvent) {
    this.open.emit(event.link);
  }

  /** Where a pointer is across the chart, from 0 at the left edge to 1 at the right. */
  private share(event: PointerEvent): number {
    const box = this.tracks()?.nativeElement.getBoundingClientRect();
    if (!box || box.width <= 0) return 0;
    return Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
  }

  onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const at = this.share(event);
    this.brush.set({ from: at, to: at, id: event.pointerId });
    this.downX = event.clientX;
    try {
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
    } catch {
      // the pointer is gone; the drag ends with it
    }
    event.preventDefault();
  }

  onPointerMove(event: PointerEvent) {
    const brush = this.brush();
    if (!brush || brush.id !== event.pointerId) return;
    this.brush.set({ ...brush, to: this.share(event) });
  }

  onPointerUp(event: PointerEvent) {
    const brush = this.brush();
    const view = this.view();
    this.brush.set(null);
    if (!brush || brush.id !== event.pointerId || !view) return;
    if (Math.abs(event.clientX - this.downX) < DRAG_THRESHOLD) {
      this.pick(event, view);
      return;
    }
    const range = rangeBetween(view, brush.from, this.share(event));
    if (range) this.range.set(range);
  }

  private downX = 0;

  /** Selects the event nearest to a click, on the lane under the pointer. */
  private pick(event: PointerEvent, view: TimeRange) {
    const box = this.tracks()?.nativeElement.getBoundingClientRect();
    const lanes = this.lanes();
    if (!box || !lanes.length) return;
    const lane =
      lanes[
        Math.min(
          lanes.length - 1,
          Math.max(0, Math.floor((event.clientY - box.top) / this.laneHeight)),
        )
      ];
    const at = view.start + this.share(event) * (view.end - view.start);
    const found = nearestEvent(this.shown(), lane.id, at);
    if (!found) return;
    this.selectedKey.set(found.key);
    queueMicrotask(() => {
      const row = this.host.nativeElement.querySelector<HTMLElement>(
        `button.row[data-key="${CSS.escape(found.key)}"]`,
      );
      row?.scrollIntoView?.({ block: 'nearest' });
    });
  }

  retry() {
    const client = this.rpc();
    if (client) void this.load(client);
  }

  private stop() {
    for (const cleanup of this.cleanups.splice(0)) cleanup();
  }

  private async load(client: DevframeRpcClient) {
    this.stop();
    const load = ++this.loads;
    this.loading.set(true);
    this.failed.set(false);
    const rpc = client.scope('pangular').rpc;
    const results = await Promise.allSettled(
      TIMELINE_LAYERS.map(async (layer) => {
        const state = await rpc.sharedState(layer.state);
        if (this.destroyRef.destroyed || load !== this.loads) return;
        const apply = (value: unknown) =>
          this.sources.update((sources) => ({ ...sources, [layer.id]: value }));
        apply(state.value());
        this.cleanups.push(state.on('updated', apply));
      }),
    );
    if (this.destroyRef.destroyed || load !== this.loads) return;
    this.failed.set(results.every((result) => result.status === 'rejected'));
    this.loading.set(false);
  }
}
