import { Component, computed, inject, input } from '@angular/core';
import { Pressable, Text, View } from '@ng-native/components';
import { CounterService } from './counter.service.ts';

@Component({
  selector: 'app-counter-card',
  imports: [Pressable, Text, View],
  template: `
    <view class="card">
      <text class="title">{{ label() }}</text>
      <pressable accessibilityRole="button" class="button" (press)="counter.increment()">
        <text class="label">Count {{ counter.count() }} ({{ summary() }})</text>
      </pressable>
    </view>
  `,
  styles: `
    .card {
      padding: 12px;
      border-radius: 10px;
      background-color: #1d1d24;
      gap: 8px;
    }
    .title {
      color: #ffffff;
      font-size: 18px;
      font-weight: 600;
    }
    .button {
      align-items: center;
      padding: 12px;
      border-radius: 8px;
      background-color: #3b6ef5;
    }
    .label {
      color: #ffffff;
      font-size: 15px;
    }
  `,
})
export class CounterCard {
  readonly label = input('Counter');
  protected readonly counter = inject(CounterService);
  protected readonly summary = computed(() => `doubled ${this.counter.doubled()}`);
}
