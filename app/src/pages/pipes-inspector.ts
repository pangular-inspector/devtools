import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { Select, type SelectOption } from '../ui/select';

interface UsageSite {
  file: string;
  line: number;
}

interface PipeInfo {
  name: string;
  className: string;
  file: string;
  line: number;
  isStandalone: boolean;
  isPure: boolean;
  builtin?: boolean;
  usageCount?: number;
  usages?: UsageSite[];
}

interface PipeTarget {
  pageId: string;
  id: string;
}

interface PipeComponentUsage {
  name: string;
  count: number;
  targets?: PipeTarget[];
}

interface PipeInstanceCall {
  component: string;
  callCount: number;
  lastArgs?: unknown[];
  lastResult?: unknown;
}

interface PipeCallInfo {
  callCount: number;
  instances?: PipeInstanceCall[];
  lastArgs?: unknown[];
  lastResult?: unknown;
  lastCaller?: string;
}

interface StaleFinding {
  detectedAt: number;
}

interface LivePipeInfo {
  name: string;
  className: string;
  isPure: boolean;
  instanceCount: number;
  components: PipeComponentUsage[];
  call?: PipeCallInfo;
  stale?: StaleFinding;
}

interface AsyncUsageInfo {
  component: string;
  hasSource: boolean;
  latestValue?: string;
  duplicate: boolean;
  resubscribing?: boolean;
  target?: PipeTarget;
}

interface PipeLintFinding {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  pipe: string;
  file: string;
  line: number;
  message: string;
  fix: string;
}

interface PipesSnapshot {
  pipes: LivePipeInfo[];
  async: AsyncUsageInfo[];
  instrumented: string[];
}

const RECORD_CONFIRM_MS = 5000;

type PipeKind = 'all' | 'custom' | 'builtin' | 'impure' | 'live';

const KIND_OPTIONS: readonly SelectOption<PipeKind>[] = [
  { value: 'all', label: 'All pipes' },
  { value: 'custom', label: 'Custom' },
  { value: 'builtin', label: 'Built-in' },
  { value: 'impure', label: 'Impure' },
  { value: 'live', label: 'On the page' },
];

