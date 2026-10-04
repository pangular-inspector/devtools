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
  signal,
} from '@angular/core';
import { DatePipe, JsonPipe, NgTemplateOutlet } from '@angular/common';
import type { DevframeRpcClient } from 'devframe/client';
import { hostPageId } from '../page-id';
import { Select, type SelectOption } from '../ui/select';

interface SignalNode {
  id: string;
  kind: string;
  label?: string;
  epoch: number;
  value?: unknown;
  changes?: number;
}

interface SignalEdge {
  consumer: number;
  producer: number;
}

interface SignalChange {
  epoch: number;
  value: unknown;
  at: number;
  source: 'write' | 'sample' | 'initial';
  missed?: number;
}

interface SignalResource {
  id: string;
  name: string;
  named: boolean;
  status?: string;
  isLoading?: boolean;
  params?: unknown;
  value?: unknown;
  error?: unknown;
  statusCode?: number;
  epoch: number;
  changes?: number;
  nodeIds: string[];
}

interface GraphInjector {
  id: string;
  name: string;
}

interface SignalGraph {
  nodes: SignalNode[];
  edges: SignalEdge[];
  componentSelector?: string;
  component?: { id: string; name: string; tag: string; path: string };
  injector?: GraphInjector;
  environments?: GraphInjector[];
  resources?: SignalResource[];
  nodeCount?: number;
  unsupported?: boolean;
  writeHook?: false;
  source?: 'selected' | 'routed' | 'root';
  pageId?: string;
  history?: Record<string, SignalChange[]>;
}

interface LiveNode {
  id: string;
  name: string;
  tag: string;
  children: LiveNode[];
}

const FOLLOW = 'follow';
const ENV = 'env:';
const MAX_HISTORY = 50;

const SOURCE_NOTES: Record<NonNullable<SignalGraph['source']>, string> = {
  selected: 'picked',
  routed: 'rendered by the router',
  root: 'first component with signals',
};

const SOURCE_LABELS: Record<SignalChange['source'], string> = {
  write: 'set',
  sample: 'sampled',
  initial: 'initial',
};

const RESOURCE_STATUS_TONES: Record<string, string> = {
  resolved: 'ok',
  local: 'ok',
  loading: 'warn',
  reloading: 'warn',
  error: 'danger',
};

interface SourceSignal {
  name: string;
  kind: string;
  file: string;
  line: number;
  component?: string;
}

const KIND_COLORS: Record<string, string> = {
  signal: '#facc15',
  computed: '#60a5fa',
  linkedSignal: '#34d399',
  effect: '#fb923c',
  template: '#94a3b8',
  afterRenderEffectPhase: '#f472b6',
  childSignalProp: '#fef08a',
  'input (signal)': '#f59e0b',
  'input.required (signal)': '#f59e0b',
  'output (signal)': '#ec4899',
  'model (signal)': '#14b8a6',
  'model.required (signal)': '#14b8a6',
  'viewChild (signal)': '#a3e635',
  'viewChild.required (signal)': '#a3e635',
  'viewChildren (signal)': '#a3e635',
  'contentChild (signal)': '#fda4af',
  'contentChild.required (signal)': '#fda4af',
  'contentChildren (signal)': '#fda4af',
  resource: '#06b6d4',
  unknown: '#a1a1aa',
};

