import { Component, inject } from '@angular/core';
import { SourceLink } from '../../ui/source-link';
import { SourceScan } from './source-scan';

/** The "never injected" hint: providers the source declares that nothing on the page injected. */
@Component({
  selector: 'div[appInjectorOrphans]',
  imports: [SourceLink],
  templateUrl: './injector-orphans.html',
  styleUrl: './injector-orphans.scss',
})
export class InjectorOrphans {
  private readonly scan = inject(SourceScan);

  readonly orphaned = this.scan.orphaned;
  readonly orphansOpen = this.scan.orphansOpen;
  readonly orphanedText = this.scan.orphanedText;
}
