import { Component, computed, input, output, signal } from '@angular/core';
import {
  RETAINED_AFTER_MS,
  RETAINED_AFTER_NAVIGATIONS,
  type AngularPageInfo,
} from '@pangular-inspector/devtools/config';
import type { DevframeRpcClient } from 'devframe/client';
import { rpcCall } from '../rpc';
import { AngularUnavailable } from '../ui/angular-unavailable';

/** A component on the page with its live effects and tracked subscriptions. */
export interface LeakComponent {
  id: string;
  name: string;
  effects: number;
  sharedEffects?: number;
  subscriptions: number;
}

/** A component instance that left the page and was not collected yet. */
export interface LeakDestroyed {
  id: string;
  name: string;
  route: string;
  destroyedAt: number;
  navigations: number;
  detached?: boolean;
  subscriptions?: number;
}

/** Subscriptions still open after the component that made them went away. */
export interface LeakSubscription {
  name: string;
  instanceId?: string;
  count: number;
  source?: string;
  route: string;
  openedAt: number;
  reason: 'instance-destroyed' | 'no-live-instance';
}

/** One page's leak report, as the `leaks` shared state holds it. */
export interface LeaksPage {
  pageId: string;
  url: string;
  title: string;
  at: number;
  reportedAt: number;
  support: {
    /**
     * `'dev-di-debug'`: the page's Angular keeps DI debug data that holds every
     * destroyed component, so retained instances can't be listed.
     */
    retention: boolean | 'dev-di-debug';
    effects: boolean;
    subscriptions: 'off' | 'on' | 'unavailable';
    instances?: boolean;
    detached?: boolean;
  };
  navigations: number;
  totals: {
    components: number;
    effects: number;
    subscriptions: number;
    destroyed: number;
    collected: number;
    dropped: number;
  };
  components: LeakComponent[];
  destroyed: LeakDestroyed[];
  subscriptions: LeakSubscription[];
}

const SHOWN = 20;

function age(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 120) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  return minutes < 120 ? `${minutes} min` : `${Math.round(minutes / 60)} h`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Leak hints on the Components page: instances destroyed but still in memory
 * after a few navigations, subscriptions still open after their component went
 * away (while tracking is on), and live effects and subscriptions per component.
 */
