import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { hostPageId } from '../page-id';

interface ProviderInfo {
  token: string;
  type: string;
  isViewProvider: boolean;
  multi?: boolean;
  importPath?: string[];
}

interface DependencyInfo {
  from: string;
  token: string;
  flags: string[];
  providedBy: string | null;
}

interface InjectorNode {
  injector: {
    id: string;
    type: string;
    name: string;
    providerCount: number;
    component?: string;
    directives?: string[];
    selector?: string;
    path?: string[];
  };
  providers: ProviderInfo[];
  children: InjectorNode[];
  dependencies?: DependencyInfo[];
}

interface SourceProvider {
  token: string;
  source: string;
  file: string;
  line: number;
  providedIn?: string;
  type: string;
}

interface Row {
  node: InjectorNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

type TreeView = 'element' | 'environment';

const NULL_ID = 'inj-null';

const KIND_TONE: Record<string, string> = {
  component: 'var(--accent)',
  directive: '#7cb4ff',
  environment: 'var(--ok)',
  null: 'var(--text-3)',
};

function kindOf(node: InjectorNode): 'component' | 'directive' | 'environment' {
  if (node.injector.type !== 'element') return 'environment';
  return node.injector.component ? 'component' : 'directive';
}

function labelOf(node: InjectorNode): string {
  return node.injector.type === 'element' ? `<${node.injector.name}>` : node.injector.name;
}

function isTree(value: unknown): value is InjectorNode[] {
  return Array.isArray(value);
}

@Component({
  selector: 'app-di-inspector',
  template: `
    @if (roots().length > 0) {
      <p class="intro">
        Every component and directive gets an injector. When it asks for a token, Angular walks up
        this tree, then through the environment injectors, until something provides it.
      </p>

      <div class="toolbar">
        <div class="segmented" role="group" aria-label="Injector tree">
          <button
            type="button"
            [class.active]="view() === 'element'"
            [attr.aria-pressed]="view() === 'element'"
            (click)="setView('element')"
          >
            Elements <span class="pill">{{ elementCount() }}</span>
          </button>
          <button
            type="button"
            [class.active]="view() === 'environment'"
            [attr.aria-pressed]="view() === 'environment'"
            (click)="setView('environment')"
          >
            Environment <span class="pill">{{ environmentCount() }}</span>
          </button>
        </div>
        <div class="search">
          <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            placeholder="Find a token, component or injector…"
            aria-label="Find a token, component or injector"
            autocomplete="off"
            spellcheck="false"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            (keydown.escape)="query.set('')"
          />
        </div>
        @if (view() === 'element') {
          <label class="checkbox">
            <input
              type="checkbox"
              [checked]="componentsOnly()"
              (change)="componentsOnly.set(!componentsOnly())"
            />
            Components only
          </label>
        }
        <label class="checkbox">
          <input
            type="checkbox"
            [checked]="onlyProviding()"
            (change)="onlyProviding.set(!onlyProviding())"
          />
          With providers
        </label>
      </div>

      @if (truncated()) {
        <p class="notice">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" />
          </svg>
          <span>
            <strong>This page has more than 2000 element injectors.</strong>
            Only the first 2000 are shown, so a lookup path or a provider can point to one that is
            not listed.
          </span>
        </p>
      }

      @if (providedBy().length) {
        <div class="where" role="status">
          <span class="where-label">Provided by</span>
          @for (hit of providedBy(); track hit.id) {
            <button type="button" class="chip" (click)="reveal(hit.id)">
              <span class="dot" [style.background]="tone(hit.kind)" aria-hidden="true"></span>
              <span class="mono">{{ hit.label }}</span>
              <span class="chip-tokens">{{ hit.tokens }}</span>
            </button>
          }
        </div>
      } @else if (query().trim() && !rows().length) {
        <div class="where muted" role="status">
          Nothing here matches “{{ query().trim() }}”.
          <button type="button" class="link" (click)="query.set('')">Clear search</button>
        </div>
      }

      <div class="layout">
        @if (!rows().length) {
          <div class="state">
            <p class="state-title">No injectors to show</p>
            <p class="state-hint">
              @if (onlyProviding()) {
                None of them provide anything themselves.
              } @else if (componentsOnly() && view() === 'element') {
                Turn off “Components only” to see directives.
              } @else {
                Try a different search.
              }
            </p>
          </div>
        }
        <div
          class="tree"
          role="tree"
          [attr.aria-label]="view() === 'element' ? 'Element injectors' : 'Environment injectors'"
          [hidden]="!rows().length"
          (keydown)="onTreeKey($event)"
        >
          @for (row of rows(); track row.node.injector.id; let i = $index) {
            <div
              class="row"
              role="treeitem"
              [attr.aria-level]="row.depth + 1"
              [attr.aria-expanded]="row.hasChildren ? row.expanded : null"
              [attr.aria-selected]="selected()?.injector?.id === row.node.injector.id"
              [attr.tabindex]="rovingId() === row.node.injector.id ? 0 : -1"
              [attr.data-id]="row.node.injector.id"
              [class.selected]="selected()?.injector?.id === row.node.injector.id"
              [style.--depth]="row.depth"
              (click)="select(row.node.injector.id)"
              (focus)="focusId.set(row.node.injector.id); highlight(row.node)"
              (blur)="highlight(null)"
              (mouseenter)="highlight(row.node)"
              (mouseleave)="highlight(null)"
            >
              @if (row.hasChildren) {
                <span
                  class="twisty"
                  aria-hidden="true"
                  [class.open]="row.expanded"
                  (click)="toggle(row.node.injector.id, $event)"
                >
                  <svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg>
                </span>
              } @else {
                <span class="twisty-space" aria-hidden="true"></span>
              }
              <span
                class="kind"
                [style.--tone]="tone(kind(row.node))"
                [attr.title]="kind(row.node)"
                aria-hidden="true"
                >{{ kind(row.node)[0].toUpperCase() }}</span
              >
              <span class="sr-only">{{ kind(row.node) }}</span>
              <span class="name mono">{{ label(row.node) }}</span>
              @if (row.node.injector.component) {
                <span class="sub">{{ row.node.injector.component }}</span>
              } @else if (row.node.injector.directives?.length) {
                <span class="sub">{{ row.node.injector.directives!.join(', ') }}</span>
              }
              <span class="meta">
                @if ((row.node.dependencies?.length ?? 0) > 0) {
                  <span class="count" [attr.title]="row.node.dependencies!.length + ' injected'">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                    <span class="sr-only">injects</span>
                    {{ row.node.dependencies!.length }}
                  </span>
                }
                @if (row.node.injector.providerCount > 0) {
                  <span
                    class="count provides"
                    [attr.title]="row.node.injector.providerCount + ' provided'"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
                    </svg>
                    <span class="sr-only">provides</span>
                    {{ row.node.injector.providerCount }}
                  </span>
                }
              </span>
            </div>
          }
        </div>

        @if (selected(); as sel) {
          <section class="detail" aria-labelledby="di-detail-title">
            <header class="detail-head">
              <span class="badge" [style.--tone]="tone(kind(sel))">{{ kind(sel) }}</span>
              <h2 id="di-detail-title" class="mono">{{ label(sel) }}</h2>
              @if (sel.injector.directives?.length) {
                <ul class="classes" aria-label="Classes on this element">
                  @for (name of sel.injector.directives; track name) {
                    <li [class.is-component]="name === sel.injector.component">{{ name }}</li>
                  }
                </ul>
              }
            </header>

            <div class="block">
              <h3>Lookup path</h3>
              <p class="hint">Angular asks these injectors in order until one has the token.</p>
              <ol class="path">
                @for (step of path(); track step.id; let first = $first) {
                  <li [class.current]="first">
                    @if (step.id === nullId) {
                      <span class="step null">
                        <span
                          class="dot"
                          [style.background]="tone('null')"
                          aria-hidden="true"
                        ></span>
                        Null injector
                        <span class="hint-inline">throws NullInjectorError</span>
                      </span>
                    } @else {
                      <button type="button" class="step" (click)="reveal(step.id)">
                        <span
                          class="dot"
                          [style.background]="tone(step.kind)"
                          aria-hidden="true"
                        ></span>
                        <span class="mono">{{ step.label }}</span>
                        @if (step.providers) {
                          <span class="step-count">
                            {{ step.providers }}
                            <span class="sr-only">{{
                              step.providers === 1 ? 'provider' : 'providers'
                            }}</span>
                          </span>
                        }
                      </button>
                    }
                  </li>
                }
              </ol>
            </div>

            @if (sel.injector.type === 'element' || sel.dependencies) {
              <div class="block">
                <h3>
                  {{
                    sel.injector.type === 'element' ? 'Injected here' : 'Injected by its services'
                  }}
                  <span class="pill">{{ sel.dependencies?.length ?? 0 }}</span>
                </h3>
                @if (sel.injector.type !== 'element') {
                  <p class="hint">Only services this injector has already created are listed.</p>
                }
                @if (sel.dependencies?.length) {
                  <ul class="deps">
                    @for (dep of sel.dependencies; track dep.from + dep.token + $index) {
                      <li class="dep" [class.hit]="matches(dep.token)">
                        <div class="dep-main">
                          <span class="token mono">{{ dep.token }}</span>
                          @for (flag of dep.flags; track flag) {
                            <span class="flag">{{ flag }}</span>
                          }
                        </div>
                        <div class="dep-meta">
                          @if (
                            sel.injector.type !== 'element' ||
                            (sel.injector.directives && sel.injector.directives.length > 1)
                          ) {
                            <span>for {{ dep.from }}</span>
                          }
                          @if (dep.providedBy; as by) {
                            <button type="button" class="from" (click)="reveal(by)">
                              <span
                                class="dot"
                                [style.background]="tone(kindById(by))"
                                aria-hidden="true"
                              ></span>
                              from <span class="mono">{{ labelById(by) }}</span>
                            </button>
                          } @else if (dep.flags.includes('optional')) {
                            <span class="from absent">optional, not provided</span>
                          } @else {
                            <span class="from missing">not provided anywhere</span>
                          }
                        </div>
                      </li>
                    }
                  </ul>
                } @else if (sel.injector.type === 'element') {
                  <p class="empty-line">Nothing is injected through the constructor or inject().</p>
                } @else {
                  <p class="empty-line">No service created here has injected anything yet.</p>
                }
              </div>
            }

            <div class="block">
              <h3>
                Provides <span class="pill">{{ sel.providers.length }}</span>
              </h3>
              @if (sel.providers.length) {
                <ul class="providers">
                  @for (p of sel.providers; track p.token + $index) {
                    <li class="provider" [class.hit]="matches(p.token)">
                      <div class="dep-main">
                        <span class="token mono">{{ p.token }}</span>
                        <span class="flag kind-flag">{{
                          p.type === 'unknown' ? 'provider' : 'use' + capital(p.type)
                        }}</span>
                        @if (p.isViewProvider) {
                          <span class="flag">viewProviders</span>
                        }
                        @if (p.multi) {
                          <span class="flag">multi</span>
                        }
                      </div>
                      @if (p.importPath?.length) {
                        <div class="dep-meta">via {{ p.importPath!.join(' › ') }}</div>
                      }
                    </li>
                  }
                </ul>
              } @else {
                <p class="empty-line">
                  @if (sel.injector.type === 'element') {
                    No providers or viewProviders on this element.
                  } @else {
                    This injector has no providers of its own.
                  }
                </p>
              }
            </div>
          </section>
        }
      </div>
    } @else if (!loaded()) {
      <div class="state" role="status">
        <span class="spinner" aria-hidden="true"></span>
        <p class="state-title">Loading dependency injection data…</p>
      </div>
    } @else if (sourceProviders().length === 0) {
      <div class="state">
        <p class="state-title">No DI data found</p>
        <p class="state-hint">
          Open the app in a browser with the devtools connected to see its live injectors. No
          providers, injectables or inject() calls were found in the source either.
        </p>
      </div>
    } @else {
      <div class="toolbar">
        <div class="search">
          <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            placeholder="Filter by token or file…"
            aria-label="Filter by token or file"
            autocomplete="off"
            spellcheck="false"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            (keydown.escape)="query.set('')"
          />
        </div>
        <span class="total" aria-live="polite">
          {{ sourceMatchCount() }} of {{ sourceProviders().length }}
        </span>
      </div>

      <p class="notice">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
        <span>
          <strong>DI from source scan (static analysis).</strong>
          Connect the overlay on Angular 20 or later to see the live injector tree.
        </span>
      </p>
      @if (groupedProviders().length === 0) {
        <div class="state">
          <p class="state-title">No providers match “{{ query() }}”</p>
          <p class="state-hint">Try part of a token name or a file path.</p>
          <button type="button" (click)="query.set('')">Clear filter</button>
        </div>
      } @else {
        <div class="source-providers">
          @for (group of groupedProviders(); track group.type) {
            <section class="provider-group">
              <h2>
                {{ group.label }} <span class="section-count">{{ group.items.length }}</span>
              </h2>
              <ul class="provider-list" role="list">
                @for (p of group.items; track p.token + p.file + p.line) {
                  <li class="provider-card">
                    <div class="provider-header">
                      <span class="token">{{ p.token }}</span>
                      @if (p.providedIn) {
                        <span class="provided-in">providedIn: {{ p.providedIn }}</span>
                      }
                    </div>
                    <div class="provider-meta">
                      <span class="path">{{ p.file }}:{{ p.line }}</span>
                      @if (p.source !== 'class' && p.source !== 'providers array') {
                        <span class="as">as {{ p.source }}</span>
                      }
                    </div>
                  </li>
                }
              </ul>
            </section>
          }
        </div>
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
    .segmented {
      display: inline-flex;
      flex: none;
      padding: 3px;
      gap: 2px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--bg);
    }
    .segmented button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 26px;
      padding: 0 10px;
      border: 0;
      border-radius: 6px;
      background: none;
      color: var(--text-2);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition:
        background-color 150ms var(--ease),
        color 150ms var(--ease);
    }
    .segmented button:hover {
      color: var(--text);
    }
    .segmented button.active {
      background: var(--surface-3);
      color: var(--text-strong);
    }
    .segmented button:focus-visible {
      @include m.focus-ring(-2px);
    }
    .pill {
      display: inline-flex;
      align-items: center;
      min-width: 18px;
      height: 16px;
      padding: 0 5px;
      justify-content: center;
      border-radius: 99px;
      background: var(--surface-3);
      color: var(--text-2);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0;
      font-variant-numeric: tabular-nums;
    }
    .segmented .active .pill {
      background: var(--accent-soft);
      color: var(--accent);
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
    .checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 34px;
      color: var(--text-2);
      white-space: nowrap;
      cursor: pointer;
    }
    .checkbox:hover {
      color: var(--text);
    }
    .checkbox input {
      width: 15px;
      height: 15px;
      margin: 0;
      accent-color: var(--accent);
      cursor: pointer;
    }
    .checkbox input:focus-visible {
      @include m.focus-ring;
    }
    .total {
      flex: none;
      color: var(--text-2);
      font-size: 12px;
      white-space: nowrap;
    }
    .where {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin: 0 0 12px;
      padding: 8px 10px;
      border: 1px solid var(--accent-line);
      border-radius: var(--radius-sm);
      background: var(--accent-soft);
      @include m.enter(0.2s);
    }
    .where.muted {
      border-color: var(--border);
      background: var(--surface);
      color: var(--text-2);
    }
    .where-label {
      @include m.label;
      margin-right: 4px;
      color: var(--accent);
    }
    .chip,
    .from,
    .step {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      max-width: 100%;
      height: 26px;
      padding: 0 10px;
      border: 1px solid var(--border-strong);
      border-radius: 99px;
      background: var(--surface);
      color: var(--text);
      font-size: 12px;
      cursor: pointer;
      transition:
        border-color 150ms var(--ease),
        background-color 150ms var(--ease);
    }
    .chip:hover,
    .from:hover,
    .step:hover {
      border-color: var(--accent-line);
      background: var(--surface-2);
    }
    .chip:focus-visible,
    .from:focus-visible,
    .step:focus-visible,
    .link:focus-visible {
      @include m.focus-ring;
    }
    .chip-tokens {
      color: var(--text-2);
      @include m.truncate;
    }
    .link {
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent);
      font-size: 13px;
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .dot {
      flex: none;
      width: 7px;
      height: 7px;
      border-radius: 50%;
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
      padding: 0;
      border: 0;
      border-radius: 4px;
      background: none;
      color: var(--text-3);
      cursor: pointer;
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
    .kind {
      flex: none;
      display: grid;
      place-items: center;
      width: 18px;
      height: 18px;
      border-radius: 5px;
      background: color-mix(in srgb, var(--tone) 16%, transparent);
      color: var(--tone);
      font-size: 10px;
      font-weight: 700;
    }
    .name {
      min-width: 0;
      color: var(--text);
      font-size: 12px;
      @include m.truncate;
    }
    .row.selected .name {
      color: var(--text-strong);
      font-weight: 600;
    }
    .sub {
      flex: 0 1 auto;
      min-width: 0;
      color: var(--text-3);
      font-size: 12px;
      @include m.truncate;
    }
    .meta {
      display: inline-flex;
      flex: none;
      gap: 4px;
      margin-left: auto;
      padding-left: 8px;
    }
    .count {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      height: 20px;
      padding: 0 7px;
      border-radius: 99px;
      background: var(--surface-3);
      color: var(--text-2);
      font-size: 11px;
    }
    .count.provides {
      @include m.soft(var(--ok));
    }
    .count svg {
      width: 11px;
      height: 11px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .detail {
      min-width: 0;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
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
    .badge {
      padding: 2px 8px;
      border-radius: 99px;
      background: color-mix(in srgb, var(--tone) 14%, transparent);
      color: var(--tone);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .classes {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      width: 100%;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .classes li {
      padding: 1px 8px;
      border: 1px solid var(--border-strong);
      border-radius: 6px;
      color: var(--text-2);
      font-family: var(--font-mono);
      font-size: 11px;
    }
    .classes li.is-component {
      border-color: var(--accent-line);
      color: var(--accent);
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
    .hint {
      margin: -4px 0 10px;
      color: var(--text-3);
      font-size: 12px;
    }
    .path {
      position: relative;
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0 0 0 18px;
      list-style: none;
    }
    .path::before {
      content: '';
      position: absolute;
      top: 13px;
      bottom: 13px;
      left: 5px;
      width: 1px;
      background: var(--border-strong);
    }
    .path li {
      position: relative;
      min-width: 0;
    }
    .path li::before {
      content: '';
      position: absolute;
      top: 12px;
      left: -16px;
      width: 9px;
      height: 1px;
      background: var(--border-strong);
    }
    .path li.current .step {
      border-color: var(--accent);
      background: var(--accent-soft);
    }
    .step.null {
      cursor: default;
      color: var(--text-2);
    }
    .step.null:hover {
      border-color: var(--border-strong);
      background: var(--surface);
    }
    .hint-inline {
      color: var(--text-3);
    }
    .step-count {
      color: var(--text-3);
      font-size: 11px;
    }
    .deps,
    .providers {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .dep,
    .provider {
      min-width: 0;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--bg);
    }
    .dep.hit,
    .provider.hit {
      border-color: var(--accent-line);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }
    .dep-main {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
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
      line-height: 16px;
    }
    .kind-flag {
      @include m.soft(var(--accent));
    }
    .dep-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 10px;
      margin-top: 6px;
      color: var(--text-3);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .from {
      height: 22px;
      padding: 0 8px;
      color: var(--text-2);
    }
    .from .mono {
      color: var(--text);
    }
    .from.absent {
      cursor: default;
      background: none;
    }
    .from.missing {
      cursor: default;
      border-color: color-mix(in srgb, var(--warn) 40%, transparent);
      background: none;
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
      @include m.enter;
    }
    .state.compact {
      padding: 24px 12px;
      border: 0;
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
    button {
      font: inherit;
    }
    .state button,
    .provider-group button {
      height: 34px;
      padding: 0 14px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      cursor: pointer;
    }
    .state-title + .state-hint + button {
      margin-top: 8px;
    }
    .notice {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0 0 16px;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text-2);
      font-size: 13px;
      line-height: 1.5;
    }
    .notice strong {
      color: var(--text);
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
    .source-providers {
      display: flex;
      flex-direction: column;
      gap: 24px;
      @include m.enter;
    }
    .provider-group h2 {
      @include m.label;
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 8px;
    }
    .section-count {
      padding: 0 6px;
      border-radius: 99px;
      background: var(--surface-3);
      color: var(--text-2);
      font-size: 10px;
      letter-spacing: 0;
      line-height: 16px;
      font-variant-numeric: tabular-nums;
    }
    .provider-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .provider-card {
      min-width: 0;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 8px 12px;
      transition:
        background-color 150ms var(--ease),
        border-color 150ms var(--ease);
    }
    .provider-card:hover {
      background: var(--surface-2);
      border-color: var(--border-strong);
    }
    .provider-header {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px 8px;
    }
    .provider-header .token {
      font-size: 13px;
      font-weight: 600;
    }
    .provided-in {
      font-size: 11px;
      padding: 1px 8px;
      border-radius: 99px;
      @include m.soft(var(--ok));
      border-width: 1px;
      border-style: solid;
    }
    .provider-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0 8px;
      margin-top: 4px;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-3);
    }
    .provider-meta .path {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .provider-meta .as {
      color: var(--text-2);
    }
  `,
})
export class DiInspector {
  rpc = input<DevframeRpcClient | null>(null);