@Component({
  selector: 'app-signal-inspector',
  imports: [DatePipe, JsonPipe, NgTemplateOutlet, Select],
  template: `
    <div class="toolbar">
      <input
        type="text"
        placeholder="Filter by name or kind…"
        aria-label="Filter signals by name or kind"
        [value]="filter()"
        (input)="filter.set($any($event.target).value)"
      />
      @if (componentOptions().length) {
        <div class="picker">
          <span class="label-key" id="signals-component-label">Graph of</span>
          <app-select
            labelledBy="signals-component-label"
            [options]="componentOptions()"
            [value]="pickerValue()"
            (valueChange)="pickComponent($event)"
          />
        </div>
      }
    </div>

    @if (graph()?.component; as comp) {
      <p class="showing">
        <span class="showing-name">{{ comp.name }}</span>
        <span class="mono">{{ comp.path }}</span>
        @if (graph()!.source) {
          <span class="source-note">{{ sourceNote(graph()!.source!) }}</span>
        }
      </p>
    } @else if (graph()?.injector; as injector) {
      <p class="showing">
        <span class="showing-name">{{ injectorLabel(injector) }}</span>
        <span class="source-note">environment injector</span>
      </p>
    }
    @if (graph() && picked() && graph()!.source !== 'selected') {
      <p class="fallback" role="status">
        The picked component or injector is gone or has no signal graph, so this shows another one.
      </p>
    }

    <p class="intro">
      @if (graph()?.injector) {
        The effects registered on this injector and the signals they read. A signal that no effect
        reads is not part of the graph. Pick a kind to filter.
      } @else if (graph()) {
        The live signal graph of one component. Only signals that its template or an effect has read
        appear here; a signal nothing has read yet is not part of the graph. Pick a kind to filter.
      } @else {
        Every signal, computed and effect found in your source. Pick a kind to filter.
      }
    </p>
    @if (unsupported()) {
      <p class="fallback" role="status">
        The live signal graph needs Angular 20.1 or later. This list comes from a source scan.
      </p>
    }
    @if (graph()?.writeHook === false) {
      <p class="fallback" role="status">
        The signal write hook did not load. Value history shows sampled values only, with no exact
        set entries.
      </p>
    }
    @if (graph()?.nodeCount; as total) {
      <p class="fallback" role="status">
        Showing {{ graph()!.nodes.length }} of {{ total }} signals. The rest and their edges are
        left out.
      </p>
    }
    @if (kindCounts().length) {
      <div class="kinds" role="group" aria-label="Filter by kind">
        <button
          type="button"
          class="kind-chip"
          [class.active]="!kind()"
          [attr.aria-pressed]="!kind()"
          (click)="kind.set(null)"
        >
          All <span class="count">{{ kindTotal() }}</span>
        </button>
        @for (group of kindCounts(); track group.kind) {
          <button
            type="button"
            class="kind-chip"
            [class.active]="kind() === group.kind"
            [attr.aria-pressed]="kind() === group.kind"
            (click)="kind.set(kind() === group.kind ? null : group.kind)"
          >
            <span class="dot" aria-hidden="true" [style.background]="kindColor(group.kind)"></span>
            <span class="chip-text">{{ group.kind }}</span>
            <span class="count">{{ group.count }}</span>
          </button>
        }
      </div>
    }

    @if (!graph() && !sourceLoaded()) {
      <div class="empty" role="status">
        <span class="spinner" aria-hidden="true"></span>
        <p class="empty-title">Scanning source for signals…</p>
      </div>
    }

    @if (!graph() && sourceLoaded() && sourceSignals().length === 0) {
      <div class="empty">
        <p class="empty-title">No signals found.</p>
        <p class="hint">
          No <code>signal()</code>, <code>computed()</code> or <code>effect()</code> calls were
          found in your source. To see the live graph, run Angular 20.1 or later with the overlay
          connected and select a component.
        </p>
      </div>
    }

    @if (!graph() && sourceSignals().length > 0) {
      <p class="source-label">Signals from source scan (static analysis):</p>
      <div class="nodes">
        @for (sig of filteredSourceSignals(); track sig.name + sig.file + sig.line) {
          <div class="node-card">
            <div class="node-header">
              <span class="kind-badge" [style.background]="kindColor(sig.kind)">{{
                sig.kind
              }}</span>
              <span class="node-label">{{ sig.name }}</span>
            </div>
            <div class="node-meta">
              <span class="file" [title]="sig.file + ':' + sig.line"
                >{{ sig.file }}:{{ sig.line }}</span
              >
              @if (sig.component) {
                <span class="sep" aria-hidden="true">·</span>
                <span>in &lt;{{ sig.component }}&gt;</span>
              }
            </div>
          </div>
        } @empty {
          <div class="empty compact" role="status">
            <p class="empty-title">No signals match.</p>
            <p class="hint">Try a different name or kind.</p>
            <button type="button" class="reset" (click)="clearFilters()">Clear filters</button>
          </div>
        }
      </div>
    }

    <ng-template #historyTpl let-id="id" let-label="label">
      @if (selectedHistory().length) {
        <h4 [id]="'history-heading-' + id">{{ label }}</h4>
        <p class="history-summary">{{ historySummary(id) }}</p>
        <ol
          class="history scroll-box"
          tabindex="0"
          [attr.aria-labelledby]="'history-heading-' + id"
        >
          @for (change of selectedHistory(); track change.epoch) {
            <li>
              <span class="history-meta">
                <time>{{ change.at | date: 'HH:mm:ss.SSS' }}</time>
                <span class="source-tag" [class]="'source-' + change.source">{{
                  sourceLabel(change.source)
                }}</span>
                <span>epoch {{ change.epoch }}</span>
                @if (change.missed) {
                  <span class="missed">{{ change.missed }} earlier not captured</span>
                }
              </span>
              <pre>{{ change.value | json }}</pre>
            </li>
          }
        </ol>
      }
    </ng-template>

    <p class="jump-note" role="status">{{ jumpNote() }}</p>

    @if (graph() && filteredResources().length) {
      <h2 class="list-heading">Resources</h2>
      <ul class="nodes resources" role="list">
        @for (res of filteredResources(); track res.id) {
          <li>
            <button
              type="button"
              class="node-card"
              [class.selected]="selectedId() === res.id"
              [attr.aria-expanded]="selectedId() === res.id"
              [attr.aria-controls]="'signal-detail-' + res.id"
              [attr.data-card]="res.id"
              (click)="select(res.id)"
            >
              <span class="node-header">
                <span class="kind-badge" [style.background]="kindColor('resource')">resource</span>
                <span class="node-label">{{ res.name }}</span>
                @if (res.status) {
                  <span class="status-tag" [class]="'tone-' + statusTone(res.status)">{{
                    res.status
                  }}</span>
                }
                @if (res.changes; as count) {
                  <span class="changed-badge"
                    >{{ count }} {{ count === 1 ? 'change' : 'changes' }}</span
                  >
                }
                <span class="chevron" aria-hidden="true"></span>
              </span>
              @if (res.error !== undefined) {
                <span class="node-value">{{ res.error | json }}</span>
              } @else if (res.value !== undefined) {
                <span class="node-value">{{ res.value | json }}</span>
              }
            </button>
            @if (selectedId() === res.id) {
              <div class="detail-panel" [id]="'signal-detail-' + res.id">
                <h3 class="detail-title">{{ res.name }}</h3>
                @if (!res.named) {
                  <p class="hint">
                    This resource has no name. Pass <code>debugName</code> to
                    <code>resource()</code> or <code>httpResource()</code> to name it here.
                  </p>
                }
                <dl>
                  <dt>Status</dt>
                  <dd>{{ res.status ?? 'unknown' }}</dd>
                  @if (res.isLoading !== undefined) {
                    <dt>Loading</dt>
                    <dd>{{ res.isLoading ? 'yes' : 'no' }}</dd>
                  }
                  @if (res.statusCode !== undefined) {
                    <dt>HTTP status</dt>
                    <dd>{{ res.statusCode }}</dd>
                  }
                  @if (res.params !== undefined) {
                    <dt>Params</dt>
                    <dd>
                      <pre
                        class="scroll-box"
                        role="region"
                        tabindex="0"
                        [attr.aria-label]="'Params of ' + res.name"
                        >{{ res.params | json }}</pre>
                    </dd>
                  }
                  @if (res.value !== undefined) {
                    <dt>Value</dt>
                    <dd>
                      <pre
                        class="scroll-box"
                        role="region"
                        tabindex="0"
                        [attr.aria-label]="'Value of ' + res.name"
                        >{{ res.value | json }}</pre>
                    </dd>
                  }
                  @if (res.error !== undefined) {
                    <dt>Error</dt>
                    <dd>
                      <pre
                        class="scroll-box"
                        role="region"
                        tabindex="0"
                        [attr.aria-label]="'Error of ' + res.name"
                        >{{ res.error | json }}</pre>
                    </dd>
                  }
                </dl>
                <ng-container
                  [ngTemplateOutlet]="historyTpl"
                  [ngTemplateOutletContext]="{ id: res.id, label: 'Status history' }"
                />
                <button
                  type="button"
                  class="reset internals-toggle"
                  [attr.aria-expanded]="showInternals()"
                  [attr.aria-controls]="'resource-internals-' + res.id"
                  (click)="showInternals.set(!showInternals())"
                >
                  {{ showInternals() ? 'Hide' : 'Show' }} internal signals ({{
                    res.nodeIds.length
                  }})
                </button>
                @if (showInternals()) {
                  <ul [id]="'resource-internals-' + res.id">
                    @for (inner of internalsOf(res); track inner.id) {
                      <li>
                        <span class="kind-badge sm" [style.background]="kindColor(inner.kind)">{{
                          inner.kind
                        }}</span>
                        <span class="rel-label">{{ inner.label ?? inner.id }}</span>
                      </li>
                    }
                  </ul>
                }
              </div>
            }
          </li>
        }
      </ul>
    }

    @if (graph() && (visibleNodes().length || !filteredResources().length)) {
      <h2 class="list-heading">Signals</h2>
      <ul class="nodes" role="list">
        @for (node of filteredNodes(); track node.id) {
          <li>
            <button
              type="button"
              class="node-card"
              [class.selected]="selectedId() === node.id"
              [attr.aria-expanded]="selectedId() === node.id"
              [attr.aria-controls]="'signal-detail-' + node.id"
              [attr.data-card]="node.id"
              (click)="select(node.id)"
            >
              <span class="node-header">
                <span class="kind-badge" [style.background]="kindColor(node.kind)">{{
                  node.kind
                }}</span>
                <span class="node-label">{{ node.label ?? '(unnamed)' }}</span>
                @if (changeCount(node.id); as count) {
                  <span class="changed-badge"
                    >{{ count }} {{ count === 1 ? 'change' : 'changes' }}</span
                  >
                }
                <span class="chevron" aria-hidden="true"></span>
              </span>
              @if (node.value !== undefined) {
                <span class="node-value">{{ node.value | json }}</span>
              }
              <span class="node-meta">
                <span>Epoch: {{ node.epoch }}</span>
                @if (getDependencies(node).length) {
                  <span class="sep" aria-hidden="true">·</span>
                  <span>Deps: {{ getDependencies(node).length }}</span>
                }
                @if (getConsumers(node).length) {
                  <span class="sep" aria-hidden="true">·</span>
                  <span>Consumers: {{ getConsumers(node).length }}</span>
                }
              </span>
            </button>
            @if (selectedId() === node.id && selectedNode()) {
              <div class="detail-panel" [id]="'signal-detail-' + node.id">
                <h3 class="detail-title">{{ selectedNode()!.label ?? selectedNode()!.id }}</h3>
                <dl>
                  <dt>Kind</dt>
                  <dd>{{ selectedNode()!.kind }}</dd>
                  <dt>Epoch</dt>
                  <dd>{{ selectedNode()!.epoch }}</dd>
                  @if (selectedNode()!.value !== undefined) {
                    <dt>Value</dt>
                    <dd>
                      <pre
                        class="scroll-box"
                        role="region"
                        tabindex="0"
                        [attr.aria-label]="'Value of ' + (selectedNode()!.label ?? 'signal')"
                        >{{ selectedNode()!.value | json }}</pre>
                    </dd>
                  }
                </dl>
                @if (getDependencies(selectedNode()!).length) {
                  <h4>Dependencies (producers)</h4>
                  <ul>
                    @for (dep of getDependencies(selectedNode()!); track dep.id) {
                      <li>
                        <button
                          type="button"
                          class="rel-link"
                          [attr.aria-label]="'Go to ' + dep.kind + ' ' + (dep.label ?? dep.id)"
                          (click)="jumpTo(dep)"
                        >
                          <span class="kind-badge sm" [style.background]="kindColor(dep.kind)">{{
                            dep.kind
                          }}</span>
                          <span class="rel-label">{{ dep.label ?? dep.id }}</span>
                        </button>
                      </li>
                    }
                  </ul>
                }
                @if (getConsumers(selectedNode()!).length) {
                  <h4>Consumers</h4>
                  <ul>
                    @for (con of getConsumers(selectedNode()!); track con.id) {
                      <li>
                        <button
                          type="button"
                          class="rel-link"
                          [attr.aria-label]="'Go to ' + con.kind + ' ' + (con.label ?? con.id)"
                          (click)="jumpTo(con)"
                        >
                          <span class="kind-badge sm" [style.background]="kindColor(con.kind)">{{
                            con.kind
                          }}</span>
                          <span class="rel-label">{{ con.label ?? con.id }}</span>
                        </button>
                      </li>
                    }
                  </ul>
                }
                <ng-container
                  [ngTemplateOutlet]="historyTpl"
                  [ngTemplateOutletContext]="{ id: node.id, label: 'Value history' }"
                />
              </div>
            }
          </li>
        } @empty {
          <li class="empty compact">
            <p class="empty-title">
              {{ visibleNodes().length ? 'No signals match.' : 'No signals in this graph.' }}
            </p>
            <p class="hint">
              {{
                visibleNodes().length
                  ? 'Try a different name or kind.'
                  : 'Select a component that reads signals, or interact with the page to create some.'
              }}
            </p>
            @if (visibleNodes().length) {
              <button type="button" class="reset" (click)="clearFilters()">Clear filters</button>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
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
      margin: 0 0 16px;
      padding: 10px 12px;
      background: color-mix(in srgb, var(--surface) 85%, transparent);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    input {
      flex: 1 1 200px;
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
    input:hover {
      border-color: color-mix(in srgb, var(--text-3) 60%, var(--border-strong));
    }
    input:focus-visible {
      @include m.field-focus;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      text-align: center;
      padding: 40px 24px;
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
      max-width: 460px;
      margin: 0;
      color: var(--text-2);
      font-size: 13px;
      line-height: 1.55;
      overflow-wrap: anywhere;
    }
    .hint code {
      padding: 1px 5px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text);
      background: var(--surface-3);
      border: 1px solid var(--border);
      border-radius: 5px;
    }
    .reset {
      height: 34px;
      margin-top: 4px;
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
    .reset:hover {
      background: var(--surface-3);
    }
    .reset:focus-visible {
      @include m.focus-ring;
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
      .spinner {
        animation: none;
        border-top-color: var(--border-strong);
      }
    }
    .intro {
      margin: 0 0 12px;
      color: var(--text-2);
      font-size: 13px;
      line-height: 1.5;
    }
    .kinds {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 16px;
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
    .kind-chip:active {
      transform: translateY(0.5px);
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
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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
    .kind-chip.active .count {
      background: color-mix(in srgb, var(--accent) 22%, transparent);
      color: var(--text-strong);
    }
    .dot {
      flex: none;
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .node-header {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px 8px;
      min-width: 0;
    }
    .kind-badge {
      flex: none;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 10.5px;
      line-height: 18px;
      padding: 0 8px;
      border-radius: 99px;
      color: #0b0b0e;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .node-label {
      min-width: 0;
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 500;
      color: var(--text-strong);
      overflow-wrap: anywhere;
    }
    .node-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 2px 6px;
      min-width: 0;
      margin-top: 6px;
      font-size: 12px;
      color: var(--text-3);
      font-variant-numeric: tabular-nums;
    }
    .node-meta .file {
      min-width: 0;
      font-family: var(--font-mono);
      font-size: 11.5px;
      overflow-wrap: anywhere;
    }
    .sep {
      color: var(--border-strong);
    }
    dl {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 8px 16px;
      margin: 0;
      font-size: 13px;
    }
    dt {
      @include m.label;
      padding-top: 2px;
    }
    dd {
      min-width: 0;
      margin: 0;
      color: var(--text);
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }
    pre {
      font-family: var(--font-mono);
      font-size: 12.5px;
      line-height: 1.55;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      margin: 0;
      color: var(--text);
    }
    .nodes {
      display: flex;
      flex-direction: column;
      gap: 8px;
      list-style: none;
      padding: 0;
      margin: 0;
      @include m.enter;
    }
    .node-card {
      display: block;
      width: 100%;
      min-width: 0;
      text-align: left;
      font: inherit;
      color: inherit;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 12px 16px;
      transition:
        background-color 0.15s var(--ease),
        border-color 0.15s var(--ease),
        box-shadow 0.15s var(--ease);
    }
    .node-card:hover {
      background: var(--surface-2);
      border-color: var(--border-strong);
    }
    .picker {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1 1 260px;
      min-width: 0;
    }
    .picker app-select {
      flex: 1 1 auto;
      min-width: 0;
    }
    .label-key {
      flex: none;
      color: var(--text-2);
      font-size: 12px;
    }
    .showing {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px 10px;
      margin: 0 0 8px;
      font-size: 12px;
      color: var(--text-2);
    }
    .showing-name {
      color: var(--text-strong);
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 600;
    }
    .mono {
      font-family: var(--font-mono);
      overflow-wrap: anywhere;
    }
    .source-note {
      padding: 0 8px;
      border: 1px solid var(--border-strong);
      border-radius: 99px;
      line-height: 18px;
    }
    .fallback {
      margin: 0 0 8px;
      color: var(--warn);
      font-size: 12px;
    }
    .source-label {
      @include m.label;
      margin: 0 0 12px;
    }
    .nodes > li {
      display: block;
      min-width: 0;
      padding: 0;
    }
    button.node-card {
      cursor: pointer;
    }
    .node-card:focus-visible {
      @include m.focus-ring;
    }
    .node-card.selected {
      background: var(--accent-soft);
      border-color: var(--accent-line);
      box-shadow: inset 2px 0 0 var(--accent);
    }
    .chevron {
      flex: none;
      width: 7px;
      height: 7px;
      margin-left: auto;
      border-right: 1.5px solid var(--text-3);
      border-bottom: 1.5px solid var(--text-3);
      transform: translateY(-2px) rotate(45deg);
      transition:
        transform 0.2s var(--ease),
        border-color 0.15s var(--ease);
    }
    .node-card:hover .chevron {
      border-color: var(--text);
    }
    .node-card.selected .chevron {
      border-color: var(--accent);
      transform: translateY(2px) rotate(-135deg);
    }
    .node-value {
      display: block;
      margin-top: 8px;
      padding: 4px 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-2);
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
    }
    .node-card.selected .node-value {
      background: color-mix(in srgb, var(--bg) 70%, transparent);
    }
    .kind-badge.sm {
      font-size: 10px;
      line-height: 16px;
      padding: 0 6px;
    }
    .changed-badge {
      flex: none;
      font-size: 11px;
      font-weight: 500;
      line-height: 16px;
      padding: 0 8px;
      border: 1px solid;
      border-radius: 99px;
      font-variant-numeric: tabular-nums;
    }
    .changed-badge {
      @include m.soft(var(--warn));
    }
    .detail-panel {
      margin-top: 8px;
      padding: 16px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      @include m.enter(0.25s);
    }
    .detail-title {
      margin: 0 0 16px;
      font-family: var(--font-mono);
      font-size: 14px;
      font-weight: 600;
      color: var(--accent);
      overflow-wrap: anywhere;
    }
    .detail-panel h4 {
      @include m.label;
      margin: 20px 0 8px;
    }
    .detail-panel dd pre {
      max-height: 240px;
      overflow: auto;
      padding: 8px 12px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .scroll-box:focus-visible {
      @include m.focus-ring(-2px);
    }
    .list-heading {
      @include m.label;
      margin: 16px 0 8px;
    }
    .resources {
      margin-bottom: 8px;
    }
    .status-tag {
      flex: none;
      font-size: 11px;
      font-weight: 500;
      line-height: 16px;
      padding: 0 8px;
      border: 1px solid;
      border-radius: 99px;
    }
    .tone-ok {
      @include m.soft(var(--ok));
    }
    .tone-warn {
      @include m.soft(var(--warn));
    }
    .tone-danger {
      @include m.soft(var(--danger));
    }
    .tone-neutral {
      color: var(--text-2);
      border-color: var(--border-strong);
    }
    .detail-panel .hint {
      margin: 0 0 12px;
    }
    .internals-toggle {
      margin-top: 16px;
    }
    .detail-panel .internals-toggle + ul {
      margin-top: 8px;
    }
    .detail-panel ul {
      display: flex;
      flex-direction: column;
      gap: 2px;
      list-style: none;
      padding: 0;
      margin: 0;
      font-size: 13px;
    }
    .detail-panel ul li,
    .rel-link {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      min-height: 28px;
      padding: 4px 8px;
      color: var(--text-2);
      border-radius: 6px;
    }
    .detail-panel ul li:has(> .rel-link) {
      padding: 0;
    }
    .rel-link {
      width: 100%;
      font: inherit;
      text-align: left;
      background: none;
      border: 0;
      cursor: pointer;
      transition:
        background-color 0.15s var(--ease),
        color 0.15s var(--ease);
    }
    .rel-link:hover {
      background: var(--surface-2);
      color: var(--text);
    }
    .rel-link:focus-visible {
      @include m.focus-ring;
    }
    .jump-note {
      margin: 0;
      font-size: 12px;
      color: var(--text-2);
    }
    .jump-note:not(:empty) {
      margin-bottom: 8px;
    }
    .rel-label {
      min-width: 0;
      font-family: var(--font-mono);
      font-size: 12.5px;
      overflow-wrap: anywhere;
    }
    .history-summary {
      margin: 0 0 8px;
      font-size: 12px;
      color: var(--text-2);
      font-variant-numeric: tabular-nums;
    }
    .history {
      list-style: none;
      padding: 4px;
      margin: 0;
      max-height: 320px;
      overflow: auto;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .history li {
      display: block;
      padding: 8px;
      border-radius: 6px;
      transition: background-color 0.15s var(--ease);
    }
    .history li + li {
      border-top: 1px solid var(--border);
    }
    .history li:hover {
      background: var(--surface-3);
    }
    .history-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      align-items: center;
      margin-bottom: 4px;
      font-size: 11px;
      color: var(--text-2);
      font-variant-numeric: tabular-nums;
    }
    .history-meta time {
      font-family: var(--font-mono);
      color: var(--text);
    }
    .source-tag {
      line-height: 16px;
      padding: 0 8px;
      border-radius: 99px;
      background: var(--surface-3);
      border: 1px solid var(--border-strong);
      color: var(--text);
    }
    .source-write {
      color: #93c5fd;
      background: color-mix(in srgb, #60a5fa 12%, transparent);
      border-color: color-mix(in srgb, #60a5fa 30%, transparent);

      @include m.light {
        @include m.soft(#1d4ed8);
      }
    }
    .missed {
      color: var(--warn);
    }
    @media (max-width: 480px) {
      .toolbar {
        padding: 8px;
      }
      .toolbar input,
      .picker {
        flex-basis: 100%;
      }
      .node-card,
      .detail-panel {
        padding: 12px;
      }
      dl {
        grid-template-columns: minmax(0, 1fr);
        gap: 4px;
      }
      dd + dt {
        margin-top: 8px;
      }
    }
  `,
})
export class SignalInspector {
  rpc = input<DevframeRpcClient | null>(null);

  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly pageId = hostPageId();
  private readonly cleanups: (() => void)[] = [];
  private readonly treePages = signal<Record<string, { roots?: LiveNode[]; reportedAt?: number }>>(
    {},
  );
  readonly picked = signal<string | null>(null);

