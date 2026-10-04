// @vitest-environment jsdom
import '@angular/compiler';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import {
  collectForms,
  controlEventOf,
  describeError,
  diffForms,
  findFieldElement,
  findForms,
  isAbstractControl,
  isFieldTree,
  serializeControl,
  serializeField,
  serializeFormValue,
  watchControlEvents,
  type CollectedForm,
  type FormEvent,
  type FormFieldNode,
  type FormsDebugApi,
} from '../forms.ts';

function directive(selectors: unknown[][], props: Record<string, unknown>) {
  class Directive {}
  (Directive as unknown as { ɵdir: unknown }).ɵdir = { selectors };
  return Object.assign(new Directive(), props);
}

interface FakeFieldInit {
  value: unknown;
  errors?: { kind: string; message?: string }[];
  touched?: boolean;
  dirty?: boolean;
  required?: boolean;
  pending?: boolean;
  disabledReasons?: { message: string }[];
  children?: Record<string, FakeField>;
  materialized?: boolean;
}

interface FakeField {
  node: Record<string, any>;
  tree: () => Record<string, any>;
}

function fieldTree(node: Record<string, any>, value: unknown) {
  const keys = () => (value && typeof value === 'object' ? Reflect.ownKeys(value) : []);
  const descriptor = (_: unknown, key: string | symbol) => {
    if (!value || typeof value !== 'object') return undefined;
    const desc = Reflect.getOwnPropertyDescriptor(value, key);
    return desc && { ...desc, configurable: true };
  };
  return new Proxy<() => Record<string, any>>(() => node, {
    get: () => undefined,
    ownKeys: keys,
    getOwnPropertyDescriptor: descriptor,
  });
}

function fakeField(init: FakeFieldInit): FakeField {
  const children = Object.entries(init.children ?? {});
  const errors = init.errors ?? [];
  const invalid = () => errors.length > 0 || children.some(([, child]) => child.node['invalid']());
  const pending = () => !!init.pending || children.some(([, child]) => child.node['pending']());
  const materialized = () =>
    init.materialized === false ? [] : children.map(([, child]) => child.node);
  const node: Record<string, any> = {
    value: () => init.value,
    errors: () => errors,
    invalid,
    pending,
    disabled: () => !!init.disabledReasons?.length,
    disabledReasons: () => init.disabledReasons ?? [],
    touched: () => init.touched ?? false,
    dirty: () => init.dirty ?? false,
    required: () => init.required ?? false,
    readonly: () => false,
    hidden: () => false,
    formFieldBindings: () => [],
    keyInParent: () => '',
    structure: { materializedChildren: materialized },
  };
  for (const [key, child] of children) child.node['keyInParent'] = () => key;
  const tree = fieldTree(node, init.value);
  node['fieldProxy'] = tree;
  const setRoot = (n: Record<string, any>) => {
    n['structure'].root = node;
    for (const child of n['structure'].materializedChildren()) setRoot(child);
  };
  setRoot(node);
  return { node, tree };
}

function signupForm() {
  const name = fakeField({ value: 'Kam', required: true, touched: true, dirty: true });
  const email = fakeField({
    value: 'nope',
    errors: [{ kind: 'email', message: 'Enter a valid email address' }],
  });
  return fakeField({ value: { name: 'Kam', email: 'nope' }, children: { name, email } });
}

function fakeNg(
  components: Map<Element, unknown>,
  directives: Map<Element, unknown[]>,
  owners: Map<Element, unknown>,
): FormsDebugApi {
  return {
    getComponent: (el) => components.get(el) ?? null,
    getDirectives: (el) => directives.get(el) ?? [],
    getOwningComponent: (el) => owners.get(el) ?? null,
  };
}

