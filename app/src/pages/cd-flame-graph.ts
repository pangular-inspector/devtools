import { Component, computed, input, output, signal } from '@angular/core';
import type { CdCycle } from '@pangular-inspector/devtools/internal/config';
import {
  FLAME_MAX_CYCLES,
  SPAN_KIND,
  buildFlame,
  formatMs,
  type FlameBlock,
} from './cd-chart-data';

const ROW = 22;

function lastOf<T>(items: readonly T[], test: (item: T) => boolean): T | undefined {
  for (let i = items.length - 1; i >= 0; i--) if (test(items[i])) return items[i];
  return undefined;
}

/**
 * The timed spans of the picked cycles as a flame graph: time runs left to
 * right, cycle after cycle, and nested spans sit one row lower. Shows nothing
 * when the recording has no spans, which pages before span timing send.
 */
@Component({
  selector: 'app-cd-flame-graph',
  template: `
    @if (hasSpans()) {
      <h3>Spans in the picked cycles</h3>
      @if (tooMany()) {
        <p class="note">
          Pick {{ max }} cycles or fewer to see their spans. {{ count() }} are picked.
        </p>
      } @else if (graph(); as g) {
        <div class="flame" role="group" [attr.aria-label]="label()" (keydown)="onKey($event)">
          <div class="cycles" aria-hidden="true">
            @for (c of g.cycles; track c.id) {
              <span [style.left.%]="c.x" [style.width.%]="c.w">cycle {{ c.id }}</span>
            }
          </div>
          <div class="rows" [style.height.px]="g.depth * row">
            @for (b of g.blocks; track b.index) {
              <button
                type="button"
                class="block kind-{{ b.kind }}"
                [class.narrow]="b.w < 4"
                [style.left.%]="b.x"
                [style.width.%]="b.w"
                [style.top.px]="b.depth * row"
                [attr.tabindex]="b.index === tabStop() ? 0 : -1"
                [attr.data-index]="b.index"
                [attr.aria-label]="describe(b)"
                [attr.aria-disabled]="b.component ? null : 'true'"
                (focus)="current.set(b.index)"
                (mouseenter)="hover.set(b.index)"
                (mouseleave)="hover.set(null)"
                (click)="choose(b)"
              >
                <span class="text">{{ b.name }}</span>
              </button>
            }
          </div>
        </div>
        <p class="readout" aria-hidden="true">{{ readout() }}</p>
        <ul class="legend" aria-label="Span kinds">
          @for (k of kinds; track k.kind) {
            <li><span class="key kind-{{ k.kind }}" aria-hidden="true"></span>{{ k.label }}</li>
          }
        </ul>
        <p class="hint">
          Arrow keys move along a row, Up goes to the enclosing span and Down to the first nested
          one. Enter on a component shows it in the tree.
        </p>
        @if (dropped()) {
          <p class="note">
            Each cycle keeps its longest spans. {{ dropped() }} shorter
            {{ dropped() === 1 ? 'span was' : 'spans were' }} left out.
          </p>
        }
        <details class="table" (toggle)="onToggle($event)">
          <summary>Show the spans as a table</summary>
          @if (tableOpen()) {
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
                    <th scope="col">Span</th>
                    <th scope="col">Kind</th>
                    <th scope="col" class="num">Depth</th>
                    <th scope="col" class="num">Start</th>
                    <th scope="col" class="num">Total</th>
                    <th scope="col" class="num">Self</th>
                  </tr>
                </thead>
                <tbody>
                  @for (b of g.blocks; track b.index) {
                    <tr>
                      <td class="num">{{ b.cycleId }}</td>
                      <td class="mono" [style.padding-left.px]="6 + b.depth * 8">{{ b.name }}</td>
                      <td>{{ kindLabel(b) }}</td>
                      <td class="num">{{ b.depth }}</td>
                      <td class="num">{{ fmt(b.start) }}</td>
                      <td class="num">{{ fmt(b.ms) }}</td>
                      <td class="num">{{ fmt(b.selfMs) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </details>
      }
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
      min-width: 0;
    }
    h3 {
      @include m.label;
      margin: 12px 0 6px;
    }
    .flame {
      position: relative;
    }
    .cycles {
      position: relative;
      height: 18px;
      color: var(--text-2);
      font-size: 11px;
    }
    .cycles span {
      position: absolute;
      top: 0;
      padding-left: 4px;
      border-left: 1px solid var(--border-strong);
      @include m.truncate;
    }
    .rows {
      position: relative;
      min-height: 22px;
    }
    .block {
      position: absolute;
      height: 20px;
      min-width: 2px;
      padding: 0 4px;
      overflow: hidden;
      border: 0;
      border-radius: 3px;
      color: var(--text-strong);
      font: inherit;
      font-family: var(--font-mono);
      font-size: 11px;
      line-height: 20px;
      text-align: left;
      cursor: default;
    }
    .block.narrow {
      padding: 0;
    }
    .block.narrow .text {
      display: none;
    }
    .text {
      display: block;
      @include m.truncate;
    }
    /* Each kind has its own fill pattern as well as its key, so kinds never differ by colour alone. */
    .kind-c {
      background: color-mix(in srgb, var(--accent) 35%, var(--surface));
    }
    .block:not([aria-disabled]) {
      cursor: pointer;
    }
    .kind-h {
      background: repeating-linear-gradient(
        45deg,
        color-mix(in srgb, var(--accent) 30%, var(--surface)) 0 4px,
        color-mix(in srgb, var(--accent) 10%, var(--surface)) 4px 8px
      );
    }
    .kind-r {
      background-color: var(--surface-3);
      background-image: radial-gradient(circle, var(--text-3) 1px, transparent 1.6px);
      background-size: 6px 6px;
    }
    .kind-o {
      background-color: var(--surface-2);
      background-image: repeating-linear-gradient(
        0deg,
        var(--border-strong) 0 1px,
        transparent 1px 5px
      );
      box-shadow: inset 0 0 0 1px var(--text-2);
    }
    .block:hover {
      outline: 2px solid var(--text-strong);
      outline-offset: -2px;
    }
    .block:focus-visible {
      @include m.focus-ring(-2px);
      outline-color: var(--text-strong);
      z-index: 1;
    }
    .readout,
    .hint,
    .note {
      margin: 6px 0 0;
      color: var(--text-2);
      font-size: 12px;
      line-height: 1.5;
    }
    .readout {
      min-height: 18px;
      color: var(--text);
      overflow-wrap: anywhere;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      margin: 6px 0 0;
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
      width: 18px;
      height: 12px;
      margin-right: 6px;
      border-radius: 2px;
    }
    .table {
      margin-top: 6px;
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
      min-width: 560px;
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
      font-family: var(--font-mono);
      overflow-wrap: anywhere;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class CdFlameGraph {
  /** The picked cycles. */
  readonly cycles = input<readonly CdCycle[]>([]);
  /** Span names, which spans refer to by index. */
  readonly names = input<readonly string[]>([]);
  /** What the graph covers, for its accessible name. */
  readonly scope = input('the recording');
  readonly pick = output<string>();

  protected readonly row = ROW;
  protected readonly max = FLAME_MAX_CYCLES;
  protected readonly kinds = (['c', 'h', 'r', 'o'] as const).map((kind) => ({
    kind,
    label: SPAN_KIND[kind],
  }));

  readonly current = signal(0);
  readonly tableOpen = signal(false);
  readonly hover = signal<number | null>(null);

  readonly hasSpans = computed(() => this.cycles().some((cycle) => cycle.spans?.length));
  readonly count = computed(() => this.cycles().length);
  readonly tooMany = computed(() => this.count() > FLAME_MAX_CYCLES);
  readonly graph = computed(() =>
    this.tooMany() ? null : buildFlame(this.cycles(), this.names()),
  );
  readonly tabStop = computed(() =>
    Math.min(this.current(), Math.max((this.graph()?.blocks.length ?? 1) - 1, 0)),
  );
  readonly dropped = computed(
    () => this.graph()?.cycles.reduce((sum, c) => sum + c.droppedSpans, 0) ?? 0,
  );
  readonly label = computed(
    () =>
      `Spans in ${this.scope()} over time, nested by depth. Pick a component to show it in the tree.`,
  );
  readonly readout = computed(() => {
    const blocks = this.graph()?.blocks ?? [];
    const block = blocks[this.hover() ?? this.tabStop()];
    return block ? this.describe(block) : '';
  });

  readonly tableLabel = computed(() => `Timed spans in ${this.scope()}`);

  protected fmt(value: number) {
    return formatMs(value);
  }

  protected kindLabel(b: FlameBlock) {
    return SPAN_KIND[b.kind];
  }

  onToggle(event: Event) {
    this.tableOpen.set((event.target as HTMLDetailsElement).open);
  }

  describe(b: FlameBlock): string {
    const parts = [b.name, SPAN_KIND[b.kind], `${formatMs(b.ms)} total`];
    if (b.selfMs !== b.ms) parts.push(`${formatMs(b.selfMs)} self`);
    parts.push(
      b.start < 0
        ? `cycle ${b.cycleId}, ${formatMs(-b.start)} before it started`
        : `cycle ${b.cycleId} at ${formatMs(b.start)}`,
    );
    return parts.join(', ');
  }

  choose(b: FlameBlock) {
    this.current.set(b.index);
    if (b.component) this.pick.emit(b.component);
  }

  onKey(event: KeyboardEvent) {
    const blocks = this.graph()?.blocks ?? [];
    if (!blocks.length) return;
    const now = blocks[this.tabStop()];
    let next: FlameBlock | undefined;
    switch (event.key) {
      case 'ArrowRight':
        next = blocks.find((b) => b.index > now.index && b.depth === now.depth);
        break;
      case 'ArrowLeft':
        next = lastOf(blocks, (b) => b.index < now.index && b.depth === now.depth);
        break;
      case 'ArrowUp':
        next =
          now.parent !== null
            ? blocks[now.parent]
            : lastOf(blocks, (b) => b.index < now.index && b.depth === now.depth - 1);
        break;
      case 'ArrowDown':
        next =
          blocks.find((b) => b.parent === now.index) ??
          blocks.find((b) => b.index > now.index && b.depth === now.depth + 1);
        break;
      case 'Home':
        next = blocks[0];
        break;
      case 'End':
        next = blocks.at(-1);
        break;
      default:
        return;
    }
    event.preventDefault();
    this.hover.set(null);
    if (!next) return;
    this.current.set(next.index);
    (event.currentTarget as HTMLElement)
      .querySelector<HTMLElement>(`button[data-index="${next.index}"]`)
      ?.focus();
  }
}
