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
  viewChild,
} from '@angular/core';
import { DatePipe, JsonPipe, NgTemplateOutlet } from '@angular/common';
import type { DevframeRpcClient } from 'devframe/client';
import { pickPage, type ReportedPage } from '../live-pages';
import { actionAllowed, actionBlockedMessage } from '../devtools-config';
import { isNativePage } from '../native-page';
import { isStaticReport } from '../rpc';
import { hostPageId } from '../page-id';
import { angularPageFor, injectAngularPages } from '../angular-pages';
import { AngularUnavailable } from '../ui/angular-unavailable';
import { RovingList } from '../ui/roving-list';
import { Select, type SelectOption } from '../ui/select';
import { SourceLink } from '../ui/source-link';
import type { GraphLink } from './signal-graph-layout';
import { SignalGraphView } from './signal-graph-view';

interface SignalNode {
  id: string;
  kind: string;
  label?: string;
  epoch: number;
  value?: unknown;
  changes?: number;
  /** Created by Angular's own code, hidden unless the user shows framework signals. */
  framework?: boolean;
  /** The component field that holds this writable signal, so history entries can be restored. */
  locator?: { id: string; key: string };
}

interface RestoreResult {
  ok?: boolean;
  key?: string;
  error?: string;
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
  /** First app frames of the code that set it, while write stacks are on. */
  stack?: string[];
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
  watch?: { ids: string[]; stacks: boolean };
}

interface LiveNode {
  id: string;
  name: string;
  tag: string;
  /** `directive` for an element that hosts directives but no component. */
  kind?: 'directive';
  children: LiveNode[];
}

const FOLLOW = 'follow';

