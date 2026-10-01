// @vitest-environment jsdom
import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { form } from '@angular/forms/signals';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { describe, expect, it } from 'vitest';
import { collectForms, diffForms } from '../forms.ts';
import {
  TEMPLATE_UPDATE_START,
  callerFrom,
  countRenders,
  instrumentForms,
  type InstrumentCall,
} from '../forms-instrument.ts';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // already initialized in this worker
}

describe('caller frames', () => {
  it('skips framework and devtools frames and trims URLs', () => {
    const stack = [
      'Error',
      '    at FormControl.setValue (http://localhost:4200/@fs/x/node_modules/.vite/deps/@angular_forms.js:10:5)',
      '    at wrapper (http://localhost:4200/@fs/x/ng-devtools/src/forms-instrument.ts:88:12)',
      '    at CheckoutPage.applyCoupon (http://localhost:4200/src/app/checkout.ts?t=123:42:17)',
      '    at onClick (http://localhost:4200/src/app/checkout.ts:10:1)',
    ].join('\n');
    expect(callerFrom(stack)).toBe('CheckoutPage.applyCoupon (src/app/checkout.ts:42:17)');
    expect(callerFrom('Error\n    at Subscriber.next (rxjs.js:1:1)')).toBeUndefined();
    expect(callerFrom(undefined)).toBeUndefined();
  });

  it('prefers the form owner and skips Angular internals bundled into app chunks', () => {
    const bundled = [
      'Error',
      '    at updateControl (http://localhost:4100/chunk-BTUX.js:1923:11)',
      '    at Object.next (http://localhost:4100/chunk-BTUX.js:1210:14)',
      '    at OperatorSubscriber._next (http://localhost:4100/chunk-4PW.js:1141:9)',
      '    at DefaultValueAccessor_input_HostBindingHandler (http://localhost:4100/chunk-BTUX.js:257:22)',
      '    at _FormControlName.ngOnChanges (http://localhost:4100/chunk-BTUX.js:900:3)',
      '    at CartService.load (http://localhost:4100/main.js:40:3)',
      '    at _ReactiveFormExample.addPhone (http://localhost:4100/chunk-BTUX.js:5213:34)',
    ].join('\n');
    expect(callerFrom(bundled, new Set(['ReactiveFormExample']))).toBe(
      'ReactiveFormExample.addPhone (chunk-BTUX.js:5213:34)',
    );
    expect(callerFrom(bundled)).toBe('CartService.load (main.js:40:3)');
    expect(
      callerFrom(
        'Error\n    at setUpValidators (chunk.js:1:1)\n    at executeTemplate (chunk.js:2:2)',
      ),
    ).toBeUndefined();
  });
});

describe('instrumentation', () => {
  it('reports the outermost reactive call and restores the prototypes', () => {
    const calls: InstrumentCall[] = [];
    const group = new FormGroup({ a: new FormControl(''), b: new FormControl('') });
    const original = Object.getPrototypeOf(group).patchValue;
    const instrumentation = instrumentForms((call) => calls.push(call));
    instrumentation.addControl(group);
    function applyDefaults() {
      group.patchValue({ a: 'x', b: 'y' });
    }
    applyDefaults();
    group.controls.a.setValidators(Validators.required);
    expect(calls.map((c) => c.method)).toEqual(['patchValue', 'setValidators']);
    expect(calls[0].caller).toContain('applyDefaults');
    expect(calls[1].target).toBe(group.controls.a);
    instrumentation.stop();
    expect(Object.getPrototypeOf(group).patchValue).toBe(original);
    group.patchValue({ a: 'z' });
    expect(calls).toHaveLength(2);
  });

  it('wraps a Signal Forms root model, which child writes go through', () => {
    const calls: InstrumentCall[] = [];
    const tree = TestBed.runInInjectionContext(() => form(signal({ name: '', age: 1 })));
    const root = tree() as never;
    const instrumentation = instrumentForms((call) => calls.push(call));
    instrumentation.addSignalRoot(root);
    tree.name().value.set('Ada');
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('update');
    expect(calls[0].signalRoot).toBe(root);
    instrumentation.stop();
    tree.age().value.set(2);
    expect(calls).toHaveLength(1);
    expect(tree().value()).toEqual({ name: 'Ada', age: 2 });
  });

  it('counts template updates per component through a chained profiler', () => {
    document.body.innerHTML = '<app-root ng-version="22.1.0"></app-root>';
    let profiler: ((event: number, instance: unknown) => void) | null = null;
    let removed = false;
    const ng = {
      ɵsetProfiler: (fn: typeof profiler) => {
        profiler = fn;
        return () => (removed = true);
      },
    };
    const counter = countRenders(ng)!;
    class Checkout {
      static ɵcmp = {};
    }
    class Summary {
      static ɵcmp = {};
    }
    class RepeaterContext {}
    profiler!(TEMPLATE_UPDATE_START, new Checkout());
    counter.start();
    profiler!(TEMPLATE_UPDATE_START, new Checkout());
    profiler!(TEMPLATE_UPDATE_START, new Checkout());
    profiler!(TEMPLATE_UPDATE_START, new Summary());
    profiler!(0, new Summary());
    profiler!(TEMPLATE_UPDATE_START, new RepeaterContext());
    expect(counter.take()).toEqual({ total: 3, top: ['Checkout×2', 'Summary×1'] });
    expect(counter.take()).toBeNull();
    counter.stop();
    expect(removed).toBe(true);
    expect(countRenders({})).toBeNull();
    document.body.innerHTML = '<app-root ng-version="19.2.0"></app-root>';
    expect(countRenders(ng)).toBeNull();
    document.body.innerHTML = '';
  });
});

describe('array identity', () => {
  it('reports moves, inserts and removals by control identity, without value noise', () => {
    const items = new FormArray([new FormControl('a'), new FormControl('b'), new FormControl('c')]);
    const group = new FormGroup({ items });
    const snapshot = () =>
      collectForms(
        {
          forms: [{ kind: 'reactive', root: group as never, owner: null }],
          elements: new WeakMap(),
        },
        () => 'f',
      );
    const before = snapshot();
    const moved = items.at(2);
    items.removeAt(2);
    items.insert(0, moved);
    items.removeAt(2);
    items.push(new FormControl('d'));
    const events = diffForms(before, snapshot()).map((e) =>
      `${e.type} ${e.path} ${e.detail ?? ''}`.trim(),
    );
    expect(events).toEqual(
      expect.arrayContaining([
        'moved items.0 items.2 → items.0',
        'moved items.1 items.0 → items.1',
        'added items.2 inserted at 2',
        'removed items.1 was at 1',
      ]),
    );
    expect(events.filter((e) => e.startsWith('value'))).toEqual([]);
  });
});
