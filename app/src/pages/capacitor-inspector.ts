import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { time } from '../format';
import { hostPageId } from '../page-id';
import { LimitNote } from '../ui/limit-note';
import { Select, type SelectOption } from '../ui/select';
import { panelConfig } from '../devtools-config';
import { CapacitorCallDetail } from './capacitor-call-detail';
import { CapacitorState, pluginStateCards } from './capacitor-state';
import {
  SLOW_MS,
  activeListenerCounts,
  capacitorPages,
  defaultCapacitorPage,
  inFirstSeenOrder,
  isUnimplemented,
  matchesFilter,
  pluginHint,
  preview,
  span,
  summarize,
  took,
  yesNo,
  type CallFilter,
  type CapacitorCall,
  type CapacitorPage,
  type CapacitorSummary,
} from './capacitor-types';

const GUIDE_URL = 'https://pangular-inspector.dev/inspectors/capacitor/#web-calls';
/** The summary strip is a live region; it changes at most this often. */
const SUMMARY_THROTTLE_MS = 2000;

const FILTER_LABELS: Record<CallFilter, string> = {
  all: 'All calls',
  failed: 'Failed',
  slow: `Slow (${SLOW_MS} ms or more)`,
  pending: 'Pending',
};

@Component({
  selector: 'app-capacitor-inspector',
  imports: [LimitNote, Select, CapacitorCallDetail, CapacitorState],
  template: `
    @if (!loaded()) {
      <p class="state" role="status">Loading Capacitor data…</p>
    } @else if (failed()) {
      <div class="state" role="alert">
        <p>Can't read the Capacitor data from the devtools server.</p>
        <button type="button" class="small" (click)="retry()">Retry</button>
      </div>
    } @else if (page(); as page) {
      <p class="intro">
        Plugin calls, plugins and listeners of a Capacitor app, as its WebView reports them. Values
        are masked like other live data.
      </p>

      <div class="strip" role="status" aria-label="Capacitor summary" aria-atomic="false">
        @if (summary(); as s) {
          <span class="stat" aria-atomic="true">
            <span class="stat-label">Platform</span>
            &ngsp;<span class="stat-value"
              ><code>{{ s.platform }}</code> {{ s.native ? 'native' : 'web' }}</span
            >
          </span>
          @if (s.logsCalls) {
            @for (stat of callStats(s); track stat.filter) {
              <button
                type="button"
                class="stat"
                aria-atomic="true"
                [attr.data-filter]="stat.filter"
                [attr.aria-pressed]="callFilter() === stat.filter"
                (click)="pickFilter(stat.filter)"
              >
                <span class="stat-label">{{ stat.label }}</span>
                &ngsp;<span class="stat-value">{{ stat.count }}</span>
              </button>
            }
          }
          <span class="stat" aria-atomic="true">
            <span class="stat-label">CapacitorHttp</span>
            &ngsp;<span class="stat-value">{{ s.capacitorHttp }}</span>
          </span>
          <span class="stat" aria-atomic="true">
            <span class="stat-label">Plugin hints</span>
            &ngsp;<span class="stat-value">{{ s.hints }}</span>
          </span>
        }
        <span class="sr-only">{{ message() }}</span>
      </div>

      <section class="env" aria-labelledby="cap-env-title">
        <div class="env-head">
          <h2 id="cap-env-title">Environment</h2>
          @if (pageOptions().length > 1) {
            <div class="page-picker">
              <span class="label-key" id="cap-page-label">Page</span>
              <app-select
                labelledBy="cap-page-label"
                [options]="pageOptions()"
                [value]="page.pageId"
                (valueChange)="selectedPageId.set($event)"
              />
            </div>
          }
        </div>
        <dl>
          <div>
            <dt>Platform</dt>
            <dd>
              <code>{{ page.info.platform }}</code> ({{ page.info.native ? 'native' : 'web' }})
            </dd>
          </div>
          <div>
            <dt>Server URL</dt>
            <dd>
              <code>{{ page.info.env.serverUrl || 'none' }}</code>
            </dd>
          </div>
          <div>
            <dt>CapacitorHttp</dt>
            <dd>
              {{
                page.info.env.capacitorHttp === null
                  ? 'Unknown'
                  : page.info.env.capacitorHttp
                    ? 'On'
                    : 'Off'
              }}
            </dd>
          </div>
          <div>
            <dt>Calls logged</dt>
            <dd>{{ loggedLabel() }}</dd>
          </div>
          <div class="wide">
            <dt>User agent</dt>
            <dd>
              <code>{{ page.info.env.userAgent || 'unknown' }}</code>
            </dd>
          </div>
        </dl>
      </section>

      @if (stateCards().length) {
        <section aria-labelledby="cap-state-title">
          <h2 id="cap-state-title">Plugin state</h2>
          <app-capacitor-state [cards]="stateCards()" [now]="now()" />
        </section>
      }

      <section aria-labelledby="cap-calls-title">
        <h2 id="cap-calls-title">Plugin calls</h2>
        @if (!page.info.bridge && !page.info.webCalls) {
          <p class="notice">
            Plugin calls aren't shown on this page. Native calls are logged on iOS and Android,
            where plugins go through the native bridge. To log calls a web implementation answers,
            load <code>&#64;pangular-inspector/devtools/capacitor-hook</code> before
            <code>&#64;capacitor/core</code>.
            <a [href]="guideUrl" target="_blank" rel="noopener noreferrer"
              >How to log web calls<span class="sr-only"> (opens in a new tab)</span></a
            >
          </p>
        } @else {
          @if (!page.info.webCalls) {
            <p class="notice">
              Only native calls are logged. Calls a web implementation answers are left out.
              <a [href]="guideUrl" target="_blank" rel="noopener noreferrer"
                >How to log them too<span class="sr-only"> (opens in a new tab)</span></a
              >
            </p>
          }
          <div class="toolbar">
            <div class="search">
              <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                #search
                type="search"
                aria-label="Filter calls by plugin or method"
                placeholder="Filter by plugin or method"
                [value]="filter()"
                (input)="setSearch($any($event.target).value)"
                (keydown.escape)="setSearch('')"
              />
            </div>
            <app-select
              class="show"
              ariaLabel="Show calls"
              [options]="filterOptions"
              [value]="callFilter()"
              (valueChange)="setFilter($any($event))"
            />
            <span class="count">{{ shownCalls().length }} of {{ page.calls.length }} calls</span>
          </div>
          <app-limit-note
            [dropped]="page.dropped"
            [max]="maxCalls()"
            what="plugin calls"
            limit="capacitorCalls"
          />
          @if (!page.calls.length) {
            <p class="empty">No plugin calls yet. Use the app and they show up here.</p>
          } @else if (!shownCalls().length) {
            <div class="empty">
              <p>No call matches the filters.</p>
              <p class="muted">
                {{ page.calls.length }}
                {{ page.calls.length === 1 ? 'call is' : 'calls are' }} hidden by {{ hiddenBy() }}.
              </p>
              <button type="button" class="small" (click)="clearFilters(); search.focus()">
                Clear filters
              </button>
            </div>
          } @else {
            <div class="split">
              <ol
                class="calls"
                aria-label="Plugin calls, newest first"
                (keydown)="onListKey($event)"
              >
                @for (call of shownCalls(); track call.id) {
                  <li>
                    <button
                      type="button"
                      class="call"
                      data-cap-call
                      [class.selected]="selected()?.id === call.id"
                      [attr.aria-pressed]="selected()?.id === call.id"
                      [attr.tabindex]="tabStop() === call.id ? 0 : -1"
                      (focus)="focusedCallId.set(call.id)"
                      (click)="select(call.id)"
                    >
                      <code class="name">{{ call.plugin }}.{{ call.method }}()</code>
                      <span class="chip status" [attr.data-tone]="tone(call)">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          @switch (tone(call)) {
                            @case ('ok') {
                              <path d="M20 6 9 17l-5-5" />
                            }
                            @case ('danger') {
                              <circle cx="12" cy="12" r="9" />
                              <path d="m15 9-6 6M9 9l6 6" />
                            }
                            @case ('warn') {
                              <circle cx="12" cy="12" r="9" />
                              <path d="M5.6 5.6l12.8 12.8" />
                            }
                            @default {
                              <circle cx="12" cy="12" r="9" />
                              <path d="M12 7v5l3 2" />
                            }
                          }
                        </svg>
                        {{ statusLabel(call) }}
                      </span>
                      @if (call.kind === 'callback') {
                        <span class="chip via">stream</span>
                      }
                      <span class="duration">
                        <span class="bar" aria-hidden="true"
                          ><span [style.width.%]="barWidth(call)"></span
                        ></span>
                        {{ durationText(call) }}
                      </span>
                      <span class="chip via">{{ call.via }}</span>
                      <time class="when">{{ time(call.startedAt) }}</time>
                    </button>
                  </li>
                }
              </ol>
              @if (selected(); as call) {
                <app-capacitor-call-detail
                  [call]="call"
                  [now]="now()"
                  (announce)="announce($event)"
                />
              }
            </div>
          }
        }
      </section>

      <section aria-labelledby="cap-plugins-title">
        <h2 id="cap-plugins-title">Plugins</h2>
        @if (!page.info.plugins.length) {
          <p class="empty">No plugins are registered or installed.</p>
        } @else {
          <div class="table-wrap" tabindex="0" role="group" aria-label="Plugins table">
            <table>
              <thead>
                <tr>
                  <th scope="col">Plugin</th>
                  <th scope="col">Available</th>
                  <th scope="col">Imported</th>
                  <th scope="col">Native</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                @for (plugin of page.info.plugins; track plugin.name) {
                  <tr>
                    <th scope="row">
                      <code>{{ plugin.name }}</code>
                    </th>
                    <td>{{ plugin.available ? 'Yes' : 'No' }}</td>
                    <td>{{ yesNo(plugin.registered) }}</td>
                    <td>{{ plugin.native ? 'Yes' : 'No' }}</td>
                    <td class="note">
                      @if (pluginHint(plugin, page.info.platform); as hint) {
                        <!-- prettier-ignore -->
                        <span class="hint">{{ hint.before }}@if (hint.command) {<code>{{ hint.command }}</code>}{{ hint.after }}</span>
                        @if (hint.command) {
                          <button
                            type="button"
                            class="copy"
                            [attr.aria-label]="'Copy ' + hint.command"
                            (click)="copyCommand(hint.command)"
                          >
                            Copy
                          </button>
                        }
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <section aria-labelledby="cap-listeners-title">
        <h2 id="cap-listeners-title">Listeners</h2>
        @if (!page.listeners.length) {
          <p class="empty">No plugin listeners. They show up when the app calls addListener.</p>
        } @else {
          <div class="table-wrap" tabindex="0" role="group" aria-label="Listeners table">
            <table>
              <thead>
                <tr>
                  <th scope="col">Plugin</th>
                  <th scope="col">Event</th>
                  <th scope="col">Events</th>
                  <th scope="col">Last event</th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                @for (listener of page.listeners; track listener.id) {
                  <tr>
                    <th scope="row">
                      <code>{{ listener.plugin }}</code>
                    </th>
                    <td>
                      <code>{{ listener.event }}</code>
                    </td>
                    <td>{{ listener.events }}</td>
                    <td class="last">
                      @if (listener.lastEventAt) {
                        @if (listener.last !== undefined) {
                          <code class="payload">{{ preview(listener.last) }}</code>
                        } @else {
                          <span class="payload">No data</span>
                        }
                        <span class="muted">at {{ time(listener.lastEventAt) }}</span>
                      } @else {
                        None yet
                      }
                    </td>
                    <td>
                      {{ listener.removed ? 'Removed' : 'Active' }}
                      @if (!listener.removed && leakCount(listener) > 1) {
                        <span class="chip leak" data-tone="warn">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 3 2 21h20z" />
                            <path d="M12 10v4M12 17.5v.01" />
                          </svg>
                          {{ leakCount(listener) }} active listeners: possible leak
                        </span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    } @else {
      <p class="state" role="status">
        No Capacitor app reports to this server. Start the overlay in the app, then use it.
      </p>
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
      font-size: 13px;
    }
    .intro {
      margin: 0 0 12px;
      color: var(--text-2);
      line-height: 1.5;
    }
    section {
      margin: 0 0 24px;
    }
    h2 {
      margin: 0 0 12px;
      color: var(--text-strong);
      font-size: 15px;
    }
    code {
      font-family: var(--font-mono);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .muted {
      color: var(--text-2);
    }
    .strip {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0 0 20px;
    }
    .stat {
      display: inline-flex;
      flex-direction: column;
      gap: 2px;
      min-width: 88px;
      min-height: var(--control-h);
      padding: 6px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      font: inherit;
      text-align: left;
    }
    button.stat {
      cursor: pointer;
      transition: background-color 150ms var(--ease);
    }
    button.stat:hover {
      background: var(--surface-2);
    }
    button.stat[aria-pressed='true'] {
      border-color: var(--accent-line);
      background: var(--accent-soft);
      box-shadow: inset 0 -2px 0 var(--accent);
    }
    button.stat:focus-visible {
      @include m.focus-ring;
    }
    .stat-label {
      @include m.label;
    }
    button.stat[aria-pressed='true'] .stat-label {
      color: var(--text-2);
    }
    .stat-value {
      color: var(--text-strong);
      font-size: 15px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .env-head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      align-items: center;
      justify-content: space-between;
      margin: 0 0 12px;
    }
    .env-head h2 {
      margin: 0;
    }
    .page-picker {
      display: flex;
      flex: 0 1 280px;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .label-key {
      @include m.label;
    }
    dl {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 8px;
      margin: 0;
    }
    dl > div {
      @include m.panel;
      padding: 8px 12px;
      min-width: 0;
    }
    dl > .wide {
      grid-column: 1 / -1;
    }
    dt {
      @include m.label;
      margin: 0 0 2px;
    }
    dd {
      margin: 0;
      color: var(--text);
      overflow-wrap: anywhere;
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
    a {
      color: var(--accent-text);
      border-radius: 2px;
    }
    a:focus-visible {
      @include m.focus-ring;
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
    .show {
      flex: 0 1 220px;
      min-width: 0;
    }
    .count {
      margin-left: auto;
      color: var(--text-2);
      font-size: 12px;
    }
    .small {
      height: var(--control-h);
      padding: 0 12px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
    }
    .small:focus-visible {
      @include m.focus-ring;
    }
    .split {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px;
      align-items: start;
    }
    @media (max-width: 880px) {
      .split {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .calls {
      display: grid;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .call {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      align-items: center;
      width: 100%;
      min-height: var(--control-h);
      padding: 6px 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      text-align: left;
      transition: background-color 150ms var(--ease);
    }
    .call:hover {
      background: var(--surface-2);
    }
    .call.selected {
      border-color: var(--accent-line);
      background: var(--accent-soft);
    }
    .call:focus-visible {
      @include m.focus-ring(-2px);
    }
    .name {
      flex: 1 1 180px;
      min-width: 0;
      color: var(--text-strong);
    }
    .when,
    .duration {
      color: var(--text-2);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .when {
      margin-left: auto;
    }
    .duration {
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }
    .bar {
      display: inline-block;
      width: 48px;
      height: 6px;
      overflow: hidden;
      border-radius: 3px;
      background: var(--surface-3);
    }
    .bar > span {
      display: block;
      height: 100%;
      min-width: 2px;
      border-radius: 3px;
      background: var(--accent);
    }
    .chip {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      padding: 1px 8px;
      border: 1px solid transparent;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
      @include m.tint(accent);
    }
    .chip svg {
      width: 12px;
      height: 12px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.4;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .chip[data-tone='ok'] {
      @include m.tint(ok);
    }
    .chip[data-tone='warn'] {
      @include m.tint(warn);
    }
    .chip[data-tone='danger'] {
      @include m.tint(danger);
    }
    .chip.via {
      border-color: var(--border);
      background: var(--surface-3);
      color: var(--text);
    }
    .chip.leak {
      margin-top: 4px;
      white-space: normal;
    }
    .table-wrap {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .table-wrap:focus-visible {
      @include m.focus-ring(-2px);
    }
    table {
      width: 100%;
      min-width: 640px;
      border-collapse: collapse;
      font-size: 13px;
    }
    th code {
      overflow-wrap: normal;
    }
    th,
    td {
      padding: 6px 10px;
      border-bottom: 1px solid var(--border);
      color: var(--text);
      text-align: left;
      vertical-align: top;
    }
    thead th {
      @include m.label;
      background: var(--surface);
    }
    tbody tr:last-child > * {
      border-bottom: 0;
    }
    .hint {
      margin-right: 6px;
    }
    .copy {
      height: 26px;
      padding: 0 10px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font-size: 12px;
      cursor: pointer;
    }
    .copy:hover {
      background: var(--surface-3);
    }
    .copy:focus-visible {
      @include m.focus-ring;
    }
    td.note,
    td.last {
      min-width: 220px;
    }
    .payload {
      display: block;
      margin: 0 0 2px;
    }
    .empty,
    .state {
      margin: 0 0 12px;
      color: var(--text-2);
    }
    .empty p,
    .state p {
      margin: 0 0 8px;
    }
  `,
})
export class CapacitorInspector {
  readonly rpc = input<DevframeRpcClient | null>(null);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly seen = new Map<string, number>();
  private readonly hostPageId = hostPageId();
  private unsubscribe?: () => void;

