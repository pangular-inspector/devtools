import { describe, expect, it } from 'vitest';
import { resolvePangularConfig } from '@pangular-inspector/devtools/config';
import {
  componentsCard,
  dashboardStats,
  formsCard,
  httpCard,
  routesCard,
  storeCard,
  zoneLabel,
} from '../pages/dashboard';

const form = (id: string, status: string) => ({ id, root: { status } });

describe('dashboard cards', () => {
  it('names the change detection mode the page reported', () => {
    expect(zoneLabel('zoneless')).toBe('Zoneless');
    expect(zoneLabel('zone')).toBe('zone.js');
    expect(zoneLabel('zone-unused')).toBe('Zoneless, zone.js loaded');
    expect(zoneLabel(null)).toBeNull();
    expect(zoneLabel('toString')).toBeNull();
  });

  it('counts source components when the rows carry no kind', () => {
    expect(componentsCard([{}, {}, {}])).toEqual({ value: 3, sub: 'discovered in source' });
  });

  it('splits live components from directives', () => {
    expect(
      componentsCard([{ kind: 'component' }, { kind: 'component' }, { kind: 'directive' }]),
    ).toEqual({ value: 2, sub: 'components · 1 directive' });
    expect(componentsCard([{ kind: 'component' }])).toEqual({
      value: 1,
      sub: 'components · 0 directives',
    });
  });

  it('counts source route entries when the rows carry no kind', () => {
    expect(routesCard([{ path: 'a' }, { path: 'b' }])).toEqual({
      value: 2,
      sub: 'route entries in source',
    });
  });

  it('counts distinct navigable paths and redirects', () => {
    expect(
      routesCard([
        { kind: 'page', fullPath: '/a' },
        { kind: 'page', fullPath: '/a' },
        { kind: 'page', path: 'b' },
        { kind: 'redirect', path: '' },
        { kind: 'redirect', path: 'old' },
      ]),
    ).toEqual({ value: 2, sub: 'navigable paths · 2 redirects' });
  });

  it('counts source declarations when the rows carry no kind', () => {
    expect(storeCard([{}, {}])).toEqual({ value: 2, sub: 'declarations in source' });
  });

  it('lists NgRx declaration kinds, most common first', () => {
    expect(
      storeCard([
        { kind: 'action' },
        { kind: 'reducer' },
        { kind: 'action' },
        { kind: 'signal-store' },
        { kind: 'custom' },
      ]),
    ).toEqual({
      value: 5,
      sub: '2 actions · 1 reducer · 1 signal store · 1 custom',
    });
  });

  it('counts the forms of the host page and the invalid ones', () => {
    const state = {
      forms: [
        form('checkout@host', 'INVALID'),
        form('search@host', 'VALID'),
        form('login@host', 'PENDING'),
        form('profile@other', 'INVALID'),
      ],
    };
    expect(formsCard(state, 'host')).toEqual({ value: 3, sub: 'forms · 1 invalid' });
    expect(formsCard(state, 'other')).toEqual({ value: 1, sub: 'form · 1 invalid' });
  });

  it('counts the forms of every page without a host page, like the Forms tab', () => {
    const state = { forms: [form('a@one', 'INVALID'), form('b@two', 'INVALID')] };
    expect(formsCard(state, null)).toEqual({ value: 2, sub: 'forms · 2 invalid' });
  });

  it('says when no form is reported', () => {
    expect(formsCard({}, null)).toEqual({ value: 0, sub: 'no forms on the page yet' });
    expect(formsCard({ forms: [form('a@other', 'VALID')] }, 'host')).toEqual({
      value: 0,
      sub: 'no forms on the page yet',
    });
  });

  it('counts the calls of the host page with its server calls, and the failed ones', () => {
    const state = {
      serverCalls: [
        { status: 200, pageUrl: '/trips' },
        { status: 500, pageUrl: '/trips' },
        { status: 404, pageUrl: '/other' },
      ],
      pages: [
        {
          pageId: 'host',
          initialUrl: '/trips',
          reportedAt: 1,
          calls: [{ status: 200 }, { status: 0 }, { status: 0, cancelled: true }, { status: 302 }],
        },
        { pageId: 'newer', reportedAt: 5, calls: [{ status: 503 }] },
      ],
    };
    expect(httpCard(state, 'host')).toEqual({ value: 6, sub: 'calls · 2 failed' });
  });

  it('counts the newest page without a host page', () => {
    const state = {
      pages: [
        { pageId: 'old', reportedAt: 1, calls: [{ status: 200 }, { status: 200 }] },
        { pageId: 'new', reportedAt: 9, calls: [{ status: 401 }] },
      ],
    };
    expect(httpCard(state, null)).toEqual({ value: 1, sub: 'call · 1 failed' });
  });

  it('says when no call is recorded', () => {
    expect(httpCard({}, null)).toEqual({ value: 0, sub: 'no calls recorded yet' });
    expect(httpCard({ pages: [] }, 'host')).toEqual({ value: 0, sub: 'no calls recorded yet' });
    expect(httpCard({ serverCalls: [{ status: 500 }], pages: [] }, 'host')).toEqual({
      value: 0,
      sub: 'no calls recorded yet',
    });
  });

  it('shows the Forms and SSR & HTTP cards only while their inspectors are on', () => {
    const tabs = (config: unknown) =>
      dashboardStats(resolvePangularConfig(config)).map((stat) => stat.tab);
    expect(tabs({})).toEqual(expect.arrayContaining(['forms', 'network']));
    expect(tabs({ inspectors: { forms: false } })).not.toContain('forms');
    expect(tabs({ inspectors: { forms: false } })).toContain('network');
    expect(tabs({ inspectors: { http: false } })).not.toContain('network');
    expect(tabs({ inspectors: { http: false } })).toContain('forms');
  });
});
