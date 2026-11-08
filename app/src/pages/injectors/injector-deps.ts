import { Component, inject, input } from '@angular/core';
import { NULL_ID, toneOf, type InjectorNode } from './injector-model';
import { InjectorsState } from './injectors-state';

/**
 * The "Injected here" block of the injector detail: each dependency, the injector that provides
 * it, and how Angular resolves it along the lookup path.
 */
@Component({
  selector: 'div[appInjectorDeps]',
  templateUrl: './injector-deps.html',
  styleUrl: './injector-deps.scss',
})
export class InjectorDeps {
  private readonly state = inject(InjectorsState);

  readonly node = input.required<InjectorNode>();

  readonly nullId = NULL_ID;
  readonly resolvingKey = this.state.resolvingKey;

  depKey(dep: { from: string; token: string; tokenId?: string }, index: number): string {
    return this.state.depKey(dep, index);
  }

  toggleResolve(key: string) {
    this.state.toggleResolve(key);
  }

  /**
   * The lookup path of the selected injector, read for one dependency: the
   * steps Angular asked before the injector that provides the token, that
   * injector, and the steps it never reached. `self` stops after the first
   * step, `skipSelf` skips it, and a token nobody provides goes on to the null
   * injector, which throws unless the dependency is optional.
   */
  resolution(dep: { flags: string[]; providedBy: string | null }) {
    const steps = this.state.path();
    const at = dep.providedBy ? steps.findIndex((step) => step.id === dep.providedBy) : -1;
    const self = dep.flags.includes('self');
    const skipSelf = dep.flags.includes('skipSelf');
    const optional = dep.flags.includes('optional');
    return steps.map((step, index) => {
      let state: 'asked' | 'provides' | 'skipped' | 'not-asked' | 'throws' | 'null';
      if (index === 0 && skipSelf) state = 'skipped';
      else if (at >= 0) state = index < at ? 'asked' : index === at ? 'provides' : 'not-asked';
      else if (self && index > (skipSelf ? 1 : 0)) state = 'not-asked';
      else if (step.id === NULL_ID) state = optional ? 'null' : 'throws';
      else state = 'asked';
      const text = {
        asked: 'asked, not here',
        provides: 'provides it',
        skipped: 'skipped (skipSelf)',
        'not-asked': 'not asked',
        throws: 'throws NullInjectorError',
        null: 'gives null (optional)',
      }[state];
      return { ...step, state, text };
    });
  }

  matches(token: string) {
    return this.state.matches(token);
  }

  reveal(id: string) {
    this.state.reveal(id);
  }

  tone(kind: string) {
    return toneOf(kind);
  }

  kindById(id: string) {
    return this.state.kindById(id);
  }

  labelById(id: string) {
    return this.state.labelById(id);
  }
}
