import { Component, input, signal } from '@angular/core';

/** Deferred content: a note with a counter, so hydration is visible. */
@Component({
  selector: 'app-defer-note',
  template: `
    <div class="note">
      <p>{{ label() }}</p>
      <button type="button" (click)="clicks.update((n) => n + 1)">
        Clicked {{ clicks() }} {{ clicks() === 1 ? 'time' : 'times' }}
      </button>
    </div>
  `,
  styles: `
    .note {
      display: grid;
      gap: 8px;
      justify-items: start;
    }
    p {
      margin: 0;
      color: var(--ink);
    }
    button {
      font: inherit;
      padding: 6px 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--subtle);
      color: var(--ink);
      cursor: pointer;
    }
  `,
})
export class DeferNote {
  readonly label = input.required<string>();
  protected readonly clicks = signal(0);
}
