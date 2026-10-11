import { Service, computed, signal } from '@angular/core';

@Service()
export class CounterService {
  readonly count = signal(0);
  readonly doubled = computed(() => this.count() * 2);

  increment() {
    this.count.update((value) => value + 1);
  }
}
