import { Component, inject } from '@angular/core';
import { Select } from '../../ui/select';
import {
  HTTP_STATUS_OPTIONS,
  mocksOnServer,
  statusTone,
  targetLabel,
  type HttpRule,
  type RuleDraft,
} from './http-model';
import { NetworkState } from './network-state';
import { RuleMatchCount } from './rule-match-count';
import { RulePresets } from './rule-presets';
import { RuleState } from './rule-state';
import type { SelectOption } from '../../ui/select';

/** The fault injection section of the Network page: presets, the rule form and the rule list. */
@Component({
  selector: 'section[appFaultRules]',
  imports: [RuleMatchCount, RulePresets, Select],
  template: `
    <h2 id="rules-heading">Fault injection</h2>
    @if (!canWrite()) {
      <p id="http-writes-off" class="muted small">{{ writesOff }}</p>
    }
    <app-rule-presets
      [disabled]="!canWrite()"
      [describedBy]="canWrite() ? '' : 'http-writes-off'"
      (add)="addPreset($event)"
    />
    <form id="rule-form" class="rule-form" (submit)="addRule($event)">
      <label>
        <span>URL pattern <span class="hint">(substring or * glob, ^ anchors the path)</span></span>
        <input
          id="rule-pattern"
          required
          spellcheck="false"
          autocomplete="off"
          [value]="draft().pattern"
          (input)="patch('pattern', $event)"
          placeholder="e.g. /api/products"
        />
      </label>
      <app-rule-match-count
        [calls]="timeline()"
        [pattern]="draft().pattern"
        [method]="draft().method"
        [target]="draft().target"
      />
      <div class="row">
        <div class="field-group">
          <span id="rule-method-label">Method</span>
          <app-select
            labelledBy="rule-method-label"
            [options]="methodOptions()"
            [value]="draft().method"
            (valueChange)="setDraft('method', $event ?? '')"
          />
        </div>
        <div class="field-group">
          <span id="rule-target-label">Apply on</span>
          <app-select
            labelledBy="rule-target-label"
            [describedBy]="draftMocksOnServer() ? 'rule-ssr-note' : ''"
            [options]="targetOptions"
            [value]="draft().target"
            (valueChange)="setDraft('target', $event ?? 'both')"
          />
        </div>
      </div>
      <div class="row">
        <div class="field-group">
          <span id="rule-status-label">Status</span>
          <app-select
            labelledBy="rule-status-label"
            [describedBy]="draftMocksOnServer() ? 'rule-ssr-note' : ''"
            [options]="statusOptions"
            [value]="draft().status"
            (valueChange)="setDraft('status', $event ?? '')"
          />
        </div>
        <label>
          Delay (ms)
          <input
            type="number"
            inputmode="numeric"
            min="0"
            max="10000"
            placeholder="0"
            [value]="draft().delayMs"
            (input)="patch('delayMs', $event)"
          />
        </label>
      </div>
      <label>
        <span>Chance (%) <span class="hint">(optional, share of matching requests)</span></span>
        <input
          id="rule-chance"
          type="number"
          inputmode="numeric"
          min="1"
          max="99"
          step="1"
          placeholder="100"
          [value]="draft().chance"
          (input)="patch('chance', $event)"
        />
      </label>
      <label>
        <span>Mock JSON body <span class="hint">(optional)</span></span>
        <textarea
          rows="3"
          spellcheck="false"
          [placeholder]="bodyPlaceholder"
          [value]="draft().body"
          (input)="patch('body', $event)"
          [attr.aria-invalid]="bodyError() ? 'true' : null"
          aria-describedby="body-error"
        ></textarea>
      </label>
      <p id="body-error" class="field-error">{{ bodyError() }}</p>
      @if (draftMocksOnServer()) {
        <p id="rule-ssr-note" class="muted small">
          SSR mocks are not transferred to the client: the browser requests the URL again and gets
          the real response unless the rule also applies on the client.
        </p>
      }
      <p id="rule-hint" class="muted small">{{ draftHint() }}</p>
      <div class="form-actions">
        <button
          type="submit"
          [disabled]="!canWrite() || !draftRule()"
          [attr.aria-disabled]="addingRule() || null"
          [attr.aria-describedby]="canWrite() ? 'rule-hint' : 'http-writes-off'"
        >
          Add rule
        </button>
      </div>
    </form>

    <h3 id="rule-list-heading" class="rules-heading" tabindex="-1">Rules ({{ rules().length }})</h3>
    <ul class="rules">
      @for (rule of rules(); track rule.id) {
        <li [class.off]="!rule.enabled">
          <label class="inline">
            <input
              type="checkbox"
              [checked]="rule.enabled"
              [disabled]="!canWrite()"
              [attr.aria-describedby]="canWrite() ? null : 'http-writes-off'"
              (change)="toggleRule(rule.id)"
              [attr.aria-label]="'Enable rule for ' + rule.pattern"
            />
            <code class="rule-pattern" [title]="rule.pattern"
              ><span class="rule-method">{{ rule.method || 'ANY' }}</span> {{ rule.pattern }}</code
            >
          </label>
          <button
            type="button"
            class="link remove"
            data-remove-rule
            [disabled]="!canWrite()"
            [attr.aria-describedby]="canWrite() ? null : 'http-writes-off'"
            (click)="removeRule(rule.id)"
            [attr.aria-label]="'Remove rule for ' + rule.pattern"
          >
            Remove
          </button>
          <span class="rule-meta">
            <span>{{ targetLabel(rule.target) }}</span>
            @if (rule.status === undefined) {
              <span>passthrough</span>
            } @else if (rule.status === 0) {
              <span class="status bad">network error</span>
            } @else {
              <span
                class="status"
                [class.ok]="statusTone(rule.status) === 'ok'"
                [class.redirect]="statusTone(rule.status) === 'redirect'"
                [class.bad]="statusTone(rule.status) === 'bad'"
                >{{ rule.status }}</span
              >
            }
            @if (rule.delayMs) {
              <span>{{ rule.delayMs }} ms</span>
            }
            @if (rule.body) {
              <span>mock body</span>
            }
            @if (rule.chance) {
              <span>{{ rule.chance }}% of requests</span>
            }
          </span>
          @if (mocksOnServer(rule)) {
            <p class="rule-note">
              The SSR mock is not written to TransferState, so the browser requests this URL again.
            </p>
          }
        </li>
      } @empty {
        <li class="empty-rule">No rules. SSR rules apply on the next page load.</li>
      }
    </ul>
  `,
  styles: `
    @use 'network' as net;

    @include net.controls;
    @include net.status;
    @include net.rule-form;
  `,
})
export class FaultRules {
  private readonly state = inject(NetworkState);
  private readonly ruleState = inject(RuleState);
  protected readonly canWrite = this.state.canWrite;
  protected readonly writesOff = this.state.writesOff;
  protected readonly timeline = this.state.timeline;
  protected readonly rules = this.state.rules;
  protected readonly draft = this.ruleState.draft;
  protected readonly draftRule = this.ruleState.draftRule;
  protected readonly draftHint = this.ruleState.draftHint;
  protected readonly draftMocksOnServer = this.ruleState.draftMocksOnServer;
  protected readonly bodyError = this.ruleState.bodyError;
  protected readonly addingRule = this.ruleState.addingRule;
  protected readonly methodOptions = this.ruleState.methodOptions;
  protected readonly bodyPlaceholder = '{ "error": "Service unavailable" }';
  protected readonly statusOptions = HTTP_STATUS_OPTIONS;
  protected readonly targetOptions: SelectOption<HttpRule['target']>[] = [
    { value: 'both', label: 'SSR + client' },
    { value: 'server', label: 'SSR only' },
    { value: 'client', label: 'Client only' },
  ];

  protected readonly mocksOnServer = mocksOnServer;
  protected readonly statusTone = statusTone;
  protected readonly targetLabel = targetLabel;

  protected setDraft<K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) {
    this.ruleState.setDraft(key, value);
  }

  protected patch(key: keyof RuleDraft, event: Event) {
    this.ruleState.patch(key, event);
  }

  protected addRule(event: Event) {
    void this.ruleState.addRule(event);
  }

  protected addPreset(id: string) {
    void this.ruleState.addPreset(id);
  }

  protected toggleRule(id: string) {
    this.ruleState.toggleRule(id);
  }

  protected removeRule(id: string) {
    void this.ruleState.removeRule(id);
  }
}