  protected readonly time = time;
  protected readonly preview = preview;
  protected readonly pluginHint = pluginHint;
  protected readonly guideUrl = GUIDE_URL;
  protected readonly yesNo = yesNo;
  protected readonly filterOptions: SelectOption[] = (
    Object.keys(FILTER_LABELS) as CallFilter[]
  ).map((value) => ({ value, label: FILTER_LABELS[value] }));
  readonly pages = signal<CapacitorPage[]>([]);
  readonly loaded = signal(false);
  readonly failed = signal(false);
  /** Keeps the picked page while it reports, and falls back once it is gone. */
  readonly selectedPageId = linkedSignal<CapacitorPage[], string | null>({
    source: () => this.pages(),
    computation: (pages, previous) =>
      previous?.value && pages.some((page) => page.pageId === previous.value)
        ? previous.value
        : defaultCapacitorPage(pages, this.hostPageId),
  });
  readonly selectedCallId = signal<number | null>(null);
  /** The row that last had focus, so the list keeps one tab stop on it. */
  readonly focusedCallId = signal<number | null>(null);
  readonly filter = signal('');
  readonly callFilter = signal<CallFilter>('all');
  /** Ticks every second, for pending ages and "3 s ago". */
  readonly now = signal(Date.now());
  /** What the status region says: a filter count or a copy. */
  readonly message = signal('');

