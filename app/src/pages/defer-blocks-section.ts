import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { deferNotes, type DeferNote } from '@pangular-inspector/devtools/internal/config';

export interface DeferBlock {
  id: string;
  owner?: { id: string; name: string; tag: string };
  state: string;
  hydration: string;
  hydrateNever?: boolean;
  triggers: string[];
  rootIds: string[];
  /** Page clock, ms since epoch, when the state or hydration state last changed. */
  since?: number;
  hasErrorBlock?: boolean;
  /** Times from `@loading (after …; minimum …)`, in ms. */
  loading?: { minimumTime: number | null; afterTime: number | null };
  /** The time from `@placeholder (minimum …)`, in ms. */
  placeholder?: { minimumTime: number | null };
}

interface Row {
  block: DeferBlock;
  notes: DeferNote[];
  timings: string;
}

/** `500ms`, `1s`, `1.5s`. */
function duration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${Number((ms / 1000).toFixed(2))}s`;
}

/** The `@placeholder` and `@loading` times of a block, such as `loading after 100ms, min 1s`. */
export function deferTimings(block: DeferBlock): string {
  const parts: string[] = [];
  const placeholder = block.placeholder?.minimumTime;
  if (placeholder != null) parts.push(`placeholder min ${duration(placeholder)}`);
  const loading = [
    block.loading?.afterTime != null ? `after ${duration(block.loading.afterTime)}` : '',
    block.loading?.minimumTime != null ? `min ${duration(block.loading.minimumTime)}` : '',
  ].filter(Boolean);
  if (loading.length) parts.push(`loading ${loading.join(', ')}`);
  return parts.join(' · ');
}

/**
 * The Defer blocks list on the Components page. Each row has the block's owner,
 * state, hydration, the notes the defer-blocks agent tool prints (failed, stuck
 * on its placeholder, dehydrated), whether it has an `@error` block, its
 * `@placeholder` and `@loading` times and its triggers. Ages are read on the
 * page's clock, through `clockOffset`.
 */
@Component({
  selector: 'app-defer-blocks',
  template: `
    @if (rows().length) {
      <section class="defer" aria-labelledby="ct-defer-title">
        <h2 id="ct-defer-title" class="defer-title">
          Defer blocks
          <span class="pill">{{ rows().length }}{{ truncated() ? '+' : '' }}</span>
        </h2>
        <ul class="defer-list">
          @for (row of rows(); track row.block.id) {
            <li>
              <button
                type="button"
                class="defer-row"
                [attr.aria-disabled]="row.block.owner ? null : 'true'"
                (click)="showOwner.emit(row.block)"
                (focus)="highlight.emit(row.block)"
                (blur)="highlight.emit(null)"
                (mouseenter)="highlight.emit(row.block)"
                (mouseleave)="highlight.emit(null)"
              >
                <span class="name mono">{{ row.block.owner?.name ?? 'Unknown component' }}</span>
                <span class="defer-state" [class]="'defer-state-' + row.block.state">{{
                  row.block.state
                }}</span>
                @for (note of row.notes; track note.kind) {
                  <span class="flag" [class]="'note-' + note.kind" [attr.title]="note.text">{{
                    note.label
                  }}</span>
                }
                @if (row.block.hydration === 'hydrated') {
                  <span class="flag">hydrated</span>
                }
                @if (row.block.hasErrorBlock) {
                  <span class="flag">&#64;error block</span>
                }
                @if (row.timings) {
                  <span class="timings">{{ row.timings }}</span>
                }
                <span class="triggers mono">{{
                  row.block.triggers.join(', ') || 'no triggers'
                }}</span>
              </button>
            </li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
    }
    .defer {
      margin-top: 16px;
    }
    .defer-title {
      @include m.label;
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 8px;
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
      letter-spacing: 0;
    }
    .defer-list {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .defer-row {
      justify-content: flex-start;
      flex-wrap: wrap;
      width: 100%;
      height: auto;
      min-height: var(--control-h);
      padding: 6px 12px;
      background: var(--surface);
      border-color: var(--border);
      text-align: left;
    }
    .defer-row:focus-visible {
      @include m.focus-ring;
    }
    .defer-row[aria-disabled='true'] {
      cursor: default;
    }
    .name {
      min-width: 0;
      color: var(--text-strong);
      font-size: 12px;
      font-weight: 600;
      @include m.truncate;
    }
    .mono {
      font-family: var(--font-mono);
    }
    .defer-state {
      padding: 0 8px;
      border-radius: 99px;
      background: var(--surface-3);
      color: var(--text-2);
      font-size: 11px;
      line-height: 18px;
    }
    .defer-state-complete {
      @include m.tint(ok);
    }
    .defer-state-error {
      @include m.tint(danger);
    }
    .defer-state-loading,
    .defer-state-placeholder {
      @include m.tint(warn);
    }
    .flag {
      padding: 0 6px;
      border: 1px solid var(--border-strong);
      border-radius: 5px;
      color: var(--text-2);
      font-family: var(--font-mono);
      font-size: 10px;
      line-height: 16px;
    }
    .note-failed {
      @include m.tint(danger);
    }
    .note-stuck {
      @include m.tint(warn);
    }
    .timings {
      color: var(--text-2);
      font-size: 11px;
    }
    .triggers {
      min-width: 0;
      color: var(--text-2);
      font-size: 12px;
      @include m.truncate;
    }
  `,
})
export class DeferBlocksSection {
  readonly blocks = input<DeferBlock[]>([]);
  /** The page has more defer blocks than the ones in `blocks`. */
  readonly truncated = input(false);
  /** The server clock minus the page clock, in ms, so ages are read on the page's clock. */
  readonly clockOffset = input(0);
  readonly showOwner = output<DeferBlock>();
  /** The block to highlight in the app, or `null` to clear it. */
  readonly highlight = output<DeferBlock | null>();

  /** Moves every second, so a block's time on its placeholder counts up. */
  private readonly now = signal(Date.now());

  protected readonly rows = computed<Row[]>(() => {
    const pageNow = this.now() - this.clockOffset();
    return this.blocks().map((block) => ({
      block,
      // A block without a time (an older page) gets no age notes.
      notes: deferNotes({ ...block, since: block.since || pageNow }, pageNow),
      timings: deferTimings(block),
    }));
  });

  constructor() {
    const tick = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
  }
}
