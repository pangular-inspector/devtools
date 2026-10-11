import { describe, expect, it } from 'vitest';
import type { CollectedForm, FormFieldNode } from '../forms.ts';
import { lintForm } from '../rpc/forms-lint.ts';

function leaf(key: string, extra: Partial<FormFieldNode> = {}): FormFieldNode {
  return {
    key,
    path: key,
    type: 'control',
    status: 'VALID',
    touched: false,
    dirty: false,
    bound: true,
    errors: [],
    dom: { labelled: true },
    ...extra,
  };
}

function formOf(kind: CollectedForm['kind'], children: FormFieldNode[]): CollectedForm {
  return {
    id: 'form-1@p',
    kind,
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
      children,
    },
  };
}

const rules = (form: CollectedForm) =>
  lintForm(form, [], 10_000).map((f) => `${f.rule}:${f.path ?? ''}`);

describe('forms lint', () => {
  it('stays quiet on a clean form', () => {
    expect(
      rules(
        formOf('reactive', [
          leaf('a'),
          leaf('b', { dom: { labelled: true, required: true }, validatorNames: ['required'] }),
        ]),
      ),
    ).toEqual([]);
  });

  it('flags Signal Forms schema problems', () => {
    const form = formOf('signal', [
      leaf('promo', { hidden: true, hiddenBy: 'self' }),
      leaf('bio', { required: true, bound: false, dom: undefined }),
      leaf('name', {
        status: 'INVALID',
        errors: [{ kind: 'taken', message: 'Taken', source: 'submission' }],
        dom: { labelled: true },
      }),
    ]);
    expect(rules(form)).toEqual(
      expect.arrayContaining([
        'hidden-field-rendered:promo',
        'unbound-required:bio',
        'submission-error:name',
      ]),
    );
  });

  it('flags reactive view problems', () => {
    const form = formOf('reactive', [
      leaf('a', { dom: { labelled: true, disabled: true } }),
      leaf('b', { modelDrift: { model: 1, viewModel: 2 } }),
      leaf('c', { pendingSince: 1000, status: 'PENDING' }),
    ]);
    expect(rules(form)).toEqual(
      expect.arrayContaining(['disabled-attr-reactive:a', 'ngmodel-drift:b', 'stuck-pending:c']),
    );
  });

  it('flags model-aware accessibility gaps', () => {
    const invalid = {
      status: 'INVALID' as const,
      touched: true,
      errors: [{ kind: 'required', message: 'is required' }],
    };
    const form = formOf('reactive', [
      leaf('a', {
        ...invalid,
        dom: { labelled: true, ariaInvalid: false, required: true, errorShown: false },
      }),
      leaf('b', { ...invalid, dom: { labelled: true, required: true, errorShown: true } }),
      leaf('c', { ...invalid, dom: { labelled: true, errorShown: true, describedBy: true } }),
    ]);
    expect(rules(form)).toEqual(
      expect.arrayContaining([
        'aria-invalid-desync:a',
        'error-not-shown:a',
        'error-not-described:b',
        'required-not-exposed:c',
      ]),
    );
    expect(rules(form)).not.toContain('error-not-described:c');
  });

  it('matches aria-invalid against invalid and touched', () => {
    const form = formOf('reactive', [
      leaf('a', { status: 'INVALID', touched: false, dom: { labelled: true, ariaInvalid: false } }),
      leaf('b', { status: 'VALID', dom: { labelled: true, ariaInvalid: true } }),
      leaf('c', { status: 'INVALID', touched: true, dom: { labelled: true, ariaInvalid: true } }),
    ]);
    const found = rules(form).filter((rule) => rule.startsWith('aria-invalid-desync'));
    expect(found).toEqual(['aria-invalid-desync:b']);
  });
});
