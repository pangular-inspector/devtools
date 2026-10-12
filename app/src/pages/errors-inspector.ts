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
import { time } from '../format';
import { hostPageId } from '../page-id';
import { Select, type SelectOption } from '../ui/select';
import type { ComponentFocus } from '../types/component-focus.types';
import {
  ALL_PAGES,
  CONSOLE_LEVELS,
  SOURCE_LABELS,
  codeLink,
  consoleOf,
  defaultErrorsPage,
  errorsOf,
  errorsPages,
  type ConsoleLevel,
  type ErrorsPage,
} from './errors-types';

type View = 'errors' | 'console';

const LEVEL_TONE: Record<ConsoleLevel, string> = {
  error: 'danger',
  warn: 'warn',
  info: 'accent',
  log: 'plain',
  debug: 'plain',
};

@Component({
  selector: 'app-errors-inspector',
  imports: [Select],
  template: `
    @if (!loaded()) {
      <p class="state" role="status">Loading errors…</p>
    } @else if (failed()) {
      <div class="state" role="alert">
        <p>Can't read the errors from the devtools server.</p>
        <button type="button" class="small" (click)="retry()">Retry</button>
      </div>
    } @else if (!pages().length) {
      <div class="state" role="status">
        <p>No page reports errors yet.</p>
        <p class="muted">
          Open the app with the overlay loaded. Errors and console calls show up here as they
          happen.
        </p>
      </div>
    } @else {
      <p class="intro">
        Errors from Angular's ErrorHandler, uncaught errors and unhandled promise rejections on the
        live page, grouped by message, and the page's console calls. Messages and values are masked
        like other live data.
      </p>

      <div class="toolbar">
        <div class="views" role="group" aria-label="Show">
          <button
            type="button"
            class="view"
            [attr.aria-pressed]="view() === 'errors'"
            (click)="view.set('errors')"
          >
            Errors <span class="badge">{{ errors().length }}</span>
          </button>
          <button
            type="button"
            class="view"
            [attr.aria-pressed]="view() === 'console'"
            (click)="view.set('console')"
          >
            Console <span class="badge">{{ entries().length }}</span>
          </button>
        </div>
        <div class="search">
          <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            #search
            type="search"
            [attr.aria-label]="view() === 'errors' ? 'Filter errors' : 'Filter console calls'"
            [placeholder]="view() === 'errors' ? 'Filter by message or code' : 'Filter by text'"
            [value]="filter()"
            (input)="filter.set($any($event.target).value)"
            (keydown.escape)="filter.set('')"
          />
        </div>
        @if (view() === 'console') {
          <app-select
            class="level-select"
            ariaLabel="Console level"
            [options]="levelOptions"
            [value]="level()"
            (valueChange)="level.set($any($event))"
          />
        }
        @if (pageOptions().length > 2) {
          <app-select
            class="page-select"
            ariaLabel="Page"
            [options]="pageOptions()"
            [value]="pageId()"
            (valueChange)="pageId.set($event ?? allPages)"
          />
        }
        <span class="count" role="status">{{ countText() }}</span>
      </div>

      @if (view() === 'errors') {
        <section aria-labelledby="errors-title">
          <h2 id="errors-title" class="sr-only">Errors</h2>
          @if (unwrapped()) {
            <p class="notice">
              Angular's ErrorHandler isn't wrapped on this page yet, so errors Angular catches show
              up only when the default handler logs them.
            </p>
          }
          @if (droppedErrors()) {
            <p class="notice">
              {{ droppedErrors() }} older error
              {{ droppedErrors() === 1 ? 'group was' : 'groups were' }}
              dropped. Each page keeps its last 100.
            </p>
          }
          @if (!errors().length) {
            <p class="empty">
              No errors since the page loaded. Errors show up here as the app hits them.
            </p>
          } @else if (!shownErrors().length) {
            <div class="empty">
              <p>No error matches “{{ filter() }}”.</p>
              <button type="button" class="small" (click)="filter.set(''); search.focus()">
                Clear filter
              </button>
            </div>
          } @else {
            <ol class="errors" aria-label="Errors, most recent first">
              @for (error of shownErrors(); track error.pageId + error.id) {
                <li class="error">
                  <div class="head">
                    <span class="times" [attr.aria-label]="timesLabel(error.count)">
                      {{ error.count }}×
                    </span>
                    <code class="message">{{ error.message }}</code>
                  </div>
                  <div class="meta">
                    @if (error.code; as ngCode) {
                      @if (codeLink(ngCode, error.docUrl).href; as href) {
                        <a class="chip code" [href]="href" target="_blank" rel="noopener noreferrer"
                          >{{ ngCode
                          }}<span class="sr-only"> reference (opens in a new tab)</span></a
                        >
                      } @else {
                        <span
                          class="chip code plain"
                          title="No page in Angular's error reference"
                          >{{ ngCode }}</span
                        >
                      }
                    }
                    @for (source of error.sources; track source) {
                      <span class="chip source">{{ sourceLabels[source] }}</span>
                    }
                    <span class="muted">Last at {{ time(error.lastAt) }}</span>
                    @if (showPage()) {
                      <span class="muted">{{ pageLabel(error.pageId) }}</span>
                    }
                    @if (error.owner; as owner) {
                      @if (canShowComponent()) {
                        <button
                          type="button"
                          class="link"
                          (click)="showComponent.emit({ id: owner.id, pageId: error.pageId })"
                        >
                          Show component <code>{{ owner.name }}</code>
                        </button>
                      } @else {
                        <span class="muted"
                          >In <code>{{ owner.name }}</code></span
                        >
                      }
                    }
                  </div>
                  @if (error.stack) {
                    <details>
                      <summary>Stack</summary>
                      <pre tabindex="0" aria-label="Stack trace">{{ error.stack }}</pre>
                    </details>
                  }
                </li>
              }
            </ol>
          }
        </section>
      } @else {
        <section aria-labelledby="console-title">
          <h2 id="console-title" class="sr-only">Console</h2>
          @if (droppedConsole()) {
            <p class="notice">
              {{ droppedConsole() }} older {{ droppedConsole() === 1 ? 'call was' : 'calls were' }}
              dropped. Each page keeps its last 200.
            </p>
          }
          @if (!entries().length) {
            <p class="empty">
              No console calls since the overlay connected. They show up here as the app logs.
            </p>
          } @else if (!shownEntries().length) {
            <div class="empty">
              <p>No console call matches the filters.</p>
              <button type="button" class="small" (click)="clearFilters(); search.focus()">
                Clear filters
              </button>
            </div>
          } @else {
            <ol class="console" aria-label="Console calls, newest first">
              @for (entry of shownEntries(); track entry.pageId + entry.id) {
                <li class="entry">
                  <span class="chip level" [attr.data-tone]="levelTone[entry.level]">{{
                    entry.level
                  }}</span>
                  <code class="text">{{ entry.text }}</code>
                  @if (entry.count > 1) {
                    <span class="times" [attr.aria-label]="timesLabel(entry.count)"
                      >{{ entry.count }}×</span
                    >
                  }
                  @if (entry.code; as ngCode) {
                    @if (codeLink(ngCode, entry.docUrl).href; as href) {
                      <a class="chip code" [href]="href" target="_blank" rel="noopener noreferrer"
                        >{{ ngCode }}<span class="sr-only"> reference (opens in a new tab)</span></a
                      >
                    } @else {
                      <span class="chip code plain">{{ ngCode }}</span>
                    }
                  }
                  <time class="when">{{ time(entry.at) }}</time>
                </li>
              }
            </ol>
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
    .intro {
      margin: 0 0 12px;
      color: var(--text-2);
      line-height: 1.5;
    }
    code,
    pre {
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .muted {
      color: var(--text-2);
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
      margin: 0 0 12px;
      padding: 8px;
      background: color-mix(in srgb, var(--surface) 85%, transparent);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    .views {
      display: inline-flex;
      gap: 4px;
    }
    .view {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      height: var(--control-h);
      padding: 0 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      font: inherit;
      cursor: pointer;
      transition: background-color 150ms var(--ease);
    }
    .view:hover {
      background: var(--surface-2);
    }
    .view[aria-pressed='true'] {
      border-color: var(--accent-line);
      background: var(--accent-soft);
      color: var(--text-strong);
    }
    .view:focus-visible {
      @include m.focus-ring;
    }
    .badge {
      color: var(--text-2);
      font-variant-numeric: tabular-nums;
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
    input[type='search'] {
      width: 100%;
      height: var(--control-h);
      padding: 0 12px 0 34px;
      background: var(--bg);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 13px;
    }
    input[type='search']:focus {
      @include m.field-focus;
    }
    .level-select,
    .page-select {
      flex: 0 1 180px;
      min-width: 0;
    }
    .count {
      margin-left: auto;
      color: var(--text-2);
      font-size: 12px;
    }
    .notice {
      margin: 0 0 12px;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text-2);
      line-height: 1.5;
    }
    .errors,
    .console {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .error {
      @include m.panel;
      display: grid;
      gap: 6px;
      min-width: 0;
      padding: 8px 12px;
    }
    .head {
      display: flex;
      gap: 8px;
      align-items: baseline;
      min-width: 0;
    }
    .message {
      min-width: 0;
      color: var(--text-strong);
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }
    .times {
      flex-shrink: 0;
      color: var(--danger-text);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 10px;
      align-items: center;
      font-size: 12px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      padding: 1px 8px;
      border: 1px solid transparent;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
      @include m.tint(accent);
    }
    .chip.source,
    .chip.plain,
    .chip[data-tone='plain'] {
      border-color: var(--border);
      background: var(--surface-2);
      color: var(--text-2);
    }
    .chip[data-tone='danger'] {
      @include m.tint(danger);
    }
    .chip[data-tone='warn'] {
      @include m.tint(warn);
    }
    a.chip {
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    a.chip:focus-visible {
      @include m.focus-ring;
    }
    .link {
      display: inline-flex;
      gap: 4px;
      align-items: baseline;
      padding: 0;
      border: 0;
      border-radius: 2px;
      background: none;
      color: var(--accent-text);
      font: inherit;
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }
    .link:focus-visible {
      @include m.focus-ring;
    }
    details summary {
      width: fit-content;
      border-radius: 2px;
      color: var(--text-2);
      font-size: 12px;
      cursor: pointer;
    }
    details summary:focus-visible {
      @include m.focus-ring;
    }
    pre {
      max-height: 240px;
      margin: 6px 0 0;
      padding: 8px;
      overflow: auto;
      border-radius: var(--radius-sm);
      background: var(--bg);
      color: var(--text);
      white-space: pre;
    }
    pre:focus-visible {
      @include m.focus-ring(-2px);
    }
    .entry {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      align-items: baseline;
      min-width: 0;
      padding: 6px 10px;
      border-bottom: 1px solid var(--border);
    }
    .entry .level {
      min-width: 44px;
      justify-content: center;
    }
    .entry .times {
      color: var(--text-2);
    }
    .text {
      flex: 1 1 240px;
      min-width: 0;
      color: var(--text);
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }
    .when {
      margin-left: auto;
      color: var(--text-2);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .small {
      height: var(--control-h);
      padding: 0 12px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
    }
    .small:focus-visible {
      @include m.focus-ring;
    }
    .empty,
    .state {
      margin: 0 0 12px;
      color: var(--text-2);
    }
    .empty p,
    .state p {
      margin: 0 0 8px;
    }
  `,
})
export class ErrorsInspector {
  readonly rpc = input<DevframeRpcClient | null>(null);
  /** Whether the Components tab is on, so "Show component" has somewhere to go. */
  readonly canShowComponent = input(true);
  readonly showComponent = output<ComponentFocus>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly hostPageId = hostPageId();
  private unsubscribe?: () => void;

