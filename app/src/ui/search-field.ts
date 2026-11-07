import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  model,
  signal,
  viewChild,
} from '@angular/core';

const SAVED_KEY = 'pangular-pref:filters';
/** How many filters one view keeps. */
export const MAX_SAVED_FILTERS = 8;
const MAX_FILTER_LENGTH = 200;

/** The filters the viewer saved for `view`, newest last. Blocked or bad storage gives none. */
export function readSavedFilters(view: string): string[] {
  try {
    const raw = localStorage.getItem(`${SAVED_KEY}:${view}`);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Storage may be stale or hand edited, so each entry is checked.
    const valid = parsed.filter(
      (entry): entry is string =>
        typeof entry === 'string' && !!entry.trim() && entry.length <= MAX_FILTER_LENGTH,
    );
    return [...new Set(valid)].slice(-MAX_SAVED_FILTERS);
  } catch {
    return [];
  }
}

/** Saves the filters of `view`; an empty list removes the entry. */
export function writeSavedFilters(view: string, filters: readonly string[]) {
  try {
    if (filters.length) localStorage.setItem(`${SAVED_KEY}:${view}`, JSON.stringify(filters));
    else localStorage.removeItem(`${SAVED_KEY}:${view}`);
  } catch {
    // Blocked storage only forgets the saved filters on the next reload.
  }
}

/**
 * The search field every page uses: a search icon, the accessible name
 * "Filter", Escape to clear, no autocomplete or spellcheck. With `saveKey`,
 * the viewer can save the current text as a chip for that view, kept in this
 * browser's local storage, and apply it again with one click.
 */
@Component({
  selector: 'app-search-field',
  template: `
    <div class="box">
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        #input
        type="search"
        autocomplete="off"
        spellcheck="false"
        [attr.id]="inputId()"
        [attr.aria-label]="label()"
        [attr.aria-describedby]="describedBy()"
        [placeholder]="placeholder()"
        [value]="value()"
        (input)="value.set($any($event.target).value)"
        (keydown.escape)="clear($event)"
      />
    </div>
    @if (canSave()) {
      <button
        type="button"
        class="save"
        [attr.aria-label]="'Save filter ' + query()"
        (click)="save()"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v16l-6-4-6 4z" /></svg>
        <span class="save-text">Save</span>
      </button>
    }
    @if (saveKey() && saved().length) {
      <ul class="chips" aria-label="Saved filters">
        @for (filter of saved(); track filter) {
          <li class="chip" [class.active]="filter === query()">
            <button
              type="button"
              class="apply"
              [attr.aria-pressed]="filter === query()"
              [attr.title]="filter"
              (click)="apply(filter)"
            >
              {{ filter }}
            </button>
            <button
              type="button"
              class="remove"
              [attr.aria-label]="'Remove saved filter ' + filter"
              (click)="remove(filter)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg>
            </button>
          </li>
        }
      </ul>
    }
    @if (saveKey()) {
      <span class="sr-only" role="status">{{ announcement() }}</span>
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: flex;
      flex: 1 1 220px;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .box {
      position: relative;
      flex: 1 1 180px;
      min-width: 0;
    }
    .icon {
      position: absolute;
      top: 50%;
      left: 12px;
      width: 14px;
      height: 14px;
      transform: translateY(-50%);
      fill: none;
      stroke: var(--text-3);
      stroke-width: 2.2;
      stroke-linecap: round;
      pointer-events: none;
    }
    input {
      width: 100%;
      height: var(--control-h);
      padding: 0 12px 0 34px;
      background: var(--bg);
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font: inherit;
      font-size: 13px;
    }
    input::placeholder {
      color: var(--text-3);
    }
    input:focus {
      @include m.field-focus;
    }
    .save {
      display: inline-flex;
      flex: none;
      align-items: center;
      gap: 6px;
      height: var(--control-h);
      padding: 0 10px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
      transition: background 150ms var(--ease);
    }
    .save:hover {
      background: var(--surface-2);
    }
    .save svg,
    .remove svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-width: 0;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
      height: 26px;
      border: 1px solid var(--control-border);
      border-radius: 999px;
      background: var(--surface);
      overflow: hidden;
    }
    .chip.active {
      @include m.tint(accent);
    }
    .chip button {
      height: 100%;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .apply {
      @include m.truncate;
      max-width: 22ch;
      padding: 0 4px 0 10px;
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .chip.active .apply {
      color: var(--accent-text);
    }
    .remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      padding: 0;
      color: var(--text-2);
    }
    .remove:hover {
      color: var(--text-strong);
    }
    .save:focus-visible,
    .chip button:focus-visible {
      @include m.focus-ring(-2px);
    }
    @media (max-width: 420px) {
      .save-text {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .save {
        transition: none;
      }
    }
  `,
})
export class SearchField {
  /** The filter text. */
  readonly value = model('');
  /** The accessible name. Every page uses "Filter"; a second field on a page names what it filters. */
  readonly label = input('Filter');
  readonly placeholder = input('Filter');
  /** An id for the input, for a page that finds it by id. */
  readonly inputId = input<string | null>(null);
  readonly describedBy = input<string | null>(null);
  /** The view the saved filter chips belong to; without it there are none. */
  readonly saveKey = input<string | null>(null);

  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly announcement = signal('');

  protected readonly query = computed(() => this.value().trim());
  /** The chips of the current view, read again when the view changes. */
  protected readonly saved = linkedSignal(() => {
    const key = this.saveKey();
    return key ? readSavedFilters(key) : [];
  });
  protected readonly canSave = computed(() => {
    const query = this.query();
    return (
      !!this.saveKey() &&
      !!query &&
      query.length <= MAX_FILTER_LENGTH &&
      !this.saved().includes(query) &&
      this.saved().length < MAX_SAVED_FILTERS
    );
  });

  focus() {
    this.input().nativeElement.focus();
  }

  /**
   * Escape empties a field that has text, and stops there, so it doesn't also
   * close a detail panel or the popup. An empty field lets Escape through.
   */
  protected clear(event: Event) {
    if (!this.value()) return;
    event.preventDefault();
    event.stopPropagation();
    this.value.set('');
  }

  protected save() {
    const key = this.saveKey();
    const query = this.query();
    if (!key || !this.canSave()) return;
    const next = [...this.saved(), query];
    this.saved.set(next);
    writeSavedFilters(key, next);
    this.say(`Filter ${query} saved.`);
    // The Save button goes away, so focus moves to the new chip.
    this.focusAfterRender(`.chip:last-child .apply`);
  }

  protected apply(filter: string) {
    this.value.set(this.query() === filter ? '' : filter);
  }

  protected remove(filter: string) {
    const key = this.saveKey();
    if (!key) return;
    const index = this.saved().indexOf(filter);
    const next = this.saved().filter((entry) => entry !== filter);
    this.saved.set(next);
    writeSavedFilters(key, next);
    this.say(`Saved filter ${filter} removed.`);
    if (!next.length) {
      this.focus();
      return;
    }
    const at = Math.min(index, next.length - 1) + 1;
    this.focusAfterRender(`.chip:nth-child(${at}) .apply`);
  }

  private focusAfterRender(selector: string) {
    afterNextRender(
      () => {
        const target = this.host.nativeElement.querySelector<HTMLElement>(selector);
        if (target) target.focus();
        else this.focus();
      },
      { injector: this.injector },
    );
  }

  private say(message: string) {
    this.announcement.update((current) => (current === message ? `${message} ` : message));
  }
}
