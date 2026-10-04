// @vitest-environment jsdom
import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  debounce,
  disabled,
  form,
  max,
  min,
  minLength,
  pattern,
  required,
  validate,
} from '@angular/forms/signals';
import { SignalFormControl, compatForm } from '@angular/forms/signals/compat';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { describe, expect, it } from 'vitest';
import { isFieldTree, serializeControl, serializeField } from '../forms.ts';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

function signalForm<T>(model: T, schema?: Parameters<typeof form<T>>[1]) {
  return TestBed.runInInjectionContext(() =>
    schema ? form(signal(model), schema as never) : form(signal(model)),
  );
}

describe('real Signal Forms', () => {
  it('detects a field tree without creating its children or calling other functions', () => {
    const tree = signalForm({ a: 'x', b: { c: 1 }, list: [{ n: 1 }] });
    const created = () => (tree() as any).structure.materializedChildren().length;
    expect(created()).toBe(0);
    expect(isFieldTree(tree)).toBe(true);
    serializeField(tree());
    expect(created()).toBe(0);

    let calls = 0;
    const handler = () => {
      calls++;
    };
    for (const value of [handler, handler.bind(null), signal(1), Math.max]) {
      expect(isFieldTree(value)).toBe(false);
    }
    expect(calls).toBe(0);
  });

  it('recognizes a form whose model has name and length keys', () => {
    const tree = signalForm({ name: 'box', length: 3, width: 2 });
    expect(isFieldTree(tree)).toBe(true);
    expect(isFieldTree(signalForm(['a', 'b']))).toBe(true);
  });

  it('matches Angular for errors, status and disabled reasons', () => {
    const tree = signalForm({ name: '', tags: ['a'], plan: 'free' }, (path: any) => {
      required(path.name, { message: 'Name is required' });
      minLength(path.tags, 2);
      validate(path.plan, () => ({ kind: 'reserved', message: 'Pick another plan' }));
      disabled(path.plan, () => 'locked for review');
    });
    tree.name();
    tree.tags();
    tree.plan();
    const root = serializeField(tree());
    const byKey = Object.fromEntries(root.children!.map((c) => [c.key, c]));
    expect(root.status).toBe(tree().invalid() ? 'INVALID' : 'VALID');
    expect(byKey['name'].errors).toEqual([
      { kind: 'required', message: 'Name is required', params: undefined, source: 'own' },
    ]);
    expect(byKey['tags'].errors[0].message).toBe('needs at least 2 items');
    expect(byKey['plan'].status).toBe('DISABLED');
    expect(byKey['plan'].disabledReasons).toEqual(['locked for review']);
  });

  it('shows constraints and a pending debounce', () => {
    const tree = signalForm({ age: 5, code: 'x' }, (path: any) => {
      min(path.age, 13);
      max(path.age, 120);
      minLength(path.code, 3);
      pattern(path.code, /^[A-Z]+$/);
      debounce(path.code, 1000);
    });
    tree.age();
    tree.code();
    (tree as any).code().controlValue.set('xyz');
    const root = serializeField(tree());
    const byKey = Object.fromEntries(root.children!.map((c) => [c.key, c]));
    expect(byKey['age'].constraints).toEqual({ min: 13, max: 120 });
    expect(byKey['code'].constraints).toEqual({ minLength: 3, pattern: '^[A-Z]+$' });
    expect(byKey['code'].debouncing).toBe(true);
    expect(byKey['age'].debouncing).toBeUndefined();
  });

  it('reads a SignalFormControl as a signal form', () => {
    const control = TestBed.runInInjectionContext(
      () => new SignalFormControl('', (path: any) => required(path)),
    );
    const node = serializeControl(control as never);
    expect(node).toMatchObject({ required: true, status: 'INVALID' });
    expect(node.errors[0].kind).toBe('required');
  });

  it('reads a reactive group nested in compatForm through the control itself', () => {
    const grp = new FormGroup({ zip: new FormControl('', Validators.required) });
    const tree = TestBed.runInInjectionContext(() => compatForm(signal({ grp })));
    (tree as any).grp();
    const node = serializeField(tree());
    const zip = node.children![0].children![0];
    expect(zip).toMatchObject({ key: 'zip', status: 'INVALID' });
    expect(zip.errors[0].kind).toBe('required');
  });

  it('does not change compatForm validity while reading it', () => {
    const legacy = new FormControl('', { nonNullable: true, validators: Validators.required });
    const tree = TestBed.runInInjectionContext(() => compatForm(signal({ name: 'x', legacy })));
    const before = tree().valid();
    serializeField(tree());
    expect(isFieldTree(tree)).toBe(true);
    expect(tree().valid()).toBe(before);
  });
});
