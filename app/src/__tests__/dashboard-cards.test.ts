import { describe, expect, it } from 'vitest';
import { componentsCard, routesCard, storeCard, zoneLabel } from '../pages/dashboard';

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
});
