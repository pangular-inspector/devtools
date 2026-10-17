// Browser entry for `scripts/e2e-resilience.mjs`: a generated Angular app (JIT,
// plain JavaScript, no decorators) that the harness bundles into the demo's
// browser folder, so it reports to the same hub as the demo tabs.
//
// Query parameters set its size, so the same bundle serves as a small second
// app in the multi-tab check and as the large app in the stress check:
//   ?components=2000&defers=500&entities=10000&fields=300&label=X
import '@angular/compiler';
import {
  Component,
  Injectable,
  computed,
  inject,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { patchState, signalStore, watchState, withMethods, withState } from '@ngrx/signals';
import { setAllEntities, updateEntity, withEntities } from '@ngrx/signals/entities';

const params = new URLSearchParams(location.search);
const size = (name, fallback) => Math.max(0, Number(params.get(name) ?? fallback) || 0);
const COMPONENTS = size('components', 2000);
const DEFERS = size('defers', 500);
const ENTITIES = size('entities', 10000);
const FIELDS = size('fields', 300);
const LABEL = (params.get('label') ?? 'stress').replace(/[^\w-]/g, '').slice(0, 40);

const range = (n) => Array.from({ length: n }, (_, i) => i);

const StressStore = signalStore(
  { providedIn: 'root' },
  withState({ label: LABEL, bumps: 0 }),
  withEntities(),
  withMethods((store) => ({
    load(count) {
      patchState(
        store,
        setAllEntities(range(count).map((id) => ({ id, name: `${LABEL}-entity-${id}`, score: 0 }))),
      );
    },
    bump(id) {
      patchState(store, updateEntity({ id, changes: (e) => ({ score: e.score + 1 }) }), (s) => ({
        bumps: s.bumps + 1,
      }));
    },
  })),
);

class Ticker {
  count = signal(0, { debugName: 'ticks' });
}
Injectable({ providedIn: 'root' })(Ticker);

class StressCell {
  idx = 0;
}
Component({
  selector: 'stress-cell',
  inputs: ['idx'],
  template: `<span class="cell">{{ idx }}</span>`,
})(StressCell);

class StressLeaf {
  idx = 0;
}
Component({
  selector: 'stress-leaf',
  inputs: ['idx'],
  template: `<b class="leaf">{{ idx }}</b>`,
})(StressLeaf);

class StressRoot {
  store = inject(StressStore);
  ticker = inject(Ticker);
  label = LABEL;
  cells = range(COMPONENTS);
  // Half load on idle, half wait for a viewport far below the fold.
  idleDefers = range(Math.ceil(DEFERS / 2));
  viewportDefers = range(Math.floor(DEFERS / 2));
  keys = range(FIELDS).map((i) => `field${i}`);
  form = new FormGroup(
    Object.fromEntries(range(FIELDS).map((i) => [`field${i}`, new FormControl(`${LABEL}-${i}`)])),
  );
  total = computed(() => this.store.ids().length);
  constructor() {
    this.store.load(ENTITIES);
  }
}
Component({
  selector: 'stress-root',
  imports: [StressCell, StressLeaf, ReactiveFormsModule],
  template: `
    <h1 id="stress-title">Stress {{ label }}</h1>
    <p id="stress-meta">
      entities {{ total() }} bumps {{ store.bumps() }} ticks {{ ticker.count() }}
    </p>
    <form [formGroup]="form" id="stress-form" aria-labelledby="stress-title">
      @for (key of keys; track key) {
        <label>{{ key }} <input [formControlName]="key" [attr.data-key]="key" /></label>
      }
    </form>
    <section id="cells">
      @for (i of cells; track i) {
        <stress-cell [idx]="i" />
      }
    </section>
    <section id="idle-defers">
      @for (i of idleDefers; track i) {
        @defer (on idle) {
          <stress-leaf [idx]="i" />
        } @placeholder {
          <i>idle {{ i }}</i>
        }
      }
    </section>
    <div style="height: 20000px"></div>
    <section id="viewport-defers">
      @for (i of viewportDefers; track i) {
        @defer (on viewport) {
          <stress-leaf [idx]="i" />
        } @placeholder {
          <i>viewport {{ i }}</i>
        } @loading {
          <i>loading</i>
        }
      }
    </section>
  `,
})(StressRoot);

const ref = await bootstrapApplication(StressRoot, {
  providers: [provideZonelessChangeDetection()],
});
const root = ref.components[0].instance;

// Hooks the harness drives with page.evaluate().
window.__stress = {
  sizes: { COMPONENTS, DEFERS, ENTITIES, FIELDS, LABEL },
  bump: (times = 1) => {
    for (let i = 0; i < times; i++) root.store.bump(i % Math.max(1, ENTITIES));
  },
  tick: (times = 1) => {
    for (let i = 0; i < times; i++) root.ticker.count.update((c) => c + 1);
  },
  setField: (index, value) => root.form.controls[`field${index}`].setValue(value),
  // Makes one field fail validation, to see whether fields past a cap are explained.
  invalidate: (index) => {
    const control = root.form.controls[`field${index}`];
    control.setValidators(() => ({ harness: true }));
    control.updateValueAndValidity();
  },
  settle: () => ref.whenStable(),
};

await ref.whenStable();
const devtools = await import('@pangular-inspector/devtools/overlay');
devtools.registerNgrxSignals({ patchState, watchState });
