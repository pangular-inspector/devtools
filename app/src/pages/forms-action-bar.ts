import { Component, input, output } from '@angular/core';
import { FORMS_STYLES } from './forms-types';

/** The form-level actions: touch, revalidate, pick, snapshot and restore, reset and submit. */
@Component({
  selector: 'app-forms-action-bar',
  template: `
    <div class="action-bar">
      <div class="actions" role="group" aria-label="Form actions">
        <button
          type="button"
          class="small"
          [disabled]="!canWrite()"
          [attr.aria-describedby]="canWrite() ? null : 'forms-writes-off'"
          (click)="act.emit('touch-all')"
        >
          Touch all
        </button>
        <button
          type="button"
          class="small"
          [disabled]="!canWrite()"
          [attr.aria-describedby]="canWrite() ? null : 'forms-writes-off'"
          (click)="act.emit('revalidate')"
        >
          Revalidate
        </button>
        <button type="button" class="small" (click)="act.emit('focus-first-invalid')">
          Focus first invalid
        </button>
        <button
          type="button"
          class="small"
          [class.on]="picking()"
          [attr.aria-pressed]="!!picking()"
          (click)="picking() ? cancelPick.emit() : pick.emit()"
        >
          {{ picking() ? 'Cancel picking' : 'Pick field on page' }}
        </button>
        <span class="divider" aria-hidden="true"></span>
        <button type="button" class="small" (click)="act.emit('snapshot')">Snapshot</button>
        @if (snapshot()) {
          <button
            type="button"
            class="small"
            [class.armed]="armed() === 'restore'"
            [disabled]="!canWrite()"
            [attr.aria-describedby]="canWrite() ? null : 'forms-writes-off'"
            [attr.title]="'Restore ' + snapshot()"
            (click)="confirmAct.emit('restore')"
          >
            {{ armed() === 'restore' ? 'Confirm restore' : 'Restore ' + snapshot() }}
          </button>
        }
        <span class="spacer" aria-hidden="true"></span>
        <button
          type="button"
          class="small danger"
          [class.armed]="armed() === 'reset'"
          [disabled]="!canWrite()"
          [attr.aria-describedby]="canWrite() ? null : 'forms-writes-off'"
          (click)="confirmAct.emit('reset')"
        >
          {{ armed() === 'reset' ? 'Confirm reset' : 'Reset' }}
        </button>
        <button
          type="button"
          class="small primary"
          [class.armed]="armed() === 'submit'"
          [disabled]="!canWrite()"
          [attr.aria-describedby]="canWrite() ? null : 'forms-writes-off'"
          (click)="confirmAct.emit('submit')"
        >
          {{ armed() === 'submit' ? 'Confirm submit' : 'Submit' }}
        </button>
      </div>
      @if (!canWrite()) {
        <p id="forms-writes-off" class="muted">{{ writesOff() }}</p>
      }
      <p class="status" role="status">{{ message() }}</p>
    </div>
  `,
  styles: `
    ${FORMS_STYLES}
    :host {
      display: block;
      min-width: 0;
    }
    .action-bar {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .divider {
      width: 1px;
      height: 20px;
      background: var(--border-strong);
    }
    .spacer {
      flex: 1 1 0;
    }
    .actions .small:not(.primary):not(.danger) {
      max-width: 240px;
    }
    .small.on {
      background: var(--accent-soft);
      border-color: var(--accent-line);
      color: var(--text-strong);
    }
    .status:empty {
      height: 0;
      margin-top: -8px;
    }
    @media (max-width: 480px) {
      .spacer,
      .divider {
        display: none;
      }
    }
  `,
})
export class FormsActionBar {
  readonly canWrite = input(false);
  readonly writesOff = input('');
  /** The form being picked on the page, or null. */
  readonly picking = input<string | null>(null);
  readonly snapshot = input<string | null>(null);
  readonly armed = input<string | null>(null);
  readonly message = input('');
  readonly act = output<string>();
  readonly confirmAct = output<'reset' | 'submit' | 'restore'>();
  readonly pick = output<void>();
  readonly cancelPick = output<void>();
}