@Component({
  selector: 'app-leaks-section',
  imports: [AngularUnavailable],
  template: `
    <section class="leaks" aria-labelledby="ct-leaks-title">
      <div class="head">
        <h2 id="ct-leaks-title">Leaks</h2>
        <button
          type="button"
          class="track"
          [attr.aria-pressed]="tracking()"
          [attr.aria-disabled]="busy() || null"
          [disabled]="!pageId() || !report()"
          (click)="toggle()"
        >
          Track subscriptions
        </button>
        <p class="sr-only" role="status">{{ announcement() }}</p>
      </div>
      <p class="hint">
        Components that left the page but are still in memory, and the live effects and RxJS
        subscriptions of each component. The browser collects garbage when it decides, so a retained
        instance is a hint: check what holds it in the Chrome DevTools Memory panel.
      </p>

      @if (report(); as page) {
        @if (page.support.retention === 'dev-di-debug') {
          <p class="stats">{{ plural(page.navigations, 'navigation') }}</p>
          <h3 class="sub">Still retained</h3>
          <p class="note">
            In a development build, Angular's DI debug data keeps every destroyed component in
            memory, so Pangular can't tell a leak from that. Check retainers in the Chrome DevTools
            Memory panel: take a heap snapshot after a few navigations, search for the class and
            look for a retainer other than Angular's DI debug records. Open subscriptions after
            destroy are still tracked below.
          </p>
        } @else {
          @if (!page.support.retention) {
            <p class="note">
              This page cannot track destroyed components. It needs WeakRef, FinalizationRegistry
              and the Angular debug API of a development build.
            </p>
          }
          <p class="stats">
            {{ plural(page.navigations, 'navigation') }} · {{ retained().length }} still retained ·
            {{ plural(page.totals.collected, 'instance') }} collected
          </p>

          <h3 class="sub">
            Still retained
            <span class="pill">{{ retained().length }}</span>
          </h3>
          @if (retained().length) {
            <p class="note">
              Destroyed, yet still in memory after at least {{ minNavigations }} navigations and
              {{ minSeconds }} seconds. Take a heap snapshot, search for the class and read its
              retainers.
            </p>
            <ul class="rows">
              @for (item of retained().slice(0, shown); track item.id) {
                <li class="row">
                  <span class="name mono">{{ item.name }}</span>
                  <span class="meta mono">{{ item.route || '/' }}</span>
                  <span class="count">{{ plural(item.navigations, 'navigation') }} ago</span>
                  <span class="meta">{{ ageOf(item) }}</span>
                  @if (item.subscriptions) {
                    <span class="flag warn">{{
                      plural(item.subscriptions, 'open subscription')
                    }}</span>
                  }
                </li>
              }
            </ul>
          } @else {
            <p class="note">No destroyed component is still in memory after a few navigations.</p>
          }
          @if (recent().length) {
            <p class="note">
              {{ plural(recent().length, 'instance') }} destroyed recently and not collected yet:
              <span class="mono">{{ names(recent()) }}</span
              >. Navigate a few times to see whether they stay.
            </p>
          }
        }
        @if (detached().length) {
          <p class="note">
            Off the page but not destroyed (detached views, such as a route reuse cache):
            <span class="mono">{{ names(detached()) }}</span
            >.
          </p>
        }

        <h3 class="sub">
          Open subscriptions after destroy
          @if (page.support.subscriptions === 'on') {
            <span class="pill">{{ page.subscriptions.length }}</span>
          }
        </h3>
        @switch (page.support.subscriptions) {
          @case ('on') {
            @if (page.subscriptions.length) {
              <p class="note">
                Still open although the component that made them is gone. Tear them down with
                takeUntilDestroyed(), DestroyRef.onDestroy or the async pipe.
              </p>
              <ul class="rows">
                @for (sub of page.subscriptions.slice(0, shown); track $index) {
                  <li class="row">
                    <span class="name mono">{{ sub.name }}</span>
                    <span class="count">{{ sub.count }} open</span>
                    <span class="flag warn">
                      {{
                        sub.reason === 'instance-destroyed'
                          ? 'instance destroyed'
                          : 'no instance left'
                      }}
                    </span>
                    @if (sub.source) {
                      <span class="meta mono">{{ sub.source }}</span>
                    }
                  </li>
                }
              </ul>
            } @else {
              <p class="note">No subscription is still open after its component went away.</p>
            }
            @if (!page.support.instances) {
              <p class="note">
                Subscriptions are tied to component classes only; Angular 20 profiler hooks tie them
                to instances.
              </p>
            }
          }
          @case ('unavailable') {
            <p class="note" role="status">
              Tracking could not start: the page has no RxJS the overlay can load.
            </p>
          }
          @default {
            <p class="note">
              Off. Track subscriptions wraps Observable.prototype.subscribe on the page to record
              which component makes each subscription, until you stop it. Subscriptions made before
              you start are not seen, so reload or navigate again after starting.
            </p>
          }
        }

        <h3 class="sub">
          Live effects and subscriptions
          <span class="pill">{{ page.components.length }}</span>
        </h3>
        @if (!page.support.effects) {
          <app-angular-unavailable [page]="angular()" capability="signalGraph" missing compact />
        }
        @if (page.components.length) {
          <ul class="rows">
            @for (item of page.components.slice(0, shown); track item.id) {
              <li>
                <button
                  type="button"
                  class="row live"
                  (click)="showComponent.emit(item.id)"
                  (focus)="highlight.emit(item.id)"
                  (blur)="highlight.emit(null)"
                  (mouseenter)="highlight.emit(item.id)"
                  (mouseleave)="highlight.emit(null)"
                >
                  <span class="name mono">{{ item.name }}</span>
                  <span class="count">{{ effectsText(item) }}</span>
                  @if (page.support.subscriptions === 'on') {
                    <span class="count">{{ plural(item.subscriptions, 'subscription') }}</span>
                  }
                </button>
              </li>
            }
          </ul>
          @if (page.components.some(hasShared)) {
            <p class="note">
              Angular files a component's effects under the template its host sits in, so effects of
              components side by side in one template show as shared.
            </p>
          }
        } @else {
          <p class="note">No component on the page has a live effect or a tracked subscription.</p>
        }
      } @else {
        <p class="note">No leak data from this page yet. It comes with the next report.</p>
      }
    </section>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
    }
    .leaks {
      margin-top: 16px;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    h2 {
      @include m.label;
      margin: 0;
    }
    .track {
      height: var(--control-h);
    }
    .track[aria-pressed='true'] {
      @include m.tint(accent);
    }
    .track[aria-disabled='true'] {
      cursor: progress;
    }
    .track:focus-visible {
      @include m.focus-ring;
    }
    .hint,
    .note,
    .stats {
      margin: 8px 0;
      color: var(--text-2);
      font-size: 12px;
      line-height: 1.5;
    }
    .stats {
      color: var(--text);
    }
    .sub {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 14px 0 6px;
      color: var(--text-strong);
      font-size: 12px;
      font-weight: 600;
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
    }
    .rows {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      min-height: var(--control-h);
      padding: 6px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      font-size: 12px;
    }
    .row.live {
      justify-content: flex-start;
      width: 100%;
      height: auto;
      text-align: left;
    }
    .row.live:focus-visible {
      @include m.focus-ring;
    }
    .name {
      min-width: 0;
      color: var(--text-strong);
      font-weight: 600;
      @include m.truncate;
    }
    .mono {
      font-family: var(--font-mono);
    }
    .meta {
      min-width: 0;
      color: var(--text-2);
      @include m.truncate;
    }
    .count {
      padding: 0 8px;
      border-radius: 99px;
      background: var(--surface-3);
      color: var(--text-2);
      font-size: 11px;
      line-height: 18px;
    }
    .flag {
      padding: 0 6px;
      border-radius: 5px;
      font-size: 11px;
      line-height: 18px;
    }
    .flag.warn {
      @include m.tint(warn);
    }
  `,
})
export class LeaksSection {
  /** The page's leak report, or `null` before its first one. */
  readonly report = input<LeaksPage | null>(null);
  readonly pageId = input<string | null>(null);
  readonly rpc = input<DevframeRpcClient | null>(null);
  /** The page's Angular version, which the unavailable note names. */
  readonly angular = input<AngularPageInfo | null>(null);
  /** Clock for ages; a test passes its own. */
  readonly now = input<() => number>(() => Date.now());
  /** Selects a component in the tree, by its id. */
  readonly showComponent = output<string>();
  /** The element to highlight in the app, or `null` to clear it. */
  readonly highlight = output<string | null>();

