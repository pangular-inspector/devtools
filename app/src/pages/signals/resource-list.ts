import { Component, inject } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { SignalDetail } from './signal-detail';
import { kindColor, statusTone } from './signal-model';
import { SignalState } from './signal-state';

/** The resources of the shown graph, each a card that opens its detail. */
@Component({
  selector: 'ul[appResourceList]',
  imports: [JsonPipe, SignalDetail],
  templateUrl: './resource-list.html',
  styleUrl: './resource-list.scss',
})
export class ResourceList {
  private readonly state = inject(SignalState);

  readonly filteredResources = this.state.filteredResources;
  readonly selectedId = this.state.selectedId;
  readonly kindColor = kindColor;
  readonly statusTone = statusTone;

  select(id: string) {
    this.state.select(id);
  }
}
