// @vitest-environment jsdom
import '@angular/compiler';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  FormField,
  FormRoot,
  createMetadataKey,
  form,
  metadata,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachForms } from '../forms-collector.ts';
import { coerceToCurrent } from '../forms-actions.ts';
import {
  collectForms,
  createFormIds,
  findForms,
  formIdFor,
  formLabels,
  propertyHolding,
  serializeField,
} from '../forms.ts';
import { controlFacts } from '../forms-read.ts';
import { lintForm } from '../rpc/forms-lint.ts';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // already initialized in this worker
}

const stops: (() => void)[] = [];
afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  TestBed.resetTestingModule();
  document.body.innerHTML = '';
});

function ngApi() {
  return (globalThis as any).ng;
}

function signalForm<T>(model: T, schema?: unknown, options?: unknown) {
  return TestBed.runInInjectionContext(() => (form as any)(signal(model), schema, options)) as any;
}

function byKey(node: { children?: { key: string }[] }) {
  return Object.fromEntries((node.children ?? []).map((c) => [c.key, c])) as Record<string, any>;
}

async function mount<T>(type: new () => T) {
  const fixture = TestBed.createComponent(type);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

function type(el: HTMLInputElement, text: string) {
  el.value = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

class Unbound {
  note = '';
}
Component({
  selector: 'unbound-model',
  imports: [FormsModule],
  template: `<form><input id="note" name="note" ngModel /></form>`,
})(Unbound);

class OneWay {
  city = 'Ankara';
}
Component({
  selector: 'one-way-model',
  imports: [FormsModule],
  template: `<form><input id="city" name="city" [ngModel]="city" /></form>`,
})(OneWay);

class Twin {
  a = new FormGroup({ name: new FormControl('') });
  b = new FormGroup({ name: new FormControl('') });
}
Component({
  selector: 'twin-forms',
  imports: [ReactiveFormsModule],
  template: `<form [formGroup]="a"><input formControlName="name" /></form>
    <form [formGroup]="b"><input id="b-name" formControlName="name" /></form>`,
})(Twin);

class Nested {
  form = form(signal({ name: '', address: { city: '' } }), (p) => required(p.name), {
    submission: { action: async () => undefined },
  });
}
Component({
  selector: 'nested-form',
  imports: [FormField, FormRoot],
  template: `<form [formRoot]="form">
    <input [formField]="form.name" /><input [formField]="form.address.city" />
  </form>`,
})(Nested);

describe('form ids', () => {
  it('builds ids from the owner, property and ordinal', async () => {
    await mount(Twin);
    const forms = collectForms(findForms(ngApi(), document.querySelectorAll('*')));
    expect(forms.map((f) => f.id)).toEqual(['Twin.a', 'Twin.b']);
    expect(formIdFor('Page.ngForm #2')).toBe('Page.ngForm~2');
    expect(formIdFor('Page.ngForm#user@home')).toBe('Page.ngForm#user_home');
  });

  it('keeps an id with its form, and never hands a removed form id to another', () => {
    class GuestForm {}
    const owner = new GuestForm();
    const make = () => ({ kind: 'reactive' as const, root: {}, owner, property: 'form' });
    const [a, b, c] = [make(), make(), make()];
    const assign = createFormIds('p');
    const idsFor = (forms: (typeof a)[]) => {
      const ids = assign(forms as never, formLabels(forms as never));
      return forms.map((f) => ids.get(f.root));
    };
    expect(idsFor([a, b])).toEqual(['GuestForm.form@p', 'GuestForm.form~2@p']);
    expect(idsFor([b])).toEqual(['GuestForm.form~2@p']);
    expect(idsFor([b, c])).toEqual(['GuestForm.form~2@p', 'GuestForm.form~3@p']);
    expect(idsFor([c, b])).toEqual(['GuestForm.form~3@p', 'GuestForm.form~2@p']);
  });

  it('keeps the same id across collectors, so a reload does not reuse another form id', async () => {
    await mount(Twin);
    const ids: string[][] = [];
    for (let i = 0; i < 2; i++) {
      const calls: any[] = [];
      const collector = attachForms(
        {
          rpc: {
            call: async (_: string, report: unknown) => void calls.push(report),
            register() {},
          },
        },
        'pg',
        ngApi,
        { show() {}, clear() {} },
      );
      collector.push();
      await new Promise((resolve) => setTimeout(resolve, 20));
      collector.stop();
      ids.push(calls.at(-1).forms.map((f: { id: string }) => f.id));
    }
    expect(ids[0]).toEqual(['Twin.a@pg', 'Twin.b@pg']);
    expect(ids[1]).toEqual(ids[0]);
  });
});

describe('ngModel drift', () => {
  it('ignores an unbound ngModel the user edits', async () => {
    await mount(Unbound);
    type(document.getElementById('note') as HTMLInputElement, 'typed');
    const collect = () =>
      byKey(collectForms(findForms(ngApi(), document.querySelectorAll('*')))[0].root)['note'];
    collect();
    expect(collect().modelDrift).toBeUndefined();
  });

  it('reports a one-way [ngModel] only when the mismatch lasts two collects', async () => {
    await mount(OneWay);
    type(document.getElementById('city') as HTMLInputElement, 'Izmir');
    const collect = () =>
      byKey(collectForms(findForms(ngApi(), document.querySelectorAll('*')))[0].root)['city'];
    expect(collect().modelDrift).toBeUndefined();
    expect(collect().modelDrift).toEqual({ model: 'Ankara', viewModel: 'Izmir' });
  });
});

describe('view out of sync', () => {
  it('needs the same drift on two collects in a row', async () => {
    const fixture = await mount(Twin);
    const input = document.getElementById('b-name') as HTMLInputElement;
    fixture.componentInstance.b.controls.name.setValue('model', { emitEvent: false });
    input.value = 'screen';
    const collect = () =>
      byKey(collectForms(findForms(ngApi(), document.querySelectorAll('*')))[1].root)['name'];
    expect(collect().dom.drift).toBeUndefined();
    const second = collect();
    expect(second.dom.drift).toBe('screen');
    expect(second.binding.kind).toBe('native');
  });
});

describe('Signal Forms details', () => {
  it('shows standard schema issue messages and paths, the error summary, names and metadata', () => {
    const HINT = createMetadataKey<string>();
    const tree = signalForm({ name: '', age: 1 }, (p: any) => {
      required(p.name);
      metadata(p.age, HINT, () => 'years');
      validate(p.age, () => ({
        kind: 'standardSchema',
        issue: { message: 'Too young', path: [{ key: 'age' }] },
      }));
    });
    tree.name();
    tree.age();
    const root = serializeField(tree());
    const age = byKey(root)['age'];
    expect(age.errors[0]).toMatchObject({
      kind: 'standardSchema',
      message: 'Too young',
      params: { path: 'age' },
    });
    expect(age.metadata).toEqual(['years']);
    expect(typeof age.name).toBe('string');
    const [collected] = collectForms({
      forms: [{ kind: 'signal', root: tree(), owner: null }],
      elements: new WeakMap(),
    });
    expect(collected.errorSummary?.map((e) => [e.path, e.kind])).toEqual([
      ['name', 'required'],
      ['age', 'standardSchema'],
    ]);
  });

  it('records a submit of a child field', async () => {
    const fixture = await mount(Nested);
    const calls: any[] = [];
    const collector = attachForms(
      {
        rpc: { call: async (_: string, report: unknown) => void calls.push(report), register() {} },
      },
      'pg',
      ngApi,
      { show() {}, clear() {} },
    );
    stops.push(collector.stop);
    collector.push();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await submit(fixture.componentInstance.form.address, async () => undefined);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const submits = calls.at(-1).events.filter((e: { type: string }) => e.type === 'submit');
    expect(submits).toEqual([expect.objectContaining({ path: 'address', outcome: 'ran' })]);
  });
});

describe('validator probing', () => {
  it('runs validators again only when the value or the validators change', () => {
    const check = vi.fn(() => null);
    const control = new FormControl('a', check);
    check.mockClear();
    controlFacts(control as any);
    controlFacts(control as any);
    expect(check).toHaveBeenCalledTimes(2);
    check.mockClear();
    control.setValue('b');
    check.mockClear();
    controlFacts(control as any);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('flags stale errors when a validator reads a sibling that changed', () => {
    const password = new FormControl('secret');
    const confirm = new FormControl('secret', (c) =>
      c.value === c.parent?.get('password')?.value ? null : { mismatch: true },
    );
    new FormGroup({ password, confirm });
    confirm.updateValueAndValidity();
    expect(controlFacts(confirm as any).stale ?? []).toEqual([]);
    password.setValue('changed');
    expect(controlFacts(confirm as any).stale).toContain('mismatch');
  });
});

describe('submit reachability', () => {
  it('is info, and skips a disabled button on an invalid form', () => {
    const findings = lintForm({
      id: 'A.form@pg',
      kind: 'reactive',
      owner: 'A',
      label: 'A.form',
      submitDom: {
        tag: 'form',
        buttons: 0,
        disabledButtons: 0,
        novalidate: true,
        nativeInvalid: 0,
        reasons: ['No submit button.'],
      },
      root: {
        key: '',
        path: '',
        type: 'group',
        status: 'VALID',
        touched: false,
        dirty: false,
        bound: false,
        errors: [],
      },
    });
    expect(findings.find((f) => f.rule === 'submit-unreachable')?.severity).toBe('info');
  });
});

describe('set-value coercion', () => {
  it('keeps the type of the current value', () => {
    expect(coerceToCurrent('123', 'abc')).toEqual({ value: '123' });
    expect(coerceToCurrent('"quoted"', 'abc')).toEqual({ value: 'quoted' });
    expect(coerceToCurrent('42', 1)).toEqual({ value: 42 });
    expect(coerceToCurrent('x', 1)).toHaveProperty('error');
    expect(coerceToCurrent('TRUE', false)).toEqual({ value: true });
    expect(coerceToCurrent('yes', false)).toHaveProperty('error');
    expect(coerceToCurrent('2024-01-02', new Date(0))).toEqual({ value: new Date('2024-01-02') });
    expect(coerceToCurrent('[1,2]', [])).toEqual({ value: [1, 2] });
    expect(coerceToCurrent('text', { a: 1 })).toHaveProperty('error');
    expect(coerceToCurrent('plain', null)).toEqual({ value: 'plain' });
  });

  it('keeps text as text when the current value is null, unless it is explicit JSON', () => {
    expect(coerceToCurrent('12345', null)).toEqual({ value: '12345' });
    expect(coerceToCurrent('02134', undefined)).toEqual({ value: '02134' });
    expect(coerceToCurrent('true', null)).toEqual({ value: 'true' });
    expect(coerceToCurrent('null', 'x')).toEqual({ value: 'null' });
    expect(coerceToCurrent('null', null)).toEqual({ value: null });
    expect(coerceToCurrent('"7"', null)).toEqual({ value: '7' });
    expect(coerceToCurrent('{"a":1}', null)).toEqual({ value: { a: 1 } });
    expect(coerceToCurrent('[1]', null)).toEqual({ value: [1] });
    const number = document.createElement('input');
    number.type = 'number';
    expect(coerceToCurrent('7', null, number)).toEqual({ value: 7 });
    expect(coerceToCurrent('x', null, number)).toHaveProperty('error');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    expect(coerceToCurrent('true', null, checkbox)).toEqual({ value: true });
  });
});

class SubmitHosts {
  bare = new FormGroup({ a: new FormControl('') });
  withOutput = new FormGroup({ b: new FormControl('') });
  withDom = new FormGroup({ c: new FormControl('') });
  save() {}
}
Component({
  selector: 'app-submit-hosts',
  imports: [ReactiveFormsModule],
  template: `
    <div [formGroup]="bare"><input formControlName="a" /></div>
    <div [formGroup]="withOutput" (ngSubmit)="save()"><input formControlName="b" /></div>
    <div [formGroup]="withDom" (submit)="save()"><input formControlName="c" /></div>
  `,
})(SubmitHosts);

describe('submit listeners on non-form hosts', () => {
  it('ignores the form directive own host listener and counts template listeners', async () => {
    await mount(SubmitHosts);
    const { forms } = findForms(ngApi(), document.querySelectorAll('*'));
    const byProperty = Object.fromEntries(
      forms.map((f) => [propertyHolding(f), !!f.submitListener]),
    );
    expect(byProperty).toEqual({ bare: false, withOutput: true, withDom: true });
  });
});