  readonly nullId = NULL_ID;
  readonly roots = signal<InjectorNode[]>([]);
  readonly environment = signal<InjectorNode[]>([]);
  readonly sourceProviders = signal<SourceProvider[]>([]);
  readonly loaded = signal(false);
  readonly truncated = signal(false);
  readonly view = signal<TreeView>('element');
  readonly query = signal('');
  readonly onlyProviding = signal(false);
  readonly componentsOnly = signal(true);
  readonly collapsed = signal<ReadonlySet<string>>(new Set());
  readonly selectedId = signal<string | null>(null);
  readonly focusId = signal<string | null>(null);

  private readonly index = computed(() => {
    const map = new Map<string, InjectorNode>();
    const parents = new Map<string, string>();
    const walk = (nodes: InjectorNode[], parent: string | null) => {
      for (const node of nodes) {
        map.set(node.injector.id, node);
        if (parent) parents.set(node.injector.id, parent);
        walk(node.children, node.injector.id);
      }
    };
    walk(this.roots(), null);
    walk(this.environment(), null);
    return { map, parents };
  });

  readonly elementCount = computed(() => this.count(this.roots()));
  readonly environmentCount = computed(() => this.count(this.environment()));

  private readonly visible = computed(() => {
    let nodes = this.view() === 'element' ? this.roots() : this.environment();
    if (this.view() === 'element' && this.componentsOnly()) {
      nodes = this.prune(nodes, (n) => !!n.injector.component);
    }
    if (this.onlyProviding()) nodes = this.prune(nodes, (n) => n.providers.length > 0);
    const q = this.normalizedQuery();
    if (q) nodes = this.prune(nodes, (n) => this.nodeMatches(n, q));
    return nodes;
  });

