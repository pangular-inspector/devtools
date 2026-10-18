import { Component, computed, input, model, signal } from '@angular/core';
import type { CdCycle } from '@pangular-inspector/devtools/internal/config';
import {
  FRAME_BUDGET_MS,
  chartMax,
  cyclesInRange,
  formatMs,
  overBudget,
  type CdRange,
} from './cd-chart-data';

let nextId = 0;

/** Bars at most this many wide get a gap between them; more bars sit flush. */
const GAP_UNTIL = 80;
const PAGE_STEP = 10;

interface Bar {
  cycle: CdCycle;
  index: number;
  height: number;
  over: boolean;
  label: string;
}

/**
 * One bar per recorded change detection cycle, with the 16.6 ms frame budget
 * as a line. Dragging across the bars, or Shift with the arrow keys, picks a
 * range of cycles; Start and End fields do the same by cycle number.
 */
@Component({
  selector: 'app-cd-cycle-chart',
  host: { '(window:pointerup)': 'endDrag()', '(window:pointercancel)': 'endDrag()' },
  template: `
    <div class="range">
      <label>
        <span>Start</span>
        <input
          type="number"
          inputmode="numeric"
          [min]="firstId()"
          [max]="lastId()"
          [value]="startId()"
          (change)="setEnd('from', $event)"
        />
      </label>
      <label>
        <span>End</span>
        <input
          type="number"
          inputmode="numeric"
          [min]="firstId()"
          [max]="lastId()"
          [value]="endId()"
          (change)="setEnd('to', $event)"
        />
      </label>
      @if (range()) {
        <button type="button" (click)="showAll()">Show all cycles</button>
      }
      <p class="summary">{{ summary() }}</p>
    </div>
    <p class="hint" [id]="hintId">
      Drag across the bars to pick a range of cycles. With the chart focused, the arrow keys move
      between cycles, Shift with an arrow key extends the range, Enter picks one cycle and Escape
      shows all cycles again.
    </p>
    <div class="plot" [class.flush]="bars().length > gapUntil">
      <div class="axis" aria-hidden="true">
        <span class="tick top">{{ fmt(max()) }}</span>
        <span class="tick zero">0 ms</span>
      </div>
      <div class="area">
        @if (band(); as b) {
          <div
            class="band"
            aria-hidden="true"
            [style.left.%]="b.left"
            [style.width.%]="b.width"
          ></div>
        }
        <div class="budget" aria-hidden="true" [style.bottom.%]="budgetAt()">
          <span>{{ budgetLabel }}</span>
        </div>
        <div
          class="bars"
          role="listbox"
          aria-multiselectable="true"
          aria-orientation="horizontal"
          tabindex="0"
          [attr.aria-label]="'Change detection cycles, ' + summary()"
          [attr.aria-describedby]="hintId"
          [attr.aria-activedescendant]="activeOptionId()"
          (keydown)="onKey($event)"
          (focus)="onFocus()"
          (blur)="focused.set(false)"
          (pointerdown)="startDrag($event)"
          (pointermove)="onPointerMove($event)"
          (pointerleave)="hover.set(null)"
        >
          @for (bar of bars(); track bar.cycle.id) {
            <div
              role="option"
              class="col"
              [id]="optionId(bar.index)"
              [attr.data-index]="bar.index"
              [attr.aria-selected]="inRange(bar.index)"
              [attr.aria-label]="bar.label"
              [class.over]="bar.over"
              [class.out]="!inRange(bar.index) && !!range()"
              [class.active]="focused() && active() === bar.index"
            >
              <span class="bar" [style.height.%]="bar.height"></span>
            </div>
          }
        </div>
        @if (tip(); as t) {
          <div class="tip" aria-hidden="true" [style.left]="t.left" [style.right]="t.right">
            <p class="tip-head">
              <strong>{{ fmt(t.cycle.ms) }}</strong>
              <span>cycle {{ t.cycle.id }}</span>
              @if (t.over) {
                <span class="flag">over budget</span>
              }
            </p>
            @if (t.cycle.trigger) {
              <p>
                after <span class="mono">{{ t.cycle.trigger }}</span>
              </p>
            }
            <p>
              {{ t.cycle.checks }} {{ t.cycle.checks === 1 ? 'check' : 'checks' }},
              {{ t.cycle.passes }} {{ t.cycle.passes === 1 ? 'pass' : 'passes' }}
            </p>
            @for (c of t.top; track $index) {
              <p class="tip-row">
                <span class="mono name">{{ c.name }}</span>
                <span>{{ fmt(c.ms) }}</span>
              </p>
            }
          </div>
        }
      </div>
    </div>
    <div class="markers" aria-hidden="true" [class.flush]="bars().length > gapUntil">
      @for (bar of bars(); track bar.cycle.id) {
        <span [class.over]="bar.over"></span>
      }
    </div>
    <ul class="legend" aria-label="Chart key">
      <li><span class="key ok" aria-hidden="true"></span>Within budget</li>
      <li>
        <span class="key over" aria-hidden="true"></span>
        <span class="key-marker" aria-hidden="true"></span>Over budget
      </li>
      <li><span class="key line" aria-hidden="true"></span>{{ budgetLabel }}</li>
    </ul>
    <details class="table">
      <summary>Show the cycles as a table</summary>
      <div class="table-wrap" tabindex="0" role="region" [attr.aria-label]="tableLabel()">
        <table>
          <caption class="sr-only">
            {{
              tableLabel()
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col" class="num">Cycle</th>
              <th scope="col" class="num">Duration</th>
              <th scope="col">Budget</th>
              <th scope="col" class="num">Checks</th>
              <th scope="col" class="num">Passes</th>
              <th scope="col">After</th>
              <th scope="col">Slowest component</th>
            </tr>
          </thead>
          <tbody>
            @for (cycle of selected(); track cycle.id) {
              <tr>
                <td class="num">{{ cycle.id }}</td>
                <td class="num">{{ fmt(cycle.ms) }}</td>
                <td>{{ isOver(cycle) ? 'Over' : 'Within' }}</td>
                <td class="num">{{ cycle.checks }}</td>
                <td class="num">{{ cycle.passes }}</td>
                <td class="mono">{{ cycle.trigger ?? '' }}</td>
                <td class="mono">
                  @if (cycle.components[0]; as top) {
                    {{ top.name }} ({{ fmt(top.ms) }})
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </details>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
      min-width: 0;
    }
    .range {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
    }
    label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--text-2);
      font-size: 12px;
    }
    input {
      width: 76px;
      height: var(--control-h);
      padding: 0 8px;
      background: var(--bg);
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font: inherit;
      font-size: 13px;
    }
    input:focus-visible {
      @include m.field-focus;
    }
    button {
      height: var(--control-h);
      padding: 0 12px;
      background: var(--surface-2);
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      color: var(--text);
      cursor: pointer;
      font: inherit;
      font-size: 13px;
    }
    button:hover {
      background: var(--surface-3);
      border-color: var(--accent-line);
    }
    button:focus-visible {
      @include m.focus-ring;
    }
    .summary,
    .hint {
      margin: 0;
      color: var(--text-2);
      font-size: 12px;
      line-height: 1.5;
    }
    .hint {
      margin: 6px 0 8px;
    }
    .plot {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 6px;
    }
    .axis {
      position: relative;
      width: 44px;
      color: var(--text-2);
      font-size: 11px;
      text-align: right;
    }
    .tick {
      position: absolute;
      right: 0;
    }
    .tick.top {
      top: 0;
    }
    .tick.zero {
      bottom: -6px;
    }
    .area {
      position: relative;
      height: 140px;
      border-bottom: 1px solid var(--border-strong);
    }
    .bars {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: stretch;
      column-gap: 2px;
      touch-action: none;
      cursor: crosshair;
      user-select: none;
    }
    .flush .bars,
    .markers.flush {
      column-gap: 0;
    }
    .bars:focus-visible {
      @include m.focus-ring(2px);
    }
    .col {
      position: relative;
      display: flex;
      flex: 1 1 0;
      align-items: flex-end;
      justify-content: center;
      min-width: 0;
    }
    .bar {
      width: min(24px, 100%);
      min-height: 1px;
      background: var(--accent);
      border-radius: 4px 4px 0 0;
      transition: height 150ms var(--ease);
    }
    .flush .bar {
      border-radius: 1px 1px 0 0;
    }
    .col.over .bar {
      background: repeating-linear-gradient(
        135deg,
        var(--danger) 0 3px,
        color-mix(in srgb, var(--danger) 55%, var(--surface)) 3px 6px
      );
    }
    .col.out .bar {
      opacity: 0.4;
    }
    .col:hover .bar,
    .col.active .bar {
      outline: 2px solid var(--text-strong);
      outline-offset: 1px;
    }
    .band {
      position: absolute;
      top: 0;
      bottom: 0;
      background: var(--accent-soft);
      border-inline: 2px solid var(--accent);
      pointer-events: none;
    }
    .budget {
      position: absolute;
      left: 0;
      right: 0;
      height: 0;
      border-top: 1px solid var(--text-2);
      pointer-events: none;
      z-index: 1;
    }
    .budget span {
      position: absolute;
      right: 0;
      bottom: 2px;
      padding: 0 4px;
      background: var(--surface);
      border-radius: var(--radius-sm);
      color: var(--text-2);
      font-size: 11px;
    }
    .markers {
      display: flex;
      column-gap: 2px;
      height: 8px;
      margin: 3px 0 0 50px;
    }
    .markers span {
      display: flex;
      flex: 1 1 0;
      justify-content: center;
      min-width: 0;
    }
    .markers span.over::before {
      content: '';
      width: min(10px, 100%);
    }
    .markers span.over::before,
    .key-marker {
      background: var(--danger);
      clip-path: polygon(50% 0, 100% 100%, 0 100%);
    }
    .key-marker {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-right: 6px;
    }
    .tip {
      position: absolute;
      top: 4px;
      z-index: 2;
      width: min(240px, calc(100% - 8px));
      padding: 8px 10px;
      background: var(--surface-3);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      color: var(--text-2);
      font-size: 12px;
      pointer-events: none;
    }
    .tip p {
      margin: 2px 0;
    }
    .tip strong {
      color: var(--text-strong);
      font-size: 13px;
    }
    .tip-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px 8px;
    }
    .flag {
      padding: 0 6px;
      border: 1px solid;
      border-radius: 999px;
      @include m.tint(danger);
    }
    .tip-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .tip-row .name {
      @include m.truncate;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      margin: 8px 0 0;
      padding: 0;
      list-style: none;
      color: var(--text-2);
      font-size: 12px;
    }
    .legend li {
      display: inline-flex;
      align-items: center;
    }
    .key {
      display: inline-block;
      width: 10px;
      height: 10px;
      margin-right: 6px;
      border-radius: 2px;
    }
    .key.ok {
      background: var(--accent);
    }
    .key.over {
      background: repeating-linear-gradient(
        135deg,
        var(--danger) 0 3px,
        color-mix(in srgb, var(--danger) 55%, var(--surface)) 3px 6px
      );
    }
    .key.line {
      width: 14px;
      height: 0;
      border-top: 1px solid var(--text-2);
      border-radius: 0;
    }
    .table {
      margin-top: 8px;
      font-size: 12px;
    }
    summary {
      width: fit-content;
      color: var(--text);
      cursor: pointer;
    }
    summary:focus-visible {
      @include m.focus-ring;
    }
    .table-wrap {
      max-height: 320px;
      margin-top: 6px;
      overflow: auto;
    }
    .table-wrap:focus-visible {
      @include m.focus-ring(-2px);
    }
    table {
      width: 100%;
      min-width: 600px;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 4px 6px;
      border-bottom: 1px solid var(--border);
      text-align: left;
      vertical-align: top;
    }
    th {
      position: sticky;
      top: 0;
      background: var(--surface);
      color: var(--text-2);
      font-weight: 500;
    }
    td.mono {
      overflow-wrap: anywhere;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .mono {
      font-family: var(--font-mono);
    }
    @media (prefers-reduced-motion: reduce) {
      .bar {
        transition: none;
      }
    }
  `,
})
export class CdCycleChart {
  readonly cycles = input<readonly CdCycle[]>([]);
  /** The picked cycles by id, or null for all of them. */
  readonly range = model<CdRange | null>(null);