  graph = signal<SignalGraph | null>(null);
  readonly unsupported = signal(false);
  readonly showInternals = signal(false);
  sourceSignals = signal<SourceSignal[]>([]);
  sourceLoaded = signal(false);
  filter = signal('');
  kind = signal<string | null>(null);
  readonly resources = computed(() => this.graph()?.resources ?? []);
  private readonly internalIds = computed(
    () => new Set(this.resources().flatMap((r) => r.nodeIds)),
  );
  readonly visibleNodes = computed(() => {
    const internal = this.internalIds();
    return (this.graph()?.nodes ?? []).filter((n) => !internal.has(n.id));
  });
  kindCounts = computed(() => {
    const kinds: string[] = this.graph()
      ? [...this.visibleNodes().map((n) => n.kind), ...this.resources().map(() => 'resource')]
      : this.sourceSignals().map((s) => s.kind);
    const counts = new Map<string, number>();
    for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
    return [...counts].map(([kind, count]) => ({ kind, count }));
  });
  kindTotal = computed(() => this.kindCounts().reduce((sum, g) => sum + g.count, 0));
  selectedId = signal<string | null>(null);
  selectedNode = computed(
    () => this.graph()?.nodes.find((n) => n.id === this.selectedId()) ?? null,
  );
  private readonly jumpedPast = signal<{ id: string; label: string } | null>(null);
  readonly jumpNote = computed(() => {
    const jumped = this.jumpedPast();
    if (!jumped || this.filter() || this.kind() || this.selectedId() !== jumped.id) return '';
    return `Cleared the filters to show ${jumped.label}.`;
  });
  selectedHistory = computed(() => {
    const id = this.selectedId();
    return id ? [...(this.graph()?.history?.[id] ?? [])].reverse() : [];
  });

