import { Injectable, computed, inject, signal } from '@angular/core';
import { isHttpRuleStatus } from '@pangular-inspector/devtools/internal/config';
import { presetRules } from '@pangular-inspector/devtools/internal/http-data';
import { rpcCall as call } from '../../rpc';
import type { SelectOption } from '../../ui/select';
import {
  EMPTY_DRAFT,
  MAX_BODY,
  MAX_PATTERN,
  MAX_RULES,
  STANDARD_METHODS,
  chanceOf,
  jsonBody,
  mockPattern,
  mocksOnServer,
  newRuleId,
  type HttpCall,
  type HttpRule,
  type RuleDraft,
} from './http-model';
import { NetworkState } from './network-state';

/** The fault rule form and the rule list: the draft, its checks, and the saves to the server. */
@Injectable()
export class RuleState {
  private readonly state = inject(NetworkState);

  readonly draft = signal<RuleDraft>({ ...EMPTY_DRAFT });
  /** True while an added rule is being saved, so Add can't send it twice. */
  readonly addingRule = signal(false);
  private ruleSaves = Promise.resolve(true);

  readonly draftMocksOnServer = computed(() => {
    const rule = this.draftRule();
    return !!rule && mocksOnServer(rule);
  });

  readonly draftRule = computed<Omit<HttpRule, 'id'> | null>(() => {
    const draft = this.draft();
    const pattern = draft.pattern.trim();
    if (!pattern || pattern.length > MAX_PATTERN || this.bodyError()) return null;
    if (this.state.rules().length >= MAX_RULES) return null;
    const body = draft.body.trim();
    const delayMs = Math.min(Math.max(Math.round(Number(draft.delayMs)) || 0, 0), 10_000);
    const status = draft.status.trim() ? Number(draft.status) : body ? 200 : undefined;
    if (status !== undefined && !isHttpRuleStatus(status)) return null;
    if (status === undefined && !delayMs) return null;
    const chance = chanceOf(draft.chance);
    if (chance === null) return null;
    return {
      pattern,
      enabled: true,
      target: draft.target,
      ...(draft.method ? { method: draft.method } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(delayMs ? { delayMs } : {}),
      ...(body ? { body } : {}),
      ...(chance !== undefined ? { chance } : {}),
    };
  });

  readonly draftHint = computed(() => {
    const draft = this.draft();
    if (this.state.rules().length >= MAX_RULES) {
      return `You can add up to ${MAX_RULES} rules. Remove one to add another.`;
    }
    if (!draft.pattern.trim()) return 'Enter a URL pattern to add a rule.';
    if (draft.pattern.trim().length > MAX_PATTERN)
      return `The URL pattern is limited to ${MAX_PATTERN} characters.`;
    if (this.bodyError()) return '';
    if (draft.status.trim() && !isHttpRuleStatus(Number(draft.status)))
      return 'Pick a status from the list.';
    if (chanceOf(draft.chance) === null) return 'Chance is a whole percent from 1 to 99.';
    if (!this.draftRule()) return 'Set a status, a delay or a mock body.';
    if (!draft.status.trim() && draft.body.trim())
      return 'With no status, the mock body returns 200.';
    return '';
  });

  readonly bodyError = computed(() => {
    const body = this.draft().body.trim();
    if (!body) return '';
    if (body.length > MAX_BODY) return `The mock body is limited to ${MAX_BODY} characters.`;
    try {
      JSON.parse(body);
      return '';
    } catch {
      return 'The mock body must be valid JSON.';
    }
  });

  /** The usual methods, plus the draft's own when "Mock this request" filled in another one. */
  readonly methodOptions = computed<SelectOption[]>(() => {
    const draft = this.draft().method;
    const methods =
      draft && !STANDARD_METHODS.includes(draft) ? [...STANDARD_METHODS, draft] : STANDARD_METHODS;
    return [{ value: '', label: 'Any' }, ...methods.map((m) => ({ value: m, label: m }))];
  });

  setDraft<K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) {
    this.draft.update((draft) => ({ ...draft, [key]: value }));
  }

  patch(key: keyof RuleDraft, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.draft.update((draft) => ({ ...draft, [key]: value }));
  }

  /** Fills the fault rule form from a recorded call and moves focus to it. Nothing is saved. */
  mockCall(call: HttpCall) {
    const method = call.method.toUpperCase();
    const pattern = mockPattern(call.url);
    const body = call.error || !call.preview ? null : jsonBody(call.preview);
    this.draft.set({ ...EMPTY_DRAFT, pattern, method, body: body ?? '' });
    const what = `${method} ${pattern}`;
    this.state.message.set(
      body
        ? `Filled in a rule for ${what} with the preview as its body. Check it, then add the rule.`
        : call.preview && !call.error
          ? `Filled in a rule for ${what}. The preview is not complete JSON, so it is not used as the body.`
          : `Filled in a rule for ${what}. Set a status, a delay or a body, then add the rule.`,
    );
    this.state.afterRender(() => this.state.query<HTMLInputElement>('#rule-pattern')?.focus());
  }

  async addRule(event: Event) {
    event.preventDefault();
    const draft = this.draftRule();
    if (!draft || this.addingRule()) return;
    const rule: HttpRule = { id: newRuleId(), ...draft };
    this.addingRule.set(true);
    const added = await this.saveRules((rules) => [[...rules, rule], rule], 'Rule added.');
    this.addingRule.set(false);
    if (added) {
      this.draft.set({ ...EMPTY_DRAFT });
      this.state.query<HTMLInputElement>('#rule-pattern')?.focus();
    }
  }

  /** Adds the rules of a built-in preset after the current ones. */
  async addPreset(id: string) {
    const added = presetRules(id, newRuleId);
    if (!added.length) return;
    if (this.state.rules().length + added.length > MAX_RULES) {
      this.state.message.set(`You can add up to ${MAX_RULES} rules. Remove one to add the preset.`);
      return;
    }
    await this.saveRules(
      (rules) => [[...rules, ...added], added[0]],
      `Added ${added.length === 1 ? 'a rule' : `${added.length} rules`} for every browser request.`,
    );
  }

  toggleRule(id: string) {
    void this.saveRules((rules) => {
      const rule = rules.find((r) => r.id === id);
      if (!rule) return null;
      return [rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)), rule];
    }, 'Rule updated.');
  }

  async removeRule(id: string) {
    let index = -1;
    const removed = await this.saveRules((rules) => {
      index = rules.findIndex((r) => r.id === id);
      return index < 0 ? null : [rules.filter((r) => r.id !== id), rules[index]];
    }, 'Rule removed.');
    if (removed) this.state.focusAfterRemove('[data-remove-rule]', index, '#rule-list-heading');
  }

  /**
   * Saves run one after another, and each change is applied to the list the previous save left,
   * so two quick changes never start from the same old list. `change` returns null when its
   * rule is gone by then, and otherwise also the rule it changed, for the message.
   */
  private saveRules(
    change: (rules: HttpRule[]) => [HttpRule[], HttpRule] | null,
    done: string,
  ): Promise<boolean> {
    const save = this.ruleSaves.then(async () => {
      const next = change(this.state.rules());
      if (!next) return false;
      const [rules, changed] = next;
      try {
        const saved = await call(this.state.rpc(), 'set-http-rules', rules);
        this.state.rules.set(Array.isArray(saved) ? (saved as HttpRule[]) : rules);
        this.state.announce(
          changed.target === 'client' ? done : `${done} Reload the page to apply it to SSR.`,
        );
        return true;
      } catch {
        this.state.message.set('Could not save the rules.');
        return false;
      }
    });
    this.ruleSaves = save;
    return save;
  }
}
