import { describe, expect, it } from 'vitest';
import type { CollectedForm, FormFieldNode } from '../forms.ts';
import { MAX_CHILDREN } from '../forms.ts';
import { explainSubmitText } from '../rpc/forms-explain.ts';
import { COLLECTOR_MAX_CHILDREN, cutGroups } from '../rpc/forms-collector-cap.ts';
import {
  explainFormsText,
  inspectFormsText,
  isPageReport,
  type FormsState,
} from '../rpc/forms-tools.ts';

// #423: the forms collector keeps 100 children per group. The tools must say
// so, and explain-invalid-forms must never call an invalid form error-free.

function control(path: string, overrides: Partial<FormFieldNode> = {}): FormFieldNode {
  return {
    key: path.split('.').pop()!,
    path,
    type: 'control',
    status: 'VALID',
    touched: false,
    dirty: false,
    bound: true,
    value: 'ok',
    errors: [],
    ...overrides,
  };
}

/** What the collector sends for a group of 150 controls whose control 140 is invalid. */
function cappedForm(named: boolean, kind: CollectedForm['kind'] = 'reactive'): CollectedForm {
  const root: FormFieldNode = {
    ...control(''),
    key: '',
    type: 'group',
    status: 'INVALID',
    bound: false,
    value: undefined,
    children: Array.from({ length: 100 }, (_, i) => control(`f${i}`)),
    truncated: 50,
    ...(named ? { truncatedInvalid: ['f140'] } : {}),
  };
  return {
    id: 'Wide.form@p1',
    kind,
    owner: 'Wide',
    label: 'Wide.form',
    root,
    ...(kind === 'signal'
      ? { errorSummary: [{ path: 'f140', kind: 'required', message: 'is required' }] }
      : {}),
  };
}

const stateOf = (...forms: CollectedForm[]): FormsState => ({ forms, events: [], reportedAt: 1 });

describe('forms past the collector cap', () => {
  it('uses the collector cap the page uses', () => {
    expect(COLLECTOR_MAX_CHILDREN).toBe(MAX_CHILDREN);
  });

  it('counts kept and total fields of each cut group', () => {
    expect(cutGroups(cappedForm(true).root)).toEqual([
      { path: '', kept: 100, total: 150, invalid: ['f140'] },
    ]);
  });

  it('names a failing field past the cap', () => {
    const text = explainFormsText(stateOf(cappedForm(true)), { form: 'Wide.form' });
    expect(text).not.toContain('No field reports an error');
    expect(text).toContain('`f140` is INVALID');
    expect(text).toContain('keeps the first 100 of 150 fields');
  });

  it('quotes the error summary of a Signal Form for a field past the cap', () => {
    const text = explainFormsText(stateOf(cappedForm(true, 'signal')), { form: 'Wide.form' });
    expect(text).toContain('`f140` is INVALID: [required] is required');
  });

  it('says the failing field may be past the cap when the page did not name it', () => {
    const text = explainFormsText(stateOf(cappedForm(false)), {});
    expect(text).not.toContain('No field reports an error');
    expect(text).toContain('the failing field may be past its limit');
    expect(text).toContain('keeps the first 100 of 150 fields (50 more not read)');
  });

  it('lists a cut form with the fields it read and the ones it left out', () => {
    const list = inspectFormsText(stateOf(cappedForm(true)), {});
    expect(list).toContain("101 fields read and 50 more past the collector's limit");
    const tree = inspectFormsText(stateOf(cappedForm(true)), { form: 'Wide.form' });
    expect(tree).toContain('not every field was read');
    expect(tree).toContain('keeps the first 100 of 150 fields');
    // `onlyInvalid` prunes the kept fields, but the note still counts what the page read.
    const invalid = inspectFormsText(stateOf(cappedForm(true)), {
      form: 'Wide.form',
      onlyInvalid: true,
    });
    expect(invalid).toContain('keeps the first 100 of 150 fields');
  });

  it('names the field past the cap among the reasons a submit is blocked', () => {
    const text = explainSubmitText(stateOf(cappedForm(true)), { form: 'Wide.form' });
    expect(text).toContain("Also invalid, past the collector's limit: `f140`.");
  });

  it('says nothing about a cap when no group was cut', () => {
    const form = cappedForm(false);
    delete form.root.truncated;
    form.root.children![3] = control('f3', {
      status: 'INVALID',
      errors: [{ kind: 'required', message: 'is required' }],
    });
    const text = explainFormsText(stateOf(form), {});
    expect(text).toContain('`f3`');
    expect(text).not.toContain('not read');
  });

  it('accepts the cap fields in a report and refuses malformed ones', () => {
    const report = (root: FormFieldNode) => ({
      pageId: 'p1',
      forms: [{ ...cappedForm(true), root }],
      events: [],
    });
    expect(isPageReport(report(cappedForm(true).root))).toBe(true);
    expect(isPageReport(report({ ...cappedForm(true).root, truncatedInvalid: [1] as never }))).toBe(
      false,
    );
    expect(isPageReport(report({ ...cappedForm(true).root, truncated: '5' as never }))).toBe(false);
  });
});
