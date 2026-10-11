import { describe, expect, it } from 'vitest';
import type { CollectedForm, FormEvent } from '../forms.ts';
import { formDiffText, formHistoryText } from '../rpc/forms-explain.ts';

const form = {
  id: 'a@p1',
  kind: 'reactive',
  owner: 'A',
  property: 'f',
  label: 'A.f',
  submitted: false,
  root: {
    key: 'f',
    path: '',
    type: 'group',
    status: 'VALID',
    touched: false,
    dirty: false,
    bound: false,
    errors: [],
  },
} as unknown as CollectedForm;

const events: FormEvent[] = [
  { formId: 'a@p1', path: 'x', type: 'value', detail: '"1"', prev: '""', timestamp: 1, seq: 1 },
];

describe('form-diff and form-history with a form that matches nothing', () => {
  const state = { forms: [form], events, reportedAt: 0 };

  it('says no form matches instead of reporting no change', () => {
    for (const text of [
      formDiffText(state, { form: 'zzz', since: 0 }),
      formHistoryText(state, { form: 'zzz' }),
    ]) {
      expect(text).toContain('No form matches `zzz`');
      expect(text).toContain('a@p1');
      expect(text).not.toContain('Nothing changed');
      expect(text).not.toContain('No matching form events');
    }
  });

  it('still reports no change for a form that exists', () => {
    expect(formDiffText(state, { form: 'a@p1', since: 1 })).toContain('Nothing changed');
  });
});
