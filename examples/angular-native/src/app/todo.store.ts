import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

interface Todo {
  id: number;
  title: string;
  done: boolean;
}

export const TodoStore = signalStore(
  { providedIn: 'root' },
  withState({ todos: [{ id: 1, title: 'Open the devtools', done: false }] as Todo[] }),
  withComputed(({ todos }) => ({
    remaining: computed(() => todos().filter((todo) => !todo.done).length),
  })),
  withMethods((store) => ({
    add(title: string) {
      patchState(store, {
        todos: [...store.todos(), { id: store.todos().length + 1, title, done: false }],
      });
    },
    toggle(id: number) {
      patchState(store, {
        todos: store.todos().map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)),
      });
    },
  })),
);