@Component({
  selector: 'app-pipes-inspector',
  imports: [Select],
  template: `
    <p class="intro">
      Pipes declared in your source and the built-in pipes your templates use. Live data shows which
      components use each pipe on the page; turn on recording to capture calls and the last input
      and output.
    </p>

    <div class="toolbar">
      <div class="search">
        <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          placeholder="Find a pipe, class or file…"
          aria-label="Find a pipe, class or file"
          autocomplete="off"
          spellcheck="false"
          [value]="filter()"
          (input)="filter.set($any($event.target).value)"
          (keydown.escape)="filter.set('')"
        />
      </div>
      <app-select ariaLabel="Show pipes" [options]="kindOptions" [(value)]="kind" />
      <span class="total" aria-live="polite">{{ filtered().length }} of {{ pipes().length }}</span>
      <div class="actions">
        <button type="button" (click)="refresh()" [disabled]="loading()">Refresh</button>
        <button
          type="button"
          class="record"
          [class.on]="instrumenting()"
          [attr.aria-pressed]="instrumenting()"
          [attr.aria-busy]="pendingRecord() !== null"
          [attr.aria-disabled]="pendingRecord() !== null"
          (click)="toggleInstrument()"
        >
          <span class="rec-dot" aria-hidden="true"></span>
          {{ recordLabel() }}
        </button>
      </div>
    </div>

    @if (recordMessage(); as message) {
      <p class="notice" role="status">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
        <span>{{ message }}</span>
      </p>
    }

    @if (instrumenting()) {
      <p class="notice" role="status">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
        <span>
          <strong>Recording on {{ instrumentedPages().length }} page(s).</strong>
          Pipe prototypes are patched in the inspected page to count calls and keep the last input
          and output. Stop recording when you are done.
        </span>
      </p>
    }

    @if (loading() && pipes().length === 0) {
      <div class="state" role="status">
        <span class="spinner" aria-hidden="true"></span>
        <p class="state-title">Scanning pipes…</p>
      </div>
    } @else if (loadFailed() && pipes().length === 0) {
      <div class="state" role="alert">
        <p class="state-title">Couldn't load pipes</p>
        <p class="state-hint">The devtools server did not answer. Check that it is running.</p>
        <button type="button" (click)="refresh()">Try again</button>
      </div>
    } @else if (pipes().length === 0) {
      <div class="state">
        <p class="state-title">No pipes found</p>
        <p class="state-hint">
          No &#64;Pipe classes were found in the source, and no template uses a built-in pipe yet.
        </p>
      </div>
    } @else {
      <div class="layout">
        <div class="list-wrap">
          @if (filtered().length) {
            <ul class="pipe-list" aria-label="Pipes" (keydown)="onListKey($event)">
              @for (p of filtered(); track p.file + p.name) {
                @let live = liveFor(p.name);
                <li>
                  <button
                    type="button"
                    class="row"
                    data-pipe-row
                    aria-controls="pipe-detail"
                    [attr.aria-current]="isSelected(p) || null"
                    [class.selected]="isSelected(p)"
                    (click)="select(p)"
                    (mouseenter)="highlightPipe(live)"
                    (mouseleave)="highlight(null)"
                    (focus)="highlightPipe(live)"
                    (blur)="highlight(null)"
                  >
                    <span class="row-main">
                      <span class="name mono">{{ p.name }}</span>
                      <span class="sub mono">{{ p.className }}</span>
                    </span>
                    <span class="row-meta">
                      @if (live?.stale) {
                        <span class="chip warn">stale?</span>
                      }
                      @if (live) {
                        <span class="chip live">{{ live.instanceCount }} live</span>
                      }
                      @if (p.builtin) {
                        <span class="chip">built-in</span>
                      }
                      @if (!p.isStandalone) {
                        <span class="chip">NgModule</span>
                      }
                      <span class="chip" [class.impure]="!p.isPure">{{
                        p.isPure ? 'pure' : 'impure'
                      }}</span>
                    </span>
                    <span class="row-file mono">
                      {{ p.file }}:{{ p.line }}
                      @if (p.builtin && (p.usageCount ?? 0) > 1) {
                        <span class="more">+{{ (p.usageCount ?? 1) - 1 }} more</span>
                      }
                    </span>
                  </button>
                </li>
              }
            </ul>
          } @else {
            <div class="state compact" role="status">
              <p class="state-title">No pipes match</p>
              <p class="state-hint">
                @if (filter().trim()) {
                  Nothing matches “{{ filter().trim() }}” in this view.
                } @else {
                  None of the pipes fit this filter.
                }
              </p>
              <button type="button" (click)="clearFilters()">Clear filters</button>
            </div>
          }
        </div>

        <section id="pipe-detail" class="detail" aria-labelledby="pipe-detail-title">
          @if (selected(); as p) {
            <header class="detail-head">
              <h2 id="pipe-detail-title" class="mono">{{ p.name }}</h2>
              <span class="chip" [class.impure]="!p.isPure">{{
                p.isPure ? 'pure' : 'impure'
              }}</span>
              @if (p.builtin) {
                <span class="chip">built-in</span>
              }
            </header>

            <div class="block">
              <h3>Declaration</h3>
              <dl>
                <dt>Class</dt>
                <dd class="mono">{{ p.className }}</dd>
                <dt>Source</dt>
                <dd>{{ p.builtin ? '@angular/common' : 'This project' }}</dd>
                @if (!p.builtin) {
                  <dt>File</dt>
                  <dd class="mono">{{ p.file }}:{{ p.line }}</dd>
                }
                <dt>Standalone</dt>
                <dd>{{ p.isStandalone ? 'Yes' : 'No, declared in an NgModule' }}</dd>
                <dt>Pure</dt>
                <dd>
                  {{
                    p.isPure
                      ? 'Yes, reruns only when an input changes'
                      : 'No, reruns on every check'
                  }}
                </dd>
              </dl>
            </div>

            @if (p.builtin && p.usages?.length) {
              <div class="block">
                <h3>
                  Used in templates <span class="pill">{{ p.usageCount }}</span>
                </h3>
                <ul class="sites">
                  @for (u of p.usages; track u.file + ':' + u.line) {
                    <li class="mono">{{ u.file }}:{{ u.line }}</li>
                  }
                </ul>
              </div>
            }

            <div class="block">
              <h3>Live on the page</h3>
              @if (liveFor(p.name); as live) {
                @if (live.stale) {
                  <p class="warning" role="note">
                    <span class="chip warn">experimental</span>
                    This pure pipe got an argument whose contents changed while its reference stayed
                    the same, so it may be showing a stale value.
                  </p>
                }
                <dl>
                  <dt>Instances</dt>
                  <dd>{{ live.instanceCount }}</dd>
                  <dt>Used by</dt>
                  <dd>
                    <ul class="chips">
                      @for (c of live.components; track c.name) {
                        <li>
                          @if (c.targets?.[0]; as target) {
                            <button
                              type="button"
                              class="component"
                              [attr.aria-label]="'Highlight ' + c.name + ' on the page'"
                              (click)="highlight(target, true)"
                              (mouseenter)="highlight(target)"
                              (mouseleave)="highlight(null)"
                              (focus)="highlight(target)"
                              (blur)="highlight(null)"
                            >
                              <span class="mono">{{ c.name }}</span>
                              <span class="count">{{ c.count }}</span>
                            </button>
                          } @else {
                            <span class="component">
                              <span class="mono">{{ c.name }}</span>
                              <span class="count">{{ c.count }}</span>
                            </span>
                          }
                        </li>
                      }
                    </ul>
                  </dd>
                  @if (live.call; as call) {
                    <dt>Calls</dt>
                    <dd>{{ call.callCount }}</dd>
                    <dt>Last input</dt>
                    <dd class="mono value">{{ describe(call.lastArgs) }}</dd>
                    <dt>Last output</dt>
                    <dd class="mono value">{{ describe(call.lastResult) }}</dd>
                    @if (call.instances?.length) {
                      <dt>Per instance</dt>
                      <dd>
                        <ul class="sites">
                          @for (i of call.instances; track $index) {
                            <li class="mono value">
                              {{ describe(i.lastArgs) }} → {{ describe(i.lastResult) }}
                              <span class="calls">{{ i.callCount }}×</span>
                            </li>
                          }
                        </ul>
                      </dd>
                    }
                    @if (call.lastCaller) {
                      <dt>Last caller</dt>
                      <dd class="mono value">{{ call.lastCaller }}</dd>
                    }
                  } @else if (instrumenting()) {
                    <dt>Calls</dt>
                    <dd class="muted">None recorded yet.</dd>
                  }
                </dl>
                @if (!live.call && !instrumenting()) {
                  <p class="hint">Turn on “Record calls” to see call counts and values.</p>
                }
              } @else {
                <p class="empty-line">
                  Not in use on the connected page. Open a view that uses it, or connect the app.
                </p>
              }
            </div>
          } @else {
            <h2 id="pipe-detail-title" class="visually-hidden">Pipe details</h2>
            <div class="state compact">
              <p class="state-title">Pick a pipe</p>
              <p class="state-hint">
                See where it is declared, which components use it and what it last returned.
              </p>
            </div>
          }
        </section>
      </div>
    }

    @if (async().length > 0) {
      <section class="section" aria-labelledby="async-title">
        <h2 id="async-title">
          Async subscriptions <span class="pill">{{ async().length }}</span>
        </h2>
        <p class="hint">
          Each <span class="mono">| async</span> subscribes on its own. Two on the same source mean
          the work runs twice. A source that changes on every check, like
          <span class="mono">getData() | async</span>, resubscribes each time.
        </p>
        <ul class="async-list">
          @for (a of async(); track $index) {
            <li class="async-row" (mouseenter)="highlight(a.target)" (mouseleave)="highlight(null)">
              @if (a.target; as target) {
                <button
                  type="button"
                  class="component-name mono"
                  [attr.aria-label]="'Highlight ' + a.component + ' on the page'"
                  (click)="highlight(target)"
                  (focus)="highlight(target)"
                  (blur)="highlight(null)"
                >
                  {{ a.component }}
                </button>
              } @else {
                <span class="mono component-name">{{ a.component }}</span>
              }
              @if (!a.hasSource) {
                <span class="chip">no source</span>
              }
              @if (a.duplicate) {
                <span class="chip warn">duplicate subscription</span>
              }
              @if (a.resubscribing) {
                <span class="chip warn">resubscribing</span>
              }
              <span class="mono value latest">{{ a.latestValue ?? 'no value yet' }}</span>
            </li>
          }
        </ul>
      </section>
    }

    <section class="section" aria-labelledby="lint-title">
      <h2 id="lint-title">
        Lint
        @if (lint(); as findings) {
          <span class="pill">{{ findings.length }}</span>
        }
      </h2>
      @if (lintFailed()) {
        <p class="empty-line" role="alert">Couldn't run the lint check. Try Refresh.</p>
      } @else if (lint() === null) {
        <p class="empty-line" role="status">Checking…</p>
      } @else if (!lint()!.length) {
        <p class="empty-line ok">No problems found.</p>
      } @else {
        <ul class="findings">
          @for (f of lint(); track $index) {
            <li class="finding">
              <div class="finding-head">
                <span class="severity" [attr.data-tone]="f.severity">{{ f.severity }}</span>
                <code class="mono rule">{{ f.rule }}</code>
                <span class="where mono">{{ f.pipe }} · {{ f.file }}:{{ f.line }}</span>
              </div>
              <p class="finding-message">{{ f.message }}</p>
              <p class="finding-fix"><span class="fix-label">Fix</span> {{ f.fix }}</p>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
      color: var(--text);
      font-size: 13px;
    }
    .mono {
      font-family: var(--font-mono);
    }
    .intro {
      max-width: 720px;
      margin: 0 0 12px;
      color: var(--text-2);
      line-height: 1.5;
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
      -webkit-backdrop-filter: blur(10px);
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
    .search:focus-within .search-icon {
      stroke: var(--accent);
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
      transition:
        border-color 150ms var(--ease),
        box-shadow 150ms var(--ease);
    }
    input[type='search']::placeholder {
      color: var(--text-3);
    }
    input[type='search']:focus-visible {
      @include m.field-focus;
    }
    .toolbar app-select {
      width: 150px;
    }
    .total {
      flex: none;
      color: var(--text-2);
      font-size: 12px;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: var(--control-h);
      padding: 0 14px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
      transition:
        background-color 150ms var(--ease),
        border-color 150ms var(--ease);
    }
    button:hover:not(:disabled) {
      border-color: var(--accent-line);
      background: var(--surface-3);
    }
    button:focus-visible {
      @include m.focus-ring;
    }
    button:disabled {
      cursor: default;
      opacity: 0.6;
    }
    .record[aria-busy='true'] {
      cursor: progress;
    }
    .rec-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-3);
    }
    .record.on {
      @include m.soft(var(--accent));
    }
    .record.on .rec-dot {
      background: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }
    .notice {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0 0 12px;
      padding: 10px 12px;
      border: 1px solid var(--accent-line);
      border-radius: var(--radius-sm);
      background: var(--accent-soft);
      color: var(--text-2);
      line-height: 1.5;
      @include m.enter(0.2s);
    }
    .notice strong {
      color: var(--text-strong);
      font-weight: 600;
    }
    .notice svg {
      flex: none;
      width: 16px;
      height: 16px;
      margin-top: 2px;
      fill: none;
      stroke: var(--accent);
      stroke-width: 2;
      stroke-linecap: round;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
      align-items: start;
    }
    @media (min-width: 880px) {
      .layout {
        grid-template-columns: minmax(0, 1fr) minmax(340px, 44%);
      }
      .detail {
        position: sticky;
        top: 64px;
        max-height: calc(100vh - 150px);
        overflow: auto;
      }
    }
    .list-wrap {
      min-width: 0;
    }
    .pipe-list {
      display: grid;
      gap: 2px;
      margin: 0;
      padding: 6px;
      list-style: none;
      @include m.panel;
      @include m.enter;
    }
    .row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 2px 12px;
      width: 100%;
      height: auto;
      padding: 8px 10px;
      border: 0;
      border-radius: var(--radius-sm);
      background: none;
      text-align: left;
      font-weight: 400;
      white-space: normal;
    }
    .row:hover:not(:disabled) {
      border-color: transparent;
      background: var(--surface-2);
    }
    .row:focus-visible {
      @include m.focus-ring(-2px);
    }
    .row.selected {
      background: var(--accent-soft);
      box-shadow: inset 2px 0 0 var(--accent);
    }
    .row-main {
      display: flex;
      align-items: baseline;
      gap: 8px;
      min-width: 0;
    }
    .name {
      flex: none;
      color: var(--text-strong);
      font-size: 13px;
      font-weight: 600;
    }
    .sub {
      color: var(--text-3);
      font-size: 12px;
      @include m.truncate;
    }
    .row-meta {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 4px;
    }
    .row-file {
      grid-column: 1 / -1;
      color: var(--text-3);
      font-size: 11px;
      overflow-wrap: anywhere;
    }
    .more {
      margin-left: 6px;
      color: var(--text-2);
    }
    .chip {
      display: inline-flex;
      align-items: center;
      height: 18px;
      padding: 0 7px;
      border: 1px solid var(--border-strong);
      border-radius: 99px;
      color: var(--text-2);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .chip.impure,
    .chip.warn {
      @include m.soft(var(--warn));
    }
    .chip.live {
      @include m.soft(var(--ok));
    }
    .pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 16px;
      padding: 0 5px;
      border-radius: 99px;
      background: var(--surface-3);
      color: var(--text-2);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0;
      font-variant-numeric: tabular-nums;
    }
    .detail {
      min-width: 0;
      @include m.panel;
      @include m.enter;
    }
    .detail-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 10px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
    }
    .detail-head h2 {
      flex: 1 1 auto;
      min-width: 0;
      margin: 0;
      color: var(--text-strong);
      font-size: 15px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .block {
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
    }
    .block:last-child {
      border-bottom: 0;
    }
    h3 {
      @include m.label;
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 10px;
    }
    dl {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 6px 14px;
      margin: 0;
    }
    dt {
      color: var(--text-3);
    }
    dd {
      min-width: 0;
      margin: 0;
      color: var(--text);
    }
    .value {
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .muted {
      color: var(--text-2);
    }
    .sites {
      display: grid;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
      color: var(--text-2);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .calls {
      margin-left: 6px;
      color: var(--text-3);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .component {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 24px;
      padding: 0 4px 0 10px;
      border: 1px solid var(--border-strong);
      border-radius: 99px;
      background: var(--bg);
      font-size: 12px;
      transition:
        border-color 150ms var(--ease),
        background-color 150ms var(--ease);
    }
    button.component {
      height: 24px;
      padding: 0 4px 0 10px;
      border-radius: 99px;
      background: var(--bg);
      font-size: 12px;
      font-weight: 400;
    }
    .count {
      padding: 0 6px;
      border-radius: 99px;
      background: var(--surface-3);
      color: var(--text-2);
      font-size: 10px;
      line-height: 16px;
      font-variant-numeric: tabular-nums;
    }
    .warning {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 8px;
      margin: 0 0 12px;
      padding: 8px 10px;
      border: 1px solid color-mix(in srgb, var(--warn) 30%, transparent);
      border-radius: var(--radius-sm);
      background: color-mix(in srgb, var(--warn) 8%, transparent);
      color: var(--text);
      line-height: 1.5;
    }
    .hint {
      margin: 8px 0 0;
      color: var(--text-3);
      font-size: 12px;
    }
    .empty-line {
      margin: 0;
      color: var(--text-2);
      line-height: 1.5;
    }
    .empty-line.ok {
      color: var(--ok);
    }
    .section {
      margin-top: 20px;
      @include m.enter;
    }
    .section h2 {
      @include m.label;
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 8px;
    }
    .section > .hint {
      margin: -2px 0 10px;
    }
    .async-list,
    .findings {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .async-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 8px;
      min-width: 0;
      padding: 8px 12px;
      border-radius: var(--radius-sm);
      @include m.panel;
      transition:
        background-color 150ms var(--ease),
        border-color 150ms var(--ease);
    }
    .async-row:hover {
      border-color: var(--border-strong);
      background: var(--surface-2);
    }
    .component-name {
      color: var(--text-strong);
      font-weight: 600;
    }
    button.component-name {
      height: 24px;
      padding: 0 8px;
      margin-left: -8px;
      border-color: transparent;
      background: none;
      font-size: 13px;
    }
    .latest {
      flex: 1 1 100%;
      color: var(--text-2);
    }
    .finding {
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      @include m.panel;
    }
    .finding-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 8px;
    }
    .severity {
      padding: 0 7px;
      border: 1px solid var(--border-strong);
      border-radius: 99px;
      color: var(--text-2);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      line-height: 16px;
      text-transform: uppercase;
    }
    .severity[data-tone='warning'] {
      @include m.soft(var(--warn));
    }
    .severity[data-tone='error'] {
      @include m.soft(var(--danger));
    }
    .rule {
      color: var(--accent);
      font-size: 12px;
    }
    .where {
      color: var(--text-3);
      font-size: 11px;
      overflow-wrap: anywhere;
    }
    .finding-message {
      margin: 6px 0 0;
      color: var(--text);
      line-height: 1.5;
    }
    .finding-fix {
      margin: 4px 0 0;
      color: var(--text-2);
      line-height: 1.5;
    }
    .fix-label {
      @include m.label;
      margin-right: 4px;
    }
    .state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 40px 16px;
      text-align: center;
      background: var(--surface);
      border: 1px dashed var(--border-strong);
      border-radius: var(--radius);
      @include m.enter;
    }
    .state.compact {
      padding: 28px 16px;
      border: 0;
      background: none;
    }
    .list-wrap .state.compact {
      @include m.panel;
    }
    .state-title {
      margin: 0;
      color: var(--text-strong);
      font-size: 14px;
      font-weight: 600;
    }
    .state-hint {
      max-width: 440px;
      margin: 0;
      color: var(--text-2);
      line-height: 1.5;
    }
    .state button {
      margin-top: 8px;
    }
    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--border-strong);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation: none;
      }
    }
  `,
})
export class PipesInspector {
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  rpc = input<DevframeRpcClient | null>(null);

