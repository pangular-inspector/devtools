import { Component, computed, effect, input, signal, untracked } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { rpcTry as call } from '../rpc';

interface BuildChunk {
  file: string;
  kind: 'js' | 'css';
  size: number;
  gzip: number;
}

interface BuildRoute {
  path: string;
  file: string;
  chunk?: string;
  size: number;
  gzip: number;
  shared: string[];
  lazy: string[];
  matchedBy?: 'manifest' | 'name';
}

export interface BuildAnalysis {
  found: boolean;
  dir?: string;
  builtAt?: number;
  manifest: boolean;
  entry?: { chunk: string; size: number; gzip: number };
  totals: { js: number; css: number; jsGzip: number; cssGzip: number; chunks: number };
  chunks: BuildChunk[];
  routes: BuildRoute[];
  notes: string[];
}

export function bytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} kB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

@Component({
  selector: 'app-analog-build',
  template: `
    <section class="card" aria-labelledby="build-heading">
      <div class="row head">
        <h2 id="build-heading">Build analysis</h2>
        <button type="button" class="btn ghost" [disabled]="loading()" (click)="reload()">
          {{ loading() ? 'Reading…' : 'Read again' }}
        </button>
      </div>
      @if (loading() && !analysis()) {
        <p class="muted" role="status">Reading the build output…</p>
      } @else if (!analysis()) {
        <p class="note" data-tone="bad" role="alert">Could not read the build output.</p>
      } @else if (!analysis()!.found) {
        <p class="muted">
          No client build yet. Run <code>analog build</code> to see each page's chunk sizes here.
        </p>
      } @else {
        @let a = analysis()!;
        <dl class="facts">
          <dt>Output</dt>
          <dd class="mono">{{ a.dir }} · {{ a.totals.chunks }} files</dd>
          <dt>JavaScript</dt>
          <dd class="tnum">{{ size(a.totals.js) }} ({{ size(a.totals.jsGzip) }} gzip)</dd>
          <dt>CSS</dt>
          <dd class="tnum">{{ size(a.totals.css) }} ({{ size(a.totals.cssGzip) }} gzip)</dd>
          @if (a.entry) {
            <dt>Entry</dt>
            <dd>
              <span class="mono">{{ a.entry.chunk }}</span>
              <span class="muted tnum">
                loads {{ size(a.entry.size) }} ({{ size(a.entry.gzip) }} gzip) with its
                imports</span
              >
            </dd>
          }
        </dl>
        <div class="table-wrap" role="region" aria-label="Page chunks" tabindex="0">
          <table>
            <thead>
              <tr>
                <th scope="col">Route</th>
                <th scope="col">Page chunk</th>
                <th scope="col" class="num">Beyond the entry</th>
                <th scope="col">Lazy chunks</th>
              </tr>
            </thead>
            <tbody>
              @for (r of a.routes; track r.file) {
                <tr>
                  <td class="mono path">{{ r.path }}</td>
                  <td>
                    @if (r.chunk) {
                      <span class="mono path">{{ r.chunk }}</span>
                      @if (r.shared.length) {
                        <div class="muted small">
                          + {{ r.shared.length }} shared chunk{{ r.shared.length === 1 ? '' : 's' }}
                        </div>
                      }
                    } @else {
                      <span class="muted small">not found</span>
                    }
                  </td>
                  <td class="num">
                    @if (r.chunk) {
                      {{ size(r.size) }}
                      <div class="muted small">{{ size(r.gzip) }} gzip</div>
                    }
                  </td>
                  <td>
                    @for (c of r.lazy; track c) {
                      <span class="chip mono">{{ c }}</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="muted">No pages to match with the build.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <details>
          <summary>Largest files ({{ a.chunks.length }})</summary>
          <ul class="plain">
            @for (c of a.chunks; track c.file) {
              <li>
                <span class="mono path">{{ c.file }}</span>
                <span class="muted small tnum">{{ size(c.size) }} · {{ size(c.gzip) }} gzip</span>
              </li>
            }
          </ul>
        </details>
        @for (note of a.notes; track note) {
          <p class="note">{{ note }}</p>
        }
      }
    </section>
  `,
  styles: `
    @use 'analog' as a;
    @include a.controls;
    :host {
      display: block;
    }
    .head {
      justify-content: space-between;
    }
    .plain {
      display: grid;
      gap: 4px;
      margin: 8px 0 0;
      padding: 0;
      list-style: none;
    }
    .plain li {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: space-between;
    }
    code {
      padding: 1px 6px;
      border: 1px solid var(--border);
      border-radius: 4px;
      font-family: var(--mono);
      font-size: 12px;
    }
  `,
})
export class AnalogBuild {
  readonly rpc = input<DevframeRpcClient | null>(null);
  readonly analysis = signal<BuildAnalysis | null>(null);
  readonly loading = signal(true);
  protected readonly size = bytes;
  readonly hasBuild = computed(() => !!this.analysis()?.found);

  constructor() {
    effect(() => {
      const client = this.rpc();
      untracked(() => void this.fetch(client));
    });
  }

  reload() {
    void this.fetch(this.rpc());
  }

  private async fetch(client: DevframeRpcClient | null) {
    this.loading.set(true);
    const analysis = await call<BuildAnalysis>(client, 'analog-build');
    this.analysis.set(analysis);
    this.loading.set(false);
  }
}
