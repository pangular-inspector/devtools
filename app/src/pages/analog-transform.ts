import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { rpcTry as call } from '../rpc';

interface TransformStep {
  plugin: string;
  changed: boolean;
  ms: number;
  size: number;
  code?: string;
  truncated?: true;
}

export interface TransformTrace {
  file: string;
  ssr: boolean;
  steps: TransformStep[];
  code: string;
  truncated?: true;
  inspectUrl?: string;
  error?: string;
}

export interface TransformServerFn {
  name: string;
  id: string;
  file: string;
}

@Component({
  selector: 'app-analog-transform',
  template: `
    <section class="card" aria-labelledby="transform-heading">
      <div class="row head">
        <h2 id="transform-heading">Vite transform stack</h2>
        <span class="file grow">{{ file() }}</span>
        <label class="check"
          ><input type="checkbox" [checked]="ssr()" (change)="ssr.set(!ssr())" /> Server build
          (SSR)</label
        >
        <button type="button" class="btn ghost" [disabled]="loading()" (click)="reload()">
          Run again
        </button>
        <button type="button" class="btn ghost" (click)="closed.emit()">Close</button>
      </div>
      <p class="muted small">
        Transforms the file again on the dev server and lists each plugin that changed it, in order.
      </p>
      @if (loading()) {
        <p class="muted" role="status">Transforming {{ file() }}…</p>
      } @else if (trace(); as t) {
        @if (t.error) {
          <p class="note" data-tone="bad" role="alert">{{ t.error }}</p>
        }
        @if (t.inspectUrl) {
          <p class="small">
            <a [href]="t.inspectUrl" target="_blank" rel="noopener">Open in vite-plugin-inspect</a>
          </p>
        }
        @if (changed().length) {
          <ol class="steps">
            @for (step of changed(); track $index) {
              <li>
                <details>
                  <summary>
                    <span class="mono">{{ step.plugin }}</span>
                    <span class="muted small tnum">{{ step.ms }} ms · {{ step.size }} chars</span>
                  </summary>
                  <pre class="code">{{ step.code }}</pre>
                  @if (step.truncated) {
                    <p class="muted small">Clipped to the first 20,000 characters.</p>
                  }
                </details>
              </li>
            }
          </ol>
          @if (unchanged()) {
            <p class="muted small">{{ unchanged() }} more plugins ran without changing it.</p>
          }
        } @else if (!t.error) {
          <p class="muted">No plugin changed this file.</p>
        }
        @if (ids().length) {
          <div>
            <h3>Server function ids</h3>
            <ul class="plain">
              @for (fn of ids(); track fn.id) {
                <li>
                  <span class="mono">{{ fn.name }}</span>
                  <span class="mono muted">{{ fn.id }}</span>
                  <span class="pill" [attr.data-tone]="fn.found ? 'good' : 'warn'">{{
                    fn.found ? 'in the output' : 'not in the output'
                  }}</span>
                </li>
              }
            </ul>
          </div>
        }
        @if (t.code) {
          <details>
            <summary>Code Vite serves</summary>
            <pre class="code">{{ t.code }}</pre>
          </details>
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
    .steps,
    .plain {
      display: grid;
      gap: 6px;
      margin: 0;
      padding-left: 22px;
    }
    .plain {
      padding: 0;
      list-style: none;
    }
    .plain li {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    summary {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    details .code {
      margin-top: 6px;
    }
    a {
      color: var(--accent-text, var(--accent));
    }
    a:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  `,
})
export class AnalogTransform {
  readonly rpc = input<DevframeRpcClient | null>(null);
  readonly file = input.required<string>();
  /** The project's server functions, to show whether their ids made it into the output. */
  readonly serverFns = input<TransformServerFn[]>([]);
  readonly closed = output<void>();

  readonly ssr = signal(false);
  readonly trace = signal<TransformTrace | null>(null);
  readonly loading = signal(true);
  readonly changed = computed(() => (this.trace()?.steps ?? []).filter((s) => s.changed));
  readonly unchanged = computed(() => (this.trace()?.steps.length ?? 0) - this.changed().length);
  readonly ids = computed(() => {
    const trace = this.trace();
    if (!trace) return [];
    return this.serverFns()
      .filter((fn) => fn.file === trace.file)
      .map((fn) => ({ ...fn, found: trace.code.includes(fn.id) }));
  });
  private run = 0;

  constructor() {
    effect(() => {
      const file = this.file();
      const ssr = this.ssr();
      untracked(() => void this.fetch(file, ssr));
    });
  }

  reload() {
    void this.fetch(this.file(), this.ssr());
  }

  private async fetch(file: string, ssr: boolean) {
    const run = ++this.run;
    this.loading.set(true);
    const trace = await call<TransformTrace>(this.rpc(), 'analog-transform', { file, ssr });
    if (run !== this.run) return;
    this.trace.set(
      trace ?? { file, ssr, steps: [], code: '', error: 'No answer from the devtools server.' },
    );
    this.loading.set(false);
  }
}
