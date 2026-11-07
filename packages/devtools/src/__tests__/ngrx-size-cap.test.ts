import { describe, expect, it } from 'vitest';
import type { NgrxPageReport } from '../ngrx-shared.ts';
import {
  NGRX_STATE_MAX_BYTES,
  NGRX_TOO_LARGE_FIELD,
  capNgrxFields,
  capNgrxState,
  tooLargeText,
} from '../rpc/ngrx-size-cap.ts';
import { mergeNgrxReport, ngrxStateOf, type NgrxPages } from '../rpc/ngrx-tools.ts';

const big = (kb: number) => 'x'.repeat(kb * 1024);

describe('NgRx state size cap', () => {
  it('caps at 256 KB', () => {
    expect(NGRX_STATE_MAX_BYTES).toBe(256 * 1024);
  });

  it('keeps a state under the cap as it is', () => {
    const state = { todos: [{ id: 1, title: 'a' }], filter: 'all' };
    expect(capNgrxState(state)).toBe(state);
  });

  it('replaces only the largest slices of an object past the cap', () => {
    const capped = capNgrxState({ huge: big(300), small: 'ok', medium: big(10) }) as Record<
      string,
      unknown
    >;
    expect(capped['huge']).toBe('[too large: 301 KB]');
    expect(capped['small']).toBe('ok');
    expect(capped['medium']).toBe(big(10));
  });

  it('replaces several slices when one is not enough', () => {
    const capped = capNgrxState({ a: big(200), b: big(150), c: big(1) }) as Record<string, unknown>;
    expect(capped['a']).toMatch(/^\[too large: \d+ KB\]$/);
    expect(capped['b']).toBe(big(150));
    const two = capNgrxState({ a: big(200), b: big(200), c: big(200) }) as Record<string, unknown>;
    expect(
      Object.values(two).filter((v) => typeof v === 'string' && v.startsWith('[too')),
    ).toHaveLength(2);
  });

  it('turns a large array or string into the marker', () => {
    expect(capNgrxState(big(300))).toBe(tooLargeText(300 * 1024 + 2));
    expect(capNgrxState([big(200), big(200)])).toMatch(/^\[too large: 40\d KB\]$/);
  });

  it('counts bytes, not characters', () => {
    // Each "é" is 2 bytes in UTF-8.
    expect(capNgrxState('é'.repeat(140 * 1024))).toMatch(/^\[too large: 28\d KB\]$/);
  });

  it('never replaces a slice that is no larger than its marker', () => {
    const fn = () => undefined;
    const capped = capNgrxState(
      { a: 'x'.repeat(30), b: 1, c: fn, d: 'y'.repeat(30) },
      60,
    ) as Record<string, unknown>;
    // The 30-character strings shrink to the marker; the number and the function stay.
    expect(capped['a']).toBe('[too large: 1 KB]');
    expect(capped['d']).toBe('[too large: 1 KB]');
    expect(capped['b']).toBe(1);
    expect(capped['c']).toBe(fn);
  });

  it('turns a state of many small fields that still does not fit into the marker', () => {
    const many = Object.fromEntries(Array.from({ length: 30_000 }, (_, i) => [`k${i}`, i]));
    const capped = capNgrxState(many);
    expect(capped).toMatch(/^\[too large: \d+ KB\]$/);
    expect(capNgrxFields(many)).toEqual({ [NGRX_TOO_LARGE_FIELD]: capped });
  });

  it('caps the fields of a signal store as one state', () => {
    expect(capNgrxFields({ a: big(200), b: big(100) })).toEqual({
      a: '[too large: 201 KB]',
      b: big(100),
    });
  });
});

describe('stored NgRx pages', () => {
  function report(): NgrxPageReport {
    return {
      pageId: 'p1',
      session: 's1',
      url: 'http://localhost/',
      title: 'App',
      stores: [
        {
          id: 'store-1',
          kind: 'signal-store',
          className: 'TodoStore',
          scope: 'root',
          stateKeys: ['items', 'filter'],
          state: { items: [big(300)], filter: 'all' },
          computed: { count: 1 },
          methods: [],
          references: [],
          writable: true,
        },
      ],
      classic: {
        state: { catalog: big(400), user: { name: 'Ada' } },
        devtools: false,
        scope: 'root',
      },
      log: [],
    } as unknown as NgrxPageReport;
  }

  it('stores every state capped, for the panel and the agent tools', () => {
    const pages: NgrxPages = new Map();
    mergeNgrxReport(pages, report(), []);
    const page = ngrxStateOf(pages).pages[0];
    expect(page.stores[0].state).toEqual({ items: '[too large: 301 KB]', filter: 'all' });
    expect(page.stores[0].computed).toEqual({ count: 1 });
    expect(page.classic?.state).toEqual({ catalog: '[too large: 401 KB]', user: { name: 'Ada' } });
  });
});
