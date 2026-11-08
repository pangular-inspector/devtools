import { Component, inject } from '@angular/core';
import { SourceLink } from '../../ui/source-link';
import { describe, ms, sourceLabel } from './pipes-model';
import { PipesState } from './pipes-state';

/** The detail panel of the Pipes page: the selected pipe's declaration, template uses and live
 * data, or a prompt to pick one. */
@Component({
  selector: 'section[appPipeDetail]',
  imports: [SourceLink],
  templateUrl: './pipe-detail.html',
  styleUrl: './pipe-detail.scss',
})
export class PipeDetail {
  private readonly state = inject(PipesState);

  protected readonly ms = ms;
  protected readonly describe = describe;
  protected readonly sourceLabel = sourceLabel;
  protected readonly selected = this.state.selected;
  protected readonly instrumenting = this.state.instrumenting;

  protected liveFor(name: string) {
    return this.state.liveFor(name);
  }
  protected highlight(...args: Parameters<PipesState['highlight']>) {
    this.state.highlight(...args);
  }
}
