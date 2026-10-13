import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { injectAngularPages } from '../angular-pages';
import { actionAllowed, actionBlockedMessage } from '../devtools-config';
import { hostPageId } from '../page-id';
import { rpcCall as call } from '../rpc';
import { RovingList } from '../ui/roving-list';
import { Select, type SelectOption } from '../ui/select';
import {
  ageText,
  durationText,
  freshness,
  matchesQueryFilter,
  queryPagesOf,
  statusTone,
  type MutationInfo,
  type QueryFilter,
  type QueryInfo,
  type QueryPage,
  type QueryRequestResult,
} from './query-types';
import { pretty } from './store-types';

type View = 'queries' | 'mutations';

/** One row of either list, with what the template shows. */
interface Row {
  id: string;
  label: string;
  status: string;
  tone: string;
  meta: string;
}

const FILTERS: SelectOption[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'fetching', label: 'Fetching' },
  { value: 'success', label: 'Success' },
  { value: 'error', label: 'Error' },
  { value: 'pending', label: 'Pending' },
  { value: 'stale', label: 'Stale or invalidated' },
  { value: 'inactive', label: 'No observers' },
];

@Component({
  selector: 'app-query-inspector',
  imports: [NgTemplateOutlet, RovingList, Select],
  template: `
    @if (!loaded()) {
      <p class="state" role="status">Loading queries…</p>
    } @else if (failed()) {
      <div class="state" role="alert">
        <p>Can't read TanStack Query from the devtools server.</p>
        <button type="button" class="btn" (click)="retry()">Retry</button>
      </div>
    } @else if (!pages().length) {
      <div class="state empty-card" role="status">
        <p class="state-title">No page reports a QueryClient yet.</p>
        @if (connected()) {
          <p>
            The connected page has no <code>QueryClient</code>. Add
            <code>provideTanStackQuery(new QueryClient())</code> to the app's providers. The tab
            reads it once something in the app injects it, such as <code>injectQuery()</code>.
          </p>
        } @else {
          <p>
            Open the app with the overlay loaded. The tab reads the <code>QueryClient</code> that
            <code>provideTanStackQuery()</code> registers, once something in the app injects it.
          </p>
        }
      </div>
    } @else {
      <p class="intro">
        The queries and mutations of the TanStack Query client the app provides, read from the live
        page. Keys, errors and data are masked like other live data.
      </p>

      <div class="toolbar">
        <div class="views" role="group" aria-label="Show">
          <button
            type="button"
            class="view"
            [attr.aria-pressed]="view() === 'queries'"
            (click)="setView('queries')"
          >
            Queries <span class="badge">{{ page()?.queries.length ?? 0 }}</span>
          </button>
          <button
            type="button"
            class="view"
            [attr.aria-pressed]="view() === 'mutations'"
            (click)="setView('mutations')"
          >
            Mutations <span class="badge">{{ page()?.mutations.length ?? 0 }}</span>
          </button>
        </div>
        <div class="search">
          <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            #search
            type="search"
            aria-label="Filter by key"
            placeholder="Filter by key"
            [value]="filter()"
            (input)="filter.set($any($event.target).value)"
            (keydown.escape)="filter.set('')"
          />
        </div>
        @if (view() === 'queries') {
          <app-select
            class="filter-select"
            ariaLabel="Status"
            [options]="filters"
            [value]="status()"
            (valueChange)="status.set($any($event ?? 'all'))"
          />
        }
        @if (pages().length > 1) {
          <app-select
            class="page-select"
            ariaLabel="Page"
            [options]="pageOptions()"
            [value]="page()?.pageId ?? null"
            (valueChange)="selectPage($event)"
          />
        }
        <span class="count" role="status">{{ countText() }}</span>
      </div>

      @if (page()?.more; as more) {
        @if (more.queries || more.mutations) {
          <p class="notice">
            The page reports the {{ view() === 'queries' ? '300 queries' : '100 mutations' }} it
            updated last and leaves out
            {{ view() === 'queries' ? more.queries : more.mutations }} more.
          </p>
        }
      }

      @if (!allRows().length) {
        <div class="state empty-card" role="status">
          @if (view() === 'queries') {
            <p class="state-title">No query in the cache yet.</p>
            <p>Queries show up here when the app creates them with <code>injectQuery()</code>.</p>
          } @else {
            <p class="state-title">No mutation yet.</p>
            <p>Mutations show up here once the app calls <code>mutate()</code>.</p>
          }
        </div>
      } @else if (!rows().length) {
        <div class="state empty-card" role="status">
          <p class="state-title">Nothing matches the filters.</p>
          <button type="button" class="btn" (click)="clearFilters(); search.focus()">
            Clear filters
          </button>
        </div>
      } @else {
        <div class="layout">
          <ul
            class="rows"
            appRovingList="button.row"
            [attr.aria-label]="view() === 'queries' ? 'Queries' : 'Mutations'"
          >
            @for (row of rows(); track row.id) {
              <li>
                <button
                  type="button"
                  class="row"
                  [class.selected]="row.id === selected()?.id"
                  [attr.aria-pressed]="row.id === selected()?.id"
                  (click)="select(row.id)"
                >
                  <span class="row-top">
                    <code class="key" [title]="row.label">{{ row.label }}</code>
                    <span class="pill" [attr.data-tone]="row.tone">{{ row.status }}</span>
                  </span>
                  <span class="row-meta">{{ row.meta }}</span>
                </button>
              </li>
            }
          </ul>

          <section class="detail" aria-labelledby="query-detail-heading" #detailPanel>
            @if (selectedQuery(); as query) {
              <h2 id="query-detail-heading" class="detail-title">
                <code>{{ query.keyText }}</code>
              </h2>
              <dl class="kv">
                <dt>Status</dt>
                <dd>
                  <span class="pill" [attr.data-tone]="tone(query.status)">{{ query.status }}</span>
                </dd>
                <dt>Fetch status</dt>
                <dd>{{ query.fetchStatus }}</dd>
                <dt>Freshness</dt>
                <dd>{{ freshnessOf(query) }}</dd>
                <dt>Data updated</dt>
                <dd>
                  {{ age(query.dataUpdatedAt) }}
                  @if (query.dataUpdateCount) {
                    <span class="muted"
                      >({{ query.dataUpdateCount }}
                      {{ query.dataUpdateCount === 1 ? 'update' : 'updates' }})</span
                    >
                  }
                </dd>
                <dt>Observers</dt>
                <dd>
                  {{ query.observers }}
                  @if (query.disabled) {
                    <span class="muted">(disabled)</span>
                  }
                </dd>
                <dt>staleTime</dt>
                <dd>{{ duration(query.staleTime) }}</dd>
                <dt>gcTime</dt>
                <dd>{{ duration(query.gcTime) }}</dd>
                @if (query.failureCount) {
                  <dt>Failures</dt>
                  <dd>{{ query.failureCount }}</dd>
                }
                @if (query.error) {
                  <dt>Error</dt>
                  <dd>
                    <code class="error">{{ query.error }}</code>
                  </dd>
                }
              </dl>
              <div class="actions">
                <button
                  type="button"
                  class="btn"
                  [disabled]="busy() || !canWrite()"
                  [attr.aria-describedby]="canWrite() ? null : 'query-writes-off'"
                  (click)="act('invalidate', query.id)"
                >
                  Invalidate
                </button>
                <button
                  type="button"
                  class="btn"
                  [disabled]="busy() || !canWrite()"
                  [attr.aria-describedby]="canWrite() ? null : 'query-writes-off'"
                  (click)="act('refetch', query.id)"
                >
                  Refetch
                </button>
              </div>
              @if (!canWrite()) {
                <p id="query-writes-off" class="hint">{{ writesOff }}</p>
              }
              <h3 class="sub">Data</h3>
              @if (!query.hasData) {
                <p class="muted">No data yet.</p>
              } @else {
                <ng-container
                  [ngTemplateOutlet]="dataTpl"
                  [ngTemplateOutletContext]="{ preview: query.preview, id: query.id }"
                />
              }
            } @else if (selectedMutation(); as mutation) {
              <h2 id="query-detail-heading" class="detail-title">
                <code>{{ mutationLabel(mutation) }}</code>
              </h2>
              <dl class="kv">
                <dt>Status</dt>
                <dd>
                  <span class="pill" [attr.data-tone]="tone(mutation.status)">{{
                    mutation.status
                  }}</span>
                  @if (mutation.isPaused) {
                    <span class="muted">(paused)</span>
                  }
                </dd>
                <dt>Submitted</dt>
                <dd>{{ age(mutation.submittedAt) }}</dd>
                @if (mutation.failureCount) {
                  <dt>Failures</dt>
                  <dd>{{ mutation.failureCount }}</dd>
                }
                @if (mutation.error) {
                  <dt>Error</dt>
                  <dd>
                    <code class="error">{{ mutation.error }}</code>
                  </dd>
                }
              </dl>
              <h3 class="sub">Variables and data</h3>
              <ng-container
                [ngTemplateOutlet]="dataTpl"
                [ngTemplateOutletContext]="{ preview: mutation.variables, id: mutation.id }"
              />
            } @else {
              <h2 id="query-detail-heading" class="sr-only">Details</h2>
              <p class="muted">
                Select a {{ view() === 'queries' ? 'query' : 'mutation' }} to see its details.
              </p>
            }
            <p class="message" role="status">{{ message() }}</p>
          </section>
        </div>
      }
    }

    <ng-template #dataTpl let-preview="preview" let-id="id">
      @if (full()?.id === id) {
        @if (full()!.result.detail; as detail) {
          @if (detail.variables !== undefined) {
            <p class="label">Variables</p>
            <pre tabindex="0" aria-label="Variables">{{ prettyText(detail.variables) }}</pre>
          }
          <p class="label">Data</p>
          <pre tabindex="0" aria-label="Data">{{
            detail.data === undefined ? 'No data.' : prettyText(detail.data)
          }}</pre>
        } @else {
          <p class="muted">{{ full()!.result.error ?? 'The page did not send the data.' }}</p>
        }
      } @else {
        @if (preview !== undefined) {
          <pre tabindex="0" aria-label="Preview">{{ prettyText(preview) }}</pre>
        }
        <button type="button" class="btn" [disabled]="loadingData()" (click)="loadData(id)">
          {{ loadingData() ? 'Loading…' : 'Show all data' }}
        </button>
      }
    </ng-template>
  `,
  styles: `
    @use 'mixins' as m;
    :host {
      display: block;
      min-width: 0;
      font-size: 13px;
      color: var(--text);
    }
    code,
    pre {
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .intro {
      max-width: 720px;
      margin: 0 0 12px;
      color: var(--text-2);
      line-height: 1.5;
    }
    .muted {
      color: var(--text-2);
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
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
      border: 1px solid var(--border);
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
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 13px;
    }
    input[type='search']:focus {
      @include m.field-focus;
    }
    .filter-select,
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
    .layout {
      display: grid;
      grid-template-columns: minmax(220px, 2fr) minmax(0, 3fr);
      gap: 12px;
      align-items: start;
      min-width: 0;
      @include m.enter;
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .rows {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      padding: 6px;
      @include m.panel;
    }
    .row {
      display: flex;
      flex-direction: column;
      gap: 3px;
      width: 100%;
      min-width: 0;
      padding: 8px 10px;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition: background-color 150ms var(--ease);
    }
    .row:hover {
      background: var(--surface-3);
    }
    .row:focus-visible {
      @include m.focus-ring(-2px);
    }
    .row.selected {
      background: var(--accent-soft);
      box-shadow: inset 2px 0 0 var(--accent);
    }
    .row-top {
      display: flex;
      gap: 8px;
      align-items: center;
      min-width: 0;
    }
    .key {
      flex: 1 1 auto;
      min-width: 0;
      color: var(--text-strong);
      @include m.truncate;
    }
    .row-meta {
      color: var(--text-2);
      font-size: 11.5px;
      font-variant-numeric: tabular-nums;
    }
    .pill {
      flex: none;
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
    }
    .pill[data-tone='ok'] {
      border-color: transparent;
      @include m.tint(ok);
    }
    .pill[data-tone='warn'] {
      border-color: transparent;
      @include m.tint(warn);
    }
    .pill[data-tone='danger'] {
      border-color: transparent;
      @include m.tint(danger);
    }
    .pill[data-tone='accent'] {
      border-color: transparent;
      @include m.tint(accent);
    }
    .detail {
      position: sticky;
      top: 64px;
      display: grid;
      gap: 12px;
      min-width: 0;
      padding: 14px 16px;
      @include m.panel;
    }
    .detail-title {
      margin: 0;
      color: var(--text-strong);
      font-size: 14px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .kv {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 6px 14px;
      margin: 0;
    }
    .kv dt {
      color: var(--text-2);
    }
    .kv dd {
      min-width: 0;
      margin: 0;
      overflow-wrap: anywhere;
    }
    .error {
      color: var(--danger-text);
      white-space: pre-wrap;
    }
    .sub,
    .label {
      @include m.label;
      margin: 4px 0 0;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .hint {
      margin: 0;
      color: var(--text-2);
      font-size: 12px;
    }
    pre {
      max-height: 320px;
      margin: 0;
      padding: 8px 10px;
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    pre:focus-visible {
      @include m.focus-ring(-2px);
    }
    .btn {
      justify-self: start;
      height: var(--control-h);
      padding: 0 14px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 150ms var(--ease);
    }
    .btn:hover {
      background: var(--surface-3);
    }
    .btn:focus-visible {
      @include m.focus-ring;
    }
    .btn:disabled {
      opacity: 0.6;
      cursor: default;
    }
    .message {
      margin: 0;
      color: var(--text-2);
    }
    .message:empty {
      display: none;
    }
    .state {
      margin: 0 0 12px;
      color: var(--text-2);
    }
    .state p {
      margin: 0 0 8px;
      line-height: 1.5;
    }
    .empty-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 32px 20px;
      text-align: center;
      @include m.panel;
    }
    .state-title {
      color: var(--text-strong);
      font-size: 14px;
      font-weight: 600;
    }
    @media (max-width: 880px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
      .detail {
        position: static;
      }
    }
    @media (max-width: 480px) {
      .search,
      .filter-select,
      .page-select {
        flex-basis: 100%;
      }
      .count {
        margin-left: 0;
      }
      .kv {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class QueryInspector {
  readonly rpc = input<DevframeRpcClient | null>(null);
  /** Pages that report to the devtools, so the empty state can tell "no page" from "no client". */
  private readonly angularPages = injectAngularPages(() => this.rpc());
  readonly connected = computed(() => Object.keys(this.angularPages()).length > 0);

  private readonly destroyRef = inject(DestroyRef);
  private readonly hostPageId = hostPageId();
  private unsubscribe?: () => void;
  private readonly detailPanel = viewChild<ElementRef<HTMLElement>>('detailPanel');

  protected readonly filters = FILTERS;
  protected readonly writesOff = actionBlockedMessage('tanstackQuery');
  readonly canWrite = computed(() => actionAllowed(this.rpc(), 'tanstackQuery'));

  readonly pages = signal<QueryPage[]>([]);
  readonly loaded = signal(false);
  readonly failed = signal(false);
  readonly view = signal<View>('queries');
  readonly filter = signal('');
  readonly status = signal<QueryFilter>('all');
  readonly selectedPageId = signal<string | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly loadingData = signal(false);
  /** The full data the page sent for one row, until another row is picked. */
  readonly full = linkedSignal<string | null, { id: string; result: QueryRequestResult } | null>({
    source: () => this.selectedId(),
    computation: () => null,
  });
  /** Ticks every second so ages stay current. */
  readonly now = signal(Date.now());

  readonly page = computed<QueryPage | null>(() => {
    const pages = this.pages();
    return (
      pages.find((p) => p.pageId === this.selectedPageId()) ??
      pages.find((p) => p.pageId === this.hostPageId) ??
      pages[0] ??
      null
    );
  });

  readonly pageOptions = computed<SelectOption[]>(() =>
    this.pages().map((p) => ({
      value: p.pageId,
      label: p.title || p.url || p.pageId,
      hint: p.url,
    })),
  );

  private readonly queries = computed(() => {
    const text = this.filter().trim().toLowerCase();
    const status = this.status();
    return (this.page()?.queries ?? []).filter(
      (q) => matchesQueryFilter(q, status) && (!text || q.keyText.toLowerCase().includes(text)),
    );
  });

  private readonly mutations = computed(() => {
    const text = this.filter().trim().toLowerCase();
    return (this.page()?.mutations ?? []).filter(
      (m) => !text || this.mutationLabel(m).toLowerCase().includes(text),
    );
  });

  readonly allRows = computed(() =>
    this.view() === 'queries' ? (this.page()?.queries ?? []) : (this.page()?.mutations ?? []),
  );

  readonly rows = computed<Row[]>(() => {
    // Read so the ages in the meta line move on.
    this.now();
    if (this.view() === 'queries') {
      return this.queries().map((q) => ({
        id: q.id,
        label: q.keyText,
        status: q.fetchStatus === 'idle' ? q.status : q.fetchStatus,
        tone: statusTone(q.status, q.fetchStatus),
        meta: `${freshness(q)} · ${q.observers} ${q.observers === 1 ? 'observer' : 'observers'} · ${this.age(q.dataUpdatedAt)}`,
      }));
    }
    return this.mutations().map((m) => ({
      id: m.id,
      label: this.mutationLabel(m),
      status: m.isPaused ? 'paused' : m.status,
      tone: m.isPaused ? 'warn' : statusTone(m.status),
      meta: `submitted ${this.age(m.submittedAt)}`,
    }));
  });

  readonly countText = computed(() => {
    const total = this.allRows().length;
    const shown = this.rows().length;
    const noun = this.view() === 'queries' ? 'queries' : 'mutations';
    return `${shown} of ${total} ${noun}`;
  });

  readonly selectedQuery = computed<QueryInfo | null>(() =>
    this.view() === 'queries'
      ? (this.page()?.queries.find((q) => q.id === this.selectedId()) ?? null)
      : null,
  );
  readonly selectedMutation = computed<MutationInfo | null>(() =>
    this.view() === 'mutations'
      ? (this.page()?.mutations.find((m) => m.id === this.selectedId()) ?? null)
      : null,
  );
  readonly selected = computed<{ id: string } | null>(
    () => this.selectedQuery() ?? this.selectedMutation(),
  );

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client) void this.load(client);
    });
    const tick = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => {
      clearInterval(tick);
      this.unsubscribe?.();
    });
  }

  /** How long ago `when` (on the page's clock) was, now. */
  age(when: number): string {
    const page = this.page();
    if (!page) return ageText(0, when);
    // The page's clock may differ from the panel's; its report time links them.
    const skew = page.at - page.reportedAt;
    return ageText(this.now() + skew - when, when);
  }

  freshnessOf(query: QueryInfo): string {
    return freshness(query);
  }

  duration(ms: number | 'static' | null | undefined): string {
    return durationText(ms);
  }

  tone(status: string): string {
    return statusTone(status);
  }

  prettyText(value: unknown): string {
    return pretty(value);
  }

  mutationLabel(mutation: MutationInfo): string {
    return mutation.keyText ?? `Mutation ${mutation.id}`;
  }

  setView(view: View) {
    this.view.set(view);
    this.selectedId.set(null);
    this.message.set('');
  }

  selectPage(pageId: string | null) {
    this.selectedPageId.set(pageId);
    this.selectedId.set(null);
    this.message.set('');
  }

  select(id: string) {
    this.selectedId.set(id);
    this.message.set('');
    // On a narrow screen the detail sits below the list.
    if (typeof matchMedia === 'function' && matchMedia('(max-width: 880px)').matches) {
      this.detailPanel()?.nativeElement.scrollIntoView?.({ block: 'nearest' });
    }
  }

  clearFilters() {
    this.filter.set('');
    this.status.set('all');
  }

  retry() {
    const client = this.rpc();
    if (client) void this.load(client);
  }

  async loadData(id: string) {
    const page = this.page();
    if (!page || this.loadingData()) return;
    this.loadingData.set(true);
    try {
      const result = (await call(this.rpc(), 'request-tanstack-query', {
        pageId: page.pageId,
        request: { type: 'detail', id },
      })) as QueryRequestResult | null;
      if (this.selectedId() === id) this.full.set({ id, result: result ?? {} });
    } catch {
      if (this.selectedId() === id) {
        this.full.set({ id, result: { error: 'Could not reach the page to read the data.' } });
      }
    } finally {
      this.loadingData.set(false);
    }
  }

  async act(type: 'invalidate' | 'refetch', id: string) {
    const page = this.page();
    if (!page || this.busy()) return;
    this.busy.set(true);
    try {
      const result = (await call(this.rpc(), 'request-tanstack-query', {
        pageId: page.pageId,
        request: { type, id },
      })) as QueryRequestResult | null;
      this.message.set(result?.error ?? result?.message ?? 'Done.');
      this.full.set(null);
    } catch {
      this.message.set('Could not reach the page.');
    } finally {
      this.busy.set(false);
    }
  }

  private async load(client: DevframeRpcClient) {
    this.failed.set(false);
    try {
      const state = await client.scope('pangular').rpc.sharedState('tanstack-query');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) => this.pages.set(queryPagesOf(value));
      apply(state.value());
      this.unsubscribe?.();
      this.unsubscribe = state.on('updated', apply);
    } catch {
      this.failed.set(true);
    } finally {
      this.loaded.set(true);
    }
  }
}
