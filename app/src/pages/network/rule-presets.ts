import { Component, input, output } from '@angular/core';
import { HTTP_RULE_PRESETS } from '@pangular-inspector/devtools/internal/http-data';

/**
 * Buttons that add a built-in set of fault rules (Offline, Slow 3G, Flaky).
 * The parent saves them as plain rules, which then show in the rule list.
 */
@Component({
  selector: 'app-rule-presets',
  template: `
    <div class="presets" role="group" aria-labelledby="rule-presets-label">
      <span id="rule-presets-label" class="label">Presets</span>
      <ul>
        @for (preset of presets; track preset.id) {
          <li>
            <button
              type="button"
              class="ghost"
              [attr.data-preset]="preset.id"
              [disabled]="disabled()"
              [attr.aria-describedby]="'preset-' + preset.id + ' ' + describedBy()"
              (click)="add.emit(preset.id)"
            >
              {{ preset.label }}
            </button>
            <span class="what" [id]="'preset-' + preset.id">{{ preset.description }}</span>
          </li>
        }
      </ul>
      <p class="note">
        A preset adds plain rules for every browser request. Rules above it match first. Remove the
        rules to stop it.
      </p>
    </div>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
      margin-bottom: 12px;
    }
    .label {
      @include m.label;
      display: block;
      margin-bottom: 6px;
    }
    ul {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: grid;
      grid-template-columns: 7.5em minmax(0, 1fr);
      align-items: center;
      gap: 8px;
    }
    button {
      height: var(--control-h);
      padding: 0 10px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      font: inherit;
      cursor: pointer;
      transition: background-color 150ms var(--ease);
      &:hover:not(:disabled) {
        background: var(--surface-2);
      }
      &:focus-visible {
        @include m.focus-ring;
      }
      &:disabled {
        cursor: not-allowed;
        color: var(--text-2);
      }
    }
    .what,
    .note {
      color: var(--text-2);
      font-size: 12px;
    }
    .note {
      margin: 6px 0 0;
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        transition: none;
      }
    }
  `,
})
export class RulePresets {
  readonly disabled = input(false);
  /** Ids of text that explains why the buttons are off, added to each button's description. */
  readonly describedBy = input('');
  readonly add = output<string>();

  readonly presets = HTTP_RULE_PRESETS;
}
