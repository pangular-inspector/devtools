import { Component, computed, input, linkedSignal, output } from '@angular/core';

export interface HydrationMismatch {
  id: string;
  name: string;
  tag: string;
  expected?: string;
  actual?: string;
}

/** What a page reports about hydration; missing when it was not rendered on the server. */
export interface HydrationReport {
  hydrated: boolean;
  counts: {
    hydrated: number;
    skipped: number;
    mismatched: number;
    client: number;
    dehydratedBlocks: number;
  };
  mismatches: HydrationMismatch[];
  overlay?: boolean;
}

/**
 * The hydration summary of the Components page: counts by status, the
 * mismatches, and the switch for the outline the overlay draws on the page.
 */
@Component({
  selector: 'app-hydration-section',
  template: `
    <section class="hydration" aria-labelledby="ct-hydration-title">
      <h2 id="ct-hydration-title" class="title">Hydration</h2>
      @if (report(); as r) {
        @if (!r.hydrated) {
          <p class="empty">
            The HTML came from the server, but no component was hydrated, so the app rendered again
            on the client. Add <code>provideClientHydration()</code> and use a development build to
            see each component's status.
          </p>
        } @else {
          <div class="summary">
            <ul class="counts" aria-label="Hydration summary">
              @for (item of counts(); track item.key) {
                <li [class]="'count count-' + item.key">
                  <span class="num">{{ item.value }}</span> {{ item.label }}
                </li>
              }
            </ul>
            <button
              type="button"
              class="outline"
              [attr.aria-pressed]="overlayOn()"
              (click)="toggleOverlay()"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 3" />
              </svg>
              Outline on page
            </button>
          </div>
          @if (r.mismatches.length) {
            <h3 class="label">Mismatches</h3>
            <ul class="mismatches">
              @for (m of r.mismatches; track m.id) {
                <li>
                  <button
                    type="button"
                    class="mismatch"
                    (click)="showNode.emit(m.id)"
                    (focus)="highlight.emit(m.id)"
                    (blur)="highlight.emit(null)"
                    (mouseenter)="highlight.emit(m.id)"
                    (mouseleave)="highlight.emit(null)"
                  >
                    <span class="name mono">{{ m.name }}</span>
                    <span class="mono muted">&lt;{{ m.tag }}&gt;</span>
                    @if (m.expected) {
                      <span class="detail-line"
                        >Expected <code>{{ m.expected }}</code></span
                      >
                    }
                    @if (m.actual) {
                      <span class="detail-line"
                        >Found <code>{{ m.actual }}</code></span
                      >
                    }
                  </button>
                </li>
              }
            </ul>
          }
        }
      } @else {
        <p class="empty">
          This page was not rendered on the server, so there is nothing to hydrate. With server-side
          rendering and <code>provideClientHydration()</code>, each component shows whether it was
          hydrated, skipped or mismatched.
        </p>
      }
    </section>
  `,
  styles: `
    @use 'mixins' as m;

    .hydration {
      margin-top: 16px;
    }
    .title {
      @include m.label;
      margin: 0 0 8px;
    }
    .label {
      @include m.label;
      margin: 12px 0 6px;
    }
    .empty {
      margin: 0;
      padding: 10px 12px;
      border: 1px dashed var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-2);
      line-height: 1.5;
    }
    code,
    .mono {
      font-family: var(--font-mono);
    }
    code {
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .muted {
      color: var(--text-2);
    }
    .summary {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
    }
    .counts {
      display: flex;
      flex: 1 1 auto;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .count {
      padding: 2px 10px;
      border: 1px solid var(--border-strong);
      border-radius: 99px;
      color: var(--text);
      font-size: 12px;
    }
    .num {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .count-hydrated {
      @include m.tint(ok);
    }
    .count-skipped,
    .count-dehydratedBlocks {
      @include m.tint(warn);
    }
    .count-mismatched {
      @include m.tint(danger);
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: var(--control-h);
      padding: 0 14px;
      background: var(--surface-2);
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      color: var(--text);
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      transition:
        background-color 150ms var(--ease),
        border-color 150ms var(--ease);
    }
    button:hover {
      background: var(--surface-3);
      border-color: var(--accent-line);
    }
    button:focus-visible {
      @include m.focus-ring;
    }
    .outline[aria-pressed='true'] {
      background: var(--accent-soft);
      border-color: var(--accent-line);
      color: var(--text-strong);
    }
    svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
    }
    .mismatches {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .mismatch {
      flex-wrap: wrap;
      justify-content: flex-start;
      width: 100%;
      height: auto;
      min-height: var(--control-h);
      padding: 6px 12px;
      background: var(--surface);
      border-color: var(--border);
      text-align: left;
    }
    .name {
      color: var(--text-strong);
      font-size: 12px;
      font-weight: 600;
    }
    .detail-line {
      width: 100%;
      color: var(--text-2);
      font-size: 12px;
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        transition: none;
      }
    }
  `,
})
export class HydrationSection {
  readonly report = input<HydrationReport | undefined>(undefined);
  readonly overlay = output<boolean>();
  readonly showNode = output<string>();
  readonly highlight = output<string | null>();

  /** Follows the page, and shows a click at once while the page catches up. */
  readonly overlayOn = linkedSignal(() => this.report()?.overlay === true);

  readonly counts = computed(() => {
    const counts = this.report()?.counts;
    if (!counts) return [];
    return [
      { key: 'hydrated', label: 'hydrated', value: counts.hydrated },
      { key: 'skipped', label: 'skipped', value: counts.skipped },
      { key: 'mismatched', label: 'mismatched', value: counts.mismatched },
      { key: 'client', label: 'created on the client', value: counts.client },
      {
        key: 'dehydratedBlocks',
        label:
          counts.dehydratedBlocks === 1 ? 'dehydrated @defer block' : 'dehydrated @defer blocks',
        value: counts.dehydratedBlocks,
      },
    ];
  });

  toggleOverlay() {
    const next = !this.overlayOn();
    this.overlayOn.set(next);
    this.overlay.emit(next);
  }
}