describe('forms detection', () => {
  it('tells controls and field trees apart from other values', () => {
    expect(isAbstractControl(new FormControl(''))).toBe(true);
    expect(isAbstractControl(new FormGroup({}))).toBe(true);
    expect(isAbstractControl({ status: 'VALID' })).toBe(false);
    expect(isFieldTree(signupForm().tree)).toBe(true);
    expect(isFieldTree('form')).toBe(false);
  });

  it('never calls ordinary functions while checking for field trees', () => {
    let calls = 0;
    const logout = () => {
      calls++;
      return {};
    };
    expect(isFieldTree(logout)).toBe(false);
    expect(isFieldTree(logout.bind(null))).toBe(false);
    expect(isFieldTree(function save() {})).toBe(false);
    expect(calls).toBe(0);

    document.body.innerHTML = '<app-shell></app-shell>';
    const shell = document.querySelector('app-shell')!;
    class Shell {
      logout = logout;
    }
    collectForms(findForms(fakeNg(new Map([[shell, new Shell()]]), new Map(), new Map()), [shell]));
    expect(calls).toBe(0);
  });

  it('survives directives whose getters throw', () => {
    document.body.innerHTML = '<input id="broken">';
    const el = document.querySelector('#broken')!;
    const broken = directive([['', 'formControlName', '']], {});
    Object.defineProperty(broken, 'control', {
      get() {
        throw new Error('boom');
      },
    });
    const ng = fakeNg(new Map(), new Map([[el, [broken]]]), new Map());
    expect(() => collectForms(findForms(ng, [el]))).not.toThrow();
  });
});

describe('reactive serialization', () => {
  it('walks groups and arrays with paths, statuses and readable errors', () => {
    const form = new FormGroup({
      username: new FormControl('ab', [Validators.required, Validators.minLength(3)]),
      address: new FormGroup({ city: new FormControl('', Validators.required) }),
      phones: new FormArray([new FormControl('+90 555')], Validators.minLength(2)),
      notes: new FormControl('', { updateOn: 'blur' }),
    });
    form.controls.username.markAsTouched();

    const root = serializeControl(form);
    expect(root.type).toBe('group');
    expect(root.status).toBe('INVALID');

    const username = root.children!.find((c) => c.key === 'username')!;
    expect(username).toMatchObject({
      path: 'username',
      type: 'control',
      value: 'ab',
      touched: true,
    });
    expect(username.errors).toEqual([
      {
        kind: 'minlength',
        params: { requiredLength: 3, actualLength: 2 },
        message: 'needs at least 3 characters (has 2)',
        source: 'own',
      },
    ]);

    const city = root.children!.find((c) => c.key === 'address')!.children![0];
    expect(city).toMatchObject({ path: 'address.city', status: 'INVALID' });
    expect(city.errors[0]).toMatchObject({ kind: 'required', message: 'is required' });

    const phones = root.children!.find((c) => c.key === 'phones')!;
    expect(phones.type).toBe('array');
    expect(phones.children!.map((c) => c.path)).toEqual(['phones.0']);
    expect(phones.errors[0].message).toBe('needs at least 2 items (has 1)');

    expect(root.children!.find((c) => c.key === 'notes')!.updateOn).toBe('blur');
  });

  it('caps very wide arrays and very large values', () => {
    const array = new FormArray(Array.from({ length: 150 }, () => new FormControl(0)));
    const root = serializeControl(array);
    expect(root.children).toHaveLength(100);
    expect(root.truncated).toBe(50);

    const huge = Array.from({ length: 50_000 }, (_, i) => i);
    const value = serializeFormValue(huge) as unknown[];
    expect(value).toHaveLength(21);
    expect(value[20]).toBe('… 49980 more');
    expect(JSON.stringify(serializeFormValue({ a: { b: { c: { d: 1 } } } }))).toBe(
      '{"a":{"b":{"c":"{…}"}}}',
    );
  });

  it('reads a signal-backed control through its field tree', () => {
    const inner = signupForm();
    const control = Object.assign(new FormControl(''), { fieldTree: inner.tree });
    const node = serializeControl(control);
    expect(node.type).toBe('group');
    expect(node.children!.map((c) => c.key)).toEqual(['name', 'email']);
  });
});

describe('signal serialization', () => {
  it('shows invalid over pending, disabled reasons and fields Angular has not created yet', () => {
    const slow = fakeField({ value: 'x', pending: true });
    const bad = fakeField({ value: '', errors: [{ kind: 'required' }] });
    const locked = fakeField({ value: 'y', disabledReasons: [{ message: 'locked for review' }] });
    const root = fakeField({
      value: { slow: 'x', bad: '', locked: 'y', later: 'soon', gone: undefined },
      children: { slow, bad, locked },
    });
    const node = serializeField(root.node);
    expect(node.status).toBe('INVALID');
    expect(node.children!.map((c) => [c.key, c.status])).toEqual([
      ['slow', 'PENDING'],
      ['bad', 'INVALID'],
      ['locked', 'DISABLED'],
      ['later', 'VALID'],
    ]);
    expect(node.children![1].errors[0].message).toBe('is required');
    expect(node.children![2].disabledReasons).toEqual(['locked for review']);
    expect(node.children![3]).toMatchObject({ materialized: false, value: 'soon' });
    expect(node.children!.map((c) => c.key)).not.toContain('gone');
  });

  it('does not create children that Angular has not created', () => {
    const child = fakeField({ value: 'a' });
    const root = fakeField({ value: { a: 'a' }, children: { a: child }, materialized: false });
    const node = serializeField(root.node);
    expect(node.children).toEqual([
      expect.objectContaining({ key: 'a', materialized: false, value: 'a' }),
    ]);
  });
});

