import { Component, computed, input, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import type { DevframeRpcClient } from 'devframe/client';
import { actionAllowed, actionBlockedMessage } from '../devtools-config';
import {
  SHARED_STYLES,
  routerAction,
  type ActiveRoute,
  type OutletInfo,
  type RouterPage,
} from './router-types';

interface RouteRow {
  route: ActiveRoute;
  depth: number;
}

interface OutletRow {
  outlet: OutletInfo;
  depth: number;
}

@Component({
  selector: 'app-route-current',
  imports: [JsonPipe],
  template: `
    @if (page().snapshot; as snapshot) {
      <p class="url">
        <span class="url-label">URL</span>
        <code>{{ snapshot.url }}</code>
      </p>
      @if (snapshot.urlDrift && snapshot.browserUrl) {
        <p class="note" role="note">
          The browser shows <code>{{ snapshot.browserUrl }}</code
          >, not the router URL (skipLocationChange, browserUrl, a failed navigation or code that
          changed history).
        </p>
      }
      @if (snapshot.pending; as pending) {
        <div class="pending" role="status">
          <span class="pulse" aria-hidden="true"></span>
          <span class="pending-text"
            >Navigating to <code>{{ pending.url }}</code> (#{{ pending.id }})</span
          >
          <button
            type="button"
            class="small"
            [disabled]="!navigationAllowed()"
            [attr.aria-describedby]="navigationAllowed() ? null : 'route-current-writes-off'"
            (click)="abort()"
          >
            Abort
          </button>
        </div>
        @if (!navigationAllowed()) {
          <p id="route-current-writes-off" class="muted">{{ navigationOff }}</p>
        }
      }
      @if (message()) {
        <p class="muted" role="status">{{ message() }}</p>
      }
      <dl class="facts">
        @if (snapshot.title) {
          <dt>Document title</dt>
          <dd>{{ snapshot.title }}</dd>
        }
        @if (hasKeys(snapshot.queryParams)) {
          <dt>Query params</dt>
          <dd>
            <code>{{ snapshot.queryParams | json }}</code>
          </dd>
        }
        @if (snapshot.fragment) {
          <dt>Fragment</dt>
          <dd>
            <code>{{ snapshot.fragment }}</code>
          </dd>
        }
      </dl>

      <h3>Active routes</h3>
      <div class="table-scroll" role="region" aria-label="Active routes" tabindex="0">
        <table>
          <thead>
            <tr>
              <th scope="col">Route</th>
              <th scope="col">Component</th>
              <th scope="col">Params</th>
              <th scope="col">Data</th>
              <th scope="col">Guards and resolvers</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track $index) {
              <tr>
                <td class="path" [style.padding-left.px]="14 + row.depth * 16">
                  {{ row.depth === 0 && !row.route.path ? '(root)' : '/' + row.route.path }}
                  @if (row.route.outlet !== 'primary') {
                    <span class="tag">{{ row.route.outlet }}</span>
                  }
                  @if (row.route.lazy) {
                    <span class="tag">lazy</span>
                  }
                  @if (row.route.title) {
                    <div class="sub">
                      title {{ row.route.title
                      }}{{ row.route.ownTitle === false ? ' (inherited)' : '' }}
                    </div>
                  }
                </td>
                <td>
                  @if (row.route.component) {
                    <code class="component">{{ row.route.component }}</code>
                  } @else {
                    <span class="nil" aria-hidden="true">–</span
                    ><span class="visually-hidden">none</span>
                  }
                </td>
                <td>
                  @for (entry of entries(row.route.params); track entry[0]) {
                    <div class="entry">
                      <code>{{ entry[0] }}: {{ entry[1] | json }}</code>
                      @if (row.route.paramSources?.[entry[0]] === 'inherited') {
                        <span class="tag">inherited</span>
                      }
                    </div>
                  } @empty {
                    <span class="nil" aria-hidden="true">–</span
                    ><span class="visually-hidden">none</span>
                  }
                </td>
                <td>
                  @for (entry of entries(row.route.data); track entry[0]) {
                    <div class="entry data">
                      <code>{{ entry[0] }}: {{ entry[1] | json }}</code>
                      @if (row.route.dataSources?.[entry[0]]; as source) {
                        <span class="tag">{{ source }}</span>
                      }
                    </div>
                  } @empty {
                    <span class="nil" aria-hidden="true">–</span
                    ><span class="visually-hidden">none</span>
                  }
                </td>
                <td>
                  @for (guard of guardList(row.route); track guard) {
                    <span class="tag">{{ guard }}</span>
                  }
                  @for (resolver of row.route.resolvers ?? []; track resolver) {
                    <span class="tag">resolve {{ resolver }}</span>
                  }
                  @if (!guardList(row.route).length && !row.route.resolvers?.length) {
                    <span class="nil" aria-hidden="true">–</span
                    ><span class="visually-hidden">none</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (outletRows().length) {
        <h3>Outlets</h3>
        <ul class="outlets">
          @for (row of outletRows(); track $index) {
            <li [style.padding-left.px]="10 + row.depth * 16">
              <span class="tag">{{ row.outlet.outlet }}</span>
              @if (row.outlet.activated) {
                <code>{{ row.outlet.component ?? '?' }}</code> for
                <code>{{ row.outlet.route ?? '?' }}</code>
              } @else {
                <span class="muted">not activated</span>
              }
              @if (row.outlet.detached) {
                <span class="tag">detached by reuse strategy</span>
              }
              @for (bound of boundInputs(row.outlet); track bound.input) {
                <span class="tag">input {{ bound.input }} ← {{ bound.source }}</span>
              }
              @if (row.outlet.data !== undefined) {
                <span class="outlet-data"
                  >routerOutletData <code>{{ row.outlet.data }}</code></span
                >
              }
            </li>
          }
        </ul>
      }
    } @else {
      <div class="empty">
        <p class="empty-title">This page reports no Router.</p>
        <p class="muted">
          Add <code>provideRouter()</code> to the app config and navigate once to see the active
          routes here.
        </p>
      </div>
    }
  `,
  styles: `
    ${SHARED_STYLES}
    :host {
      display: grid;
      gap: 16px;
      min-width: 0;
    }
    .url {
      display: flex;
      align-items: baseline;
      gap: 12px;
      min-width: 0;
      margin: 0;
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      box-shadow: var(--shadow);
    }
    .url-label {
      flex: none;
      color: var(--text-3);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .url code {
      min-width: 0;
      color: var(--accent);
      font-size: 14px;
      font-weight: 500;
    }
    .pending {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
      padding: 6px 6px 6px 14px;
      border: 1px solid color-mix(in srgb, var(--warn) 30%, transparent);
      border-radius: var(--radius-sm);
      background: color-mix(in srgb, var(--warn) 10%, transparent);
      color: var(--warn);
      font-size: 13px;
    }
    .pending-text {
      flex: 1 1 200px;
      min-width: 0;
    }
    .pending code {
      color: var(--text-strong);
    }
    .pulse {
      flex: none;
      width: 8px;
      height: 8px;
      border-radius: 99px;
      background: var(--warn);
      animation: pulse 1.2s ease-in-out infinite;
    }
    @keyframes pulse {
      50% {
        opacity: 0.35;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .pulse {
        animation: none;
      }
    }
    .sub {
      margin-top: 4px;
      color: var(--text-2);
      font-family: var(--font-sans);
      font-size: 12px;
      white-space: normal;
    }
    .component {
      color: var(--text-strong);
    }
    .entry + .entry {
      margin-top: 2px;
    }
    .data {
      max-width: 360px;
    }
    .outlets {
      display: grid;
      gap: 2px;
      margin: 0;
      padding: 6px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--text);
      font-size: 13px;
      list-style: none;
      animation: enter 0.35s var(--ease) both;
    }
    .outlets li {
      padding-top: 6px;
      padding-right: 10px;
      padding-bottom: 6px;
      border-radius: var(--radius-sm);
      line-height: 1.8;
      overflow-wrap: anywhere;
      transition: background-color 0.15s var(--ease);
    }
    .outlets li:hover {
      background: var(--surface-2);
    }
    .outlet-data {
      display: block;
      color: var(--text-2);
      font-size: 12px;
    }
  `,
})
export class RouteCurrent {
  page = input.required<RouterPage>();
  rpc = input<DevframeRpcClient | null>(null);
  readonly navigationAllowed = computed(() => actionAllowed(this.rpc(), 'router'));
  protected readonly navigationOff = actionBlockedMessage('router');

  readonly message = signal('');

  readonly rows = computed(() => {
    const rows: RouteRow[] = [];
    const visit = (route: ActiveRoute, depth: number) => {
      rows.push({ route, depth });
      for (const child of route.children) visit(child, depth + 1);
    };
    const root = this.page().snapshot?.root;
    if (root) visit(root, 0);
    return rows;
  });

  readonly outletRows = computed(() => {
    const rows: OutletRow[] = [];
    const visit = (outlets: OutletInfo[], depth: number) => {
      for (const outlet of outlets) {
        rows.push({ outlet, depth });
        if (outlet.children) visit(outlet.children, depth + 1);
      }
    };
    visit(this.page().outlets ?? [], 0);
    return rows;
  });

  hasKeys(value: Record<string, unknown>) {
    return Object.keys(value).length > 0;
  }

  entries(value: Record<string, unknown>) {
    return Object.entries(value);
  }

  guardList(route: ActiveRoute) {
    return Object.entries(route.guards ?? {}).flatMap(([kind, names]) =>
      names.map((name) => `${kind} ${name}`),
    );
  }

  boundInputs(outlet: OutletInfo) {
    return (outlet.inputs ?? []).filter((input) => input.source !== 'unset');
  }

  async abort() {
    const result = await routerAction(this.rpc(), this.page().pageId, { action: 'abort' });
    this.message.set(
      result['error'] ? String(result['error']) : `Aborted navigation #${result['aborted']}.`,
    );
  }
}