  readonly page = computed(() => {
    const wanted = this.selectedPageId();
    return this.pages().find((page) => page.pageId === wanted) ?? null;
  });
  readonly pageOptions = computed<SelectOption[]>(() =>
    this.pages().map((page) => ({
      value: page.pageId,
      label: page.title || page.url || page.pageId,
      hint: page.info.platform,
    })),
  );
  readonly maxCalls = computed(() => panelConfig(this.rpc()).limits.capacitorCalls);
  readonly loggedLabel = computed(() => {
    const info = this.page()?.info;
    if (!info) return '';
    if (info.bridge && info.webCalls) return 'Native and web';
    if (info.bridge) return 'Native only';
    return info.webCalls ? 'Web only' : 'None on this platform';
  });
  readonly shownCalls = computed(() => {
    const page = this.page();
    if (!page) return [];
    const text = this.filter().trim().toLowerCase();
    const filter = this.callFilter();
    // Only the slow filter changes with time.
    const now = filter === 'slow' ? this.now() : 0;
    return [...page.calls]
      .filter((call) => matchesFilter(call, filter, now))
      .filter((call) => !text || `${call.plugin}.${call.method}`.toLowerCase().includes(text))
      .sort((a, b) => b.startedAt - a.startedAt);
  });
  readonly selected = computed(() => {
    const calls = this.shownCalls();
    return calls.find((call) => call.id === this.selectedCallId()) ?? null;
  });
  /** The one row Tab reaches: the focused one, else the selected one, else the newest. */
  readonly tabStop = computed(() => {
    const calls = this.shownCalls();
    for (const id of [this.focusedCallId(), this.selectedCallId()]) {
      if (id !== null && calls.some((call) => call.id === id)) return id;
    }
    return calls[0]?.id ?? null;
  });
  /** The slowest visible call, which the duration bars are scaled to. */
  readonly slowest = computed(() => {
    const now = this.now();
    return Math.max(1, ...this.shownCalls().map((call) => took(call, now)));
  });
  readonly hiddenBy = computed(() => {
    const parts: string[] = [];
    const text = this.filter().trim();
    if (text) parts.push(`the search “${text}”`);
    if (this.callFilter() !== 'all') parts.push(`the ${FILTER_LABELS[this.callFilter()]} filter`);
    return parts.join(' and ');
  });
  readonly stateCards = computed(() => {
    const page = this.page();
    return page ? pluginStateCards(page) : [];
  });
  readonly leaks = computed(() => activeListenerCounts(this.page()?.listeners ?? []));

