import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';

// Startup timing for the Injectors tab: milestones from navigation start to
// the first stable state, and the slowest providers to construct
// (`startup-timing.ts` and `startup-recorder.ts` in the package).

export interface PanelProviderTiming {
  name: string;
  count: number;
  ms: number;
  selfMs: number;
  firstAt: number;
}

export interface PanelStartupPage {
  pageId: string;
  url?: string;
  reportedAt: number;
  angularVersion?: string;
  navigation: { domContentLoaded?: number; load?: number; firstContentfulPaint?: number };
  angularStart?: { at: number; source: 'hook' | 'feature-mark' };
  bootstrapComponent?: { start: number; end: number };
  firstStable?: { at: number; exact: boolean };
  overlayStart: number;
  hook: boolean;
  providers: {
    status: 'measured' | 'recording' | 'needs-hook' | 'unavailable';
    note?: string;
    count: number;
    totalSelfMs: number;
    slowest: PanelProviderTiming[];
  };
}

interface Milestone {
  label: string;
  at: number;
  source: string;
}

/** `640 ms` or `1.25 s`. */
export function formatMs(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value * 10) / 10} ms`;
}

/** The milestones of a page, in time order. */
export function milestones(page: PanelStartupPage): Milestone[] {
  const list: Milestone[] = [];
  const add = (label: string, at: number | undefined, source: string) => {
    if (typeof at === 'number') list.push({ label, at, source });
  };
  add('DOM content loaded', page.navigation.domContentLoaded, 'Navigation timing');
  add('First contentful paint', page.navigation.firstContentfulPaint, 'Paint timing');
  add(
    'Angular started',
    page.angularStart?.at,
    page.angularStart?.source === 'hook' ? 'Startup hook' : 'First Angular feature mark',
  );
  add('Root component created', page.bootstrapComponent?.end, 'Angular profiler');
  add(
    page.firstStable?.exact === false ? 'First stable, at the latest' : 'First stable',
    page.firstStable?.at,
    'ApplicationRef.isStable',
  );
  add('Load event', page.navigation.load, 'Navigation timing');
  add('Overlay started', page.overlayStart, 'Overlay');
  return list.sort((a, b) => a.at - b.at);
}

/** The pages of the `startup` shared state, newest first. */
export function startupPages(value: unknown): PanelStartupPage[] {
  const pages = (value as { pages?: Record<string, PanelStartupPage> } | undefined)?.pages;
  if (!pages || typeof pages !== 'object') return [];
  return Object.values(pages)
    .filter((page) => page && typeof page.pageId === 'string' && page.providers)
    .sort((a, b) => b.reportedAt - a.reportedAt);
}

const SLOWEST_SHOWN = 10;

@Component({
  selector: 'app-startup-section',
  template: `
    @if (page(); as startup) {
      <section class="startup" aria-labelledby="startup-title">
        <h2 id="startup-title">Startup</h2>
        <p class="intro">{{ intro() }}</p>
        <div class="table-wrap" tabindex="0" role="region" aria-label="Startup milestones">
          <table>
            <thead>
              <tr>
                <th scope="col">Milestone</th>
                <th scope="col">At</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              @for (step of steps(); track step.label) {
                <tr>
                  <td>{{ step.label }}</td>
                  <td class="num">{{ format(step.at) }}</td>
                  <td class="muted">{{ step.source }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <h3 class="label">Slowest providers</h3>
        @switch (startup.providers.status) {
          @case ('needs-hook') {
            <p class="muted">
              Load <code>&#64;pangular-inspector/devtools/startup-hook</code> from the polyfills of
              the development build to time each provider's construction.
            </p>
          }
          @case ('unavailable') {
            <p class="muted">
              {{ startup.providers.note || 'Provider timing is unavailable on this page.' }}
            </p>
          }
          @default {
            <p class="muted">
              @if (startup.providers.status === 'recording') {
                Recording until one second after the app is first stable.
              }
              {{ startup.providers.count }} provider instances,
              {{ format(startup.providers.totalSelfMs) }}
              of construction, from Angular's own profiling. Own time leaves out what each one
              created. Components and directives show up too, since Angular creates them through
              injectors.
            </p>
            @if (slowest().length) {
              <div class="table-wrap" tabindex="0" role="region" aria-label="Slowest providers">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Provider</th>
                      <th scope="col">Own time</th>
                      <th scope="col">Total</th>
                      <th scope="col">Instances</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (provider of slowest(); track provider.name) {
                      <tr>
                        <td class="mono">{{ provider.name }}</td>
                        <td class="num">{{ format(provider.selfMs) }}</td>
                        <td class="num">{{ format(provider.ms) }}</td>
                        <td class="num">{{ provider.count }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          }
        }
      </section>
    }
  `,
  styles: `
    @use 'mixins' as m;
    :host {
      display: block;
    }
    .startup {
      @include m.panel;
      display: grid;
      gap: 8px;
      min-width: 0;
      margin-top: 16px;
      padding: 12px;
      font-size: 13px;
    }
    h2 {
      margin: 0;
      color: var(--text-strong);
      font-size: 15px;
    }
    .label {
      @include m.label;
      margin: 8px 0 0;
    }
    .intro,
    .muted {
      margin: 0;
      color: var(--text-2);
      line-height: 1.5;
    }
    code,
    .mono {
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .table-wrap {
      max-width: 100%;
      overflow-x: auto;
      border-radius: var(--radius-sm);
    }
    .table-wrap:focus-visible {
      @include m.focus-ring(-2px);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th,
    td {
      padding: 6px 8px;
      border-bottom: 1px solid var(--border);
      text-align: left;
    }
    th {
      color: var(--text-2);
      font-weight: 600;
      white-space: nowrap;
    }
    td {
      color: var(--text);
      overflow-wrap: anywhere;
    }
    td.muted {
      color: var(--text-2);
    }
    .num {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
  `,
})
export class StartupSection {
  readonly rpc = input<DevframeRpcClient | null>(null);
  /** The page the Injectors tab shows; the newest report without one. */
  readonly pageId = input<string | null>(null);

  private readonly destroyRef = inject(DestroyRef);
  private unsubscribe?: () => void;
  protected readonly format = formatMs;

  readonly pages = signal<PanelStartupPage[]>([]);
  readonly page = computed(() => {
    const pages = this.pages();
    const wanted = this.pageId();
    return (wanted ? pages.find((page) => page.pageId === wanted) : undefined) ?? pages[0] ?? null;
  });
  readonly steps = computed(() => {
    const page = this.page();
    return page ? milestones(page) : [];
  });
  readonly slowest = computed(() => this.page()?.providers.slowest.slice(0, SLOWEST_SHOWN) ?? []);
  readonly intro = computed(() => {
    const page = this.page();
    const version = page?.angularVersion ? ` (Angular ${page.angularVersion})` : '';
    const span = this.total();
    const took = span
      ? `: ${span.exact ? '' : 'at most '}${formatMs(span.ms)} from Angular's start to stable`
      : '';
    return `From navigation start to the app's first stable state on the live page${version}${took}.`;
  });
  /** Angular start to first stable. */
  readonly total = computed(() => {
    const page = this.page();
    if (!page?.angularStart || !page.firstStable) return null;
    return {
      ms: Math.max(0, page.firstStable.at - page.angularStart.at),
      exact: page.firstStable.exact,
    };
  });

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client) void this.load(client);
    });
    this.destroyRef.onDestroy(() => this.unsubscribe?.());
  }

  /** Counts loads, so an answer for an earlier `rpc` client is dropped. */
  private loadId = 0;

  private async load(client: DevframeRpcClient) {
    const id = ++this.loadId;
    const current = () => !this.destroyRef.destroyed && id === this.loadId && this.rpc() === client;
    try {
      const shared = await client.scope('pangular').rpc.sharedState('startup');
      if (!current()) return;
      const apply = (value: unknown) => this.pages.set(startupPages(value));
      apply(shared.value());
      this.unsubscribe?.();
      this.unsubscribe = shared.on('updated', apply);
    } catch {
      if (!current()) return;
      // The Injectors tab shows its own load error; this section stays hidden.
      this.pages.set([]);
    }
  }
}
