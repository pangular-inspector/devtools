import { Component, computed, input, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import type { DevframeRpcClient } from 'devframe/client';
import {
  SHARED_STYLES,
  routerAction,
  routerCall,
  type RouteNode,
  type RouterPage,
} from './router-types';

interface NodeRow {
  node: RouteNode;
  depth: number;
}

interface MatchResult {
  matched: boolean;
  chain: RouteNode[];
  params: Record<string, string>;
  notes: string[];
  nearest: string[];
}

@Component({
  selector: 'app-route-tree',
  imports: [JsonPipe],
  template: `
    <form class="test" (submit)="$event.preventDefault(); predict()">
      <label for="test-url">Test a URL</label>
      <input
        id="test-url"
        class="field"
        type="text"
        placeholder="/users/42"
        [value]="testUrl()"
        (input)="testUrl.set($any($event.target).value)"
      />
      <button type="submit" class="small">Predict</button>
      <button type="button" class="small" (click)="probe()">Probe in app</button>
    </form>
    @if (match(); as result) {
      <div class="result" role="status">
        @if (result.matched) {
          Matches {{ chainText(result) }}
          @if (hasKeys(result.params)) {
            with <code>{{ result.params | json }}</code>
          }
        } @else {
          Matches no route (NG04002).
          @if (result.nearest.length) {
            Nearest: {{ result.nearest.join(', ') }}
          }
        }
        @for (note of result.notes; track note) {
          <div class="muted">{{ note }}</div>
        }
      </div>
    }
    @if (message()) {
      <p class="muted" role="status">{{ message() }}</p>
    }

    <input
      class="field filter"
      type="text"
      aria-label="Filter routes"
      placeholder="Filter by path or component"
      [value]="filter()"
      (input)="filter.set($any($event.target).value)"
    />
    @if (!page().config) {
      <p class="muted">
        {{
          page().setup?.mode === 'events-only'
            ? 'This build has no debug utils, so the live config cannot be read.'
            : 'The page has not reported its route config yet.'
        }}
      </p>
    } @else {
      <p class="muted">
        Generation {{ page().generation }} · {{ rows().length }} route(s). Lazy routes show their
        children once loaded.
      </p>
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
              <tr [class.active]="isActive(row.node)">
                <td class="path" [style.padding-left.px]="12 + row.depth * 16">
                  {{ row.node.fullPath }}
                  @if (isActive(row.node)) {
                    <span class="tag tag-active">active</span>
                  }
                  @if (row.node.lazy) {
                    <span class="tag">lazy {{ row.node.lazy }}</span>
                  }
                  @if (row.node.outlet) {
                    <span class="tag">outlet {{ row.node.outlet }}</span>
                  }
                </td>
                <td>
                  @if (row.node.redirectTo !== undefined) {
                    redirect → <code>{{ row.node.redirectTo }}</code>
                  } @else {
                    {{
                      row.node.component ??
                        (row.node.lazy === 'unloaded' ? 'lazy, not loaded yet' : row.node.kind)
                    }}
                  }
                </td>
                <td>
                  @for (guard of guardList(row.node); track guard) {
                    <span class="tag">{{ guard }}</span>
                  }
                  @for (resolver of row.node.resolvers ?? []; track resolver) {
                    <span class="tag">resolve {{ resolver }}</span>
                  }
                </td>
                <td>{{ row.node.title ?? '' }}</td>
                <td class="actions">
                  @if (canNavigate(row.node)) {
                    @for (param of params(row.node); track param) {
                      <input
                        class="field param"
                        type="text"
                        [attr.aria-label]="param + ' for ' + row.node.fullPath"
                        [placeholder]="param"
                        (input)="setParam(row.node.id, param, $any($event.target).value)"
                      />
                    }
                    <button
                      type="button"
                      class="small"
                      (click)="navigate(row.node)"
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
                </td>
              </tr>
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
      gap: 10px;
    }
    .test {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      font-size: 13px;
      color: #e4e4e7;
    }
    .result {
      padding: 8px 10px;
      border: 1px solid #27272a;
      border-radius: 6px;
      font-size: 13px;
      color: #e4e4e7;
    }
    .filter {
      max-width: 320px;
    }
    .path {
      font-family: monospace;
      color: var(--accent);
      white-space: nowrap;
    }
    tr.active td {
      background: #1c1917;
    }
    .tag-active {
      background: #14532d;
      border-color: #14532d;
      color: #bbf7d0;
    }
    .actions {
      white-space: nowrap;
    }
    .param {
      width: 80px;
      margin-right: 4px;
    }
  `,
})
export class RouteTree {
  page = input.required<RouterPage>();
  rpc = input<DevframeRpcClient | null>(null);

  readonly filter = signal('');
  readonly testUrl = signal('');
  readonly match = signal<MatchResult | null>(null);
  readonly message = signal('');
  private readonly paramValues = new Map<string, Record<string, string>>();

  readonly active = computed(() => new Set(this.page().activeIds ?? []));

  readonly rows = computed(() => {
    const needle = this.filter().toLowerCase();
    const rows: NodeRow[] = [];
    const visit = (nodes: RouteNode[], depth: number) => {
      for (const node of nodes) {
        if (
          !needle ||
          node.fullPath.toLowerCase().includes(needle) ||
          !!node.component?.toLowerCase().includes(needle)
        ) {
          rows.push({ node, depth });
        }
        if (node.children) visit(node.children, depth + 1);
      }
    };
    visit(this.page().config ?? [], 0);
    return rows;
  });

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
      !node.outlet &&
      !node.fullPath.includes('**') &&
      (!!node.component || node.kind === 'component' || node.kind === 'lazy')
    );
  }

  setParam(id: string, name: string, value: string) {
    this.paramValues.set(id, { ...this.paramValues.get(id), [name]: value });
  }

  chainText(result: MatchResult) {
    return result.chain.map((node) => node.fullPath).join(' → ');
  }

  async predict() {
    const url = this.testUrl().trim();
    if (!url) return;
    this.match.set(
      await routerCall<MatchResult>(this.rpc(), 'router-match', {
        pageId: this.page().pageId,
        url,
      }),
    );
  }

  async probe() {
    const url = this.testUrl().trim();
    if (!url) return;
    this.message.set('Running the real matcher in the app…');
    const result = await routerAction(this.rpc(), this.page().pageId, { action: 'probe', url });
    if (!result || result['error']) {
      this.message.set(String(result?.['error'] ?? 'Probe failed.'));
      return;
    }
    this.message.set(
      result['matched']
        ? `The app matched ${url} (see the probe entry in Navigations).`
        : `The app did not match ${url}: ${String(result['reason'] ?? '')}`,
    );
  }

  async navigate(node: RouteNode) {
    const values = this.paramValues.get(node.id) ?? {};
    this.message.set(`Navigating to ${node.fullPath}…`);
    const result = await routerAction(this.rpc(), this.page().pageId, {
      action: 'navigate',
      pattern: node.fullPath,
      params: values,
    });
    this.message.set(
      !result || result['error']
        ? String(result?.['error'] ?? 'Navigation failed.')
        : `Navigation #${result['id']}: ${result['outcome']}${result['finalUrl'] ? ` at ${result['finalUrl']}` : ''}.`,
    );
  }

  async resolveLazy(node: RouteNode) {
    const result = await routerAction(this.rpc(), this.page().pageId, {
      action: 'resolve-lazy',
      id: node.id,
    });
    if (!result || result['error']) {
      this.message.set(String(result?.['error'] ?? 'Could not read the lazy routes.'));
      return;
    }
    const routes = (result['routes'] as { path: string }[]) ?? [];
    this.message.set(
      `${node.fullPath} declares ${routes.length} route(s): ${routes.map((r) => `/${r.path}`).join(', ')}. The router loads them for real on the first navigation that needs them.`,
    );
  }
}