  protected readonly kindOptions = KIND_OPTIONS;

  pipes = signal<PipeInfo[]>([]);
  filter = signal('');
  kind = signal<PipeKind | null>('all');
  loading = signal(false);
  loadFailed = signal(false);
  selected = signal<PipeInfo | null>(null);

  live = signal<LivePipeInfo[]>([]);
  async = signal<AsyncUsageInfo[]>([]);
  lint = signal<PipeLintFinding[] | null>(null);
  lintFailed = signal(false);
  instrumentedPages = signal<string[]>([]);
  instrumenting = computed(() => this.instrumentedPages().length > 0);
  pendingRecord = signal<boolean | null>(null);
  recordMessage = signal<string | null>(null);
  recordLabel = computed(() => {
    const pending = this.pendingRecord();
    if (pending !== null) return pending ? 'Starting…' : 'Stopping…';
    return this.instrumenting() ? 'Stop recording' : 'Record calls';
  });
  private pendingTimer?: ReturnType<typeof setTimeout>;

  private readonly liveByName = computed(() => new Map(this.live().map((p) => [p.name, p])));

  filtered = computed(() => {
    const q = this.filter().trim().toLowerCase();
    const kind = this.kind() ?? 'all';
    const live = this.liveByName();
    return this.pipes().filter((p) => {
      if (kind === 'custom' && p.builtin) return false;
      if (kind === 'builtin' && !p.builtin) return false;
      if (kind === 'impure' && p.isPure) return false;
      if (kind === 'live' && !live.has(p.name)) return false;
      return (
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.className.toLowerCase().includes(q) ||
        p.file.toLowerCase().includes(q)
      );
    });
  });

