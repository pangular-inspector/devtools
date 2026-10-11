// @vitest-environment jsdom
import '@angular/compiler';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { Router, provideRouter, type Routes } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchRouter, type NavigationRecord } from '../router.ts';
import { runAction } from '../router-actions.ts';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

class Page {}
Component({ selector: 'app-page', template: '' })(Page);

let release: (value: boolean) => void = () => {};
let guardedRuns = 0;

const routes: Routes = [
  { path: '', component: Page },
  {
    path: 'slow',
    component: Page,
    canMatch: [() => new Promise<boolean>((resolve) => (release = resolve))],
    canActivate: [
      () => {
        guardedRuns++;
        return true;
      },
    ],
  },
];

describe('probe that times out', () => {
  let router: Router;
  let navigations: NavigationRecord[];
  let stop: (() => void) | null;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    router = TestBed.inject(Router);
    navigations = [];
    stop = watchRouter(router as never, navigations, () => {});
    await router.navigateByUrl('/');
    guardedRuns = 0;
  });

  afterEach(() => {
    stop?.();
    vi.useRealTimers();
  });

  it('aborts the probe navigation and marks it as a probe', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const pending = runAction(
      router as never,
      navigations,
      { action: 'probe', url: '/slow' },
      () => {},
    );
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toMatchObject({ error: expect.stringContaining('10s') });
    release(true);
    await vi.advanceTimersByTimeAsync(50);
    expect(router.url).toBe('/');
    expect(guardedRuns).toBe(0);
    expect(navigations.some((n) => n.url === '/slow' && n.probe === true)).toBe(true);
  });
});
