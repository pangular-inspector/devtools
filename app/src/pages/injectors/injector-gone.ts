import { Component, inject, input } from '@angular/core';
import { labelOf, type InjectorNode } from './injector-model';
import { InjectorsState } from './injectors-state';

/** The detail of a chosen injector that has left the page, with a way back to the first row. */
@Component({
  selector: 'section[appInjectorGone]',
  templateUrl: './injector-gone.html',
  styleUrl: './injector-gone.scss',
})
export class InjectorGone {
  private readonly state = inject(InjectorsState);

  /** The label the injector had while it was on the page. */
  readonly name = input.required<string>();
  readonly rows = this.state.rows;

  reveal(id: string) {
    this.state.reveal(id);
  }

  label(node: InjectorNode) {
    return labelOf(node);
  }
}
