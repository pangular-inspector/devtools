// @vitest-environment jsdom
import '@angular/compiler';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  FormField,
  FormRoot,
  form,
  provideExperimentalWebMcpForms,
  required,
} from '@angular/forms/signals';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachForms, setupErrorOf } from '../forms-collector.ts';
import type { FormEvent } from '../forms.ts';

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

class Login {
  form = new FormGroup({
    email: new FormControl('', Validators.required),
  });
}
Component({
  selector: 'login-form',
  imports: [ReactiveFormsModule],
  template: `<form [formGroup]="form"><input id="email" formControlName="email" /><button>Go</button></form>`,
})(Login);

class Profile {
  form = form(signal({ name: '' }), (p) => required(p.name), {
    submission: { action: async () => undefined },
  });
}
Component({
  selector: 'profile-form',
  imports: [FormField, FormRoot],
  template: `<form [formRoot]="form"><input id="pname" [formField]="form.name" /><button>Go</button></form>`,
})(Profile);

class SignUp {
  form = form(signal({ name: '', age: 20 }), (p) => required(p.name), {
    submission: { action: async () => undefined },
    experimentalWebMcpTool: { name: 'sign_up', description: 'Create an account' },
  });
}
Component({
  selector: 'sign-up-form',
  imports: [FormField, FormRoot],
  template: `<form [formRoot]="form"><input id="sname" [formField]="form.name" /><button>Go</button></form>`,
})(SignUp);

function harness(maxEvents?: number) {
  const calls: { name: string; args: any[] }[] = [];
  const handlers = new Map<string, (...args: any[]) => unknown>();
  const my = {
    rpc: {
      call: async (name: string, ...args: unknown[]) => {
        calls.push({ name, args });
      },
      register: (def: { name: string; handler: (...args: any[]) => unknown }) => {
        handlers.set(def.name, def.handler);
      },
    },
  };
  const highlight = { show: vi.fn(), clear: vi.fn() };
  const collector = attachForms(my, 'pg', () => (globalThis as any).ng, highlight, maxEvents);
  stops.push(collector.stop);
  const reports = () => calls.filter((c) => c.name === 'push-forms').map((c) => c.args[0]);
  const lastEvents = (): FormEvent[] => reports().at(-1)?.events ?? [];
  return { calls, handlers, collector, reports, lastEvents, highlight };
}

const tick = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

