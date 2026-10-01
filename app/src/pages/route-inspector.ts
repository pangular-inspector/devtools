import { Component, computed, effect, input, linkedSignal, signal, viewChild } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { isStaticReport } from '../rpc';
import { LiveRoute } from './live-route';
import { SHARED_STYLES, sourceLocation, type SourceRoute } from './router-types';

@Component({
  selector: 'app-route-inspector',
  imports: [LiveRoute],
  template: `
    <app-live-route [rpc]="rpc()" [sources]="routes()" />

    <section class="config" aria-labelledby="config-heading">
      <div class="section-head">
        <h2 id="config-heading">Source route config</h2>
        <span class="muted hint">
          Read from your source files.
          @if (liveHasConfig()) {
            The Routes tab above shows what the router uses.
          }
        </span>
        @if (liveHasConfig()) {
          <button
            type="button"
            class="small toggle"
            aria-controls="config-body"
            [attr.aria-expanded]="expanded()"
            (click)="expanded.set(!expanded())"
          >
            {{ expanded() ? 'Hide table' : 'Show table' }}
          </button>
        }
      </div>
      <div id="config-body" class="config-body" [hidden]="!expanded()">
        <div class="toolbar">
          <input
            #filterInput
            class="field"
            type="text"
            aria-label="Filter source routes"
            placeholder="Filter routes…"
            [value]="filter()"
            (input)="onFilterInput($event)"
          />
          <button type="button" class="small" [attr.aria-busy]="loading()" (click)="refresh()">
            {{ loading() ? 'Scanning…' : 'Refresh' }}
          </button>
        </div>

        @if (error()) {
          <div class="empty" role="alert">
            <p class="empty-title">Could not scan the route files.</p>
            <p class="muted">
              @if (staticReport()) {
                Run <code>ng-devtools build</code> again to rebuild the report.
              } @else {
                Check that the dev server is running, then refresh.
              }
            </p>
          </div>
        } @else if (loading() && routes().length === 0) {
          <p class="muted empty" role="status">Scanning routes…</p>
        } @else if (filtered().length === 0) {
          @if (routes().length) {
            <div class="empty">
              <p class="empty-title">No routes match the filter.</p>
              <p class="muted">Search by path, component, guard, title or file name.</p>
              <button type="button" class="small" (click)="filter.set(''); filterInput.focus()">
                Clear filter
              </button>
            </div>
          } @else {
            <div class="empty">
              <p class="empty-title">No routes found.</p>
              <p class="muted">
                Routes are read from <code>*.routes.ts</code> and <code>*routing.module.ts</code>
                files, the files they lazy load, plus Analog pages. Add one and refresh.
              </p>
            </div>
          }
        } @else {
          <p class="muted count">
            {{ filtered().length }} of {{ routes().length }} route entries,
            {{ navigable() }} navigable
          </p>
          <div
            class="table-scroll"
            role="region"
            aria-label="Source route config table"
            tabindex="0"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Path</th>
                  <th scope="col">Component / Target</th>
                  <th scope="col">Guards and resolvers</th>
                  <th scope="col">Title</th>
                  <th scope="col">Declared in</th>
                </tr>
              </thead>
              <tbody>
                @for (route of filtered(); track $index) {
                  <tr>
                    <td class="path">
                      {{ route.fullPath }}
                      @if (route.kind !== 'page') {
                        <span class="tag">{{ route.kind }}</span>
                      }
                    </td>
                    <td>
                      @if (route.redirectTo !== undefined) {
                        <span class="redirect"
                          ><span aria-hidden="true">→</span
                          ><span class="visually-hidden">redirects to</span>
                          {{ route.redirectTo }}</span
                        >
                      } @else if (route.component) {
                        <code class="component">{{ route.component }}</code>
                      } @else {
                        <span class="nil" aria-hidden="true">–</span
                        ><span class="visually-hidden">none</span>
                      }
                    </td>
                    <td>
                      @for (guard of checks(route); track $index) {
                        <span class="tag">{{ guard }}</span>
                      } @empty {
                        <span class="nil" aria-hidden="true">–</span
                        ><span class="visually-hidden">none</span>
                      }
                    </td>
                    <td>
                      @if (route.title) {
                        {{ route.title }}
                      } @else {
                        <span class="nil" aria-hidden="true">–</span
                        ><span class="visually-hidden">none</span>
                      }
                    </td>
                    <td class="file">{{ location(route) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    ${SHARED_STYLES}
    :host {
      display: block;
      min-width: 0;
    }
    .config {
      display: grid;
      gap: 12px;
      min-width: 0;
    }
    .section-head {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      align-items: baseline;
    }
    h2 {
      margin: 0;
      color: var(--text-3);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .hint,
    .count {
      margin: 0;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .count {
      margin-bottom: -4px;
      padding: 0 4px;
    }
    .config-body {
      display: grid;
      gap: 12px;
      min-width: 0;
    }
    .config-body[hidden] {
      display: none;
    }
    .toggle {
      margin-left: auto;
    }
    .toolbar {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .toolbar .field {
      flex: 1;
      min-width: 0;
    }
    .component {
      color: var(--text-strong);
    }
    .redirect {
      color: var(--text-2);
      font-family: var(--font-mono);
      font-size: 12.5px;
      overflow-wrap: anywhere;
    }
    .file {
      min-width: 160px;
      color: var(--text-2);
      font-family: var(--font-mono);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
  `,
})
export class RouteInspector {
  rpc = input<DevframeRpcClient | null>(null);
  staticReport = computed(() => isStaticReport(this.rpc()));

  routes = signal<SourceRoute[]>([]);
  filter = signal('');
  loading = signal(false);
  error = signal(false);

  private readonly live = viewChild(LiveRoute);
  readonly liveHasConfig = computed(() => !!this.live()?.page()?.config);
  readonly expanded = linkedSignal(() => !this.liveHasConfig());

  readonly navigable = computed(() => this.filtered().filter((r) => r.kind === 'page').length);

  filtered = computed(() => {
    const q = this.filter().toLowerCase().trim();
    const all = this.routes();
    if (!q) return all;
    return all.filter(
      (r) =>
        r.fullPath.toLowerCase().includes(q) ||
        (r.component && r.component.toLowerCase().includes(q)) ||
        (r.redirectTo && r.redirectTo.toLowerCase().includes(q)) ||
        (r.title && r.title.toLowerCase().includes(q)) ||
        this.checks(r).some((check) => check.toLowerCase().includes(q)) ||
        r.file.toLowerCase().includes(q),
    );
  });

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client) this.refresh();
    });
  }

  checks(route: SourceRoute) {
    return [
      ...Object.entries(route.guards ?? {}).flatMap(([kind, names]) =>
        names.map((name) => `${kind} ${name}`),
      ),
      ...(route.resolvers ?? []).map((resolver) => `resolve ${resolver}`),
    ];
  }

  location(route: SourceRoute) {
    return sourceLocation(route);
  }

  onFilterInput(event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.filter.set(target?.value ?? '');
  }

  async refresh() {
    const client = this.rpc();
    if (!client) return;
    this.loading.set(true);
    this.error.set(false);
    try {
      const my = client.scope('ng-devtools');
      const result = (await my.rpc.call('get-routes')) as SourceRoute[];
      this.routes.set(result);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
