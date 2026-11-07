import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { plural } from '../format';

/** What this section reads of one pipe in the `pipe-usage` shared state. */
export interface TemplatePipe {
  name: string;
  isPure: boolean;
  instanceCount: number;
  components: { name: string; count: number }[];
  call?: { callCount: number; totalMs?: number };
  churn?: { streak: number };
  stale?: { detectedAt: number };
}

interface PipeUsageSnapshot {
  pipes?: TemplatePipe[];
  pages?: { pageId: string; pipes: TemplatePipe[] }[];
}

/** One row of the list: the pipe and how many times this component's template uses it. */
export interface TemplatePipeRow {
  name: string;
  isPure: boolean;
  uses: number;
  calls?: number;
  churn: boolean;
  stale: boolean;
}

/**
 * The pipes a component's template uses, from the live pipe usage of the
 * page. Every instance of a component class shares its template, so the rows
 * are per class. Pipes in a branch that is not rendered are not listed.
 */
export function templatePipes(
  snapshot: PipeUsageSnapshot | undefined,
  pageId: string | undefined,
  component: string,
): TemplatePipeRow[] {
  const own = pageId ? snapshot?.pages?.find((page) => page.pageId === pageId) : undefined;
  const pipes = own?.pipes ?? snapshot?.pipes ?? [];
  const rows: TemplatePipeRow[] = [];
  for (const pipe of pipes) {
    const usage = pipe.components.find((c) => c.name === component);
    if (!usage) continue;
    rows.push({
      name: pipe.name,
      isPure: pipe.isPure,
      uses: usage.count,
      // The counts are the pipe's, across every component that uses it.
      ...(pipe.call ? { calls: pipe.call.callCount } : {}),
      churn: !!pipe.churn,
      stale: !!pipe.stale,
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

@Component({
  selector: 'app-component-pipes',
  template: `
    @if (loaded()) {
      <div class="block">
        <h3>
          Pipes in template <span class="pill">{{ rows().length }}</span>
        </h3>
        @if (rows().length) {
          <ul class="chips">
            @for (row of rows(); track row.name) {
              <li>
                @if (canShowPipes()) {
                  <button type="button" class="pipe" (click)="showPipe.emit(row.name)">
                    <span class="sr-only">Show in Pipes:</span>
                    <span class="mono">{{ row.name }}</span>
                    <span class="note">{{ row.uses }}×</span>
                    @if (!row.isPure) {
                      <span class="flag warn">impure</span>
                    }
                    @if (row.churn) {
                      <span class="flag warn">churning</span>
                    }
                    @if (row.stale) {
                      <span class="flag warn">stale?</span>
                    }
                    @if (row.calls !== undefined) {
                      <span class="note">{{ plural(row.calls, 'call') }}</span>
                    }
                  </button>
                } @else {
                  <span class="pipe">
                    <span class="mono">{{ row.name }}</span>
                    <span class="note">{{ row.uses }}×</span>
                    @if (!row.isPure) {
                      <span class="flag warn">impure</span>
                    }
                  </span>
                }
              </li>
            }
          </ul>
          <p class="hint">
            Call counts cover every component that uses the pipe. Record calls in the Pipes tab to
            see them.
          </p>
        } @else {
          <p class="empty-line">No pipe is in use in the rendered part of its template.</p>
        }
      </div>
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
    }
    .block {
      padding: 14px 16px;
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
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .pipe {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: var(--control-h);
      padding: 0 10px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      font-size: 12px;
    }
    button.pipe {
      cursor: pointer;
      transition:
        background-color 150ms var(--ease),
        border-color 150ms var(--ease);
    }
    button.pipe:hover {
      border-color: var(--accent-line);
      background: var(--surface-3);
    }
    button.pipe:focus-visible {
      @include m.focus-ring;
    }
    .mono {
      font-family: var(--font-mono);
      color: var(--text-strong);
    }
    .note {
      color: var(--text-2);
      font-variant-numeric: tabular-nums;
    }
    .flag {
      @include m.label;
    }
    .flag.warn {
      @include m.tint(warn);
      padding: 0 6px;
      border-radius: 99px;
    }
    .hint,
    .empty-line {
      margin: 8px 0 0;
      color: var(--text-2);
      font-size: 12px;
      line-height: 1.5;
    }
    @media (prefers-reduced-motion: reduce) {
      button.pipe {
        transition: none;
      }
    }
  `,
})
export class ComponentPipesSection {
  protected readonly plural = plural;
  private readonly destroyRef = inject(DestroyRef);

  readonly rpc = input<DevframeRpcClient | null>(null);
  readonly pageId = input<string | undefined>(undefined);
  /** The component's class name, as the Components tab shows it. */
  readonly component = input.required<string>();
  readonly canShowPipes = input(false);
  readonly showPipe = output<string>();

  private readonly snapshot = signal<PipeUsageSnapshot | undefined>(undefined);
  /** False until the pipe usage answered, or when the Pipes inspector is off. */
  protected readonly loaded = signal(false);
  protected readonly rows = computed(() =>
    templatePipes(this.snapshot(), this.pageId(), this.component()),
  );
  private unsubscribe?: () => void;

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client) void this.subscribe(client);
    });
    this.destroyRef.onDestroy(() => this.unsubscribe?.());
  }

  private async subscribe(client: DevframeRpcClient) {
    try {
      const state = await client.scope('pangular').rpc.sharedState('pipe-usage');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) => {
        this.snapshot.set(value as PipeUsageSnapshot | undefined);
        this.loaded.set(true);
      };
      apply(state.value());
      this.unsubscribe?.();
      this.unsubscribe = state.on('updated', apply);
    } catch {
      // No pipe usage, for example with the Pipes inspector off.
    }
  }
}
