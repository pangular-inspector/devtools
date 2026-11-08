import { Component, computed, input } from '@angular/core';
import { callsMatchingRule, type RuleScope } from '@pangular-inspector/devtools/internal/http-data';

/** The fields of a recorded call the count reads. */
export interface MatchCountCall {
  url: string;
  method: string;
  side: 'client' | 'server';
}

/**
 * How many of the recorded calls the fault rule being typed would apply to,
 * updated on each keystroke. It counts the calls the timeline holds for the
 * selected page and the server render that served it.
 */
@Component({
  selector: 'app-rule-match-count',
  templateUrl: './rule-match-count.html',
  styleUrl: './rule-match-count.scss',
})
export class RuleMatchCount {
  readonly calls = input<readonly MatchCountCall[]>([]);
  readonly pattern = input('');
  readonly method = input('');
  readonly target = input<RuleScope['target']>('both');

  /** Matching calls, or null while there is no pattern to check. */
  readonly matched = computed(() => {
    const pattern = this.pattern().trim();
    if (!pattern) return null;
    return callsMatchingRule(this.calls(), {
      pattern,
      method: this.method() || undefined,
      target: this.target(),
    }).length;
  });

  readonly text = computed(() => {
    const matched = this.matched();
    if (matched === null) return '';
    const total = this.calls().length;
    if (!total) return 'No calls recorded yet to check the pattern against.';
    if (total === 1) {
      return matched
        ? 'Matches the only recorded call.'
        : 'Does not match the only recorded call. It can still match later requests.';
    }
    const calls = `${total} recorded calls`;
    if (matched === 0) return `Matches none of the ${calls}. It can still match later requests.`;
    return matched === total ? `Matches all ${calls}.` : `Matches ${matched} of the ${calls}.`;
  });
}
