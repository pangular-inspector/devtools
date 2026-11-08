import { Component, ElementRef, afterRenderEffect, inject, viewChild } from '@angular/core';
import { StoreActions } from './store-actions';
import { StoreState } from './store-state';

/** The Store DevTools history controls of the shown `@ngrx/store` Store. */
@Component({
  selector: 'section[appStoreHistory]',
  templateUrl: './store-history.html',
  styleUrl: './store-history.scss',
})
export class StoreHistory {
  private readonly state = inject(StoreState);
  private readonly actions = inject(StoreActions);
  private readonly resetButton = viewChild<ElementRef<HTMLButtonElement>>('resetButton');
  private readonly resetCancel = viewChild<ElementRef<HTMLButtonElement>>('resetCancel');

  protected readonly store = this.state.store;
  protected readonly canRestore = this.state.canRestore;
  protected readonly restoreOff = this.state.restoreOff;
  protected readonly busy = this.actions.busy;
  protected readonly confirmReset = this.actions.confirmReset;

  constructor() {
    afterRenderEffect(() => {
      const target = this.actions.focusReset();
      const button = target === 'cancel' ? this.resetCancel() : this.resetButton();
      if (!target || !button) return;
      this.actions.focusReset.set(null);
      button.nativeElement.focus();
    });
  }

  protected askReset() {
    this.actions.askReset();
  }

  protected cancelReset(event?: Event) {
    this.actions.cancelReset(event);
  }

  protected devtoolsOp(request: { op: string; seq?: number; index?: number; paused?: boolean }) {
    return this.actions.devtoolsOp(request);
  }
}