  protected readonly shown = SHOWN;
  protected readonly minNavigations = RETAINED_AFTER_NAVIGATIONS;
  protected readonly minSeconds = RETAINED_AFTER_MS / 1000;
  protected readonly plural = plural;
  protected readonly busy = signal(false);
  protected readonly announcement = signal('');

  protected readonly tracking = computed(() => this.report()?.support.subscriptions === 'on');

  private readonly split = computed(() => {
    const page = this.report();
    const retained: LeakDestroyed[] = [];
    const recent: LeakDestroyed[] = [];
    const detached: LeakDestroyed[] = [];
    if (!page) return { retained, recent, detached };
    // Angular's DI debug data keeps every destroyed instance; only detached views mean something.
    const held = page.support.retention === 'dev-di-debug';
    for (const item of page.destroyed) {
      if (item.detached) detached.push(item);
      else if (held) continue;
      else if (this.isRetained(page, item)) retained.push(item);
      else recent.push(item);
    }
    return { retained, recent, detached };
  });
  protected readonly retained = computed(() => this.split().retained);
  protected readonly recent = computed(() => this.split().recent);
  protected readonly detached = computed(() => this.split().detached);

  private ageMs(page: LeaksPage, item: LeakDestroyed): number {
    return Math.max(0, this.now()() - page.reportedAt + (page.at - item.destroyedAt));
  }

  private isRetained(page: LeaksPage, item: LeakDestroyed): boolean {
    return (
      item.navigations >= RETAINED_AFTER_NAVIGATIONS && this.ageMs(page, item) >= RETAINED_AFTER_MS
    );
  }

  protected ageOf(item: LeakDestroyed): string {
    const page = this.report();
    return page ? `${age(this.ageMs(page, item))} old` : '';
  }

  protected names(items: LeakDestroyed[]): string {
    const names = [...new Set(items.map((item) => item.name))];
    return names.length > 6 ? `${names.slice(0, 6).join(', ')} and more` : names.join(', ');
  }

  protected hasShared(item: LeakComponent): boolean {
    return !!item.sharedEffects;
  }

  protected effectsText(item: LeakComponent): string {
    const own = plural(item.effects, 'effect');
    return item.sharedEffects ? `${own}, ${item.sharedEffects} shared` : own;
  }

  async toggle() {
    const pageId = this.pageId();
    if (!pageId || this.busy()) return;
    const on = !this.tracking();
    this.busy.set(true);
    try {
      await rpcCall(this.rpc(), 'request-leak-tracking', { pageId, on });
      this.announcement.set(
        on
          ? 'Tracking subscriptions. Reload or navigate to see subscriptions made at start.'
          : 'Stopped tracking subscriptions.',
      );
    } catch {
      this.announcement.set('Could not reach the page. Try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
