import { JsonPipe } from '@angular/common';
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
  output,
  signal,
  untracked,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { hostPageId } from '../page-id';
import { pickPage } from '../live-pages';
import { isStaticReport } from '../rpc';
import { Select, type SelectOption } from '../ui/select';
import {
  countText,
  filterAnnouncement,
  truncationNotice,
  filterTree,
  nearestRow,
  reconcileSelection,
} from './component-tree-state';
import { CdRecording, type CdPage } from './cd-recording';

interface SourceComponent {
  selector: string;
  className: string;
  kind: 'component' | 'directive';
  file: string;
  line: number;
  inputs: string[];
  outputs: string[];
  isStandalone: boolean;
  changeDetection?: 'OnPush' | 'Eager' | 'unknown';
}
interface LiveNode {
  id: string;
  name: string;
  tag: string;
  directives?: string[];
  children: LiveNode[];
}

interface Prop {
  name: string;
  prop: string;
  value?: unknown;
  listened?: boolean;
  kind?: 'signal' | 'resource';
}

interface Dependency {
  from: string;
  token: string;
  flags: string[];
  providedBy: string | null;
  providedByName?: string;
}

interface Detail {
  id: string;
  name: string;
  tag: string;
  path: string;
  changeDetection?: string;
  encapsulation?: string;
  inputs: Prop[];
  outputs: Prop[];
  properties?: Prop[];
  listeners: string[];
  directives: { name: string; inputs: Prop[]; outputs: Prop[] }[];
  dependencies: Dependency[];
}

interface DeferBlock {
  id: string;
  owner?: { id: string; name: string; tag: string };
  state: string;
  hydration: string;
  hydrateNever?: boolean;
  triggers: string[];
  rootIds: string[];
}

interface Page {
  pageId: string;
  url?: string;
  title?: string;
  deferBlocks?: DeferBlock[];
  roots: LiveNode[];
  count: number;
  truncated?: boolean;
  truncatedBy?: { components?: number; depth?: number };
  detail: Detail | null;
  reportedAt: number;
}

interface OutletInfo {
  outlet: string;
  route?: string;
  element?: string;
  devtoolsId?: string;
  activated: boolean;
  children?: OutletInfo[];
}

interface RoutedHit {
  route: string;
  outlet: string;
}

interface PickResult {
  ok?: boolean;
  id?: string;
  name?: string;
  pageId?: string;
  error?: string;
}

