import { Component, inject, input, output } from '@angular/core';
import { InjectorDeps } from './injector-deps';
import { kindOf, labelOf, NULL_ID, toneOf, type InjectorNode } from './injector-model';
import { InjectorProviders } from './injector-providers';
import { InjectorsState } from './injectors-state';

/**
 * The detail of the selected injector: its kind and classes, the lookup path, what it injects
 * and what it provides.
 */
@Component({
  selector: 'section[appInjectorDetail]',
  imports: [InjectorDeps, InjectorProviders],
  templateUrl: './injector-detail.html',
  styleUrl: './injector-detail.scss',
})
export class InjectorDetail {
  private readonly state = inject(InjectorsState);

  readonly node = input.required<InjectorNode>();
  /** Whether the Components tab is on, so "Show in Components" can open it. */
  readonly canShowComponent = input(false);
  /** The component id of the element injector to open in the Components tab. */
  readonly showComponent = output<string>();

  readonly nullId = NULL_ID;
  readonly path = this.state.path;

  openComponent(componentId: string) {
    this.showComponent.emit(componentId);
  }

  reveal(id: string) {
    this.state.reveal(id);
  }

  label(node: InjectorNode) {
    return labelOf(node);
  }

  kind(node: InjectorNode) {
    return kindOf(node);
  }

  tone(kind: string) {
    return toneOf(kind);
  }
}