  readonly kindLegend = Object.entries(KIND_COLORS).map(([kind, color]) => ({ kind, color }));

  filteredResources = computed(() => {
    const q = this.filter().toLowerCase();
    const kind = this.kind();
    if (kind && kind !== 'resource') return [];
    return this.resources().filter(
      (r) => !q || r.name.toLowerCase().includes(q) || 'resource'.includes(q),
    );
  });

  filteredNodes = computed(() => {
    const q = this.filter().toLowerCase();
    const kind = this.kind();
    const nodes = this.visibleNodes().filter(
      (n) =>
        (!kind || n.kind === kind) &&
        (!q || (n.label ?? '').toLowerCase().includes(q) || n.kind.toLowerCase().includes(q)),
    );
    // Angular orders nodes by last read order, which changes between polls; ids are stable.
    return nodes.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  });

  filteredSourceSignals = computed(() => {
    const q = this.filter().toLowerCase();
    const kind = this.kind();
    return this.sourceSignals().filter(
      (s) =>
        (!kind || s.kind === kind) &&
        (!q ||
          s.name.toLowerCase().includes(q) ||
          s.kind.toLowerCase().includes(q) ||
          s.file.toLowerCase().includes(q)),
    );
  });

  private readonly targetPageId = computed(
    () => this.pageId ?? this.graph()?.pageId ?? this.latestTreePage()?.pageId ?? null,
  );