interface Row {
  node: LiveNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

function bare(name: string): string {
  return name.replace(/^_(?=[A-Z])/, '');
}

@Component({
  selector: 'app-component-tree',
  imports: [JsonPipe, Select, CdRecording],
  host: { '(keydown.escape)': 'cancelPick()' },
  template: `
    @if (live()) {
      <p class="intro">
        Every component instance on the page, in the order Angular rendered them. Hover a row to
        highlight its host in the page, and select it to read its live inputs, properties, outputs
        and injected services.
      </p>

      <div class="toolbar">
        <div class="search">
          <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            placeholder="Filter by class, tag or directive…"
            aria-label="Filter components by class, tag or directive"
            autocomplete="off"
            spellcheck="false"
            [value]="filter()"
            (input)="setFilter($any($event.target).value)"
            (keydown.escape)="setFilter('')"
          />
        </div>
        @if (pageOptions().length > 1) {
          <span class="sr-only" id="ct-page-label">Page</span>
          <app-select
            class="page-select"
            labelledBy="ct-page-label"
            [options]="pageOptions()"
            [value]="page()?.pageId ?? null"
            (valueChange)="selectPage($event)"
          />
        }
        <span class="count">{{ countLabel() }}</span>
        <button
          type="button"
          class="pick"
          [class.on]="picking()"
          (click)="picking() ? cancelPick() : pick()"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 4l6.5 16 2.3-6.7L19.5 11z" />
          </svg>
          {{ picking() ? 'Cancel pick' : 'Pick component on page' }}
        </button>
      </div>
      <p class="sr-only" role="status">{{ announcement() }}</p>
      @if (pickMessage()) {
        <p class="pick-message">{{ pickMessage() }}</p>
      }
      @if (page()!.truncated) {
        <p class="notice" role="status">{{ truncationText() }}</p>
      }

      <div class="layout">
        <div>
          <h2 class="sr-only">Component tree</h2>
          @if (!rows().length) {
            <div class="state compact tree">
              <p class="state-title">No components match “{{ filter().trim() }}”</p>
              @if (page()!.truncated) {
                <p class="state-hint">The filter only searches the components the tree lists.</p>
              }
              <button type="button" (click)="setFilter('')">Clear filter</button>
            </div>
          }
          <div
            class="tree"
            role="tree"
            aria-label="Component instances"
            [hidden]="!rows().length"
            (keydown)="onTreeKey($event)"
          >
            @for (row of rows(); track row.node.id) {
              <div
                class="row"
                role="treeitem"
                [attr.aria-level]="row.depth + 1"
                [attr.aria-expanded]="row.hasChildren ? row.expanded : null"
                [attr.aria-selected]="selectedId() === row.node.id"
                [attr.tabindex]="rovingId() === row.node.id ? 0 : -1"
                [attr.data-id]="row.node.id"
                [class.selected]="selectedId() === row.node.id"
                [style.--depth]="row.depth"
                (click)="select(row.node.id)"
                (focus)="focusId.set(row.node.id); highlight(row.node.id)"
                (blur)="highlight(null)"
                (mouseenter)="highlight(row.node.id)"
                (mouseleave)="highlight(null)"
              >
                @if (row.hasChildren) {
                  <span
                    class="twisty"
                    aria-hidden="true"
                    [class.open]="row.expanded"
                    (click)="toggle(row.node.id, $event)"
                  >
                    <svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg>
                  </span>
                } @else {
                  <span class="twisty-space" aria-hidden="true"></span>
                }
                <span class="name mono">{{ row.node.name }}</span>
                <span class="tag mono">&lt;{{ row.node.tag }}&gt;</span>
                @for (hit of routedById().get(row.node.id) ?? []; track hit.outlet + hit.route) {
                  <span class="routed">{{ hit.route || '/' }}</span>
                }
                @if (cdHosts()[row.node.id]; as checks) {
                  <span class="checks">
                    {{ checks
                    }}<span class="sr-only">
                      {{ checks === 1 ? 'check' : 'checks' }} while recording</span
                    >
                  </span>
                }
                @if (row.node.directives?.length) {
                  <span class="dirs" [attr.title]="row.node.directives!.join(', ')">
                    +{{ row.node.directives!.length }}
                    <span class="sr-only">
                      {{ row.node.directives!.length === 1 ? 'directive' : 'directives' }}
                    </span>
                  </span>
                }
              </div>
            }
          </div>
        </div>

        @if (selectedNode(); as sel) {
          <section class="detail" aria-labelledby="ct-detail-title">
            <header class="detail-head">
              <span class="badge">component</span>
              <h2 id="ct-detail-title" class="mono">{{ sel.name }}</h2>
              <span class="mono muted">&lt;{{ sel.tag }}&gt;</span>
              @if (sourceFor(sel); as src) {
                <p class="where mono">{{ src.file }}:{{ src.line }}</p>
                @if (formsIn(src.file).length) {
                  <div class="actions">
                    @for (form of formsIn(src.file); track form.formId) {
                      <button type="button" class="show-form" (click)="showForm.emit(form.formId)">
                        Show {{ form.label }} in Forms
                      </button>
                    }
                  </div>
                }
              }
            </header>

            @if (detail(); as d) {
              <dl class="facts">
                <dt>Change detection</dt>
                <dd>{{ d.changeDetection ?? 'Unknown' }}</dd>
                <dt>Encapsulation</dt>
                <dd>{{ d.encapsulation ?? 'Unknown' }}</dd>
                <dt>Host path</dt>
                <dd class="mono">{{ d.path }}</dd>
                @for (hit of routedById().get(sel.id) ?? []; track hit.outlet + hit.route) {
                  <dt>Routed</dt>
                  <dd class="mono">{{ hit.route || '/' }} in outlet {{ hit.outlet }}</dd>
                }
              </dl>

              <div class="block">
                <h3>
                  Inputs <span class="pill">{{ d.inputs.length }}</span>
                </h3>
                @if (d.inputs.length) {
                  <ul class="props">
                    @for (p of d.inputs; track p.name) {
                      <li class="prop">
                        <span class="prop-name mono">
                          {{ p.name }}
                          @if (p.prop !== p.name) {
                            <span class="muted">({{ p.prop }})</span>
                          }
                        </span>
                        <pre>{{ p.value | json }}</pre>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="empty-line">No inputs.</p>
                }
              </div>

              <div class="block">
                <h3>
                  Outputs <span class="pill">{{ d.outputs.length }}</span>
                </h3>
                @if (d.outputs.length) {
                  <ul class="chips">
                    @for (p of d.outputs; track p.name) {
                      <li class="chip" [class.on]="p.listened">
                        <span class="mono">{{ p.name }}</span>
                        <span class="chip-note">{{ p.listened ? 'listened' : 'no listener' }}</span>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="empty-line">No outputs.</p>
                }
              </div>

              <div class="block">
                <h3>
                  Properties <span class="pill">{{ d.properties?.length ?? 0 }}</span>
                </h3>
                @if (d.properties?.length) {
                  <ul class="props">
                    @for (p of d.properties; track p.name) {
                      <li class="prop">
                        <span class="prop-name mono">
                          {{ p.name }}
                          @if (p.kind) {
                            <span class="flag">{{ p.kind }}</span>
                          }
                        </span>
                        <pre>{{ p.value | json }}</pre>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="empty-line">No other properties.</p>
                }
              </div>

              @if (d.listeners.length) {
                <div class="block">
                  <h3>
                    DOM listeners <span class="pill">{{ d.listeners.length }}</span>
                  </h3>
                  <ul class="chips">
                    @for (name of d.listeners; track name) {
                      <li class="chip mono">{{ name }}</li>
                    }
                  </ul>
                </div>
              }

              @for (dir of d.directives; track dir.name + $index) {
                <div class="block">
                  <h3>
                    <span class="mono">{{ dir.name }}</span>
                    <span class="flag">directive on host</span>
                  </h3>
                  @if (dir.inputs.length) {
                    <ul class="props">
                      @for (p of dir.inputs; track p.name) {
                        <li class="prop">
                          <span class="prop-name mono">{{ p.name }}</span>
                          <pre>{{ p.value | json }}</pre>
                        </li>
                      }
                    </ul>
                  }
                  @if (dir.outputs.length) {
                    <ul class="chips">
                      @for (p of dir.outputs; track p.name) {
                        <li class="chip" [class.on]="p.listened">
                          <span class="mono">{{ p.name }}</span>
                          <span class="chip-note">{{
                            p.listened ? 'listened' : 'no listener'
                          }}</span>
                        </li>
                      }
                    </ul>
                  }
                  @if (!dir.inputs.length && !dir.outputs.length) {
                    <p class="empty-line">No inputs or outputs.</p>
                  }
                </div>
              }

              <div class="block">
                <h3>
                  Injected <span class="pill">{{ d.dependencies.length }}</span>
                </h3>
                @if (d.dependencies.length) {
                  <ul class="deps">
                    @for (dep of d.dependencies; track dep.token + $index) {
                      <li class="dep">
                        <span class="token mono">{{ dep.token }}</span>
                        @for (flag of dep.flags; track flag) {
                          <span class="flag">{{ flag }}</span>
                        }
                        @if (dep.providedBy) {
                          <span class="from"
                            >from
                            <span class="mono">{{
                              dep.providedByName ?? 'an injector'
                            }}</span></span
                          >
                        } @else {
                          <span class="from missing">not provided</span>
                        }
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="empty-line">Nothing is injected through the constructor or inject().</p>
                }
              </div>
            } @else {
              <div class="state compact" role="status">
                <span class="spinner" aria-hidden="true"></span>
                <p class="state-hint">Reading live values from the page…</p>
              </div>
            }
          </section>
        } @else {
          <div class="detail placeholder">
            @if (destroyed(); as name) {
              <p class="state-title">The selected component was destroyed</p>
              <p class="state-hint">
                <span class="mono">{{ name }}</span> is no longer on the page. Select another
                component to see its live values.
              </p>
            } @else {
              <p class="state-hint">
                Select a component to see its live inputs, properties, outputs, change detection and
                injected services.
              </p>
            }
          </div>
        }
      </div>

      @if (deferBlocks().length) {
        <section class="defer" aria-labelledby="ct-defer-title">
          <h2 id="ct-defer-title" class="defer-title">
            Defer blocks <span class="pill">{{ deferBlocks().length }}</span>
          </h2>
          <ul class="defer-list">
            @for (block of deferBlocks(); track block.id) {
              <li>
                <button
                  type="button"
                  class="defer-row"
                  [disabled]="!block.owner"
                  (click)="showOwner(block)"
                  (focus)="highlightBlock(block)"
                  (blur)="highlight(null)"
                  (mouseenter)="highlightBlock(block)"
                  (mouseleave)="highlight(null)"
                >
                  <span class="name mono">{{ block.owner?.name ?? 'Unknown component' }}</span>
                  <span class="state" [class]="'state-' + block.state">{{ block.state }}</span>
                  @if (block.hydrateNever) {
                    <span class="flag">hydrate never</span>
                  } @else if (block.hydration !== 'not-configured') {
                    <span class="flag">{{ block.hydration }}</span>
                  }
                  <span class="triggers mono">{{
                    block.triggers.join(', ') || 'no triggers'
                  }}</span>
                </button>
              </li>
            }
          </ul>
        </section>
      }
      @if (!staticReport()) {
        <app-cd-recording [page]="cdPage()" [pageId]="page()!.pageId" [rpc]="rpc()" />
      }
    } @else {
      @if (page()) {
        <p class="notice" role="status">
          The page reported no component instances. The live tree needs a development build with
          Angular's debug API. Showing what the source declares instead.
        </p>
      } @else {
        <p class="notice">
          No page is connected, so this lists what the source declares. Open the app in a browser
          with the devtools connected to see each rendered instance.
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
            placeholder="Filter by selector, class or file…"
            aria-label="Filter components by selector, class or file"
            autocomplete="off"
            spellcheck="false"
            [value]="filter()"
            (input)="filter.set($any($event.target).value)"
            (keydown.escape)="filter.set('')"
          />
        </div>
        @if (source().length) {
          <span class="count" aria-live="polite">
            @if (filter().trim()) {
              {{ filteredSource().length }} of {{ source().length }}
            } @else {
              {{ sourceCounts().components }}
              {{ sourceCounts().components === 1 ? 'component' : 'components' }} ·
              {{ sourceCounts().directives }}
              {{ sourceCounts().directives === 1 ? 'directive' : 'directives' }}
            }
          </span>
        }
        <button
          type="button"
          class="refresh"
          [class.spinning]="loading()"
          [attr.aria-busy]="loading()"
          (click)="refresh()"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.34-5.66" />
            <path d="M20 4v5h-5" />
          </svg>
          Refresh
        </button>
      </div>

      @if (loading() && !source().length) {
        <div class="state" role="status">
          <span class="spinner" aria-hidden="true"></span>
          <p class="state-title">Scanning components…</p>
        </div>
      } @else if (error() && !source().length) {
        <div class="state" role="alert">
          <p class="state-title">Could not load components</p>
          <p class="state-hint">
            @if (staticReport()) {
              Run <code>ng-devtools build</code> again to rebuild the report.
            } @else {
              Check that the dev server is running, then try again.
            }
          </p>
          <button type="button" (click)="refresh()">Retry</button>
        </div>
      } @else if (!source().length) {
        <div class="state">
          <p class="state-title">No components found</p>
          <p class="state-hint">No @Component or @Directive was found in the source.</p>
        </div>
      } @else if (!filteredSource().length) {
        <div class="state">
          <p class="state-title">No components match “{{ filter().trim() }}”</p>
          <button type="button" (click)="filter.set('')">Clear filter</button>
        </div>
      } @else {
        <ul class="source-list" role="list">
          @for (comp of filteredSource(); track sourceKey(comp); let i = $index) {
            <li class="source-item" [class.expanded]="openKey() === sourceKey(comp)">
              <button
                type="button"
                class="source-toggle"
                [attr.aria-expanded]="openKey() === sourceKey(comp)"
                [attr.aria-controls]="openKey() === sourceKey(comp) ? 'ct-source-' + i : null"
                (click)="openKey.set(openKey() === sourceKey(comp) ? null : sourceKey(comp))"
              >
                <span class="kind-flag" [class.directive]="comp.kind === 'directive'">{{
                  comp.kind
                }}</span>
                <span class="row-main">
                  <span class="selector mono">{{ sourceLabel(comp) }}</span>
                  <span class="file mono">
                    @if (comp.selector) {
                      {{ bareName(comp.className) }} ·
                    }
                    {{ comp.file }}:{{ comp.line }}
                  </span>
                </span>
                <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
              @if (openKey() === sourceKey(comp)) {
                <div class="inline-detail" [id]="'ct-source-' + i">
                  <dl class="facts">
                    <dt>Class</dt>
                    <dd class="mono">{{ bareName(comp.className) }}</dd>
                    <dt>File</dt>
                    <dd class="mono">{{ comp.file }}:{{ comp.line }}</dd>
                    <dt>Standalone</dt>
                    <dd>{{ comp.isStandalone ? 'Yes' : 'No' }}</dd>
                    @if (comp.kind === 'component') {
                      <dt>Change detection</dt>
                      <dd>{{ comp.changeDetection ?? 'Unknown' }}</dd>
                    }
                    <dt>Inputs</dt>
                    <dd class="mono">{{ comp.inputs.join(', ') || 'None' }}</dd>
                    <dt>Outputs</dt>
                    <dd class="mono">{{ comp.outputs.join(', ') || 'None' }}</dd>
                  </dl>
                  @for (form of formsIn(comp.file); track form.formId) {
                    <button type="button" class="show-form" (click)="showForm.emit(form.formId)">
                      Show {{ form.label }} in Forms
                    </button>
                  }
                </div>
              }
            </li>
          }
        </ul>
      }
    }
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
    .muted {
      color: var(--text-2);
    }
    .intro {
      max-width: 720px;
      margin: 0 0 12px;
      color: var(--text-2);
      line-height: 1.5;
    }
    .notice {
      margin: 0 0 12px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text-2);
      line-height: 1.5;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
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
      height: 34px;
      padding: 0 12px 0 34px;
      background: var(--bg);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      color: var(--text);
      font: inherit;
      font-size: 13px;
    }
    input[type='search']::placeholder {
      color: var(--text-3);
    }
    input[type='search']:focus-visible {
      @include m.field-focus;
    }
    .count {
      flex: none;
      color: var(--text-2);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 34px;
      padding: 0 14px;
      background: var(--surface-2);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      color: var(--text);
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      transition:
        background-color 150ms var(--ease),
        border-color 150ms var(--ease);
    }
    button:hover {
      background: var(--surface-3);
      border-color: var(--accent-line);
    }
    button:focus-visible {
      @include m.focus-ring;
    }
    button svg {
      flex: none;
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .refresh.spinning svg {
      animation: spin 0.8s linear infinite;
    }
    .page-select {
      flex: 0 1 220px;
      min-width: 0;
    }
    .pick.on {
      background: var(--accent-soft);
      border-color: var(--accent-line);
      color: var(--text-strong);
    }
    .defer {
      margin-top: 16px;
    }
    .defer-title {
      @include m.label;
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 8px;
    }
    .defer-list {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .defer-row {
      justify-content: flex-start;
      flex-wrap: wrap;
      width: 100%;
      height: auto;
      min-height: var(--control-h);
      padding: 6px 12px;
      background: var(--surface);
      border-color: var(--border);
      text-align: left;
    }
    .defer-row:disabled {
      cursor: default;
    }
    .state {
      padding: 0 8px;
      border-radius: 99px;
      background: var(--surface-3);
      color: var(--text-2);
      font-size: 11px;
      line-height: 18px;
    }
    .state-complete {
      @include m.soft(var(--ok));
    }
    .state-error {
      @include m.soft(var(--danger));
    }
    .state-loading,
    .state-placeholder {
      @include m.soft(var(--warn));
    }
    .triggers {
      min-width: 0;
      color: var(--text-2);
      font-size: 12px;
      @include m.truncate;
    }
    .pick-message {
      margin: 0 0 12px;
      color: var(--text-2);
      line-height: 1.5;
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
    .tree {
      min-width: 0;
      padding: 6px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      @include m.enter;
    }
    .row {
      position: relative;
      display: flex;
      align-items: center;
      gap: 6px;
      min-height: 32px;
      padding: 0 8px 0 calc(4px + var(--depth, 0) * 18px);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: background-color 120ms var(--ease);
    }
    .row::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 14px;
      width: calc(var(--depth, 0) * 18px);
      background: repeating-linear-gradient(to right, var(--border) 0 1px, transparent 1px 18px);
      pointer-events: none;
    }
    .row:hover {
      background: var(--surface-2);
    }
    .row:focus-visible {
      @include m.focus-ring(-2px);
    }
    .row.selected {
      background: var(--accent-soft);
      box-shadow: inset 2px 0 0 var(--accent);
    }
    .twisty,
    .twisty-space {
      flex: none;
      width: 20px;
      height: 20px;
    }
    .twisty {
      display: grid;
      place-items: center;
      border-radius: 4px;
      color: var(--text-3);
    }
    .twisty:hover {
      color: var(--text);
      background: var(--surface-3);
    }
    .twisty svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
      transition: transform 150ms var(--ease);
    }
    .twisty.open svg {
      transform: rotate(90deg);
    }
    .name {
      min-width: 0;
      color: var(--text-strong);
      font-size: 12px;
      font-weight: 600;
      @include m.truncate;
    }
    .tag {
      flex: 0 1 auto;
      min-width: 0;
      color: var(--text-2);
      font-size: 12px;
      @include m.truncate;
    }
    .routed {
      flex: none;
      max-width: 40%;
      padding: 0 8px;
      border: 1px solid var(--accent-line);
      border-radius: 99px;
      background: var(--accent-soft);
      color: var(--accent);
      font-family: var(--font-mono);
      font-size: 11px;
      line-height: 18px;
      @include m.truncate;
    }
    .checks {
      flex: none;
      margin-left: auto;
      padding: 0 7px;
      border-radius: 99px;
      background: var(--accent-soft);
      color: var(--text);
      font-size: 11px;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
    }
    .checks + .dirs {
      margin-left: 0;
    }
    .dirs {
      flex: none;
      margin-left: auto;
      padding: 0 7px;
      border-radius: 99px;
      background: var(--surface-3);
      color: var(--text-2);
      font-size: 11px;
      line-height: 18px;
    }
    .detail {
      min-width: 0;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      @include m.enter;
    }
    .detail.placeholder {
      padding: 24px 16px;
      border-style: dashed;
      text-align: center;
    }
    .detail-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 10px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
    }
    .detail-head h2 {
      min-width: 0;
      margin: 0;
      color: var(--text-strong);
      font-size: 15px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .where {
      width: 100%;
      margin: 0;
      color: var(--text-2);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .badge {
      padding: 2px 8px;
      border-radius: 99px;
      @include m.soft(var(--accent));
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      width: 100%;
    }
    .show-form {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--accent-ink);
      font-weight: 600;
    }
    .show-form:hover {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
    }
    .facts {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 8px 16px;
      margin: 0;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
    }
    .facts dt {
      @include m.label;
      align-self: center;
    }
    .facts dd {
      min-width: 0;
      margin: 0;
      color: var(--text);
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
      margin: 0 0 8px;
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
    }
    .props,
    .deps,
    .chips {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
    }
    .prop,
    .dep {
      min-width: 0;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--bg);
    }
    .prop-name {
      display: block;
      margin-bottom: 4px;
      color: var(--text-strong);
      font-size: 12px;
      font-weight: 600;
    }
    pre {
      max-height: 200px;
      margin: 0;
      overflow: auto;
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 10px;
      border: 1px solid var(--border-strong);
      border-radius: 99px;
      color: var(--text);
      font-size: 12px;
    }
    .chip.on {
      @include m.soft(var(--ok));
    }
    .chip-note {
      color: var(--text-2);
      font-size: 11px;
    }
    .chip.on .chip-note {
      color: inherit;
    }
    .dep {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 8px;
    }
    .token {
      min-width: 0;
      color: var(--text-strong);
      font-size: 12px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .flag {
      padding: 0 6px;
      border: 1px solid var(--border-strong);
      border-radius: 5px;
      color: var(--text-2);
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 400;
      letter-spacing: 0;
      line-height: 16px;
      text-transform: none;
    }
    .from {
      margin-left: auto;
      color: var(--text-2);
      font-size: 12px;
    }
    .from .mono {
      color: var(--text);
    }
    .from.missing {
      color: var(--warn);
    }
    .empty-line {
      margin: 0;
      color: var(--text-2);
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
    }
    .state.compact {
      padding: 24px 12px;
      border: 0;
      background: none;
    }
    .state-title {
      margin: 0;
      color: var(--text-strong);
      font-size: 14px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .state-hint {
      max-width: 440px;
      margin: 0 auto;
      color: var(--text-2);
      line-height: 1.5;
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
      .spinner,
      .refresh.spinning svg {
        animation: none;
      }
    }
    .source-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .source-item {
      min-width: 0;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .source-item.expanded {
      border-color: var(--accent-line);
      box-shadow: inset 2px 0 0 var(--accent);
    }
    .source-toggle {
      justify-content: flex-start;
      gap: 12px;
      width: 100%;
      height: auto;
      min-height: 52px;
      padding: 10px 16px;
      background: none;
      border: 0;
      border-radius: 0;
      text-align: left;
    }
    .source-toggle:hover {
      background: var(--surface-2);
    }
    .source-toggle:focus-visible {
      @include m.focus-ring(-2px);
    }
    .kind-flag {
      flex: none;
      padding: 1px 8px;
      border-radius: 99px;
      @include m.soft(var(--accent));
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .kind-flag.directive {
      @include m.soft(var(--ok));
    }
    .row-main {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .selector {
      color: var(--text-strong);
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .file {
      color: var(--text-2);
      font-size: 12px;
      @include m.truncate;
    }
    .chevron {
      flex: none;
      width: 16px;
      height: 16px;
      fill: none;
      stroke: var(--text-3);
      stroke-width: 2.2;
      transition: transform 200ms var(--ease);
    }
    .expanded .chevron {
      transform: rotate(90deg);
      stroke: var(--accent);
    }
    .inline-detail {
      padding: 0 0 12px;
      border-top: 1px solid var(--border);
    }
    .inline-detail .facts {
      border-bottom: 0;
    }
    .inline-detail .show-form {
      margin: 0 16px;
    }
  `,
})
export class ComponentTree {
  readonly rpc = input<DevframeRpcClient | null>(null);
  readonly staticReport = computed(() => isStaticReport(this.rpc()));
  readonly focus = input<{ id: string } | null>(null);
  readonly showForm = output<string>();
  readonly focusHandled = output<void>();

