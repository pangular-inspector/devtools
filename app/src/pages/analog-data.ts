import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { rpcTry as call } from '../rpc';
import { bytes } from './analog-build';
import { AnalogValueNode } from './analog-value-tree';

export interface DataPage {
  pageId: string;
  url: string;
  load?: { preview: string; bytes: number; keys: string[] };
}

export interface DataServerFn {
  id: string;
  name: string;
  file: string;
}

interface PayloadEntry {
  key: string;
  http?: { url?: string; status?: number };
  source?: 'http' | 'analog' | 'hydration';
  fn?: { id: string; name?: string; file?: string };
  size: number;
}

interface PayloadSummary {
  found: boolean;
  size: number;
  entries: PayloadEntry[];
  error?: string;
}

interface LoadData {
  found: boolean;
  value?: unknown;
  bytes?: number;
  error?: string;
}

/** One TransferState entry as the Data view lists it. */
export interface PayloadRow {
  key: string;
  kind: 'load' | 'fn' | 'http' | 'hydration' | 'state';
  label: string;
  file?: string;
  size: number;
  /** `reused`: the browser read it; `refetched`: the browser asked the server again. */
  reuse?: 'reused' | 'refetched';
}

/** Maps an Analog load endpoint back to its page route, like the server log does. */
export function loadRouteOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const path = url.replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/)[0];
  const at = path.indexOf('/_analog/pages');
  if (at < 0) return undefined;
  const endpoint = path.slice(at + '/_analog/pages'.length) || '/';
  return (
    endpoint
      .replace(/\/\([^/]*\)(?=\/|$)/g, '')
      .replace(/\/-[^/]+-$/, '')
      .replace(/\/index$/, '') || '/'
  );
}

/** Labels each TransferState entry with its load() route or server function, and whether the browser reused it. */
export function payloadRows(
  entries: PayloadEntry[],
  fns: DataServerFn[],
  duplicates: { route: string }[],
  refetches: { id: string }[],
): PayloadRow[] {
  return entries.map((entry) => {
    if (entry.fn) {
      const fn = fns.find((f) => f.id === entry.fn!.id);
      return {
        key: entry.key,
        kind: 'fn',
        label: `${entry.fn.name ?? fn?.name ?? entry.fn.id}()`,
        file: entry.fn.file ?? fn?.file,
        size: entry.size,
        reuse: refetches.some((r) => r.id === entry.fn!.id) ? 'refetched' : 'reused',
      };
    }
    const route = loadRouteOf(entry.http?.url);
    if (route) {
      return {
        key: entry.key,
        kind: 'load',
        label: `load() of ${route}`,
        size: entry.size,
        reuse: duplicates.some((d) => d.route === route) ? 'refetched' : 'reused',
      };
    }
    if (entry.source === 'hydration') {
      return { key: entry.key, kind: 'hydration', label: 'Hydration data', size: entry.size };
    }
    if (entry.http) {
      return {
        key: entry.key,
        kind: 'http',
        label: entry.http.url ?? 'HTTP response',
        size: entry.size,
      };
    }
    return { key: entry.key, kind: 'state', label: 'App state', size: entry.size };
  });
}

const KIND_LABEL: Record<PayloadRow['kind'], string> = {
  load: 'load()',
  fn: 'server function',
  http: 'HttpClient',
  hydration: 'hydration',
  state: 'state',
};

