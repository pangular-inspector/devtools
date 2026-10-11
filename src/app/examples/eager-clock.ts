import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';

// Eager on purpose: ticks is a plain field, so OnPush would never see it change.
@Component({
  selector: 'app-eager-clock',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<p class="ticks">
    Eager tick <strong>{{ ticks }}</strong>
  </p>`,
  styles: `
    .ticks {
      margin: 0;
      font-variant-numeric: tabular-nums;
      color: var(--muted);
    }
  `,
})
export class EagerClock {
  private readonly cdr = inject(ChangeDetectorRef);
  protected ticks = 0;

  constructor() {
    const id = setInterval(() => {
      this.ticks++;
      this.cdr.markForCheck();
    }, 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
}