  protected readonly gapUntil = GAP_UNTIL;
  protected readonly budgetLabel = `${FRAME_BUDGET_MS} ms budget`;
  private readonly uid = `cd-chart-${nextId++}`;
  protected readonly hintId = `${this.uid}-hint`;

  /** The cycle the keyboard is on, by index. */
  readonly active = signal<number | null>(null);
  /** Where Shift with an arrow key or a drag extends the range from. */
  private anchor: number | null = null;
  private dragging = false;
  readonly hover = signal<number | null>(null);
  readonly focused = signal(false);

  readonly max = computed(() => chartMax(this.cycles()));
  readonly budgetAt = computed(() => (FRAME_BUDGET_MS / this.max()) * 100);
  readonly bars = computed<Bar[]>(() => {
    const max = this.max();
    return this.cycles().map((cycle, index) => ({
      cycle,
      index,
      height: (cycle.ms / max) * 100,
      over: overBudget(cycle),
      label: this.describe(cycle),
    }));
  });
  readonly firstId = computed(() => this.cycles()[0]?.id ?? 0);
  readonly lastId = computed(() => this.cycles().at(-1)?.id ?? 0);
  /** The range as indexes into the cycles, or null when it covers all of them. */
  readonly span = computed(() => {
    const range = this.range();
    if (!range) return null;
    const cycles = this.cycles();
    const from = Math.min(range.from, range.to);
    const to = Math.max(range.from, range.to);
    const start = cycles.findIndex((c) => c.id >= from);
    let end = -1;
    for (let i = cycles.length - 1; i >= 0; i--) {
      if (cycles[i].id <= to) {
        end = i;
        break;
      }
    }
    return start < 0 || end < start ? null : { start, end };
  });
  readonly selected = computed(() => cyclesInRange(this.cycles(), this.range()));
  readonly startId = computed(() => this.selected()[0]?.id ?? '');
  readonly endId = computed(() => this.selected().at(-1)?.id ?? '');
  readonly band = computed(() => {
    const span = this.span();
    const count = this.cycles().length;
    if (!span || !count) return null;
    return { left: (span.start / count) * 100, width: ((span.end - span.start + 1) / count) * 100 };
  });
  readonly summary = computed(() => {
    const cycles = this.selected();
    const over = cycles.filter(overBudget).length;
    const scope = this.span()
      ? cycles.length === 1
        ? `Cycle ${cycles[0].id}`
        : `Cycles ${cycles[0].id} to ${cycles.at(-1)!.id} (${cycles.length})`
      : `All ${cycles.length} ${cycles.length === 1 ? 'cycle' : 'cycles'}`;
    return `${scope}. ${over} over the ${FRAME_BUDGET_MS} ms budget.`;
  });
  readonly tableLabel = computed(() =>
    this.span() ? `Picked cycles, ${this.summary()}` : `All recorded cycles`,
  );
  readonly activeOptionId = computed(() => {
    const active = this.active();
    return this.focused() && active !== null && active < this.cycles().length
      ? this.optionId(active)
      : null;
  });
  readonly tip = computed(() => {
    const index = this.hover() ?? (this.focused() ? this.active() : null);
    const cycle = index === null ? undefined : this.cycles()[index];
    if (!cycle || index === null) return null;
    return {
      cycle,
      over: overBudget(cycle),
      top: cycle.components.slice(0, 3),
      // Beside the bar, on the side with more room, so it never covers the bar itself.
      ...this.tipSide(index),
    };
  });