describe('collectForms', () => {
  it('finds all three kinds once each and labels them by component and property', () => {
    document.body.innerHTML = `
      <app-signup><input id="name"></app-signup>
      <app-account><form id="account"><input id="username"></form></app-account>
      <app-contact><form id="contact"><input id="city"></form></app-contact>
    `;
    const $ = (sel: string) => document.querySelector(sel)!;

    const signup = signupForm();
    const account = new FormGroup({ username: new FormControl('', Validators.required) });
    const filters = new FormGroup({ query: new FormControl('') });
    const contact = new FormGroup({ city: new FormControl('') });

    class SignupComponent {
      signup = signup.tree;
    }
    class AccountComponent {
      account = account;
      filters = filters;
    }
    class ContactComponent {}
    const components = new Map<Element, unknown>([
      [$('app-signup'), new SignupComponent()],
      [$('app-account'), new AccountComponent()],
      [$('app-contact'), new ContactComponent()],
    ]);
    const owners = new Map<Element, unknown>([
      [$('#name'), components.get($('app-signup'))],
      [$('#account'), components.get($('app-account'))],
      [$('#username'), components.get($('app-account'))],
      [$('#contact'), components.get($('app-contact'))],
      [$('#city'), components.get($('app-contact'))],
    ]);
    const directives = new Map<Element, unknown[]>([
      [
        $('#name'),
        [
          directive([['', 'formField', '']], {
            state: () => signup.node['structure'].materializedChildren()[0],
          }),
        ],
      ],
      [$('#account'), [directive([['', 'formGroup', '']], { form: account, submitted: true })]],
      [
        $('#username'),
        [
          directive([['', 'formControlName', '']], { control: account.controls.username }),
          directive([['', 'formControlName', '', '', 'required', '']], {}),
        ],
      ],
      [
        $('#contact'),
        [
          directive(
            [
              ['form', '', 3, 'ngNoForm', ''],
              ['', 'ngForm', ''],
            ],
            { form: contact },
          ),
        ],
      ],
      [
        $('#city'),
        [
          directive([['', 'ngModel', '', 3, 'formControlName', '']], {
            control: contact.controls.city,
          }),
        ],
      ],
    ]);
    const ng = fakeNg(components, directives, owners);

    const forms = collectForms(findForms(ng, document.querySelectorAll('*')));
    expect(forms.map((f) => [f.label, f.kind])).toEqual([
      ['SignupComponent.signup', 'signal'],
      ['AccountComponent.account', 'reactive'],
      ['ContactComponent.ngForm#contact', 'template'],
      ['AccountComponent.filters', 'reactive'],
    ]);

    const [signal, reactive] = forms;
    expect(signal.root.status).toBe('INVALID');
    expect(signal.root.children!.map((c) => [c.path, c.status])).toEqual([
      ['name', 'VALID'],
      ['email', 'INVALID'],
    ]);
    expect(reactive.submitted).toBe(true);
    expect(reactive.root.children![0]).toMatchObject({ path: 'username', bound: true });

    const found = findForms(ng, document.querySelectorAll('*')).forms[1];
    expect(findFieldElement(ng, document.querySelectorAll('*'), found, 'username')).toBe(
      $('#username'),
    );
    expect(findFieldElement(ng, document.querySelectorAll('*'), found, 'missing')).toBeNull();
  });

  it('gives template forms and standalone ngModels in one component distinct labels', () => {
    document.body.innerHTML = `
      <app-page>
        <form id="a"></form>
        <form></form>
        <input id="search" name="search">
      </app-page>
    `;
    const $ = (sel: string) => document.querySelector(sel)!;
    const forms = document.querySelectorAll('form');
    class Page {}
    const page = new Page();
    const search = new FormControl('');
    const ngForm = (form: FormGroup) =>
      directive(
        [
          ['form', '', 3, 'ngNoForm', ''],
          ['', 'ngForm', ''],
        ],
        { form },
      );
    const ng = fakeNg(
      new Map([[$('app-page'), page]]),
      new Map<Element, unknown[]>([
        [forms[0], [ngForm(new FormGroup({ a: new FormControl('') }))]],
        [forms[1], [ngForm(new FormGroup({ b: new FormControl('') }))]],
        [$('#search'), [directive([['', 'ngModel', '']], { control: search, name: 'search' })]],
      ]),
      new Map<Element, unknown>([
        [forms[0], page],
        [forms[1], page],
        [$('#search'), page],
      ]),
    );
    expect(collectForms(findForms(ng, document.querySelectorAll('*'))).map((f) => f.label)).toEqual(
      ['Page.ngForm#a', 'Page.ngForm', 'Page.ngModel(search)'],
    );

    forms[0].removeAttribute('id');
    const twice = fakeNg(
      new Map(),
      new Map<Element, unknown[]>([
        [forms[0], [ngForm(new FormGroup({ a: new FormControl('') }))]],
        [forms[1], [ngForm(new FormGroup({ b: new FormControl('') }))]],
      ]),
      new Map<Element, unknown>([
        [forms[0], page],
        [forms[1], page],
      ]),
    );
    expect(
      collectForms(findForms(twice, document.querySelectorAll('form'))).map((f) => f.label),
    ).toEqual(['Page.ngForm', 'Page.ngForm #2']);
  });
});

