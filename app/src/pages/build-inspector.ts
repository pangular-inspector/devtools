import { Component, computed, effect, input, signal } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';

/** One module of the Vite dev server's graph, as `build-graph.ts` sends it. */
export interface GraphModule {
  url: string;
  file?: string;
  type: 'js' | 'css' | 'asset';
  size: number;
  importers: number;
  imports: number;
  dynamicImports: string[];
}

export interface LazyBoundary {
  url: string;
  file?: string;
  importers: string[];
  modules: number;
  size: number;
}

export interface BuildChunk {
  file: string;
  bytes: number;
  gzip: number;
  initial: boolean;
  type: 'js' | 'css';
  entryPoint?: string;
  inputs?: { file: string; bytes: number }[];
}

export interface BuildGraph {
  vite?: {
    modules: GraphModule[];
    totalSize: number;
    entries: string[];
    initialSize: number;
    lazy: LazyBoundary[];
  };
  viteNote?: string;
  output?: {
    dir: string;
    builtAt: number;
    chunks: BuildChunk[];
    initialBytes: number;
    initialGzip: number;
    lazyBytes: number;
    stats: boolean;
  };
  outputNote?: string;
}

/** `1234` as `1.2 kB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} kB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

/** Rows shown per table before **Show all**. */
export const BUILD_ROWS = 25;

