import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { time } from '../format';
import { hostPageId } from '../page-id';
import { LimitNote } from '../ui/limit-note';
import { Select, type SelectOption } from '../ui/select';
import { panelConfig } from '../devtools-config';
import {
  capacitorPages,
  isUnimplemented,
  type CapacitorCall,
  type CapacitorPage,
} from './capacitor-types';

const GUIDE_URL = 'https://pangular-inspector.dev/inspectors/capacitor/#web-calls';

function json(value: unknown): string {
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value, null, 2) ?? 'undefined';
  } catch {
    return String(value);
  }
}

@Component({
  selector: 'app-capacitor-inspector',
  imports: [LimitNote, Select],
  template: `
    <p class="sr-only" role="status">{{ announcement() }}</p>
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
            <dd>{{ page.info.env.capacitorHttp ? 'On' : 'Off' }}</dd>
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
                type="search"
                aria-label="Filter calls by plugin or method"
                placeholder="Filter by plugin or method"
                [value]="filter()"
                (input)="filter.set($any($event.target).value)"
                (keydown.escape)="filter.set('')"
              />
            </div>
            <label class="check">
              <input
                type="checkbox"
                [checked]="onlyFailed()"
                (change)="onlyFailed.set($any($event.target).checked)"
              />
              Only failed
            </label>
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
              <button type="button" class="small" (click)="clearFilters()">Clear filters</button>
            </div>
          } @else {
            <div class="split">
              <ol class="calls" aria-label="Plugin calls, newest first">
                @for (call of shownCalls(); track call.id) {
                  <li>
                    <button
                      type="button"
                      class="call"
                      [class.selected]="selected()?.id === call.id"
                      [attr.aria-pressed]="selected()?.id === call.id"
                      (click)="selectedCallId.set(call.id)"
                    >
                      <time class="when">{{ time(call.startedAt) }}</time>
                      <code class="name">{{ call.plugin }}.{{ call.method }}()</code>
                      <span class="chip" [attr.data-tone]="tone(call)">{{
                        statusLabel(call)
                      }}</span>
                      <span class="chip via">{{ call.via }}</span>
                      @if (call.kind === 'callback') {
                        <span class="chip via">stream</span>
                      }
                      <span class="duration">{{ duration(call) }}</span>
                    </button>
                  </li>
                }
              </ol>
              @if (selected(); as call) {
                <section class="detail" aria-labelledby="cap-detail-title">
                  <h3 id="cap-detail-title">
                    <code>{{ call.plugin }}.{{ call.method }}()</code>
                  </h3>
                  <p class="meta">
                    {{ statusLabel(call) }}, {{ call.via }},
                    {{ call.kind === 'callback' ? 'stream' : 'promise' }}, started
                    {{ time(call.startedAt)
                    }}{{ call.durationMs !== undefined ? ', took ' + duration(call) : ''
                    }}{{ call.callbacks ? ', ' + call.callbacks + ' callbacks' : '' }}
                  </p>
                  <h4>Arguments</h4>
                  <pre tabindex="0" aria-label="Arguments">{{ json(call.args) }}</pre>
                  @if (call.error; as error) {
                    <h4>Error</h4>
                    <p class="error-text">
                      @if (error.code) {
                        <code>{{ error.code }}</code>
                      }
                      {{ error.message }}
                    </p>
                  } @else if (call.status === 'ok') {
                    <h4>Result</h4>
                    <pre tabindex="0" aria-label="Result">{{ json(call.result) }}</pre>
                  }
                </section>
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
                    <td>{{ plugin.registered ? 'Yes' : 'No' }}</td>
                    <td>{{ plugin.native ? 'Yes' : 'No' }}</td>
                    <td>
                      @if (plugin.registered && !plugin.available) {
                        Not available here. Run <code>npx cap sync</code> if it should be native.
                      } @else if (plugin.native && !plugin.registered) {
                        Installed, not imported by the app.
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
                    <td>{{ listener.lastEventAt ? time(listener.lastEventAt) : 'None yet' }}</td>
                    <td>{{ listener.removed ? 'Removed' : 'Active' }}</td>
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
    }
    .intro {
      margin: 0 0 16px;
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
    h3 {
      margin: 0 0 4px;
      font-size: 14px;
      overflow-wrap: anywhere;
    }
    h4 {
      @include m.label;
      margin: 16px 0 6px;
    }
    code {
      font-family: var(--font-mono);
      font-size: 12px;
      overflow-wrap: anywhere;
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
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 13px;
    }
    input[type='search']:focus {
      @include m.field-focus;
    }
    .check {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      min-height: var(--control-h);
      color: var(--text);
    }
    .check input:focus-visible {
      @include m.focus-ring;
    }
    .count {
      margin-left: auto;
      color: var(--text-2);
      font-size: 12px;
    }
    .small {
      height: var(--control-h);
      padding: 0 12px;
      border: 1px solid var(--border-strong);
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
    .when,
    .duration {
      color: var(--text-2);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .name {
      flex: 1 1 160px;
      min-width: 0;
    }
    .chip {
      padding: 1px 8px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
      @include m.tint(accent);
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
      background: var(--surface-3);
      color: var(--text);
    }
    .detail {
      @include m.panel;
      position: sticky;
      top: 64px;
      min-width: 0;
      margin: 0;
      padding: 12px;
    }
    .meta {
      margin: 0;
      color: var(--text-2);
    }
    pre {
      max-height: 280px;
      margin: 0;
      padding: 8px;
      overflow: auto;
      border-radius: var(--radius-sm);
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 12px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    pre:focus-visible {
      @include m.focus-ring(-2px);
    }
    .error-text {
      margin: 0;
      color: var(--text);
      overflow-wrap: anywhere;
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
      border-collapse: collapse;
      font-size: 13px;
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
  private unsubscribe?: () => void;

  protected readonly time = time;
  protected readonly json = json;
  protected readonly guideUrl = GUIDE_URL;
  readonly pages = signal<CapacitorPage[]>([]);
  readonly loaded = signal(false);
  readonly failed = signal(false);
  readonly selectedPageId = signal<string | null>(hostPageId());
  readonly selectedCallId = signal<number | null>(null);
  readonly filter = signal('');
  readonly onlyFailed = signal(false);

  readonly page = computed(() => {
    const pages = this.pages();
    const wanted = this.selectedPageId();
    return pages.find((page) => page.pageId === wanted) ?? pages[0] ?? null;
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
    return [...page.calls]
      .filter((call) => !this.onlyFailed() || call.status === 'error')
      .filter((call) => !text || `${call.plugin}.${call.method}`.toLowerCase().includes(text))
      .sort((a, b) => b.startedAt - a.startedAt);
  });
  readonly selected = computed(() => {
    const calls = this.shownCalls();
    return calls.find((call) => call.id === this.selectedCallId()) ?? null;
  });
  readonly announcement = computed(() => {
    const page = this.page();
    return page ? `${this.shownCalls().length} of ${page.calls.length} calls shown` : '';
  });

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client) void this.load(client);
    });
    this.destroyRef.onDestroy(() => this.unsubscribe?.());
  }

  retry() {
    const client = this.rpc();
    if (client) void this.load(client);
  }

  clearFilters() {
    this.filter.set('');
    this.onlyFailed.set(false);
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

  duration(call: CapacitorCall): string {
    return call.durationMs === undefined ? '' : `${Math.round(call.durationMs)} ms`;
  }

  private async load(client: DevframeRpcClient) {
    this.failed.set(false);
    try {
      const state = await client.scope('pangular').rpc.sharedState('capacitor');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) => this.pages.set(capacitorPages(value));
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
