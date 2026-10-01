import { Component, computed, inject } from '@angular/core';
import { patchState, signalState, signalStore, withMethods, withState } from '@ngrx/signals';
import { ExamplePage } from './example-page';

interface PackingItem {
  id: number;
  label: string;
  packed: boolean;
}

const PackingStore = signalStore(
  withState({
    items: [
      { id: 1, label: 'Passport', packed: true },
      { id: 2, label: 'Charger', packed: false },
      { id: 3, label: 'Sunscreen', packed: false },
    ] as PackingItem[],
    nextId: 4,
  }),
  withMethods((store) => ({
    toggle(id: number): void {
      patchState(store, (state) => ({
        items: state.items.map((item) =>
          item.id === id ? { ...item, packed: !item.packed } : item,
        ),
      }));
    },
    add(label: string): void {
      patchState(store, (state) => ({
        items: [...state.items, { id: state.nextId, label, packed: false }],
        nextId: state.nextId + 1,
      }));
    },
  })),
);

@Component({
  selector: 'app-store-example',
  imports: [ExamplePage],
  providers: [PackingStore],
  template: `
    <app-example-page heading="NgRx signal state" tab="Store">
      <ng-container lead>
        This page provides a <code>signalStore</code> in its own <code>providers</code>, so the
        store lives and dies with the component. It also keeps a <code>signalState</code> in a
        component field.
      </ng-container>
      <ng-container hint>
        Find <code>PackingStore</code> with the scope <code>StoreExample (component)</code> and the
        <code>view</code> field, then toggle items and watch the change log.
      </ng-container>

      <div class="grid">
        <section class="card" aria-labelledby="store-example-list">
          <h3 id="store-example-list">Packing list (signalStore)</h3>
          <ul>
            @for (item of visible(); track item.id) {
              <li>
                <label>
                  <input type="checkbox" [checked]="item.packed" (change)="store.toggle(item.id)" />
                  {{ item.label }}
                </label>
              </li>
            } @empty {
              <li class="muted">Everything is packed.</li>
            }
          </ul>
          <button type="button" (click)="addItem()">Add an item</button>
        </section>

        <section class="card" aria-labelledby="store-example-view">
          <h3 id="store-example-view">View options (signalState)</h3>
          <label class="option">
            <input
              type="checkbox"
              [checked]="view.hidePacked()"
              (change)="setHidePacked($any($event.target).checked)"
            />
            Hide packed items
          </label>
          <p class="muted">
            {{ packedCount() }} of {{ store.items().length }} packed. Items added:
            {{ view.added() }}.
          </p>
        </section>
      </div>
    </app-example-page>
  `,
  styles: `
    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
    }
    .card {
      display: grid;
      align-content: start;
      gap: 12px;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: var(--radius, 12px);
      background: var(--surface);
    }
    h3 {
      margin: 0;
      color: var(--ink);
      font-size: 15px;
    }
    ul {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--ink);
    }
    .muted {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
    }
    button {
      justify-self: start;
      height: 32px;
      padding: 0 12px;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-sm, 8px);
      background: var(--surface);
      color: var(--ink);
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    button:hover {
      border-color: var(--ink);
      background: var(--subtle);
    }
    button:focus-visible,
    input:focus-visible {
      outline: 2px solid var(--brand);
      outline-offset: 2px;
    }
    code {
      background: var(--subtle);
      border-radius: 4px;
      padding: 1px 5px;
    }
  `,
})
export class StoreExample {
  protected readonly store = inject(PackingStore);
  protected readonly view = signalState({ hidePacked: false, added: 0 });

  protected readonly visible = computed(() =>
    this.view.hidePacked() ? this.store.items().filter((item) => !item.packed) : this.store.items(),
  );
  protected readonly packedCount = computed(
    () => this.store.items().filter((item) => item.packed).length,
  );

  protected setHidePacked(hidePacked: boolean) {
    patchState(this.view, { hidePacked });
  }

  protected addItem() {
    patchState(this.view, (state) => ({ added: state.added + 1 }));
    this.store.add(`Extra item ${this.view.added()}`);
  }
}
