// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { CollectedForm, FormFieldNode } from '../forms.ts';
import { autocompleteHint, domFacts, submitDom } from '../forms-dom.ts';
import { lintForm } from '../rpc/forms-lint.ts';

function input(html: string): Element {
  const box = document.createElement('div');
  box.innerHTML = html;
  return box.firstElementChild!;
}

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

function formOf(children: FormFieldNode[], extra: Partial<CollectedForm> = {}): CollectedForm {
  return {
    id: 'form-1@p',
    kind: 'reactive',
    owner: 'C',
    label: 'C.form',
    root: { ...leaf(''), type: 'group', bound: false, children },
    ...extra,
  };
}

const rules = (form: CollectedForm) =>
  lintForm(form, [], 10_000).map((f) => `${f.rule}:${f.path ?? ''}`);

describe('forms accessibility lint', () => {
  it('finds the autocomplete token a personal field needs from its type or name', () => {
    expect(autocompleteHint(input('<input type="email" />'))).toBe('email');
    expect(autocompleteHint(input('<input formcontrolname="firstName" />'))).toBe('given-name');
    expect(autocompleteHint(input('<input name="address.zip_code" />'))).toBe('postal-code');
    expect(autocompleteHint(input('<input id="phone" type="text" />'))).toBe('tel');
    expect(autocompleteHint(input('<input type="email" autocomplete="off" />'))).toBeUndefined();
    expect(autocompleteHint(input('<input name="title" />'))).toBeUndefined();
    expect(autocompleteHint(input('<input type="checkbox" name="email" />'))).toBeUndefined();
    expect(autocompleteHint(input('<select name="country"></select>'))).toBeUndefined();
    expect(domFacts(input('<input name="city" />'), {}).autocomplete).toBe('address-level2');
  });

  it('counts a submit button inside a disabled fieldset as disabled', () => {
    const form = input(
      '<form><fieldset disabled><button type="submit">Save</button></fieldset></form>',
    );
    expect(submitDom(form)).toMatchObject({ buttons: 1, disabledButtons: 1 });
  });

  it('reads a control inside a disabled fieldset as disabled', () => {
    const fieldset = input('<fieldset disabled><input name="city" /></fieldset>');
    const field = fieldset.querySelector('input')!;
    expect(domFacts(field, { disabled: false }).disabled).toBe(true);
    expect(domFacts(field, { disabled: true }).disabled).toBeUndefined();
  });

  it('flags a personal field without autocomplete, unless it is hidden or disabled', () => {
    expect(
      rules(
        formOf([
          leaf('email', { dom: { labelled: true, autocomplete: 'email' } }),
          leaf('city', { hidden: true, dom: { labelled: true, autocomplete: 'address-level2' } }),
          leaf('zip', { status: 'DISABLED', dom: { labelled: true, autocomplete: 'postal-code' } }),
        ]),
      ),
    ).toEqual(['missing-autocomplete:email']);
    const finding = lintForm(formOf([leaf('email', { dom: { autocomplete: 'email' } })]), [], 0)[0];
    expect(finding.fix).toContain('autocomplete="email"');
  });

  it('flags submit buttons that are all disabled while the form is invalid', () => {
    const submitDom = {
      tag: 'form',
      buttons: 1,
      disabledButtons: 1,
      novalidate: true,
      nativeInvalid: 0,
      reasons: [],
    };
    const invalid = formOf([leaf('a')], { submitDom });
    invalid.root.status = 'INVALID';
    expect(rules(invalid)).toContain('submit-disabled-while-invalid:');
    expect(rules(formOf([leaf('a')], { submitDom }))).not.toContain(
      'submit-disabled-while-invalid:',
    );
    const enabled = formOf([leaf('a')], { submitDom: { ...submitDom, disabledButtons: 0 } });
    enabled.root.status = 'INVALID';
    expect(rules(enabled)).not.toContain('submit-disabled-while-invalid:');
  });

  it('can be turned off one rule at a time', () => {
    const form = formOf([leaf('email', { dom: { labelled: true, autocomplete: 'email' } })]);
    expect(lintForm(form, [], 0, { rules: { 'missing-autocomplete': false } })).toEqual([]);
  });
});
