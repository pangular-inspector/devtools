import { Component, inject } from '@angular/core';
import { AngularUnavailable } from '../../ui/angular-unavailable';
import { AppState } from '../../ui/app-state';
import { StoreDetail } from './store-detail';
import { kindColor, kindLabel } from './store-format';
import { StoreState } from './store-state';

/** The Live stores section of the Store page: its states, the store list and the shown store. */
@Component({
  selector: 'section[appStoreLive]',
  imports: [AngularUnavailable, AppState, StoreDetail],
  templateUrl: './store-live.html',
  styleUrl: './store-live.scss',
})
export class StoreLive {
  private readonly state = inject(StoreState);

  protected readonly failed = this.state.failed;
  protected readonly stateLoaded = this.state.stateLoaded;
  protected readonly page = this.state.page;
  protected readonly angularPage = this.state.angularPage;
  protected readonly liveStores = this.state.liveStores;
  protected readonly filteredStores = this.state.filteredStores;
  protected readonly store = this.state.store;
  protected readonly usesSignals = this.state.usesSignals;
  protected readonly usesClassic = this.state.usesClassic;
  protected readonly message = this.state.message;
  protected readonly kindColor = kindColor;
  protected readonly kindLabel = kindLabel;

  protected retry() {
    this.state.retry();
  }

  protected selectStore(id: string) {
    this.state.selectStore(id);
  }

  protected countText(item: Parameters<StoreState['countText']>[0]) {
    return this.state.countText(item);
  }
}
