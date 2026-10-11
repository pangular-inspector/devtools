import { Component, inject } from '@angular/core';
import { Pressable, Text, View } from '@ng-native/components';
import { TodoStore } from './todo.store.ts';

@Component({
  selector: 'app-todo-list',
  imports: [Pressable, Text, View],
  template: `
    <view class="card">
      <text class="title">Todos ({{ store.remaining() }} left)</text>
      @for (todo of store.todos(); track todo.id) {
        <pressable
          accessibilityRole="checkbox"
          [accessibilityState]="{ checked: todo.done }"
          class="row"
          (press)="store.toggle(todo.id)"
        >
          <text class="item">{{ todo.done ? '[x]' : '[ ]' }} {{ todo.title }}</text>
        </pressable>
      }
      <pressable
        accessibilityRole="button"
        class="button"
        (press)="store.add('Todo ' + (store.todos().length + 1))"
      >
        <text class="label">Add todo</text>
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
    .row {
      padding: 6px;
    }
    .item {
      color: #d0d0d8;
      font-size: 15px;
    }
    .button {
      align-items: center;
      padding: 12px;
      border-radius: 8px;
      background-color: #1f7a54;
    }
    .label {
      color: #ffffff;
      font-size: 15px;
    }
  `,
})
export class TodoList {
  protected readonly store = inject(TodoStore);
}
