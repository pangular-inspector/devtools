// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { domFacts } from '../forms-dom.ts';
import type { CollectedForm, FormEvent } from '../forms.ts';
import { lintForm } from '../rpc/forms-lint.ts';

const form = {
  id: 'f@p',
  kind: 'reactive',
  owner: 'C',
  label: 'C.form',
  root: {
    key: '',
    path: '',
    type: 'group',
    status: 'VALID',
    touched: false,
    dirty: false,
    bound: false,
    errors: [],
    children: [],
  },
} as unknown as CollectedForm;

const submit = (detail: string, timestamp: number): FormEvent => ({
  formId: 'f@p',
  path: '',
  type: 'submit',
  detail,
  timestamp,
});

const rules = (events: FormEvent[]) => lintForm(form, events, 10_000).map((f) => f.rule);

describe('no-focus-on-invalid-submit', () => {
  it('flags an invalid submit that left focus on the button', () => {
    expect(rules([submit('status INVALID at submit, focus on button[save]', 1)])).toContain(
      'no-focus-on-invalid-submit',
    );
  });

  it('is cleared by a later valid submit', () => {
    const events = [
      submit('status INVALID at submit, focus on button', 1),
      submit('status VALID at submit', 2),
    ];
    expect(rules(events)).not.toContain('no-focus-on-invalid-submit');
  });

  it('accepts focus moved to a custom control', () => {
    expect(
      rules([submit('status INVALID at submit, focus on mat-select[country]', 1)]),
    ).not.toContain('no-focus-on-invalid-submit');
  });
});

describe('hidden inputs', () => {
  it('records no label fact for a hidden input', () => {
    const el = document.createElement('input');
    el.type = 'hidden';
    expect(domFacts(el, {}).labelled).toBeUndefined();
    const visible = document.createElement('input');
    expect(domFacts(visible, {}).labelled).toBe(false);
  });
});
