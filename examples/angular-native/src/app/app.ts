import { Component, signal } from '@angular/core';
import { Pressable, SafeAreaProvider, SafeAreaView, Text, View } from '@ng-native/components';
import { CounterCard } from './counter-card.ts';
import { TodoList } from './todo-list.ts';

@Component({
  selector: 'app-root',
  imports: [Pressable, SafeAreaProvider, SafeAreaView, Text, View, CounterCard, TodoList],
  template: `
    <safe-area-provider>
      <safe-area-view class="screen">
        <view class="body">
          <text class="title">Angular Native demo</text>
          <text class="hint">Open the devtools panel to inspect this app.</text>
          <pressable accessibilityRole="button" class="button" (press)="taps.set(taps() + 1)">
            <text class="label">Tapped {{ taps() }} times</text>
          </pressable>
          <app-counter-card label="Shared counter" />
          <app-todo-list />
        </view>
      </safe-area-view>
    </safe-area-provider>
  `,
  styles: `
    :host {
      flex: 1;
    }
    .screen {
      flex: 1;
      background-color: #101014;
    }
    .body {
      flex: 1;
      justify-content: center;
      gap: 12px;
      padding: 24px;
    }
    .title {
      color: #ffffff;
      font-size: 28px;
      font-weight: 700;
    }
    .hint {
      color: #a0a0aa;
      font-size: 15px;
    }
    .button {
      align-items: center;
      padding: 14px;
      border-radius: 10px;
      background-color: #3b6ef5;
    }
    .label {
      color: #ffffff;
      font-size: 16px;
      font-weight: 600;
    }
  `,
})
export class App {
  protected readonly taps = signal(0);
}
