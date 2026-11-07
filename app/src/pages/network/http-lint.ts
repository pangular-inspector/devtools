import { Component, computed, input, output } from '@angular/core';
import {
  HTTP_LINT_DEFAULTS,
  lintHttp,
  type HttpLintKind,
  type LintCall,
} from '@pangular-inspector/devtools/internal/http-data';

const KIND_LABEL: Record<HttpLintKind, string> = {
  duplicate: 'Duplicate',
  waterfall: 'Waterfall',
  refetch: 'Repeated server call',
};

/**
 * Findings of the HTTP lint for the selected page: the same GET fired again
 * within a short window, calls that ran one after another and could start
 * together, and server calls the browser made again. The `lint-http` agent
 * tool runs the same checks.
 */
@Component({
  selector: 'app-http-lint',
  template: `
    <p class="intro">
      Same GET again within {{ defaults.duplicateWindowMs }} ms, {{ defaults.minChain }} or more
      calls in a row that could start together, and server calls the browser made again. Transfer
      cache hits, mocks and cancelled calls are left out.
    </p>
    @if (!calls().length) {
      <p class="none">No client calls to check yet.</p>
    } @else if (!findings().length) {
      <p class="none ok">No duplicate requests, waterfalls or repeated server calls.</p>
    } @else {
      <ul class="findings">
        @for (finding of findings(); track finding.kind + finding.callIds.join()) {
          <li>
            <span class="kind" [attr.data-kind]="finding.kind">{{ kindLabel(finding.kind) }}</span>
            <p class="message">
              {{ finding.message }}
              @if (finding.wastedMs) {
                <span class="cost">About {{ finding.wastedMs }} ms to win.</span>
              }
            </p>
            <p class="hint">{{ finding.hint }}</p>
            <button
              type="button"
              [attr.aria-label]="'Show the first call of: ' + finding.message"
              (click)="open.emit(finding.callIds[0])"
            >
              Show first call
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
    }
    .intro,
    .none,
    .hint {
      margin: 0;
      color: var(--text-2);
      font-size: 12px;
    }
    .none {
      margin-top: 8px;
    }
    .findings {
      display: grid;
      gap: 8px;
      margin: 10px 0 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 4px 12px;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
    }
    .kind {
      @include m.label;
      grid-column: 1;
    }
    .message {
      grid-column: 1;
      margin: 0;
      color: var(--text);
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    .cost {
      color: var(--text-2);
    }
    .hint {
      grid-column: 1;
    }
    button {
      grid-column: 2;
      grid-row: 1 / span 3;
      align-self: center;
      height: 28px;
      padding: 0 10px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      font-size: 12px;
      white-space: nowrap;
      cursor: pointer;
      transition: background-color 0.2s var(--ease);
      &:hover {
        background: var(--surface-3);
      }
      &:focus-visible {
        @include m.focus-ring;
      }
    }
    @media (max-width: 640px) {
      li {
        grid-template-columns: minmax(0, 1fr);
      }
      button {
        grid-column: 1;
        grid-row: auto;
        justify-self: start;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        transition: none;
      }
    }
  `,
})
export class HttpLint {
  /** The selected page's client calls. */
  readonly calls = input<readonly LintCall[]>([]);
  /** The SSR calls of the render that served the page. */
  readonly serverCalls = input<readonly LintCall[]>([]);
  /** Asks the parent to open a call in the preview. */
  readonly open = output<string>();

  readonly defaults = HTTP_LINT_DEFAULTS;

  readonly findings = computed(() => lintHttp(this.calls(), { serverCalls: this.serverCalls() }));

  kindLabel(kind: HttpLintKind): string {
    return KIND_LABEL[kind];
  }
}