  private tipSide(index: number): { left: string | null; right: string | null } {
    const count = this.cycles().length;
    if (index + 0.5 < count / 2) {
      return {
        left: `min(calc(${((index + 1) / count) * 100}% + 6px), max(0px, calc(100% - 240px)))`,
        right: null,
      };
    }
    return {
      left: null,
      right: `min(calc(${((count - index) / count) * 100}% + 6px), max(0px, calc(100% - 240px)))`,
    };
  }

  protected fmt(value: number) {
    return formatMs(value);
  }

  protected isOver(cycle: CdCycle) {
    return overBudget(cycle);
  }

  protected optionId(index: number) {
    return `${this.uid}-${index}`;
  }

  protected inRange(index: number): boolean {
    const span = this.span();
    return !!span && index >= span.start && index <= span.end;
  }

  private describe(cycle: CdCycle): string {
    const parts = [`Cycle ${cycle.id}`, formatMs(cycle.ms)];
    if (overBudget(cycle)) parts.push('over budget');
    if (cycle.trigger) parts.push(`after ${cycle.trigger}`);
    parts.push(`${cycle.checks} ${cycle.checks === 1 ? 'check' : 'checks'}`);
    const top = cycle.components[0];
    if (top) parts.push(`slowest ${top.name} ${formatMs(top.ms)}`);
    return parts.join(', ');
  }

