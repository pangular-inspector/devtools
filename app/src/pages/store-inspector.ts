import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { time } from '../format';
import { hostPageId } from '../page-id';
import { rpcCall as call } from '../rpc';
import { Select, type SelectOption } from '../ui/select';
import {
  pretty,
  short,
  type LiveStore,
  type NgrxLogEntry,
  type NgrxPage,
  type NgrxState,
  type NgrxStoreEntry,
} from './store-types';

const KIND_COLORS: Record<string, string> = {
  action: '#f59e0b',
  reducer: '#a78bfa',
  effect: '#fb923c',
  selector: '#60a5fa',
  feature: '#34d399',
  'store-setup': '#94a3b8',
  'signal-store': '#e879f9',
  'signal-state': '#22d3ee',
  'signal-method': '#fb7185',
  store: '#a78bfa',
};

const KIND_LABELS: Record<string, string> = {
  'signal-store': 'signalStore',
  'signal-state': 'signalState',
  'signal-method': 'signalMethod',
  'store-setup': 'store setup',
  store: '@ngrx/store',
};

const CLASSIC_KINDS = new Set([
  'action',
  'reducer',
  'effect',
  'selector',
  'feature',
  'store-setup',
]);

@Component({
  selector: 'app-store-inspector',
  imports: [Select],
  template: `
    <div class="toolbar">
      <input
        type="search"
        placeholder="Filter stores, changes and declarations…"
        aria-label="Filter stores, changes and source declarations"
        [value]="filter()"
        (input)="filter.set($any($event.target).value)"
      />
      @if (pages().length > 1) {
        <span class="visually-hidden" id="ngrx-page-label">Page</span>
        <app-select
          class="page-select"
          labelledBy="ngrx-page-label"
          [options]="pageOptions()"
          [value]="page()?.pageId ?? null"
          (valueChange)="selectPage($event)"
        />
      }
      <span class="status" [class.on]="!!page()">
        <span class="live-dot" aria-hidden="true"></span>
        {{ page() ? 'Live' : 'No page connected' }}
      </span>
    </div>

    <section class="block" aria-labelledby="ngrx-live-heading">
      <div class="section-head">
        <h2 id="ngrx-live-heading">Live stores</h2>
        @if (liveStores().length) {
          <span class="pill">{{ liveStores().length }}</span>
        }
      </div>

      @if (failed()) {
        <div class="empty" role="alert">
          <p class="empty-title">Could not load the live store state.</p>
          <p class="hint">Check that the dev server with ng-devtools is still running.</p>
          <button type="button" class="btn" (click)="retry()">Retry</button>
        </div>
      } @else if (!page()) {
        <div class="empty">
          <p class="empty-title">No page is reporting NgRx state yet.</p>
          <p class="hint">
            Open the app in a browser. Stores show up here as soon as the page creates them.
          </p>
        </div>
      } @else if (!liveStores().length) {
        <div class="empty">
          @if (usesSignals()) {
            <p class="empty-title">No signal store instance on this page yet.</p>
            <p class="hint">
              A <code>signalStore</code> is created the first time something injects it. Navigate to
              a page that uses the store and it appears here.
            </p>
          } @else if (usesClassic()) {
            <p class="empty-title">The &#64;ngrx/store Store was not found on this page.</p>
            <p class="hint">
              Check that <code>provideStore()</code> or <code>StoreModule.forRoot()</code> is part
              of the providers of the running app.
            </p>
          } @else {
            <p class="empty-title">This page has no NgRx store.</p>
            <p class="hint">
              Stores from <code>&#64;ngrx/signals</code> (<code>signalStore</code>,
              <code>signalState</code>) and <code>&#64;ngrx/store</code> are listed here once the
              app creates them.
            </p>
          }
        </div>
      } @else {
        <div class="live-layout">
          <ul class="store-list" aria-label="Stores on this page">
            @for (item of filteredStores(); track item.id) {
              <li>
                <button
                  type="button"
                  class="store-item"
                  [class.selected]="item.id === store()?.id"
                  [attr.aria-pressed]="item.id === store()?.id"
                  (click)="selectStore(item.id)"
                >
                  <span class="store-top">
                    <span
                      class="dot"
                      aria-hidden="true"
                      [style.background]="kindColor(item.kind)"
                    ></span>
                    <span class="store-name">{{ item.label }}</span>
                  </span>
                  <span class="store-meta">
                    {{ kindLabel(item.kind) }} · {{ item.scope }} · {{ changeCount(item.id) }}
                    {{ changeCount(item.id) === 1 ? 'change' : 'changes' }}
                  </span>
                </button>
              </li>
            } @empty {
              <li class="muted pad">No stores match this filter.</li>
            }
          </ul>

          @if (store(); as current) {
            <div class="store-detail">
              <div class="detail-head">
                <h3>{{ current.label }}</h3>
                <div class="chips">
                  <span class="chip">{{ kindLabel(current.kind) }}</span>
                  <span class="chip">scope: {{ current.scope }}</span>
                  @if (current.signal?.declaredIn; as file) {
                    <span class="chip mono" [title]="file">{{ file }}</span>
                  }
                  @if (current.classic) {
                    <span class="chip">{{
                      current.classic.devtools ? 'Store DevTools on' : 'read-only'
                    }}</span>
                  }
                </div>
                @if (current.signal?.references?.length) {
                  <p class="refs">
                    Referenced by
                    @for (ref of current.signal!.references; track ref; let last = $last) {
                      <code>{{ ref }}</code
                      >{{ last ? '' : ', ' }}
                    }
                  </p>
                }
              </div>

              <div class="facts">
                <section class="fact" aria-labelledby="ngrx-state-heading">
                  <h4 id="ngrx-state-heading">State</h4>
                  <pre class="tree" tabindex="0" aria-labelledby="ngrx-state-heading">{{
                    stateText()
                  }}</pre>
                </section>
                @if (current.signal; as info) {
                  <section class="fact" aria-labelledby="ngrx-computed-heading">
                    <h4 id="ngrx-computed-heading">Computed</h4>
                    @if (computedEntries().length) {
                      <dl class="kv">
                        @for (entry of computedEntries(); track entry.key) {
                          <dt>{{ entry.key }}</dt>
                          <dd>
                            <code [title]="entry.full">{{ entry.value }}</code>
                          </dd>
                        }
                      </dl>
                    } @else {
                      <p class="muted">No computed signals.</p>
                    }
                    <h4 id="ngrx-methods-heading" class="spaced">Methods</h4>
                    @if (info.methods.length) {
                      <ul class="methods" aria-labelledby="ngrx-methods-heading">
                        @for (method of info.methods; track method.name) {
                          <li class="chip mono">
                            {{ method.name }}
                            @if (method.rx) {
                              <span class="tag">rxMethod</span>
                            }
                            <span class="calls"
                              >{{ method.calls }} {{ method.calls === 1 ? 'call' : 'calls' }}</span
                            >
                          </li>
                        }
                      </ul>
                    } @else {
                      <p class="muted">No methods.</p>
                    }
                  </section>
                }
              </div>

              <section class="log" aria-labelledby="ngrx-log-heading">
                <h4 id="ngrx-log-heading">
                  {{ current.classic ? 'Action log' : 'Change log' }}
                  <span class="pill">{{ storeLog().length }}</span>
                </h4>
                <div class="log-layout">
                  <ul class="log-list" [attr.aria-label]="current.classic ? 'Actions' : 'Changes'">
                    @for (entry of storeLog(); track entry.seq) {
                      <li>
                        <button
                          type="button"
                          class="log-item"
                          [class.selected]="entry.seq === selectedSeq()"
                          [attr.aria-pressed]="entry.seq === selectedSeq()"
                          (click)="selectEntry(entry.seq)"
                        >
                          <span class="seq">#{{ entry.seq }}</span>
                          <span class="log-type" [title]="entry.type">{{ entry.type }}</span>
                          <span class="log-meta"
                            >{{
                              entry.diff.length === 0
                                ? 'no change'
                                : entry.diff.length +
                                  (entry.diff.length === 1 ? ' change' : ' changes')
                            }}
                            ·
                            {{ formatTime(entry.timestamp) }}</span
                          >
                        </button>
                      </li>
                    } @empty {
                      <li class="muted pad">
                        @if (filter()) {
                          No entries match this filter.
                        } @else if (current.classic) {
                          No actions dispatched since the page connected.
                        } @else {
                          No state changes yet. Method calls and patchState writes that change the
                          state are recorded here.
                        }
                      </li>
                    }
                  </ul>

                  @if (entry(); as selected) {
                    <section class="entry" aria-labelledby="ngrx-entry-heading">
                      <h5 id="ngrx-entry-heading">#{{ selected.seq }} {{ selected.type }}</h5>
                      <dl class="kv">
                        <dt>Time</dt>
                        <dd>{{ formatTime(selected.timestamp) }}</dd>
                        @if (selected.action !== undefined) {
                          <dt>Action</dt>
                          <dd>
                            <pre class="code">{{ prettyText(selected.action) }}</pre>
                          </dd>
                        }
                        @if (selected.args?.length) {
                          <dt>Arguments</dt>
                          <dd>
                            <pre class="code">{{ prettyText(selected.args) }}</pre>
                          </dd>
                        }
                      </dl>
                      <h6 class="sub">State diff</h6>
                      @if (selected.diff.length) {
                        <ul class="diff">
                          @for (change of selected.diff; track change.path) {
                            <li [class]="'diff-row ' + change.op">
                              <span class="op">{{ opLabel(change.op) }}</span>
                              <code class="path">{{ change.path }}</code>
                              <span class="values">
                                @if (change.op !== 'add') {
                                  <code class="before">{{ shortText(change.before) }}</code>
                                }
                                @if (change.op === 'change') {
                                  <span class="arrow" aria-hidden="true">→</span
                                  ><span class="visually-hidden">became</span>
                                }
                                @if (change.op !== 'remove') {
                                  <code class="after">{{ shortText(change.after) }}</code>
                                }
                              </span>
                            </li>
                          }
                        </ul>
                      } @else {
                        <p class="muted">The state did not change.</p>
                      }

                      @if (selected.restorable) {
                        @if (confirmSeq() === selected.seq) {
                          <div class="confirm" role="group" aria-labelledby="ngrx-confirm-text">
                            <p id="ngrx-confirm-text">
                              @if (selected.source === 'store') {
                                Store DevTools jumps the app state to the state right after action
                                #{{ selected.seq }}. New actions continue from there.
                              } @else {
                                This sets every state key of {{ current.label }} back to its value
                                right after change #{{ selected.seq }}. Components that read the
                                store update at once, and a new "Restore" entry is added to the log.
                              }
                            </p>
                            <div class="actions">
                              <button
                                type="button"
                                class="btn primary"
                                [disabled]="busy()"
                                (click)="restore(selected.seq)"
                              >
                                Restore
                              </button>
                              <button type="button" class="btn" (click)="confirmSeq.set(null)">
                                Cancel
                              </button>
                            </div>
                          </div>
                        } @else {
                          <button
                            type="button"
                            class="btn restore"
                            (click)="confirmSeq.set(selected.seq)"
                          >
                            Restore this state
                          </button>
                        }
                      } @else if (selected.source === 'store') {
                        <p class="hint small">
                          Time travel for &#64;ngrx/store needs <code>provideStoreDevtools()</code>.
                          Without it this log is read-only.
                        </p>
                      }
                    </section>
                  }
                </div>
              </section>
            </div>
          }
        </div>
      }
      <p class="message" role="status">{{ message() }}</p>
    </section>

    <section class="block" aria-labelledby="ngrx-source-heading">
      <div class="section-head">
        <h2 id="ngrx-source-heading">Source declarations</h2>
        @if (sourceEntries().length) {
          <span class="pill">{{ sourceEntries().length }}</span>
        }
      </div>
      @if (!sourceLoaded()) {
        <div class="empty compact" role="status">
          <span class="spinner" aria-hidden="true"></span>
          <p class="empty-title">Scanning source for NgRx declarations…</p>
        </div>
      } @else if (sourceEntries().length === 0) {
        <div class="empty compact">
          <p class="empty-title">No NgRx declarations found in source.</p>
          <p class="hint">
            The scan looks for <code>signalStore</code>, <code>signalState</code>,
            <code>signalMethod</code>, <code>createAction</code>, <code>createReducer</code>,
            <code>createEffect</code>, <code>createSelector</code> and <code>createFeature</code>.
          </p>
        </div>
      } @else {
        <div class="kinds" role="group" aria-label="Filter declarations by kind">
          <button
            type="button"
            class="kind-chip"
            [class.active]="!kind()"
            [attr.aria-pressed]="!kind()"
            (click)="kind.set(null)"
          >
            All <span class="count">{{ sourceEntries().length }}</span>
          </button>
          @for (group of groupedEntries(); track group.kind) {
            <button
              type="button"
              class="kind-chip"
              [class.active]="kind() === group.kind"
              [attr.aria-pressed]="kind() === group.kind"
              (click)="kind.set(kind() === group.kind ? null : group.kind)"
            >
              <span
                class="dot"
                aria-hidden="true"
                [style.background]="kindColor(group.kind)"
              ></span>
              <span class="chip-text">{{ kindLabel(group.kind) }}</span>
              <span class="count">{{ group.count }}</span>
            </button>
          }
        </div>

        <ul class="nodes">
          @for (entry of filteredEntries(); track entry.name + entry.file + entry.line) {
            <li class="node-card">
              <div class="node-header">
                <span
                  class="dot"
                  aria-hidden="true"
                  [style.background]="kindColor(entry.kind)"
                ></span>
                <span class="node-label">{{ entry.name }}</span>
                <span class="chip">{{ kindLabel(entry.kind) }}</span>
              </div>
              <div class="node-meta">
                <span class="file" [title]="entry.file + ':' + entry.line"
                  >{{ entry.file }}:{{ entry.line }}</span
                >
              </div>
              @if (entry.detail) {
                <p class="detail">{{ entry.detail }}</p>
              }
            </li>
          } @empty {
            <li class="empty compact" role="status">
              <p class="empty-title">No declarations match.</p>
              <button type="button" class="btn" (click)="clearFilters()">Clear filters</button>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: grid;
      gap: 24px;
      min-width: 0;
      color: var(--text);
      font-size: 13px;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
      padding: 10px 12px;
      background: color-mix(in srgb, var(--surface) 85%, transparent);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    input {
      flex: 1 1 220px;
      min-width: 0;
      height: 34px;
      padding: 0 12px;
      background: var(--bg);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      color: var(--text);
      font: inherit;
      font-size: 13px;
      outline: none;
      transition:
        border-color 0.15s var(--ease),
        box-shadow 0.15s var(--ease);
    }
    input::placeholder {
      color: var(--text-3);
    }
    input:focus-visible {
      @include m.field-focus;
    }
    .page-select {
      flex: 0 1 220px;
      min-width: 0;
    }
    .status {
      display: inline-flex;
      flex: none;
      align-items: center;
      gap: 6px;
      color: var(--text-2);
      font-size: 12px;
      font-weight: 500;
    }
    .live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--text-3);
    }
    .status.on .live-dot {
      background: var(--ok);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok) 20%, transparent);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      50% {
        opacity: 0.4;
      }
    }
    .block {
      display: grid;
      gap: 12px;
      min-width: 0;
    }
    .section-head {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 24px;
    }
    h2,
    h4,
    .sub {
      @include m.label;
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
    }
    h4 {
      margin-bottom: 10px;
    }
    .spaced {
      margin-top: 16px;
    }
    .sub {
      margin: 14px 0 8px;
    }
    .pill {
      min-width: 20px;
      padding: 0 7px;
      border-radius: 99px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      color: var(--text-2);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0;
      line-height: 18px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      text-align: center;
      padding: 36px 24px;
      @include m.panel;
      @include m.enter;
    }
    .empty.compact {
      padding: 24px 16px;
      border-style: dashed;
      background: transparent;
    }
    .empty-title {
      margin: 0;
      color: var(--text-strong);
      font-size: 14px;
      font-weight: 600;
    }
    .hint {
      max-width: 520px;
      margin: 0;
      color: var(--text-2);
      line-height: 1.55;
      overflow-wrap: anywhere;
    }
    .hint.small {
      margin-top: 12px;
      font-size: 12px;
    }
    code {
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .hint code,
    .refs code {
      padding: 1px 5px;
      color: var(--text);
      background: var(--surface-3);
      border: 1px solid var(--border);
      border-radius: 5px;
    }
    .muted {
      margin: 0;
      color: var(--text-2);
    }
    .pad {
      padding: 20px 12px;
      text-align: center;
      line-height: 1.5;
    }
    .btn {
      height: 32px;
      padding: 0 14px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition:
        background-color 0.15s var(--ease),
        border-color 0.15s var(--ease);
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
    .btn.primary,
    .btn.restore {
      border-color: var(--accent-line);
      background: var(--accent-soft);
      color: var(--text-strong);
    }
    .btn.restore {
      margin-top: 14px;
    }
    .live-layout {
      display: grid;
      grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
      min-width: 0;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow: hidden;
      @include m.enter;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .store-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px;
      border-right: 1px solid var(--border);
      background: var(--surface-2);
    }
    .store-item,
    .log-item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 3px;
      width: 100%;
      padding: 8px 10px;
      border: none;
      border-radius: var(--radius-sm);
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition: background-color 0.15s var(--ease);
    }
    .store-item:hover,
    .log-item:hover {
      background: var(--surface-3);
    }
    .store-item:focus-visible,
    .log-item:focus-visible {
      @include m.focus-ring(-2px);
    }
    .store-item.selected,
    .log-item.selected {
      background: var(--accent-soft);
      box-shadow: inset 2px 0 0 var(--accent);
    }
    .store-top {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      max-width: 100%;
    }
    .store-name {
      @include m.truncate;
      font-family: var(--font-mono);
      font-weight: 600;
      color: var(--text-strong);
    }
    .store-meta,
    .log-meta {
      color: var(--text-2);
      font-size: 11.5px;
      font-variant-numeric: tabular-nums;
    }
    .dot {
      flex: none;
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .store-detail {
      display: grid;
      gap: 16px;
      min-width: 0;
      padding: 16px;
    }
    .detail-head h3 {
      margin: 0 0 8px;
      color: var(--accent);
      font-family: var(--font-mono);
      font-size: 15px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 100%;
      padding: 1px 8px;
      border: 1px solid var(--border);
      border-radius: 99px;
      background: var(--surface-2);
      color: var(--text-2);
      font-size: 11.5px;
      line-height: 18px;
      overflow-wrap: anywhere;
    }
    .chip.mono {
      font-family: var(--font-mono);
    }
    .refs {
      margin: 10px 0 0;
      color: var(--text-2);
      line-height: 1.8;
    }
    .facts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
      min-width: 0;
    }
    .fact {
      min-width: 0;
    }
    pre {
      margin: 0;
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.55;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      color: var(--text);
    }
    .tree,
    .code {
      max-height: 360px;
      overflow: auto;
      padding: 10px 12px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .code {
      max-height: 220px;
    }
    .tree:focus-visible {
      @include m.focus-ring;
    }
    .kv {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 6px 14px;
      margin: 0;
    }
    .kv dt {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-2);
    }
    .kv dd {
      min-width: 0;
      margin: 0;
      overflow-wrap: anywhere;
    }
    .methods {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .tag {
      padding: 0 5px;
      border-radius: 4px;
      background: var(--accent-soft);
      color: var(--text-strong);
      font-size: 10.5px;
    }
    .calls {
      color: var(--text-3);
      font-family: var(--font-sans, inherit);
      font-size: 11px;
    }
    .log {
      min-width: 0;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }
    .log-layout {
      display: grid;
      grid-template-columns: minmax(200px, 300px) minmax(0, 1fr);
      gap: 16px;
      min-width: 0;
    }
    .log-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 420px;
      overflow: auto;
      padding: 2px;
    }
    .log-item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      column-gap: 8px;
      row-gap: 2px;
    }
    .seq {
      color: var(--text-3);
      font-size: 11.5px;
      font-variant-numeric: tabular-nums;
    }
    .log-type {
      @include m.truncate;
      max-width: 100%;
      font-family: var(--font-mono);
      font-size: 12.5px;
      color: var(--text);
    }
    .log-meta {
      grid-column: 2;
    }
    .entry {
      min-width: 0;
      padding: 14px;
      border: 1px solid var(--accent-line);
      border-radius: var(--radius-sm);
      @include m.enter(0.25s);
    }
    .entry h5 {
      margin: 0 0 12px;
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 600;
      color: var(--text-strong);
      overflow-wrap: anywhere;
    }
    .diff {
      display: grid;
      gap: 4px;
    }
    .diff-row {
      display: grid;
      grid-template-columns: auto minmax(0, max-content) minmax(0, 1fr);
      gap: 8px;
      align-items: baseline;
      padding: 5px 8px;
      border-radius: 6px;
      background: var(--surface-2);
    }
    .op {
      font-size: 10.5px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-2);
    }
    .diff-row.add .op {
      color: var(--ok);
    }
    .diff-row.remove .op {
      color: var(--danger);
    }
    .path {
      color: var(--text-strong);
      overflow-wrap: anywhere;
    }
    .values {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 6px;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .before {
      color: var(--text-2);
      text-decoration: line-through;
    }
    .after {
      color: var(--text);
    }
    .arrow {
      color: var(--text-3);
    }
    .confirm {
      margin-top: 14px;
      padding: 12px;
      border: 1px solid var(--accent-line);
      border-radius: var(--radius-sm);
      background: var(--accent-soft);
    }
    .confirm p {
      margin: 0 0 10px;
      line-height: 1.5;
    }
    .actions {
      display: flex;
      gap: 8px;
    }
    .message:empty {
      display: none;
    }
    .message {
      margin: 0;
      color: var(--text-2);
    }
    .kinds {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .kind-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 100%;
      height: 28px;
      padding: 0 10px;
      border: 1px solid var(--border);
      border-radius: 99px;
      background: var(--surface-2);
      color: var(--text-2);
      font: inherit;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition:
        background-color 0.15s var(--ease),
        border-color 0.15s var(--ease),
        color 0.15s var(--ease);
    }
    .kind-chip:hover {
      border-color: var(--border-strong);
      background: var(--surface-3);
      color: var(--text);
    }
    .kind-chip.active {
      border-color: var(--accent-line);
      background: var(--accent-soft);
      color: var(--text-strong);
    }
    .kind-chip:focus-visible {
      @include m.focus-ring;
    }
    .chip-text {
      @include m.truncate;
    }
    .kind-chip .count {
      flex: none;
      min-width: 18px;
      padding: 0 5px;
      border-radius: 99px;
      background: var(--surface-3);
      color: var(--text-2);
      font-size: 11px;
      line-height: 16px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .nodes {
      display: flex;
      flex-direction: column;
      gap: 8px;
      @include m.enter;
    }
    .node-card {
      min-width: 0;
      padding: 12px 16px;
      @include m.panel;
      border-radius: var(--radius-sm);
    }
    .node-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 8px;
      min-width: 0;
    }
    .node-label {
      min-width: 0;
      font-family: var(--font-mono);
      font-weight: 500;
      color: var(--text-strong);
      overflow-wrap: anywhere;
    }
    .node-meta {
      margin-top: 6px;
      color: var(--text-3);
      font-size: 12px;
    }
    .file {
      font-family: var(--font-mono);
      font-size: 11.5px;
      overflow-wrap: anywhere;
    }
    .detail {
      margin: 6px 0 0;
      color: var(--text-2);
      font-size: 12px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid var(--border-strong);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .spinner,
      .status.on .live-dot {
        animation: none;
      }
    }
    @media (max-width: 760px) {
      .live-layout,
      .log-layout {
        grid-template-columns: minmax(0, 1fr);
      }
      .store-list {
        border-right: none;
        border-bottom: 1px solid var(--border);
      }
    }
    @media (max-width: 480px) {
      .toolbar {
        padding: 8px;
      }
      .toolbar input,
      .page-select {
        flex-basis: 100%;
      }
      .store-detail {
        padding: 12px;
      }
      .kv {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class StoreInspector {
  readonly rpc = input<DevframeRpcClient | null>(null);

  readonly filter = signal('');
  readonly kind = signal<string | null>(null);
  readonly sourceEntries = signal<NgrxStoreEntry[]>([]);
  readonly sourceLoaded = signal(false);
  readonly pages = signal<NgrxPage[]>([]);
  readonly failed = signal(false);
  readonly selectedPageId = signal<string | null>(null);
  private readonly hostPageId = hostPageId();
  readonly selectedStoreId = signal<string | null>(null);
  readonly selectedSeq = signal<number | null>(null);
  readonly confirmSeq = signal<number | null>(null);
  readonly busy = signal(false);
  readonly message = signal('');

  private readonly destroyRef = inject(DestroyRef);
  private unsubscribe: (() => void) | null = null;

  readonly page = computed<NgrxPage | null>(() => {
    const pages = this.pages();
    return (
      pages.find((p) => p.pageId === this.selectedPageId()) ??
      pages.find((p) => p.pageId === this.hostPageId) ??
      pages[0] ??
      null
    );
  });

  readonly pageOptions = computed<SelectOption[]>(() =>
    this.pages().map((p) => ({ value: p.pageId, label: p.title || p.url, hint: p.url })),
  );

  readonly liveStores = computed<LiveStore[]>(() => {
    const page = this.page();
    if (!page) return [];
    const stores: LiveStore[] = page.stores.map((info) => ({
      id: info.id,
      label: info.name ?? info.references[0] ?? info.className,
      kind: info.kind,
      scope: info.scope,
      signal: info,
    }));
    if (page.classic) {
      stores.push({
        id: 'store',
        label: 'Store',
        kind: 'store',
        scope: page.classic.scope,
        classic: page.classic,
      });
    }
    return stores;
  });

  readonly filteredStores = computed(() => {
    const f = this.filter().trim().toLowerCase();
    if (!f) return this.liveStores();
    return this.liveStores().filter(
      (s) =>
        s.label.toLowerCase().includes(f) ||
        s.kind.includes(f) ||
        (s.signal?.stateKeys ?? []).some((k) => k.toLowerCase().includes(f)) ||
        (this.page()?.log ?? []).some(
          (e) => e.storeId === s.id && e.type.toLowerCase().includes(f),
        ),
    );
  });

  readonly store = computed<LiveStore | null>(() => {
    const stores = this.liveStores();
    return stores.find((s) => s.id === this.selectedStoreId()) ?? stores[0] ?? null;
  });

  readonly stateText = computed(() => {
    const store = this.store();
    if (!store) return '';
    return pretty(store.signal ? store.signal.state : store.classic?.state);
  });

  readonly computedEntries = computed(() =>
    Object.entries(this.store()?.signal?.computed ?? {}).map(([key, value]) => ({
      key,
      value: short(value, 160),
      full: pretty(value),
    })),
  );

  readonly storeLog = computed<NgrxLogEntry[]>(() => {
    const id = this.store()?.id;
    const f = this.filter().trim().toLowerCase();
    return (this.page()?.log ?? [])
      .filter(
        (e) => e.storeId === id && (!f || e.type.toLowerCase().includes(f) || this.storeMatches(f)),
      )
      .reverse();
  });

  readonly entry = computed(
    () => this.storeLog().find((e) => e.seq === this.selectedSeq()) ?? null,
  );

  readonly usesSignals = computed(() =>
    this.sourceEntries().some((e) => e.kind === 'signal-store' || e.kind === 'signal-state'),
  );
  readonly usesClassic = computed(() =>
    this.sourceEntries().some((e) => CLASSIC_KINDS.has(e.kind)),
  );

  readonly filteredEntries = computed(() => {
    const f = this.filter().trim().toLowerCase();
    const kind = this.kind();
    return this.sourceEntries().filter(
      (e) =>
        (!kind || e.kind === kind) &&
        (!f ||
          e.name.toLowerCase().includes(f) ||
          e.kind.includes(f) ||
          (e.detail ?? '').toLowerCase().includes(f)),
    );
  });

  readonly groupedEntries = computed(() => {
    const groups = new Map<string, number>();
    for (const e of this.sourceEntries()) groups.set(e.kind, (groups.get(e.kind) ?? 0) + 1);
    return [...groups.entries()].map(([kind, count]) => ({ kind, count }));
  });

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client) void this.load(client);
    });
    this.destroyRef.onDestroy(() => this.unsubscribe?.());
  }

  private storeMatches(f: string): boolean {
    const store = this.store();
    return !!store && store.label.toLowerCase().includes(f);
  }

  async load(client: DevframeRpcClient) {
    this.failed.set(false);
    call(client, 'get-ngrx-store')
      .then((entries) => this.sourceEntries.set(Array.isArray(entries) ? entries : []))
      .catch(() => this.sourceEntries.set([]))
      .finally(() => this.sourceLoaded.set(true));
    try {
      const state = await client.scope('ng-devtools').rpc.sharedState('ngrx-store');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) => {
        const next = value as Partial<NgrxState> | undefined;
        this.pages.set(Array.isArray(next?.pages) ? next.pages : []);
      };
      apply(state.value());
      this.unsubscribe?.();
      this.unsubscribe = state.on('updated', apply);
    } catch {
      this.failed.set(true);
    }
  }

  retry() {
    const client = this.rpc();
    if (client) void this.load(client);
  }

  selectPage(pageId: string | null) {
    this.selectedPageId.set(pageId);
    this.selectedStoreId.set(null);
    this.selectedSeq.set(null);
    this.confirmSeq.set(null);
  }

  selectStore(id: string) {
    this.selectedStoreId.set(id);
    this.selectedSeq.set(null);
    this.confirmSeq.set(null);
  }

  selectEntry(seq: number) {
    this.selectedSeq.set(this.selectedSeq() === seq ? null : seq);
    this.confirmSeq.set(null);
  }

  async restore(seq: number) {
    const page = this.page();
    if (!page) return;
    this.busy.set(true);
    try {
      const result = (await call(this.rpc(), 'request-ngrx-action', {
        pageId: page.pageId,
        request: { type: 'restore', seq },
      })) as { ok?: boolean; message?: string; error?: string } | null;
      this.message.set(result?.error ?? result?.message ?? 'Restored.');
    } catch {
      this.message.set('Could not reach the page to restore the state.');
    } finally {
      this.busy.set(false);
      this.confirmSeq.set(null);
    }
  }

  clearFilters() {
    this.filter.set('');
    this.kind.set(null);
  }

  changeCount(id: string): number {
    return (this.page()?.log ?? []).filter((e) => e.storeId === id).length;
  }

  kindColor(kind: string) {
    return KIND_COLORS[kind] ?? 'var(--text-3)';
  }

  kindLabel(kind: string) {
    return KIND_LABELS[kind] ?? kind;
  }

  opLabel(op: string) {
    return op === 'add' ? 'added' : op === 'remove' ? 'removed' : 'changed';
  }

  prettyText(value: unknown) {
    return pretty(value);
  }

  shortText(value: unknown) {
    return short(value);
  }

  readonly formatTime = time;
}