@Component({
  selector: 'app-analog-data',
  imports: [AnalogValueNode],
  template: `
    <div class="stack">
      <section class="card" aria-labelledby="data-load-heading">
        <h2 id="data-load-heading">load() data of the open page</h2>
        @if (!page()) {
          <p class="muted">Open a page of the app to see the data its load() returned.</p>
        } @else if (!page()!.load) {
          <p class="muted">{{ page()!.url }} has no load() data.</p>
        } @else {
          @let load = page()!.load!;
          <dl class="facts">
            <dt>Page</dt>
            <dd class="mono">{{ page()!.url }}</dd>
            <dt>Size</dt>
            <dd class="tnum">{{ size(load.bytes) }}</dd>
            <dt>Keys</dt>
            <dd>
              @for (k of load.keys; track k) {
                <span class="chip mono">{{ k }}</span>
              }
            </dd>
          </dl>
          @if (full(); as f) {
            @if (f.error) {
              <p class="note" data-tone="bad" role="alert">{{ f.error }}</p>
            } @else if (f.found) {
              <div class="tree" role="region" aria-label="Full load() value" tabindex="0">
                <app-analog-value-node name="load()" [value]="f.value" />
              </div>
            } @else {
              <p class="muted">The page has no load() data now.</p>
            }
          } @else {
            <pre class="code">{{ load.preview }}</pre>
          }
          <div class="row">
            <button type="button" class="btn ghost" [disabled]="loading()" (click)="loadFull()">
              {{ loading() ? 'Asking the page…' : full() ? 'Read again' : 'Load the full value' }}
            </button>
            <span class="muted small">Masked by the redaction rules, up to 200 KB.</span>
          </div>
        }
      </section>

      <section class="card" aria-labelledby="data-payload-heading">
        <h2 id="data-payload-heading">TransferState payload</h2>
        @if (!payload()) {
          <p class="muted">
            No payload from this page. It shows once a server rendered page reports its
            TransferState (the SSR &amp; HTTP inspector must be on).
          </p>
        } @else if (!payload()!.found) {
          <p class="muted">The page has no TransferState script, so it was not server rendered.</p>
        } @else {
          <p class="muted small tnum">
            {{ rows().length }} entr{{ rows().length === 1 ? 'y' : 'ies' }},
            {{ size(payload()!.size) }}
            @if (refetchedCount()) {
              · {{ refetchedCount() }} fetched again by the browser
            }
          </p>
          @if (payload()!.error) {
            <p class="note" data-tone="bad">{{ payload()!.error }}</p>
          }
          <div class="table-wrap" role="region" aria-label="TransferState entries" tabindex="0">
            <table>
              <thead>
                <tr>
                  <th scope="col">Key</th>
                  <th scope="col">From</th>
                  <th scope="col" class="num">Size</th>
                  <th scope="col">In the browser</th>
                </tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.key) {
                  <tr>
                    <td class="mono path">{{ r.key }}</td>
                    <td>
                      <span class="pill">{{ kindLabel(r.kind) }}</span>
                      <span class="mono path">{{ r.label }}</span>
                      @if (r.file) {
                        <div class="muted small file">{{ r.file }}</div>
                      }
                    </td>
                    <td class="num">{{ size(r.size) }}</td>
                    <td>
                      @if (r.reuse === 'refetched') {
                        <span class="pill" data-tone="warn">fetched again</span>
                      } @else if (r.reuse === 'reused') {
                        <span class="pill" data-tone="good">reused</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4" class="muted">The payload is empty.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    @use 'analog' as a;
    @include a.controls;
    :host {
      display: block;
    }
    .stack {
      display: grid;
      gap: 16px;
    }
    .tree {
      max-height: 420px;
      overflow: auto;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--bg);
    }
    .tree:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
  `,
})
export class AnalogData {
  readonly rpc = input<DevframeRpcClient | null>(null);
  readonly page = input<DataPage | null>(null);
  readonly serverFns = input<DataServerFn[]>([]);
  readonly duplicates = input<{ route: string }[]>([]);
  readonly refetches = input<{ id: string }[]>([]);

  readonly payloads = signal<Record<string, PayloadSummary>>({});
  readonly full = signal<LoadData | null>(null);
  readonly loading = signal(false);
  protected readonly size = bytes;
  private readonly destroyRef = inject(DestroyRef);
  private unsubscribe: (() => void) | null = null;

  /** Changes only when the page or its URL does, not on every push. */
  private readonly pageKey = computed(
    () => `${this.page()?.pageId ?? ''} ${this.page()?.url ?? ''}`,
  );
  readonly payload = computed(() => {
    const id = this.page()?.pageId;
    return id ? (this.payloads()[id] ?? null) : null;
  });
  readonly rows = computed(() =>
    payloadRows(
      this.payload()?.entries ?? [],
      this.serverFns(),
      this.duplicates(),
      this.refetches(),
    ),
  );
  readonly refetchedCount = computed(
    () => this.rows().filter((r) => r.reuse === 'refetched').length,
  );

  constructor() {
    effect(() => {
      const client = this.rpc();
      untracked(() => void this.subscribe(client));
    });
    effect(() => {
      // Another page or a navigation: the full value belongs to the old one.
      this.pageKey();
      untracked(() => this.full.set(null));
    });
    this.destroyRef.onDestroy(() => this.unsubscribe?.());
  }

  private async subscribe(client: DevframeRpcClient | null) {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (!client) return;
    try {
      const shared = await client.scope('pangular').rpc.sharedState('http-payloads');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) =>
        this.payloads.set(
          ((value as { pages?: Record<string, PayloadSummary> } | null)?.pages ?? {}) as Record<
            string,
            PayloadSummary
          >,
        );
      apply(shared.value());
      this.unsubscribe = shared.on('updated', apply);
    } catch {
      // The SSR & HTTP inspector is off: no payloads.
      this.payloads.set({});
    }
  }

  async loadFull() {
    const page = this.page();
    if (!page) return;
    this.loading.set(true);
    try {
      const data = await call<LoadData>(this.rpc(), 'analog-load-data', page.pageId);
      this.full.set(data ?? { found: false, error: 'No answer from the devtools server.' });
    } finally {
      this.loading.set(false);
    }
  }

  kindLabel(kind: PayloadRow['kind']): string {
    return KIND_LABEL[kind];
  }
}
