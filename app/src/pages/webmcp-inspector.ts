import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';
import type { PanelLink } from '@pangular-inspector/devtools/internal/config';
import {
  claimsReadOnly,
  type WebMcpTraceSources,
} from '@pangular-inspector/devtools/internal/webmcp-trace';
import type { DevframeRpcClient } from 'devframe/client';
import { panelConfig } from '../devtools-config';
import { hostPageId } from '../page-id';
import { filterAnnouncement } from '../ui/filter-status';
import { LimitNote } from '../ui/limit-note';
import { RovingList } from '../ui/roving-list';
import { SearchField } from '../ui/search-field';
import { Select, type SelectOption } from '../ui/select';
import { clockTime, spanText } from './timeline-data';
import { WebMcpCallDetail } from './webmcp-call-detail';
import {
  ALL_PAGES,
  callRows,
  defaultWebMcpPage,
  droppedCalls,
  pageLabel,
  pickPages,
  toolOf,
  toolRows,
  traceRow,
  webMcpPages,
  type WebMcpPageView,
} from './webmcp-data';
import { WebMcpToolDetail } from './webmcp-tool-detail';

type View = 'tools' | 'calls';

/** A call to select, from a deep link such as the Timeline's. */
export interface WebMcpFocus {
  id: string;
  page?: string;
}

/** The shared states the call trace reads, by their key in `WebMcpTraceSources`. */
const TRACE_STATES: readonly [keyof WebMcpTraceSources, string][] = [
  ['http', 'http'],
  ['ngrx', 'ngrx-store'],
  ['router', 'router'],
  ['forms', 'forms'],
  ['signals', 'signal-graph'],
];

