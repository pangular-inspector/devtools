import { describe, expect, it } from 'vitest';
import type { CollectedForm, FormFieldNode } from '../forms.ts';
import { MAX_CHILDREN, MAX_DEPTH, MAX_INVALID_PAST_CAP, MAX_INVALID_PATH } from '../forms.ts';
import { explainSubmitText } from '../rpc/forms-explain.ts';
import {
  COLLECTOR_MAX_CHILDREN,
  COLLECTOR_MAX_DEPTH,
  COLLECTOR_MAX_INVALID,
  COLLECTOR_MAX_INVALID_PATH,
  cutGroups,
  cutSentence,
} from '../rpc/forms-collector-cap.ts';
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
    expect(COLLECTOR_MAX_DEPTH).toBe(MAX_DEPTH);
    expect(COLLECTOR_MAX_INVALID).toBe(MAX_INVALID_PAST_CAP);
    expect(COLLECTOR_MAX_INVALID_PATH).toBe(MAX_INVALID_PATH);
  });

  it('escapes page-controlled paths in the cut note and the past-cap lines', () => {
    const form = cappedForm(true);
    form.root.path = 'a`b\nc';
    form.root.truncatedInvalid = ['x` **bold** `y'];
    expect(cutSentence(cutGroups(form.root))).toContain("`a'b c` keeps the first 100 of 150");
    const text = explainFormsText(stateOf(form), { form: 'Wide.form' });
    expect(text).toContain("`x' **bold** 'y` is INVALID");
    expect(text).not.toContain('x` **bold**');
  });

  it('words a group cut by the depth limit as unread, not as keeping 0 fields', () => {
    const deep: FormFieldNode = { ...control('a.b'), type: 'group', truncated: 4 };
    delete deep.value;
    const groups = cutGroups(deep);
    expect(groups).toEqual([{ path: 'a.b', kept: 0, total: 4, invalid: [], tooDeep: true }]);
    const sentence = cutSentence(groups);
    expect(sentence).toContain('`a.b` is past the depth limit (4 fields not read)');
    expect(sentence).not.toContain('first 0');
  });

  it('counts kept and total fields of each cut group', () => {
    expect(cutGroups(cappedForm(true).root)).toEqual([
      { path: '', kept: 100, total: 150, invalid: ['f140'], tooDeep: false },
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
    const paths = (n: number, length = 4) =>
      Array.from({ length: n }, (_, i) => `f${i}`.padEnd(length, '0'));
    const named = (truncatedInvalid: string[]) =>
      isPageReport(report({ ...cappedForm(true).root, truncatedInvalid }));
    expect(named(paths(COLLECTOR_MAX_INVALID))).toBe(true);
    expect(named(paths(COLLECTOR_MAX_INVALID + 1))).toBe(false);
    expect(named(paths(1, COLLECTOR_MAX_INVALID_PATH))).toBe(true);
    expect(named(paths(1, COLLECTOR_MAX_INVALID_PATH + 1))).toBe(false);
  });
});
