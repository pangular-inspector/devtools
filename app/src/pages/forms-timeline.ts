import { Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { time } from '../format';
import { Select, type SelectOption } from '../ui/select';
import { FORMS_STYLES, type FormEvent } from './forms-types';

const ORIGINS = ['all', 'user', 'code', 'agent', 'devtools'] as const;

/** How many events the list renders, newest first. */
export const TIMELINE_SHOWN = 100;

/** Event types in the order the `form-history` agent tool lists them. */
const EVENT_TYPES = [
  'value',
  'status',
  'touched',
  'dirty',
  'submit',
  'reset',
  'added',
  'removed',
  'moved',
  'validators',
];

@Component({
  selector: 'app-forms-timeline',
  imports: [Select],
  template: `
    <div class="toolbar">
      <label class="record" [class.on]="recording()">
        <input type="checkbox" [checked]="recording()" (change)="toggle($event)" />
        <span class="record-text">
          <span class="record-title">
            @if (recording()) {
              <span class="rec-dot" aria-hidden="true"></span>
            }
            Record details
          </span>
          <span class="record-hint"
            >Record calling code, validator changes and renders per keystroke</span
          >
        </span>
      </label>
      <fieldset class="chips">
        <legend class="sr-only">Show changes from</legend>
        @for (origin of origins; track origin) {
          <label>
            <input
              type="radio"
              name="timeline-origin"
              [value]="origin"
              [checked]="origin === filter()"
              (change)="filter.set(origin)"
            />
            {{ origin }}
          </label>
        }
      </fieldset>
    </div>
    <div class="filters">
      <div class="search">
        <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          #pathInput
          type="search"
          placeholder="Filter by field path…"
          aria-label="Filter by field path"
          autocomplete="off"
          spellcheck="false"
          [value]="pathFilter()"
          (input)="pathFilter.set($any($event.target).value)"
          (keydown.escape)="pathFilter.set('')"
        />
      </div>
      <app-select ariaLabel="Event type" [options]="typeOptions()" [(value)]="typeFilter" />
      <span class="total" aria-live="polite">{{ summary() }}</span>
    </div>
    @if (shown().length) {
      <ol class="events">
        @for (event of shown(); track event.formId + '#' + event.seq) {
          <li [attr.data-type]="event.type">
            <time [attr.datetime]="iso(event.timestamp)">{{ time(event.timestamp) }}</time>
            <div class="body">
              <div class="line">
                <code class="path">{{ event.path || '(form)' }}</code>
                <span class="event-type">{{ event.type }}</span>
                @if (event.outcome) {
                  <span class="tag" [attr.data-tone]="event.outcome === 'ran' ? '' : 'bad'">{{
                    event.outcome
                  }}</span>
                }
                @if (event.count && event.count > 1) {
                  <span class="tag">×{{ event.count }}</span>
                }
                @if (event.origin) {
                  <span class="tag">{{ event.origin }}</span>
                }
                @if (event.ms !== undefined) {
                  <span class="tag" [attr.data-tone]="event.ms > 1000 ? 'warn' : ''"
                    >pending {{ event.ms }}ms</span
                  >
                }
                @if (event.renders) {
                  <span class="tag" [attr.data-tone]="event.renders > 20 ? 'warn' : ''"
                    >{{ event.renders }} renders: {{ (event.rendered ?? []).join(', ') }}</span
                  >
                }
              </div>
              @if (event.prev !== undefined || event.detail) {
                <div class="detail">
                  @if (event.prev !== undefined) {
                    <span class="prev">{{ event.prev }}</span>
                    <span class="arrow" aria-hidden="true">→</span
                    ><span class="sr-only">changed to</span>
                  }
                  {{ event.detail }}
                </div>
              }
              @if (event.caller) {
                <span class="caller">from {{ event.caller }}</span>
              }
            </div>
          </li>
        }
      </ol>
    } @else if (events().length) {
      <div class="empty-state">
        <p class="empty-title">No events match these filters</p>
        <p>Change the path, type or origin, or interact with the form to record more.</p>
        <button type="button" class="small" (click)="clearFilters()">Clear filters</button>
      </div>
    } @else {
      <div class="empty-state">
        <p class="empty-title">No changes yet</p>
        <p>Type into the form to see them here.</p>
      </div>
    }
  `,
  styles: `
    ${FORMS_STYLES}
    :host {
      display: grid;
      gap: 12px;
      min-width: 0;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
    }
    .record {
      display: inline-flex;
      flex: 1 1 260px;
      gap: 10px;
      align-items: flex-start;
      min-width: 0;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      cursor: pointer;
      transition:
        border-color 150ms var(--ease),
        background-color 150ms var(--ease);
    }
    .record:hover {
      border-color: var(--border-strong);
    }
    .record.on {
      border-color: var(--accent-line);
      background: var(--accent-soft);
    }
    .record:has(input:focus-visible) {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .record input {
      flex: none;
      width: 16px;
      height: 16px;
      margin: 2px 0 0;
      accent-color: var(--accent);
      cursor: pointer;
    }
    .record input:focus-visible {
      outline: none;
    }
    .record-text {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .record-title {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      color: var(--text-strong);
      font-size: 13px;
      font-weight: 500;
    }
    .record-hint {
      color: var(--text-2);
      font-size: 12px;
      line-height: 1.4;
    }
    .rec-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--danger);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 20%, transparent);
      animation: rec-pulse 1.6s ease-in-out infinite;
    }
    @keyframes rec-pulse {
      50% {
        opacity: 0.45;
      }
    }
    .chips {
      display: inline-flex;
      flex: none;
      gap: 2px;
      min-width: 0;
      height: 34px;
      margin: 0;
      padding: 2px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .chips label {
      position: relative;
      display: inline-flex;
      align-items: center;
      height: 28px;
      padding: 0 12px;
      border-radius: 7px;
      color: var(--text-2);
      font-size: 12.5px;
      font-weight: 500;
      text-transform: capitalize;
      cursor: pointer;
      user-select: none;
      transition:
        background-color 150ms var(--ease),
        color 150ms var(--ease),
        box-shadow 150ms var(--ease);
    }
    .chips label:hover {
      color: var(--text);
      background: var(--surface-2);
    }
    .chips input {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      opacity: 0;
      cursor: pointer;
    }
    .chips label:has(input:checked) {
      background: var(--surface-3);
      color: var(--text-strong);
      box-shadow: inset 0 0 0 1px var(--border-strong);
    }
    .chips label:has(input:focus-visible) {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
      min-width: 0;
    }
    .search {
      position: relative;
      flex: 1 1 200px;
      min-width: 0;
    }
    .search-icon {
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
    .search:focus-within .search-icon {
      stroke: var(--accent);
    }
    input[type='search'] {
      width: 100%;
      height: var(--control-h);
      padding: 0 12px 0 34px;
      background: var(--bg);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 13px;
      transition:
        border-color 150ms var(--ease),
        box-shadow 150ms var(--ease);
    }
    input[type='search']::placeholder {
      color: var(--text-3);
    }
    input[type='search']:focus-visible {
      @include m.field-focus;
    }
    .filters app-select {
      width: 150px;
    }
    .total {
      flex: none;
      color: var(--text-2);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .empty-state .small {
      margin-top: 6px;
    }
    .events {
      display: grid;
      gap: 2px;
      margin: 0;
      padding: 4px;
      list-style: none;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      font-size: 13px;
      animation: enter 0.35s var(--ease) both;
    }
    .events li {
      display: grid;
      grid-template-columns: 11ch minmax(0, 1fr);
      gap: 12px;
      align-items: baseline;
      padding: 8px 12px;
      border-radius: 6px;
      color: var(--text);
      transition: background-color 150ms var(--ease);
    }
    .events li:hover {
      background: var(--surface-3);
    }
    .events li[data-type='submit'] {
      background: var(--accent-soft);
      box-shadow: inset 2px 0 0 var(--accent);
      color: var(--text-strong);
    }
    .events li[data-type='submit'] time {
      color: var(--text-2);
    }
    time {
      color: var(--text-3);
      font-family: var(--font-mono);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .body {
      display: grid;
      gap: 4px;
      min-width: 0;
    }
    .line {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      align-items: center;
      min-width: 0;
    }
    .path {
      color: #fde68a;
      overflow-wrap: anywhere;

      @include m.light {
        color: var(--accent);
      }
    }
    .event-type {
      color: var(--text-strong);
      font-size: 12px;
      font-weight: 600;
    }
    .tag {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .detail {
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 12.5px;
      overflow-wrap: anywhere;
    }
    .prev {
      color: var(--text-2);
      text-decoration: line-through;
      text-decoration-color: color-mix(in srgb, var(--text-2) 50%, transparent);
    }
    .arrow {
      margin: 0 6px;
      color: var(--text-3);
    }
    .caller {
      color: var(--text-3);
      font-family: var(--font-mono);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    @media (max-width: 480px) {
      .events li {
        grid-template-columns: minmax(0, 1fr);
        gap: 4px;
      }
      .chips {
        width: 100%;
      }
      .filters app-select {
        flex: 1 1 140px;
        width: auto;
      }
      .total {
        flex: 1 1 100%;
      }
      .chips label {
        flex: 1;
        justify-content: center;
        padding: 0 8px;
      }
    }
  `,
})
export class FormsTimeline {
  events = input.required<FormEvent[]>();
  recording = input(false);
  readonly record = output<boolean>();

  toggle(event: Event) {
    const box = event.target as HTMLInputElement;
    box.checked = this.recording();
    this.record.emit(!this.recording());
  }

  readonly origins = ORIGINS;
  readonly filter = signal<(typeof ORIGINS)[number]>('all');

  readonly pathFilter = signal('');
  readonly typeFilter = signal<string | null>('all');
  private readonly pathInput = viewChild<ElementRef<HTMLInputElement>>('pathInput');

  /** All types, then the types present in the events in the agent tool's order. */
  readonly typeOptions = computed<SelectOption[]>(() => {
    const present = new Set(this.events().map((e) => e.type));
    const selected = this.typeFilter();
    if (selected && selected !== 'all') present.add(selected);
    const known = EVENT_TYPES.filter((type) => present.has(type));
    const other = [...present].filter((type) => !EVENT_TYPES.includes(type)).sort();
    return [
      { value: 'all', label: 'All types' },
      ...[...known, ...other].map((type) => ({ value: type, label: type })),
    ];
  });

  /** Events that pass the path, type and origin filters, oldest first. */
  readonly matching = computed(() => {
    const origin = this.filter();
    const type = this.typeFilter() ?? 'all';
    const path = this.pathFilter().trim().toLowerCase();
    return this.events().filter(
      (e) =>
        (origin === 'all' || e.origin === origin) &&
        (type === 'all' || e.type === type) &&
        (!path || e.path.toLowerCase().includes(path)),
    );
  });

  readonly shown = computed(() => this.matching().slice(-TIMELINE_SHOWN).reverse());

  readonly filtered = computed(
    () =>
      this.filter() !== 'all' ||
      (this.typeFilter() ?? 'all') !== 'all' ||
      !!this.pathFilter().trim(),
  );

  readonly summary = computed(() => {
    const total = this.events().length;
    const matching = this.matching().length;
    const noun = (n: number) => (n === 1 ? 'event' : 'events');
    const scope = this.filtered() ? ` matching ${noun(matching)}` : ` ${noun(matching)}`;
    if (matching > TIMELINE_SHOWN)
      return `Showing the latest ${TIMELINE_SHOWN} of ${matching}${scope}`;
    if (this.filtered()) return `${matching} of ${total} ${noun(total)}`;
    return `${total} ${noun(total)}`;
  });

  clearFilters() {
    this.pathFilter.set('');
    this.typeFilter.set('all');
    this.filter.set('all');
    this.pathInput()?.nativeElement.focus();
  }

  iso(timestamp: number) {
    return new Date(timestamp).toISOString();
  }

  readonly time = time;
}