@Component({
  selector: 'app-webmcp-inspector',
  imports: [Select, RovingList, LimitNote, SearchField, WebMcpToolDetail, WebMcpCallDetail],
  template: `
    <p class="intro">
      The tools the live page registers with <code>modelContext</code> for browser agents, and each
      call an agent made, with what it changed on the page. Values are masked like other live data.
    </p>
    @if (!loaded()) {
      <p class="state" role="status">Loading WebMCP tools…</p>
    } @else if (failed()) {
      <div class="state" role="alert">
        <p>Can't read WebMCP tools from the devtools server.</p>
        <button type="button" class="small" (click)="retry()">Retry</button>
      </div>
    } @else if (!pages().length) {
      <div class="state" role="status">
        <p>No page reports WebMCP yet.</p>
        <p class="muted">
          Open the app with the overlay loaded. Tools show up here once the page registers them with
          <code>modelContext.registerTool()</code>, and calls once an agent runs one.
        </p>
      </div>
    } @else {
      <div class="toolbar">
        <div class="views" role="group" aria-label="Show">
          <button
            type="button"
            class="view"
            [attr.aria-pressed]="view() === 'tools'"
            (click)="view.set('tools')"
          >
            Tools <span class="badge">{{ tools().length }}</span>
          </button>
          <button
            type="button"
            class="view"
            [attr.aria-pressed]="view() === 'calls'"
            (click)="view.set('calls')"
          >
            Calls <span class="badge">{{ calls().length }}</span>
          </button>
        </div>
        <app-search-field
          #search
          class="search"
          saveKey="webmcp"
          [placeholder]="
            view() === 'tools' ? 'Filter by name or description' : 'Filter by tool or outcome'
          "
          [(value)]="query"
        />
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

      @for (page of noModelContext(); track page.pageId) {
        <p class="notice">
          {{ showPage() ? pageName(page.pageId) + ' has' : 'This page has' }} no
          <code>modelContext</code>, so a browser agent sees none of these tools.
        </p>
      }

      @if (view() === 'tools') {
        <div class="split">
          <section class="list" aria-labelledby="webmcp-tools-heading">
            <h2 id="webmcp-tools-heading">Tools</h2>
            @if (!tools().length) {
              <p class="empty">
                @if (noModelContext().length === picked().length) {
                  No tools. The browser has no <code>modelContext</code>, so the page could not
                  register any.
                } @else {
                  The page registered no WebMCP tools yet.
                }
              </p>
            } @else if (!shownTools().length) {
              <div class="empty">
                <p>No tool matches “{{ query() }}”.</p>
                <button type="button" class="small" (click)="clearFilters(); search.focus()">
                  Clear filters
                </button>
              </div>
            } @else {
              <ul class="rows" appRovingList="button.row" aria-label="Tools">
                @for (tool of shownTools(); track tool.key) {
                  <li>
                    <button
                      type="button"
                      class="row"
                      [class.selected]="tool.key === selectedTool()?.key"
                      [attr.aria-current]="tool.key === selectedTool()?.key ? 'true' : null"
                      (click)="toolKey.set(tool.key)"
                    >
                      <span class="title">{{ tool.name }}</span>
                      <span class="pill" [attr.data-tone]="tool.tone ?? null">{{
                        tool.statusText
                      }}</span>
                      @if (tool.duplicate) {
                        <span class="pill" data-tone="danger">duplicate</span>
                      }
                      <span class="detail">{{
                        tool.readOnly ? 'claims read only' : 'may change data'
                      }}</span>
                      @if (showPage()) {
                        <span class="detail">{{ pageName(tool.pageId) }}</span>
                      }
                    </button>
                  </li>
                }
              </ul>
            }
          </section>
          <aside class="detail-panel" aria-labelledby="webmcp-tool-detail-heading">
            <h2 id="webmcp-tool-detail-heading">Selected tool</h2>
            @if (selectedTool(); as tool) {
              <app-webmcp-tool-detail
                [tool]="tool"
                [canShowForm]="formsOn()"
                (open)="open.emit($event)"
              />
            } @else {
              <p class="muted">Select a tool to see its inputs and the annotations it claims.</p>
            }
          </aside>
        </div>
      } @else {
        <app-limit-note
          [dropped]="dropped()"
          [max]="maxCalls()"
          what="calls per page"
          limit="webmcpCalls"
        />
        <div class="split">
          <section class="list" aria-labelledby="webmcp-calls-heading">
            <h2 id="webmcp-calls-heading">Calls</h2>
            @if (!calls().length) {
              <p class="empty">
                No calls yet. Calls show up here when an agent runs one of the page's tools.
              </p>
            } @else if (!shownCalls().length) {
              <div class="empty">
                <p>No call matches “{{ query() }}”.</p>
                <button type="button" class="small" (click)="clearFilters(); search.focus()">
                  Clear filters
                </button>
              </div>
            } @else {
              <ol class="rows" appRovingList="button.row" aria-label="Calls, newest first">
                @for (call of shownCalls(); track call.key) {
                  <li>
                    <button
                      type="button"
                      class="row"
                      [class.selected]="call.key === selectedCall()?.key"
                      [attr.aria-current]="call.key === selectedCall()?.key ? 'true' : null"
                      [attr.data-key]="call.key"
                      (click)="callKey.set(call.key)"
                    >
                      <time class="when">{{ clock(call.at) }}</time>
                      <span class="title">{{ call.tool }}</span>
                      <span class="pill" [attr.data-tone]="call.tone ?? null">{{
                        call.outcomeText
                      }}</span>
                      @if (call.ms !== undefined) {
                        <span class="detail">{{ span(call.ms) }}</span>
                      }
                      @if (warned().has(call.key)) {
                        <span class="pill" data-tone="warn">changed data</span>
                      }
                      @if (showPage()) {
                        <span class="detail">{{ pageName(call.pageId) }}</span>
                      }
                    </button>
                  </li>
                }
              </ol>
            }
          </section>
          <aside class="detail-panel" aria-labelledby="webmcp-call-detail-heading">
            <h2 id="webmcp-call-detail-heading">Selected call</h2>
            @if (selectedCall(); as call) {
              <app-webmcp-call-detail
                [call]="call"
                [trace]="selectedTrace()!"
                [canShowForm]="formsOn()"
                (open)="open.emit($event)"
              />
            } @else {
              <p class="muted">
                Select a call to see its arguments, its result and what it changed on the page.
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
      margin: 0 0 8px;
      @include m.label;
    }
    .intro {
      margin: 0 0 12px;
      color: var(--text-2);
      line-height: 1.5;
    }
    code {
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .muted {
      margin: 0;
      color: var(--text-2);
      line-height: 1.5;
    }
    .state,
    .empty {
      margin: 0 0 12px;
      color: var(--text-2);
      line-height: 1.5;
    }
    .state p,
    .empty p {
      margin: 0 0 8px;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
      margin: 0 0 12px;
      padding: 8px;
      background: color-mix(in srgb, var(--surface) 85%, transparent);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    .views {
      display: inline-flex;
      gap: 4px;
    }
    .view {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      height: var(--control-h);
      padding: 0 12px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      font: inherit;
      cursor: pointer;
      transition: background-color 150ms var(--ease);
    }
    .view:hover {
      background: var(--surface-2);
    }
    .view[aria-pressed='true'] {
      border-color: var(--accent-line);
      background: var(--accent-soft);
      color: var(--text-strong);
    }
    .view:focus-visible {
      @include m.focus-ring;
    }
    .badge {
      color: var(--text-2);
      font-variant-numeric: tabular-nums;
    }
    .search {
      flex: 1 1 200px;
      min-width: 0;
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
    .notice {
      margin: 0 0 12px;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text-2);
      line-height: 1.5;
    }
    .split {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(260px, 360px);
      gap: 12px;
      align-items: start;
    }
    @media (max-width: 880px) {
      .split {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .list {
      min-width: 0;
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
      gap: 4px 10px;
      align-items: center;
      width: 100%;
      min-width: 0;
      padding: 6px 10px;
      border: 0;
      background: var(--surface);
      color: var(--text);
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition: background-color 150ms var(--ease);
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
    .title {
      flex: 1 1 160px;
      min-width: 0;
      color: var(--text-strong);
      font-family: var(--font-mono);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .detail {
      color: var(--text-2);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      padding: 0 8px;
      border: 1px solid var(--border);
      border-radius: 99px;
      background: var(--surface-2);
      color: var(--text-2);
      font-size: 11px;
      font-weight: 600;
      line-height: 18px;
      white-space: nowrap;
    }
    .pill[data-tone='ok'] {
      @include m.tint(ok);
    }
    .pill[data-tone='warn'] {
      @include m.tint(warn);
    }
    .pill[data-tone='danger'] {
      @include m.tint(danger);
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
    .detail-panel h2 {
      margin: 0;
    }
    .small {
      height: var(--control-h);
      padding: 0 12px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      cursor: pointer;
    }
    .small:focus-visible {
      @include m.focus-ring;
    }
    @media (prefers-reduced-motion: reduce) {
      .view,
      .row {
        transition: none;
      }
    }
  `,
})
export class WebMcpInspector {
  readonly rpc = input<DevframeRpcClient | null>(null);
  /** A call to select once it is listed. */
  readonly focus = input<WebMcpFocus | null>(null);
  readonly focusHandled = output<void>();
  /** Opens a tool's form or a call's effect in its own tab. */
  readonly open = output<PanelLink>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly hostPageId = hostPageId();
  private cleanups: (() => void)[] = [];
  private loads = 0;
  protected readonly allPages = ALL_PAGES;
  protected readonly clock = clockTime;
  protected readonly span = spanText;

