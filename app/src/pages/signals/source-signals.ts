import { Component, inject } from '@angular/core';
import { SourceLink } from '../../ui/source-link';
import { kindColor } from './signal-model';
import { SignalState } from './signal-state';

/** The signals the source scan found, shown while no live graph is in. */
@Component({
  selector: 'div[appSourceSignals]',
  imports: [SourceLink],
  templateUrl: './source-signals.html',
  styleUrl: './source-signals.scss',
})
export class SourceSignals {
  private readonly state = inject(SignalState);

  readonly filteredSourceSignals = this.state.filteredSourceSignals;
  readonly kindColor = kindColor;

  clearFilters() {
    this.state.clearFilters();
  }
}