  readonly rows = computed<Row[]>(() => {
    const rows: Row[] = [];
    const collapsed = this.collapsed();
    const searching = !!this.normalizedQuery();
    const walk = (nodes: InjectorNode[], depth: number) => {
      for (const node of nodes) {
        const expanded = searching || !collapsed.has(node.injector.id);
        rows.push({ node, depth, hasChildren: node.children.length > 0, expanded });
        if (expanded) walk(node.children, depth + 1);
      }
    };
    walk(this.visible(), 0);
    return rows;
  });

  readonly selected = computed(() => {
    const id = this.selectedId();
    const found = id ? this.index().map.get(id) : undefined;
    return found ?? this.rows()[0]?.node ?? null;
  });

  readonly rovingId = computed(() => {
    const rows = this.rows();
    const want = this.focusId() ?? this.selected()?.injector.id;
    if (want && rows.some((r) => r.node.injector.id === want)) return want;
    return rows[0]?.node.injector.id ?? null;
  });

  readonly path = computed(() => {
    const sel = this.selected();
    if (!sel) return [];
    const { map, parents } = this.index();
    let ids = sel.injector.path ?? [];
    if (!ids.length) {
      ids = [sel.injector.id];
      let parent = parents.get(sel.injector.id);
      while (parent) {
        ids.push(parent);
        parent = parents.get(parent);
      }
      ids.push(NULL_ID);
    }
    return ids.map((id) => {
      const node = map.get(id);
      return {
        id,
        label: node ? labelOf(node) : id === NULL_ID ? 'Null injector' : 'Not listed',
        kind: node ? kindOf(node) : 'null',
        providers: node?.providers.length ?? 0,
      };
    });
  });

