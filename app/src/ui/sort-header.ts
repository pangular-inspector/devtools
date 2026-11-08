import { Component, computed, input, model } from '@angular/core';

export type SortDirection = 'ascending' | 'descending';

/** The column a table is sorted by. `null` keeps the order the data came in. */
export interface SortState<C extends string = string> {
  column: C;
  direction: SortDirection;
}

/** A sort key of a row: numbers compare as numbers, text compares by locale, `undefined` goes last. */
export type SortKey = string | number | null | undefined;

/** Ascending, then descending, then back to the order the data came in. */
export function nextSort<C extends string>(
  current: SortState<C> | null,
  column: C,
): SortState<C> | null {
  if (current?.column !== column) return { column, direction: 'ascending' };
  return current.direction === 'ascending' ? { column, direction: 'descending' } : null;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function compareKeys(a: SortKey, b: SortKey): number {
  const aMissing = a === undefined || a === null || a === '';
  const bMissing = b === undefined || b === null || b === '';
  if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/**
 * The rows in the order of `sort`, or as they are when `sort` is `null`.
 * The sort is stable, and rows without a key stay last in both directions.
 */
export function sortRows<T>(
  rows: readonly T[],
  sort: SortState | null,
  keys: Readonly<Record<string, (row: T) => SortKey>>,
): readonly T[] {
  const key = sort && keys[sort.column];
  if (!sort || !key) return rows;
  const sign = sort.direction === 'ascending' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: key(row) }))
    .sort((a, b) => {
      const aMissing = a.value === undefined || a.value === null || a.value === '';
      const bMissing = b.value === undefined || b.value === null || b.value === '';
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      return sign * compareKeys(a.value, b.value) || a.index - b.index;
    })
    .map(({ row }) => row);
}

/**
 * A sortable column header. Put it on the `<th>` and bind the table's sort:
 *
 * ```html
 * <th scope="col" appSortHeader="status" [(sort)]="sort">Status</th>
 * ```
 *
 * The header gets `aria-sort` while the table is sorted by its column, and a
 * button that cycles ascending, descending and the original order.
 */
@Component({
  selector: 'th[appSortHeader]',
  host: {
    '[attr.aria-sort]': 'direction()',
    class: 'sortable',
  },
  template: `
    <button type="button" class="sort-button" (click)="toggle()">
      <ng-content />
      <span class="arrow" aria-hidden="true" [attr.data-direction]="direction()"></span>
    </button>
  `,
  styles: `
    @use 'mixins' as m;

    .sort-button {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      max-width: 100%;
      margin: -2px -4px;
      padding: 2px 4px;
      border: 0;
      border-radius: var(--radius-sm);
      background: none;
      color: inherit;
      font: inherit;
      letter-spacing: inherit;
      text-align: inherit;
      text-transform: inherit;
      cursor: pointer;
    }
    .sort-button:hover {
      color: var(--text);
    }
    .sort-button:focus-visible {
      @include m.focus-ring(-2px);
    }
    .arrow {
      display: inline-block;
      flex: none;
      width: 0;
      height: 0;
      border-right: 4px solid transparent;
      border-left: 4px solid transparent;
      opacity: 0.45;
    }
    .arrow:not([data-direction]) {
      border-top: 4px solid currentColor;
      border-bottom: 0;
      transform: translateY(1px);
    }
    .arrow[data-direction='ascending'] {
      border-bottom: 5px solid var(--accent);
      opacity: 1;
    }
    .arrow[data-direction='descending'] {
      border-top: 5px solid var(--accent);
      opacity: 1;
    }
  `,
})
export class SortHeader {
  readonly column = input.required<string>({ alias: 'appSortHeader' });
  readonly sort = model<SortState | null>(null);

  protected readonly direction = computed(() => {
    const sort = this.sort();
    return sort?.column === this.column() ? sort.direction : null;
  });

  toggle() {
    this.sort.set(nextSort(this.sort(), this.column()));
  }
}