@Component({
  selector: 'app-build-inspector',
  template: `
    <p class="intro">
      What the app loads: the Vite dev server's module graph with its lazy boundaries, and the
      chunks of the last production build on disk.
    </p>
    <div class="toolbar">
      <button type="button" class="small" (click)="refresh()" [disabled]="loading()">
        {{ loading() ? 'Reading…' : 'Refresh' }}
      </button>
      <p class="sr-only" role="status">{{ status() }}</p>
    </div>
    @if (failed()) {
      <div class="state" role="alert">
        <p>Can't read the build data from the devtools server.</p>
        <button type="button" class="small" (click)="refresh()">Retry</button>
      </div>
    } @else if (graph(); as graph) {
      <section aria-labelledby="graph-title">
        <h2 id="graph-title">Module graph</h2>
        @if (graph.vite; as vite) {
          <p class="summary">
            {{ vite.modules.length }} modules, {{ bytes(vite.totalSize) }} transformed (unminified,
            only what the browser requested). {{ bytes(vite.initialSize) }} load without
            <code>import()</code> from {{ vite.entries.length }}
            {{ vite.entries.length === 1 ? 'entry' : 'entries' }}.
          </p>
          <h3>Lazy boundaries</h3>
          @if (!vite.lazy.length) {
            <p class="empty">
              No module is loaded with <code>import()</code> yet. Visit a lazy route to see it here.
            </p>
          } @else {
            <div class="scroll">
              <table>
                <caption class="sr-only">
                  Modules loaded with import(), biggest first
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Module</th>
                    <th scope="col">Imported by</th>
                    <th scope="col" class="num">Own modules</th>
                    <th scope="col" class="num">Own size</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of vite.lazy; track row.url) {
                    <tr>
                      <td>
                        <code>{{ row.file ?? row.url }}</code>
                      </td>
                      <td>
                        <code>{{ row.importers.join(', ') }}</code>
                      </td>
                      <td class="num">{{ row.modules }}</td>
                      <td class="num">{{ bytes(row.size) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          <h3>Modules</h3>
          <div class="filter">
            <input
              #search
              type="search"
              aria-label="Filter modules"
              placeholder="Filter by file or URL"
              [value]="filter()"
              (input)="filter.set($any($event.target).value)"
              (keydown.escape)="filter.set('')"
            />
            <span class="count">{{ shownModules().length }} of {{ vite.modules.length }}</span>
          </div>
          @if (!shownModules().length) {
            <div class="empty">
              <p>No module matches “{{ filter() }}”.</p>
              <button type="button" class="small" (click)="filter.set(''); search.focus()">
                Clear filters
              </button>
            </div>
          } @else {
            <div class="scroll">
              <table>
                <caption class="sr-only">
                  Modules, biggest first
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Module</th>
                    <th scope="col" class="num">Size</th>
                    <th scope="col" class="num">Importers</th>
                    <th scope="col" class="num">Imports</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of visibleModules(); track row.url) {
                    <tr>
                      <td>
                        <code>{{ row.file ?? row.url }}</code>
                      </td>
                      <td class="num">{{ bytes(row.size) }}</td>
                      <td class="num">{{ row.importers }}</td>
                      <td class="num">{{ row.imports }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (shownModules().length > visibleModules().length) {
              <button type="button" class="small more" (click)="allModules.set(true)">
                Show all {{ shownModules().length }} modules
              </button>
            }
          }
        } @else {
          <p class="empty">{{ graph.viteNote }}</p>
        }
      </section>

      <section aria-labelledby="chunks-title">
        <h2 id="chunks-title">Chunks</h2>
        @if (graph.output; as output) {
          <p class="summary">
            <code>{{ output.dir }}</code
            >: initial {{ bytes(output.initialBytes) }} ({{ bytes(output.initialGzip) }} gzip), lazy
            {{ bytes(output.lazyBytes) }}. Initial chunks are the ones <code>index.html</code> loads
            up front.
          </p>
          @if (!output.stats) {
            <p class="notice">
              Build with <code>ng build --stats-json</code> to see the source each chunk starts
              from.
            </p>
          }
          <div class="scroll">
            <table>
              <caption class="sr-only">
                Chunks of the production build, initial first
              </caption>
              <thead>
                <tr>
                  <th scope="col">Chunk</th>
                  <th scope="col">Loads</th>
                  <th scope="col" class="num">Size</th>
                  <th scope="col" class="num">Gzip</th>
                  <th scope="col">Entry point</th>
                </tr>
              </thead>
              <tbody>
                @for (chunk of output.chunks; track chunk.file) {
                  <tr>
                    <td>
                      <code>{{ chunk.file }}</code>
                    </td>
                    <td>{{ chunk.initial ? 'Initial' : 'Lazy' }}</td>
                    <td class="num">{{ bytes(chunk.bytes) }}</td>
                    <td class="num">{{ bytes(chunk.gzip) }}</td>
                    <td>
                      <code>{{ chunk.entryPoint ?? '' }}</code>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="empty">{{ graph.outputNote }}</p>
        }
      </section>
    } @else {
      <p class="state" role="status">Reading the build…</p>
    }
  `,
  styles: `
    @use 'mixins' as m;
    :host {
      display: block;
      font-size: 13px;
    }
    .intro,
    .summary {
      margin: 0 0 12px;
      color: var(--text-2);
      line-height: 1.5;
    }
    .toolbar {
      display: flex;
      gap: 8px;
      align-items: center;
      margin: 0 0 12px;
    }
    h2 {
      margin: 16px 0 8px;
      color: var(--text-strong);
      font-size: 14px;
    }
    h3 {
      margin: 12px 0 6px;
      color: var(--text-strong);
      font-size: 13px;
    }
    code {
      font-family: var(--font-mono);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .filter {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin: 0 0 8px;
    }
    .filter input {
      flex: 1 1 200px;
      min-width: 0;
      height: var(--control-h);
      padding: 0 10px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      font: inherit;
    }
    .filter input:focus-visible {
      @include m.focus-ring;
    }
    .count {
      color: var(--text-2);
      font-size: 12px;
    }
    .scroll {
      max-width: 100%;
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 6px 8px;
      border-bottom: 1px solid var(--border);
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--text-2);
      font-weight: 600;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .notice {
      margin: 0 0 8px;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text-2);
    }
    .empty,
    .state {
      margin: 0 0 12px;
      color: var(--text-2);
    }
    .empty p,
    .state p {
      margin: 0 0 8px;
    }
    .small {
      height: var(--control-h);
      padding: 0 12px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
    }
    .small:focus-visible {
      @include m.focus-ring;
    }
    .more {
      margin-top: 8px;
    }
  `,
})
export class BuildInspector {
  readonly rpc = input<DevframeRpcClient | null>(null);

  protected readonly bytes = formatBytes;

  readonly graph = signal<BuildGraph | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly status = signal('');
  readonly filter = signal('');
  readonly allModules = signal(false);

  readonly shownModules = computed(() => {
    const modules = this.graph()?.vite?.modules ?? [];
    const text = this.filter().trim().toLowerCase();
    return text
      ? modules.filter((mod) => `${mod.url} ${mod.file ?? ''}`.toLowerCase().includes(text))
      : modules;
  });
  readonly visibleModules = computed(() =>
    this.allModules() ? this.shownModules() : this.shownModules().slice(0, BUILD_ROWS),
  );

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client) void this.load(client);
    });
  }

  refresh() {
    const client = this.rpc();
    if (client) void this.load(client, true);
  }

  private async load(client: DevframeRpcClient, announce = false) {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const graph = (await client.scope('pangular').rpc.call('get-build-graph')) as BuildGraph;
      this.graph.set(graph && typeof graph === 'object' ? graph : {});
      if (announce) this.status.set('Build data refreshed.');
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