  readonly loaded = signal(false);
  readonly failed = signal(false);
  readonly pages = signal<WebMcpPageView[]>([]);
  /** The latest value of each shared state the trace reads. */
  readonly sources = signal<WebMcpTraceSources>({});
  readonly view = signal<View>('tools');
  readonly query = signal('');
  readonly toolKey = signal<string | null>(null);
  readonly callKey = signal<string | null>(null);

  /**
   * Keeps the picked page while it reports, and falls back once it is gone. Before the
   * first reports arrive, "All pages" is only the fallback, so it gives way to this tab's page.
   */
  readonly pageId = linkedSignal<WebMcpPageView[], string>({
    source: () => this.pages(),
    computation: (pages, previous) =>
      previous?.value &&
      previous.source.length > 0 &&
      (previous.value === ALL_PAGES || pages.some((page) => page.pageId === previous.value))
        ? previous.value
        : defaultWebMcpPage(pages, this.hostPageId),
  });
  readonly pageOptions = computed<SelectOption[]>(() => [
    { value: ALL_PAGES, label: 'All pages' },
    ...this.pages().map((page) => ({
      value: page.pageId,
      label: pageLabel(page),
      ...(page.url && page.url !== pageLabel(page) ? { hint: page.url } : {}),
    })),
  ]);
  readonly showPage = computed(() => this.pageId() === ALL_PAGES && this.pages().length > 1);
  readonly picked = computed(() => pickPages(this.pages(), this.pageId()));
  readonly noModelContext = computed(() => this.picked().filter((page) => !page.modelContext));
  readonly formsOn = computed(() => panelConfig(this.rpc()).inspectors.forms);
  readonly maxCalls = computed(() => panelConfig(this.rpc()).limits.webmcpCalls);
  readonly dropped = computed(() => droppedCalls(this.pages(), this.pageId()));

