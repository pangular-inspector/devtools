import { Component, booleanAttribute, computed, input } from '@angular/core';
import {
  angularUnavailableText,
  lacksCapability,
  shortAngularVersion,
  type AngularCapability,
  type AngularPageInfo,
} from '@pangular-inspector/devtools/internal/config';

export const ANGULAR_COMPAT_DOCS_URL =
  'https://pangular-inspector.dev/getting-started/installation/#supported-angular-versions';

/**
 * Says that a view has no live data because the page's Angular lacks the debug
 * API part it needs, and names that part's version and the page's. Shows
 * nothing while the page has it or has not said (an older overlay).
 * `missing` marks it missing anyway, for a part the page has in a form too old
 * to use (the signal graph before 20.1).
 */
@Component({
  selector: 'app-angular-unavailable',
  template: `
    @if (text(); as message) {
      <div class="unavailable" [class.compact]="compact()" role="status">
        <p class="title">{{ title() }}</p>
        <p class="hint">
          {{ message }}
          <ng-content />
          <a [href]="docsUrl" target="_blank" rel="noopener noreferrer">Supported versions</a>
        </p>
      </div>
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
    }
    :host:empty {
      display: none;
    }
    .unavailable {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 0 0 12px;
      padding: 16px;
      @include m.panel;
      border-style: dashed;
    }
    .unavailable.compact {
      padding: 8px 12px;
    }
    .title {
      margin: 0;
      color: var(--text-strong);
      font-size: 14px;
      font-weight: 600;
    }
    .hint {
      margin: 0;
      color: var(--text-2);
      font-size: 13px;
      line-height: 1.55;
      overflow-wrap: anywhere;
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
export class AngularUnavailable {
  readonly page = input<AngularPageInfo | null | undefined>(null);
  readonly capability = input.required<AngularCapability>();
  readonly missing = input(false, { transform: booleanAttribute });
  readonly compact = input(false, { transform: booleanAttribute });
  protected readonly docsUrl = ANGULAR_COMPAT_DOCS_URL;

  readonly text = computed(() => {
    const page = this.page();
    if (!this.missing() && !lacksCapability(page, this.capability())) return null;
    return angularUnavailableText(this.capability(), page?.version);
  });

  readonly title = computed(() => {
    const version = this.page()?.version;
    return version
      ? `Not available on Angular ${shortAngularVersion(version)}`
      : 'Not available on this page';
  });
}