function control(path: string, overrides: Partial<FormFieldNode> = {}): FormFieldNode {
  return {
    key: path.split('.').pop()!,
    path,
    type: 'control',
    status: 'VALID',
    touched: false,
    dirty: false,
    bound: true,
    value: '',
    errors: [],
    ...overrides,
  };
}

function snapshot(root: FormFieldNode, extra: Partial<CollectedForm> = {}): CollectedForm {
  return { id: 'form-1', kind: 'signal', owner: 'Account', label: 'Account.form', root, ...extra };
}

function group(
  children: FormFieldNode[],
  status: FormFieldNode['status'] = 'INVALID',
): FormFieldNode {
  return { ...control(''), type: 'group', status, bound: false, value: undefined, children };
}

describe('diffForms', () => {
  it('reports touched and dirty for every field, not just the first', () => {
    const before = snapshot(group([control('a'), control('b')]), { kind: 'reactive' });
    const first = snapshot(group([control('a', { touched: true }), control('b')]), {
      kind: 'reactive',
    });
    const second = snapshot(
      group([control('a', { touched: true }), control('b', { touched: true, dirty: true })]),
      { kind: 'reactive' },
    );
    expect(diffForms([before], [first]).map((e) => [e.path, e.type])).toEqual([['a', 'touched']]);
    expect(diffForms([first], [second]).map((e) => [e.path, e.type])).toEqual([
      ['b', 'touched'],
      ['b', 'dirty'],
    ]);
  });

  it('reports value, status, touched and dirty changes per field', () => {
    const before = snapshot(group([control('name', { status: 'INVALID' })]));
    const after = snapshot(
      group([control('name', { value: 'Kam', status: 'VALID', touched: true, dirty: true })]),
    );
    const events = diffForms([before], [after], 1000);
    expect(events.map((e) => [e.path, e.type, e.detail])).toEqual([
      ['name', 'value', '"Kam"'],
      ['name', 'status', 'INVALID → VALID'],
      ['name', 'touched', 'true'],
      ['name', 'dirty', 'true'],
    ]);
    expect(events.every((e) => e.timestamp === 1000 && e.formId === 'form-1')).toBe(true);
  });

  it('reports one event when an array shrinks, not shifted values', () => {
    const list = (values: string[]): FormFieldNode => ({
      ...control('items'),
      type: 'array',
      children: values.map((v, i) => control(`items.${i}`, { value: v })),
    });
    const events = diffForms(
      [snapshot(group([list(['a', 'b', 'c'])]))],
      [snapshot(group([list(['b', 'c'])]))],
    );
    expect(events.map((e) => [e.path, e.type, e.detail])).toEqual([
      ['items', 'removed', '3 → 2 items'],
    ]);
  });

  it('reports nothing for a form it has not seen before', () => {
    expect(diffForms([], [snapshot(group([control('name')]))])).toEqual([]);
  });

  it('keeps a resized root array from hiding its own status change', () => {
    const list = (values: string[], status: FormFieldNode['status']): FormFieldNode => ({
      ...control(''),
      type: 'array',
      status,
      children: values.map((v, i) => control(`${i}`, { value: v })),
    });
    const events = diffForms(
      [snapshot(list(['a', 'b'], 'VALID'))],
      [snapshot(list(['a'], 'INVALID'))],
    );
    expect(events.map((e) => [e.path, e.type])).toEqual([
      ['', 'removed'],
      ['', 'status'],
    ]);
  });
});

