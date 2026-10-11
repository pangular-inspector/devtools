import {
  Component,
  Injectable,
  NO_ERRORS_SCHEMA,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

/** Provided by the showcase component, so it shows up on an element injector. */
@Injectable()
export class TapCounter {
  readonly taps = signal(0);
}

@Component({
  selector: 'ns-devtools-showcase',
  template: `
    <StackLayout class="m-4 p-4 rounded-xl bg-gray-100">
      <Label [text]="title()" class="text-lg font-bold"></Label>
      <Label [text]="summary()" class="text-sm text-gray-600"></Label>
      <Button text="Tap me" class="mt-2 rounded-lg bg-blue-600 text-white" (tap)="tap()"></Button>
    </StackLayout>
  `,
  providers: [TapCounter],
  schemas: [NO_ERRORS_SCHEMA],
})
export class DevtoolsShowcaseComponent {
  readonly title = input('DevTools showcase');
  readonly counter = inject(TapCounter);
  readonly doubled = computed(() => this.counter.taps() * 2);
  readonly summary = computed(() => `${this.counter.taps()} taps, doubled ${this.doubled()}`);

  constructor() {
    effect(() => console.log(`[showcase] taps=${this.counter.taps()}`));
  }

  tap() {
    this.counter.taps.update((n) => n + 1);
  }
}
