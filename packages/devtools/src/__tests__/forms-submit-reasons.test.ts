// @vitest-environment jsdom
import '@angular/compiler';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  FormField,
  FormRoot,
  email,
  form,
  minLength,
  required,
  submit,
} from '@angular/forms/signals';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachForms } from '../forms-collector.ts';
import type { FormEvent } from '../forms.ts';
import { initAngularTestBed } from './angular-version.ts';

initAngularTestBed();

const stops: (() => void)[] = [];
afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  TestBed.resetTestingModule();
  document.body.innerHTML = '';
});

class Account {
  mode: 'ok' | 'reject' | 'throw' = 'ok';
  model = signal({ name: '', mail: 'not-an-email', password: 'abc' });
  form = form(
    this.model,
    (p) => {
      required(p.name);
      email(p.mail);
      minLength(p.password, 8);
    },
    {
      submission: {
        action: async (f) => {
          if (this.mode === 'throw') throw new Error('Server is down');
          if (this.mode === 'reject') {
            return [{ kind: 'taken', message: 'That email is taken', fieldTree: f.mail }];
          }
          return undefined;
        },
      },
    },
  );
}
Component({
  selector: 'account-form',
  imports: [FormField, FormRoot],
  template: `<form [formRoot]="form">
    <input id="name" [formField]="form.name" />
    <input id="mail" [formField]="form.mail" />
    <input id="password" [formField]="form.password" />
    <button>Go</button>
  </form>`,
})(Account);

class Login {
  form = new FormGroup({
    user: new FormControl('', Validators.required),
    code: new FormControl('12', [Validators.minLength(4)]),
    note: new FormControl(''),
  });
}
Component({
  selector: 'login-form',
  imports: [ReactiveFormsModule],
  template: `<form [formGroup]="form"><input formControlName="user" /><input formControlName="code" /><button>Go</button></form>`,
})(Login);

function harness() {
  const calls: { name: string; args: any[] }[] = [];
  const my = {
    rpc: {
      call: async (name: string, ...args: unknown[]) => void calls.push({ name, args }),
      register: () => {},
    },
  };
  const collector = attachForms(my, 'pg', () => (globalThis as any).ng, {
    show: vi.fn(),
    clear: vi.fn(),
  });
  stops.push(collector.stop);
  const submits = (): FormEvent[] =>
    (calls.filter((c) => c.name === 'push-forms').at(-1)?.args[0].events ?? []).filter(
      (e: FormEvent) => e.type === 'submit',
    );
  return { collector, submits };
}

const tick = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

async function mount<T>(type: new () => T) {
  const fixture = TestBed.createComponent(type);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

async function ready<T>(type: new () => T) {
  const fixture = await mount(type);
  const h = harness();
  h.collector.push();
  await tick();
  return { fixture, h, formEl: fixture.nativeElement.querySelector('form') as HTMLFormElement };
}

describe('forms submit reasons', () => {
  it('names the fields and validators that blocked a Signal Forms submit', async () => {
    const { h, formEl } = await ready(Account);
    formEl.requestSubmit();
    await tick();
    const [blocked] = h.submits();
    expect(blocked.outcome).toBe('blocked');
    expect(blocked.detail).toBe(
      'invalid, so the action did not run: name (required), mail (email), password (minLength)',
    );
  });

  it('records the fields a submission action rejected, with its messages', async () => {
    const { fixture, h, formEl } = await ready(Account);
    const app = fixture.componentInstance;
    app.mode = 'reject';
    app.model.set({ name: 'Ada', mail: 'ada@x.io', password: 'long enough' });
    formEl.requestSubmit();
    await tick();
    expect(h.submits().map((e) => [e.outcome, e.detail])).toEqual([
      ['ran', undefined],
      ['rejected', 'the submission action returned errors: mail (taken "That email is taken")'],
    ]);

    formEl.requestSubmit();
    await tick();
    expect(h.submits().at(-1)).toMatchObject({
      outcome: 'blocked',
      detail: 'invalid, so the action did not run: mail (taken from the last submission)',
    });
  });

  it('ties a thrown action to its form once, even when the app catches it', async () => {
    const { fixture, h } = await ready(Account);
    const app = fixture.componentInstance;
    app.mode = 'throw';
    app.model.set({ name: 'Ada', mail: 'ada@x.io', password: 'long enough' });
    await expect(submit(app.form)).rejects.toThrow('Server is down');
    await tick();
    const outcomes = h.submits().map((e) => e.outcome);
    expect(outcomes).toEqual(['ran', 'threw']);
    expect(h.submits().at(-1)?.detail).toBe('the submission action threw: Server is down');
  });

  it('puts the original submission action back when the form leaves', async () => {
    const fixture = await mount(Account);
    const options = (fixture.componentInstance.form() as any).structure.fieldManager.submitOptions;
    const original = options.action;
    const h = harness();
    h.collector.push();
    await tick();
    expect(options.action).not.toBe(original);
    fixture.destroy();
    fixture.nativeElement.remove();
    h.collector.push();
    await tick();
    expect(options.action).toBe(original);
  });

  it('lists the invalid controls a reactive form had at submit', async () => {
    const { h, formEl } = await ready(Login);
    formEl.requestSubmit();
    await tick(200);
    expect(h.submits().at(-1)?.detail).toMatch(
      /^status INVALID at submit \(invalid: user \(required\), code \(minlength\)\)/,
    );
  });
});
