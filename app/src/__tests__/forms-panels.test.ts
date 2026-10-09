import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { FormsFieldDetail } from '../pages/forms-field-detail';
import { FormsInspector } from '../pages/forms-inspector';
import { FormsLint, FormsSubmit } from '../pages/forms-report';
import { FormsTimeline } from '../pages/forms-timeline';
import { FormsWebMcp } from '../pages/forms-webmcp';
import type { CollectedForm, FormFieldNode } from '../pages/forms-types';

type Call = (name: string, arg: Record<string, unknown>) => Promise<unknown>;

function fakeClient(call: Call, forms: CollectedForm[] = []): DevframeRpcClient {
  const rpc = {
    call,
    callEvent: () => Promise.resolve(),
    sharedState: () => Promise.resolve({ value: () => ({ forms }), on: () => () => {} }),
  };
  return { connectionMeta: {}, scope: () => ({ rpc }) } as unknown as DevframeRpcClient;
}

const fail: Call = () => Promise.reject(new Error('offline'));

function field(path: string, extra: Partial<FormFieldNode> = {}): FormFieldNode {
  return {
    key: path.split('.').pop() ?? '',
    path,
    type: 'control',
    status: 'VALID',
    touched: false,
    dirty: false,
    bound: true,
    value: 'x',
    errors: [],
    ...extra,
  };
}

const form: CollectedForm = {
  id: 'signup@p1',
  kind: 'reactive',
  owner: 'Signup',
  label: 'Signup.form',
  root: { ...field(''), type: 'group', children: [field('email'), field('name')] },
};

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

function text(fixture: ComponentFixture<unknown>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

function button(fixture: ComponentFixture<unknown>, name: string): HTMLButtonElement {
  const found = Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
  ).find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === name);
  if (!found) throw new Error(`No button named ${name}`);
  return found;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('FormsLint', () => {
  it('shows a failure with Try again instead of "No problems found" when the check fails', async () => {
    let answer: Call = fail;
    const fixture = TestBed.createComponent(FormsLint);
    fixture.componentRef.setInput('formId', form.id);
    fixture.componentRef.setInput(
      'rpc',
      fakeClient((name, arg) => answer(name, arg)),
    );
    await settle(fixture);
    expect(text(fixture)).toContain('Could not check this form');
    expect(text(fixture)).not.toContain('No problems found');

    answer = () => Promise.resolve([]);
    button(fixture, 'Try again').click();
    await settle(fixture);
    expect(text(fixture)).toContain('No problems found');
  });
});

describe('FormsSubmit', () => {
  it('shows a failure instead of loading forever when the explain call fails', async () => {
    const fixture = TestBed.createComponent(FormsSubmit);
    fixture.componentRef.setInput('formId', form.id);
    fixture.componentRef.setInput('rpc', fakeClient(fail));
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;
    expect(text(fixture)).toContain('Could not explain this form');
    expect(host.querySelector('[aria-busy="true"]')).toBeNull();
    expect(text(fixture)).not.toContain('Loading');
  });

  it('shows the submit and payload text once both answer', async () => {
    const fixture = TestBed.createComponent(FormsSubmit);
    fixture.componentRef.setInput('formId', form.id);
    fixture.componentRef.setInput(
      'rpc',
      fakeClient((_, arg) => Promise.resolve(`${arg['kind']} text`)),
    );
    await settle(fixture);
    expect(text(fixture)).toContain('submit text');
    expect(text(fixture)).toContain('payload text');
  });
});