describe('control events', () => {
  it('turns Angular control events into timeline entries with the changed path', () => {
    const form = new FormGroup({ address: new FormGroup({ city: new FormControl('') }) });
    const seen: FormEvent[] = [];
    const stop = watchControlEvents(form, 'form-9', (e) => seen.push(e))!;
    form.controls.address.controls.city.setValue('Izmir');
    form.controls.address.controls.city.markAsTouched();
    stop();
    form.controls.address.controls.city.setValue('Ankara');
    expect(seen.map((e) => [e.path, e.type, e.detail])).toEqual([
      ['address.city', 'value', '"Izmir"'],
      ['address.city', 'status', 'VALID'],
      ['address.city', 'touched', 'true'],
    ]);
  });

  it('maps submit and reset events by their class name', () => {
    class FormSubmittedEvent {
      source = null;
    }
    class FormResetEvent {
      source = null;
    }
    const root = new FormGroup({});
    expect(controlEventOf(root, 'f', new FormSubmittedEvent())?.type).toBe('submit');
    expect(controlEventOf(root, 'f', new FormResetEvent())?.type).toBe('reset');
  });
});

describe('describeError', () => {
  it('prefers the validator message and falls back to a description', () => {
    expect(describeError({ kind: 'email', message: 'Bad email' })).toBe('Bad email');
    expect(describeError({ kind: 'max', params: { max: 5, actual: 9 } })).toBe(
      'must be at most 5 (is 9)',
    );
    expect(describeError({ kind: 'custom', params: { message: 'Pick another' } })).toBe(
      'Pick another',
    );
    expect(describeError({ kind: 'taken' })).toBe('fails the "taken" validator');
  });

  it('says items for arrays', () => {
    expect(
      describeError({ kind: 'minlength', params: { requiredLength: 2, actualLength: 1 } }, 'array'),
    ).toBe('needs at least 2 items (has 1)');
  });
});

