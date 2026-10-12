import { Component, ElementRef, afterRenderEffect, computed, inject, input } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { PropValue, type EditableProp } from './component-prop-value';
import {
  EDIT_READ,
  LOAD_STEP,
  childrenOf,
  containerOf,
  editInto,
  editPath,
  editableLeaf,
  nestedMatches,
  pathKey,
  shownPath,
  summary,
  type ContainerKind,
  type ValueContainer,
} from './component-value-state';
import type { ValueStore } from './component-value-store';

export interface TreeProp extends EditableProp {
  editInside?: 'property' | 'signal';
}

type EditKind = 'property' | 'signal' | null;

interface Row {
  id: string;
  kind: 'node' | 'leaf' | 'more' | 'loading' | 'error';
  depth: number;
  path: string[];
  label: string;
  /** Leaf text, or the node summary. */
  text: string;
  container?: ValueContainer;
  open?: boolean;
  /** Entries left out of the level, and how many it lists. */
  more?: number;
  listed?: number;
  /** A leaf that can be written, as PropValue edits it. */
  edit?: EditableProp;
}

let nextId = 0;

function leafText(value: unknown): string {
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Whether a value the page read for a whole edit holds all of it: no level
 * left collapsed or cut (`$collapsed`, `$more`), no Map, Set or class marker
 * (`$type`), and only leaves a nested edit could write too, so clipped text,
 * redacted values and markers such as `[Truncated]` are not written back.
 */
function wholeValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(wholeValue);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (['$collapsed', '$more', '$type'].some((key) => Object.hasOwn(obj, key))) return false;
    return Object.values(obj).every(wholeValue);
  }
  return editableLeaf(value);
}

/**
 * One input or property value of the selected component. Text, numbers and
 * other leaves show as before; an object, array, Map or Set shows its first
 * level behind a toggle, and each nested level is read from the page when it
 * is opened. "Show more" lists the next entries of a long level. With a
 * filter, only the loaded keys that match it and their parents show.
 */