  private readonly liveSummary = computed(() => {
    const page = this.page();
    return page ? summarize(page, this.now()) : null;
  });
  /** The strip's counts, changed at most every SUMMARY_THROTTLE_MS. */
  readonly summary = signal<CapacitorSummary | null>(null);
  private summaryShownAt = 0;
  private summaryTimer: ReturnType<typeof setTimeout> | undefined;
  private messageFlip = false;

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client) void this.load(client);
    });
    // A live region that changed with every call would talk while the user
    // uses the app, so the strip catches up at most every two seconds.
    effect(() => {
      const next = this.liveSummary();
      untracked(() => this.queueSummary(next));
    });
    const clock = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => {
      clearInterval(clock);
      clearTimeout(this.summaryTimer);
      this.unsubscribe?.();
    });
  }

  retry() {
    const client = this.rpc();
    if (client) void this.load(client);
  }

  callStats(s: CapacitorSummary): { filter: CallFilter; label: string; count: number }[] {
    return [
      { filter: 'all', label: 'Calls', count: s.calls },
      { filter: 'failed', label: 'Failed', count: s.failed },
      { filter: 'slow', label: `Slow, ${SLOW_MS} ms+`, count: s.slow },
      { filter: 'pending', label: 'Pending', count: s.pending },
    ];
  }

  select(id: number) {
    this.selectedCallId.set(id);
    // On a narrow panel the detail sits below the list, out of sight.
    afterNextRender(
      () => {
        if (!globalThis.matchMedia?.('(max-width: 880px)').matches) return;
        this.host.nativeElement
          .querySelector('#cap-detail')
          ?.scrollIntoView?.({ block: 'nearest' });
      },
      { injector: this.injector },
    );
  }

  /** Arrow keys, Home and End move between calls. */
  onListKey(event: KeyboardEvent) {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const rows = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLButtonElement>('[data-cap-call]'),
    );
    if (!rows.length) return;
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    let next = at;
    if (event.key === 'ArrowDown') next = Math.min(at + 1, rows.length - 1);
    else if (event.key === 'ArrowUp') next = Math.max(at - 1, 0);
    else if (event.key === 'Home') next = 0;
    else next = rows.length - 1;
    event.preventDefault();
    rows[next]?.focus();
  }

  setSearch(text: string) {
    if (text === this.filter()) return;
    this.filter.set(text);
    this.announceCount();
  }

  setFilter(filter: CallFilter) {
    if (filter === this.callFilter()) return;
    this.callFilter.set(filter);
    this.announceCount();
  }

  /** A strip button: picks its filter, or shows all calls again when it is on. */
  pickFilter(filter: CallFilter) {
    this.setFilter(this.callFilter() === filter ? 'all' : filter);
  }

  clearFilters() {
    this.filter.set('');
    this.callFilter.set('all');
    this.announceCount();
  }

  /** Says something in the status region, even when it is the same sentence again. */
  announce(text: string) {
    // A trailing no-break space flips, so the live region sees a change.
    this.messageFlip = !this.messageFlip;
    this.message.set(this.messageFlip ? `${text} ` : text);
  }

  async copyCommand(command: string) {
    try {
      await navigator.clipboard.writeText(command);
      this.announce(`Copied ${command}.`);
    } catch {
      this.announce('The clipboard is not available here.');
    }
  }

  leakCount(listener: { plugin: string; event: string }): number {
    return this.leaks().get(`${listener.plugin} ${listener.event}`) ?? 0;
  }

  tone(call: CapacitorCall): string {
    if (call.status === 'pending') return 'accent';
    if (call.status === 'ok') return 'ok';
    return isUnimplemented(call) ? 'warn' : 'danger';
  }

  statusLabel(call: CapacitorCall): string {
    if (call.status === 'pending') return 'Pending';
    if (call.status === 'ok') return 'OK';
    return isUnimplemented(call) ? 'Not implemented' : 'Error';
  }

  durationText(call: CapacitorCall): string {
    if (call.status === 'pending') return `waiting ${span(took(call, this.now()))}`;
    return call.durationMs === undefined ? '' : `${Math.round(call.durationMs)} ms`;
  }

  barWidth(call: CapacitorCall): number {
    return Math.min(100, (took(call, this.now()) / this.slowest()) * 100);
  }

  private announceCount() {
    const page = this.page();
    if (page) this.announce(`${this.shownCalls().length} of ${page.calls.length} calls shown`);
  }

  private queueSummary(next: CapacitorSummary | null) {
    const shown = this.summary();
    if (JSON.stringify(next) === JSON.stringify(shown)) return;
    clearTimeout(this.summaryTimer);
    this.summaryTimer = undefined;
    const wait = this.summaryShownAt + SUMMARY_THROTTLE_MS - Date.now();
    if (!shown || !next || next.pageId !== shown.pageId || wait <= 0) {
      this.summary.set(next);
      this.summaryShownAt = Date.now();
      return;
    }
    this.summaryTimer = setTimeout(() => {
      this.summaryTimer = undefined;
      this.summary.set(this.liveSummary());
      this.summaryShownAt = Date.now();
    }, wait);
  }

  private async load(client: DevframeRpcClient) {
    this.failed.set(false);
    try {
      const state = await client.scope('pangular').rpc.sharedState('capacitor');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) =>
        this.pages.set(inFirstSeenOrder(capacitorPages(value), this.seen));
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