describe('redaction', () => {
  it('hides values of password inputs, secret-looking keys and one-time codes', () => {
    document.body.innerHTML = `
      <input id="pw" type="password">
      <input id="code" autocomplete="one-time-code">
      <input id="plain">
    `;
    const $ = (sel: string) => document.querySelector(sel)!;
    const form = new FormGroup({
      pw: new FormControl('hunter2'),
      code: new FormControl('123456'),
      plain: new FormControl('hello'),
      apiToken: new FormControl('abc'),
      card: new FormControl('4111111111111111', Validators.pattern(/^\d{4}$/)),
    });
    const elements = new WeakMap<object, Element>([
      [form.controls.pw, $('#pw')],
      [form.controls.code, $('#code')],
      [form.controls.plain, $('#plain')],
    ]);
    const root = serializeControl(form, elements);
    const values = Object.fromEntries(root.children!.map((c) => [c.key, c.value]));
    expect(values).toEqual({
      pw: '[redacted]',
      code: '[redacted]',
      plain: 'hello',
      apiToken: '[redacted]',
      card: '[redacted]',
    });
    const card = root.children!.find((c) => c.key === 'card')!;
    expect(JSON.stringify(card.errors)).not.toContain('4111');
  });

  it('keeps the input as the field element when another component also takes the control', () => {
    document.body.innerHTML = `
      <input id="confirm" type="password">
      <app-field-error id="err"></app-field-error>
    `;
    const $ = (sel: string) => document.querySelector(sel)!;
    const confirm = new FormControl('hunter2');
    const form = new FormGroup({ confirm });
    const ng = fakeNg(
      new Map(),
      new Map<Element, unknown[]>([
        [$('#confirm'), [directive([['', 'formControlName', '']], { control: confirm })]],
        [$('#err'), [directive([['app-field-error']], { control: confirm })]],
      ]),
      new Map<Element, unknown>([
        [$('#confirm'), {}],
        [$('#err'), {}],
      ]),
    );
    const found = findForms(ng, document.querySelectorAll('*'));
    expect(found.elements.get(confirm)).toBe($('#confirm'));
    const [collected] = collectForms(found);
    expect(collected.root.children![0].value).toBe('[redacted]');
    expect(JSON.stringify(collectForms(found))).not.toContain('hunter2');
    expect(form.value.confirm).toBe('hunter2');
  });

  it('redacts secret values in the event timeline', () => {
    document.body.innerHTML = '<input id="pw" type="password">';
    const form = new FormGroup({ pw: new FormControl('') });
    const elements = new WeakMap<object, Element>([
      [form.controls.pw, document.querySelector('#pw')!],
    ]);
    const seen: FormEvent[] = [];
    const stop = watchControlEvents(form, 'form-1', (e) => seen.push(e), {
      elements: () => elements,
    })!;
    form.controls.pw.setValue('hunter2');
    stop();
    expect(seen.find((e) => e.type === 'value')?.detail).toBe('"[redacted]"');
  });

  it('keeps a secret value out of its min and max errors', () => {
    const cvv = new FormControl(1234, Validators.max(999));
    const node = serializeControl(new FormGroup({ cvv })).children![0];
    expect(node.value).toBe('[redacted]');
    expect(JSON.stringify(node.errors)).not.toContain('1234');
    expect(node.errors[0].message).toBe('must be at most 999');
  });

  it('drops the typed length from a secret field without leaving a hole in the message', () => {
    document.body.innerHTML = '<input id="pw" type="password">';
    const pw = new FormControl('short', Validators.minLength(8));
    const node = serializeControl(
      new FormGroup({ pw }),
      new WeakMap([[pw, document.querySelector('#pw')!]]),
    ).children![0];
    expect(node.errors[0].message).toBe('needs at least 8 characters');
  });

  it('redacts a standalone control by the property that holds it, in snapshots and events', () => {
    document.body.innerHTML = '<app-settings></app-settings>';
    const host = document.querySelector('app-settings')!;
    const apiKey = new FormControl('');
    class Settings {
      apiKey = apiKey;
    }
    const ng = fakeNg(new Map([[host, new Settings()]]), new Map(), new Map());
    apiKey.setValue('sk-live-123');
    const [form] = collectForms(findForms(ng, [host]));
    expect(form.label).toBe('Settings.apiKey');
    expect(form.root.value).toBe('[redacted]');

    const seen: FormEvent[] = [];
    const stop = watchControlEvents(apiKey, form.id, (e) => seen.push(e), { rootKey: 'apiKey' })!;
    apiKey.setValue('sk-live-456');
    stop();
    expect(JSON.stringify(seen)).not.toContain('sk-live');
  });

  it('redacts nested object values by key', () => {
    expect(serializeFormValue({ user: 'kam', password: 'x' })).toEqual({
      user: 'kam',
      password: '[redacted]',
    });
  });
});

describe('extra reactive state', () => {
  it('shows validator presence, the reset value and the bound value accessor', () => {
    document.body.innerHTML = '<input id="name">';
    const el = document.querySelector('#name')!;
    const name = new FormControl('kam', {
      nonNullable: true,
      validators: Validators.required,
      asyncValidators: async () => null,
    });
    const form = new FormGroup({ name, note: new FormControl('') });
    class DefaultValueAccessor {}
    const ng = fakeNg(
      new Map(),
      new Map<Element, unknown[]>([
        [
          el,
          [
            directive([['', 'formControlName', '']], {
              control: name,
              valueAccessor: new DefaultValueAccessor(),
            }),
          ],
        ],
      ]),
      new Map<Element, unknown>([[el, { form }]]),
    );
    const [collected] = collectForms(findForms(ng, [el]));
    const [nameNode, noteNode] = collected.root.children!;
    expect(nameNode).toMatchObject({
      validators: { sync: true, async: true },
      defaultValue: 'kam',
      accessor: 'DefaultValueAccessor',
    });
    expect(noteNode.validators).toBeUndefined();
    expect(noteNode.defaultValue).toBeNull();
  });
});

