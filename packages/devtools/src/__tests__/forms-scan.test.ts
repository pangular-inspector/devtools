// @vitest-environment jsdom
import '@angular/compiler';
import { Component, ViewEncapsulation, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachForms } from '../forms-collector.ts';
import { createFormIds, pageElements, type FoundForm } from '../forms.ts';
import { initAngularTestBed } from './angular-version.ts';

initAngularTestBed();

const stops: (() => void)[] = [];
afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  TestBed.resetTestingModule();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

class Login {
  form = new FormGroup({ email: new FormControl('') });
}
Component({
  selector: 'login-form',
  imports: [ReactiveFormsModule],
  template: `<form [formGroup]="form"><input id="email" formControlName="email" /></form>`,
})(Login);

class Shadowed {
  form = form(signal({ city: '' }));
}
Component({
  selector: 'shadowed-form',
  imports: [FormField, FormRoot],
  encapsulation: ViewEncapsulation.ShadowDom,
  template: `<form [formRoot]="form"><input id="city" [formField]="form.city" /></form>`,
})(Shadowed);

function harness() {
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
  const collector = attachForms(my, 'pg', () => (globalThis as any).ng, highlight);
  stops.push(collector.stop);
  const reports = () => calls.filter((c) => c.name === 'push-forms').map((c) => c.args[0]);
  return { calls, handlers, collector, reports, highlight };
}

const tick = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

async function mount<T>(type: new () => T) {
  const fixture = TestBed.createComponent(type);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

const found = (root: object): FoundForm => ({ kind: 'reactive', root }) as FoundForm;

describe('form ids', () => {
  it('gives a recreated form its old id back and keeps ~n for forms shown together', () => {
    const assign = createFormIds('pg');
    const label = (roots: object[]) => new Map(roots.map((root) => [root, 'Checkout form']));
    const first = {};
    expect(assign([found(first)], label([first])).get(first)).toBe('Checkout_form@pg');
    assign([], new Map());
    const again = {};
    expect(assign([found(again)], label([again])).get(again)).toBe('Checkout_form@pg');
    const twin = {};
    const ids = assign([found(again), found(twin)], label([again, twin]));
    expect(ids.get(again)).toBe('Checkout_form@pg');
    expect(ids.get(twin)).toBe('Checkout_form~2@pg');
  });
});

describe('page elements', () => {
  it('walks into open shadow roots', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<form><input id="inside" /></form>';
    const roots: ShadowRoot[] = [];
    const ids = pageElements(document, (root) => roots.push(root)).map((el) => el.id);
    expect(ids).toContain('inside');
    expect(roots).toEqual([shadow]);
  });
});

describe('forms collector scanning', () => {
  it('finds a form inside a ShadowDom component', async () => {
    await mount(Shadowed);
    const h = harness();
    h.collector.push();
    await tick();
    const report = h.reports().at(-1);
    expect(report.forms.map((f: { owner: string }) => f.owner)).toEqual(['Shadowed']);
  });

  it('does not rescan the whole page for text changes and finds forms added later', async () => {
    const h = harness();
    h.collector.push();
    await tick();
    const spy = vi.spyOn(document, 'querySelectorAll');
    const clock = document.createElement('span');
    document.body.appendChild(clock);
    await tick(0);
    spy.mockClear();
    clock.textContent = '12:00:01';
    await tick(0);
    h.collector.push();
    await tick();
    expect(spy).not.toHaveBeenCalledWith('*');
    await mount(Login);
    h.collector.push();
    await tick();
    expect(spy).not.toHaveBeenCalledWith('*');
    expect(
      h
        .reports()
        .at(-1)
        .forms.map((f: { owner: string }) => f.owner),
    ).toEqual(['Login']);
  });

  it('keeps the id of a form that is destroyed and created again', async () => {
    const h = harness();
    const fixture = await mount(Login);
    h.collector.push();
    await tick();
    const id = h.reports().at(-1).forms[0].id;
    fixture.destroy();
    fixture.nativeElement.remove();
    h.collector.push();
    await tick();
    expect(h.reports().at(-1).forms).toEqual([]);
    await mount(Login);
    h.collector.push();
    await tick();
    expect(h.reports().at(-1).forms[0].id).toBe(id);
  });

  it('answers a form action without formId with an error instead of acting on a form', async () => {
    await mount(Login);
    const h = harness();
    h.collector.push();
    await tick();
    h.handlers.get('form-action')!({
      requestId: 'r1',
      request: { action: 'set-value', path: 'email', value: 'x' },
    });
    await tick(0);
    const answer = h.calls.find((c) => c.name === 'form-action-result')?.args[0];
    expect(answer.result).toMatchObject({ ok: false, error: 'set-value needs a formId.' });
    expect((document.getElementById('email') as HTMLInputElement).value).toBe('');
  });
});
