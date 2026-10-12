// @vitest-environment jsdom
import '@angular/compiler';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachChangeDetection } from '../cd-overlay.ts';
import { attachForms } from '../forms-collector.ts';
import { CHANGE_DETECTION_SHAPE, FORMS_SHAPE } from '../push-delta.ts';
import { createReportDeltas, deltaPush } from '../rpc/report-deltas.ts';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // already initialized in this worker
}

/** An RPC scope whose push answers like the server, rebuilding each report. */
function server(name: string, shape: typeof FORMS_SHAPE) {
  const stored: Record<string, unknown>[] = [];
  const handle = deltaPush(
    createReportDeltas(shape),
    () => true,
    (report) => {
      stored.push(report);
      return true;
    },
  );
  const sent: { name: string; arg: any }[] = [];
  const handlers = new Map<string, (...args: any[]) => unknown>();
  const my = {
    rpc: {
      call: async (called: string, arg?: unknown) => {
        const copy = JSON.parse(JSON.stringify(arg ?? null));
        sent.push({ name: called, arg: copy });
        return called === name ? handle(copy) : { known: true };
      },
      register: (def: { name: string; handler: (...args: any[]) => unknown }) =>
        void handlers.set(def.name, def.handler),
    },
  };
  return { my, sent, stored, handlers, pushes: () => sent.filter((s) => s.name === name) };
}

class Login {
  form = new FormGroup({ email: new FormControl('') });
}
Component({
  selector: 'login-form',
  imports: [ReactiveFormsModule],
  template: `<form [formGroup]="form"><input id="email" formControlName="email" /></form>`,
})(Login);

const stops: (() => void)[] = [];
afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  TestBed.resetTestingModule();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('leased collectors', () => {
  it('record change detection on an idle page and send it when woken', async () => {
    document.body.innerHTML = '<app-root ng-version="22.1.0"></app-root>';
    let profiler: ((event: number, instance?: unknown) => void) | null = null;
    const ng = {
      ɵsetProfiler: (fn: typeof profiler) => {
        profiler = fn;
        return () => (profiler = null);
      },
      getHostElement: () => null,
    };
    const { my, handlers, pushes, stored } = server(
      'push-change-detection',
      CHANGE_DETECTION_SHAPE,
    );
    let active = true;
    const cd = attachChangeDetection(
      my,
      'p1',
      () => ng,
      50,
      () => 0,
      () => active,
    );
    stops.push(cd.stop);
    handlers.get('change-detection-record')!({ pageId: 'p1', on: true });
    await vi.waitFor(() => expect(pushes()).toHaveLength(1));
    expect(pushes()[0]!.arg.delta).toMatchObject({ full: true });

    active = false;
    // A cycle: Angular's ChangeDetectionStart and End.
    profiler!(12);
    profiler!(13);
    await cd.push();
    expect(pushes()).toHaveLength(1);

    await cd.push(false, true);
    expect(pushes()).toHaveLength(2);
    const delta = pushes()[1]!.arg;
    expect(delta).not.toHaveProperty('cycles');
    expect(delta.delta.lists.cycles.set).toHaveLength(1);
    expect((stored.at(-1)!['cycles'] as unknown[]).length).toBe(1);
  });

  it('keep the forms timeline on an idle page and send only what changed', async () => {
    const fixture = TestBed.createComponent(Login);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    const { my, pushes, stored } = server('push-forms', FORMS_SHAPE);
    let active = true;
    const forms = attachForms(
      my,
      'pg',
      () => (globalThis as { ng?: unknown }).ng,
      { show: () => {}, clear: () => {} },
      200,
      { active: () => active },
    );
    stops.push(forms.stop);
    await forms.push();
    expect(pushes()).toHaveLength(1);
    expect(pushes()[0]!.arg.forms[0].id).toMatch(/@pg$/);

    active = false;
    fixture.componentInstance.form.controls.email.setValue('ada@example.com');
    await forms.push();
    expect(pushes()).toHaveLength(1);

    await forms.push(true);
    expect(pushes()).toHaveLength(2);
    const delta = pushes()[1]!.arg;
    expect(delta).not.toHaveProperty('forms');
    expect(delta.delta.lists.events.set.length).toBeGreaterThan(0);
    const events = stored.at(-1)!['events'] as { type: string; detail?: string }[];
    expect(events.some((e) => e.type === 'value' && e.detail?.includes('ada@'))).toBe(true);
  });
});
