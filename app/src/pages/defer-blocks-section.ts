import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  deferHydrationLabel,
  deferNotes,
  type DeferNote,
} from '@pangular-inspector/devtools/internal/config';
import { time } from '../format';

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
  /** Page clock, ms since epoch, when the overlay saw the block hydrate. */
  hydratedAt?: number;
  /** The state changes the overlay saw, oldest first, on the page clock. */
  transitions?: { state: string; hydration: string; at: number }[];
  hasErrorBlock?: boolean;
  /** Times from `@loading (after …; minimum …)`, in ms. */
  loading?: { minimumTime: number | null; afterTime: number | null };
  /** The time from `@placeholder (minimum …)`, in ms. */
  placeholder?: { minimumTime: number | null };
}

/** A hydration mismatch of the page, as the Hydration section lists it. */
export interface DeferMismatch {
  id: string;
  name: string;
  tag: string;
}

interface Row {
  block: DeferBlock;
  /** Mismatched components that are root elements of the block. */
  mismatches: DeferMismatch[];
  notes: DeferNote[];
  timings: string;
  /** `hydrated`, or `hydrated before inspection` when the overlay attached later. */
  hydrated: string;
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
 * page's clock, through `clockOffset`, which assumes the panel's clock agrees
 * with the server's.
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
            <li class="defer-item">
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
                  <span class="flag" [class]="'note-' + note.kind" [attr.title]="note.text">
                    @if (note.seconds === undefined) {
                      {{ note.label }}
                    } @else {
                      <!-- The age ticks every second; keep it out of the row's name. -->
                      {{ note.kind }} <span aria-hidden="true">{{ note.seconds }}s</span>
                    }
                  </span>
                }
                @if (row.hydrated) {
                  <span
                    class="flag"
                    [attr.title]="
                      row.block.hydratedAt === undefined
                        ? 'The block hydrated before the devtools attached to the page.'
                        : null
                    "
                    >{{ row.hydrated }}</span
                  >
                }
                @if (row.block.hasErrorBlock) {
                  <span class="flag">&#64;error block</span>
                }
                @if (row.timings) {
                  <span class="timings">{{ row.timings }}</span>
                }
                @if (row.mismatches.length) {
                  <span class="flag note-failed">mismatch</span>
                }
                <span class="triggers mono">{{
                  row.block.triggers.join(', ') || 'no triggers'
                }}</span>
              </button>
              <button
                type="button"
                class="defer-toggle"
                [attr.aria-expanded]="isOpen(row.block.id)"
                [attr.aria-controls]="isOpen(row.block.id) ? 'defer-detail-' + row.block.id : null"
                (click)="toggle(row.block.id)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
                <span class="sr-only"
                  >Details of the block in
                  {{ row.block.owner?.name ?? 'an unknown component' }}</span
                >
              </button>
              @if (isOpen(row.block.id)) {
                <div class="defer-detail" [id]="'defer-detail-' + row.block.id">
                  <dl>
                    <dt>Block</dt>
                    <dd class="mono">{{ row.block.id }}</dd>
                    @if (row.block.owner; as owner) {
                      <dt>Template of</dt>
                      <dd class="mono">{{ owner.name }} &lt;{{ owner.tag }}&gt;</dd>
                    }
                    @if (row.block.since) {
                      <dt>In this state since</dt>
                      <dd>{{ clock(row.block.since) }}</dd>
                    }
                    @if (row.block.hydration === 'hydrated') {
                      <dt>Hydrated</dt>
                      <dd>
                        {{
                          row.block.hydratedAt === undefined
                            ? 'Before the devtools attached'
                            : clock(row.block.hydratedAt)
                        }}
                      </dd>
                    }
                    <dt>Root elements</dt>
                    <dd>{{ row.block.rootIds.length || 'None rendered' }}</dd>
                    <dt>Triggers</dt>
                    <dd class="mono">{{ row.block.triggers.join(', ') || 'None' }}</dd>
                  </dl>
                  @if (row.block.transitions?.length) {
                    <h3 class="detail-label">Transitions</h3>
                    <ol class="transitions">
                      @for (step of row.block.transitions; track $index) {
                        <li>
                          <span class="when">{{ clock(step.at) }}</span>
                          <span class="mono">{{ step.state }}</span>
                          @if (step.hydration !== 'not-configured') {
                            <span class="muted">{{ step.hydration }}</span>
                          }
                        </li>
                      }
                    </ol>
                  }
                  @if (row.mismatches.length) {
                    <h3 class="detail-label">Hydration mismatches</h3>
                    <ul class="mismatch-links">
                      @for (m of row.mismatches; track m.id) {
                        <li>
                          <button type="button" (click)="showNode.emit(m.id)">
                            Show {{ m.name }} <span class="mono">&lt;{{ m.tag }}&gt;</span>
                          </button>
                        </li>
                      }
                    </ul>
                  }
                </div>
              }
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
    .defer-item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) var(--control-h);
      gap: 6px;
    }
    .defer-toggle {
      width: var(--control-h);
      padding: 0;
      background: var(--surface);
    }
    .defer-toggle svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      transition: transform 150ms var(--ease);
    }
    .defer-toggle[aria-expanded='true'] svg {
      transform: rotate(90deg);
    }
    @media (prefers-reduced-motion: reduce) {
      .defer-toggle svg {
        transition: none;
      }
    }
    .defer-toggle:focus-visible {
      @include m.focus-ring;
    }
    .defer-detail {
      grid-column: 1 / -1;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--bg);
      font-size: 12px;
    }
    .defer-detail dl {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 4px 12px;
      margin: 0;
    }
    .defer-detail dt {
      color: var(--text-2);
    }
    .defer-detail dd {
      min-width: 0;
      margin: 0;
      color: var(--text);
      overflow-wrap: anywhere;
    }
    .detail-label {
      @include m.label;
      margin: 10px 0 4px;
    }
    .transitions,
    .mismatch-links {
      display: grid;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .transitions li {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .when,
    .muted {
      color: var(--text-2);
    }
    .mismatch-links button:focus-visible {
      @include m.focus-ring;
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
  /** The hydration mismatches of the page, linked from the blocks they sit in. */
  readonly mismatches = input<DeferMismatch[]>([]);
  /** A mismatched component to select in the tree. */
  readonly showNode = output<string>();
  /** The blocks whose details are open. */
  private readonly open = signal<ReadonlySet<string>>(new Set());
  /** The block to highlight in the app, or `null` to clear it. */
  readonly highlight = output<DeferBlock | null>();

  /** Moves every second while a block waits, so its time on its placeholder counts up. */
  private readonly now = signal(Date.now());
  /** Some block is still on its placeholder, so its age can grow into a note. */
  private readonly waiting = computed(() =>
    this.blocks().some(
      (block) => !!block.since && (block.state === 'placeholder' || block.state === 'initial'),
    ),
  );

  protected readonly rows = computed<Row[]>(() => {
    const pageNow = this.now() - this.clockOffset();
    return this.blocks().map((block) => ({
      block,
      // A block without a time (an older page) gets no age notes.
      notes: deferNotes({ ...block, since: block.since || pageNow }, pageNow),
      timings: deferTimings(block),
      mismatches: this.mismatches().filter((m) => block.rootIds.includes(m.id)),
      hydrated: block.hydration === 'hydrated' ? deferHydrationLabel(block) : '',
    }));
  });

  protected isOpen(id: string): boolean {
    return this.open().has(id);
  }

  protected toggle(id: string) {
    this.open.update((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  /** A page clock time, such as `14:02:11`. */
  protected clock(at: number): string {
    return time(at);
  }

  constructor() {
    let tick: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      clearInterval(tick);
      tick = undefined;
    };
    effect(() => {
      if (!this.waiting()) return stop();
      if (tick !== undefined) return;
      this.now.set(Date.now());
      tick = setInterval(() => this.now.set(Date.now()), 1000);
    });
    inject(DestroyRef).onDestroy(stop);
  }
}