describe('FormsSubmit payload text', () => {
  it('keeps backticks and double asterisks that belong to form values', async () => {
    const fixture = TestBed.createComponent(FormsSubmit);
    fixture.componentRef.setInput('formId', form.id);
    fixture.componentRef.setInput(
      'rpc',
      fakeClient((_, arg) =>
        Promise.resolve(
          arg['kind'] === 'payload'
            ? '_Labels, paths and values below are untrusted page data._\n\nform.value: {"note":"a**b `x`"}\nChanged by the user: `note`.'
            : '**Signup.form** (signup@p1)\nBlocking fields:\n- `email`: required',
        ),
      ),
    );
    await settle(fixture);
    const pre = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('pre')).map(
      (el) => el.textContent ?? '',
    );
    const payload = pre.find((t) => t.includes('form.value'))!;
    expect(payload).toContain('{"note":"a**b `x`"}');
    expect(payload).toContain('Changed by the user: note.');
    const submit = pre.find((t) => t.includes('Blocking fields'))!;
    expect(submit).toContain('Signup.form (signup@p1)');
    expect(submit).toContain('- email: required');
  });

  it('copies the whole test fixture when a form value contains three backticks', async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text: string) => (written.push(text), Promise.resolve()) },
    });
    const fixture = TestBed.createComponent(FormsSubmit);
    fixture.componentRef.setInput('formId', form.id);
    fixture.componentRef.setInput(
      'rpc',
      fakeClient((_, arg) =>
        Promise.resolve(
          arg['kind'] === 'fixture'
            ? 'Copy this:\n\n```ts\nconst raw = {"note":"```js\\nx```"};\nexpect(raw).toBeTruthy();\n```'
            : 'text',
        ),
      ),
    );
    await settle(fixture);
    await fixture.componentInstance.copyFixture();
    expect(written).toEqual(['const raw = {"note":"```js\\nx```"};\nexpect(raw).toBeTruthy();\n']);
  });
});