  readonly filter = signal('');
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly source = signal<SourceComponent[]>([]);
  readonly formOwners = signal<{ formId: string; label: string; file: string | null }[]>([]);
  readonly pages = signal<Record<string, Page>>({});
  readonly chosenPageId = signal<string | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly destroyed = signal<string | null>(null);
  readonly announcement = signal('');
  readonly picking = signal(false);
  readonly pickMessage = signal('');
  readonly focusId = signal<string | null>(null);
  readonly collapsed = signal<ReadonlySet<string>>(new Set());
  readonly openKey = signal<string | null>(null);
  private readonly outlets = signal<OutletInfo[]>([]);
  private readonly pageId = hostPageId();
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly cleanups: (() => void)[] = [];
  private selection = { pageId: null as string | null, detailId: null as string | null };

  private readonly shownPageId = linkedSignal<
    { pages: Record<string, Page>; chosen: string | null },
    string | null
  >({
    source: () => ({ pages: this.pages(), chosen: this.chosenPageId() }),
    computation: ({ pages, chosen }, previous) =>
      pickPage(pages, { chosen, host: this.pageId, previous: previous?.value ?? null }),
  });

  readonly page = computed<Page | null>(() => {
    const id = this.shownPageId();
    return id ? (this.pages()[id] ?? null) : null;
  });

