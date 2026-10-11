import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  PLATFORM_ID,
  linkedSignal,
  resource,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { ExamplePage } from './example-page';
import { ExamplePanel } from './example-panel';
import { ExampleSettings } from './example-settings';
import { StatCard } from './stat-card';

interface Reading {
  label: string;
  amount: number;
}

@Component({
  selector: 'app-signals-example',
  imports: [ExamplePage, ExamplePanel, StatCard],
  template: `
    <app-example-page heading="Signals" tab="Signals">
      <ng-container lead>
        Every declaration the Signals inspector understands, in one component: a signal, a computed,
        a linkedSignal, an effect, a resource, view and content queries, plus the inputs, outputs
        and model on the projected cards.
      </ng-container>
      <ng-container hint>
        Press the buttons and watch the values change, then filter the tab by kind.
      </ng-container>

      <div class="controls">
        <button type="button" (click)="add(1)">Add one</button>
        <button type="button" (click)="add(5)">Add five</button>
        <button type="button" (click)="reset()">Reset</button>
        <button type="button" (click)="toggleUnit()">Unit: {{ unit() }}</button>
      </div>

      <dl class="readouts">
        <dt>count (signal)</dt>
        <dd>{{ count() }}</dd>
        <dt>doubled (computed)</dt>
        <dd>{{ doubled() }}</dd>
        <dt>label (linkedSignal, editable and reset by count or unit)</dt>
        <dd>
          <input
            class="label-input"
            [value]="label()"
            (input)="setLabel($event)"
            aria-label="Editable label, reset whenever count or unit changes"
          />
        </dd>
        <dt>readings (resource)</dt>
        <dd>{{ readings.hasValue() ? readings.value().length : 0 }} loaded</dd>
      </dl>

      <app-example-panel>
        @for (reading of readings.value() ?? []; track reading.label) {
          <app-stat-card
            [label]="reading.label"
            [value]="reading.amount"
            (refreshed)="settings.recordRefresh()"
          />
        }
      </app-example-panel>

      <p class="summary" aria-live="polite">
        {{ allCards().length }} card(s) in view, {{ panel().cards().length }} projected; refreshed
        {{ settings.refreshes() }} time(s).
      </p>
    </app-example-page>
  `,
  styles: `
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .controls button {
      padding: 6px 12px;
      border: 1px solid var(--line-strong);
      border-radius: 6px;
      background: var(--surface);
      cursor: pointer;
    }
    .label-input {
      padding: 2px 8px;
      border: 1px solid var(--line-strong);
      border-radius: 4px;
      background: var(--surface);
    }
    .readouts {
      display: grid;
      grid-template-columns: minmax(0, max-content) minmax(0, 1fr);
      gap: 4px 16px;
      margin: 0;
    }
    dt {
      color: var(--muted);
    }
    dd {
      margin: 0;
      font-variant-numeric: tabular-nums;
    }
    .summary {
      margin: 0;
      color: var(--muted);
    }
    :focus-visible {
      outline: 2px solid var(--brand);
      outline-offset: 2px;
    }
  `,
})
export class SignalsExample {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly settings = inject(ExampleSettings);

  // Restored before `persist` runs, since an effect runs at least once and
  // would otherwise write the initial value over the stored one. The server
  // and the first client render both use the default, so hydration matches.
  protected readonly count = signal(1);
  protected readonly doubled = computed(() => this.count() * 2);

  protected readonly unit = signal('item');

  /** Writable, and reset whenever either source changes: that is what
   * separates a linkedSignal from a computed. */
  protected readonly label = linkedSignal(() => `${this.count()} ${this.unit()}(s)`);

  protected toggleUnit() {
    this.unit.update((current) => (current === 'item' ? 'widget' : 'item'));
  }

  protected setLabel(event: Event) {
    this.label.set((event.target as HTMLInputElement).value);
  }

  /** Starts empty so the prerendered markup and the first client render agree;
   * the rows arrive after hydration. */
  protected readonly readings = resource<Reading[], number>({
    defaultValue: [],
    params: () => this.count(),
    loader: ({ params }) =>
      this.isBrowser
        ? Promise.resolve(
            Array.from({ length: Math.min(params, 4) }, (_, index) => ({
              label: `Reading ${index + 1}`,
              amount: (index + 1) * params,
            })),
          )
        : Promise.resolve([]),
  });

  /** The panel is always rendered, so a required query is safe here. */
  protected readonly panel = viewChild.required(ExamplePanel);
  protected readonly allCards = viewChildren(StatCard);

  /** Effects are for work outside the reactive graph, so this one writes to
   * storage rather than to another signal. Held in a field so the Signals tab
   * lists it and so it can be destroyed with the component. */
  private readonly persist = effect(() => {
    const count = this.count();
    if (!this.isBrowser) return;
    if (!this.restored) {
      this.restored = true;
      const stored = this.readStoredCount();
      if (stored !== undefined && stored !== count) {
        this.count.set(stored);
        return;
      }
    }
    try {
      sessionStorage.setItem('pangular-examples-count', String(count));
    } catch {
      // storage can be unavailable; the example does not depend on it
    }
  });

  private restored = false;

  private readStoredCount(): number | undefined {
    try {
      const raw = sessionStorage.getItem('pangular-examples-count');
      const value = Number(raw);
      return raw !== null && Number.isFinite(value) ? value : undefined;
    } catch {
      return undefined;
    }
  }

  add(step: number) {
    this.count.update((value) => value + step);
  }

  reset() {
    this.count.set(1);
  }
}
