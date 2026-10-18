import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { moreChangesText, pretty, short, type NgrxDiffEntry } from './store-types';

/** The State and Diff of one entry, from `request-ngrx-history`. */
export interface EntryDetail {
  seq: number;
  storeId: string;
  before: unknown;
  after: unknown;
  diff: NgrxDiffEntry[];
  diffTruncated?: number;
}

export interface EntryDetailAnswer {
  ok?: boolean;
  error?: string;
  detail?: EntryDetail;
}

type Tab = 'action' | 'diff' | 'state';

const TABS: { id: Tab; label: string }[] = [
  { id: 'action', label: 'Action' },
  { id: 'diff', label: 'Diff' },
  { id: 'state', label: 'State' },
];

/**
 * Action, Diff and State tabs for one past NgRx entry. Action and Diff show
 * what the log entry carries (projected by the store page); State reads the
 * redacted state before and after the entry when the tab opens, through
 * `load`, which asks the live page or an imported session. The full diff
 * (past the 50 changes a log entry keeps) comes with that read.
 */
@Component({
  selector: 'app-entry-tabs',
  template: `
    <div
      class="tabs"
      role="tablist"
      [attr.aria-label]="'Entry #' + seq() + ' details'"
      (keydown)="onKey($event)"
    >
      @for (tab of tabs; track tab.id) {
        <button
          type="button"
          role="tab"
          class="tab"
          [id]="idPrefix() + '-tab-' + tab.id"
          [attr.aria-selected]="active() === tab.id"
          [attr.aria-controls]="idPrefix() + '-panel-' + tab.id"
          [attr.tabindex]="active() === tab.id ? 0 : -1"
          (click)="select(tab.id)"
        >
          {{ tab.label }}
        </button>
      }
    </div>

    <div
      role="tabpanel"
      class="panel"
      tabindex="0"
      [id]="idPrefix() + '-panel-action'"
      [attr.aria-labelledby]="idPrefix() + '-tab-action'"
      [hidden]="active() !== 'action'"
    >
      <ng-content select="[tab-action]" />
    </div>

    <div
      role="tabpanel"
      class="panel"
      tabindex="0"
      [id]="idPrefix() + '-panel-diff'"
      [attr.aria-labelledby]="idPrefix() + '-tab-diff'"
      [hidden]="active() !== 'diff'"
    >
      <ng-content select="[tab-diff]" />
      @if (truncated() || loadDiff()) {
        @if (detail(); as d) {
          <p class="sub">All changes ({{ d.diff.length + (d.diffTruncated ?? 0) }})</p>
          @if (!d.diff.length) {
            <p class="muted">The state did not change.</p>
          }
          <ul class="all-diff">
            @for (change of d.diff; track change.path + $index) {
              <li>
                <code class="path">{{ change.path }}</code>
                <span class="op">{{ change.op }}</span>
                @if (change.op !== 'add') {
                  <code>{{ shortText(change.before) }}</code>
                }
                @if (change.op === 'change') {
                  <span aria-hidden="true">→</span><span class="visually-hidden">became</span>
                }
                @if (change.op !== 'remove') {
                  <code>{{ shortText(change.after) }}</code>
                }
              </li>
            }
          </ul>
          @if (d.diffTruncated) {
            <p class="muted">{{ moreChanges(d.diffTruncated) }}</p>
          }
        } @else if (error()) {
          <p class="error-text" role="alert">{{ error() }}</p>
        } @else {
          <button type="button" class="btn" [disabled]="loading()" (click)="load()">
            Show all changes
          </button>
        }
      }
    </div>

    <div
      role="tabpanel"
      class="panel"
      tabindex="0"
      [id]="idPrefix() + '-panel-state'"
      [attr.aria-labelledby]="idPrefix() + '-tab-state'"
      [hidden]="active() !== 'state'"
    >
      @if (loading()) {
        <p class="muted" role="status">Reading the state…</p>
      } @else if (error()) {
        <div class="error-box" role="alert">
          <p>{{ error() }}</p>
          <button type="button" class="btn" (click)="load()">Retry</button>
        </div>
      } @else if (detail(); as d) {
        <div class="state-head">
          <div class="segmented" role="group" aria-label="Which state to show">
            <button
              type="button"
              [attr.aria-pressed]="!showBefore()"
              (click)="showBefore.set(false)"
            >
              After #{{ d.seq }}
            </button>
            <button type="button" [attr.aria-pressed]="showBefore()" (click)="showBefore.set(true)">
              Before #{{ d.seq }}
            </button>
          </div>
          <button
            type="button"
            class="btn"
            [attr.aria-label]="
              'Copy the state ' + (showBefore() ? 'before' : 'after') + ' #' + d.seq
            "
            (click)="copy()"
          >
            Copy
          </button>
        </div>
        <pre class="state" tabindex="0" [attr.aria-label]="stateLabel()">{{ stateText() }}</pre>
        <p class="hint">Secret-looking fields are redacted, and very large values are cut.</p>
        @if (copied()) {
          <p class="muted" role="status">{{ copied() }}</p>
        }
      }
    </div>
  `,
  styles: `
    @use 'mixins' as m;
    :host {
      display: block;
      min-width: 0;
      margin-top: 10px;
    }
    .tabs {
      display: flex;
      gap: 2px;
      border-bottom: 1px solid var(--border);
    }
    .tab {
      height: var(--control-h);
      padding: 0 12px;
      border: none;
      border-bottom: 2px solid transparent;
      background: none;
      color: var(--text-2);
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition:
        color 150ms var(--ease),
        border-color 150ms var(--ease);
    }
    .tab:hover {
      color: var(--text);
    }
    .tab[aria-selected='true'] {
      border-bottom-color: var(--accent);
      color: var(--text-strong);
    }
    .tab:focus-visible,
    .panel:focus-visible,
    .state:focus-visible {
      @include m.focus-ring(-2px);
    }
    .panel {
      min-width: 0;
      padding-top: 8px;
    }
    .sub {
      @include m.label;
      margin: 12px 0 6px;
    }
    .all-diff {
      display: grid;
      gap: 4px;
      max-height: 320px;
      margin: 0;
      padding: 0;
      overflow: auto;
      list-style: none;
      font-size: 12px;
    }
    .all-diff li {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .op {
      color: var(--text-2);
    }
    .path {
      color: var(--text-strong);
    }
    .state-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .segmented {
      display: inline-flex;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }
    .segmented button {
      height: var(--control-h);
      padding: 0 12px;
      border: none;
      background: var(--surface-2);
      color: var(--text-2);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }
    .segmented button + button {
      border-left: 1px solid var(--border-strong);
    }
    .segmented button[aria-pressed='true'] {
      background: var(--accent-soft);
      color: var(--text-strong);
    }
    .segmented button:focus-visible {
      @include m.focus-ring(-2px);
    }
    .btn {
      height: var(--control-h);
      padding: 0 14px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn:hover {
      background: var(--surface-3);
    }
    .btn:focus-visible {
      @include m.focus-ring;
    }
    .btn:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
    .state {
      max-height: 360px;
      margin: 0;
      padding: 10px 12px;
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 12px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .hint,
    .muted {
      margin: 6px 0 0;
      color: var(--text-2);
      font-size: 12px;
    }
    .error-text,
    .error-box p {
      margin: 0 0 8px;
      color: var(--danger-text);
    }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    @media (prefers-reduced-motion: reduce) {
      .tab {
        transition: none;
      }
    }
  `,
})
export class EntryTabs {
  /** The entry's log number. */
  readonly seq = input.required<number>();
  /** Changes left out of the log entry's diff; the full diff is offered when set. */
  readonly diffTruncated = input<number | undefined>(undefined);
  /** Prefix for element ids, unique on the page. */
  readonly idPrefix = input.required<string>();
  /** Reads the entry's state from the page or an imported session. */
  readonly loader = input.required<(seq: number) => Promise<EntryDetailAnswer>>();
  /** Reads the diff right away: an imported entry has no log diff of its own to show first. */
  readonly loadDiff = input(false);

