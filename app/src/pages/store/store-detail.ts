import { Component, ElementRef, afterRenderEffect, inject, viewChild } from '@angular/core';
import { SourceLink } from '../../ui/source-link';
import { StoreGlobal } from '../../ui/store-global';
import { StoreSession } from '../store-session';
import { StoreStateTree } from '../store-state-tree';
import { pretty, short } from '../store-types';
import { StoreActions } from './store-actions';
import { StoreDispatch } from './store-dispatch';
import { kindLabel, methodDuration } from './store-format';
import { StoreHistory } from './store-history';
import { StoreLog } from './store-log';
import { StoreState } from './store-state';
import { StoreStats } from './store-stats';

/**
 * The shown store of the Store page: its head, the paused note, State, Computed, Methods and
 * Entities, then the history, log, stats, session and dispatch sections.
 */
@Component({
  selector: 'div[appStoreDetail]',
  imports: [
    SourceLink,
    StoreDispatch,
    StoreGlobal,
    StoreHistory,
    StoreLog,
    StoreSession,
    StoreStateTree,
    StoreStats,
  ],
  templateUrl: './store-detail.html',
  styleUrl: './store-detail.scss',
})
export class StoreDetail {
  private readonly state = inject(StoreState);
  private readonly actions = inject(StoreActions);
  private readonly latestButton = viewChild<ElementRef<HTMLButtonElement>>('latestButton');
  private readonly stateTree = viewChild(StoreStateTree);

  protected readonly rpc = this.state.rpc;
  protected readonly page = this.state.page;
  protected readonly store = this.state.store;
  protected readonly canRestore = this.state.canRestore;
  protected readonly restoreOff = this.state.restoreOff;
  protected readonly stateValue = this.state.stateValue;
  protected readonly changedPaths = this.state.changedPaths;
  protected readonly computedEntries = this.state.computedEntries;
  protected readonly storeStats = this.state.storeStats;
  protected readonly sessionEntries = this.state.sessionEntries;
  protected readonly busy = this.actions.busy;
  protected readonly kindLabel = kindLabel;
  protected readonly methodDuration = methodDuration;

  constructor() {
    this.actions.focusStateTree = () => this.stateTree()?.focus();
    afterRenderEffect(() => {
      const button = this.latestButton();
      if (!button || !this.actions.focusLatest() || this.busy()) return;
      this.actions.focusLatest.set(false);
      button.nativeElement.focus();
    });
  }

  protected backToLatest() {
    return this.actions.backToLatest();
  }

  protected copyState() {
    return this.state.copyState();
  }

  protected copyPath(path: string) {
    return this.state.copyPath(path);
  }

  protected entityIds(ids: (string | number)[]): (string | number)[] {
    return ids.slice(0, 30);
  }

  protected entityOverflowTitle(ids: (string | number)[], count: number): string {
    const overflow = ids.slice(30).join(', ');
    return count > ids.length ? `${overflow} (first ${ids.length} of ${count} shown)` : overflow;
  }

  protected prettyText(value: unknown) {
    return pretty(value);
  }

  protected shortText(value: unknown) {
    return short(value);
  }
}