describe('secret parents and disabled children', () => {
  it('redacts every field under a secret-named group or array, in snapshots and events', () => {
    const form = new FormGroup({
      passwords: new FormGroup({ first: new FormControl('a1'), second: new FormControl('a2') }),
      apiKeys: new FormArray([new FormControl('sk-1')]),
      name: new FormControl('kam'),
    });
    const text = JSON.stringify(serializeControl(form));
    expect(text).not.toMatch(/a1|a2|sk-1/);
    expect(text).toContain('kam');

    const seen: FormEvent[] = [];
    const stop = watchControlEvents(form, 'form-1', (e) => seen.push(e))!;
    form.controls.passwords.controls.first.setValue('new-secret');
    form.controls.apiKeys.at(0).setValue('sk-2');
    stop();
    expect(JSON.stringify(seen)).not.toMatch(/new-secret|sk-2/);
  });

  it('flags children of a secret-named group as redacted by their parent', () => {
    const form = new FormGroup({
      passwords: new FormGroup({ first: new FormControl('a1') }),
      apiKeys: new FormArray([new FormControl('sk-1')]),
    });
    const [passwords, apiKeys] = serializeControl(form).children!;
    expect(passwords.redacted).toBe('key');
    expect(passwords.children![0]).toMatchObject({ value: '[redacted]', redacted: 'parent' });
    expect(apiKeys.children![0]).toMatchObject({ value: '[redacted]', redacted: 'parent' });
  });

  it('flags Signal Forms children of a secret-named field, created or not', () => {
    const first = fakeField({ value: 'a1' });
    const passwords = fakeField({ value: { first: 'a1', second: 'a2' }, children: { first } });
    const root = fakeField({
      value: { passwords: { first: 'a1', second: 'a2' }, token: 't' },
      children: { passwords },
    });
    const [group, token] = serializeField(root.node).children!;
    expect(group.redacted).toBe('key');
    expect(group.children!.map((c) => [c.key, c.value, c.redacted])).toEqual([
      ['first', '[redacted]', 'parent'],
      ['second', '[redacted]', 'parent'],
    ]);
    expect(token).toMatchObject({ materialized: false, value: '[redacted]', redacted: 'key' });
  });

  it('leaves disabled children out of a group value event, like form.value', () => {
    const form = new FormGroup({ a: new FormControl('x'), b: new FormControl('y') });
    form.controls.b.disable();
    const seen: FormEvent[] = [];
    const stop = watchControlEvents(form, 'form-1', (e) => seen.push(e))!;
    form.setValue({ a: 'z', b: 'w' });
    stop();
    expect(seen.find((e) => e.type === 'value')?.detail).toBe(JSON.stringify(form.value));
  });

  it('reads the submitted flag after Angular updates it, so a minified reset is not a submit', async () => {
    class E {
      source: unknown = null;
    }
    const form = new FormGroup({});
    let submitted = true;
    const seen: FormEvent[] = [];
    const stop = watchControlEvents(form, 'form-1', (e) => seen.push(e), {
      submitted: () => submitted,
    })!;
    (form as unknown as { _events: { next(e: unknown): void } })._events.next(new E());
    submitted = false;
    await Promise.resolve();
    stop();
    expect(seen.map((e) => e.type)).toEqual(['reset']);
  });

  it('tells submit from reset by the submitted flag when class names are minified', () => {
    class E {
      source = null;
    }
    const root = new FormGroup({});
    expect(controlEventOf(root, 'f', new E(), { submitted: true })?.type).toBe('submit');
    expect(controlEventOf(root, 'f', new E(), { submitted: false })?.type).toBe('reset');
    expect(controlEventOf(root, 'f', new E())).toBeNull();
  });
});

describe('labels and ownership', () => {
  it('names a form after the property holding it, not a child control declared first', () => {
    document.body.innerHTML = '<form id="f"></form>';
    const el = document.querySelector('#f')!;
    const name = new FormControl('');
    const form = new FormGroup({ name });
    class Profile {
      name = name;
      form = form;
    }
    const profile = new Profile();
    const ng = fakeNg(
      new Map(),
      new Map<Element, unknown[]>([[el, [directive([['', 'formGroup', '']], { form })]]]),
      new Map<Element, unknown>([[el, profile]]),
    );
    expect(collectForms(findForms(ng, [el])).map((f) => f.label)).toEqual(['Profile.form']);
  });

  it('labels a nameless standalone ngModel by its id', () => {
    document.body.innerHTML = '<input id="solo">';
    const el = document.querySelector('#solo')!;
    class Page {}
    const ng = fakeNg(
      new Map(),
      new Map<Element, unknown[]>([
        [el, [directive([['', 'ngModel', '']], { control: new FormControl('') })]],
      ]),
      new Map<Element, unknown>([[el, new Page()]]),
    );
    expect(collectForms(findForms(ng, [el])).map((f) => f.label)).toEqual(['Page.ngModel(solo)']);
  });

  it('skips empty NgForms, such as the one Angular adds to a <form [formRoot]>', () => {
    document.body.innerHTML = '<form id="f"></form>';
    const el = document.querySelector('#f')!;
    const signup = signupForm();
    const ng = fakeNg(
      new Map(),
      new Map<Element, unknown[]>([
        [
          el,
          [
            directive([['form', '', 'formRoot', '']], { fieldTree: () => signup.tree }),
            directive(
              [
                ['form', '', 3, 'ngNoForm', ''],
                ['', 'ngForm', ''],
              ],
              { form: new FormGroup({}) },
            ),
          ],
        ],
      ]),
      new Map<Element, unknown>([[el, {}]]),
    );
    expect(findForms(ng, [el]).forms.map((f) => f.kind)).toEqual(['signal']);
  });

  it('reports a control owned by a signal form once, inside that form', () => {
    const legacy = new FormControl('', Validators.required);
    const leaf = fakeField({ value: '' });
    leaf.node['control'] = () => legacy;
    const root = fakeField({ value: { legacy: '' }, children: { legacy: leaf } });
    document.body.innerHTML = '<app-compat></app-compat>';
    const host = document.querySelector('app-compat')!;
    class Compat {
      cf = root.tree;
      legacy = legacy;
    }
    const ng = fakeNg(new Map([[host, new Compat()]]), new Map(), new Map());
    expect(findForms(ng, [host]).forms.map((f) => f.kind)).toEqual(['signal']);
  });
});

