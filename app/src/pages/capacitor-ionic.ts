import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';

/** One page in an `ion-router-outlet` stack, as `push-ionic` reports it. */
export interface IonicStackPage {
  component: string;
  tag: string;
  url?: string;
  active: boolean;
  elementId: string;
}

/** One `ion-router-outlet` and its page stack, oldest page first. */
export interface IonicOutlet {
  id: string;
  name: string;
  tabs?: string;
  source: 'angular' | 'dom';
  pages: IonicStackPage[];
  truncated?: number;
  canGoBack?: boolean;
  direction?: 'forward' | 'back' | 'root';
  directionSource?: 'event' | 'inferred';
  animated?: boolean;
  tabSwitch?: boolean;
}

/** One page's Ionic report in the `ionic` shared state. */
export interface IonicPage {
  pageId: string;
  url: string;
  title: string;
  framework: '@ionic/angular' | '@ionic/core';
  mode?: string;
  outlets: IonicOutlet[];
  truncatedOutlets?: number;
  reportedAt: number;
}

/** The Ionic pages in the `ionic` shared state. */
export function ionicPages(value: unknown): IonicPage[] {
  const pages = (value as { pages?: Record<string, IonicPage> } | undefined)?.pages;
  return pages && typeof pages === 'object' ? Object.values(pages) : [];
}

const DIRECTION_LABELS: Record<NonNullable<IonicOutlet['direction']>, string> = {
  forward: 'Forward',
  back: 'Back',
  root: 'Root',
};

/** The direction of an outlet's last navigation, in words. */
export function directionText(outlet: IonicOutlet): string {
  if (!outlet.direction) return 'Not seen yet';
  const label = DIRECTION_LABELS[outlet.direction];
  if (outlet.directionSource === 'inferred') return `${label} (from the stack)`;
  const notes = [
    outlet.tabSwitch ? 'tab switch' : null,
    outlet.animated === false ? 'no animation' : null,
  ].filter(Boolean);
  return notes.length ? `${label} (${notes.join(', ')})` : label;
}

/**
 * The page stack of each `ion-router-outlet` of one page, in the Capacitor
 * tab. It reads the `ionic` shared state only; hovering a page outlines it in
 * the app.
 */