  readonly providedBy = computed(() => {
    const q = this.normalizedQuery();
    if (!q) return [];
    const hits: { id: string; label: string; kind: string; tokens: string }[] = [];
    for (const node of this.index().map.values()) {
      const tokens = node.providers.filter((p) => p.token.toLowerCase().includes(q));
      if (!tokens.length) continue;
      hits.push({
        id: node.injector.id,
        label: labelOf(node),
        kind: kindOf(node),
        tokens: tokens.map((t) => t.token).join(', '),
      });
    }
    return hits.slice(0, 12);
  });

  readonly groupedProviders = computed(() => {
    const q = this.normalizedQuery();
    const filtered = q
      ? this.sourceProviders().filter(
          (p) => p.token.toLowerCase().includes(q) || p.file.toLowerCase().includes(q),
        )
      : this.sourceProviders();
    const groups: { type: string; label: string; items: SourceProvider[] }[] = [
      { type: 'root-provider', label: 'Root Providers (provide*)', items: [] },
      { type: 'injectable', label: 'Injectable Services', items: [] },
      { type: 'injection', label: 'inject() Calls', items: [] },
      { type: 'provider', label: 'Component Providers', items: [] },
    ];
    for (const p of filtered) groups.find((g) => g.type === p.type)?.items.push(p);
    return groups.filter((g) => g.items.length > 0);
  });