  private unsubscribe?: () => void;

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client) {
        this.refresh();
        this.loadLive(client);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.unsubscribe?.();
      clearTimeout(this.pendingTimer);
      this.highlight(null);
    });
  }

  async refresh() {
    const client = this.rpc();
    if (!client) return;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      const my = client.scope('ng-devtools');
      const pipes = (await my.rpc.call('get-pipes')) as PipeInfo[];
      this.pipes.set(pipes);
      const sel = this.selected();
      if (sel) {
        const refreshed = pipes.find((p) => p.name === sel.name && p.file === sel.file);
        this.selected.set(refreshed ?? null);
      }
    } catch {
      this.loadFailed.set(true);
    } finally {
      this.loading.set(false);
    }
    this.loadLint(client);
  }

  async loadLint(client: DevframeRpcClient) {
    this.lintFailed.set(false);
    try {
      const findings = (await client
        .scope('ng-devtools')
        .rpc.call('pipe-lint')) as PipeLintFinding[];
      this.lint.set(findings);
    } catch {
      this.lintFailed.set(true);
    }
  }

  async loadLive(client: DevframeRpcClient) {
    try {
      const state = await client.scope('ng-devtools').rpc.sharedState('pipe-usage');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) => {
        const snapshot = value as PipesSnapshot | undefined;
        this.live.set(snapshot?.pipes ?? []);
        this.async.set(snapshot?.async ?? []);
        const pages = snapshot?.instrumented ?? [];
        this.instrumentedPages.set(pages);
        if (this.pendingRecord() === pages.length > 0) this.settleRecord(null);
      };
      apply(state.value());
      this.unsubscribe?.();
      this.unsubscribe = state.on('updated', apply);
    } catch {
      // RPC not available
    }
  }

  async toggleInstrument() {
    const client = this.rpc();
    if (!client || this.pendingRecord() !== null) return;
    const on = !this.instrumenting();
    this.recordMessage.set(null);
    this.pendingRecord.set(on);
    let result: { pages?: number } | undefined;
    try {
      result = (await client.scope('ng-devtools').rpc.call('request-instrument-pipes', on)) as
        { pages?: number } | undefined;
    } catch {
      this.settleRecord("Couldn't reach the devtools server. Try again.");
      return;
    }
    if (this.pendingRecord() !== on) return;
    if (result?.pages === 0) {
      this.settleRecord(
        'No page is connected. Open your app in the browser with the devtools running, then record again.',
      );
      return;
    }
    clearTimeout(this.pendingTimer);
    this.pendingTimer = setTimeout(() => {
      if (this.pendingRecord() !== on) return;
      this.settleRecord(
        on
          ? 'No page confirmed recording. Reload the app and try again.'
          : 'No page confirmed it stopped recording. Reload the app to stop it.',
      );
    }, RECORD_CONFIRM_MS);
  }

  private settleRecord(message: string | null) {
    clearTimeout(this.pendingTimer);
    this.pendingRecord.set(null);
    if (message !== null) this.recordMessage.set(message);
  }

  liveFor(name: string): LivePipeInfo | undefined {
    return this.liveByName().get(name);
  }

  describe(value: unknown): string {
    if (Array.isArray(value)) return value.map((v) => this.describe(v)).join(', ');
    if (typeof value === 'string') return value.length > 80 ? `${value.slice(0, 80)}…` : value;
    try {
      const json = JSON.stringify(value);
      return json && json.length > 120 ? `${json.slice(0, 120)}…` : (json ?? String(value));
    } catch {
      return String(value);
    }
  }

  isSelected(pipe: PipeInfo): boolean {
    const sel = this.selected();
    return sel !== null && sel.name === pipe.name && sel.file === pipe.file;
  }

  select(pipe: PipeInfo) {
    this.selected.set(this.isSelected(pipe) ? null : pipe);
  }

  clearFilters() {
    this.filter.set('');
    this.kind.set('all');
  }

  highlightPipe(live: LivePipeInfo | undefined) {
    this.highlight(live?.components.find((c) => c.targets?.length)?.targets?.[0]);
  }

  highlight(target: PipeTarget | null | undefined, reveal = false) {
    const client = this.rpc();
    if (!client) return;
    void client
      .scope('ng-devtools')
      .rpc.call(
        'request-page-highlight',
        target ? { ...target, ...(reveal ? { reveal } : {}) } : null,
      )
      .catch(() => {});
  }

  onListKey(event: KeyboardEvent) {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const rows = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLButtonElement>('[data-pipe-row]'),
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
}