  protected readonly tabs = TABS;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Starts on Diff for every entry, as the detail showed before the tabs. */
  readonly active = linkedSignal<number, Tab>({ source: this.seq, computation: () => 'diff' });
  readonly detail = linkedSignal<number, EntryDetail | null>({
    source: this.seq,
    computation: () => null,
  });
  readonly error = linkedSignal<number, string>({ source: this.seq, computation: () => '' });
  /** Whether a read for the current entry is in flight; a new entry starts idle. */
  readonly loading = linkedSignal<number, boolean>({ source: this.seq, computation: () => false });
  readonly showBefore = signal(false);
  readonly copied = signal('');

  readonly truncated = computed(() => (this.diffTruncated() ?? 0) > 0);

  constructor() {
    // An imported entry opens on Diff with nothing to show until its changes are read.
    effect(() => {
      if (!this.loadDiff()) return;
      this.seq();
      untracked(() => void this.load());
    });
  }

  readonly stateText = computed(() => {
    const d = this.detail();
    if (!d) return '';
    return pretty(this.showBefore() ? d.before : d.after);
  });

  readonly stateLabel = computed(
    () => `State ${this.showBefore() ? 'before' : 'after'} entry #${this.seq()}`,
  );

  select(tab: Tab) {
    this.active.set(tab);
    if (tab === 'state' && !this.detail() && !this.loading()) void this.load();
  }

  /** The latest read; an older answer (another entry, or a retry since) is dropped. */
  private request = 0;

  async load() {
    const seq = this.seq();
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    let answer: EntryDetailAnswer;
    try {
      answer = await this.loader()(seq);
    } catch {
      answer = { error: 'The devtools server did not answer. Try again.' };
    }
    if (request !== this.request || seq !== this.seq()) return;
    this.loading.set(false);
    if (answer.ok && answer.detail) this.detail.set(answer.detail);
    else this.error.set(answer.error ?? 'The page sent no state for this entry.');
  }

  /** Arrow keys move between tabs, Home and End jump to the ends. */
  onKey(event: KeyboardEvent) {
    const index = TABS.findIndex((tab) => tab.id === this.active());
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % TABS.length
        : event.key === 'ArrowLeft'
          ? (index + TABS.length - 1) % TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? TABS.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    this.select(TABS[next].id);
    this.host.nativeElement
      .querySelector<HTMLButtonElement>(`#${this.idPrefix()}-tab-${TABS[next].id}`)
      ?.focus();
  }

  async copy() {
    try {
      await navigator.clipboard.writeText(this.stateText());
      this.copied.set('Copied the state.');
    } catch {
      this.copied.set('The clipboard is not available here.');
    }
  }

  protected shortText(value: unknown): string {
    return short(value, 80);
  }

  protected moreChanges(count: number): string {
    return moreChangesText(count);
  }
}
