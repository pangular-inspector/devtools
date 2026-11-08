import { Component, inject } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { SignalDetail } from './signal-detail';
import { kindColor, type SignalNode } from './signal-model';
import { SignalState } from './signal-state';

/** The signals of the shown graph, each a card that opens its detail, or the no-match state. */
@Component({
  selector: 'ul[appSignalList]',
  imports: [JsonPipe, SignalDetail],
  templateUrl: './signal-list.html',
  styleUrl: './signal-list.scss',
})
export class SignalList {
  private readonly state = inject(SignalState);

  readonly filteredNodes = this.state.filteredNodes;
  readonly selectedId = this.state.selectedId;
  readonly selectedNode = this.state.selectedNode;
  readonly watchedIds = this.state.watchedIds;
  readonly hasAnySignals = this.state.hasAnySignals;
  readonly filter = this.state.filter;
  readonly kind = this.state.kind;
  readonly kindColor = kindColor;

  select(id: string) {
    this.state.select(id);
  }

  changeCount(id: string): number {
    return this.state.changeCount(id);
  }

  getDependencies(node: SignalNode): SignalNode[] {
    return this.state.getDependencies(node);
  }

  getConsumers(node: SignalNode): SignalNode[] {
    return this.state.getConsumers(node);
  }

  clearFilters() {
    this.state.clearFilters();
  }
}
