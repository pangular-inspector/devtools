import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { hostPageId } from '../page-id';
import { Select, type SelectOption } from '../ui/select';
import type { ComponentFocus } from '../types/component-focus.types';

export type PerfMetricName = 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB';
export type PerfRating = 'good' | 'needs-improvement' | 'poor';

interface PerfOwner {
  id: string;
  name: string;
}

export interface PerfMetric {
  value: number;
  rating: PerfRating;
  target?: string;
  owner?: PerfOwner;
  event?: string;
  at?: number;
}

export interface PerfPage {
  pageId: string;
  url?: string;
  title?: string;
  reportedAt: number;
  metrics: Partial<Record<PerfMetricName, PerfMetric>>;
  interactions: {
    event: string;
    durationMs: number;
    at: number;
    target?: string;
    owner?: PerfOwner;
  }[];
  longTasks: { at: number; durationMs: number; kind: string; source?: string }[];
  longTaskCount: number;
  totalBlockingMs: number;
  supported: string[];
}

export const PERF_METRICS: readonly { name: PerfMetricName; label: string; entry: string }[] = [
  { name: 'LCP', label: 'Largest Contentful Paint', entry: 'largest-contentful-paint' },
  { name: 'INP', label: 'Interaction to Next Paint', entry: 'event' },
  { name: 'CLS', label: 'Cumulative Layout Shift', entry: 'layout-shift' },
  { name: 'FCP', label: 'First Contentful Paint', entry: 'paint' },
  { name: 'TTFB', label: 'Time to First Byte', entry: 'navigation' },
];

const RATING_LABEL: Record<PerfRating, string> = {
  good: 'Good',
  'needs-improvement': 'Needs improvement',
  poor: 'Poor',
};

/** The pages of the `performance` shared state, newest first; bad entries are dropped. */
export function perfPages(value: unknown): PerfPage[] {
  const pages = (value as { pages?: Record<string, unknown> } | null)?.pages;
  if (!pages || typeof pages !== 'object') return [];
  return Object.values(pages)
    .filter(
      (page): page is PerfPage =>
        !!page &&
        typeof page === 'object' &&
        typeof (page as PerfPage).pageId === 'string' &&
        !!(page as PerfPage).metrics &&
        Array.isArray((page as PerfPage).longTasks),
    )
    .sort((a, b) => b.reportedAt - a.reportedAt);
}

export function formatPerf(name: PerfMetricName, value: number): string {
  if (name === 'CLS') return value.toFixed(3);
  return formatMs(value);
}

export function formatMs(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
}

