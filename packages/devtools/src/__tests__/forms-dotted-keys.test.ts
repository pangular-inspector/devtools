// @vitest-environment jsdom
import '@angular/compiler';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormField, form } from '@angular/forms/signals';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { collectForms, controlPathOf, diffForms, findForms, nodeAt } from '../forms.ts';
import { runFormAction, type ActionContext } from '../forms-actions.ts';
import { fieldPath } from '../forms-read.ts';
import { formSourceIn } from '../rpc/forms-source.ts';
import { inferShape, requiredNow, schemaInputs, schemaRequired } from '../forms-webmcp.ts';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // already initialized in this worker
}

afterEach(() => TestBed.resetTestingModule());

const ngApi = () => (globalThis as any).ng;

function contextFor(host: HTMLElement): ActionContext {
  const all = () => host.querySelectorAll('*');
  const found = findForms(ngApi(), all());
  const forms = new Map(found.forms.map((f, i) => [`form-${i + 1}`, f]));
  return { ng: ngApi(), forms, elements: found.elements, all };
}

function collect(host: HTMLElement) {
  return collectForms(findForms(ngApi(), host.querySelectorAll('*')));
}

class Dotted {
  form = new FormGroup({
    'a.b': new FormControl(''),
    a: new FormGroup({ b: new FormControl('inner') }),
    'my.group': new FormGroup({ 'x.y': new FormControl(''), z: new FormControl('') }),
    'api.token': new FormControl(''),
    plain: new FormControl(''),
  });
}
Component({
  selector: 'dotted-form',
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <input id="ab" formControlName="a.b" />
      <div formGroupName="a"><input id="inner" formControlName="b" /></div>
      <div formGroupName="my.group">
        <input id="xy" formControlName="x.y" />
        <input id="z" formControlName="z" />
      </div>
      <input id="tok" formControlName="api.token" />
      <input id="plain" formControlName="plain" />
    </form>
  `,
})(Dotted);

class SignalDotted {
  model = signal({ 'a.b': '', a: { b: 'inner' }, plain: '' });
  form = form(this.model);
}
Component({
  selector: 'signal-dotted-form',
  imports: [FormField],
  template: `<input id="ab" [formField]="form['a.b']" /><input id="plain" [formField]="form.plain" />`,
})(SignalDotted);

class Slashed {
  form = new FormGroup({ 'a\\b': new FormControl(''), 'x.y': new FormControl('') });
}
Component({
  selector: 'slashed-form',
  imports: [ReactiveFormsModule],
  template: `<form [formGroup]="form">
    <input id="ab" [formControlName]="'a\\\\b'" /><input id="xy" [formControlName]="'x.y'" />
  </form>`,
})(Slashed);

class SignalSlashed {
  model = signal({ 'a\\b': '' });
  form = form(this.model);
}
Component({
  selector: 'signal-slashed-form',
  imports: [FormField],
  template: `<input id="ab" [formField]="form['a\\\\b']" />`,
})(SignalSlashed);

async function render<T>(type: new () => T) {
  const fixture = TestBed.createComponent(type);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

function paths(node: any, out: string[] = []): string[] {
  out.push(node.path);
  for (const child of node.children ?? []) paths(child, out);
  return out;
}

describe('control keys that contain a dot', () => {
  it('collects escaped paths and leaves plain ones unchanged', async () => {
    const fixture = await render(Dotted);
    const [collected] = collect(fixture.nativeElement);
    expect(paths(collected.root)).toEqual([
      '',
      'a\\.b',
      'a',
      'a.b',
      'my\\.group',
      'my\\.group.x\\.y',
      'my\\.group.z',
      'api\\.token',
      'plain',
    ]);
  });

  it('maps a control back to its escaped path and the path back to the control', async () => {
    const fixture = await render(Dotted);
    const found = findForms(ngApi(), fixture.nativeElement.querySelectorAll('*'));
    const root = fixture.componentInstance.form;
    expect(controlPathOf(root as any, root.controls['my.group'].controls['x.y'] as any)).toBe(
      'my\\.group.x\\.y',
    );
    expect(nodeAt(found.forms[0], 'a\\.b')).toBe(root.controls['a.b']);
    expect(nodeAt(found.forms[0], 'a.b')).toBe(root.controls.a.controls.b);
  });

  it('sets, fills and focuses the dotted control, not the one it used to be read as', async () => {
    const fixture = await render(Dotted);
    document.body.appendChild(fixture.nativeElement);
    const ctx = contextFor(fixture.nativeElement);
    const group = fixture.componentInstance.form;

    const set = await runFormAction(ctx, {
      action: 'set-value',
      formId: 'form-1',
      path: 'a\\.b',
      value: 'dotted',
      mode: 'user',
    });
    expect(set.ok).toBe(true);
    expect(group.controls['a.b'].value).toBe('dotted');
    expect(group.controls.a.controls.b.value).toBe('inner');

    const fill = await runFormAction(ctx, {
      action: 'fill',
      formId: 'form-1',
      values: { 'my\\.group.x\\.y': 'deep', 'a.b': 'nested' },
    });
    expect(fill.ok).toBe(true);
    expect(group.controls['my.group'].controls['x.y'].value).toBe('deep');
    expect(group.controls.a.controls.b.value).toBe('nested');

    const whole = await runFormAction(ctx, {
      action: 'set-value',
      formId: 'form-1',
      path: 'my\\.group',
      value: { 'x.y': 'whole', z: 'zed' },
    });
    expect(whole.ok).toBe(true);
    expect(group.controls['my.group'].controls['x.y'].value).toBe('whole');

    const focus = await runFormAction(ctx, { action: 'focus', formId: 'form-1', path: 'a\\.b' });
    expect(focus.ok).toBe(true);
    expect(document.activeElement?.id).toBe('ab');
    fixture.nativeElement.remove();
  });

  it('refuses a secret key by its own name and names it escaped', async () => {
    const fixture = await render(Dotted);
    const ctx = contextFor(fixture.nativeElement);
    const result = await runFormAction(ctx, {
      action: 'set-value',
      formId: 'form-1',
      path: 'api\\.token',
      value: 'x',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('is redacted');
    expect(fixture.componentInstance.form.controls['api.token'].value).toBe('');

    const nested = await runFormAction(ctx, {
      action: 'set-value',
      formId: 'form-1',
      path: 'my\\.group',
      value: { 'x.y': 'q', z: 'r', 'api.token': 'nope' },
    });
    expect(nested.ok).toBe(false);
    expect(nested.error).toContain('secret field "api\\.token"');
  });

  it('reports invalid paths and stored-global expressions in the escaped form', async () => {
    const fixture = await render(Dotted);
    const ctx = contextFor(fixture.nativeElement);
    const inner = fixture.componentInstance.form.controls['my.group'].controls['x.y'];
    inner.setErrors({ bad: true });
    const stored = await runFormAction(ctx, {
      action: 'store-as-global',
      formId: 'form-1',
      path: 'my\\.group.x\\.y',
    });
    expect(stored.invalid).toContain('my\\.group.x\\.y');
    expect(stored.expression).toBe("$form.get(['my.group','x.y'])");
    expect((window as any).$control).toBe(inner);
    const plain = await runFormAction(ctx, {
      action: 'store-as-global',
      formId: 'form-1',
      path: 'plain',
    });
    expect(plain.expression).toBe("$form.get('plain')");
  });

  it('diffs events at the escaped path', async () => {
    const fixture = await render(Dotted);
    const before = collect(fixture.nativeElement);
    fixture.componentInstance.form.controls['my.group'].controls['x.y'].setValue('changed');
    const events = diffForms(before, collect(fixture.nativeElement));
    expect(events.map((e) => e.path)).toContain('my\\.group.x\\.y');
  });

  it('works on Signal Forms keys', async () => {
    const fixture = await render(SignalDotted);
    document.body.appendChild(fixture.nativeElement);
    const ctx = contextFor(fixture.nativeElement);
    const [collected] = collect(fixture.nativeElement);
    expect(paths(collected.root)).toEqual(['', 'a\\.b', 'a', 'a.b', 'plain']);
    const result = await runFormAction(ctx, {
      action: 'set-value',
      formId: 'form-1',
      path: 'a\\.b',
      value: 'sig',
    });
    expect(result.ok).toBe(true);
    expect(fixture.componentInstance.model()['a.b']).toBe('sig');
    expect(fixture.componentInstance.model().a.b).toBe('inner');
    const focus = await runFormAction(ctx, { action: 'focus', formId: 'form-1', path: 'a\\.b' });
    expect(focus.ok).toBe(true);
    const stored = await runFormAction(ctx, {
      action: 'store-as-global',
      formId: 'form-1',
      path: 'a\\.b',
    });
    expect(stored.expression).toBe("$form['a.b']");
    fixture.nativeElement.remove();
  });

  it('builds a Signal Forms field path with an escaped key', async () => {
    const fixture = await render(SignalDotted);
    const found = findForms(ngApi(), fixture.nativeElement.querySelectorAll('*'));
    const field = (found.forms[0].root as any).fieldTree['a.b']();
    expect(fieldPath(field)).toBe('a\\.b');
  });
});

describe('WebMCP and source paths with dotted keys', () => {
  it('escapes dotted keys in inferred, required and input paths', () => {
    expect(inferShape({ 'a.b': null, ok: { 'c.d': undefined } }).blocking).toEqual([
      { path: 'a\\.b', reason: 'null' },
      { path: 'ok.c\\.d', reason: 'undefined' },
    ]);
    const schema = {
      type: 'object',
      properties: {
        'a.b': { type: 'string' },
        n: { type: 'object', properties: { 'c.d': { type: 'number' } }, required: ['c.d'] },
      },
      required: ['a.b'],
    };
    expect(schemaInputs(schema)).toEqual(['a\\.b: string', 'n.c\\.d: number']);
    expect(schemaRequired(schema)).toEqual(['a\\.b', 'n.c\\.d']);
  });

  it('keeps requiredNow in step with schemaRequired for dotted keys', () => {
    const node = (value: unknown, key: string): any => ({
      value: () => value,
      required: () => true,
      keyInParent: () => key,
      structure: {
        materializedChildren: () =>
          value && typeof value === 'object'
            ? Object.entries(value).map(([k, v]) => node(v, k))
            : [],
      },
    });
    expect([...requiredNow(node({ 'a.b': 'x' }, '')).keys()]).toEqual(['a\\.b']);
  });

  it('looks up the source rule by the unescaped key, not its last dotted piece', () => {
    const file = `
export class Account {
  account = new FormGroup({
    b: new FormControl('', Validators.required),
  });
}
`;
    expect(formSourceIn(file, 'a.ts', 'Account', 'account', 'a\\.b')?.rules).toEqual([]);
    expect(formSourceIn(file, 'a.ts', 'Account', 'account', 'b')?.rules).toHaveLength(1);
  });

  it('matches single and double quoted dotted keys in the source', () => {
    const file = `
export class Account {
  account = new FormGroup({
    'a.b': new FormControl('', Validators.required),
    "c.d": new FormControl('', Validators.required),
    b: new FormControl(''),
  });
}
`;
    expect(
      formSourceIn(file, 'a.ts', 'Account', 'account', 'a\\.b')?.rules.map((r) => r.line),
    ).toEqual([4]);
    expect(
      formSourceIn(file, 'a.ts', 'Account', 'account', 'c\\.d')?.rules.map((r) => r.line),
    ).toEqual([5]);
  });
});

describe('source lookup of keys with a backslash', () => {
  it('matches a key whose source literal escapes the backslash', () => {
    const file = [
      'export class Account {',
      '  account = new FormGroup({',
      "    'a\\\\b': new FormControl('', Validators.required),",
      "    b: new FormControl(''),",
      '  });',
      '}',
    ].join('\n');
    expect(
      formSourceIn(file, 'a.ts', 'Account', 'account', 'a\\\\b')?.rules.map((r) => r.line),
    ).toEqual([3]);
  });
});

describe('stored-global expressions with backslashes in keys', () => {
  it('writes a backslash as an escaped character in the reactive expression', async () => {
    const fixture = await render(Slashed);
    const ctx = contextFor(fixture.nativeElement);
    const slash = await runFormAction(ctx, {
      action: 'store-as-global',
      formId: 'form-1',
      path: 'a\\\\b',
    });
    expect(slash.expression).toBe(String.raw`$form.get('a\\b')`);
    const mixed = await runFormAction(ctx, {
      action: 'store-as-global',
      formId: 'form-1',
      path: 'x\\.y',
    });
    expect(mixed.expression).toBe("$form.get(['x.y'])");
  });

  it('uses bracket notation with an escaped backslash for Signal Forms', async () => {
    const fixture = await render(SignalSlashed);
    const ctx = contextFor(fixture.nativeElement);
    const result = await runFormAction(ctx, {
      action: 'store-as-global',
      formId: 'form-1',
      path: 'a\\\\b',
    });
    expect(result.expression).toBe(String.raw`$form['a\\b']`);
  });
});
