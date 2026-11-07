import { Component, computed, input } from '@angular/core';

type CallOrigin = 'httpResource' | 'resource' | 'defer';

const LABEL: Record<CallOrigin, string> = {
  httpResource: 'httpResource()',
  resource: 'resource()',
  defer: '@defer',
};

/**
 * A timeline tag that names the Angular API that likely started a call. The
 * overlay guesses it from the call stack, so the tag says "likely".
 */
@Component({
  selector: 'app-call-origin',
  template: `@if (origin()) {
    <span class="tag" [title]="title()">likely {{ label() }}</span>
  }`,
  styles: `
    :host {
      display: contents;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      height: 20px;
      padding: 0 8px;
      border: 1px dashed var(--border-strong);
      border-radius: 99px;
      background: var(--surface-3);
      color: var(--text-2);
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }
  `,
})
export class CallOriginTag {
  readonly origin = input<CallOrigin | undefined>(undefined);

  readonly label = computed(() => {
    const origin = this.origin();
    return origin ? LABEL[origin] : '';
  });
  readonly title = computed(
    () =>
      `Started by ${this.label()}, guessed from the call stack. Development builds only; it can miss.`,
  );
}
