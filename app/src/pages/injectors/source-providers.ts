import { Component, inject } from '@angular/core';
import { SourceLink } from '../../ui/source-link';
import { HELPER_TYPE } from './injector-model';
import { SourceScan } from './source-scan';

/** The providers the source scan found, by kind, shown while no page reports a live tree. */
@Component({
  selector: 'div[appSourceProviders]',
  imports: [SourceLink],
  templateUrl: './source-providers.html',
  styleUrl: './source-providers.scss',
})
export class SourceProviders {
  private readonly scan = inject(SourceScan);

  readonly helperType = HELPER_TYPE;
  readonly groupedProviders = this.scan.groupedProviders;
  readonly helpersOpen = this.scan.helpersOpen;
  readonly helpersShown = this.scan.helpersShown;
}