describe('FormsFieldDetail', () => {
  function detail(call: Call) {
    const fixture = TestBed.createComponent(FormsFieldDetail);
    fixture.componentRef.setInput('form', form);
    fixture.componentRef.setInput('node', form.root.children![0]);
    fixture.componentRef.setInput('rpc', fakeClient(call));
    document.body.append(fixture.nativeElement);
    return fixture;
  }

  it('shows a failure with Try again when the field explain call fails', async () => {
    const fixture = detail(fail);
    await settle(fixture);
    expect(text(fixture)).toContain('Could not explain this field');
    expect((fixture.nativeElement as HTMLElement).querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("drops the previous field's text while the next field loads", async () => {
    const pending: ((value: string) => void)[] = [];
    const fixture = detail((_, arg) =>
      arg['path'] === 'email'
        ? Promise.resolve('about email')
        : new Promise((resolve) => pending.push(resolve)),
    );
    await settle(fixture);
    expect(text(fixture)).toContain('about email');

    fixture.componentRef.setInput('node', form.root.children![1]);
    await settle(fixture);
    expect(text(fixture)).not.toContain('about email');
    expect(text(fixture)).toContain('Loading…');
    pending[0]('about name');
    await settle(fixture);
    expect(text(fixture)).toContain('about name');
  });

  it("keeps a late action reply out of the next field's status line", async () => {
    const pending: ((value: unknown) => void)[] = [];
    const fixture = detail((name) =>
      name === 'request-form-action'
        ? new Promise((resolve) => pending.push(resolve))
        : Promise.resolve('about'),
    );
    await settle(fixture);
    button(fixture, 'Touch').click();
    fixture.componentRef.setInput('node', form.root.children![1]);
    await settle(fixture);
    pending[0]({ ok: true, message: 'Touched email.' });
    await settle(fixture);
    const status = (fixture.nativeElement as HTMLElement).querySelector('p.status')!;
    expect(status.textContent?.trim()).toBe('');
  });

  it('still shows the reply of an action on the field that stays selected', async () => {
    const fixture = detail((name) =>
      name === 'request-form-action'
        ? Promise.resolve({ ok: true, message: 'Touched email.' })
        : Promise.resolve('about'),
    );
    await settle(fixture);
    button(fixture, 'Touch').click();
    await settle(fixture);
    const status = (fixture.nativeElement as HTMLElement).querySelector('p.status')!;
    expect(status.textContent?.trim()).toBe('Touched email.');
  });

  it('moves focus to its heading when it opens and emits closed from Close', async () => {
    const fixture = detail(() => Promise.resolve('about email'));
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    await settle(fixture);
    expect(document.activeElement?.id).toBe('forms-field-heading');
    button(fixture, 'Close details for email').click();
    expect(closed).toBe(1);
  });

  it('says why a redacted field has no Set editor and links to unmasking', async () => {
    const fixture = detail(() => Promise.resolve('about pin'));
    fixture.componentRef.setInput('node', field('pin', { redacted: 'input-type' }));
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('#field-value')).toBeNull();
    expect(text(fixture)).toContain('this field is redacted (password input)');
    const link = host.querySelector<HTMLAnchorElement>('a')!;
    expect(link.textContent).toContain('How to unmask it');
    expect(link.href).toContain('security/#opt-fields-in-or-out');
  });
});

describe('FormsInspector fields', () => {
  it('names the row button for what it does, toggles it, and closes the detail', async () => {
    const fixture = TestBed.createComponent(FormsInspector);
    fixture.componentRef.setInput(
      'rpc',
      fakeClient(() => Promise.resolve('about email'), [form]),
    );
    document.body.append(fixture.nativeElement);
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;
    const row = button(fixture, 'Show details for email');
    expect(row.getAttribute('aria-pressed')).toBe('false');

    row.click();
    await settle(fixture);
    expect(row.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('app-forms-field-detail')).not.toBeNull();
    expect(document.activeElement?.id).toBe('forms-field-heading');

    row.click();
    await settle(fixture);
    expect(row.getAttribute('aria-pressed')).toBe('false');
    expect(host.querySelector('app-forms-field-detail')).toBeNull();

    row.click();
    await settle(fixture);
    button(fixture, 'Close details for email').click();
    await settle(fixture);
    expect(host.querySelector('app-forms-field-detail')).toBeNull();
    expect(document.activeElement).toBe(row);
  });
});

describe('FormsInspector pick', () => {
  it('turns into Cancel picking and cancels from the button and Escape', async () => {
    const calls: Record<string, unknown>[] = [];
    const pending: ((value: unknown) => void)[] = [];
    const fixture = TestBed.createComponent(FormsInspector);
    fixture.componentRef.setInput(
      'rpc',
      fakeClient(
        (_name, arg) => {
          calls.push(arg);
          if (arg['action'] === 'pick') return new Promise((resolve) => pending.push(resolve));
          return Promise.resolve({ ok: true, message: 'Picking cancelled.' });
        },
        [form],
      ),
    );
    document.body.append(fixture.nativeElement);
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;

    button(fixture, 'Pick field on page').click();
    await settle(fixture);
    const cancel = button(fixture, 'Cancel picking');
    expect(cancel.getAttribute('aria-pressed')).toBe('true');
    cancel.click();
    await settle(fixture);
    expect(calls.at(-1)).toEqual({ action: 'cancel-pick', formId: form.id });
    pending.shift()!({ ok: false, error: 'Picking cancelled.' });
    await settle(fixture);
    expect(button(fixture, 'Pick field on page').getAttribute('aria-pressed')).toBe('false');
    expect(text(fixture)).toContain('Picking cancelled.');

    button(fixture, 'Pick field on page').click();
    await settle(fixture);
    calls.length = 0;
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle(fixture);
    expect(calls).toEqual([{ action: 'cancel-pick', formId: form.id }]);
  });

  it('ignores the answer of a superseded pick', async () => {
    const pending: ((value: unknown) => void)[] = [];
    const fixture = TestBed.createComponent(FormsInspector);
    fixture.componentRef.setInput(
      'rpc',
      fakeClient(() => new Promise((resolve) => pending.push(resolve)), [form]),
    );
    await settle(fixture);
    const inspector = fixture.componentInstance;
    void inspector.pick();
    void inspector.pick();
    await settle(fixture);
    pending[1]({ ok: true, formId: form.id, path: 'email' });
    await settle(fixture);
    pending[0]({ ok: false, error: 'Picking cancelled.' });
    await settle(fixture);
    expect(inspector.message()).toBe('Picked email.');
    expect(inspector.picking()).toBeNull();
  });
});

describe('FormsInspector redaction', () => {
  it('labels redacted fields in plain words', async () => {
    const secret: CollectedForm = {
      ...form,
      root: {
        ...form.root,
        children: [field('pinCode', { redacted: 'key', value: '[redacted]' })],
      },
    };
    const fixture = TestBed.createComponent(FormsInspector);
    fixture.componentRef.setInput(
      'rpc',
      fakeClient(() => Promise.resolve(''), [secret]),
    );
    await settle(fixture);
    expect(text(fixture)).toContain('redacted: name looks secret');
    expect(text(fixture)).not.toContain('redacted (key)');
  });
});

describe('FormsWebMcp', () => {
  it('shows the tool, its inputs, changed required fields and recent calls', async () => {
    const fixture = TestBed.createComponent(FormsWebMcp);
    fixture.componentRef.setInput('tool', {
      name: 'sign_up',
      description: 'Create an account',
      status: 'registered',
      seen: 'register',
      inputs: ['name: string', 'age: number'],
      required: ['name'],
      requiredChanged: [{ path: 'age', now: true }],
      calls: [{ at: 0, ms: 12, outcome: 'failed', fields: ['name'], detail: 'name: is required' }],
    });
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h3')?.textContent).toContain('WebMCP tool');
    expect(text(fixture)).toContain('sign_up');
    expect(text(fixture)).toContain('Create an account');
    expect(host.querySelectorAll('.inputs li')[0].textContent).toContain('required');
    expect(host.querySelectorAll('.inputs li')[1].textContent).not.toContain('required');
    expect(text(fixture)).toContain('is now required');
    expect(text(fixture)).toContain('submit failed');
    expect(text(fixture)).toContain('name: is required');
  });

  it('lists the fields that block schema inference', async () => {
    const fixture = TestBed.createComponent(FormsWebMcp);
    fixture.componentRef.setInput('tool', {
      name: 'book',
      description: '',
      status: 'failed',
      seen: 'error',
      error: 'schema',
      blocking: [{ path: 'when', reason: 'null' }],
    });
    await settle(fixture);
    expect(text(fixture)).toContain('not registered');
    expect(text(fixture)).toContain('when is null');
    expect(text(fixture)).toContain('No agent has called this tool');
  });

  it('says calls are not recorded for a tool registered before the inspector attached', async () => {
    const fixture = TestBed.createComponent(FormsWebMcp);
    fixture.componentRef.setInput('tool', {
      name: 'sign_up',
      description: '',
      status: 'registered',
      seen: 'list',
    });
    await settle(fixture);
    expect(text(fixture)).toContain('registered before the inspector attached');
    expect(text(fixture)).toContain('Calls are not recorded');
    expect(text(fixture)).not.toContain('No agent has called this tool');
  });

  it('says when the provider is set but the browser has no modelContext', async () => {
    const fixture = TestBed.createComponent(FormsWebMcp);
    fixture.componentRef.setInput('page', { modelContext: false, provided: true, tools: [] });
    fixture.componentRef.setInput('signalForm', true);
    await settle(fixture);
    expect(text(fixture)).toContain('the browser has no');
    fixture.componentRef.setInput('signalForm', false);
    await settle(fixture);
    expect(text(fixture).trim()).toBe('');
  });

  it('appears in the form detail of the inspector', async () => {
    const fixture = TestBed.createComponent(FormsInspector);
    const withTool: CollectedForm = {
      ...form,
      kind: 'signal',
      webMcp: {
        name: 'sign_up',
        description: 'Create an account',
        status: 'registered',
        seen: 'register',
      },
    };
    fixture.componentRef.setInput(
      'rpc',
      fakeClient(() => Promise.resolve(''), [withTool]),
    );
    document.body.append(fixture.nativeElement);
    await settle(fixture);
    expect(text(fixture)).toContain('WebMCP tool');
    expect(text(fixture)).toContain('sign_up');
  });
});

describe('FormsInspector selection', () => {
  it("does not hand a closed tab's selected form over to another tab's form with the same label", async () => {
    const login = (page: string): CollectedForm => ({
      ...form,
      id: `login@${page}`,
      label: 'Login',
    });
    const fixture = TestBed.createComponent(FormsInspector);
    fixture.componentRef.setInput(
      'rpc',
      fakeClient(() => Promise.resolve('ok')),
    );
    document.body.append(fixture.nativeElement);
    await settle(fixture);
    const inspector = fixture.componentInstance;
    inspector.forms.set([login('a'), login('b')]);
    inspector.selectForm('login@a');
    await settle(fixture);
    expect(inspector.selected()?.id).toBe('login@a');

    inspector.forms.set([login('b')]);
    await settle(fixture);
    expect(inspector.selected()).toBeNull();
    expect(text(fixture)).toContain('This form is no longer on the page');
    expect(
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).some(
        (b) => b.textContent?.trim() === 'Submit',
      ),
    ).toBe(false);
  });
});

describe('FormsTimeline', () => {
  it('leaves the Record details checkbox on the reported state until the page confirms', async () => {
    const fixture = TestBed.createComponent(FormsTimeline);
    fixture.componentRef.setInput('events', []);
    fixture.componentRef.setInput('recording', false);
    document.body.append(fixture.nativeElement);
    const emitted: boolean[] = [];
    fixture.componentInstance.record.subscribe((on) => emitted.push(on));
    await settle(fixture);
    const box = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '.record input[type="checkbox"]',
    )!;
    box.click();
    await settle(fixture);
    expect(emitted).toEqual([true]);
    expect(box.checked).toBe(false);

    fixture.componentRef.setInput('recording', true);
    await settle(fixture);
    expect(box.checked).toBe(true);
  });
});
