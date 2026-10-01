// @vitest-environment jsdom
import '@angular/compiler';
import {
  ChangeDetectorRef,
  Component,
  Pipe,
  inject,
  signal,
  type PipeTransform,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AsyncPipe, CurrencyPipe, DatePipe, JsonPipe, UpperCasePipe } from '@angular/common';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { BehaviorSubject, of, type Observable } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachPipes } from '../pipes-collector.ts';
import { setRedaction } from '../forms-privacy.ts';
import { explainPipeText } from '../rpc/pipe-explain.ts';
import { mergePipePageReport } from '../rpc/pipes-tools.ts';
import type { PipePageReport } from '../rpc/pipes-tools.ts';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // already initialized in this worker
}

const stops: (() => void)[] = [];
afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  setRedaction();
  TestBed.resetTestingModule();
  document.body.innerHTML = '';
});

async function mount<T>(type: new () => T) {
  const fixture = TestBed.createComponent(type);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function ng(): any {
  return (globalThis as any).ng;
}

class Receipt {
  a = signal(1);
  b = signal(2);
}
Component({
  selector: 'app-receipt',
  imports: [CurrencyPipe],
  template: `<p>{{ a() | currency }}</p><p>{{ b() | currency }}</p>`,
})(Receipt);

// Pure by default (no `pure: false`), takes the array itself — not a
// derived primitive — so an in-place mutation is invisible by reference.
class JoinPipe implements PipeTransform {
  transform(value: string[]): string {
    return value.join(',');
  }
}
Pipe({ name: 'join' })(JoinPipe);

class KeysPipe implements PipeTransform {
  transform(value: Map<string, number> | Set<string>): string {
    return [...value.keys()].join(',');
  }
}
Pipe({ name: 'keys' })(KeysPipe);

class FilterPipe implements PipeTransform {
  transform(value: string[], term: string): string {
    return value.filter((v) => v.includes(term)).join(',');
  }
}
Pipe({ name: 'filter' })(FilterPipe);

function harness(pageId = 'pg') {
  const calls: { name: string; args: unknown[] }[] = [];
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
  const collector = attachPipes(my, pageId, ng);
  stops.push(collector.stop);
  const reports = () =>
    calls.filter((c) => c.name === 'push-pipes').map((c) => c.args[0] as PipePageReport);
  return { calls, handlers, collector, reports };
}

describe('pipes collector', () => {
  it('reports instance count and owning component for each pipe, without instrumenting', async () => {
    await mount(Receipt);
    const h = harness();
    h.collector.push();
    await Promise.resolve();
    const report = h.reports().at(-1)!;
    expect(report.instrumented).toBe(false);
    const currency = report.pipes.find((p) => p.name === 'currency')!;
    expect(currency).toMatchObject({ className: 'CurrencyPipe', isPure: true, instanceCount: 2 });
    expect(currency.components).toEqual([
      { name: 'Receipt', count: 2, targets: [{ pageId: 'pg', id: expect.any(String) }] },
    ]);
    expect(currency.call).toBeUndefined();
  });

  it('tracks call count, last input/output and caller once instrumented', async () => {
    const fixture = await mount(Receipt);
    const h = harness();
    h.handlers.get('instrument-pipes')!(true);
    // The pure pipe already ran once before instrumenting; force a fresh
    // recompute so the (now-patched) transform actually runs again.
    fixture.componentInstance.a.set(5);
    fixture.detectChanges();
    await fixture.whenStable();
    h.collector.push();
    await Promise.resolve();

    const report = h.reports().at(-1)!;
    expect(report.instrumented).toBe(true);
    const currency = report.pipes.find((p) => p.name === 'currency')!;
    expect(currency.call?.callCount).toBeGreaterThan(0);
    expect(currency.call?.lastResult).toBe('$5.00');
  });

  it('stops instrumenting and the next report reflects it', async () => {
    await mount(Receipt);
    const h = harness();
    h.handlers.get('instrument-pipes')!(true);
    h.handlers.get('instrument-pipes')!(false);
    await Promise.resolve();
    const report = h.reports().at(-1)!;
    expect(report.instrumented).toBe(false);
  });

  it('reports the latest async value and flags a duplicate subscription', async () => {
    class Feed {
      shared$ = new BehaviorSubject('one');
      solo$ = new BehaviorSubject('solo');
    }
    Component({
      selector: 'app-feed',
      imports: [AsyncPipe],
      template: `<p>{{ shared$ | async }}</p><p>{{ shared$ | async }}</p><p>{{ solo$ | async }}</p>`,
    })(Feed);

    await mount(Feed);
    const h = harness();
    h.collector.push();
    await Promise.resolve();

    const report = h.reports().at(-1)!;
    const asyncUsages = report.async ?? [];
    expect(asyncUsages).toHaveLength(3);
    expect(asyncUsages.filter((a) => a.duplicate)).toHaveLength(2);
    expect(asyncUsages.filter((a) => !a.duplicate)).toHaveLength(1);
    for (const usage of asyncUsages) {
      expect(usage.hasSource).toBe(true);
      expect(usage.component).toBe('Feed');
    }
    expect(asyncUsages.some((a) => a.latestValue === 'one')).toBe(true);
    expect(asyncUsages.some((a) => a.latestValue === 'solo')).toBe(true);
  });

  it('flags a pure pipe fed a mutated-in-place argument (experimental stale check)', async () => {
    class ListView {
      items = signal<string[]>(['a', 'b']);
      cdr = inject(ChangeDetectorRef);
    }
    Component({
      selector: 'app-list',
      // Bound directly to the array reference (not a derived primitive), so
      // a mutation in place is genuinely invisible to Angular's `Object.is`
      // memoization check.
      imports: [JoinPipe],
      template: `<p>{{ items() | join }}</p>`,
    })(ListView);

    const fixture = await mount(ListView);
    const h = harness();
    h.handlers.get('instrument-pipes')!(true);
    h.collector.push();
    await Promise.resolve();
    expect(
      h
        .reports()
        .at(-1)!
        .pipes.find((p) => p.name === 'join')?.stale,
    ).toBeUndefined();

    fixture.componentInstance.items().push('c'); // same array reference, mutated in place
    fixture.componentInstance.cdr.markForCheck(); // force a recheck without changing any binding
    fixture.detectChanges();
    await fixture.whenStable();
    h.collector.push();
    await Promise.resolve();

    const stale = h
      .reports()
      .at(-1)!
      .pipes.find((p) => p.name === 'join')?.stale;
    expect(stale).toBeDefined();
    expect(stale?.detectedAt).toBeGreaterThan(0);
  });

  it('does not flag a normal, immutable update as stale', async () => {
    class ListView {
      items = signal<string[]>(['a', 'b']);
    }
    Component({
      selector: 'app-list2',
      imports: [JoinPipe],
      template: `<p>{{ items() | join }}</p>`,
    })(ListView);

    const fixture = await mount(ListView);
    const h = harness();
    h.handlers.get('instrument-pipes')!(true);
    h.collector.push();
    await Promise.resolve();

    fixture.componentInstance.items.set([...fixture.componentInstance.items(), 'c']);
    fixture.detectChanges();
    await fixture.whenStable();
    h.collector.push();
    await Promise.resolve();

    expect(
      h
        .reports()
        .at(-1)!
        .pipes.find((p) => p.name === 'join')?.stale,
    ).toBeUndefined();
  });

  it('does not run the stale check while not instrumented', async () => {
    class ListView {
      items = signal<string[]>(['a', 'b']);
      cdr = inject(ChangeDetectorRef);
    }
    Component({
      selector: 'app-list3',
      imports: [JoinPipe],
      template: `<p>{{ items() | join }}</p>`,
    })(ListView);

    const fixture = await mount(ListView);
    const h = harness();
    h.collector.push();
    await Promise.resolve();

    fixture.componentInstance.items().push('c');
    fixture.componentInstance.cdr.markForCheck();
    fixture.detectChanges();
    await fixture.whenStable();
    h.collector.push();
    await Promise.resolve();

    expect(
      h
        .reports()
        .at(-1)!
        .pipes.find((p) => p.name === 'join')?.stale,
    ).toBeUndefined();
  });

  it('keeps a stale finding, with its first detection time, until the argument changes', async () => {
    class ListView {
      items = signal<string[]>(['a', 'b']);
      cdr = inject(ChangeDetectorRef);
    }
    Component({
      selector: 'app-list4',
      imports: [JoinPipe],
      template: `<p>{{ items() | join }}</p>`,
    })(ListView);

    const fixture = await mount(ListView);
    const h = harness();
    h.handlers.get('instrument-pipes')!(true);
    h.collector.push();
    await Promise.resolve();

    fixture.componentInstance.items().push('c');
    fixture.componentInstance.cdr.markForCheck();
    fixture.detectChanges();
    h.collector.push();
    await Promise.resolve();
    const staleOf = () =>
      h
        .reports()
        .at(-1)!
        .pipes.find((p) => p.name === 'join')?.stale;
    const first = staleOf()?.detectedAt;
    expect(first).toBeGreaterThan(0);

    h.collector.resume();
    await Promise.resolve();
    expect(staleOf()?.detectedAt).toBe(first);

    fixture.componentInstance.items.set(['d']);
    fixture.detectChanges();
    h.collector.resume();
    await Promise.resolve();
    expect(staleOf()).toBeUndefined();
  });

  it('does not push an unchanged report again before the heartbeat', async () => {
    await mount(Receipt);
    const h = harness();
    h.collector.push();
    await Promise.resolve();
    h.collector.push();
    await Promise.resolve();
    expect(h.reports()).toHaveLength(1);
  });

  it('walks the whole DOM once, then only again when it changes', async () => {
    await mount(Receipt);
    const h = harness();
    const spy = vi.spyOn(document, 'querySelectorAll');
    const fullScans = () => spy.mock.calls.filter(([selector]) => selector === '*').length;
    h.collector.push();
    await Promise.resolve();
    expect(fullScans()).toBe(1);

    h.collector.resume();
    await Promise.resolve();
    expect(fullScans()).toBe(1);

    class Extra {
      label = 'late';
    }
    Component({
      selector: 'app-extra',
      imports: [UpperCasePipe],
      template: `<i>{{ label | uppercase }}</i>`,
    })(Extra);
    await mount(Extra);
    await new Promise((resolve) => setTimeout(resolve));
    h.collector.resume();
    await Promise.resolve();
    expect(fullScans()).toBe(1);
    expect(
      h
        .reports()
        .at(-1)!
        .pipes.map((p) => p.name),
    ).toEqual(['uppercase']);
    spy.mockRestore();
  });

  it('picks up a text-only view that appears later without walking the whole DOM', async () => {
    class Toggle {
      show = signal(false);
      label = 'late';
    }
    Component({
      selector: 'app-toggle',
      imports: [UpperCasePipe],
      template: `<p>@if (show()) {{{ label | uppercase }}}</p>`,
    })(Toggle);
    const fixture = await mount(Toggle);
    const h = harness();
    const spy = vi.spyOn(document, 'querySelectorAll');
    h.collector.push();
    await Promise.resolve();
    expect(h.reports().at(-1)!.pipes).toEqual([]);

    fixture.componentInstance.show.set(true);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    h.collector.resume();
    await Promise.resolve();
    expect(spy.mock.calls.filter(([selector]) => selector === '*')).toHaveLength(1);
    expect(
      h
        .reports()
        .at(-1)!
        .pipes.map((p) => p.name),
    ).toEqual(['uppercase']);
    spy.mockRestore();
  });

  it('strips the bundler underscore prefix from component names', async () => {
    class _Invoice {
      total = 3;
    }
    Component({
      selector: 'app-invoice',
      imports: [CurrencyPipe],
      template: `<p>{{ total | currency }}</p>`,
    })(_Invoice);
    await mount(_Invoice);
    const h = harness();
    h.collector.push();
    await Promise.resolve();
    const currency = h
      .reports()
      .at(-1)!
      .pipes.find((p) => p.name === 'currency')!;
    expect(currency.components.map((c) => c.name)).toEqual(['Invoice']);
  });

  it('reports no latest value for an async pipe with no source yet', async () => {
    class Empty {
      source$: BehaviorSubject<string> | null = null;
    }
    Component({
      selector: 'app-empty',
      imports: [AsyncPipe],
      template: `<p>{{ source$ | async }}</p>`,
    })(Empty);
    await mount(Empty);
    const h = harness();
    h.collector.push();
    await Promise.resolve();
    const [usage] = h.reports().at(-1)!.async ?? [];
    expect(usage).toMatchObject({ hasSource: false, duplicate: false });
    expect(usage.latestValue).toBeUndefined();
    expect(usage.target).toEqual({ pageId: 'pg', id: expect.any(String) });
  });

  it('redacts secret keys, JWTs and bearer tokens in async values', async () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.c2lnbmF0dXJlLXZhbHVl';
    class Session {
      session$ = new BehaviorSubject({ accessToken: jwt, user: 'ada' });
      header$ = new BehaviorSubject(`Bearer ${jwt}`);
    }
    Component({
      selector: 'app-session',
      imports: [AsyncPipe],
      template: `<p>{{ (session$ | async)?.user }}</p><p>{{ header$ | async }}</p>`,
    })(Session);
    await mount(Session);
    const h = harness();
    h.collector.push();
    await Promise.resolve();

    const values = (h.reports().at(-1)!.async ?? []).map((a) => a.latestValue);
    expect(values).toEqual(['{"accessToken":"[redacted]","user":"ada"}', 'Bearer [redacted]']);
    expect(JSON.stringify(h.reports())).not.toContain(jwt);
  });

  it('redacts a JWT that runs past the text limit before cutting it', async () => {
    const jwt = `eyJhbGciOiJIUzI1NiJ9.eyJ${'a'.repeat(900)}.c2lnbmF0dXJlLXZhbHVl`;
    class LongToken {
      token$ = new BehaviorSubject(`token ${jwt}`);
    }
    Component({
      selector: 'app-long-token',
      imports: [AsyncPipe],
      template: `<p>{{ token$ | async }}</p>`,
    })(LongToken);
    await mount(LongToken);
    const h = harness();
    h.collector.push();
    await Promise.resolve();

    const [usage] = h.reports().at(-1)!.async ?? [];
    expect(usage.latestValue).toBe('token [redacted]');
    expect(JSON.stringify(h.reports())).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('redacts instrumented inputs and outputs, including configured secret names', async () => {
    setRedaction({ secretNames: ['voucher'] });
    class Checkout {
      form = signal({ email: 'ada@example.com', password: 'hunter2', voucher: 'ABC123' });
    }
    Component({
      selector: 'app-checkout',
      imports: [JsonPipe],
      template: `<pre>{{ form() | json }}</pre>`,
    })(Checkout);
    const fixture = await mount(Checkout);
    const h = harness();
    h.handlers.get('instrument-pipes')!(true);
    fixture.componentInstance.form.set({
      email: 'bob@example.com',
      password: 'hunter3',
      voucher: 'XYZ789',
    });
    fixture.detectChanges();
    await fixture.whenStable();
    h.collector.push();
    await Promise.resolve();

    const report = h.reports().at(-1)!;
    const call = report.pipes.find((p) => p.name === 'json')!.call!;
    expect(call.lastArgs).toEqual([
      '{"email":"bob@example.com","password":"[redacted]","voucher":"[redacted]"}',
    ]);
    expect(call.lastResult).toBe(
      '{"email":"bob@example.com","password":"[redacted]","voucher":"[redacted]"}',
    );
    const payload = JSON.stringify(report);
    expect(payload).not.toContain('hunter3');
    expect(payload).not.toContain('XYZ789');

    const markdown = explainPipeText(
      'json',
      '/nonexistent',
      mergePipePageReport(new Map(), report, 0),
    );
    expect(markdown).toContain('[redacted]');
    expect(markdown).not.toContain('hunter3');
  });

  async function recheck(
    fixture: { detectChanges(): void; whenStable(): Promise<unknown> },
    cdr: ChangeDetectorRef,
  ) {
    cdr.markForCheck();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function report(h: ReturnType<typeof harness>) {
    h.collector.resume();
    await Promise.resolve();
    return h.reports().at(-1)!;
  }

  it('starts each recording from zero calls', async () => {
    const fixture = await mount(Receipt);
    const h = harness();
    const record = (on: boolean) => h.handlers.get('instrument-pipes')!(on);
    record(true);
    for (const value of [5, 6, 7]) {
      fixture.componentInstance.a.set(value);
      fixture.detectChanges();
    }
    const first = (await report(h)).pipes.find((p) => p.name === 'currency')!;
    expect(first.call?.callCount).toBe(3);

    record(false);
    record(true);
    expect((await report(h)).pipes.find((p) => p.name === 'currency')!.call).toBeUndefined();

    fixture.componentInstance.a.set(8);
    fixture.detectChanges();
    const second = (await report(h)).pipes.find((p) => p.name === 'currency')!;
    expect(second.call?.callCount).toBe(1);
    expect(second.call?.lastResult).toBe('$8.00');
  });

  it('starts each recording with a fresh stale baseline', async () => {
    class ListView {
      items = signal<string[]>(['a', 'b']);
      cdr = inject(ChangeDetectorRef);
    }
    Component({
      selector: 'app-list-baseline',
      imports: [JoinPipe],
      template: `<p>{{ items() | join }}</p>`,
    })(ListView);
    const fixture = await mount(ListView);
    const h = harness();
    const record = (on: boolean) => h.handlers.get('instrument-pipes')!(on);
    record(true);
    await report(h);
    record(false);
    fixture.componentInstance.items().push('c');
    await recheck(fixture, fixture.componentInstance.cdr);
    record(true);
    expect((await report(h)).pipes.find((p) => p.name === 'join')?.stale).toBeUndefined();
  });

  it('flags a Date mutated in place and shown with the real DatePipe', async () => {
    class When {
      when = new Date(2020, 0, 1);
      cdr = inject(ChangeDetectorRef);
    }
    Component({
      selector: 'app-when',
      imports: [DatePipe],
      template: `<p>{{ when | date: 'yyyy' }}</p>`,
    })(When);
    const fixture = await mount(When);
    const h = harness();
    h.handlers.get('instrument-pipes')!(true);
    await report(h);

    fixture.componentInstance.when.setFullYear(2030);
    await recheck(fixture, fixture.componentInstance.cdr);
    expect(fixture.nativeElement.textContent).toContain('2020');
    expect((await report(h)).pipes.find((p) => p.name === 'date')?.stale).toBeDefined();
  });

  it.each([
    [
      'Map',
      () => new Map([['a', 1]]),
      (v: Map<string, number> | Set<string>) => (v as Map<string, number>).set('b', 2),
    ],
    [
      'Set',
      () => new Set(['a']),
      (v: Map<string, number> | Set<string>) => (v as Set<string>).add('b'),
    ],
  ])('flags a %s mutated in place', async (_kind, create, mutate) => {
    class Bag {
      bag = create();
      cdr = inject(ChangeDetectorRef);
    }
    Component({
      selector: `app-bag-${_kind.toLowerCase()}`,
      imports: [KeysPipe],
      template: `<p>{{ bag | keys }}</p>`,
    })(Bag);
    const fixture = await mount(Bag);
    const h = harness();
    h.handlers.get('instrument-pipes')!(true);
    await report(h);

    mutate(fixture.componentInstance.bag);
    await recheck(fixture, fixture.componentInstance.cdr);
    expect((await report(h)).pipes.find((p) => p.name === 'keys')?.stale).toBeDefined();
  });

  it('does not flag a pipe that reran because another argument changed', async () => {
    class Search {
      items = ['apple', 'banana'];
      term = signal('a');
      cdr = inject(ChangeDetectorRef);
    }
    Component({
      selector: 'app-search',
      imports: [FilterPipe],
      template: `<p>{{ items | filter: term() }}</p>`,
    })(Search);
    const fixture = await mount(Search);
    const h = harness();
    h.handlers.get('instrument-pipes')!(true);
    await report(h);

    fixture.componentInstance.items.push('cherry');
    fixture.componentInstance.term.set('an');
    await recheck(fixture, fixture.componentInstance.cdr);
    expect(fixture.nativeElement.textContent).toContain('banana');
    expect((await report(h)).pipes.find((p) => p.name === 'filter')?.stale).toBeUndefined();
  });

  it('clears a stale finding once the pipe reruns', async () => {
    class Search {
      items = ['apple', 'banana'];
      term = signal('a');
      cdr = inject(ChangeDetectorRef);
    }
    Component({
      selector: 'app-search2',
      imports: [FilterPipe],
      template: `<p>{{ items | filter: term() }}</p>`,
    })(Search);
    const fixture = await mount(Search);
    const h = harness();
    h.handlers.get('instrument-pipes')!(true);
    await report(h);

    fixture.componentInstance.items.push('avocado');
    await recheck(fixture, fixture.componentInstance.cdr);
    expect((await report(h)).pipes.find((p) => p.name === 'filter')?.stale).toBeDefined();

    fixture.componentInstance.term.set('av');
    await recheck(fixture, fixture.componentInstance.cdr);
    expect(fixture.nativeElement.textContent).toContain('avocado');
    expect((await report(h)).pipes.find((p) => p.name === 'filter')?.stale).toBeUndefined();
  });

  it('marks an async pipe whose source changes on every check as resubscribing', async () => {
    const cached = of('cached');
    class Feed {
      stable$ = new BehaviorSubject('stable');
      cdr = inject(ChangeDetectorRef);
      getData(): Observable<string> {
        return of('fresh');
      }
      getCached(): Observable<string> {
        return cached;
      }
    }
    Component({
      selector: 'app-resubscribe',
      imports: [AsyncPipe],
      template: `<p>{{ getData() | async }}</p><p>{{ getCached() | async }}</p><p>{{ stable$ | async }}</p>`,
    })(Feed);
    const fixture = await mount(Feed);
    const h = harness();
    const flags = async () => (await report(h)).async!.map((a) => a.resubscribing ?? false);
    expect(await flags()).toEqual([false, false, false]);
    for (let i = 0; i < 2; i++) {
      await recheck(fixture, fixture.componentInstance.cdr);
      expect(await flags()).toEqual([false, false, false]);
    }
    await recheck(fixture, fixture.componentInstance.cdr);
    expect(await flags()).toEqual([true, false, false]);

    const markdown = explainPipeText(
      'async',
      '/nonexistent',
      mergePipePageReport(new Map(), h.reports().at(-1)!, 0),
    );
    expect(markdown).toContain('**Resubscribing:** 1');
    expect(markdown).toContain('Feed');
  });

  it('does not mark an async pipe whose source changed once', async () => {
    class Feed {
      source$ = new BehaviorSubject('one');
      cdr = inject(ChangeDetectorRef);
    }
    Component({
      selector: 'app-switch',
      imports: [AsyncPipe],
      template: `<p>{{ source$ | async }}</p>`,
    })(Feed);
    const fixture = await mount(Feed);
    const h = harness();
    await report(h);
    fixture.componentInstance.source$ = new BehaviorSubject('two');
    await recheck(fixture, fixture.componentInstance.cdr);
    await report(h);
    for (let i = 0; i < 3; i++) {
      await recheck(fixture, fixture.componentInstance.cdr);
      await report(h);
    }
    expect(h.reports().at(-1)!.async![0].resubscribing).toBeUndefined();
  });

  it('does nothing harmful when Angular has no debug API on the page', async () => {
    const my = {
      rpc: { call: async () => {}, register: () => {} },
    };
    const collector = attachPipes(my, 'pg', () => undefined);
    stops.push(collector.stop);
    expect(() => collector.push()).not.toThrow();
  });
});