  readonly sourceMatchCount = computed(() =>
    this.groupedProviders().reduce((sum, g) => sum + g.items.length, 0),
  );

  private readonly normalizedQuery = computed(() => this.query().trim().toLowerCase());

  private readonly destroyRef = inject(DestroyRef);
  private stopTree: (() => void) | null = null;

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (!client) return;
      void this.loadInjectorTree(client);
      void this.loadSourceProviders(client);
    });
    this.destroyRef.onDestroy(() => {
      this.stopTree?.();
      this.highlight(null);
    });
  }

  label(node: InjectorNode) {
    return labelOf(node);
  }

  kind(node: InjectorNode) {
    return kindOf(node);
  }

  tone(kind: string) {
    return KIND_TONE[kind] ?? KIND_TONE['null'];
  }

  kindById(id: string) {
    const node = this.index().map.get(id);
    return node ? kindOf(node) : 'null';
  }

  labelById(id: string) {
    const node = this.index().map.get(id);
    return node ? labelOf(node) : id === NULL_ID ? 'Null injector' : 'not listed';
  }

  capital(text: string) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  matches(token: string) {
    const q = this.normalizedQuery();
    return !!q && token.toLowerCase().includes(q);
  }

  setView(view: TreeView) {
    if (this.view() === view) return;
    this.view.set(view);
    this.selectedId.set(null);
    this.focusId.set(null);
  }

  select(id: string) {
    this.selectedId.set(id);
    this.focusId.set(id);
  }

  toggle(id: string, event?: Event) {
    event?.stopPropagation();
    if (this.normalizedQuery()) return;
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  reveal(id: string) {
    const node = this.index().map.get(id);
    if (!node) return;
    this.setView(node.injector.type === 'element' ? 'element' : 'environment');
    const { parents } = this.index();
    this.collapsed.update((set) => {
      const next = new Set(set);
      let parent = parents.get(id);
      while (parent) {
        next.delete(parent);
        parent = parents.get(parent);
      }
      return next;
    });
    if (this.onlyProviding() && node.providers.length === 0) this.onlyProviding.set(false);
    if (node.injector.type === 'element' && !node.injector.component)
      this.componentsOnly.set(false);
    this.select(id);
    queueMicrotask(() => this.focusRow(id, false));
  }

  highlight(node: InjectorNode | null) {
    const client = this.rpc();
    if (!client) return;
    const selector = node?.injector.type === 'element' ? (node.injector.selector ?? null) : null;
    void client
      .scope('ng-devtools')
      .rpc.call('request-page-highlight', selector)
      .catch(() => {});
  }

  onTreeKey(event: KeyboardEvent) {
    const rows = this.rows();
    if (!rows.length) return;
    const roving = this.rovingId();
    const current = rows.findIndex((r) => r.node.injector.id === roving);
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
        if (row.hasChildren && !row.expanded) this.toggle(row.node.injector.id);
        else if (row.hasChildren) next = at + 1;
        break;
      case 'ArrowLeft':
        if (row.hasChildren && row.expanded && !this.normalizedQuery())
          this.toggle(row.node.injector.id);
        else {
          const parent = this.index().parents.get(row.node.injector.id);
          next = rows.findIndex((r) => r.node.injector.id === parent);
        }
        break;
      case 'Enter':
      case ' ':
        this.select(row.node.injector.id);
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next >= 0) {
      const id = rows[next].node.injector.id;
      this.focusId.set(id);
      this.selectedId.set(id);
      queueMicrotask(() => this.focusRow(id, true));
    }
  }

  private focusRow(id: string, focus: boolean) {
    const el = document.querySelector<HTMLElement>(`.row[data-id="${CSS.escape(id)}"]`);
    if (!el) return;
    if (focus) el.focus();
    el.scrollIntoView({ block: 'nearest' });
  }

  private async loadInjectorTree(client: DevframeRpcClient) {
    this.stopTree?.();
    this.stopTree = null;
    const my = client.scope('ng-devtools');
    let state: Awaited<ReturnType<typeof my.rpc.sharedState>>;
    try {
      state = await my.rpc.sharedState('injector-tree');
    } catch {
      return;
    }
    if (this.destroyRef.destroyed) return;
    const pageId = hostPageId();
    const apply = (value: unknown) => {
      const shared = value as {
        roots?: unknown;
        environment?: unknown;
        truncated?: unknown;
        pages?: Record<string, { roots?: unknown; environment?: unknown; truncated?: unknown }>;
      } | null;
      const next = (pageId ? shared?.pages?.[pageId] : undefined) ?? shared;
      if (isTree(next?.roots)) this.roots.set(next.roots);
      if (isTree(next?.environment)) this.environment.set(next.environment);
      this.truncated.set(next?.truncated === true);
    };
    apply(state.value());
    this.stopTree = state.on('updated', apply);
  }

  private async loadSourceProviders(client: DevframeRpcClient) {
    const my = client.scope('ng-devtools');
    try {
      this.sourceProviders.set((await my.rpc.call('get-providers')) as SourceProvider[]);
    } catch {
      this.sourceProviders.set([]);
    } finally {
      this.loaded.set(true);
    }
  }

  private count(nodes: InjectorNode[]): number {
    return nodes.reduce((sum, n) => sum + 1 + this.count(n.children), 0);
  }

  private nodeMatches(node: InjectorNode, q: string): boolean {
    const i = node.injector;
    return (
      i.name.toLowerCase().includes(q) ||
      !!i.component?.toLowerCase().includes(q) ||
      !!i.directives?.some((d) => d.toLowerCase().includes(q)) ||
      node.providers.some((p) => p.token.toLowerCase().includes(q)) ||
      !!node.dependencies?.some((d) => d.token.toLowerCase().includes(q))
    );
  }

  private prune(nodes: InjectorNode[], keep: (node: InjectorNode) => boolean): InjectorNode[] {
    const out: InjectorNode[] = [];
    for (const node of nodes) {
      const children = this.prune(node.children, keep);
      if (keep(node) || children.length) out.push({ ...node, children });
    }
    return out;
  }
}
