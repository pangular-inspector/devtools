import { Component, inject, output } from '@angular/core';
import { SourceLink } from '../../ui/source-link';
import { bare, type SourceComponent } from './component-model';
import { SourceScan } from './source-scan';

/** What the source declares, one row per component or directive, opened in place. */
@Component({
  selector: 'ul[appSourceList]',
  imports: [SourceLink],
  templateUrl: './source-list.html',
  styleUrl: './source-list.scss',
})
export class SourceList {
  private readonly scan = inject(SourceScan);
  readonly showForm = output<string>();

  protected readonly filteredSource = this.scan.filteredSource;
  protected readonly openKey = this.scan.openKey;

  protected formsIn(file: string) {
    return this.scan.formsIn(file);
  }

  protected sourceKey(comp: SourceComponent) {
    return this.scan.sourceKey(comp);
  }

  protected sourceLabel(comp: SourceComponent) {
    return this.scan.sourceLabel(comp);
  }

  protected bareName(name: string) {
    return bare(name);
  }
}