  protected readonly time = time;
  protected readonly codeLink = codeLink;
  protected readonly sourceLabels = SOURCE_LABELS;
  protected readonly levelTone = LEVEL_TONE;
  protected readonly allPages = ALL_PAGES;
  protected readonly levelOptions: SelectOption[] = [
    { value: 'all', label: 'All levels' },
    ...CONSOLE_LEVELS.map((level) => ({ value: level, label: level })),
  ];

  readonly pages = signal<ErrorsPage[]>([]);
  readonly loaded = signal(false);
  readonly failed = signal(false);
  readonly view = signal<View>('errors');
  readonly filter = signal('');
  readonly level = signal<ConsoleLevel | 'all'>('all');
  /** Keeps the picked page while it reports, and falls back once it is gone. */
  readonly pageId = linkedSignal<ErrorsPage[], string>({
    source: () => this.pages(),
    computation: (pages, previous) =>
      previous?.value &&
      (previous.value === ALL_PAGES || pages.some((page) => page.pageId === previous.value))
        ? previous.value
        : defaultErrorsPage(pages, this.hostPageId),
  });

  readonly pageOptions = computed<SelectOption[]>(() => [
    { value: ALL_PAGES, label: 'All pages' },
    ...this.pages().map((page) => ({
      value: page.pageId,
      label: page.title || page.url || page.pageId,
      hint: page.url,
    })),
  ]);
  readonly showPage = computed(() => this.pageId() === ALL_PAGES && this.pages().length > 1);
  private readonly picked = computed(() =>
    this.pages().filter((page) => this.pageId() === ALL_PAGES || page.pageId === this.pageId()),
  );
  readonly unwrapped = computed(() => this.picked().some((page) => page.handler !== 'wrapped'));
  readonly droppedErrors = computed(() =>
    this.picked().reduce((sum, page) => sum + page.dropped.errors, 0),
  );
  readonly droppedConsole = computed(() =>
    this.picked().reduce((sum, page) => sum + page.dropped.console, 0),
  );
  readonly errors = computed(() => errorsOf(this.pages(), this.pageId()));
  readonly entries = computed(() => consoleOf(this.pages(), this.pageId()));
  readonly shownErrors = computed(() => {
    const text = this.filter().trim().toLowerCase();
    if (!text) return this.errors();
    return this.errors().filter(
      (error) =>
        error.message.toLowerCase().includes(text) ||
        (error.code ?? '').toLowerCase().includes(text) ||
        (error.owner?.name ?? '').toLowerCase().includes(text),
    );
  });
  readonly shownEntries = computed(() => {
    const text = this.filter().trim().toLowerCase();
    const level = this.level();
    return this.entries().filter(
      (entry) =>
        (level === 'all' || entry.level === level) &&
        (!text || entry.text.toLowerCase().includes(text)),
    );
  });
  readonly countText = computed(() =>
    this.view() === 'errors'
      ? `${this.shownErrors().length} of ${this.errors().length} errors`
      : `${this.shownEntries().length} of ${this.entries().length} calls`,
  );

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

  clearFilters() {
    this.filter.set('');
    this.level.set('all');
  }

  timesLabel(count: number): string {
    return count === 1 ? 'Once' : `${count} times`;
  }

  pageLabel(pageId: string): string {
    const page = this.pages().find((p) => p.pageId === pageId);
    return page?.title || page?.url || pageId;
  }

  private async load(client: DevframeRpcClient) {
    this.failed.set(false);
    try {
      const state = await client.scope('pangular').rpc.sharedState('errors');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) => this.pages.set(errorsPages(value));
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
