import { Component, computed, effect, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Region } from '../travel/destination';
import { DestinationCard } from '../travel/destination-card';
import { TravelStore, type SortOrder } from '../travel/travel.store';

const SORTS: { id: SortOrder; label: string }[] = [
  { id: 'popular', label: 'Most popular' },
  { id: 'rating', label: 'Top rated' },
  { id: 'price', label: 'Lowest price' },
];

@Component({
  selector: 'app-destinations',
  imports: [DestinationCard, RouterLink],
  template: `
    <div class="container page">
      <header class="head">
        <p class="eyebrow">{{ savedOnly() ? 'Your list' : 'All trips' }}</p>
        <h1>{{ savedOnly() ? 'Saved destinations' : 'Destinations' }}</h1>
      </header>

      <div class="toolbar" role="search">
        <label class="field">
          <span class="sr-only">Search destinations</span>
          <svg
            class="field-icon"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            name="q"
            autocomplete="off"
            placeholder="Search by place or mood…"
            [value]="store.query()"
            (input)="update({ q: $any($event.target).value || null })"
          />
        </label>
        <div class="chips" role="group" aria-label="Region">
          @for (option of regionOptions(); track option) {
            <button
              type="button"
              class="chip"
              [class.active]="store.region() === option"
              [attr.aria-pressed]="store.region() === option"
              (click)="update({ region: option === 'All' ? null : option })"
            >
              {{ option }}
            </button>
          }
        </div>
        <label class="sort">
          <span>Sort by</span>
          <select
            name="sort"
            [value]="store.sort()"
            (change)="update({ sort: $any($event.target).value })"
          >
            @for (sort of sorts; track sort.id) {
              <option [value]="sort.id">{{ sort.label }}</option>
            }
          </select>
        </label>
      </div>

      <p class="count" aria-live="polite">
        <strong>{{ shown().length }}</strong> {{ shown().length === 1 ? 'trip' : 'trips' }}
        @if (savedOnly()) {
          <span aria-hidden="true">·</span> <a routerLink="/destinations">Show all</a>
        }
      </p>

      @if (shown().length) {
        <h2 class="sr-only">Results</h2>
        <div class="grid">
          @for (destination of shown(); track destination.id; let i = $index) {
            <app-destination-card [destination]="destination" [priority]="i < 3" />
          }
        </div>
      } @else {
        <div class="empty">
          <span class="empty-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              @if (savedOnly()) {
                <path
                  d="M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1Z"
                />
              } @else {
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              }
            </svg>
          </span>
          @if (nothingSaved()) {
            <h2>Nothing saved yet</h2>
            <p>Tap the heart on a trip to keep it here.</p>
            <a class="btn" routerLink="/destinations">Browse Destinations</a>
          } @else {
            <h2>{{ savedOnly() ? 'No saved trips match' : 'No trips match' }}</h2>
            <p>Try another place, or clear the filters.</p>
            <a
              class="btn"
              routerLink="/destinations"
              [queryParams]="savedOnly() ? { saved: 1 } : null"
              >Clear Filters</a
            >
          }
        </div>
      }
    </div>
  `,
  styles: `
    .page {
      padding-top: 40px;
      padding-bottom: 80px;
    }
    h1 {
      margin: 0 0 24px;
      font-size: clamp(28px, 4vw, 40px);
      line-height: 1.15;
      letter-spacing: -0.02em;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      background: var(--surface);
      box-shadow: var(--shadow-sm);
    }
    .field {
      position: relative;
      flex: 1 1 240px;
      min-width: 0;
    }
    .field-icon {
      position: absolute;
      top: 50%;
      left: 12px;
      color: var(--muted);
      transform: translateY(-50%);
      pointer-events: none;
    }
    input,
    select {
      box-sizing: border-box;
      width: 100%;
      height: var(--control-h);
      padding: 0 12px;
      border: 1px solid var(--line-strong);
      border-radius: 10px;
      background-color: var(--surface);
      color: var(--ink);
      transition:
        border-color 0.15s var(--ease),
        box-shadow 0.15s var(--ease);
    }
    input {
      padding-left: 36px;
    }
    input::placeholder {
      color: var(--muted);
      opacity: 1;
    }
    input:hover,
    select:hover {
      border-color: var(--ink);
    }
    input:focus-visible,
    select:focus-visible {
      border-color: var(--brand);
      outline: none;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 30%, transparent);
    }
    select {
      width: auto;
      max-width: 100%;
      padding-right: 36px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      height: var(--control-h);
      padding: 0 16px;
      border: 1px solid var(--line);
      border-radius: 99px;
      background: var(--subtle);
      color: var(--ink);
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
      transition:
        background-color 0.15s var(--ease),
        border-color 0.15s var(--ease),
        color 0.15s var(--ease);
    }
    .chip:hover {
      border-color: var(--line-strong);
    }
    .chip.active {
      border-color: var(--accent);
      background: var(--accent);
      color: var(--accent-ink);
      font-weight: 600;
    }
    .sort {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
      color: var(--muted);
      font-size: 14px;
      white-space: nowrap;
    }
    .count {
      display: flex;
      align-items: baseline;
      gap: 6px;
      margin: 24px 0 16px;
      color: var(--muted);
      font-size: 14px;
      font-variant-numeric: tabular-nums;
    }
    .count strong {
      color: var(--ink);
      font-weight: 600;
    }
    .count a {
      color: var(--brand);
      font-weight: 500;
      text-underline-offset: 2px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
      gap: 24px;
    }
    .empty {
      display: grid;
      justify-items: center;
      padding: 56px 24px;
      border: 1px dashed var(--line-strong);
      border-radius: var(--radius-lg);
      background: var(--surface);
      text-align: center;
    }
    .empty-icon {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      border-radius: 50%;
      background: var(--brand-soft);
      color: var(--brand);
    }
    .empty h2 {
      margin: 0 0 8px;
      font-size: 20px;
      line-height: 1.3;
    }
    .empty p {
      max-width: 40ch;
      margin: 0 0 24px;
      color: var(--muted);
    }
    @media (max-width: 600px) {
      .page {
        padding-top: 32px;
      }
      .toolbar {
        align-items: stretch;
      }
      .field {
        flex-basis: 100%;
      }
      .chips {
        flex: 1 1 100%;
      }
      .chip {
        flex: 1 1 auto;
      }
      .sort {
        flex: 1 1 100%;
        margin-left: 0;
      }
      .sort select {
        flex: 1;
      }
    }
  `,
})
export class Destinations {
  readonly q = input<string>();
  readonly region = input<string>();
  readonly sort = input<string>();
  readonly saved = input<string>();

  protected readonly store = inject(TravelStore);
  private readonly router = inject(Router);
  protected readonly sorts = SORTS;
  protected readonly regionOptions = computed(() => ['All', ...this.store.regions()] as const);
  protected readonly savedOnly = computed(() => !!this.saved());
  protected readonly nothingSaved = computed(
    () => this.savedOnly() && this.store.savedDestinations().length === 0,
  );
  protected readonly shown = computed(() =>
    this.savedOnly()
      ? this.store.results().filter((d) => this.store.saved().includes(d.id))
      : this.store.results(),
  );

  constructor() {
    effect(() => {
      const query = this.q() ?? '';
      this.store.setQuery(query);
      this.store.trackSearch(query);
      const region = this.region();
      this.store.setRegion(
        region && this.store.regions().includes(region as Region) ? (region as Region) : 'All',
      );
      const sort = this.sort();
      this.store.setSort(SORTS.some((s) => s.id === sort) ? (sort as SortOrder) : 'popular');
    });
  }

  protected update(params: Record<string, string | null>) {
    void this.router.navigate([], {
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
