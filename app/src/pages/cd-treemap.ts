import { Component, computed, input, output, signal } from '@angular/core';
import type { CdComponentStat } from '@pangular-inspector/devtools/config';
import { formatMs, squarify } from './cd-chart-data';

/** Components drawn as their own cell; the rest share one "other" cell. */
const CELLS = 24;
/** The map's width over its height, used to keep cells close to square. */
const ASPECT = 3;

interface Cell {
  stat: CdComponentStat;
  other: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** How much of the accent the fill takes, from 14 to 40 percent. */
  tone: number;
  roomy: boolean;
  label: string;
}

/**
 * Self time per component class as a treemap. The recording has no parent
 * links between components, so cells are sorted by self time, not nested.
 */
@Component({
  selector: 'app-cd-treemap',
  template: `
    @if (cells().length) {
      <ul class="map" [attr.aria-label]="label()" (keydown)="onKey($event)">
        @for (cell of cells(); track cell.stat.name; let i = $index) {
          <li
            [style.left.%]="cell.x"
            [style.top.%]="cell.y"
            [style.width.%]="cell.w"
            [style.height.%]="cell.h"
          >
            @if (cell.other) {
              <div class="cell other" [style.--tone]="cell.tone + '%'">
                <span class="sr-only">{{ cell.label }}</span>
                @if (cell.roomy) {
                  <span class="name" aria-hidden="true">{{ cell.other }} more</span>
                }
              </div>
            } @else {
              <button
                type="button"
                class="cell"
                [style.--tone]="cell.tone + '%'"
                [attr.tabindex]="i === tabStop() ? 0 : -1"
                [attr.aria-label]="cell.label"
                [attr.data-index]="i"
                (focus)="current.set(i)"
                (click)="pick.emit(cell.stat.name)"
              >
                @if (cell.roomy) {
                  <span class="name mono">{{ cell.stat.name }}</span>
                  <span class="ms">{{ fmt(cell.stat.ms) }}</span>
                }
              </button>
            }
          </li>
        }
      </ul>
    } @else {
      <p class="empty">No component time in these cycles.</p>
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
      min-width: 0;
    }
    .map {
      position: relative;
      height: 180px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      position: absolute;
      padding: 1px;
    }
    .cell {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: flex-start;
      gap: 2px;
      width: 100%;
      height: 100%;
      padding: 4px 6px;
      overflow: hidden;
      background: color-mix(in srgb, var(--accent) var(--tone, 20%), var(--surface));
      border: 0;
      border-radius: var(--radius-sm);
      color: var(--text-strong);
      font: inherit;
      font-size: 12px;
      text-align: left;
    }
    button.cell {
      cursor: pointer;
    }
    button.cell:hover {
      outline: 2px solid var(--text-strong);
      outline-offset: -2px;
    }
    button.cell:focus-visible {
      @include m.focus-ring(-2px);
      outline-color: var(--text-strong);
    }
    .cell.other {
      background: var(--surface-3);
      color: var(--text-2);
    }
    .name {
      @include m.truncate;
      max-width: 100%;
    }
    .mono {
      font-family: var(--font-mono);
    }
    .ms {
      color: var(--text);
    }
    .empty {
      margin: 8px 0;
      color: var(--text-2);
    }
  `,
})
export class CdTreemap {
  readonly stats = input<readonly CdComponentStat[]>([]);
  /** What the map covers, for its accessible name. */
  readonly scope = input('the recording');
  readonly pick = output<string>();

  readonly current = signal(0);

  readonly label = computed(
    () =>
      `Self time per component in ${this.scope()}, largest first. Pick one to show it in the tree.`,
  );

  readonly cells = computed<Cell[]>(() => {
    const stats = this.stats().filter((stat) => stat.ms > 0);
    const shown = stats.slice(0, CELLS);
    const rest = stats.slice(CELLS);
    const restMs = rest.reduce((sum, stat) => sum + stat.ms, 0);
    const items = shown.map((stat) => ({ stat, other: 0 }));
    if (rest.length) {
      items.push({
        stat: { name: 'Other components', checks: 0, ms: restMs, maxMs: 0, cycles: 0 },
        other: rest.length,
      });
    }
    const total = stats.reduce((sum, stat) => sum + stat.ms, 0);
    const top = shown[0]?.ms ?? 1;
    const laid = squarify(items, (item) => item.stat.ms, ASPECT);
    // The "other" cell is not a button, so it goes last to keep the buttons' indexes in a row.
    laid.sort((a, b) => Number(a.item.other > 0) - Number(b.item.other > 0));
    return laid.map((cell) => {
      const { stat, other } = cell.item;
      const share = total ? Math.round((stat.ms / total) * 100) : 0;
      return {
        stat,
        other,
        x: cell.x,
        y: cell.y,
        w: cell.w,
        h: cell.h,
        tone: other ? 0 : 14 + Math.round(26 * Math.min(stat.ms / top, 1)),
        roomy: cell.w >= 10 && cell.h >= 22,
        label: other
          ? `${other} more components, ${formatMs(stat.ms)}, ${share}% of self time`
          : `${stat.name}, ${formatMs(stat.ms)} self time, ${share}%, ${stat.checks} ${stat.checks === 1 ? 'check' : 'checks'}`,
      };
    });
  });

  /** The button in the Tab order, kept in range as the cells change. */
  readonly tabStop = computed(() =>
    Math.min(this.current(), Math.max(this.cells().filter((cell) => !cell.other).length - 1, 0)),
  );

  protected fmt(value: number) {
    return formatMs(value);
  }

  onKey(event: KeyboardEvent) {
    const buttons = this.cells().filter((cell) => !cell.other).length;
    if (!buttons) return;
    const now = this.tabStop();
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = Math.min(now + 1, buttons - 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = Math.max(now - 1, 0);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = buttons - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.current.set(next);
    const host = event.currentTarget as HTMLElement;
    host.querySelector<HTMLElement>(`button[data-index="${next}"]`)?.focus();
  }
}
