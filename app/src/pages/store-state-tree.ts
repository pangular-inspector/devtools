import {
  Component,
  ElementRef,
  computed,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { short } from './store-types';

/** The serializer's type marker: a tagged value shows as one leaf. */
const TYPE = '@type';
/** Rows drawn at most; a filter narrows a bigger state. */
export const MAX_TREE_ROWS = 400;

export interface StateRow {
  path: string;
  key: string;
  depth: number;
  /** A node holds an object or array; a leaf holds anything else. */
  node: boolean;
  open: boolean;
  /** `{3}`, `[5]`, or the leaf value. */
  text: string;
  /** The row is a changed path or inside one. */
  changed: boolean;
  /** A changed path is inside the row. */
  holdsChange: boolean;
}

function isNode(value: unknown): value is Record<string, unknown> | unknown[] {
  if (Array.isArray(value)) return true;
  return !!value && typeof value === 'object' && !Object.hasOwn(value, TYPE);
}

/** A child path, written the way the change log writes diff paths. */
export function childPath(path: string, key: string | number): string {
  if (typeof key === 'number') return `${path}[${key}]`;
  const safe = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
  if (!path) return safe;
  return safe.startsWith('"') ? `${path}[${safe}]` : `${path}.${safe}`;
}

function inside(outer: string, inner: string): boolean {
  return inner.startsWith(`${outer}.`) || inner.startsWith(`${outer}[`);
}

function entriesOf(value: Record<string, unknown> | unknown[]): [string | number, unknown][] {
  return Array.isArray(value) ? value.map((item, i) => [i, item]) : Object.entries(value);
}

function summary(value: Record<string, unknown> | unknown[]): string {
  return Array.isArray(value) ? `[${value.length}]` : `{${Object.keys(value).length}}`;
}

/**
 * The rows of a state tree. A node is open when the user opened it, when it
 * holds a changed path, or at the first level, unless the user closed it. With
 * a query, only rows whose key or value matches it and their parents show,
 * all open.
 */
export function stateRows(
  value: unknown,
  options: {
    query?: string;
    changed?: readonly string[];
    opened?: ReadonlySet<string>;
    closed?: ReadonlySet<string>;
  } = {},
): { rows: StateRow[]; matches: number } {
  const query = options.query?.trim().toLowerCase() ?? '';
  const changed = options.changed ?? [];
  const rows: StateRow[] = [];
  let matches = 0;
  const walk = (val: unknown, path: string, key: string, depth: number): StateRow[] => {
    const node = isNode(val);
    const isChanged = changed.some((c) => c === path || inside(c, path));
    const holdsChange = changed.some((c) => inside(path, c));
    const text = node ? summary(val) : short(val, 160);
    const own =
      !!query &&
      (key.toLowerCase().includes(query) || (!node && text.toLowerCase().includes(query)));
    if (own) matches++;
    const children: StateRow[] = [];
    if (node)
      for (const [k, v] of entriesOf(val))
        children.push(...walk(v, childPath(path, k), String(k), depth + 1));
    if (query && !own && !children.length) return [];
    const open = node
      ? query
        ? true
        : !options.closed?.has(path) && (depth < 1 || holdsChange || !!options.opened?.has(path))
      : false;
    const row: StateRow = { path, key, depth, node, open, text, changed: isChanged, holdsChange };
    return [row, ...(open ? children : [])];
  };
  if (isNode(value)) {
    for (const [k, v] of entriesOf(value)) rows.push(...walk(v, childPath('', k), String(k), 0));
  } else if (value !== undefined) {
    rows.push(...walk(value, '(root)', '(root)', 0));
  }
  return { rows, matches };
}

/**
 * The state of the selected store as a tree: each object or array opens and
 * closes, a search narrows it to matching keys and values, each row copies its
 * path, and the paths the newest change wrote are marked.
 */
@Component({
  selector: 'app-state-tree',
  template: `
    <div class="tree-tools">
      <input
        type="search"
        class="tree-search"
        placeholder="Search keys and values"
        [attr.aria-label]="'Search ' + label()"
        [value]="query()"
        (input)="query.set($any($event.target).value)"
        (keydown.escape)="query.set('')"
      />
      @if (query()) {
        <span class="count">{{ matches() }} {{ matches() === 1 ? 'match' : 'matches' }}</span>
      }
    </div>
    <div #box class="tree" tabindex="-1" role="group" [attr.aria-label]="label()">
      @if (!view().rows.length) {
        <p class="muted">{{ query() ? 'No key or value matches.' : 'The state is empty.' }}</p>
      }
      <ul class="rows">
        @for (row of shown(); track row.path) {
          <li class="row" [class.changed]="row.changed" [style.padding-left.px]="row.depth * 14">
            @if (row.node) {
              <button
                type="button"
                class="toggle"
                [attr.aria-expanded]="row.open"
                [attr.aria-label]="row.key + ' ' + row.text"
                (click)="toggle(row)"
              >
                <span class="caret" aria-hidden="true">{{ row.open ? '▾' : '▸' }}</span>
                <span class="key">{{ row.key }}</span>
                <span class="summary" aria-hidden="true">{{ row.text }}</span>
              </button>
            } @else {
              <span class="leaf">
                <span class="key">{{ row.key }}<span class="colon">:</span></span>
                <code class="value">{{ row.text }}</code>
              </span>
            }
            @if (row.changed) {
              <span class="mark">changed</span>
            } @else if (row.holdsChange && !row.open) {
              <span class="mark soft">holds a change</span>
            }
            <button
              type="button"
              class="copy-path"
              [attr.aria-label]="'Copy path ' + row.path"
              [title]="'Copy path ' + row.path"
              (click)="copied.emit(row.path)"
            >
              Copy path
            </button>
          </li>
        }
      </ul>
      @if (view().rows.length > shown().length) {
        <p class="muted">
          {{ view().rows.length - shown().length }} more rows not shown. Search to narrow the tree.
        </p>
      }
    </div>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: grid;
      gap: 8px;
      min-width: 0;
    }
    .tree-tools {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .tree-search {
      flex: 1 1 auto;
      min-width: 0;
      height: var(--control-h);
      padding: 0 10px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--bg);
      color: var(--text);
      font: inherit;
      font-size: 12px;
    }
    .tree-search:focus-visible {
      @include m.field-focus;
    }
    .count {
      flex: none;
      color: var(--text-2);
      font-size: 12px;
    }
    .tree {
      max-height: 360px;
      overflow: auto;
      padding: 6px 8px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.55;
    }
    .tree:focus-visible {
      @include m.focus-ring(-2px);
    }
    .rows {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      border-radius: 4px;
    }
    .row.changed {
      background: var(--accent-soft);
    }
    .toggle {
      display: inline-flex;
      align-items: baseline;
      gap: 4px;
      min-width: 0;
      padding: 1px 2px;
      border: 0;
      background: none;
      color: var(--text);
      font: inherit;
      cursor: pointer;
    }
    .toggle:focus-visible,
    .copy-path:focus-visible {
      @include m.focus-ring(-2px);
    }
    .caret {
      width: 10px;
      color: var(--text-2);
    }
    .leaf {
      display: inline-flex;
      gap: 4px;
      min-width: 0;
      padding: 1px 2px 1px 16px;
    }
    .key {
      color: var(--text-strong);
    }
    .colon,
    .summary {
      color: var(--text-2);
    }
    .value {
      @include m.truncate;
      min-width: 0;
      font-family: inherit;
      color: var(--text);
    }
    .mark {
      flex: none;
      padding: 0 5px;
      border-radius: 4px;
      font-family: var(--font-sans, inherit);
      font-size: 10.5px;
      @include m.tint(accent);
    }
    .mark.soft {
      background: none;
      color: var(--text-2);
    }
    .copy-path {
      flex: none;
      margin-left: auto;
      padding: 0 6px;
      border: 1px solid transparent;
      border-radius: 4px;
      background: none;
      color: var(--text-2);
      font-family: var(--font-sans, inherit);
      font-size: 11px;
      cursor: pointer;
      opacity: 0;
    }
    .row:hover .copy-path,
    .copy-path:focus-visible {
      opacity: 1;
      border-color: var(--control-border);
    }
    @media (hover: none) {
      .copy-path {
        opacity: 1;
      }
    }
    .muted {
      margin: 4px 2px;
      color: var(--text-2);
      font-family: var(--font-sans, inherit);
    }
  `,
})
export class StoreStateTree {
  /** The serialized state. */
  readonly value = input<unknown>(undefined);
  /** Paths the newest change of this store wrote. */
  readonly changed = input<readonly string[]>([]);
  readonly label = input('State');
  /** Emits a path the user asked to copy; the page copies it and says so. */
  readonly copied = output<string>();

  readonly query = signal('');
  // A new store starts with its own open and closed nodes.
  private readonly opened = linkedSignal<unknown, ReadonlySet<string>>({
    source: () => this.label(),
    computation: () => new Set(),
  });
  private readonly closed = linkedSignal<unknown, ReadonlySet<string>>({
    source: () => this.label(),
    computation: () => new Set(),
  });
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');

  readonly view = computed(() =>
    stateRows(this.value(), {
      query: this.query(),
      changed: this.changed(),
      opened: this.opened(),
      closed: this.closed(),
    }),
  );
  readonly shown = computed(() => this.view().rows.slice(0, MAX_TREE_ROWS));
  readonly matches = computed(() => this.view().matches);

  toggle(row: StateRow) {
    const opened = new Set(this.opened());
    const closed = new Set(this.closed());
    if (row.open) {
      opened.delete(row.path);
      closed.add(row.path);
    } else {
      closed.delete(row.path);
      opened.add(row.path);
    }
    this.opened.set(opened);
    this.closed.set(closed);
  }

  /** Moves focus to the tree, as the state pre did after a restore. */
  focus() {
    this.box()?.nativeElement.focus();
  }
}