async function mount<T>(type: new () => T) {
  const fixture = TestBed.createComponent(type);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('forms collector', () => {
  it('tags typing as user and code changes as code, with prev and repeat counts', async () => {
    const fixture = await mount(Login);
    const h = harness();
    h.collector.push();
    await tick();
    const input = document.getElementById('email') as HTMLInputElement;
    for (const text of ['a', 'ab', 'abc']) {
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await tick();
    fixture.componentInstance.form.controls.email.setValue('code@x.io');
    await tick();
    const values = h.lastEvents().filter((e) => e.type === 'value' && e.path === 'email');
    expect(values[0]).toMatchObject({ origin: 'user', count: 3, detail: '"abc"', prev: '""' });
    expect(values[1]).toMatchObject({ origin: 'code', detail: '"code@x.io"', prev: '"abc"' });
    expect(h.reports().at(-1).forms[0].submitDom.buttons).toBe(1);
  });

  it('keeps at most the configured number of timeline events', async () => {
    const fixture = await mount(Login);
    const h = harness(10);
    h.collector.push();
    await tick();
    const email = fixture.componentInstance.form.controls.email;
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      for (let i = 0; i < 15; i++) {
        vi.setSystemTime(Date.now() + 5000);
        email.setValue(`v${i}@x.io`);
      }
    } finally {
      vi.useRealTimers();
    }
    h.collector.push();
    await tick();
    const events = h.lastEvents();
    expect(events).toHaveLength(10);
    expect(events.map((e) => e.detail)).toContain('"v14@x.io"');
    expect(events.map((e) => e.detail)).not.toContain('"v0@x.io"');
    expect(h.reports().at(-1).dropped).toBeGreaterThanOrEqual(5);
    expect(h.reports()[0].dropped).toBeUndefined();
  });

  it('records Signal Forms submits as blocked or ran', async () => {
    const fixture = await mount(Profile);
    const h = harness();
    h.collector.push();
    await tick();
    const formEl = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    formEl.requestSubmit();
    await tick();
    fixture.componentInstance.form.name().value.set('Ada');
    formEl.requestSubmit();
    await tick();
    const submits = h.lastEvents().filter((e) => e.type === 'submit');
    expect(submits.map((e) => e.outcome)).toEqual(['blocked', 'ran']);
  });

  it('lets go of a Signal Form once it leaves the page', async () => {
    const fixture = await mount(Profile);
    const root = fixture.componentInstance.form() as any;
    const flag = root.submitState.selfSubmitting;
    const model = root.structure.value;
    const original = { flag: flag.set, set: model.set, update: model.update };
    const h = harness();
    h.collector.push();
    await tick();
    const formId = h.reports().at(-1).forms[0].id;
    h.handlers.get('form-action')!({
      requestId: 'i1',
      request: { action: 'instrument', formId, value: true },
    });
    await tick();
    expect(flag.set).not.toBe(original.flag);
    expect(model.set).not.toBe(original.set);

    fixture.destroy();
    fixture.nativeElement.remove();
    await tick();
    h.collector.push();
    await tick();
    expect(h.reports().at(-1).forms).toEqual([]);
    expect(flag.set).toBe(original.flag);
    expect(model.set).toBe(original.set);
    expect(model.update).toBe(original.update);
  });

  it('wraps a Signal Form again when a new one appears after the old one left', async () => {
    const first = await mount(Profile);
    const h = harness();
    h.collector.push();
    await tick();
    first.destroy();
    first.nativeElement.remove();
    await tick();
    h.collector.push();
    await tick();
    const second = await mount(Profile);
    h.collector.push();
    await tick();
    const formEl = second.nativeElement.querySelector('form') as HTMLFormElement;
    formEl.requestSubmit();
    await tick();
    expect(
      h
        .lastEvents()
        .filter((e) => e.type === 'submit')
        .map((e) => e.outcome),
    ).toEqual(['blocked']);
  });

  it('tags Signal Forms changes found by diffing as user or unknown', async () => {
    const fixture = await mount(Profile);
    const h = harness();
    h.collector.push();
    await tick();
    const input = document.getElementById('pname') as HTMLInputElement;
    input.value = 'Ada';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    fixture.componentInstance.form.name().value.set('Bob');
    h.collector.push();
    await tick();
    const values = h.lastEvents().filter((e) => e.type === 'value' && e.path === 'name');
    expect(values.map((e) => [e.detail, e.origin])).toEqual([
      ['"Ada"', 'user'],
      ['"Bob"', undefined],
    ]);
  });

  it('answers form actions for its own forms only', async () => {
    const fixture = await mount(Login);
    const h = harness();
    h.collector.push();
    await tick();
    const formId = h.reports().at(-1).forms[0].id;
    h.handlers.get('form-action')!({
      requestId: 'r1',
      pageId: 'other',
      request: { action: 'touch-all', formId },
    });
    h.handlers.get('form-action')!({
      requestId: 'r2',
      pageId: 'pg',
      request: { action: 'touch-all', formId },
    });
    h.handlers.get('form-action')!({ requestId: 'r3', request: { action: 'drop-tables', formId } });
    await tick(200);
    const answers = h.calls.filter((c) => c.name === 'form-action-result').map((c) => c.args[0]);
    expect(answers.map((a) => a.requestId)).toEqual(['r3', 'r2']);
    expect(answers[0].result.error).toBe('Unknown form action.');
    expect(answers[1].result).toMatchObject({ ok: true });
    expect(fixture.componentInstance.form.controls.email.touched).toBe(true);
  });

  it('records callers, validator changes and async timing once instrumented', async () => {
    const fixture = await mount(Login);
    const h = harness();
    h.collector.push();
    await tick();
    const formId = h.reports().at(-1).forms[0].id;
    h.handlers.get('form-action')!({
      requestId: 'i1',
      request: { action: 'instrument', formId, value: true },
    });
    await tick();
    expect(h.reports().at(-1).instrumented).toBe(true);
    const email = fixture.componentInstance.form.controls.email;
    function prefillFromProfile() {
      email.setValue('kam@example.com');
    }
    prefillFromProfile();
    function checkAvailability() {
      email.setAsyncValidators(() => new Promise((resolve) => setTimeout(() => resolve(null), 40)));
    }
    checkAvailability();
    email.updateValueAndValidity();
    await tick(200);
    const events = h.lastEvents();
    const value = events.find((e) => e.type === 'value' && e.detail === '"kam@example.com"');
    expect(value).toMatchObject({ origin: 'code' });
    expect(value?.caller).toContain('prefillFromProfile');
    expect(events.find((e) => e.type === 'validators')).toMatchObject({
      path: 'email',
      detail: 'setAsyncValidators',
    });
    const settled = events.filter(
      (e) => e.type === 'status' && e.path === 'email' && e.ms !== undefined,
    );
    expect(settled.at(-1)!.ms).toBeGreaterThanOrEqual(30);
    h.handlers.get('form-action')!({
      requestId: 'i2',
      request: { action: 'instrument', formId, value: false },
    });
    await tick();
    expect(h.reports().at(-1).instrumented).toBe(false);
  });

  it('lets the user pick a field on the page', async () => {
    await mount(Login);
    const h = harness();
    h.collector.push();
    await tick();
    const formId = h.reports().at(-1).forms[0].id;
    h.handlers.get('form-action')!({ requestId: 'p1', request: { action: 'pick', formId } });
    await tick(20);
    const clicked = document.getElementById('email')!;
    clicked.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(h.highlight.show).toHaveBeenLastCalledWith(clicked);
    h.highlight.clear.mockClear();
    clicked.dispatchEvent(
      new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }),
    );
    expect(h.highlight.clear).not.toHaveBeenCalled();
    clicked.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: null }));
    expect(h.highlight.clear).toHaveBeenCalledTimes(1);
    let reachedApp = false;
    clicked.addEventListener('click', () => (reachedApp = true));
    clicked.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await tick(20);
    const answer = h.calls.find((c) => c.name === 'form-action-result')!.args[0];
    expect(answer.result).toMatchObject({ ok: true, formId, path: 'email' });
    expect(reachedApp).toBe(false);
  });

  it('cancels a pick from the panel', async () => {
    await mount(Login);
    const h = harness();
    h.collector.push();
    await tick();
    const formId = h.reports().at(-1).forms[0].id;
    h.handlers.get('form-action')!({ requestId: 'p1', request: { action: 'pick', formId } });
    await tick(20);
    h.handlers.get('form-action')!({ requestId: 'c1', request: { action: 'cancel-pick', formId } });
    await tick(20);
    const answers = h.calls.filter((c) => c.name === 'form-action-result').map((c) => c.args[0]);
    expect(answers.find((a) => a.requestId === 'p1').result).toMatchObject({
      ok: false,
      error: 'Picking cancelled.',
    });
    expect(answers.find((a) => a.requestId === 'c1').result).toMatchObject({ ok: true });
    let reachedApp = false;
    const clicked = document.getElementById('email')!;
    clicked.addEventListener('click', () => (reachedApp = true));
    clicked.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(reachedApp).toBe(true);
  });

  it('captures NG01xxx setup errors from console.error without leaking tokens', async () => {
    const original = console.error;
    console.error = () => {};
    try {
      const h = harness();
      console.error(new Error("NG01203: No value accessor for form control name: 'age'"));
      console.error('unrelated');
      await tick();
      expect(h.reports().at(-1)?.setupErrors).toEqual([
        "NG01203: No value accessor for form control name: 'age'",
      ]);
    } finally {
      stops.splice(0).forEach((stop) => stop());
      console.error = original;
    }
    expect(
      setupErrorOf([
        'NG01050: formControlName must be used with a parent formGroup Bearer abc.def',
      ]),
    ).toContain('Bearer [redacted]');
    expect(setupErrorOf(['plain error'])).toBeNull();
    expect(
      setupErrorOf([
        new Error(
          'Cannot register form "sign_up" as a WebMCP tool. Make sure to use `provideExperimentalWebMcpForms()`',
        ),
      ]),
    ).toMatch(/^Cannot register form "sign_up" as a WebMCP tool/);
  });

  it('restores console.error and stops listening on stop', () => {
    const original = console.error;
    const h = harness();
    expect(console.error).not.toBe(original);
    stops.pop()!();
    expect(console.error).toBe(original);
    expect(h.calls).toEqual([]);
  });

  it('shows the WebMCP tool of a Signal Form and tags agent calls as agent', async () => {
    const tools = new Map<string, { execute: (args: unknown) => Promise<unknown> }>();
    (navigator as any).modelContext = {
      registerTool: async (tool: {
        name: string;
        execute: (args: unknown) => Promise<unknown>;
      }) => {
        tools.set(tool.name, tool);
      },
    };
    try {
      TestBed.configureTestingModule({ providers: [provideExperimentalWebMcpForms()] });
      const h = harness();
      const fixture = await mount(SignUp);
      await tick();
      h.collector.push();
      await tick();
      const report = h.reports().at(-1);
      expect(report.webMcp).toEqual({ modelContext: true, tools: [] });
      expect(report.forms[0].webMcp).toMatchObject({
        name: 'sign_up',
        description: 'Create an account',
        status: 'registered',
        inputs: ['name: string', 'age: number'],
        required: ['name'],
      });
      const answer = await tools.get('sign_up')!.execute({ name: 'Ada', age: 30 });
      expect(answer).toMatchObject({ content: [{ text: 'Form submitted successfully.' }] });
      fixture.detectChanges();
      await tick();
      const last = h.reports().at(-1);
      expect(last.forms[0].webMcp.calls).toEqual([
        expect.objectContaining({ outcome: 'submitted', fields: ['name', 'age'] }),
      ]);
      const agentEvents = h.lastEvents().filter((e) => e.origin === 'agent');
      expect(agentEvents.map((e) => e.type)).toEqual(expect.arrayContaining(['submit', 'value']));
    } finally {
      delete (navigator as any).modelContext;
    }
  });
});
