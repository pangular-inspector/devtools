import { Component, computed, input } from '@angular/core';
import { countRedacted } from '@pangular-inspector/devtools/internal/redaction-count';

/**
 * Says how many values the redaction masked in what a view shows, such as
 * "3 values masked". It counts the masks in `value` once per new value, and
 * shows nothing when there are none.
 */
@Component({
  selector: 'app-redaction-count',
  template: `
    @if (result().count > 0) {
      <p class="count" data-redaction-count>
        {{ result().capped ? 'At least ' : '' }}{{ result().count }}
        {{ result().count === 1 ? 'value' : 'values' }} masked
        <span class="why">{{ why() }}</span>
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .count {
      margin: 0 0 8px;
      color: var(--text-2);
      font-size: 12px;
      line-height: 1.5;
      font-variant-numeric: tabular-nums;
    }
    .why {
      color: var(--text-2);
    }
  `,
})
export class RedactionCount {
  /** What the view shows, already masked by the server or the page. */
  readonly value = input<unknown>(undefined);
  /** The second half of the line, saying where the masks come from. */
  readonly why = input('by redaction (secret names, tokens and emails).');

  protected readonly result = computed(() => countRedacted(this.value()));
}
