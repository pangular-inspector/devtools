import { Component, inject } from '@angular/core';
import { SourceLink } from '../../ui/source-link';
import { PipesState } from './pipes-state';

/** The pipe lint findings, each with a link to the pipe it is about when the pipe is listed. */
@Component({
  selector: 'section[appPipeLint]',
  imports: [SourceLink],
  templateUrl: './pipe-lint.html',
  styleUrl: './pipe-lint.scss',
})
export class PipeLint {
  private readonly state = inject(PipesState);

  protected readonly lint = this.state.lint;
  protected readonly lintFailed = this.state.lintFailed;

  protected pipeFor(...args: Parameters<PipesState['pipeFor']>) {
    return this.state.pipeFor(...args);
  }
  protected showPipe(...args: Parameters<PipesState['showPipe']>) {
    this.state.showPipe(...args);
  }
}