  private readonly latestTreePage = computed(() => {
    let latest: { pageId: string; reportedAt: number } | null = null;
    for (const [pageId, page] of Object.entries(this.treePages())) {
      const at = page.reportedAt ?? 0;
      if (!latest || at > latest.reportedAt) latest = { pageId, reportedAt: at };
    }
    return latest;
  });

  readonly componentOptions = computed<SelectOption[]>(() => {
    const pageId = this.targetPageId();
    const roots = (pageId ? this.treePages()[pageId]?.roots : undefined) ?? [];
    const flat: LiveNode[] = [];
    const walk = (nodes: LiveNode[]) => {
      for (const node of nodes) {
        flat.push(node);
        walk(node.children);
      }
    };
    walk(roots);
    const environments = this.graph()?.environments ?? [];
    if (!flat.length && !environments.length) return [];
    const totals = new Map<string, number>();
    for (const node of flat) totals.set(node.name, (totals.get(node.name) ?? 0) + 1);
    const seen = new Map<string, number>();
    const options: SelectOption[] = [
      { value: FOLLOW, label: 'Follow the routed component', hint: 'automatic' },
      ...environments.map((env) => ({
        value: ENV + env.id,
        label: this.injectorLabel(env),
        hint: 'injector',
      })),
    ];
    for (const node of flat) {
      const n = (seen.get(node.name) ?? 0) + 1;
      seen.set(node.name, n);
      options.push({
        value: node.id,
        label: (totals.get(node.name) ?? 0) > 1 ? `${node.name} #${n}` : node.name,
        hint: `<${node.tag}>`,
      });
    }
    return options;
  });