  /** Picks the cycles between two indexes, both included. */
  select(a: number, b: number) {
    const cycles = this.cycles();
    const from = cycles[Math.min(a, b)];
    const to = cycles[Math.max(a, b)];
    if (from && to) this.range.set({ from: from.id, to: to.id });
  }

  showAll() {
    this.range.set(null);
    this.anchor = null;
  }

  setEnd(end: 'from' | 'to', event: Event) {
    const cycles = this.cycles();
    if (!cycles.length) return;
    const input = event.target as HTMLInputElement;
    const raw = Number.parseInt(input.value, 10);
    if (Number.isNaN(raw)) {
      input.value = String(end === 'from' ? this.startId() : this.endId());
      return;
    }
    const value = Math.min(Math.max(raw, this.firstId()), this.lastId());
    const current = this.selected();
    const from = end === 'from' ? value : (current[0]?.id ?? this.firstId());
    const to = end === 'to' ? value : (current.at(-1)?.id ?? this.lastId());
    this.range.set({ from: Math.min(from, to), to: Math.max(from, to) });
    input.value = String(end === 'from' ? Math.min(from, to) : Math.max(from, to));
  }

  onFocus() {
    this.focused.set(true);
    if (this.active() === null || this.active()! >= this.cycles().length) {
      this.active.set(this.span()?.start ?? Math.max(this.cycles().length - 1, 0));
    }
    this.anchor ??= this.active();
  }

