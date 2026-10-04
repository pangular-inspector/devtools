// @vitest-environment jsdom
import '@angular/compiler';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  disabled,
  form,
  hidden,
  required,
  submit,
  validate,
  validateTree,
} from '@angular/forms/signals';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  collectForms,
  forgetFormSecrets,
  redactFormText,
  findForms,
  serializeControl,
  serializeField,
  watchControlEvents,
} from '../forms.ts';
import { domFacts, submitDom } from '../forms-dom.ts';
import { isSecretKey, redactMessage, redactReason } from '../forms-privacy.ts';
import { controlFacts, fieldPath, submitSetup, validatorNames } from '../forms-read.ts';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // already initialized by another suite in this worker
}

function signalForm<T>(model: T, schema?: unknown, options?: unknown) {
  return TestBed.runInInjectionContext(() => (form as any)(signal(model), schema, options)) as any;
}

function byKey(node: { children?: { key: string }[] }) {
  return Object.fromEntries((node.children ?? []).map((c) => [c.key, c])) as Record<string, any>;
}

function ngApi() {
  const ng = (globalThis as any).ng;
  if (!ng?.getDirectives) throw new Error('ng debug API missing');
  return ng;
}

afterEach(() => TestBed.resetTestingModule());

describe('Signal Forms internals', () => {
  it('attributes tree, own and submission errors, with the ancestor path', async () => {
    const tree = signalForm({ pass: 'a', confirm: 'b', name: '' }, (p: any) => {
      required(p.name);
      validateTree(p, ({ value, fieldTreeOf }: any) =>
        value().pass === value().confirm
          ? null
          : { kind: 'mismatch', fieldTree: fieldTreeOf(p.confirm), message: 'Must match' },
      );
    });
    tree.confirm();
    tree.name();
    expect(fieldPath(tree.confirm())).toBe('confirm');
    let root = serializeField(tree());
    expect(byKey(root)['confirm'].errors[0]).toMatchObject({
      kind: 'mismatch',
      source: 'tree',
      from: '',
    });
    expect(byKey(root)['name'].errors[0]).toMatchObject({ kind: 'required', source: 'own' });

    tree.name().value.set('Kam');
    tree.confirm().value.set('a');
    await submit(tree, async () => [{ kind: 'server', message: 'Taken', fieldTree: tree.name }]);
    root = serializeField(tree());
    expect(byKey(root)['name'].errors).toEqual([
      expect.objectContaining({ kind: 'server', source: 'submission' }),
    ]);
  });

  it('explains skipped validation, inherited state and rule counts', () => {
    const tree = signalForm({ card: { number: '' }, note: '', locked: { a: '' } }, (p: any) => {
      required(p.card.number);
      hidden(p.card, () => true);
      required(p.note);
      validate(p.note, () => null);
      disabled(p.locked, () => 'Locked while reviewing');
    });
    tree.card.number();
    tree.note();
    tree.locked.a();
    const root = serializeField(tree());
    const number = byKey(byKey(root)['card'])['number'];
    expect(number).toMatchObject({ skipped: 'hidden', hiddenBy: 'parent', errors: [] });
    expect(byKey(root)['note'].rules).toMatchObject({ sync: 2 });
    expect(byKey(root)['note'].rules.metadata).toBeGreaterThan(0);
    expect(byKey(byKey(root)['locked'])['a']).toMatchObject({
      skipped: 'disabled',
      inheritedDisabled: 1,
    });
  });

  it('dry-runs submit like Angular', () => {
    const action = async () => undefined;
    const invalid = signalForm({ a: '' }, (p: any) => required(p.a), { submission: { action } });
    expect(submitSetup(invalid())).toMatchObject({ hasAction: true, willRun: false });
    const forced = signalForm({ a: '' }, (p: any) => required(p.a), {
      submission: { action, ignoreValidators: 'all' },
    });
    expect(submitSetup(forced())).toMatchObject({ willRun: true, ignoreValidators: 'all' });
    expect(submitSetup(signalForm({ a: 'x' })())).toMatchObject({ hasAction: false });
  });

  it('reports a buffered value and dirty-but-unchanged fields', () => {
    const tree = signalForm({ name: 'kam' });
    tree.name();
    serializeField(tree());
    tree.name().markAsDirty();
    let node = byKey(serializeField(tree()))['name'];
    expect(node).toMatchObject({ dirty: true, changed: false });
    tree.name().value.set('ada');
    node = byKey(serializeField(tree()))['name'];
    expect(node.changed).toBe(true);
  });
});

