import { Component, inject } from '@angular/core';
import { kindOf, labelOf, toneOf, type InjectorNode } from './injector-model';
import { InjectorsState } from './injectors-state';

/**
 * The rows of the injector tree, an ARIA tree with arrow keys: Up and Down move, Right opens or
 * goes to the first child, Left closes or goes to the nearest shown parent, Home and End jump.
 */
@Component({
  selector: 'div[appInjectorTree]',
  templateUrl: './injector-tree.html',
  styleUrl: './injector-tree.scss',
  host: { '(keydown)': 'onTreeKey($event)' },
})
export class InjectorTree {
  private readonly state = inject(InjectorsState);

  readonly rows = this.state.rows;
  readonly selected = this.state.selected;
  readonly rovingId = this.state.rovingId;
  readonly focusId = this.state.focusId;

  select(id: string) {
    this.state.select(id);
  }

  toggle(id: string, event?: Event) {
    this.state.toggle(id, event);
  }

  highlight(node: InjectorNode | null) {
    this.state.highlight(node);
  }

  providerCount(node: InjectorNode) {
    return this.state.providerCount(node);
  }

  label(node: InjectorNode) {
    return labelOf(node);
  }

  kind(node: InjectorNode) {
    return kindOf(node);
  }

  tone(kind: string) {
    return toneOf(kind);
  }

  onTreeKey(event: KeyboardEvent) {
    const rows = this.rows();
    if (!rows.length) return;
    const roving = this.rovingId();
    const current = rows.findIndex((r) => r.node.injector.id === roving);
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
        if (row.hasChildren && !row.expanded) this.toggle(row.node.injector.id);
        else if (row.hasChildren) next = at + 1;
        break;
      case 'ArrowLeft':
        if (row.hasChildren && row.expanded && !this.state.normalizedQuery())
          this.toggle(row.node.injector.id);
        else {
          // The nearest shown ancestor, since hidden framework injectors have no row.
          const { parents } = this.state.index();
          let parent = parents.get(row.node.injector.id);
          next = -1;
          while (parent && next < 0) {
            const id = parent;
            next = rows.findIndex((r) => r.node.injector.id === id);
            parent = parents.get(parent);
          }
        }
        break;
      case 'Enter':
      case ' ':
        this.select(row.node.injector.id);
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next >= 0) {
      const id = rows[next].node.injector.id;
      this.focusId.set(id);
      this.state.choose(id);
      queueMicrotask(() => this.state.focusRow(id, true));
    }
  }
}
