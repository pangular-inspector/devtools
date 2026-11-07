// @vitest-environment jsdom
import {
  AsyncSubject,
  BehaviorSubject,
  Observable,
  ReplaySubject,
  Subject,
  interval,
  of,
  timer,
} from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { describe, expect, it } from 'vitest';
import { sharedSource } from '../async-source.ts';
import { angularAtLeast } from './angular-version.ts';

describe('sharedSource', () => {
  it('treats Promises and every kind of Subject as shared', () => {
    expect(sharedSource(Promise.resolve(1))).toBe(true);
    expect(sharedSource(new Subject())).toBe(true);
    expect(sharedSource(new BehaviorSubject(1))).toBe(true);
    expect(sharedSource(new ReplaySubject(1))).toBe(true);
    expect(sharedSource(new AsyncSubject())).toBe(true);
  });

  it('treats an operator-free view of a Subject as shared', () => {
    const subject = new ReplaySubject<number>(1);
    expect(sharedSource(subject.asObservable())).toBe(true);
    expect(sharedSource(subject.asObservable().pipe())).toBe(true);
  });

  it('treats a cold observable or one with an operator as not known to be shared', () => {
    expect(sharedSource(new Observable((s) => s.next(1)))).toBe(false);
    expect(sharedSource(of(1))).toBe(false);
    expect(sharedSource(interval(1000).pipe(map((n) => n * 2)))).toBe(false);
    // Each subscriber of an operator on a Subject starts its own inner work.
    expect(sharedSource(new Subject<void>().pipe(switchMap(() => timer(10))))).toBe(false);
    // `shareReplay` keeps its state in a closure, so it stays a possible duplicate.
    expect(sharedSource(of(1).pipe(shareReplay(1)))).toBe(false);
  });

  it('ignores values that are not async sources and survives throwing getters', () => {
    expect(sharedSource(undefined)).toBe(false);
    expect(sharedSource(null)).toBe(false);
    expect(sharedSource('text')).toBe(false);
    const hostile = {
      get then(): unknown {
        throw new Error('boom');
      },
      get source(): unknown {
        throw new Error('boom');
      },
    };
    expect(sharedSource(hostile)).toBe(false);
    const loop: Record<string, unknown> = { operator: undefined };
    loop['source'] = loop;
    expect(sharedSource(loop)).toBe(false);
  });

  it.runIf(angularAtLeast('19.0'))('treats an NgRx store select as shared', async () => {
    await import('@angular/compiler');
    const { TestBed } = await import('@angular/core/testing');
    const { initAngularTestBed } = await import('./angular-version.ts');
    const { Store, createReducer, provideStore } = await import('@ngrx/store');
    initAngularTestBed();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideStore({ count: createReducer(1) })],
    });
    const store = TestBed.inject(Store) as InstanceType<typeof Store<{ count: number }>>;
    expect(sharedSource(store)).toBe(true);
    expect(sharedSource(store.select((state) => state.count))).toBe(true);
    TestBed.resetTestingModule();
  });
});
