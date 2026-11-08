import { Component, inject, output } from '@angular/core';
import { plural } from '../../format';
import { RovingList } from '../../ui/roving-list';
import { ms } from './pipes-model';
import { PipesState } from './pipes-state';

/** The pipe list of the Pipes page, or the no-match state when the filters hide every pipe. */
@Component({
  selector: 'div[appPipeList]',
  imports: [RovingList],
  templateUrl: './pipe-list.html',
  styleUrl: './pipe-list.scss',
})
export class PipeList {
  private readonly state = inject(PipesState);
  /** Asks the page to clear the filters and focus the filter field. */
  readonly clear = output<void>();

  protected readonly plural = plural;
  protected readonly ms = ms;
  protected readonly filtered = this.state.filtered;
  protected readonly filter = this.state.filter;

  protected liveFor(name: string) {
    return this.state.liveFor(name);
  }
  protected isSelected(...args: Parameters<PipesState['isSelected']>) {
    return this.state.isSelected(...args);
  }
  protected select(...args: Parameters<PipesState['select']>) {
    this.state.select(...args);
  }
  protected highlightPipe(...args: Parameters<PipesState['highlightPipe']>) {
    this.state.highlightPipe(...args);
  }
  protected highlight(...args: Parameters<PipesState['highlight']>) {
    this.state.highlight(...args);
  }
  protected clearFilters() {
    this.clear.emit();
  }
}
