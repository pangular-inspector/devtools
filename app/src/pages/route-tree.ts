import {
  Component,
  ElementRef,
  computed,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { JsonPipe } from '@angular/common';
import type { DevframeRpcClient } from 'devframe/client';
import { actionAllowed, actionBlockedMessage } from '../devtools-config';
import {
  PAGE_UNREACHABLE,
  SHARED_STYLES,
  routerAction,
  routerCall,
  sourceLocation,
  sourceOf,
  type RouteNode,
  type RouterPage,
  type SourceRoute,
} from './router-types';
import { SourceLink } from '../ui/source-link';

/** "3 of 12 routes": the filtered count, worded like the other panel pages. */
export function routeCountText(matches: number, total: number): string {
  return `${matches} of ${total} ${total === 1 ? 'route' : 'routes'}`;
}

interface NodeRow {
  node: RouteNode;
  depth: number;
  source?: string;
  at?: SourceRoute;
}

interface MatchResult {
  matched: boolean;
  chain: RouteNode[];
  params: Record<string, string>;
  notes: string[];
  nearest: string[];
}

/** A Predict answer and the URL it was asked for. */
interface TestedUrl {
  url: string;
  result: MatchResult;
}

@Component({
  selector: 'app-route-tree',
  imports: [JsonPipe, SourceLink],
  template: `
    <form class="test" (submit)="$event.preventDefault(); predict()">
      <label for="test-url">Test a URL</label>
      <input
        #urlInput
        id="test-url"
        class="field"
        type="text"
        placeholder="/users/42"
        [value]="testUrl()"
        (input)="editUrl($any($event.target).value)"
      />
      <button type="submit" class="small primary">Predict</button>
      <button
        type="button"
        class="small"
        [disabled]="!navigationAllowed()"
        [attr.aria-describedby]="navigationAllowed() ? null : 'route-tree-writes-off'"
        (click)="probe()"
      >
        Probe in app
      </button>
    </form>
    @if (match(); as tested) {
      @let result = tested.result;
      <div class="result" role="status" [attr.data-matched]="result.matched">
        <span class="for"
          >Result for <code>{{ tested.url }}</code
          >:</span
        >
        @if (result.matched) {
          <span class="badge" data-tone="good">match</span>
          Matches <code class="chain">{{ chainText(result) }}</code>
          @if (hasKeys(result.params)) {
            with <code>{{ result.params | json }}</code>
          }
        } @else {
          <span class="badge" data-tone="bad">no match</span>
          Matches no route (NG04002).
          @if (result.nearest.length) {
            Nearest: <code>{{ result.nearest.join(', ') }}</code>
          }
        }
        @for (note of result.notes; track note) {
          <div class="muted">{{ note }}</div>
        }
      </div>
    }
    @if (message()) {
      <p class="message" role="status">{{ message() }}</p>
    }
    <p class="visually-hidden" role="status">{{ rowResult()?.text }}</p>
    @if (!navigationAllowed()) {
      <p id="route-tree-writes-off" class="message">{{ navigationOff }}</p>
    }

    <div class="filter-row">
      <input
        #filterInput
        class="field filter"
        type="search"
        aria-label="Filter routes"
        placeholder="Filter by path, component or file"
        [value]="filter()"
        (input)="setFilter($any($event.target).value)"
        (keydown.escape)="setFilter('')"
      />
      @if (page().config) {
        <p class="muted summary">
          Generation {{ page().generation }} ·
          @if (filter()) {
            <span class="count">{{ countText() }}</span
            >.
          } @else {
            {{ rows().length }} route(s).
          }
          Lazy routes show their children once loaded.
          @if (page().configTruncated; as left) {
            {{ left }} route(s) left out: the page lists at most 200 routes per level and 1000 in
            total.
          }
        </p>
      }
    </div>
    <p class="visually-hidden" role="status">{{ filterAnnouncement() }}</p>
    @if (!page().config) {
      <div class="empty">
        <p class="empty-title">
          {{
            page().setup?.mode === 'events-only'
              ? 'This build has no debug utils, so the live config cannot be read.'
              : 'The page has not reported its route config yet.'
          }}
        </p>
        <p class="muted">
          {{
            page().setup?.mode === 'events-only'
              ? 'Run the app with the development build to inspect the live config.'
              : 'It appears once the router initializes. Navigate in the app if it stays empty.'
          }}
        </p>
      </div>
    } @else if (!rows().length) {
      <div class="empty">
        <p class="empty-title">No routes match the filter.</p>
        <p class="muted">Try a shorter path or a component name.</p>
        <button type="button" class="small" (click)="setFilter(''); filterInput.focus()">
          Clear filter
        </button>
      </div>
    } @else {
      <div class="table-scroll" role="region" aria-label="Live route config" tabindex="0">
        <table>
          <thead>
            <tr>
              <th scope="col">Path</th>
              <th scope="col">Target</th>
              <th scope="col">Guards and resolvers</th>
              <th scope="col">Title</th>
              <th scope="col"><span class="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.node.id) {
              <tr #rowEl [class.active]="isActive(row.node)">
                <td class="path" [style.padding-left.px]="14 + row.depth * 16">
                  {{ row.node.fullPath }}
                  @if (isActive(row.node)) {
                    <span class="tag">active</span>
                  }
                  @if (row.node.lazy) {
                    <span class="tag">lazy {{ row.node.lazy }}</span>
                  }
                  @if (row.node.outlet) {
                    <span class="tag">outlet {{ row.node.outlet }}</span>
                  }
                  @if (row.at) {
                    <span class="src"
                      ><span class="visually-hidden">declared in </span
                      ><app-source-link [file]="row.at.file" [line]="row.at.line"
                    /></span>
                  }
                </td>
                <td>
                  @if (row.node.redirectTo !== undefined) {
                    <span class="redirect"
                      >redirect <span aria-hidden="true">→</span>
                      <code>{{ row.node.redirectTo }}</code></span
                    >
                  } @else {
                    {{
                      row.node.component ??
                        (row.node.lazy === 'unloaded' ? 'lazy, not loaded yet' : row.node.kind)
                    }}
                  }
                </td>
                <td>
                  @for (guard of guardList(row.node); track $index) {
                    <span class="tag">{{ guard }}</span>
                  }
                  @for (resolver of row.node.resolvers ?? []; track resolver) {
                    <span class="tag">resolve {{ resolver }}</span>
                  }
                  @if (!guardList(row.node).length && !row.node.resolvers?.length) {
                    <span class="nil" aria-hidden="true">–</span
                    ><span class="visually-hidden">none</span>
                  }
                </td>
                <td>
                  @if (row.node.title) {
                    {{ row.node.title }}
                  } @else {
                    <span class="nil" aria-hidden="true">–</span
                    ><span class="visually-hidden">none</span>
                  }
                </td>
                <td class="actions">
                  <div class="actions-inner">
                    @if (canNavigate(row.node)) {
                      @for (param of params(row.node); track param) {
                        <input
                          class="field param"
                          type="text"
                          [attr.aria-label]="param + ' for ' + row.node.fullPath"
                          [attr.aria-invalid]="isInvalid(row.node, param) ? 'true' : null"
                          [attr.aria-describedby]="
                            isInvalid(row.node, param) ? 'route-tree-row-result' : null
                          "
                          [placeholder]="param"
                          [value]="paramValues()[row.node.id]?.[param] ?? ''"
                          (input)="setParam(row.node.id, param, $any($event.target).value)"
                        />
                      }
                      <button
                        type="button"
                        class="small"
                        [disabled]="!navigationAllowed()"
                        [attr.aria-describedby]="
                          navigationAllowed() ? null : 'route-tree-writes-off'
                        "
                        (click)="navigate(row.node, rowEl)"
                        [attr.aria-label]="'Navigate to ' + row.node.fullPath"
                      >
                        Go
                      </button>
                    }
                    @if (row.node.kind === 'lazy' && row.node.lazy === 'unloaded') {
                      <button
                        type="button"
                        class="small"
                        (click)="resolveLazy(row.node)"
                        [attr.aria-label]="'Read lazy routes of ' + row.node.fullPath"
                      >
                        Read lazy
                      </button>
                    }
                  </div>
                </td>
              </tr>
              @if (rowResult()?.id === row.node.id) {
                <tr class="row-result">
                  <td colspan="5">
                    <p id="route-tree-row-result">{{ rowResult()?.text }}</p>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    ${SHARED_STYLES}
    :host {
      display: grid;
      gap: 12px;
      min-width: 0;
    }
    .test {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      box-shadow: var(--shadow);
      color: var(--text);
      font-size: 13px;
    }
    .test label {
      margin-right: 4px;
      color: var(--text-3);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .test input {
      flex: 1 1 200px;
      min-width: 0;
      font-family: var(--font-mono);
      font-size: 12.5px;
    }
    .result {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      align-items: center;
      padding: 10px 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font-size: 13px;
      line-height: 1.5;
      animation: enter 0.35s var(--ease) both;
    }
    .result[data-matched='true'] {
      box-shadow: inset 3px 0 0 var(--ok);
    }
    .result[data-matched='false'] {
      box-shadow: inset 3px 0 0 var(--danger);
    }
    .result .muted {
      flex-basis: 100%;
      font-size: 12px;
    }
    .result .for {
      color: var(--text-2);
    }
    .result .for code {
      color: var(--text);
      overflow-wrap: anywhere;
    }
    .chain {
      color: var(--accent);
    }
    .message {
      margin: 0;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    .filter-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      align-items: center;
    }
    .filter {
      flex: 0 1 320px;
      min-width: 0;
    }
    .summary {
      flex: 1 1 240px;
      margin: 0;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .summary .count {
      color: var(--text);
      font-weight: 600;
    }
    td {
      vertical-align: middle;
    }
    .redirect {
      color: var(--text-2);
    }
    .src {
      display: block;
      margin-top: 2px;
      color: var(--text-2);
      font-family: var(--font-mono);
      font-size: 11.5px;
      overflow-wrap: anywhere;
    }
    tr.active td {
      background: var(--accent-soft);
      color: var(--text-strong);
    }
    tr.active:hover td {
      background: color-mix(in srgb, var(--accent) 16%, transparent);
    }
    tr.active td:first-child {
      box-shadow: inset 3px 0 0 var(--accent);
    }
    .actions {
      width: 1%;
      padding-top: 6px;
      padding-bottom: 6px;
      white-space: nowrap;
    }
    .actions-inner {
      display: flex;
      gap: 6px;
      align-items: center;
      justify-content: flex-end;
    }
    .param {
      width: 96px;
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .param[aria-invalid='true'] {
      border-color: var(--danger);
    }
    .row-result td {
      padding-top: 0;
      background: transparent;
    }
    .row-result p {
      margin: 0;
      color: var(--text);
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    @media (max-width: 480px) {
      .filter {
        flex-basis: 100%;
      }
    }
  `,
})
export class RouteTree {
  page = input.required<RouterPage>();
  rpc = input<DevframeRpcClient | null>(null);
  readonly navigationAllowed = computed(() => actionAllowed(this.rpc(), 'router'));
  protected readonly navigationOff = actionBlockedMessage('router');
  sources = input<SourceRoute[]>([]);

  readonly filter = signal('');
  readonly testUrl = signal('');
  private readonly pageId = computed(() => this.page().pageId);
  // Results, messages and typed params belong to one page. The component stays mounted when
  // the page picker switches pages, so they start over whenever the pageId changes.
  readonly match = linkedSignal<string, TestedUrl | null>({
    source: this.pageId,
    computation: () => null,
  });
  readonly message = linkedSignal<string, string>({ source: this.pageId, computation: () => '' });
  readonly rowResult = linkedSignal<string, { id: string; text: string } | null>({
    source: this.pageId,
    computation: () => null,
  });
  protected readonly paramValues = linkedSignal<string, Record<string, Record<string, string>>>({
    source: this.pageId,
    computation: () => ({}),
  });
  private readonly checkedRow = linkedSignal<string, string | null>({
    source: this.pageId,
    computation: () => null,
  });
  /** Spoken only from the filter input, so a poll that changes the routes stays quiet. */
  readonly filterAnnouncement = linkedSignal<string, string>({
    source: this.pageId,
    computation: () => '',
  });
  private predictSeq = 0;
  private announceFlip = false;
  private probeSeq = 0;
  private readonly urlInput = viewChild<ElementRef<HTMLInputElement>>('urlInput');

  readonly active = computed(() => new Set(this.page().activeIds ?? []));

  readonly rows = computed(() => {
    const needle = this.filter().toLowerCase();
    const sources = this.sources();
    const rows: NodeRow[] = [];
    const visit = (nodes: RouteNode[], depth: number) => {
      for (const node of nodes) {
        const found = sourceOf(node, sources);
        const source = found && sourceLocation(found);
        if (
          !needle ||
          node.fullPath.toLowerCase().includes(needle) ||
          !!node.component?.toLowerCase().includes(needle) ||
          !!source?.toLowerCase().includes(needle)
        ) {
          rows.push({ node, depth, source, at: found });
        }
        if (node.children) visit(node.children, depth + 1);
      }
    };
    visit(this.page().config ?? [], 0);
    return rows;
  });

  readonly total = computed(() => {
    const count = (nodes: RouteNode[]): number =>
      nodes.reduce((sum, node) => sum + 1 + count(node.children ?? []), 0);
    return count(this.page().config ?? []);
  });

  readonly countText = computed(() => routeCountText(this.rows().length, this.total()));

  setFilter(value: string) {
    this.filter.set(value);
    const matches = this.rows().length;
    const text = !value
      ? ''
      : matches
        ? `${routeCountText(matches, this.total())} match.`
        : 'No routes match.';
    // A new query with the same count still changes the text, so screen readers say it again.
    this.announceFlip = !this.announceFlip;
    this.filterAnnouncement.set(text && (this.announceFlip ? `${text}\u00a0` : text));
  }

  hasKeys(value: Record<string, unknown>) {
    return Object.keys(value).length > 0;
  }

  isActive(node: RouteNode) {
    return this.active().has(node.id);
  }

  guardList(node: RouteNode) {
    return Object.entries(node.guards ?? {}).flatMap(([kind, names]) =>
      names.map((name) => `${kind} ${name}`),
    );
  }

  params(node: RouteNode) {
    return (node.fullPath.match(/:([A-Za-z0-9_]+)/g) ?? []).map((p) => p.slice(1));
  }

  canNavigate(node: RouteNode) {
    return (
      node.redirectTo === undefined &&
      !node.matcher &&
      !node.outlet &&
      !node.fullPath.includes('**') &&
      (!!node.component || node.kind === 'component' || node.kind === 'lazy')
    );
  }

  setParam(id: string, name: string, value: string) {
    this.paramValues.update((all) => ({ ...all, [id]: { ...all[id], [name]: value } }));
  }

  missingParams(node: RouteNode) {
    const values = this.paramValues()[node.id] ?? {};
    return this.params(node).filter((param) => !values[param]);
  }

  isInvalid(node: RouteNode, param: string) {
    return this.checkedRow() === node.id && !this.paramValues()[node.id]?.[param];
  }

  chainText(result: MatchResult) {
    return result.chain.map((node) => node.fullPath).join(' → ');
  }

  /** A new URL makes the shown result and any answer still on its way stale. */
  editUrl(value: string) {
    this.testUrl.set(value);
    this.predictSeq++;
    this.probeSeq++;
    this.match.set(null);
    this.message.set('');
  }

  private askForUrl(verb: string) {
    this.match.set(null);
    this.message.set(`Type a URL to ${verb}, for example /users/42.`);
    this.urlInput()?.nativeElement.focus();
  }

  async predict() {
    const url = this.testUrl().trim();
    const seq = ++this.predictSeq;
    if (!url) {
      this.askForUrl('predict');
      return;
    }
    const pageId = this.pageId();
    const result = await routerCall<MatchResult>(this.rpc(), 'router-match', { pageId, url });
    if (seq !== this.predictSeq || pageId !== this.pageId()) return;
    this.match.set(result && { url, result });
    if (result) {
      if (this.message() === PAGE_UNREACHABLE) this.message.set('');
    } else {
      this.message.set(PAGE_UNREACHABLE);
    }
  }

  async probe() {
    const url = this.testUrl().trim();
    const seq = ++this.probeSeq;
    if (!url) {
      this.askForUrl('probe');
      return;
    }
    this.message.set('Running the real matcher in the app…');
    const pageId = this.pageId();
    const result = await routerAction(this.rpc(), pageId, { action: 'probe', url });
    if (seq !== this.probeSeq || pageId !== this.pageId()) return;
    if (result['error']) {
      this.message.set(String(result['error']));
      return;
    }
    this.message.set(
      result['matched']
        ? `The app recognized ${url} and its canMatch guards passed. The probe stopped before canActivate guards and resolvers, so those did not run. See the probe entry in Navigations.`
        : typeof result['redirectedTo'] === 'string'
          ? `A canMatch guard or the navigation error handler redirected ${url} to ${result['redirectedTo']}. The probe stopped that navigation before it rendered anything.`
          : `The app could not recognize ${url}: ${String(result['reason'] ?? '')}`,
    );
  }

  async navigate(node: RouteNode, row?: HTMLElement) {
    const missing = this.missingParams(node);
    if (missing.length) {
      this.checkedRow.set(node.id);
      this.rowResult.set({
        id: node.id,
        text: `Fill in ${missing.map((param) => `:${param}`).join(', ')} to navigate.`,
      });
      Array.from(row?.querySelectorAll<HTMLInputElement>('input.param') ?? [])
        .find((field) => !field.value)
        ?.focus();
      return;
    }
    this.checkedRow.set(null);
    this.rowResult.set({ id: node.id, text: `Navigating to ${node.fullPath}…` });
    const pageId = this.pageId();
    const result = await routerAction(this.rpc(), pageId, {
      action: 'navigate',
      pattern: node.fullPath,
      params: this.paramValues()[node.id] ?? {},
    });
    if (pageId !== this.pageId()) return;
    this.rowResult.set({
      id: node.id,
      text: result['error']
        ? String(result['error'])
        : `Navigation #${result['id']}: ${result['outcome']}${result['finalUrl'] ? ` at ${result['finalUrl']}` : ''}.`,
    });
  }

  async resolveLazy(node: RouteNode) {
    const pageId = this.pageId();
    const result = await routerAction(this.rpc(), pageId, {
      action: 'resolve-lazy',
      id: node.id,
    });
    if (pageId !== this.pageId()) return;
    if (result['error']) {
      this.rowResult.set({ id: node.id, text: String(result['error']) });
      return;
    }
    const routes = (result['routes'] as { path: string }[]) ?? [];
    this.rowResult.set({
      id: node.id,
      text: `${node.fullPath} declares ${routes.length} route(s): ${routes.map((r) => `/${r.path}`).join(', ')}. The router loads them for real on the first navigation that needs them.`,
    });
  }
}
