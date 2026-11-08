import { Component, inject } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { sourceLabel, type SignalNode } from './signal-model';
import { SignalState } from './signal-state';

/** The watched signals of the Signals page and the newest changes they logged. */
@Component({
  selector: 'section[appWatchedSignals]',
  imports: [DatePipe, JsonPipe],
  templateUrl: './watched-signals.html',
  styleUrl: './watched-signals.scss',
})
export class WatchedSignals {
  private readonly state = inject(SignalState);

  readonly watchedNodes = this.state.watchedNodes;
  readonly watchedElsewhere = this.state.watchedElsewhere;
  readonly watchLog = this.state.watchLog;
  readonly sourceLabel = sourceLabel;

  changeCount(id: string): number {
    return this.state.changeCount(id);
  }

  toggleWatch(node: SignalNode) {
    this.state.toggleWatch(node);
  }
}
