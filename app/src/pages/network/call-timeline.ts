import { Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
import { LimitNote } from '../../ui/limit-note';
import { LiveControls, followNewest } from '../../ui/live-feed';
import { RovingList } from '../../ui/roving-list';
import { SearchField } from '../../ui/search-field';
import { Select } from '../../ui/select';
import { SortHeader } from '../../ui/sort-header';
import { VirtualWindow } from '../../ui/virtual-window';
import { NetworkWaterfall } from '../network-waterfall';
import { CallOriginTag } from './call-origin';
import { callTone, statusLabel, type HttpCall } from './http-model';
import { NetworkState } from './network-state';
import { ResponsePreview } from './response-preview';

/**
 * The HTTP timeline of the Network page: filters, the live controls, the call table or the
 * waterfall, and the response preview of the selected call.
 */
@Component({
  selector: 'section[appCallTimeline]',
  imports: [
    CallOriginTag,
    LimitNote,
    LiveControls,
    NetworkWaterfall,
    ResponsePreview,
    RovingList,
    SearchField,
    Select,
    SortHeader,
  ],
  template: `
    <h2 id="timeline-heading">HTTP timeline ({{ timeline().length }})</h2>
    <app-limit-note
      [dropped]="droppedCalls()"
      [max]="maxCalls()"
      what="HTTP calls"
      limit="httpCalls"
    />
    <div
      class="filters"
      role="group"
      aria-label="Filter the HTTP timeline"
      [class.no-calls]="!timeline().length"
    >
      <app-search-field
        class="search"
        inputId="timeline-search"
        placeholder="Filter by URL or method"
        saveKey="network"
        [(value)]="callQuery"
      />
      <app-select
        class="side-filter"
        ariaLabel="Side"
        [options]="sideOptions"
        [(value)]="sideFilter"
      />
      <label class="inline failed-toggle">
        <input
          type="checkbox"
          [checked]="failedOnly()"
          (change)="failedOnly.set($any($event.target).checked)"
        />
        Failed only
      </label>
      <div class="view-toggle" role="group" aria-label="Timeline view">
        <button
          type="button"
          [attr.aria-pressed]="timelineView() === 'table'"
          (click)="timelineView.set('table')"
        >
          Table
        </button>
        <button
          type="button"
          [attr.aria-pressed]="timelineView() === 'waterfall'"
          (click)="timelineView.set('waterfall')"
        >
          Waterfall
        </button>
      </div>
      <span class="total">{{ countText() }}</span>
      <span class="sr-only" role="status">{{ filterStatus() }}</span>
    </div>
    <div class="live-row">
      <app-live-controls [feed]="callFeed" what="calls" />
    </div>
    @if (visibleCalls().length && timelineView() === 'waterfall') {
      <app-network-waterfall
        [calls]="waterfallCalls()"
        [selectedId]="selectedCall()?.id ?? null"
        (open)="openCall($event)"
      />
    } @else if (visibleCalls().length) {
      @if (callWindow.enabled()) {
        <p class="muted small window-note">
          Rows render as you scroll, so the browser's find only sees the ones near view; the search
          field searches them all.
        </p>
      }
      <div class="table-wrap">
        <table [attr.aria-rowcount]="visibleCalls().length + 1">
          <thead>
            <tr aria-rowindex="1">
              <th scope="col">Side</th>
              <th scope="col" appSortHeader="method" [(sort)]="callSort">Method</th>
              <th scope="col" appSortHeader="url" [(sort)]="callSort">URL</th>
              <th scope="col">Page</th>
              <th scope="col" appSortHeader="status" [(sort)]="callSort">Status</th>
              <th scope="col" class="num" appSortHeader="time" [(sort)]="callSort">Time</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody #callsBody appRovingList="button[data-call-id]" [rovingWindow]="callWindow">
            @if (callWindow.padTop()) {
              <tr class="spacer" aria-hidden="true">
                <td colspan="7" [style.height.px]="callWindow.padTop()"></td>
              </tr>
            }
            @for (shown of shownCalls(); track shown.entry.side + shown.entry.id) {
              @let entry = shown.entry;
              <tr
                [attr.aria-rowindex]="shown.index + 2"
                [attr.data-vindex]="shown.index"
                [class.selected]="selectedCall()?.id === entry.id"
                (click)="openCall(entry.id)"
              >
                <td>
                  <span class="tag" [class.server]="entry.side === 'server'">{{
                    entry.side === 'server' ? 'SSR' : 'Client'
                  }}</span>
                </td>
                <td class="method">{{ entry.method }}</td>
                <td class="url">
                  <button
                    type="button"
                    class="link"
                    [title]="entry.url"
                    [attr.data-call-id]="entry.id"
                    [attr.aria-pressed]="selectedCall()?.id === entry.id"
                    [attr.aria-controls]="selectedCall() ? 'call-preview' : null"
                  >
                    {{ entry.url }}
                  </button>
                </td>
                <td class="page-url" [title]="entry.pageUrl ?? ''">
                  {{ entry.pageUrl ?? '' }}
                </td>
                <td
                  class="status"
                  [class.ok]="callTone(entry) === 'ok'"
                  [class.redirect]="callTone(entry) === 'redirect'"
                  [class.bad]="callTone(entry) === 'bad'"
                >
                  <span class="dot" aria-hidden="true"></span>{{ statusLabel(entry) }}
                </td>
                <td class="num">{{ entry.durationMs }} ms</td>
                <td>
                  <div class="notes">
                    @if (entry.nativeFetch) {
                      <span class="tag" title="Made with fetch() directly, not through HttpClient"
                        >fetch()</span
                      >
                    }
                    @if (entry.origin) {
                      <app-call-origin [origin]="entry.origin" />
                    }
                    @if (entry.cacheHit) {
                      <span class="tag">transfer cache</span>
                    }
                    @if (entry.delayMs) {
                      <span class="tag">delayed {{ entry.delayMs }} ms</span>
                    }
                    @if (entry.mocked) {
                      <span class="tag mock">mocked</span>
                    }
                    @if (entry.faulted) {
                      <span class="tag fault">faulted</span>
                    }
                    @if (rulePatternOf(entry); as pattern) {
                      <span class="tag rule-ref" [title]="'Matched rule: ' + pattern"
                        >rule <code>{{ pattern }}</code></span
                      >
                    }
                  </div>
                </td>
              </tr>
            }
            @if (callWindow.padBottom()) {
              <tr class="spacer" aria-hidden="true">
                <td colspan="7" [style.height.px]="callWindow.padBottom()"></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else if (timeline().length) {
      <div class="empty no-match" role="status">
        <p>No requests match.</p>
        <p class="muted small">
          @if (callQuery().trim()) {
            Nothing matches “{{ callQuery().trim() }}” with these filters.
          } @else {
            None of the {{ timeline().length }} requests fit these filters.
          }
        </p>
        <div class="empty-actions">
          <button type="button" (click)="clearCallFilters()">Clear filters</button>
        </div>
      </div>
    } @else {
      <div class="empty">
        <p>No requests yet.</p>
        <p class="muted small">
          Add <code>withPangular()</code> to <code>provideHttpClient</code>, then load a page of the
          app.
        </p>
      </div>
    }
    @if (selectedCall(); as detail) {
      <div
        appResponsePreview
        id="call-preview"
        class="preview"
        role="region"
        aria-labelledby="preview-heading"
        [call]="detail"
        (keydown.escape)="closePreview()"
      ></div>
    }
  `,
  styles: `
    @use 'mixins' as m;
    @use 'network' as net;

    @include net.controls;
    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      margin: 0 0 12px;
    }
    .live-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      margin: -4px 0 12px;
    }
    .search {
      position: relative;
      flex: 1 1 220px;
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
    .search:focus-within .search-icon {
      stroke: var(--accent);
    }
    .filters input[type='search'] {
      height: var(--control-h);
      padding-left: 34px;
    }
    .filters .side-filter {
      flex: 0 0 140px;
    }
    .failed-toggle {
      flex: none;
      height: var(--control-h);
      font-size: 13px;
      font-weight: 500;
    }
    .total {
      flex: none;
      color: var(--text-2);
      font-size: 12px;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    /* "0 of 0" says nothing before the first call; the empty state below explains it. */
    .filters.no-calls .total {
      display: none;
    }
    @include net.table;
    @include net.status;
    .view-toggle {
      display: inline-flex;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }
    .view-toggle button {
      height: calc(var(--control-h) - 2px);
      padding: 0 10px;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--text-2);
    }
    .view-toggle button + button {
      border-left: 1px solid var(--border-strong);
    }
    .view-toggle button[aria-pressed='true'] {
      background: var(--accent-soft);
      color: var(--text-strong);
    }
    .view-toggle button:focus-visible {
      @include m.focus-ring(-2px);
    }
    @include net.preview;
  `,
})
export class CallTimeline {
  private readonly state = inject(NetworkState);
  protected readonly timeline = this.state.timeline;
  protected readonly droppedCalls = this.state.droppedCalls;
  protected readonly maxCalls = this.state.maxCalls;
  protected readonly callFeed = this.state.callFeed;
  protected readonly callQuery = this.state.callQuery;
  protected readonly callSort = this.state.callSort;
  protected readonly sideFilter = this.state.sideFilter;
  protected readonly sideOptions = this.state.sideOptions;
  protected readonly failedOnly = this.state.failedOnly;
  protected readonly timelineView = this.state.timelineView;
  protected readonly countText = this.state.countText;
  protected readonly filterStatus = this.state.filterStatus;
  protected readonly visibleCalls = this.state.visibleCalls;
  protected readonly waterfallCalls = this.state.waterfallCalls;
  protected readonly selectedCall = this.state.selectedCall;

  protected readonly callTone = callTone;
  protected readonly statusLabel = statusLabel;

  /** A long call list renders only the rows near view in its scroll box. */
  protected readonly callWindow = new VirtualWindow({
    count: computed(() => this.visibleCalls().length),
    estimate: 37,
  });
  protected readonly shownCalls = computed(() => {
    const { start, end } = this.callWindow.range();
    return this.visibleCalls()
      .slice(start, end)
      .map((entry, i) => ({ entry, index: start + i }));
  });
  private readonly callsBody = viewChild<ElementRef<HTMLElement>>('callsBody');

  constructor() {
    // Newest first, so following the newest call keeps the table scrolled to the top.
    followNewest(this.callFeed, () => {
      if (this.callSort()) return;
      // The SSR requests table comes first and has a .table-wrap too.
      const wrap = this.callsBody()?.nativeElement.closest<HTMLElement>('.table-wrap');
      if (wrap) wrap.scrollTop = 0;
    });
    effect(() => {
      const body = this.callsBody()?.nativeElement;
      if (body) this.callWindow.attach(body);
    });
  }

  protected rulePatternOf(call: HttpCall): string | null {
    return this.state.rulePatternOf(call);
  }

  protected openCall(id: string) {
    this.state.openCall(id);
  }

  protected closePreview() {
    this.state.closePreview();
  }

  protected clearCallFilters() {
    this.state.clearCallFilters();
  }
}
