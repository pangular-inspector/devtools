import { Component, ElementRef, effect, inject, output, signal, viewChild } from '@angular/core';
import { directiveHostLabel, hydrationLabel, type HydrationStatus } from '../component-tree-state';
import type { LiveNode } from './component-model';
import { TreeState } from './tree-state';

/**
 * The live component tree of the Components page: one ARIA tree item per instance, windowed
 * when the tree is long, with arrow key moves and the full name of a cut off row under it.
 */
@Component({
  selector: 'div[appTreeRows]',
  templateUrl: './tree-rows.html',
  styleUrl: './tree-rows.scss',
})
export class TreeRows {
  private readonly state = inject(TreeState);
  /** The no-match state's Clear filters, which the page handles so focus goes to its search. */
  readonly clearFilter = output<void>();

  protected readonly filter = this.state.filter;
  protected readonly page = this.state.page;
  protected readonly rows = this.state.rows;
  protected readonly rowWindow = this.state.rowWindow;
  protected readonly shownRows = this.state.shownRows;
  protected readonly selectedId = this.state.selectedId;
  protected readonly tabStop = this.state.tabStop;
  protected readonly focusId = this.state.focusId;
  protected readonly showDirectiveHosts = this.state.showDirectiveHosts;
  protected readonly routedById = this.state.routedById;
  protected readonly cdHosts = this.state.cdHosts;
  /** The full text of the focused row when its name or tag is cut off, shown below the row. */
  protected readonly nameTip = signal<{ text: string; top: number } | null>(null);
  private readonly treeEl = viewChild<ElementRef<HTMLElement>>('treeEl');

  constructor() {
    effect(() => {
      const tree = this.treeEl()?.nativeElement;
      if (tree) this.rowWindow.attach(tree);
    });
  }

  protected select(id: string) {
    this.state.select(id);
  }

  protected toggle(id: string, event?: Event) {
    this.state.toggle(id, event);
  }

  protected highlight(id: string | null) {
    this.state.highlight(id);
  }

  protected hostLabel(node: LiveNode) {
    return directiveHostLabel(node);
  }

  protected hydrationText(status: HydrationStatus) {
    return hydrationLabel(status);
  }

  /** Shows the full text of a focused row whose name, tag or directives are cut off. */
  protected showNameTip(event: FocusEvent) {
    const row = event.currentTarget as HTMLElement;
    const parts = Array.from(row.querySelectorAll<HTMLElement>('.name, .tag, .host-dirs'));
    const cut = parts.some((part) => part.scrollWidth > part.clientWidth + 1);
    if (!cut) {
      this.nameTip.set(null);
      return;
    }
    const text = parts.map((part) => part.title || part.textContent?.trim()).join(' ');
    this.nameTip.set({ text, top: row.offsetTop + row.offsetHeight + 2 });
  }

  protected onTreeKey(event: KeyboardEvent) {
    const state = this.state;
    const rows = state.rows();
    if (!rows.length) return;
    const current = rows.findIndex((r) => r.node.id === state.rovingId());
    const at = Math.max(current, 0);
    const row = rows[at];
    let next = -1;
    switch (event.key) {
      case 'ArrowDown':
        next = Math.min(at + 1, rows.length - 1);
        break;
      case 'ArrowUp':
        next = Math.max(at - 1, 0);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = rows.length - 1;
        break;
      case 'ArrowRight':
        if (row.hasChildren && !row.expanded) state.toggle(row.node.id);
        else if (row.hasChildren) next = at + 1;
        break;
      case 'ArrowLeft':
        if (row.hasChildren && row.expanded && !state.query()) state.toggle(row.node.id);
        else {
          const parent = state.index().parents.get(row.node.id);
          next = rows.findIndex((r) => r.node.id === parent);
        }
        break;
      case 'Enter':
      case ' ':
        state.select(row.node.id);
        break;
      case '*':
        state.expandSiblings(row.node.id);
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next >= 0) {
      const id = rows[next].node.id;
      state.focusId.set(id);
      const focus = () => {
        const el = document.querySelector<HTMLElement>(`.row[data-id="${CSS.escape(id)}"]`);
        state.clearToolbar();
        el?.focus({ preventScroll: true });
        el?.scrollIntoView({ block: 'nearest' });
        if (el) state.keepBelowToolbar(el);
      };
      // A row outside the rendered window is brought in first.
      if (this.rowWindow.rendered(next)) queueMicrotask(focus);
      else this.rowWindow.reveal(next, focus);
    }
  }
}