@Component({
  selector: 'app-value-tree',
  imports: [PropValue],
  template: `
    @if (root(); as c) {
      <div class="root">
        <button
          type="button"
          class="toggle"
          [attr.aria-expanded]="rootOpen()"
          [attr.aria-controls]="rootOpen() ? listId : null"
          [attr.aria-label]="prop().name + ': ' + summaryOf(c)"
          (click)="toggleRoot()"
        >
          <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
          <span class="summary mono">{{ summaryOf(c) }}</span>
        </button>
        <app-prop-value
          class="whole"
          [bare]="true"
          [prop]="prop()"
          [componentId]="componentId()"
          [pageId]="pageId()"
          [rpc]="rpc()"
          [writes]="writes()"
          [readDraft]="readWhole"
        />
      </div>
      @if (rootOpen()) {
        <ul class="entries" [id]="listId" [attr.aria-label]="prop().name + ' entries'">
          @for (row of rows(); track row.id) {
            <li class="entry" [style.padding-left.px]="row.depth * 14">
              @switch (row.kind) {
                @case ('node') {
                  <button
                    type="button"
                    class="toggle"
                    [attr.aria-expanded]="row.open"
                    [attr.aria-label]="row.label + ': ' + row.text"
                    (click)="toggle(row)"
                  >
                    <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                    <span class="key mono">{{ row.label }}:</span>
                    <span class="summary mono">{{ row.text }}</span>
                  </button>
                }
                @case ('leaf') {
                  <span class="key mono">{{ row.label }}:</span>
                  @if (row.edit; as edit) {
                    <app-prop-value
                      class="leaf-edit"
                      [prop]="edit"
                      [componentId]="componentId()"
                      [pageId]="pageId()"
                      [rpc]="rpc()"
                      [writes]="writes()"
                    />
                  } @else {
                    <span class="leaf mono">{{ row.text }}</span>
                  }
                }
                @case ('more') {
                  <button type="button" class="more" (click)="more(row)">
                    Show {{ step(row) }} more
                    <span class="muted">({{ row.more }} not listed)</span>
                  </button>
                }
                @case ('loading') {
                  <span class="muted" role="status">Reading from the page…</span>
                }
                @case ('error') {
                  <span class="error" role="alert">{{ row.text }}</span>
                }
              }
            </li>
          }
        </ul>
      }
    } @else {
      <app-prop-value
        [prop]="prop()"
        [componentId]="componentId()"
        [pageId]="pageId()"
        [rpc]="rpc()"
        [writes]="writes()"
      />
    }
  `,
  styles: `
    @use 'mixins' as m;
    :host {
      display: block;
      min-width: 0;
    }
    .root {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 8px;
    }
    .whole {
      flex: 1 1 auto;
    }
    .entries {
      margin: 4px 0 0;
      padding: 0 0 0 6px;
      border-left: 1px solid var(--border);
      list-style: none;
    }
    .entry {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 6px;
      min-width: 0;
      padding-top: 2px;
      padding-bottom: 2px;
      font-size: 12px;
      line-height: 1.5;
    }
    .toggle,
    .more {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 24px;
      max-width: 100%;
      padding: 0 6px 0 2px;
      background: none;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      color: var(--text);
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      text-align: left;
      transition: background-color 150ms var(--ease);
    }
    .toggle:hover,
    .more:hover {
      background: var(--surface-2);
    }
    .toggle:focus-visible,
    .more:focus-visible {
      @include m.focus-ring;
    }
    .more {
      padding-left: 6px;
      color: var(--text);
      text-decoration: underline;
    }
    .chevron {
      flex: none;
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      transition: transform 150ms var(--ease);
    }
    .toggle[aria-expanded='true'] .chevron {
      transform: rotate(90deg);
    }
    .key {
      flex: none;
      max-width: 50%;
      overflow-wrap: anywhere;
      color: var(--text-2);
    }
    .summary {
      color: var(--text-2);
    }
    .leaf {
      min-width: 0;
      color: var(--text);
      overflow-wrap: anywhere;
    }
    .leaf-edit {
      flex: 1 1 160px;
    }
    .muted {
      color: var(--text-2);
    }
    .error {
      color: var(--danger-text);
    }
    @media (prefers-reduced-motion: reduce) {
      .chevron,
      .toggle,
      .more {
        transition: none;
      }
    }
  `,
})
export class ValueTree {
  readonly prop = input.required<TreeProp>();
  readonly store = input.required<ValueStore>();
  readonly componentId = input.required<string>();
  readonly pageId = input<string | null>(null);
  readonly rpc = input<DevframeRpcClient | null>(null);
  /** Whether this panel may write: live page, server connected, `actions.components` on. */
  readonly writes = input(false);
  /** Index of the host directive whose input this is; its values are read-only here. */
  readonly directive = input<number | undefined>(undefined);
  /** The detail's property filter. */
  readonly query = input('');