// Older servers send only the newest graph, without the per-page map.
function graphPagesOf(state: {
  graph?: SignalGraph | null;
  pages: Record<string, SignalGraph>;
}): Record<string, SignalGraph> {
  if (Object.keys(state.pages).length) return state.pages;
  return state.graph ? { [state.graph.pageId ?? '']: state.graph } : {};
}
const ENV = 'env:';
const MAX_HISTORY = 50;
/** Kinds with a value, so the page can watch them. */
const WATCHABLE = new Set(['signal', 'computed', 'linkedSignal']);
/** Changes of watched signals the panel lists. */
const WATCH_LOG = 20;

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
  imports: [
    AngularUnavailable,
    DatePipe,
    JsonPipe,
    NgTemplateOutlet,
    RovingList,
    Select,
    SignalGraphView,
    SourceLink,
  ],
  template: `
    <div class="toolbar">
      <input
        #filterInput
        type="search"
        placeholder="Filter by name or kind…"
        aria-label="Filter signals by name or kind"
        [value]="filter()"
        (input)="filter.set($any($event.target).value)"
        (keydown.escape)="filter.set('')"
      />
      @if (pageOptions().length > 1) {
        <div class="picker page-picker">
          <span class="label-key" id="signals-page-label">Page</span>
          <app-select
            labelledBy="signals-page-label"
            [options]="pageOptions()"
            [value]="shownPageId()"
            (valueChange)="selectPage($event)"
          />
        </div>
      }
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
    <p class="sr-only" role="status">{{ announcement() }}</p>

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
      } @else if (!graphKnown()) {
        Loading the live signal graph…
      } @else {
        Every signal, computed and effect found in your source. Pick a kind to filter.
      }
    </p>
    @if (!graph()) {
      <app-angular-unavailable
        [page]="angularPage()"
        capability="signalGraph"
        [missing]="unsupported()"
        compact
      >
        This list comes from a source scan.
      </app-angular-unavailable>
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
    @if (kindChips().length) {
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
        @for (group of kindChips(); track group.kind) {
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

    @if (!graph() && sourceLoaded() && loadFailed()) {
      <div class="empty" [class.compact]="sourceSignals().length > 0" role="alert">
        <p class="empty-title">Couldn't load signals</p>
        <p class="hint">
          The devtools server did not answer. Check that it is still running, then retry.
        </p>
        <button
          type="button"
          class="reset"
          [attr.aria-disabled]="retrying() || null"
          (click)="retry()"
        >
          {{ retrying() ? 'Retrying…' : 'Retry' }}
        </button>
      </div>
    } @else if (!graph() && sourceLoaded() && sourceSignals().length === 0) {
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
              <app-source-link class="file" [file]="sig.file" [line]="sig.line" />
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
        @let restoreNode = restorable(id);
        @if (restoreNode) {
          @if (restoreBlocked(); as reason) {
            <p class="hint">Restore is off. {{ reason }}</p>
          }
          <p
            class="restore-result"
            role="status"
            [class.has-text]="restoreResult()?.id === id"
            [class.restore-error]="restoreResult()?.id === id && restoreResult()?.error"
          >
            {{ restoreResult()?.id === id ? restoreResult()?.text : '' }}
          </p>
        }
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
                @if (restoreNode && !restoreBlocked() && !$first) {
                  @let time = change.at | date: 'HH:mm:ss.SSS';
                  <button
                    type="button"
                    class="restore"
                    [attr.aria-label]="'Restore value from ' + time"
                    [attr.aria-disabled]="restoring() || null"
                    (click)="restore(restoreNode, change, time ?? '')"
                  >
                    Restore
                  </button>
                }
              </span>
              <pre>{{ change.value | json }}</pre>
              @if (change.stack?.length) {
                <ol class="stack" aria-label="Written from">
                  @for (frame of change.stack; track $index) {
                    <li>{{ frame }}</li>
                  }
                </ol>
              }
            </li>
          }
        </ol>
      }
    </ng-template>

    @if (graph() && (visibleNodes().length || frameworkCount())) {
      <section class="graph-section" aria-labelledby="signal-graph-heading">
        <div class="section-head">
          <h2 id="signal-graph-heading" class="list-heading">Graph</h2>
          <div class="section-actions">
            @if (frameworkCount(); as hidden) {
              <button
                type="button"
                class="toggle"
                [attr.aria-pressed]="showFramework()"
                (click)="showFramework.set(!showFramework())"
              >
                Show framework signals
                <span class="count">{{ hidden }} {{ showFramework() ? 'shown' : 'hidden' }}</span>
              </button>
            }
            <button
              type="button"
              class="toggle"
              [attr.aria-pressed]="stacksOn()"
              (click)="toggleStacks()"
            >
              Record write stacks
            </button>
            <button
              type="button"
              class="toggle"
              aria-controls="signal-graph-body"
              [attr.aria-expanded]="showGraph()"
              (click)="showGraph.set(!showGraph())"
            >
              {{ showGraph() ? 'Hide graph' : 'Show graph' }}
            </button>
          </div>
        </div>
        @if (stacksOn()) {
          <p class="hint graph-hint">
            Write stacks are on for this page. Each set of a named signal keeps the first 3 app
            frames of the code that wrote it, shown in its value history. Taking a stack slows every
            write, so turn it off when you are done.
          </p>
        }
        @if (showGraph()) {
          <div id="signal-graph-body">
            @if (graphNodes().length) {
              <app-signal-graph-view
                [nodes]="graphNodes()"
                [links]="graphLinks()"
                [selectedId]="selectedId()"
                [watched]="watchedIds()"
                [kindColor]="kindColorOf"
                (selected)="selectFromGraph($event)"
              />
            } @else {
              <p class="hint graph-hint">
                Every signal in this graph was created by Angular. Show framework signals to see
                them.
              </p>
            }
            @if (selectedNode(); as node) {
              <p class="graph-selection">
                <span>Selected</span>
                <span class="rel-label">{{ node.label ?? '(unnamed)' }}</span>
                <span class="sep" aria-hidden="true">·</span>
                <span>{{ plural(getDependencies(node).length, 'producer') }}</span>
                <span class="sep" aria-hidden="true">·</span>
                <span>{{ plural(getConsumers(node).length, 'consumer') }}</span>
                <button type="button" class="link-button" (click)="jumpTo(node)">
                  Show details
                </button>
              </p>
            }
          </div>
        }
      </section>
    }

    @if (watchedNodes().length || watchedElsewhere()) {
      <section class="watched" aria-labelledby="signal-watched-heading">
        <h2 id="signal-watched-heading" class="list-heading">Watched</h2>
        @if (watchedElsewhere(); as other) {
          <p class="hint">
            {{ other }} watched {{ other === 1 ? 'signal is' : 'signals are' }} not in this graph.
            Their changes still log to the page console.
          </p>
        }
        <ul class="watched-list">
          @for (node of watchedNodes(); track node.id) {
            <li>
              <span class="rel-label">{{ node.label ?? '(unnamed)' }}</span>
              @if (node.value !== undefined) {
                <span class="watched-value">{{ node.value | json }}</span>
              }
              @if (changeCount(node.id); as count) {
                <span class="changed-badge"
                  >{{ count }} {{ count === 1 ? 'change' : 'changes' }}</span
                >
              }
              <button
                type="button"
                class="link-button"
                [attr.aria-label]="'Stop watching ' + (node.label ?? 'the unnamed signal')"
                (click)="toggleWatch(node)"
              >
                Stop watching
              </button>
            </li>
          }
        </ul>
        @if (watchLog().length) {
          <h3 class="sub-heading" id="signal-watch-log-heading">Recent changes</h3>
          <div
            class="watch-log scroll-box"
            role="log"
            tabindex="0"
            aria-labelledby="signal-watch-log-heading"
          >
            <ol class="history">
              @for (entry of watchLog(); track entry.id + ':' + entry.change.epoch) {
                <li>
                  <span class="history-meta">
                    <time>{{ entry.change.at | date: 'HH:mm:ss.SSS' }}</time>
                    <span class="rel-label">{{ entry.label }}</span>
                    <span class="source-tag" [class]="'source-' + entry.change.source">{{
                      sourceLabel(entry.change.source)
                    }}</span>
                  </span>
                  <pre>{{ entry.change.value | json }}</pre>
                  @if (entry.change.stack?.length) {
                    <ol class="stack" aria-label="Written from">
                      @for (frame of entry.change.stack; track $index) {
                        <li>{{ frame }}</li>
                      }
                    </ol>
                  }
                </li>
              }
            </ol>
          </div>
        }
      </section>
    }

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
      <ul class="nodes" role="list" appRovingList="button.node-card">
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
                @if (watchedIds().has(node.id)) {
                  <span class="watching-badge">watching</span>
                }
                @if (node.framework) {
                  <span class="framework-badge">framework</span>
                }
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
                @if (isWatchable(selectedNode()!)) {
                  <button
                    type="button"
                    class="reset watch-toggle"
                    [attr.aria-pressed]="watchedIds().has(selectedNode()!.id)"
                    (click)="toggleWatch(selectedNode()!)"
                  >
                    Watch
                  </button>
                  <p class="hint">
                    A watched signal is listed under Watched and logs each change to the page
                    console.
                  </p>
                }
                @if (writeHint(); as hint) {
                  <p class="hint">{{ hint }}</p>
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
              {{ hasAnySignals() ? 'No signals match.' : 'No signals in this graph.' }}
            </p>
            <p class="hint">
              {{
                hasAnySignals()
                  ? 'Try a different name or kind.'
                  : 'Select a component that reads signals, or interact with the page to create some.'
              }}
            </p>
            @if (hasAnySignals()) {
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
    .page-picker {
      flex: 0 1 240px;
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
      @include m.tint(warn);
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
      @include m.tint(ok);
    }
    .tone-warn {
      @include m.tint(warn);
    }
    .tone-danger {
      @include m.tint(danger);
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
    .restore {
      margin-left: auto;
      height: 22px;
      padding: 0 8px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition:
        background-color 150ms var(--ease),
        border-color 150ms var(--ease);
    }
    .restore:hover:not([aria-disabled='true']) {
      background: var(--surface-3);
      border-color: var(--accent-line);
    }
    .restore[aria-disabled='true'] {
      opacity: 0.6;
      cursor: progress;
    }
    .restore:focus-visible {
      @include m.focus-ring(-2px);
    }
    .restore-result {
      margin: 0;
      font-size: 12px;
      color: var(--text-2);
    }
    .restore-result.has-text {
      margin-bottom: 8px;
    }
    .restore-result.restore-error {
      color: var(--danger-text);
    }
    @media (prefers-reduced-motion: reduce) {
      .restore {
        transition: none;
      }
    }
    .graph-section,
    .watched {
      margin-bottom: 16px;
    }
    .section-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px 12px;
      margin: 16px 0 8px;
    }
    .section-head .list-heading {
      margin: 0;
    }
    .section-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: var(--control-h);
      padding: 0 12px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      font-size: 12.5px;
      font-weight: 500;
      cursor: pointer;
      transition:
        background-color 0.15s var(--ease),
        border-color 0.15s var(--ease);
    }
    .toggle:hover {
      background: var(--surface-3);
    }
    .toggle[aria-pressed='true'] {
      border-color: var(--accent-line);
      background: var(--accent-soft);
      color: var(--text-strong);
    }
    .toggle:focus-visible {
      @include m.focus-ring;
    }
    .toggle .count {
      padding: 0 6px;
      border-radius: 99px;
      background: var(--surface-3);
      color: var(--text-2);
      font-size: 11px;
      line-height: 16px;
      font-variant-numeric: tabular-nums;
    }
    .graph-hint {
      margin: 0 0 8px;
      max-width: none;
    }
    .graph-selection {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
      margin: 8px 0 0;
      font-size: 12px;
      color: var(--text-2);
    }
    .link-button {
      min-height: 28px;
      padding: 0 8px;
      border: 0;
      border-radius: 6px;
      background: none;
      color: var(--accent-text);
      font: inherit;
      font-size: 12px;
      font-weight: 500;
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }
    .link-button:hover {
      background: var(--surface-2);
    }
    .link-button:focus-visible {
      @include m.focus-ring;
    }
    .watched-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 0 0 8px;
      padding: 0;
      list-style: none;
    }
    .watched-list li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
      min-width: 0;
      padding: 6px 10px;
      background: var(--surface);
      border: 1px solid var(--accent-line);
      border-radius: var(--radius-sm);
    }
    .watched-value {
      @include m.truncate;
      flex: 1 1 120px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-2);
    }
    .sub-heading {
      @include m.label;
      margin: 12px 0 8px;
    }
    .watch-log {
      max-height: 320px;
      overflow: auto;
      border-radius: var(--radius-sm);
    }
    .watch-log .history {
      max-height: none;
      overflow: visible;
    }
    .stack {
      margin: 6px 0 0;
      padding: 0 0 0 18px;
      font-family: var(--font-mono);
      font-size: 11.5px;
      color: var(--text-2);
      overflow-wrap: anywhere;
    }
    .history li .stack li {
      padding: 0;
      border: 0;
    }
    .watching-badge,
    .framework-badge {
      flex: none;
      font-size: 11px;
      font-weight: 500;
      line-height: 16px;
      padding: 0 8px;
      border: 1px solid;
      border-radius: 99px;
    }
    .watching-badge {
      @include m.tint(accent);
    }
    .framework-badge {
      color: var(--text-2);
      border-color: var(--border-strong);
    }
    .watch-toggle {
      margin: 16px 0 8px;
    }
    .watch-toggle[aria-pressed='true'] {
      border-color: var(--accent-line);
      background: var(--accent-soft);
      color: var(--text-strong);
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
  private readonly filterInput = viewChild<ElementRef<HTMLInputElement>>('filterInput');
  private readonly injector = inject(Injector);
  private readonly pageId = hostPageId();
  private readonly angularPages = injectAngularPages(() => this.rpc());
  /** The shown page's Angular version and debug API parts, for the unavailable note. */
  readonly angularPage = computed(() =>
    angularPageFor(this.angularPages(), this.shownPageId() ?? this.pageId),
  );
  private readonly cleanups: (() => void)[] = [];
  /** Counts graph loads, so only the newest one applies its result. */
  private graphLoad = 0;
  private readonly treePages = signal<
    Record<
      string,
      { roots?: LiveNode[]; reportedAt?: number; title?: string; url?: string; platform?: string }
    >
  >({});
  private readonly graphState = signal<{
    graph: SignalGraph | null;
    pages: Record<string, SignalGraph>;
  }>({ graph: null, pages: {} });
  readonly chosenPageId = signal<string | null>(null);
  readonly announcement = signal('');

  private readonly graphPages = computed(() => graphPagesOf(this.graphState()));

  // The newest graph comes as `graph`; a page that reports later never takes over.
  readonly shownPageId = linkedSignal<
    { pages: Record<string, SignalGraph>; newest: string | null; chosen: string | null },
    string | null
  >({
    source: () => ({
      pages: this.graphPages(),
      newest: this.graphState().graph?.pageId ?? null,
      chosen: this.chosenPageId(),
    }),
    computation: ({ pages, newest, chosen }, previous) => {
      const reported: Record<string, ReportedPage> = {};
      for (const pageId of Object.keys(pages)) {
        reported[pageId] = { pageId, reportedAt: pageId === newest ? 1 : 0 };
      }
      return pickPage(reported, { chosen, host: this.pageId, previous: previous?.value ?? null });
    },
  });

  private readonly reported = computed<SignalGraph | null>(() => {
    const pageId = this.shownPageId();
    return pageId === null ? null : (this.graphPages()[pageId] ?? null);
  });
  readonly unsupported = computed(() => !!this.reported()?.unsupported);
  /** Whether the live graph state arrived, so the intro doesn't call it a source scan first. */
  protected readonly graphKnown = signal(false);
  readonly graph = computed<SignalGraph | null>(() => {
    const reported = this.reported();
    return reported?.unsupported ? null : reported;
  });
  private readonly graphOwner = computed(() => {
    const g = this.graph();
    return g ? `${g.pageId ?? ''}|${g.component?.id ?? g.injector?.id ?? ''}` : null;
  });

  // Component and injector ids belong to one page, so each page keeps its own pick.
  private readonly pickedByPage = signal<Record<string, string>>({});
  readonly picked = computed(() => this.pickedByPage()[this.targetPageId() ?? ''] ?? null);

  readonly pageOptions = computed<SelectOption[]>(() => {
    if (this.pageId) return [];
    const tree = this.treePages();
    return Object.keys(this.graphPages()).map((pageId) => {
      const page = tree[pageId];
      return {
        value: pageId,
        label: page?.title || page?.url || `Page ${pageId}`,
        hint: page?.url,
      };
    });
  });

  readonly showInternals = signal(false);
  sourceSignals = signal<SourceSignal[]>([]);
  sourceLoaded = signal(false);
  /** The source scan or the live graph state could not be read from the server. */
  private readonly sourceFailed = signal(false);
  private readonly graphFailed = signal(false);
  readonly loadFailed = computed(() => this.sourceFailed() || this.graphFailed());
  readonly retrying = signal(false);
  filter = signal('');
  readonly resources = computed(() => this.graph()?.resources ?? []);
  private readonly internalIds = computed(
    () => new Set(this.resources().flatMap((r) => r.nodeIds)),
  );
  /** Shows the nodes Angular itself created, which are hidden by default. */
  readonly showFramework = signal(false);
  readonly frameworkCount = computed(() => {
    const internal = this.internalIds();
    return (this.graph()?.nodes ?? []).filter((n) => n.framework && !internal.has(n.id)).length;
  });
  readonly visibleNodes = computed(() => {
    const internal = this.internalIds();
    const framework = this.showFramework();
    return (this.graph()?.nodes ?? []).filter(
      (n) => !internal.has(n.id) && (framework || !n.framework),
    );
  });
  readonly showGraph = signal(true);
  /** Links between the nodes the page shows, by node id. */
  readonly graphLinks = computed<GraphLink[]>(() => {
    const g = this.graph();
    if (!g) return [];
    const shown = new Set(this.visibleNodes().map((n) => n.id));
    const links: GraphLink[] = [];
    for (const edge of g.edges) {
      const producer = g.nodes[edge.producer]?.id;
      const consumer = g.nodes[edge.consumer]?.id;
      if (producer && consumer && shown.has(producer) && shown.has(consumer)) {
        links.push({ producer, consumer });
      }
    }
    return links;
  });
  readonly graphNodes = computed(() =>
    [...this.visibleNodes()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
  );
  readonly kindColorOf = (kind: string) => this.kindColor(kind);

  readonly watchedIds = computed(() => new Set(this.graph()?.watch?.ids ?? []));
  readonly stacksOn = computed(() => !!this.graph()?.watch?.stacks);
  readonly watchedNodes = computed(() => {
    const ids = this.watchedIds();
    return (this.graph()?.nodes ?? []).filter((n) => ids.has(n.id));
  });
  /** Watched ids the page reports that are not in the graph shown now. */
  readonly watchedElsewhere = computed(() => this.watchedIds().size - this.watchedNodes().length);
  /** The newest changes of every watched signal in this graph, newest first. */
  readonly watchLog = computed(() => {
    const history = this.graph()?.history ?? {};
    const entries = this.watchedNodes().flatMap((node) =>
      (history[node.id] ?? [])
        .filter((change) => change.source !== 'initial')
        .map((change) => ({ id: node.id, label: node.label ?? node.id, change })),
    );
    return entries.sort((a, b) => b.change.at - a.change.at).slice(0, WATCH_LOG);
  });
  readonly hasAnySignals = computed(() => this.visibleNodes().length + this.resources().length > 0);
  kindCounts = computed(() => {
    const kinds: string[] = this.graph()
      ? [...this.visibleNodes().map((n) => n.kind), ...this.resources().map(() => 'resource')]
      : this.sourceSignals().map((s) => s.kind);
    const counts = new Map<string, number>();
    for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
    return [...counts].map(([kind, count]) => ({ kind, count }));
  });
  // A kind picked on another graph stays only when this graph has it too.
  kind = linkedSignal<string | null, string | null>({
    source: this.graphOwner,
    computation: (_owner, previous) => {
      const kind = previous?.value ?? null;
      return kind && untracked(this.kindCounts).some((g) => g.kind === kind) ? kind : null;
    },
  });
  // An active kind with no matches still gets a pressed chip, so the filter stays visible.
  kindChips = computed(() => {
    const counts = this.kindCounts();
    const kind = this.kind();
    return kind && !counts.some((g) => g.kind === kind) ? [...counts, { kind, count: 0 }] : counts;
  });
  kindTotal = computed(() => this.kindCounts().reduce((sum, g) => sum + g.count, 0));
  selectedId = linkedSignal<string | null, string | null>({
    source: this.graphOwner,
    computation: () => null,
  });
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

  /**
   * Why history entries cannot be restored on the shown page, or '' when they
   * can: the same gate as component edits (a live browser page with
   * `actions.components` on).
   */
  readonly restoreBlocked = computed(() => {
    const client = this.rpc();
    if (isStaticReport(client)) return 'A saved report cannot write to the app.';
    const pageId = this.graph()?.pageId;
    if (isNativePage(pageId ? this.treePages()[pageId] : null)) {
      return 'It needs the app open in a browser.';
    }
    if (!actionAllowed(client, 'components')) return actionBlockedMessage('components');
    return '';
  });
  readonly restoring = signal(false);
  readonly restoreResult = signal<{ id: string; text: string; error: boolean } | null>(null);

  /** The node with this id when its history can be restored: a writable field of the shown component. */
  restorable(id: string): SignalNode | null {
    const g = this.graph();
    const node = g?.nodes.find((n) => n.id === id);
    return node?.locator && g?.component && node.locator.id === g.component.id ? node : null;
  }

  /** Writes the value the page kept for this entry back to the signal. */
  async restore(node: SignalNode, change: SignalChange, time: string) {
    const client = this.rpc();
    const pageId = this.graph()?.pageId;
    const locator = node.locator;
    if (!client || !pageId || !locator || this.restoring() || this.restoreBlocked()) return;
    this.restoring.set(true);
    let result: RestoreResult;
    try {
      result = ((await client.scope('pangular').rpc.call('request-signal-restore', {
        pageId,
        request: { component: locator.id, node: node.id, epoch: change.epoch },
      })) ?? {}) as RestoreResult;
    } catch {
      result = { error: 'The devtools server did not answer. Try again.' };
    }
    this.restoring.set(false);
    this.restoreResult.set(
      result.ok
        ? {
            id: node.id,
            text: `Restored ${result.key ?? locator.key} to the value from ${time}.`,
            error: false,
          }
        : { id: node.id, text: result.error ?? 'The page did not restore it.', error: true },
    );
  }

  /** Why a writable signal has no exact set entries, when the panel can tell. */
  readonly writeHint = computed(() => {
    const node = this.selectedNode();
    const g = this.graph();
    if (!node || !g || g.writeHook === false) return '';
    if (node.kind !== 'signal' && node.kind !== 'linkedSignal') return '';
    if (!node.label) {
      return "This signal has no name, so its history holds sampled values only. Pass a debugName in its options, for example signal(0, { debugName: 'count' }).";
    }
    const history = g.history?.[node.id] ?? [];
    if (history.some((c) => c.source === 'write') || !history.some((c) => c.source === 'sample')) {
      return '';
    }
    return 'Every change here was sampled. Writes are matched by name, kind, version and value, so another live signal with the same name and value can hide them.';
  });

  readonly kindLegend = Object.entries(KIND_COLORS).map(([kind, color]) => ({ kind, color }));

  filteredResources = computed(() => {
    const q = this.filter().toLowerCase();
    const kind = this.kind();
    if (kind && kind !== 'resource') return [];
    return this.resources().filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        // A short query such as `e` would match every resource through its kind.
        (q.length >= 3 && 'resource'.startsWith(q)),
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
    () =>
      this.pageId ??
      (this.shownPageId() || null) ??
      this.graph()?.pageId ??
      this.latestTreePage()?.pageId ??
      null,
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
        // A directive host has no component signals to read.
        if (node.kind !== 'directive') flat.push(node);
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
    const load = ++this.graphLoad;
    /** A newer load (Retry, or a new client) started, so this one's outcome is dropped. */
    const stale = () => this.destroyRef.destroyed || load !== this.graphLoad;
    const my = client.scope('pangular');
    try {
      const state = await my.rpc.sharedState('signal-graph');
      if (stale()) return;
      this.graphFailed.set(false);
      const apply = (value: unknown) => {
        const next = value as {
          graph?: SignalGraph | null;
          pages?: Record<string, SignalGraph>;
        } | null;
        const pages = next?.pages && typeof next.pages === 'object' ? next.pages : {};
        const state = { graph: next?.graph ?? null, pages };
        this.notePageGone(graphPagesOf(state));
        this.graphState.set(state);
        // A state the client hasn't loaded from the server yet says nothing.
        if (value !== undefined) this.graphKnown.set(true);
      };
      apply(state.value());
      this.cleanups.push(state.on('updated', apply));
    } catch {
      if (stale()) return;
      this.graphState.set({ graph: null, pages: {} });
      this.graphKnown.set(true);
      this.graphFailed.set(true);
    }
    try {
      const tree = await my.rpc.sharedState('component-tree');
      if (stale()) return;
      const applyTree = (value: unknown) => {
        const pages = (value as { pages?: Record<string, { roots?: LiveNode[] }> } | null)?.pages;
        this.treePages.set(pages && typeof pages === 'object' ? pages : {});
      };
      applyTree(tree.value());
      this.cleanups.push(tree.on('updated', applyTree));
    } catch {
      if (!stale()) this.treePages.set({});
    }
  }

  private notePageGone(pages: Record<string, SignalGraph>) {
    const gone = Object.keys(this.graphPages()).filter((pageId) => !pages[pageId]);
    if (gone.length) {
      this.pickedByPage.update((all) => {
        const next = { ...all };
        for (const pageId of gone) delete next[pageId];
        return next;
      });
    }
    const chosen = this.chosenPageId();
    if (!chosen || pages[chosen]) return;
    const label = this.pageOptions().find((o) => o.value === chosen)?.label ?? 'The chosen page';
    this.chosenPageId.set(null);
    this.announcement.set(`${label} closed, so this shows another page.`);
  }

  selectPage(pageId: string | null) {
    if (!pageId || pageId === this.shownPageId()) return;
    this.chosenPageId.set(pageId);
    const label = this.pageOptions().find((o) => o.value === pageId)?.label ?? pageId;
    this.announcement.set(`Showing the signal graph of ${label}.`);
  }

  pickComponent(value: string | null) {
    const picked = value && value !== FOLLOW ? value : null;
    const pageId = this.targetPageId() ?? undefined;
    this.pickedByPage.update((all) => {
      const next = { ...all };
      if (picked) next[pageId ?? ''] = picked;
      else delete next[pageId ?? ''];
      return next;
    });
    const client = this.rpc();
    if (!client) return;
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
      this.sourceFailed.set(false);
    } catch {
      this.sourceFailed.set(true);
    } finally {
      this.sourceLoaded.set(true);
    }
  }

  /** Loads the graph and the source scan again. The alert stays until they answer, so focus
   * stays on Retry while it is shown and moves to the filter box when the alert goes, which
   * also happens when the graph comes back but the source scan still fails. */
  async retry() {
    const client = this.rpc();
    if (!client || this.retrying()) return;
    const trigger = document.activeElement;
    this.retrying.set(true);
    try {
      await Promise.all([this.loadSignalGraph(client), this.loadSourceSignals(client)]);
    } finally {
      this.retrying.set(false);
    }
    if (this.destroyRef.destroyed) return;
    afterNextRender(
      () => {
        const lost = !trigger?.isConnected || document.activeElement === document.body;
        if (lost) this.filterInput()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  /** Clears the filters from a no-match state and keeps focus on the filter box. */
  clearFilters() {
    this.resetFilters();
    this.filterInput()?.nativeElement.focus();
  }

  private resetFilters() {
    this.filter.set('');
    this.kind.set(null);
  }

  select(id: string) {
    this.selectedId.set(this.selectedId() === id ? null : id);
    this.showInternals.set(false);
  }

  /** Selects a node from the drawn graph; its detail opens in the list below. */
  selectFromGraph(id: string) {
    this.selectedId.set(id);
    this.showInternals.set(false);
  }

  plural(count: number, word: string): string {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
  }

  isWatchable(node: SignalNode): boolean {
    return WATCHABLE.has(node.kind);
  }

  /** Asks the page to watch or stop watching a signal; the page's next report shows it. */
  toggleWatch(node: SignalNode) {
    const watch = !this.watchedIds().has(node.id);
    const label = node.label ?? 'the unnamed signal';
    this.sendWatch({ id: node.id, watch });
    this.announcement.set(
      watch
        ? `Watching ${label}. Its changes also log to the page console.`
        : `Stopped watching ${label}.`,
    );
  }

  /** Turns write stacks on or off for the page that reported the graph. */
  toggleStacks() {
    const stacks = !this.stacksOn();
    this.sendWatch({ stacks });
    this.announcement.set(stacks ? 'Recording write stacks.' : 'Stopped recording write stacks.');
  }

  private sendWatch(request: { id?: string; watch?: boolean; stacks?: boolean }) {
    const client = this.rpc();
    const pageId = this.graph()?.pageId ?? this.targetPageId() ?? undefined;
    if (!client) return;
    void client
      .scope('pangular')
      .rpc.call('set-signal-watch', { ...request, pageId })
      .catch(() => {});
  }

  jumpTo(node: SignalNode) {
    const resource = this.resources().find((r) => r.nodeIds.includes(node.id));
    const id = resource?.id ?? node.id;
    const hidden = resource
      ? !this.filteredResources().some((r) => r.id === id)
      : !this.filteredNodes().some((n) => n.id === id);
    if (hidden) this.resetFilters();
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

  /** Producers and consumers of every node, built once per graph. */
  private readonly relations = computed(() => {
    const map = new Map<string, { deps: SignalNode[]; consumers: SignalNode[] }>();
    const g = this.graph();
    if (!g) return map;
    for (const node of g.nodes) map.set(node.id, { deps: [], consumers: [] });
    for (const edge of g.edges) {
      const producer = g.nodes[edge.producer];
      const consumer = g.nodes[edge.consumer];
      if (!producer || !consumer) continue;
      map.get(consumer.id)?.deps.push(producer);
      map.get(producer.id)?.consumers.push(consumer);
    }
    return map;
  });

  getDependencies(node: SignalNode): SignalNode[] {
    return this.relations().get(node.id)?.deps ?? [];
  }

  getConsumers(node: SignalNode): SignalNode[] {
    return this.relations().get(node.id)?.consumers ?? [];
  }
}
