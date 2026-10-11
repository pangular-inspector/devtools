// @vitest-environment jsdom
import '@angular/compiler';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { findForms } from '../forms.ts';
import { runFormAction, type ActionContext } from '../forms-actions.ts';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // already initialized in this worker
}

afterEach(() => TestBed.resetTestingModule());

function contextFor(host: HTMLElement): ActionContext {
  const ng = (globalThis as any).ng;
  const all = () => host.querySelectorAll('*');
  const found = findForms(ng, all());
  const forms = new Map(found.forms.map((f, i) => [`form-${i + 1}`, f]));
  return { ng, forms, elements: found.elements, all };
}

class Notes {
  submits = 0;
  form = new FormGroup({
    note: new FormControl(''),
    title: new FormControl(''),
    password: new FormControl(''),
  });
}
Component({
  selector: 'notes-form',
  imports: [ReactiveFormsModule],
  template: `
    <form ngNativeValidate [formGroup]="form" (ngSubmit)="submits = submits + 1">
      <input id="note" formControlName="note" />
      <input id="title" formControlName="title" required />
      <input id="password" type="password" formControlName="password" />
      <button type="submit">Save</button>
    </form>
  `,
})(Notes);

async function render() {
  const fixture = TestBed.createComponent(Notes);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('fill with submit', () => {
  it('reports a blocked submit as a failure and does not submit', async () => {
    const fixture = await render();
    const ctx = contextFor(fixture.nativeElement);
    const result = await runFormAction(ctx, {
      action: 'fill',
      formId: 'form-1',
      values: { note: 'x' },
      submit: true,
      confirm: true,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('would block this submit');
    expect(fixture.componentInstance.submits).toBe(0);
  });

  it('does not submit when every field was skipped', async () => {
    const fixture = await render();
    const ctx = contextFor(fixture.nativeElement);
    const result = await runFormAction(ctx, {
      action: 'fill',
      formId: 'form-1',
      values: { password: 'secret' },
      submit: true,
      confirm: true,
    });
    expect(result.ok).toBe(false);
    expect(fixture.componentInstance.submits).toBe(0);
  });

  it('submits when the fields are written and the form is valid', async () => {
    const fixture = await render();
    const ctx = contextFor(fixture.nativeElement);
    const result = await runFormAction(ctx, {
      action: 'fill',
      formId: 'form-1',
      values: { note: 'x', title: 'y' },
      submit: true,
      confirm: true,
    });
    expect(result.ok).toBe(true);
    expect(fixture.componentInstance.submits).toBe(1);
  });
});
