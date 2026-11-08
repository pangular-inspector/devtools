import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';

/** The states every page shows besides its content. */
export type StateKind = 'loading' | 'error' | 'empty' | 'no-match';

/**
 * The loading, error, empty and no-match states of a page, so they read and
 * look the same everywhere. The projected content is the one-line message;
 * elements marked `detail` go under it, and elements marked `actions` sit
 * next to the built-in button.
 *
 * - `loading` is a status region with a spinner.
 * - `error` is an alert with a Retry button (`retry`). `retrying` disables it
 *   while a retry runs.
 * - `empty` is a status region that says how to get data.
 * - `no-match` has a Clear filters button (`clear`). It is not a live region:
 *   the page announces filter results itself, through `filterAnnouncement()`.
 *
 * ```html
 * <app-state kind="error" (retry)="retry()">Can't read the timeline.</app-state>
 * <app-state kind="empty">
 *   No page reports errors yet.
 *   <p detail>Open the app with the overlay loaded.</p>
 * </app-state>
 * ```
 */
@Component({
  selector: 'app-state',
  // Unscoped, so the rules reach the projected `[detail]` lines; every selector starts at app-state.
  encapsulation: ViewEncapsulation.None,
  host: {
    '[attr.role]': 'role()',
    '[attr.data-kind]': 'kind()',
    '[class.compact]': 'compact()',
  },
  template: `
    @if (kind() === 'loading') {
      <span class="spinner" aria-hidden="true"></span>
    }
    <div class="body">
      <p class="message"><ng-content /></p>
      <ng-content select="[detail]" />
      @if (kind() === 'error' || kind() === 'no-match' || hasActions()) {
        <div class="actions">
          @if (kind() === 'error') {
            <button
              type="button"
              class="action"
              [attr.aria-disabled]="retrying() || null"
              (click)="onRetry()"
            >
              {{ retrying() ? 'Retrying…' : retryLabel() }}
            </button>
          } @else if (kind() === 'no-match') {
            <button type="button" class="action" (click)="clear.emit()">Clear filters</button>
          }
          <ng-content select="[actions]" />
        </div>
      }
    </div>
  `,
  styles: `
    @use 'mixins' as m;

    app-state {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      margin: 0 0 12px;
      padding: 14px 16px;
      @include m.panel;
      color: var(--text-2);
      line-height: 1.5;
      @include m.enter(0.2s);
    }
    app-state.compact {
      padding: 8px 12px;
    }
    app-state[data-kind='error'] {
      box-shadow: inset 3px 0 0 var(--danger);
    }
    app-state > .body {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    app-state .message {
      margin: 0;
      color: var(--text);
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    app-state[data-kind='loading'] .message {
      color: var(--text-2);
      font-weight: 400;
    }
    app-state [detail] {
      margin: 0;
      color: var(--text-2);
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    app-state code {
      font-family: var(--font-mono);
      color: var(--text);
    }
    app-state .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 2px;
    }
    app-state .action {
      height: var(--control-h);
      padding: 0 12px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
      transition: background-color 0.15s var(--ease);
    }
    app-state .action:hover {
      background: var(--surface-3);
    }
    app-state .action[aria-disabled='true'] {
      cursor: progress;
    }
    app-state .action:focus-visible {
      @include m.focus-ring;
    }
    app-state > .spinner {
      flex: none;
      width: 14px;
      height: 14px;
      margin-top: 4px;
      border: 2px solid var(--border-strong);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: app-state-spin 0.8s linear infinite;
    }
    @keyframes app-state-spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      app-state,
      app-state > .spinner {
        animation: none;
      }
    }
  `,
})
export class AppState {
  readonly kind = input.required<StateKind>();
  /** The Retry button's label, for an action that is not a plain reload. */
  readonly retryLabel = input('Retry');
  /** True while a retry runs, so the button can't send it twice. */
  readonly retrying = input(false);
  /** A smaller box, for a state inside a panel rather than the page. */
  readonly compact = input(false);
  /** Shows the actions row for projected `[actions]` on an empty or loading state. */
  readonly hasActions = input(false);
  readonly retry = output<void>();
  readonly clear = output<void>();

  protected readonly role = computed(() => {
    switch (this.kind()) {
      case 'error':
        return 'alert';
      case 'no-match':
        return null;
      default:
        return 'status';
    }
  });

  protected onRetry() {
    if (!this.retrying()) this.retry.emit();
  }
}
