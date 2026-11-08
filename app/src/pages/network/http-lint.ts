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
  templateUrl: './http-lint.html',
  styleUrl: './http-lint.scss',
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