  onKey(event: KeyboardEvent) {
    const count = this.cycles().length;
    if (!count) return;
    const current = Math.min(this.active() ?? count - 1, count - 1);
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = current + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = current - 1;
        break;
      case 'PageDown':
        next = current + PAGE_STEP;
        break;
      case 'PageUp':
        next = current - PAGE_STEP;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.anchor = current;
        this.select(current, current);
        return;
      case 'Escape':
        if (this.range()) {
          event.preventDefault();
          this.showAll();
        }
        return;
      default:
        return;
    }
    event.preventDefault();
    next = Math.min(Math.max(next, 0), count - 1);
    this.active.set(next);
    this.hover.set(null);
    if (event.shiftKey) {
      this.anchor ??= current;
      this.select(this.anchor, next);
    } else {
      this.anchor = next;
    }
  }

  private indexAt(event: PointerEvent): number | null {
    const target = (event.target as Element | null)?.closest?.('[data-index]');
    if (target) return Number(target.getAttribute('data-index'));
    // Between bars, or with the pointer captured, place it by its position.
    const box = (event.currentTarget as HTMLElement | null)?.getBoundingClientRect();
    const count = this.cycles().length;
    if (!box?.width || !count) return null;
    const ratio = (event.clientX - box.left) / box.width;
    return Math.min(Math.max(Math.floor(ratio * count), 0), count - 1);
  }

  startDrag(event: PointerEvent) {
    if (event.button !== 0) return;
    const index = this.indexAt(event);
    if (index === null) return;
    this.dragging = true;
    this.anchor = index;
    this.active.set(index);
    this.select(index, index);
  }

  onPointerMove(event: PointerEvent) {
    const index = this.indexAt(event);
    this.hover.set(index);
    if (this.dragging && index !== null && this.anchor !== null) {
      this.active.set(index);
      this.select(this.anchor, index);
    }
  }

  endDrag() {
    this.dragging = false;
  }
}