  readonly pageOptions = computed<SelectOption[]>(() =>
    Object.values(this.pages()).map((page) => ({
      value: page.pageId,
      label: page.title || page.url || `Page ${page.pageId}`,
      hint: page.url,
    })),
  );

  readonly live = computed(() => (this.page()?.roots.length ?? 0) > 0);

  private readonly cdPages = signal<Record<string, CdPage>>({});
  readonly cdPage = computed(() => {
    const pageId = this.page()?.pageId;
    return pageId ? (this.cdPages()[pageId] ?? null) : null;
  });
  readonly cdHosts = computed(() => this.cdPage()?.hosts ?? {});

  private readonly index = computed(() => {
    const map = new Map<string, LiveNode>();
    const parents = new Map<string, string>();
    const walk = (nodes: LiveNode[], parent: string | null) => {
      for (const node of nodes) {
        map.set(node.id, node);
        if (parent) parents.set(node.id, parent);
        walk(node.children, node.id);
      }
    };
    walk(this.page()?.roots ?? [], null);
    return { map, parents };
  });

  private readonly query = computed(() => this.filter().trim().toLowerCase());

  private readonly filtered = computed(() => filterTree(this.page()?.roots ?? [], this.query()));

  readonly deferBlocks = computed(() => this.page()?.deferBlocks ?? []);

