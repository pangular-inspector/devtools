import { Component, inject } from '@angular/core';
import { NetworkState } from './network-state';

/** The hydration stats, mismatches and warnings of the page selected on the Network page. */
@Component({
  selector: 'section[appHydrationStats]',
  templateUrl: './hydration-stats.html',
  styleUrl: './hydration-stats.scss',
})
export class HydrationStats {
  protected readonly selected = inject(NetworkState).selected;
}
