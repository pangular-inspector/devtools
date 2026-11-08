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
  templateUrl: './call-origin.html',
  styleUrl: './call-origin.scss',
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