  protected readonly listId = `value-tree-${++nextId}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Rows listed when "Show more" was pressed, until the next entries render. */
  private pendingMore: Set<string> | null = null;

  constructor() {
    // "Show more" goes away once the last entries are listed; keep focus in the list.
    afterRenderEffect(() => {
      const rows = this.rows();
      const before = this.pendingMore;
      if (!before) return;
      const added = rows.findIndex(
        (row) => (row.kind === 'leaf' || row.kind === 'node') && !before.has(row.id),
      );
      if (added < 0) return;
      this.pendingMore = null;
      const active = document.activeElement;
      if (active && active !== document.body && active.isConnected) return;
      this.focusNear(added);
    });
  }

  private readonly rootPath = computed(() => [this.prop().prop]);

  /** The first level: the one the detail carries, or a longer one the panel loaded. */
  private readonly rootValue = computed(
    () => this.store().level(this.rootPath(), this.directive()) ?? this.prop().value,
  );

  readonly root = computed(() => containerOf(this.rootValue()));

  private readonly needle = computed(() => this.query().trim().toLowerCase());

  /** Nested paths whose key matches the filter, when the name itself does not. */
  private readonly matches = computed(() => {
    const needle = this.needle();
    const prop = this.prop();
    if (!needle || [prop.name, prop.prop].some((n) => n.toLowerCase().includes(needle))) {
      return null;
    }
    const store = this.store();
    const directive = this.directive();
    return nestedMatches(
      this.rootPath(),
      this.rootValue(),
      (path) => store.level(path, directive),
      needle,
    );
  });

  readonly rootOpen = computed(
    () => !!this.matches()?.length || this.store().isOpen(this.rootPath(), this.directive()),
  );

  readonly rows = computed(() => {
    const root = this.root();
    if (!root) return [];
    const store = this.store();
    const directive = this.directive();
    const matches = this.matches();
    const shown = new Set<string>();
    const hits = new Set<string>();
    for (const match of matches ?? []) {
      hits.add(pathKey(match));
      for (let i = 2; i <= match.length; i++) shown.add(pathKey(match.slice(0, i)));
    }
    const prop = this.prop();
    const writes = this.writes() && directive === undefined;
    const out: Row[] = [];
    const walk = (
      level: unknown,
      path: string[],
      kinds: ContainerKind[],
      depth: number,
      edit: EditKind,
      inHit: boolean,
    ) => {
      const { children, more } = childrenOf(level);
      for (const child of children) {
        const at = [...path, child.key];
        const key = pathKey(at);
        if (matches && !inHit && !shown.has(key)) continue;
        const container = containerOf(child.value);
        const id = pathKey(at, directive);
        if (!container) {
          const writable = edit && editableLeaf(child.value) ? editPath(at) : null;
          out.push({
            id,
            kind: 'leaf',
            depth,
            path: at,
            label: child.label,
            text: leafText(child.value),
            edit:
              writes && writable && edit
                ? { name: shownPath(at, [...kinds]), prop: writable, value: child.value, edit }
                : undefined,
          });
          continue;
        }
        // The filter opens the levels that lead to a match.
        const forced = !!matches && !inHit && shown.has(key) && !hits.has(key);
        const open = forced || store.isOpen(at, directive);
        out.push({
          id,
          kind: 'node',
          depth,
          path: at,
          label: child.label,
          text: summary(container),
          container,
          open,
        });
        if (!open) continue;
        const loaded =
          store.level(at, directive) ?? (container.collapsed ? undefined : child.value);
        const next = [...kinds, container.kind];
        if (loaded !== undefined) {
          walk(loaded, at, next, depth + 1, editInto(edit, container), inHit || hits.has(key));
        } else if (store.errors().has(id)) {
          out.push({ ...stub(at, depth + 1, 'error'), text: store.errors().get(id)! });
        } else {
          out.push(stub(at, depth + 1, 'loading'));
        }
      }
      if (more > 0 && (!matches || inHit)) {
        out.push({ ...stub(path, depth, 'more'), more, listed: children.length });
      }
    };
    const stub = (at: string[], depth: number, kind: Row['kind']): Row => ({
      id: `${pathKey(at, directive)}:${kind}`,
      kind,
      depth,
      path: at,
      label: '',
      text: '',
    });
    walk(
      this.rootValue(),
      this.rootPath(),
      [root.kind],
      0,
      writes ? editInto(prop.editInside ?? null, root) : null,
      !matches,
    );
    return out;
  });

  /** Reads the whole value for the editor, as deep as the page allows a whole edit. */
  protected readonly readWhole = async () => {
    const answer = await this.store().read(this.rootPath(), EDIT_READ.depth, EDIT_READ.limit);
    if (!answer.ok) return { error: answer.error ?? 'The page did not read it.' };
    if (!wholeValue(answer.value)) {
      return { error: 'Too large to edit as a whole. Open it to edit the values inside.' };
    }
    return { value: answer.value };
  };

  protected summaryOf(container: ValueContainer): string {
    return summary(container);
  }

  protected toggleRoot() {
    this.pendingMore = null;
    this.store().toggle(this.rootPath(), this.directive(), false);
  }

  protected toggle(row: Row) {
    this.pendingMore = null;
    this.store().toggle(row.path, this.directive(), !!row.container?.collapsed);
  }

  protected more(row: Row) {
    this.pendingMore = new Set(this.rows().map((r) => r.id));
    this.store().more(row.path, this.directive(), row.listed ?? 0);
  }

  /**
   * Focuses the first control in the entry at `index` or after it (a toggle,
   * an Edit button, the next "Show more"), else the closest one before it,
   * else the root toggle.
   */
  private focusNear(index: number) {
    const root = this.host.nativeElement;
    const entries = Array.from(root.querySelectorAll<HTMLElement>(`#${this.listId} > li`));
    const control = (entry: HTMLElement | undefined) =>
      entry?.querySelector<HTMLElement>('button:not([disabled]), input, textarea, [tabindex="0"]');
    const target =
      entries.slice(index).map(control).find(Boolean) ??
      entries.slice(0, index).reverse().map(control).find(Boolean) ??
      root.querySelector<HTMLElement>('.root > .toggle');
    target?.focus();
  }

  protected step(row: Row): number {
    return Math.min(LOAD_STEP, row.more ?? 0);
  }
}