  readonly tools = computed(() => toolRows(this.pages(), this.pageId()));
  readonly calls = computed(() => callRows(this.pages(), this.pageId()));
  readonly shownTools = computed(() => {
    const text = this.query().trim().toLowerCase();
    if (!text) return this.tools();
    return this.tools().filter(
      (tool) =>
        tool.name.toLowerCase().includes(text) || tool.description.toLowerCase().includes(text),
    );
  });
  readonly shownCalls = computed(() => {
    const text = this.query().trim().toLowerCase();
    if (!text) return this.calls();
    return this.calls().filter(
      (call) =>
        call.tool.toLowerCase().includes(text) || call.outcomeText.toLowerCase().includes(text),
    );
  });
  readonly selectedTool = computed(
    () => this.tools().find((tool) => tool.key === this.toolKey()) ?? null,
  );
  readonly selectedCall = computed(
    () => this.calls().find((call) => call.key === this.callKey()) ?? null,
  );
  readonly selectedTrace = computed(() => {
    const call = this.selectedCall();
    return call ? traceRow(call, this.pages(), this.sources()) : null;
  });
  /** Calls of tools that claim `readOnlyHint` but changed data outside signals. */
  readonly warned = computed(() => {
    const pages = this.pages();
    const sources = this.sources();
    const keys = new Set<string>();
    for (const call of this.calls()) {
      const readOnly = call.entry.readOnly ?? claimsReadOnly(toolOf(pages, call));
      if (!readOnly) continue;
      if (traceRow(call, pages, sources).verdict === 'warning') keys.add(call.key);
    }
    return keys;
  });

  readonly countText = computed(() => {
    const [shown, total, noun] =
      this.view() === 'tools'
        ? [this.shownTools().length, this.tools().length, 'tool']
        : [this.shownCalls().length, this.calls().length, 'call'];
    return `${shown} of ${total} ${total === 1 ? noun : `${noun}s`}`;
  });
  /** Speaks the count only after the user changes the view, search or page. */
  readonly countStatus = filterAnnouncement(
    () => [this.view(), this.query(), this.pageId()],
    () => this.countText(),
  );

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client) void this.load(client);
    });
    // A deep link selects its call once the call is listed.
    effect(() => {
      const focus = this.focus();
      const pages = this.pages();
      if (!focus) return;
      const page = focus.page
        ? pages.find((p) => p.pageId === focus.page)
        : pages.find((p) => p.calls.some((c) => String(c.id) === focus.id));
      const call = page?.calls.find((c) => String(c.id) === focus.id);
      if (!page || !call) return;
      untracked(() => {
        this.view.set('calls');
        this.query.set('');
        if (this.pageId() !== ALL_PAGES && this.pageId() !== page.pageId) {
          this.pageId.set(page.pageId);
        }
        this.callKey.set(`${page.pageId}:${call.id}`);
        this.focusHandled.emit();
      });
    });
    this.destroyRef.onDestroy(() => this.stop());
  }

  pageName(pageId: string): string {
    const page = this.pages().find((p) => p.pageId === pageId);
    return page ? pageLabel(page) : pageId;
  }

  clearFilters() {
    this.query.set('');
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
    this.failed.set(false);
    const rpc = client.scope('pangular').rpc;
    const current = () => !this.destroyRef.destroyed && load === this.loads;
    // The trace reads what the other inspectors hold; a missing one only leaves its effects out.
    for (const [key, name] of TRACE_STATES) {
      rpc.sharedState(name).then(
        (state) => {
          if (!current()) return;
          const apply = (value: unknown) =>
            this.sources.update((sources) => ({ ...sources, [key]: value }));
          apply(state.value());
          this.cleanups.push(state.on('updated', apply));
        },
        () => {},
      );
    }
    try {
      const state = await rpc.sharedState('webmcp');
      if (!current()) return;
      const apply = (value: unknown) => this.pages.set(webMcpPages(value));
      apply(state.value());
      this.cleanups.push(state.on('updated', apply));
    } catch {
      if (current()) this.failed.set(true);
    } finally {
      if (current()) this.loaded.set(true);
    }
  }
}
