import { describe, expect, it, vi } from 'vitest';
import type { NgrxLogEntry, NgrxRequest } from '../../ngrx-shared.ts';
import { createNgrxDevtoolsTools, explainChangeText, touchesPath } from '../ngrx-devtools-tools.ts';
import { isRefusal } from '../refusal.ts';
import { UNTRUSTED } from '../forms-tools.ts';
import type { NgrxPageRecord, NgrxPages } from '../ngrx-tools.ts';

function entry(seq: number, patch: Partial<NgrxLogEntry>): NgrxLogEntry {
  return {
    seq,
    source: 'store',
    storeId: 'store',
    type: `a${seq}`,
    timestamp: Date.UTC(2026, 0, 1, 0, 0, seq),
    diff: [],
    restorable: true,
    ...patch,
  };
}

function pages(log: NgrxLogEntry[], classic = true): NgrxPages {
  const page: NgrxPageRecord = {
    pageId: 'p1',
    session: 's',
    url: '/',
    title: '',
    stores: [],
    classic: classic ? { state: {}, devtools: true, scope: 'root' } : null,
    log,
    reportedAt: 1,
  };
  return new Map([['p1', page]]);
}

describe('touchesPath', () => {
  it('matches the path, paths inside it and paths around it', () => {
    expect(touchesPath('cart.items', 'cart.items')).toBe(true);
    expect(touchesPath('cart.items[0]', 'cart.items')).toBe(true);
    expect(touchesPath('cart', 'cart.items')).toBe(true);
    expect(touchesPath('(root)', 'cart')).toBe(true);
    expect(touchesPath('cart.itemsCount', 'cart.items')).toBe(false);
    expect(touchesPath('user', 'cart')).toBe(false);
  });
});

describe('explainChangeText', () => {
  const log = [
    entry(1, {
      type: '[Cart] Add',
      action: { type: '[Cart] Add', item: 'rome' },
      origin: 'dispatch',
      diff: [{ path: 'cart.items[0]', op: 'add', after: 'rome' }],
      trace: ['addToCart (src/app/cart.ts:12:5)'],
    }),
    entry(2, {
      type: '[User] Login',
      diff: [{ path: 'user.name', op: 'change', before: null, after: 'ada' }],
    }),
    entry(3, {
      type: '[Cart] Clear',
      origin: 'effect',
      diff: [{ path: 'cart.items', op: 'change', before: ['rome'], after: [] }],
    }),
  ];

  it('lists the entries that wrote a path, newest first, with origin and call site', () => {
    const text = explainChangeText(pages(log), undefined, undefined, 'cart.items', undefined);
    expect(text).toMatch(/^`cart.items` last changed in #3 \(\[Cart\] Clear\)/);
    expect(text.indexOf('#3')).toBeLessThan(text.indexOf('### #1'));
    expect(text).toContain('origin: an NgRx effect');
    expect(text).toContain('`addToCart (src/app/cart.ts:12:5)`');
    expect(text).not.toContain('[User] Login');
    expect(text).not.toContain('ngrx: { trace: true }');
  });

  it('explains one entry and says how to record call sites', () => {
    const text = explainChangeText(pages(log), 'p1', undefined, undefined, 2);
    expect(text).toContain('action `[User] Login`');
    expect(text).toContain('`user.name` change null → "ada"');
    expect(text).toContain('ngrx: { trace: true }');
  });

  it('says when nothing wrote the path, and when nothing reports', () => {
    expect(explainChangeText(pages(log), undefined, 'store', 'todos', undefined)).toMatch(
      /No entry in the kept log of `Store` changed `todos`/,
    );
    expect(explainChangeText(new Map(), undefined, undefined, 'x', undefined)).toMatch(
      /No NgRx state/,
    );
    expect(explainChangeText(pages(log), undefined, undefined, undefined, undefined)).toMatch(
      /Pass `path`/,
    );
  });
});

describe('ngrx-explain-change tool', () => {
  function explain(ngrx: NgrxPages) {
    const [, tool] = createNgrxDevtoolsTools({ ask: vi.fn(), pages: () => ngrx });
    return tool;
  }

  it('keeps the store filter for an entry number', () => {
    const ngrx = pages([entry(1, { storeId: 'ngrx-1' })]);
    expect(explainChangeText(ngrx, undefined, 'store', undefined, 1)).toMatch(
      /#1 belongs to `ngrx-1`, not `Store`/,
    );
  });

  it('answers a refusal still marked, with one untrusted notice', async () => {
    const ngrx = pages([]);
    const missing = (await explain(ngrx).handler({})).markdown;
    expect(isRefusal(missing)).toBe(true);
    const unknown = (await explain(ngrx).handler({ page: 'nope', path: 'x' })).markdown;
    expect(isRefusal(unknown)).toBe(true);
    expect(unknown.split(UNTRUSTED)).toHaveLength(2);
  });
});

describe('ngrx-store-devtools tool', () => {
  function tool(ngrx: NgrxPages) {
    const ask = vi.fn(async (_page: string | undefined, _request: NgrxRequest) => ({
      ok: true,
      message: 'Committed.',
    }));
    const [devtools] = createNgrxDevtoolsTools({ ask, pages: () => ngrx });
    return { devtools, ask };
  }

  it('sends a checked request to the page', async () => {
    const { devtools, ask } = tool(pages([]));
    const answer = await devtools.handler({ op: 'toggle', seq: 4, page: 'p1' });
    expect(ask).toHaveBeenCalledWith('p1', { type: 'devtools', op: 'toggle', seq: 4 });
    expect(answer.markdown).toContain('Committed.');
  });

  it('refuses a bad request or a page without a Store', async () => {
    const { devtools, ask } = tool(pages([], false));
    expect((await devtools.handler({ op: 'sweep' })).markdown).toMatch(/one of/);
    expect((await devtools.handler({ op: 'commit', page: 'p1' })).markdown).toMatch(
      /no @ngrx\/store Store/,
    );
    expect((await devtools.handler({ op: 'commit', page: 'nope' })).markdown).toMatch(/nope/);
    expect(ask).not.toHaveBeenCalled();
  });
});
