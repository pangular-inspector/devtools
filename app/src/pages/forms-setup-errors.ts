import { Component, input } from '@angular/core';
import type { FormSetupError } from './forms-types';

/** The notice listing the forms setup errors (NG01xxx) Angular logged on the shown pages. */
@Component({
  selector: 'app-forms-setup-errors',
  template: `
    <div class="setup-errors" role="status">
      <p class="setup-title">
        Angular reported {{ errors().length }} forms setup
        {{ errors().length === 1 ? 'error' : 'errors' }}
      </p>
      <p class="setup-hint">
        A form with a setup error can be missing from the list or behave unlike its template. Check
        the directives and value accessors it names.
      </p>
      <ul>
        @for (error of errors(); track $index) {
          <li>
            <code>{{ error.message }}</code>
            @if (showPages()) {
              <span class="setup-page">on page {{ error.pageId }}</span>
            }
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
    }
    .setup-errors {
      display: grid;
      gap: 4px;
      margin: 0 0 12px;
      padding: 10px 12px;
      border: 1px solid;
      @include m.tint(warn);
      border-radius: var(--radius-sm);
      font-size: 13px;
      line-height: 1.5;
    }
    .setup-errors p {
      margin: 0;
    }
    .setup-title {
      font-weight: 600;
    }
    .setup-errors ul {
      display: grid;
      gap: 2px;
      margin: 0;
      padding: 0 0 0 16px;
      min-width: 0;
    }
    .setup-errors code {
      font-family: var(--font-mono);
      font-size: 12.5px;
      overflow-wrap: anywhere;
    }
    .setup-page {
      margin-left: 6px;
    }
  `,
})
export class FormsSetupErrors {
  readonly errors = input.required<FormSetupError[]>();
  /** Errors come from more than one page, so each names its page. */
  readonly showPages = input(false);
}