@Component({
  selector: 'app-capacitor-ionic',
  template: `
    @if (page(); as page) {
      <section aria-labelledby="cap-ionic-title">
        <h2 id="cap-ionic-title">Ionic page stacks</h2>
        <p class="lead">
          Each <code>ion-router-outlet</code> keeps the pages it has shown in a stack, oldest first.
          Read through <code>{{ page.framework }}</code
          >{{ page.mode ? ' in ' + page.mode + ' mode' : '' }}. The panel changes nothing in the
          app.
        </p>
        @if (!page.outlets.length) {
          <p class="empty">This page has no <code>ion-router-outlet</code>.</p>
        } @else {
          <div class="cards">
            @for (outlet of page.outlets; track outlet.id) {
              <article class="card" [attr.aria-labelledby]="'cap-ionic-' + outlet.id">
                <h3 [id]="'cap-ionic-' + outlet.id">
                  <code>ion-router-outlet</code>
                  @if (outlet.name !== 'primary') {
                    <code class="outlet-name">{{ outlet.name }}</code>
                  }
                  @if (outlet.tabs) {
                    <span class="tabs"
                      >in tabs <code>{{ outlet.tabs }}</code></span
                    >
                  }
                </h3>
                <dl>
                  <div>
                    <dt>Pages</dt>
                    <dd>{{ outlet.pages.length + (outlet.truncated ?? 0) }}</dd>
                  </div>
                  <div>
                    <dt>Last navigation</dt>
                    <dd>{{ directionText(outlet) }}</dd>
                  </div>
                  @if (outlet.canGoBack !== undefined) {
                    <div>
                      <dt>Can go back</dt>
                      <dd>{{ outlet.canGoBack ? 'Yes' : 'No' }}</dd>
                    </div>
                  }
                </dl>
                @if (outlet.pages.length) {
                  <ol class="stack" [attr.aria-label]="'Page stack of ' + outletLabel(outlet)">
                    @for (item of outlet.pages; track item.elementId; let i = $index) {
                      <li>
                        <button
                          type="button"
                          class="stack-page"
                          [class.active]="item.active"
                          [attr.aria-current]="item.active ? 'page' : null"
                          (mouseenter)="highlight(item)"
                          (mouseleave)="highlight(null)"
                          (focus)="highlight(item)"
                          (blur)="highlight(null)"
                          (click)="highlight(item, true)"
                        >
                          <span class="index" aria-hidden="true">{{ i + 1 }}</span>
                          <code class="component">{{ item.component }}</code>
                          @if (item.url) {
                            <code class="url">{{ item.url }}</code>
                          }
                          @if (item.active) {
                            <span class="chip">Active</span>
                          }
                        </button>
                      </li>
                    }
                  </ol>
                } @else {
                  <p class="empty">No page in this outlet yet.</p>
                }
                @if (outlet.truncated) {
                  <p class="note">{{ outlet.truncated }} older pages are not listed.</p>
                }
                @if (outlet.source === 'dom') {
                  <p class="note">
                    Read from the outlet's pages in the DOM, without URLs. The Angular directive was
                    not found: the app may not use <code>&#64;ionic/angular</code>, or it is not a
                    development build.
                  </p>
                }
              </article>
            }
          </div>
          @if (page.truncatedOutlets) {
            <p class="note">{{ page.truncatedOutlets }} more outlets are not listed.</p>
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
    section {
      margin: 0 0 24px;
    }
    h2 {
      margin: 0 0 12px;
      color: var(--text-strong);
      font-size: 15px;
    }
    .lead,
    .note,
    .empty {
      margin: 0 0 12px;
      color: var(--text-2);
      line-height: 1.5;
    }
    .note {
      margin: 8px 0 0;
      font-size: 12px;
    }
    code {
      font-family: var(--font-mono);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .cards {
      display: grid;
      gap: 12px;
    }
    .card {
      @include m.panel;
      padding: 12px;
      min-width: 0;
    }
    h3 {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      align-items: baseline;
      margin: 0 0 8px;
      color: var(--text-strong);
      font-size: 14px;
    }
    .tabs {
      color: var(--text-2);
      font-size: 12px;
      font-weight: 400;
    }
    dl {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 8px 16px;
      margin: 0 0 10px;
    }
    dl > div {
      min-width: 0;
    }
    dt {
      @include m.label;
      margin: 0 0 2px;
    }
    dd {
      margin: 0;
      color: var(--text-strong);
      overflow-wrap: anywhere;
    }
    .stack {
      display: grid;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .stack-page {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      align-items: center;
      width: 100%;
      min-height: var(--control-h);
      padding: 6px 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition: background-color 150ms var(--ease);
    }
    .stack-page:hover {
      background: var(--surface-2);
    }
    .stack-page.active {
      border-color: var(--accent-line);
      background: var(--accent-soft);
    }
    .stack-page:focus-visible {
      @include m.focus-ring(-2px);
    }
    .index {
      min-width: 18px;
      color: var(--text-2);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .component {
      color: var(--text-strong);
    }
    .url {
      flex: 1 1 160px;
      min-width: 0;
      color: var(--text-2);
    }
    .chip {
      margin-left: auto;
      padding: 1px 8px;
      border: 1px solid transparent;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
      @include m.tint(accent);
    }
    @media (prefers-reduced-motion: reduce) {
      .stack-page {
        transition: none;
      }
    }
  `,
})
export class CapacitorIonic {
  readonly rpc = input<DevframeRpcClient | null>(null);
  /** The page the Capacitor tab shows. */
  readonly pageId = input<string | null>(null);

  readonly pages = signal<IonicPage[]>([]);
  readonly page = computed(() => {
    const id = this.pageId();
    return id ? (this.pages().find((page) => page.pageId === id) ?? null) : null;
  });
  protected readonly directionText = directionText;

  private readonly destroyRef = inject(DestroyRef);
  private unsubscribe: (() => void) | null = null;

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client) void this.load(client);
    });
    this.destroyRef.onDestroy(() => {
      this.unsubscribe?.();
      this.highlight(null);
    });
  }

  private async load(client: DevframeRpcClient) {
    try {
      const state = await client.scope('pangular').rpc.sharedState('ionic');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) => this.pages.set(ionicPages(value));
      apply(state.value());
      this.unsubscribe?.();
      this.unsubscribe = state.on('updated', apply);
    } catch {
      this.pages.set([]);
    }
  }

  outletLabel(outlet: IonicOutlet): string {
    return outlet.name === 'primary' ? 'the primary outlet' : `outlet ${outlet.name}`;
  }

  /** Outlines a page of the stack in the app, or clears the outline. */
  highlight(item: IonicStackPage | null, reveal = false) {
    const client = this.rpc();
    if (!client) return;
    const target = item ? { pageId: this.pageId(), id: item.elementId, reveal } : null;
    void client
      .scope('pangular')
      .rpc.call('request-page-highlight', target)
      .catch(() => {});
  }
}