  readonly countLabel = computed(() =>
    countText(
      this.page()?.count ?? 0,
      this.filtered().matches,
      !!this.query(),
      !!this.page()?.truncated,
    ),
  );

  readonly truncationText = computed(() => truncationNotice(this.page()?.truncatedBy));

  readonly rows = computed<Row[]>(() => {
    const rows: Row[] = [];
    const collapsed = this.collapsed();
    const searching = !!this.query();
    const walk = (nodes: LiveNode[], depth: number) => {
      for (const node of nodes) {
        const expanded = searching || !collapsed.has(node.id);
        rows.push({ node, depth, hasChildren: node.children.length > 0, expanded });
        if (expanded) walk(node.children, depth + 1);
      }
    };
    walk(this.filtered().nodes, 0);
    return rows;
  });

  readonly selectedNode = computed(() => {
    const id = this.selectedId();
    return id ? (this.index().map.get(id) ?? null) : null;
  });

  readonly detail = computed(() => {
    const detail = this.page()?.detail;
    return detail && detail.id === this.selectedId() ? detail : null;
  });

  readonly rovingId = computed(() => {
    const rows = this.rows();
    const ids = new Set(rows.map((r) => r.node.id));
    const focus = this.focusId();
    if (focus && ids.has(focus)) return focus;
    const selected = this.selectedId();
    if (selected && ids.has(selected)) return selected;
    return rows[0]?.node.id ?? null;
  });