describe('findFieldElement for Signal Forms', () => {
  it('uses the field binding, and the form element for the root', () => {
    document.body.innerHTML = '<form id="f"><input id="name"></form>';
    const input = document.querySelector('#name')!;
    const form = document.querySelector('#f')!;
    const signup = signupForm();
    signup.node['structure'].materializedChildren()[0]['formFieldBindings'] = () => [
      { element: input },
    ];
    const ng = fakeNg(new Map(), new Map(), new Map());
    const found = { kind: 'signal' as const, root: signup.node, element: form };
    expect(findFieldElement(ng, [form, input], found, 'name')).toBe(input);
    expect(findFieldElement(ng, [form, input], found, '')).toBe(form);
    expect(findFieldElement(ng, [form, input], found, 'email')).toBeNull();
  });
});

describe('group value events', () => {
  it('redact password inputs under non-secret keys when the whole group changes', () => {
    document.body.innerHTML = '<input id="confirm" type="password">';
    const form = new FormGroup({
      user: new FormControl('kam'),
      confirm: new FormControl(''),
    });
    const elements = new WeakMap<object, Element>([
      [form.controls.confirm, document.querySelector('#confirm')!],
    ]);
    const seen: FormEvent[] = [];
    const stop = watchControlEvents(form, 'form-1', (e) => seen.push(e), {
      elements: () => elements,
    })!;
    form.setValue({ user: 'kam', confirm: 'hunter2' });
    form.reset();
    stop();
    const details = seen.filter((e) => e.type === 'value').map((e) => e.detail);
    expect(details.join(' ')).not.toContain('hunter2');
    expect(details[0]).toBe('{"user":"kam","confirm":"[redacted]"}');
  });
});

describe('Angular spec edge cases', () => {
  it('survives an invalid date instead of hiding every form', () => {
    const form = new FormGroup({ when: new FormControl(new Date('x')) });
    expect(() => serializeControl(form)).not.toThrow();
    expect(serializeControl(form).children![0].value).toBe('Invalid Date');
  });

  it('uses a string error detail as the message', () => {
    const email = new FormControl('a@b.co');
    email.setErrors({ server: 'Email already taken' });
    expect(serializeControl(email).errors).toEqual([
      { kind: 'server', message: 'Email already taken', source: 'manual' },
    ]);
  });

  it('serializes maps, sets, functions and DOM nodes safely', () => {
    document.body.innerHTML = '<input id="x">';
    expect(
      serializeFormValue({
        map: new Map([['a', 1]]),
        set: new Set([1, 2]),
        fn: () => 1,
        el: document.querySelector('#x'),
        __ngContext__: 7,
      }),
    ).toEqual({ map: { a: 1 }, set: [1, 2], fn: 'ƒ', el: '<input>' });
  });

  it('prefers the known element over scanning the page', () => {
    const control = new FormControl('');
    const form = new FormGroup({ name: control });
    document.body.innerHTML = '<input id="name">';
    const input = document.querySelector('#name')!;
    const ng = fakeNg(new Map(), new Map(), new Map());
    const found = { kind: 'reactive' as const, root: form };
    expect(findFieldElement(ng, [], found, 'name', new WeakMap([[control, input]]))).toBe(input);
  });
});
