// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { ComponentDebugNg } from '../component-tree.ts';
import { selectedComponentSummary } from '../element-sidebar.ts';

const SIGNAL = Symbol('SIGNAL');

function signalOf<T>(value: T) {
  const fn = () => value;
  (fn as unknown as Record<symbol, unknown>)[SIGNAL] = { value };
  return fn;
}

class HotelCard {
  name = signalOf('Riad Zitoun');
  nights = 3;
  guests = signalOf(2);
  apiToken = 'sk-live-secret-value';
  booked = { emit: () => {} };
}

function fakeNg(instances: Map<Element, object>): ComponentDebugNg {
  return {
    getComponent: (el) => instances.get(el) ?? null,
    getDirectives: () => [],
    isSignal: (v) => typeof v === 'function' && SIGNAL in (v as object),
    getDirectiveMetadata: () => ({ inputs: { name: 'name' }, outputs: { booked: 'booked' } }),
  };
}

describe('the Elements sidebar summary', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('describes the component that owns the selected element, with masked values', () => {
    document.body.innerHTML = `<app-hotel-card><h3><span>Riad</span></h3></app-hotel-card>`;
    const host = document.querySelector('app-hotel-card')!;
    const ng = fakeNg(new Map<Element, object>([[host, new HotelCard()]]));

    const summary = selectedComponentSummary(ng, document.querySelector('span'))!;
    expect(summary).toMatchObject({
      component: 'HotelCard',
      host: '<app-hotel-card>',
      selected: '<span>',
      inputs: { name: 'Riad Zitoun' },
      signals: { guests: 2 },
      outputs: ['booked'],
    });
    expect(summary.properties).toMatchObject({ nights: 3 });
    // The secret goes through the same masking as the panel.
    expect(JSON.stringify(summary)).not.toContain('sk-live-secret-value');
  });

  it('leaves out the selected tag when the host itself is selected', () => {
    document.body.innerHTML = `<app-hotel-card></app-hotel-card>`;
    const host = document.querySelector('app-hotel-card')!;
    const ng = fakeNg(new Map<Element, object>([[host, new HotelCard()]]));
    expect(selectedComponentSummary(ng, host)).not.toHaveProperty('selected');
  });

  it('gives null outside any component, without a debug API, or for a non-element', () => {
    document.body.innerHTML = `<p>plain</p>`;
    const ng = fakeNg(new Map());
    expect(selectedComponentSummary(ng, document.querySelector('p'))).toBeNull();
    expect(selectedComponentSummary(undefined, document.querySelector('p'))).toBeNull();
    expect(selectedComponentSummary(ng, null)).toBeNull();
    expect(selectedComponentSummary(ng, 'app-root')).toBeNull();
  });

  it('gives null when the debug API throws', () => {
    document.body.innerHTML = `<app-x></app-x>`;
    const ng = {
      getComponent: () => {
        throw new Error('destroyed view');
      },
    } as unknown as ComponentDebugNg;
    expect(selectedComponentSummary(ng, document.querySelector('app-x'))).toBeNull();
  });
});