  readonly pickerValue = computed(() => {
    const picked = this.picked();
    return picked && this.componentOptions().some((o) => o.value === picked) ? picked : FOLLOW;
  });

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (!client) return;
      void this.loadSignalGraph(client);
      void this.loadSourceSignals(client);
    });
    this.destroyRef.onDestroy(() => {
      for (const cleanup of this.cleanups.splice(0)) cleanup();
    });
  }

  async loadSignalGraph(client: DevframeRpcClient) {
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    const my = client.scope('pangular');
    try {
      const state = await my.rpc.sharedState('signal-graph');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) => {
        const next = value as { graph?: SignalGraph | null; pages?: Record<string, SignalGraph> };
        const reported = (this.pageId ? next?.pages?.[this.pageId] : next?.graph) ?? null;
        this.unsupported.set(!!reported?.unsupported);
        const graph = reported?.unsupported ? null : reported;
        const owner = (g: SignalGraph | null) => g?.component?.id ?? g?.injector?.id;
        if (owner(graph) !== owner(this.graph())) this.selectedId.set(null);
        this.graph.set(graph);
      };
      apply(state.value());
      this.cleanups.push(state.on('updated', apply));
    } catch {
      this.graph.set(null);
    }
    try {
      const tree = await my.rpc.sharedState('component-tree');
      if (this.destroyRef.destroyed) return;
      const applyTree = (value: unknown) => {
        const pages = (value as { pages?: Record<string, { roots?: LiveNode[] }> } | null)?.pages;
        this.treePages.set(pages && typeof pages === 'object' ? pages : {});
      };
      applyTree(tree.value());
      this.cleanups.push(tree.on('updated', applyTree));
    } catch {
      this.treePages.set({});
    }
  }

  pickComponent(value: string | null) {
    const picked = value && value !== FOLLOW ? value : null;
    this.picked.set(picked);
    const client = this.rpc();
    if (!client) return;
    const pageId = this.targetPageId() ?? undefined;
    const target = picked?.startsWith(ENV)
      ? { pageId, env: picked.slice(ENV.length) }
      : { pageId, id: picked };
    void client
      .scope('pangular')
      .rpc.call('select-signal-target', target)
      .catch(() => {});
  }

  injectorLabel(injector: GraphInjector) {
    return injector.name === 'Root' ? 'Root services' : injector.name;
  }

  sourceNote(source: NonNullable<SignalGraph['source']>) {
    return SOURCE_NOTES[source];
  }

  async loadSourceSignals(client: DevframeRpcClient) {
    const my = client.scope('pangular');
    try {
      const result = (await my.rpc.call('get-signals')) as SourceSignal[];
      this.sourceSignals.set(result);
    } catch {
      // RPC not available
    } finally {
      this.sourceLoaded.set(true);
    }
  }

  clearFilters() {
    this.filter.set('');
    this.kind.set(null);
  }

  select(id: string) {
    this.selectedId.set(this.selectedId() === id ? null : id);
    this.showInternals.set(false);
  }

  jumpTo(node: SignalNode) {
    const resource = this.resources().find((r) => r.nodeIds.includes(node.id));
    const id = resource?.id ?? node.id;
    const hidden = resource
      ? !this.filteredResources().some((r) => r.id === id)
      : !this.filteredNodes().some((n) => n.id === id);
    if (hidden) this.clearFilters();
    this.jumpedPast.set(hidden ? { id, label: resource?.name ?? node.label ?? node.id } : null);
    this.selectedId.set(id);
    this.showInternals.set(!!resource);
    afterNextRender(
      () => {
        const card = [
          ...this.host.nativeElement.querySelectorAll<HTMLElement>('.node-card[data-card]'),
        ].find((el) => el.dataset['card'] === id);
        card?.scrollIntoView?.({ block: 'nearest' });
        card?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  // The page counts past the kept history; older pages only send the list.
  changeCount(id: string): number {
    const g = this.graph();
    const counted =
      g?.nodes.find((n) => n.id === id)?.changes ?? g?.resources?.find((r) => r.id === id)?.changes;
    if (counted !== undefined) return counted;
    const list = g?.history?.[id] ?? [];
    return list.reduce((n, c) => n + (c.source === 'initial' ? 0 : 1 + (c.missed ?? 0)), 0);
  }

  historySummary(id: string): string {
    const count = this.changeCount(id);
    const kept = this.graph()?.history?.[id]?.length ?? 0;
    if (!count) return 'No changes recorded yet. The entry below is the value seen first.';
    const changes = `${count} ${count === 1 ? 'change' : 'changes'} recorded`;
    const shown = kept >= MAX_HISTORY && count >= kept ? `, showing the last ${kept}` : '';
    return `${changes}${shown}, newest first.`;
  }

  statusTone(status: string) {
    return RESOURCE_STATUS_TONES[status] ?? 'neutral';
  }

  internalsOf(resource: SignalResource): SignalNode[] {
    const ids = new Set(resource.nodeIds);
    return (this.graph()?.nodes ?? []).filter((n) => ids.has(n.id));
  }

  sourceLabel(source: SignalChange['source']) {
    return SOURCE_LABELS[source];
  }

  kindColor(kind: string) {
    return KIND_COLORS[kind] ?? KIND_COLORS['unknown'];
  }

  getDependencies(node: SignalNode): SignalNode[] {
    const g = this.graph();
    if (!g) return [];
    const idx = g.nodes.findIndex((n) => n.id === node.id);
    return g.edges
      .filter((e) => e.consumer === idx)
      .map((e) => g.nodes[e.producer])
      .filter(Boolean);
  }

  getConsumers(node: SignalNode): SignalNode[] {
    const g = this.graph();
    if (!g) return [];
    const idx = g.nodes.findIndex((n) => n.id === node.id);
    return g.edges
      .filter((e) => e.producer === idx)
      .map((e) => g.nodes[e.consumer])
      .filter(Boolean);
  }
}
