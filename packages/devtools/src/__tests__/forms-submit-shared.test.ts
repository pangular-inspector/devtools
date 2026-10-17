// @vitest-environment jsdom
import '@angular/compiler';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, FormRoot, form, submit } from '@angular/forms/signals';
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

/** One module-level submission object that two forms share, as apps do for a common save. */
const failing = new Set<unknown>();
const original = async (f: unknown) => {
  if (failing.has(f)) throw new Error('Server is down');
  return undefined;
};
const shared = { action: original };

class Pair {
  first = form(signal({ name: 'a' }), { submission: shared as never });
  second = form(signal({ name: 'b' }), { submission: shared as never });
}
Component({
  selector: 'pair-forms',
  imports: [FormField, FormRoot],
  template: `<form id="first" [formRoot]="first"><input [formField]="first.name" /></form>
    <form id="second" [formRoot]="second"><input [formField]="second.name" /></form>`,
})(Pair);

const tick = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const last = () => calls.filter((c) => c.name === 'push-forms').at(-1)?.args[0];
  const threw = (): FormEvent[] =>
    (last()?.events ?? []).filter((e: FormEvent) => e.type === 'submit' && e.outcome === 'threw');
  return { collector, threw, last };
}

describe('a submission object shared by two forms', () => {
  it('wraps it once, ties a throw to its own form and puts the action back after both leave', async () => {
    const fixture = TestBed.createComponent(Pair);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    const app = fixture.componentInstance;
    const h = harness();
    h.collector.push();
    await tick();
    expect(shared.action).not.toBe(original);
    const wrapper = shared.action;
    h.collector.push();
    await tick();
    expect(shared.action).toBe(wrapper);

    failing.add(app.first);
    await expect(submit(app.first)).rejects.toThrow('Server is down');
    await submit(app.second);
    await tick();
    const threw = h.threw();
    expect(threw).toHaveLength(1);
    const forms = (h.last()?.forms ?? []) as { id: string; property?: string }[];
    const firstId = forms.find((f) => f.property === 'first')?.id;
    expect(firstId).toBeTruthy();
    expect(threw[0].formId).toBe(firstId);

    fixture.destroy();
    fixture.nativeElement.remove();
    h.collector.push();
    await tick();
    expect(shared.action).toBe(original);
  });

  it('puts the action back when the collector stops', async () => {
    const fixture = TestBed.createComponent(Pair);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    const h = harness();
    h.collector.push();
    await tick();
    expect(shared.action).not.toBe(original);
    stops.splice(0).forEach((stop) => stop());
    expect(shared.action).toBe(original);
  });
});
