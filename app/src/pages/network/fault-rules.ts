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
  templateUrl: './fault-rules.html',
  styleUrl: './fault-rules.scss',
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