@Component({
  selector: 'app-performance-inspector',
  imports: [Select],
  template: `
    @if (!loaded()) {
      <p class="state" role="status">Loading performance…</p>
    } @else if (failed()) {
      <div class="state" role="alert">
        <p>Can't read the performance data from the devtools server.</p>
        <button type="button" class="small" (click)="retry()">Retry</button>
      </div>
    } @else if (!pages().length) {
      <div class="state" role="status">
        <p>No page reports performance yet.</p>
        <p class="muted">
          Open the app with the overlay loaded. The browser measures web vitals as the page loads
          and as you use it.
        </p>
      </div>
    } @else {
      <p class="intro">
        Web vitals the browser measured since the page loaded, rated by the web.dev thresholds, and
        the tasks that blocked the main thread.
      </p>
      @if (pages().length > 1) {
        <div class="toolbar">
          <app-select
            ariaLabel="Page"
            [options]="pageOptions()"
            [value]="pageId()"
            (valueChange)="pageId.set($event ?? '')"
          />
        </div>
      }
      @if (page(); as page) {
        <section aria-labelledby="vitals-title">
          <h2 id="vitals-title">Web vitals</h2>
          <ul class="metrics">
            @for (metric of metrics; track metric.name) {
              <li class="metric" [attr.data-rating]="page.metrics[metric.name]?.rating ?? 'none'">
                <span class="name">
                  <abbr [title]="metric.label">{{ metric.name }}</abbr>
                  <span class="sr-only">{{ metric.label }}</span>
                </span>
                @if (page.metrics[metric.name]; as value) {
                  <span class="value">{{ format(metric.name, value.value) }}</span>
                  <span class="rating">{{ ratingLabel[value.rating] }}</span>
                  @if (value.event || value.target) {
                    <code class="where"
                      >{{ value.event ? value.event + ' on ' : '' }}{{ value.target }}</code
                    >
                  }
                  @if (value.owner; as owner) {
                    @if (canShowComponent()) {
                      <button
                        type="button"
                        class="link"
                        (click)="showComponent.emit({ id: owner.id, pageId: page.pageId })"
                      >
                        Show component <code>{{ owner.name }}</code>
                      </button>
                    } @else {
                      <span class="muted"
                        >In <code>{{ owner.name }}</code></span
                      >
                    }
                  }
                } @else {
                  <span class="value muted">–</span>
                  <span class="rating muted">{{ missing(page, metric.entry) }}</span>
                }
              </li>
            }
          </ul>
        </section>

        <section aria-labelledby="interactions-title">
          <h2 id="interactions-title">Slowest interactions</h2>
          @if (!page.interactions.length) {
            <p class="empty">No interaction of 40 ms or more yet. Click or type in the app.</p>
          } @else {
            <table>
              <caption class="sr-only">
                Slowest interactions, slowest first
              </caption>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Target</th>
                  <th scope="col" class="num">Duration</th>
                  <th scope="col" class="num">At</th>
                </tr>
              </thead>
              <tbody>
                @for (row of page.interactions; track $index) {
                  <tr>
                    <td>
                      <code>{{ row.event }}</code>
                    </td>
                    <td>
                      <code>{{ row.target ?? '' }}</code>
                      @if (row.owner) {
                        <span class="muted"> in {{ row.owner.name }}</span>
                      }
                    </td>
                    <td class="num">{{ formatMs(row.durationMs) }}</td>
                    <td class="num">{{ formatMs(row.at) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>

        <section aria-labelledby="tasks-title">
          <h2 id="tasks-title">Long tasks</h2>
          <p class="summary">
            {{ page.longTaskCount }} long {{ page.longTaskCount === 1 ? 'task' : 'tasks' }}, total
            blocking time {{ formatMs(page.totalBlockingMs) }}.
          </p>
          @if (page.longTasks.length) {
            <table>
              <caption class="sr-only">
                Latest long tasks, newest first
              </caption>
              <thead>
                <tr>
                  <th scope="col" class="num">At</th>
                  <th scope="col" class="num">Duration</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                @for (task of latestTasks(); track $index) {
                  <tr>
                    <td class="num">{{ formatMs(task.at) }}</td>
                    <td class="num">{{ formatMs(task.durationMs) }}</td>
                    <td>
                      <code>{{
                        task.source ??
                          (task.kind === 'long-animation-frame' ? 'long animation frame' : 'task')
                      }}</code>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>
      }
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
      margin: 0 0 12px;
    }
    h2 {
      margin: 16px 0 8px;
      color: var(--text-strong);
      font-size: 14px;
    }
    code {
      font-family: var(--font-mono);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .muted {
      color: var(--text-2);
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .metric {
      @include m.panel;
      display: grid;
      gap: 4px;
      align-content: start;
      min-width: 0;
      padding: 10px 12px;
      border-left: 3px solid var(--border);
    }
    .metric[data-rating='good'] {
      border-left-color: var(--ok);
    }
    .metric[data-rating='needs-improvement'] {
      border-left-color: var(--warn);
    }
    .metric[data-rating='poor'] {
      border-left-color: var(--danger);
    }
    .name abbr {
      color: var(--text-2);
      font-weight: 600;
      text-decoration: none;
    }
    .value {
      color: var(--text-strong);
      font-size: 20px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .rating {
      font-size: 12px;
    }
    [data-rating='good'] .rating {
      color: var(--ok-text);
    }
    [data-rating='needs-improvement'] .rating {
      color: var(--warn-text);
    }
    [data-rating='poor'] .rating {
      color: var(--danger-text);
    }
    .link {
      justify-self: start;
      padding: 0;
      border: 0;
      border-radius: 2px;
      background: none;
      color: var(--accent-text);
      font: inherit;
      font-size: 12px;
      text-align: left;
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }
    .link:focus-visible {
      @include m.focus-ring;
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
    .empty,
    .state {
      margin: 0 0 12px;
      color: var(--text-2);
    }
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
  `,
})
export class PerformanceInspector {
  readonly rpc = input<DevframeRpcClient | null>(null);
  /** Whether the Components tab is on, so "Show component" has somewhere to go. */
  readonly canShowComponent = input(true);
  readonly showComponent = output<ComponentFocus>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly hostPageId = hostPageId();
  private unsubscribe?: () => void;

  protected readonly metrics = PERF_METRICS;
  protected readonly ratingLabel = RATING_LABEL;
  protected readonly format = formatPerf;
  protected readonly formatMs = formatMs;

  readonly pages = signal<PerfPage[]>([]);
  readonly loaded = signal(false);
  readonly failed = signal(false);
  /** Keeps the picked page while it reports; starts on the panel's own page. */
  readonly pageId = linkedSignal<PerfPage[], string>({
    source: () => this.pages(),
    computation: (pages, previous) =>
      previous?.value && pages.some((page) => page.pageId === previous.value)
        ? previous.value
        : ((pages.find((page) => page.pageId === this.hostPageId) ?? pages[0])?.pageId ?? ''),
  });
  readonly page = computed(() => this.pages().find((page) => page.pageId === this.pageId()));
  readonly pageOptions = computed<SelectOption[]>(() =>
    this.pages().map((page) => ({
      value: page.pageId,
      label: page.title || page.url || page.pageId,
      hint: page.url,
    })),
  );
  readonly latestTasks = computed(() => [...(this.page()?.longTasks ?? [])].reverse());

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client) void this.load(client);
    });
    this.destroyRef.onDestroy(() => this.unsubscribe?.());
  }

  retry() {
    const client = this.rpc();
    if (client) void this.load(client);
  }

  /** Why a metric has no value yet. */
  missing(page: PerfPage, entry: string): string {
    if (entry !== 'navigation' && !page.supported.includes(entry)) {
      return 'Not measured by this browser';
    }
    return 'Not measured yet';
  }

  private async load(client: DevframeRpcClient) {
    this.failed.set(false);
    try {
      const state = await client.scope('pangular').rpc.sharedState('performance');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) => this.pages.set(perfPages(value));
      apply(state.value());
      this.unsubscribe?.();
      this.unsubscribe = state.on('updated', apply);
    } catch {
      this.failed.set(true);
    } finally {
      this.loaded.set(true);
    }
  }
}