describe('reactive internals', () => {
  it('flags stale validity, manual errors and validator names', () => {
    const name = new FormControl('');
    name.setValidators([Validators.required, Validators.minLength(3)]);
    const facts = controlFacts(name as any);
    expect(facts.stale).toEqual(['required']);
    expect(facts.validators).toContain('required');

    const email = new FormControl('a@b.co', Validators.email);
    email.setErrors({ taken: true });
    expect(controlFacts(email as any).origins).toEqual({ taken: { source: 'manual' } });
    const node = serializeControl(email as any);
    expect(node.errors[0]).toMatchObject({ kind: 'taken', source: 'manual' });
    expect(validatorNames(email as any)).toEqual(['email']);
  });

  it('re-probes a cached validator after a while, so outside state changes show as stale', () => {
    vi.useFakeTimers();
    try {
      let max = 10;
      const guests = new FormControl(5, (c) => ((c.value ?? 0) > max ? { max: true } : null));
      expect(controlFacts(guests as any).stale).toBeUndefined();
      max = 3;
      expect(controlFacts(guests as any).stale).toBeUndefined();
      vi.advanceTimersByTime(6000);
      expect(controlFacts(guests as any).stale).toEqual(['max']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops control events caused by probing a validator', async () => {
    const group = new FormGroup({ a: new FormControl(''), noisy: new FormControl('x') });
    group.controls.noisy.setValidators(() => {
      group.controls.a.setErrors({ side: true });
      return null;
    });
    const events: unknown[] = [];
    const stop = watchControlEvents(group as any, 'f', (event) => events.push(event));
    controlFacts(group.controls.noisy as any);
    await Promise.resolve();
    stop?.();
    expect(events).toEqual([]);
  });
});

class BlurForm {
  form = new FormGroup({
    name: new FormControl('', { updateOn: 'blur', validators: Validators.required }),
  });
}
Component({
  selector: 'blur-form',
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <label for="n">Name</label>
      <input id="n" formControlName="name" required aria-describedby="n-err" />
      <span id="n-err">Name is required</span>
      <button type="button">Save</button>
    </form>
  `,
})(BlurForm);

class ModelForm {
  city = 'ab';
}
Component({
  selector: 'model-form',
  imports: [FormsModule],
  template: `
    <form>
      <input name="city" [(ngModel)]="city" required minlength="3" />
      <button type="submit" disabled>Go</button>
    </form>
  `,
})(ModelForm);

describe('real components', () => {
  it('reads uncommitted text, bindings, DOM facts and submit reasons', () => {
    const fixture = TestBed.createComponent(BlurForm);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'Ada';
    input.dispatchEvent(new Event('input'));
    const [collected] = collectForms(
      findForms(ngApi(), fixture.nativeElement.querySelectorAll('*')),
    );
    const name = byKey(collected.root)['name'];
    expect(name).toMatchObject({ value: '', uncommitted: 'Ada', updateOn: 'blur' });
    expect(name.binding).toMatchObject({ kind: 'native', accessor: 'DefaultValueAccessor' });
    expect(name.dom).toMatchObject({ labelled: true, required: true, describedBy: true });
    expect(name.errors[0]).toMatchObject({ kind: 'required', source: 'own' });
    expect(collected.submitDom?.reasons.join(' ')).toContain('type="button"');
  });

  it('labels template validators and flags a disabled submit button only on a valid form', async () => {
    const fixture = TestBed.createComponent(ModelForm);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const collect = () =>
      collectForms(findForms(ngApi(), fixture.nativeElement.querySelectorAll('*')))[0];
    const collected = collect();
    const city = byKey(collected.root)['city'];
    expect(city.errors[0]).toMatchObject({ kind: 'minlength', source: 'directive' });
    expect(city.validatorNames).toEqual(expect.arrayContaining(['required (template)']));
    expect(collected.submitDom?.reasons).toEqual([]);
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'Izmir';
    input.dispatchEvent(new Event('input'));
    expect(collect().submitDom?.reasons.join(' ')).toContain('disabled');
  });
});

describe('privacy', () => {
  it('splits words so passenger and discard stay visible', () => {
    for (const key of [
      'password',
      'newPassword',
      'apiKey',
      'api_key',
      'cardNumber',
      'passwords',
      'cvv',
      'PIN',
    ]) {
      expect(isSecretKey(key), key).toBe(true);
    }
    for (const key of [
      'passenger',
      'discard',
      'compass',
      'bypass',
      'cardinal',
      'keyword',
      'pinned',
    ]) {
      expect(isSecretKey(key), key).toBe(false);
    }
  });

  it('honors masking markers and the unmask marker', () => {
    document.body.innerHTML = `
      <div class="rr-mask"><input id="a"></div>
      <input id="b" data-pangular="unmask" name="token">
      <input id="c" autocomplete="cc-number">`;
    expect(redactReason('city', document.getElementById('a'))).toBe('marker');
    expect(redactReason('token', document.getElementById('b'))).toBeNull();
    expect(redactReason('x', document.getElementById('c'))).toBe('autocomplete');
    document.body.innerHTML = `
      <div data-pangular="unmask">
        <input id="d" type="password"><input id="e" autocomplete="one-time-code">
      </div>`;
    expect(redactReason('x', document.getElementById('d'))).toBeNull();
    expect(redactReason('x', document.getElementById('e'))).toBeNull();
  });

  it('collects secrets from a circular value without overflowing', () => {
    const secret: Record<string, unknown> = { pin: '98765' };
    secret['self'] = secret;
    const group = new FormGroup({
      password: new FormControl(secret),
      note: new FormControl('98765'),
    });
    const [collected] = collectForms({
      forms: [{ kind: 'reactive', root: group as any, owner: null }],
      elements: new WeakMap(),
    });
    expect(JSON.stringify(collected.root.children)).not.toContain('98765');
  });

  it('removes a secret value from every serialized string', () => {
    const group = new FormGroup({
      password: new FormControl('hunter2'),
      hint: new FormControl('hunter2 backwards'),
    });
    group.controls.hint.setErrors({ pattern: { requiredPattern: '^hunter2$', actualValue: 'x' } });
    const [collected] = collectForms({
      forms: [{ kind: 'reactive', root: group as any, owner: null }],
      elements: new WeakMap(),
    });
    const text = JSON.stringify(collected);
    expect(text).not.toContain('hunter2');
    expect(text).toContain('"path":"hint"');
  });

  it('removes a secret value quoted in another field error', () => {
    const group = new FormGroup({
      password: new FormControl('hunter2'),
      confirm: new FormControl('hunter3'),
    });
    group.controls.confirm.setErrors({ mismatch: 'hunter3 does not match hunter2' });
    const [collected] = collectForms({
      forms: [{ kind: 'reactive', root: group as any, owner: null }],
      elements: new WeakMap(),
    });
    const text = JSON.stringify(collected);
    expect(text).not.toContain('hunter2');
    expect(redactFormText(collected.id, 'Invalid password hunter2')).toBe(
      'Invalid password [redacted]',
    );
    forgetFormSecrets([collected.id]);
    expect(redactFormText(collected.id, 'Invalid password hunter2')).toBe(
      'Invalid password hunter2',
    );
    expect(redactMessage('Bearer abc.def and eyJhbGciOiJI.eyJzdWIiOiIx.c2lnbmF0dXJl')).toBe(
      'Bearer [redacted] and [redacted]',
    );
  });
});

describe('DOM facts', () => {
  it('detects a stale view and hidden error text', () => {
    document.body.innerHTML = `
      <div class="field"><input id="x" value="old"><mat-error hidden>Required</mat-error></div>`;
    const el = document.getElementById('x')!;
    expect(domFacts(el, { value: 'new', hasErrors: true })).toMatchObject({
      drift: 'old',
      errorShown: false,
    });
    expect(domFacts(el, { value: 'old', secret: true }).drift).toBeUndefined();
  });

  it('explains why a non-form host never submits, only when something listens for submit', () => {
    document.body.innerHTML = '<div id="f"></div>';
    const host = document.getElementById('f')!;
    expect(submitDom(host).reasons).toEqual([]);
    expect(submitDom(host, { submitListener: true }).reasons[0]).toContain('not a <form>');
  });
});