  readonly routedById = computed(() => {
    const map = new Map<string, RoutedHit[]>();
    const visit = (outlets: OutletInfo[]) => {
      for (const outlet of outlets) {
        if (outlet.activated && outlet.devtoolsId) {
          const hits = map.get(outlet.devtoolsId) ?? [];
          hits.push({ route: outlet.route ?? '', outlet: outlet.outlet });
          map.set(outlet.devtoolsId, hits);
        }
        if (outlet.children) visit(outlet.children);
      }
    };
    visit(this.outlets());
    return map;
  });

  private readonly sourceByClass = computed(() => {
    const map = new Map<string, SourceComponent[]>();
    for (const comp of this.source()) {
      const key = bare(comp.className);
      map.set(key, [...(map.get(key) ?? []), comp]);
    }
    return map;
  });

  readonly filteredSource = computed(() => {
    const q = this.query();
    const all = this.source();
    if (!q) return all;
    return all.filter(
      (c) =>
        c.selector.toLowerCase().includes(q) ||
        c.className.toLowerCase().includes(q) ||
        c.file.toLowerCase().includes(q),
    );
  });

  readonly sourceCounts = computed(() => {
    const components = this.source().filter((c) => c.kind === 'component').length;
    return { components, directives: this.source().length - components };
  });

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (!client) return;
      void this.refresh();
      void this.watch(client);
    });
    effect(() => {
      const focus = this.focus();
      if (!focus || !this.live()) return;
      untracked(() => {
        if (this.index().map.has(focus.id)) this.reveal(focus.id);
        this.focusHandled.emit();
      });
    });
    this.destroyRef.onDestroy(() => {
      this.highlight(null);
      for (const cleanup of this.cleanups.splice(0)) cleanup();
    });
  }

  private async watch(client: DevframeRpcClient) {
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    const my = client.scope('ng-devtools');
    try {
      const tree = await my.rpc.sharedState('component-tree');
      if (this.destroyRef.destroyed) return;
      const applyTree = (value: unknown) => {
        const pages = (value as { pages?: Record<string, Page> } | null)?.pages;
        this.applyPages(pages && typeof pages === 'object' ? pages : {});
      };
      applyTree(tree.value());
      this.cleanups.push(tree.on('updated', applyTree));
    } catch {
      this.applyPages({});
    }
    try {
      const cd = await my.rpc.sharedState('change-detection');
      if (this.destroyRef.destroyed) return;
      const applyCd = (value: unknown) => {
        const pages = (value as { pages?: Record<string, CdPage> } | null)?.pages;
        this.cdPages.set(pages && typeof pages === 'object' ? pages : {});
      };
      applyCd(cd.value());
      this.cleanups.push(cd.on('updated', applyCd));
    } catch {
      this.cdPages.set({});
    }
    try {
      const router = await my.rpc.sharedState('router');
      if (this.destroyRef.destroyed) return;
      const applyRouter = (value: unknown) => {
        const pages =
          (value as { pages?: { pageId?: string; outlets?: OutletInfo[]; snapshot?: unknown }[] })
            ?.pages ?? [];
        const page = this.pageId
          ? pages.find((p) => p.pageId === this.pageId)
          : (pages.find((p) => p.snapshot) ?? pages[0]);
        this.outlets.set(page?.outlets ?? []);
      };
      applyRouter(router.value());
      this.cleanups.push(router.on('updated', applyRouter));
    } catch {
      this.outlets.set([]);
    }
  }

  async refresh() {
    const client = this.rpc();
    if (!client) return;
    this.loading.set(true);
    const my = client.scope('ng-devtools');
    try {
      this.source.set((await my.rpc.call('get-components')) as SourceComponent[]);
      this.error.set(false);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
    const owners = (await my.rpc.call('forms-owners').catch(() => [])) as {
      formId: string;
      label: string;
      file: string | null;
    }[];
    this.formOwners.set(owners ?? []);
  }

  formsIn(file: string) {
    return this.formOwners().filter((form) => form.file === file);
  }

  sourceFor(node: LiveNode): SourceComponent | null {
    const matches = (this.sourceByClass().get(bare(node.name)) ?? []).filter(
      (c) => c.kind === 'component',
    );
    return matches.find((c) => c.selector === node.tag) ?? matches[0] ?? null;
  }

  sourceKey(comp: SourceComponent) {
    return `${comp.file}#${comp.className}`;
  }

  sourceLabel(comp: SourceComponent) {
    if (!comp.selector) return bare(comp.className);
    return comp.kind === 'component' && /^[a-z][\w-]*$/i.test(comp.selector)
      ? `<${comp.selector}>`
      : comp.selector;
  }

  bareName(name: string) {
    return bare(name);
  }

  private applyPages(pages: Record<string, Page>) {
    const active = document.activeElement;
    const focused =
      active instanceof HTMLElement && this.host.nativeElement.contains(active)
        ? (active.closest<HTMLElement>('.row')?.dataset['id'] ?? null)
        : null;
    const before = focused ? this.rows().map((row) => row.node.id) : [];
    const known = this.index().map;
    this.pages.set(pages);
    this.syncSelection(known);
    if (!focused) return;
    const after = new Set(this.rows().map((row) => row.node.id));
    if (after.has(focused)) return;
    const next = nearestRow(before, after, focused);
    if (!next) return;
    this.focusId.set(next);
    afterNextRender(() => this.rowElement(next)?.focus(), { injector: this.injector });
  }

  private syncSelection(known = this.index().map) {
    const page = this.page();
    const next = reconcileSelection(
      { ...this.selection, selectedId: this.selectedId() },
      page
        ? { pageId: page.pageId, roots: page.roots, detail: page.detail, truncated: page.truncated }
        : null,
    );
    const name = next.destroyed ? known.get(next.destroyed)?.name : undefined;
    this.selection = { pageId: next.pageId, detailId: next.detailId };
    if (next.selectedId !== this.selectedId()) this.selectedId.set(next.selectedId);
    if (next.selectedId) this.destroyed.set(null);
    if (!next.destroyed) return;
    this.destroyed.set(name ?? 'The component');
    this.announcement.set('The selected component was destroyed.');
    this.sendSelection(null);
  }

  selectPage(pageId: string | null) {
    if (!pageId) return;
    this.chosenPageId.set(pageId);
    this.destroyed.set(null);
    this.syncSelection();
  }

  setFilter(value: string) {
    this.filter.set(value);
    const { matches } = this.filtered();
    this.announcement.set(
      filterAnnouncement(this.page()?.count ?? 0, matches, value, !!this.page()?.truncated),
    );
  }

  async pick() {
    const client = this.rpc();
    if (!client || this.picking()) return;
    this.picking.set(true);
    this.say('Click a component in the app. Press Escape to cancel.');
    const result = (await client
      .scope('ng-devtools')
      .rpc.call('request-component-pick', { pageId: this.page()?.pageId })
      .catch(() => ({ ok: false, error: 'Could not reach the devtools server.' }))) as PickResult;
    this.picking.set(false);
    if (!result?.ok || !result.id) {
      this.say(result?.error ?? 'No component was picked.');
      return;
    }
    if (result.pageId && result.pageId !== this.page()?.pageId) this.selectPage(result.pageId);
    this.say(`Picked ${result.name ?? 'a component'}.`);
    this.destroyed.set(null);
    if (this.index().map.has(result.id)) this.reveal(result.id);
    else this.selectedId.set(result.id);
  }

  cancelPick() {
    const client = this.rpc();
    if (!client || !this.picking()) return;
    void client
      .scope('ng-devtools')
      .rpc.call('cancel-component-pick', { pageId: this.page()?.pageId })
      .catch(() => {});
  }

  private say(message: string) {
    this.pickMessage.set(message);
    this.announcement.set(message);
  }

  private sendSelection(id: string | null) {
    const client = this.rpc();
    if (!client) return;
    void client
      .scope('ng-devtools')
      .rpc.call('select-component', { pageId: this.page()?.pageId, id })
      .catch(() => {});
  }

  private rowElement(id: string) {
    return this.host.nativeElement.querySelector<HTMLElement>(`.row[data-id="${CSS.escape(id)}"]`);
  }

  select(id: string) {
    const next = this.selectedId() === id ? null : id;
    this.selectedId.set(next);
    this.destroyed.set(null);
    this.focusId.set(id);
    this.sendSelection(next);
  }

  private reveal(id: string) {
    const { parents } = this.index();
    this.collapsed.update((set) => {
      const next = new Set(set);
      for (let parent = parents.get(id); parent; parent = parents.get(parent)) next.delete(parent);
      return next;
    });
    if (!this.rows().some((row) => row.node.id === id)) this.setFilter('');
    if (this.selectedId() !== id) this.select(id);
    afterNextRender(
      () =>
        document
          .querySelector(`.row[data-id="${CSS.escape(id)}"]`)
          ?.scrollIntoView({ block: 'nearest' }),
      { injector: this.injector },
    );
  }

  toggle(id: string, event?: Event) {
    event?.stopPropagation();
    if (this.query()) return;
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  highlight(id: string | null) {
    const client = this.rpc();
    if (!client) return;
    const target = id ? { pageId: this.page()?.pageId, id } : null;
    void client
      .scope('ng-devtools')
      .rpc.call('request-page-highlight', target)
      .catch(() => {});
  }

  highlightBlock(block: DeferBlock) {
    this.highlight(block.rootIds[0] ?? block.owner?.id ?? null);
  }

  showOwner(block: DeferBlock) {
    if (block.owner && this.index().map.has(block.owner.id)) this.reveal(block.owner.id);
  }

  onTreeKey(event: KeyboardEvent) {
    const rows = this.rows();
    if (!rows.length) return;
    const current = rows.findIndex((r) => r.node.id === this.rovingId());
    const at = Math.max(current, 0);
    const row = rows[at];
    let next = -1;
    switch (event.key) {
      case 'ArrowDown':
        next = Math.min(at + 1, rows.length - 1);
        break;
      case 'ArrowUp':
        next = Math.max(at - 1, 0);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = rows.length - 1;
        break;
      case 'ArrowRight':
        if (row.hasChildren && !row.expanded) this.toggle(row.node.id);
        else if (row.hasChildren) next = at + 1;
        break;
      case 'ArrowLeft':
        if (row.hasChildren && row.expanded && !this.query()) this.toggle(row.node.id);
        else {
          const parent = this.index().parents.get(row.node.id);
          next = rows.findIndex((r) => r.node.id === parent);
        }
        break;
      case 'Enter':
      case ' ':
        this.select(row.node.id);
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next >= 0) {
      const id = rows[next].node.id;
      this.focusId.set(id);
      queueMicrotask(() => {
        const el = document.querySelector<HTMLElement>(`.row[data-id="${CSS.escape(id)}"]`);
        el?.focus();
        el?.scrollIntoView({ block: 'nearest' });
      });
    }
  }
}
