import { Component, inject } from '@angular/core';
import { SourceLink } from '../../ui/source-link';
import { kindColor, kindLabel } from './store-format';
import { StoreState } from './store-state';

/** The Source declarations section: the NgRx declarations the source scan found. */
@Component({
  selector: 'section[appStoreSource]',
  imports: [SourceLink],
  templateUrl: './store-source.html',
  styleUrl: './store-source.scss',
})
export class StoreSource {
  private readonly state = inject(StoreState);

  protected readonly sourceEntries = this.state.sourceEntries;
  protected readonly sourceLoaded = this.state.sourceLoaded;
  protected readonly kind = this.state.kind;
  protected readonly groupedEntries = this.state.groupedEntries;
  protected readonly filteredEntries = this.state.filteredEntries;
  protected readonly kindColor = kindColor;
  protected readonly kindLabel = kindLabel;

  protected clearFilters() {
    this.state.clearFilters();
  }
}
