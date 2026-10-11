// @vitest-environment jsdom
import '@angular/compiler';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { Router, provideRouter, type Routes } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  Subject,
  first,
  map,
  type Operator,
  type Subscriber,
} from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { watchRouter, type NavigationRecord } from '../router.ts';
import { instrument } from '../router-actions.ts';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

class StateObservable<T> extends Observable<T> {
  constructor(state: Observable<T>) {
    super();
    this.source = state;
  }
}

class FakeStore<T> extends Observable<T> {
  constructor(state$: Observable<T>, _actions: unknown, _reducers: unknown) {
    super();
    this.source = state$;
  }
  override lift<R>(operator: Operator<T, R>): FakeStore<R> {
    const store = new FakeStore<R>(this as never, null, null);
    store.operator = operator as never;
    return store;
  }
}

class Page {}
Component({ selector: 'app-page', template: 'page' })(Page);

const state = new BehaviorSubject({ authed: true });
const behavior = new BehaviorSubject<boolean>(true);
let subject = new Subject<boolean>();
let asyncValue: Observable<boolean>;

const storeGuard = () =>
  new FakeStore(new StateObservable(state), null, null).pipe(map((s) => s.authed));
const behaviorGuard = () => behavior;
const subjectGuard = () => subject;
const asyncGuard = () => asyncValue;
const asyncResolver = () => asyncValue.pipe(map((v) => (v ? 'yes' : 'no')));

const routes: Routes = [
  { path: '', component: Page },
  { path: 'store', component: Page, canActivate: [storeGuard] },
  { path: 'behavior', component: Page, canActivate: [behaviorGuard] },
  { path: 'subject', component: Page, canActivate: [subjectGuard] },
  { path: 'async', component: Page, canActivate: [asyncGuard], resolve: { v: asyncResolver } },
];

function later<T>(value: T): Observable<T> {
  return new Observable<T>((subscriber: Subscriber<T>) => {
    const timer = setTimeout(() => subscriber.next(value), 5);
    return () => clearTimeout(timer);
  });
}

function wrapGuard(value: Observable<boolean>) {
  const guard = () => value;
  const local: Routes = [{ path: 'x', component: Page, canActivate: [guard] }];
  const nav = [
    { id: 1, url: '/x', trigger: 'imperative', startedAt: 0, outcome: 'pending' },
  ] as NavigationRecord[];
  const stop = instrument({ config: local, serializeUrl: String } as never, nav);
  const wrapped = (local[0].canActivate![0] as () => Observable<boolean>)();
  stop();
  return { wrapped, nav };
}

describe('instrumented guards keep the observable they return working', () => {
  let router: Router;
  let navigations: NavigationRecord[];
  let cleanup: (() => void)[];
  const last = () => navigations[navigations.length - 1];

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    router = TestBed.inject(Router);
    navigations = [];
    cleanup = [];
    const stop = watchRouter(router as never, navigations, () => {});
    if (stop) cleanup.push(stop);
    cleanup.push(instrument(router as never, navigations));
    subject = new Subject<boolean>();
    asyncValue = later(true);
  });

  afterEach(() => {
    for (const fn of cleanup) fn();
  });

  it('passes a Store-like observable with its own lift and constructor', async () => {
    expect(storeGuard()).toBeInstanceOf(FakeStore);
    await expect(router.navigateByUrl('/store')).resolves.toBe(true);
    expect(router.url).toBe('/store');
    expect(last().runs).toEqual([
      expect.objectContaining({ guard: 'storeGuard', kind: 'canActivate', result: 'true' }),
    ]);
  });

  it('passes the current value of a BehaviorSubject, not a function', async () => {
    behavior.next(false);
    await expect(router.navigateByUrl('/behavior')).resolves.toBe(false);
    expect(last().runs?.[0]).toMatchObject({ guard: 'behaviorGuard', result: 'false' });
    behavior.next(true);
    await expect(router.navigateByUrl('/behavior')).resolves.toBe(true);
    expect(last().runs?.[0]).toMatchObject({ result: 'true' });
  });

  it('waits for a Subject to emit', async () => {
    const navigation = router.navigateByUrl('/subject');
    await new Promise((resolve) => setTimeout(resolve, 5));
    subject.next(true);
    await expect(navigation).resolves.toBe(true);
    expect(last().runs?.[0]).toMatchObject({ guard: 'subjectGuard', result: 'true' });
  });

  it('records an async guard and resolver on their first value', async () => {
    await expect(router.navigateByUrl('/async')).resolves.toBe(true);
    expect(last().runs?.map((run) => [run.kind, run.guard, run.result])).toEqual([
      ['canActivate', 'asyncGuard', 'true'],
      ['resolve', 'v: asyncResolver', 'string'],
    ]);
  });
});

describe('tracked guard observables', () => {
  it('records the first value of an async source read through first()', async () => {
    const { wrapped, nav } = wrapGuard(later(true));
    const value = await new Promise((resolve) => wrapped.pipe(first()).subscribe(resolve));
    expect(value).toBe(true);
    expect(nav[0].runs).toEqual([expect.objectContaining({ result: 'true' })]);
  });

  it('records a subscription dropped before any value as cancelled', () => {
    const { wrapped, nav } = wrapGuard(later(true));
    wrapped.subscribe().unsubscribe();
    expect(nav[0].runs).toEqual([expect.objectContaining({ result: 'cancelled before a value' })]);
  });

  it('records an error once', () => {
    const { wrapped, nav } = wrapGuard(
      new Observable<boolean>((s) => s.error(new Error('denied'))),
    );
    wrapped.subscribe({ error: () => {} });
    expect(nav[0].runs).toEqual([expect.objectContaining({ result: 'threw denied' })]);
  });
});
