import { Component, input, output } from '@angular/core';
import { HTTP_RULE_PRESETS } from '@pangular-inspector/devtools/internal/http-data';

/**
 * Buttons that add a built-in set of fault rules (Offline, Slow 3G, Flaky).
 * The parent saves them as plain rules, which then show in the rule list.
 */
@Component({
  selector: 'app-rule-presets',
  templateUrl: './rule-presets.html',
  styleUrl: './rule-presets.scss',
})
export class RulePresets {
  readonly disabled = input(false);
  /** Ids of text that explains why the buttons are off, added to each button's description. */
  readonly describedBy = input('');
  readonly add = output<string>();

  readonly presets = HTTP_RULE_PRESETS;
}
