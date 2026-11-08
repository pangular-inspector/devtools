import { Component, inject } from '@angular/core';
import { PipesState } from './pipes-state';

/** The `| async` subscriptions on the page, with possible duplicates and resubscribing sources. */
@Component({
  selector: 'section[appPipeAsync]',
  templateUrl: './pipe-async.html',
  styleUrl: './pipe-async.scss',
})
export class PipeAsync {
  private readonly state = inject(PipesState);

  protected readonly async = this.state.async;
  protected readonly asyncTotal = this.state.asyncTotal;

  protected highlight(...args: Parameters<PipesState['highlight']>) {
    this.state.highlight(...args);
  }
}
