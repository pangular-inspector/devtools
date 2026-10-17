// @vitest-environment jsdom
import '@angular/compiler';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterLink, RouterLinkActive, provideRouter, type Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RouterDebugApi } from '../router.ts';
import { linksOf, MAX_LINK_CANDIDATES } from '../router-links.ts';
import { elementById } from '../element-id.ts';
import { isRouterReport } from '../rpc/router-tools.ts';
import { lintRoutesText } from '../rpc/router-config-tools.ts';
import { inspectRouteText } from '../rpc/router-tools.ts';
import { angularAtLeast, initAngularTestBed, STANDALONE } from './angular-version.ts';

initAngularTestBed();

class Bound {
  readonly target = '/a';
  readonly card = ['/b'];
}
Component({
  ...STANDALONE,
  selector: 'app-bound',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div id="row" [routerLink]="target">Row</div>
    <section id="card" [routerLink]="card" routerLinkActive="on">Card</section>
    <span>Plain</span>
  `,
})(Bound);

const routes: Routes = [
  { path: 'a', component: Bound },
  { path: 'b', component: Bound },
];

// RouterTestingHarness exists from 15.2.
describe.runIf(angularAtLeast('15.2'))('property-bound routerLink on a real Router', () => {
  let router: Router;
  const ng = () => (globalThis as { ng?: RouterDebugApi }).ng!;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    router = TestBed.inject(Router);
  });

  it('finds [routerLink] on elements that carry no routerlink attribute', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/b');
    harness.detectChanges();
    const row = document.getElementById('row')!;
    expect(row.hasAttribute('routerlink')).toBe(false);
    const links = linksOf(ng(), router as never);
    const found = links.find((l) => l.text === 'Row');
    expect(found).toMatchObject({ element: 'div', href: '/a', active: false });
    expect(links.find((l) => l.text === 'Card')).toMatchObject({
      element: 'section',
      href: '/b',
      active: true,
      linkActive: true,
    });
    expect(links.some((l) => l.text === 'Plain')).toBe(false);
  });

  it('gives each link a stable id and writes nothing to the DOM', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/a');
    harness.detectChanges();
    const before = document.body.innerHTML;
    const first = linksOf(ng(), router as never).find((l) => l.text === 'Row')!;
    const second = linksOf(ng(), router as never).find((l) => l.text === 'Row')!;
    expect(first.devtoolsId).toBeTruthy();
    expect(second.devtoolsId).toBe(first.devtoolsId);
    expect(elementById(first.devtoolsId!)).toBe(document.getElementById('row'));
    expect(document.body.innerHTML).toBe(before);
  });
});

describe('link truncation count', () => {
  const fakeLink = { urlTree: '/x', router: {} };
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    for (let i = 0; i < 130; i++) {
      const el = document.createElement('div');
      el.setAttribute('tabindex', '0');
      el.textContent = `L${i}`;
      host.append(el);
    }
    // Candidates without RouterLink are not counted.
    for (let i = 0; i < 5; i++) host.append(document.createElement('button'));
    document.body.append(host);
  });

  afterEach(() => host.remove());

  it('lists 100 links and counts the rest in cut.links', () => {
    const ng: RouterDebugApi = {
      getDirectives: (el: Element) =>
        host.contains(el) && el.hasAttribute('tabindex') ? [fakeLink] : [],
    } as never;
    const router = { serializeUrl: (tree: unknown) => String(tree), isActive: () => false };
    const cut = { links: 0 };
    const links = linksOf(ng, router, cut);
    expect(links).toHaveLength(100);
    expect(cut.links).toBe(30);
    expect(links[0]).toMatchObject({ text: 'L0', href: '/x', element: 'div' });
  });

  it('checks at most MAX_LINK_CANDIDATES elements and counts the ones it skipped', () => {
    // Candidates already on the page (the host's and any an earlier test left).
    let before = 0;
    linksOf({ getDirectives: () => (before++, []) } as never, {});
    const extra = document.createElement('div');
    for (let i = 0; i < MAX_LINK_CANDIDATES; i++) extra.append(document.createElement('button'));
    document.body.append(extra);
    try {
      let checked = 0;
      const ng: RouterDebugApi = {
        getDirectives: (el: Element) => {
          checked++;
          return host.contains(el) && el.hasAttribute('tabindex') ? [fakeLink] : [];
        },
      } as never;
      const router = { serializeUrl: (tree: unknown) => String(tree), isActive: () => false };
      const cut = { links: 0, unchecked: 0 };
      const links = linksOf(ng, router, cut);
      expect(checked).toBe(MAX_LINK_CANDIDATES);
      expect(links).toHaveLength(100);
      expect(cut.links).toBe(30);
      expect(cut.unchecked).toBe(before);
    } finally {
      extra.remove();
    }
  });

  it('says "at least" when some candidates were not checked', () => {
    const report = {
      pageId: 'p1',
      snapshot: null,
      navigations: [],
      linksTruncated: 30,
      linksUnchecked: 12,
    };
    expect(isRouterReport(report)).toBe(true);
    expect(isRouterReport({ ...report, linksUnchecked: 'some' })).toBe(false);
    const page = {
      ...report,
      reportedAt: Date.now(),
      changedAt: Date.now(),
      config: [],
      snapshot: { url: '/', root: null, queryParams: {} },
    };
    const state = { pages: [page] } as never;
    expect(lintRoutesText(state, {})).toContain('At least 30 link(s) past the first 100');
    expect(lintRoutesText(state, {})).toContain('12 elements that could hold a link');
    expect(inspectRouteText(state, { selector: 'Nope' })).toContain(
      'At least 30 link(s) past the first 100 on the page were not searched',
    );
    const none = { pages: [{ ...page, linksTruncated: undefined }] } as never;
    expect(lintRoutesText(none, {})).toContain('12 elements that could hold a link');
  });

  it('accepts linksTruncated in a report and mentions it in the agent text', () => {
    const report = { pageId: 'p1', snapshot: null, navigations: [], linksTruncated: 30 };
    expect(isRouterReport(report)).toBe(true);
    expect(isRouterReport({ ...report, linksTruncated: 'many' })).toBe(false);
    const page = {
      ...report,
      reportedAt: Date.now(),
      changedAt: Date.now(),
      config: [],
      snapshot: { url: '/', root: null, queryParams: {} },
    };
    const state = { pages: [page] } as never;
    expect(lintRoutesText(state, {})).toContain('30 link(s) past the first 100');
    expect(inspectRouteText(state, { selector: 'Nope' })).toContain(
      '30 link(s) past the first 100 on the page were not searched',
    );
  });
});
