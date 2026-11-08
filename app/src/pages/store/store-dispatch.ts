import { Component, inject } from '@angular/core';
import { StoreActions } from './store-actions';
import { StoreState } from './store-state';

/** The Dispatch an action form of the shown `@ngrx/store` Store. */
@Component({
  selector: 'section[appStoreDispatch]',
  templateUrl: './store-dispatch.html',
  styleUrl: './store-dispatch.scss',
})
export class StoreDispatch {
  private readonly state = inject(StoreState);
  private readonly actions = inject(StoreActions);

  protected readonly canRestore = this.state.canRestore;
  protected readonly restoreOff = this.state.restoreOff;
  protected readonly actionTypes = this.state.actionTypes;
  protected readonly busy = this.actions.busy;
  protected readonly dispatchType = this.actions.dispatchType;
  protected readonly dispatchPayload = this.actions.dispatchPayload;
  protected readonly payloadError = this.actions.payloadError;
  protected readonly dispatchRequest = this.actions.dispatchRequest;

  protected dispatchAction(event: Event) {
    return this.actions.dispatchAction(event);
  }
}
