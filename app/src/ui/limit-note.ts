import { Component, input } from '@angular/core';
import type { PangularLimit } from '@pangular-inspector/devtools/config';

export const LIMITS_DOCS_URL =
  'https://pangular-inspector.dev/getting-started/configuration/#limits';

/** Says that a capped timeline dropped its oldest entries, and which limit to raise. */
@Component({
  selector: 'app-limit-note',
  template: `
    @if (dropped() > 0) {
      <p class="note">
        Showing the latest {{ max() }} {{ what() }}. {{ dropped() }} older
        {{ dropped() === 1 ? 'entry was' : 'entries were' }} dropped. Raise
        <code>limits.{{ limit() }}</code> to keep more.
        <a [href]="docsUrl" target="_blank" rel="noopener noreferrer">About limits</a>
      </p>
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
    }
    .note {
      margin: 0 0 12px;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text-2);
      line-height: 1.5;
    }
    code {
      font-family: var(--font-mono);
      color: var(--text);
    }
    a {
      color: var(--accent);
      border-radius: 2px;
    }
    a:focus-visible {
      @include m.focus-ring;
    }
  `,
})
export class LimitNote {
  readonly dropped = input(0);
  readonly max = input.required<number>();
  readonly what = input.required<string>();
  readonly limit = input.required<PangularLimit>();
  protected readonly docsUrl = LIMITS_DOCS_URL;
}
