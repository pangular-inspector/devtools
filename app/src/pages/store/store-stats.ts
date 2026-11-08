import { Component, inject } from '@angular/core';
import { formatDuration } from './store-format';
import { StoreState } from './store-state';

/** The action frequency table of the shown store. */
@Component({
  selector: 'div[appStoreStats]',
  templateUrl: './store-stats.html',
  styleUrl: './store-stats.scss',
})
export class StoreStats {
  private readonly state = inject(StoreState);

  protected readonly store = this.state.store;
  protected readonly storeStats = this.state.storeStats;
  protected readonly hasLoop = this.state.hasLoop;
  protected readonly formatDuration = formatDuration;
  /** How many effect dispatches within a second flag a loop (`NGRX_LOOP_BURST`). */
  protected readonly loopBurst = 20;
}
