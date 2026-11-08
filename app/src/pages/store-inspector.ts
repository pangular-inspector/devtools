import { Component, effect, inject, input, viewChild } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { SearchField } from '../ui/search-field';
import { Select } from '../ui/select';
import { rememberSelection } from '../view-memory';
import { StoreActions } from './store/store-actions';
import { StoreEvents } from './store/store-events';
import { StoreLive } from './store/store-live';
import { StoreSource } from './store/store-source';
import { StoreState } from './store/store-state';
import type { NgrxLogEntry } from './store-types';

/**
 * The Store page: the toolbar, and one section each for the live stores, the
 * `@ngrx/signals/events` events and the source declarations. The sections live in `./store/` and
 * share the page's {@link StoreState} and {@link StoreActions}; the page keeps the members its
 * tests and the shell read on itself.
 */
@Component({
  selector: 'app-store-inspector',
  imports: [SearchField, Select, StoreEvents, StoreLive, StoreSource],
  providers: [StoreState, StoreActions],
  templateUrl: './store-inspector.html',
  styleUrl: './store-inspector.scss',
})
export class StoreInspector {
  readonly rpc = input<DevframeRpcClient | null>(null);

  private readonly state = inject(StoreState);
  private readonly actions = inject(StoreActions);
  private readonly filterInput = viewChild<SearchField>('filterInput');

  readonly canRestore = this.state.canRestore;
  readonly filter = this.state.filter;
  readonly kind = this.state.kind;
  readonly sourceEntries = this.state.sourceEntries;
  readonly sourceLoaded = this.state.sourceLoaded;
  readonly pages = this.state.pages;
  readonly reduxPages = this.state.reduxPages;
  readonly allPages = this.state.allPages;
  readonly failed = this.state.failed;
  readonly stateLoaded = this.state.stateLoaded;
  readonly selectedPageId = this.state.selectedPageId;
  readonly angularPage = this.state.angularPage;
  readonly maxLog = this.state.maxLog;
  readonly selectedStoreId = this.state.selectedStoreId;
  readonly message = this.state.message;
  readonly page = this.state.page;
  readonly pageConnected = this.state.pageConnected;
  readonly reduxPage = this.state.reduxPage;
  readonly selectedChangeSeq = this.state.selectedChangeSeq;
  readonly selectedEventSeq = this.state.selectedEventSeq;
  readonly confirmSeq = this.state.confirmSeq;
  readonly pageOptions = this.state.pageOptions;
  readonly liveStores = this.state.liveStores;
  readonly filteredStores = this.state.filteredStores;
  readonly store = this.state.store;
  readonly stateText = this.state.stateText;
  readonly stateValue = this.state.stateValue;
  readonly changedPaths = this.state.changedPaths;
  readonly storeStats = this.state.storeStats;
  readonly hasLoop = this.state.hasLoop;
  readonly computedEntries = this.state.computedEntries;
  readonly logFeed = this.state.logFeed;
  readonly storeLog = this.state.storeLog;
  readonly sessionEntries = this.state.sessionEntries;
  readonly hasEvents = this.state.hasEvents;
  readonly pageEvents = this.state.pageEvents;
  readonly changeEntry = this.state.changeEntry;
  readonly eventEntry = this.state.eventEntry;
  readonly actionTypes = this.state.actionTypes;
  readonly usesSignals = this.state.usesSignals;
  readonly usesClassic = this.state.usesClassic;
  readonly filteredEntries = this.state.filteredEntries;
  readonly groupedEntries = this.state.groupedEntries;

  readonly busy = this.actions.busy;
  readonly confirmReset = this.actions.confirmReset;
  readonly dispatchType = this.actions.dispatchType;
  readonly dispatchPayload = this.actions.dispatchPayload;
  readonly payloadError = this.actions.payloadError;
  readonly dispatchRequest = this.actions.dispatchRequest;

  constructor() {
    this.state.connect(this.rpc);
    this.state.focusFilter = () => this.filterInput()?.focus();
    rememberSelection('store', this.selectedStoreId);
    effect(() => {
      const client = this.rpc();
      if (client) void this.state.load(client);
    });
  }

  load(client: DevframeRpcClient) {
    return this.state.load(client);
  }

  retry() {
    this.state.retry();
  }

  selectPage(pageId: string | null) {
    this.state.selectPage(pageId);
  }

  selectStore(id: string) {
    this.state.selectStore(id);
  }

  selectChange(seq: number) {
    this.state.selectChange(seq);
  }

  selectEvent(seq: number) {
    this.actions.selectEvent(seq);
  }

  copyState() {
    return this.state.copyState();
  }

  copyPath(path: string) {
    return this.state.copyPath(path);
  }

  copyDiff(entry: NgrxLogEntry) {
    return this.state.copyDiff(entry);
  }

  askRestore(seq: number) {
    this.actions.askRestore(seq);
  }

  cancelRestore(event?: Event) {
    this.actions.cancelRestore(event);
  }

  restore(seq: number, pauses: boolean) {
    return this.actions.restore(seq, pauses);
  }

  backToLatest() {
    return this.actions.backToLatest();
  }

  isSkipped(seq: number): boolean {
    return this.state.isSkipped(seq);
  }

  canToggle(entry: NgrxLogEntry): boolean {
    return this.state.canToggle(entry);
  }

  canAgain(entry: NgrxLogEntry): boolean {
    return this.state.canAgain(entry);
  }

  askReset() {
    this.actions.askReset();
  }

  cancelReset(event?: Event) {
    this.actions.cancelReset(event);
  }

  devtoolsOp(request: { op: string; seq?: number; index?: number; paused?: boolean }) {
    return this.actions.devtoolsOp(request);
  }

  dispatchAction(event: Event) {
    return this.actions.dispatchAction(event);
  }

  dispatchAgain(seq: number) {
    return this.actions.dispatchAgain(seq);
  }

  clearFilters() {
    this.state.clearFilters();
  }

  changeCount(id: string): number {
    return this.state.changeCount(id);
  }
}
