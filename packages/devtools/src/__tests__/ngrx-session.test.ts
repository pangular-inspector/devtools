// @vitest-environment jsdom
import { createHostContext } from 'devframe/node';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import pangular, { createPangular } from '../devframe.ts';
import { domTree } from '../host-tree.ts';
import { createNgrxCollector } from '../ngrx-collector.ts';
import {
  applyPatches,
  generateTest,
  hasLossyMarkers,
  MAX_SESSION_ENTRIES,
  parseSession,
  patchesBetween,
  patchProblem,
  SESSION_FORMAT,
  sessionEntryDetail,
  sessionJson,
  sessionStates,
  sliceSession,
  toCode,
  type NgrxSession,
} from '../ngrx-session.ts';
import type { NgrxPageReport, NgrxRequest } from '../ngrx-shared.ts';
import {
  createNgrxHistory,
  entryDetailText,
  exportText,
  IMPORTED_TTL_MS,
  importText,
  MAX_IMPORTED,
  testText,
} from '../rpc/ngrx-session-tools.ts';
import { answerText } from './tool-answer.ts';

function session(overrides: Partial<NgrxSession> = {}): NgrxSession {
  return {
    format: SESSION_FORMAT,
    version: 1,
    exportedAt: 1,
    store: { id: 'store', kind: 'store' },
    initialState: { cart: { items: [] as string[] }, user: { name: 'Ada' } },
    entries: [
      {
        seq: 3,
        type: '[Cart] Add',
        timestamp: 3,
        source: 'store',
        action: { type: '[Cart] Add', item: 'rome' },
        changes: [{ op: 'set', path: ['cart', 'items'], value: ['rome'] }],
      },
      {
        seq: 4,
        type: '[Cart] Add',
        timestamp: 4,
        source: 'store',
        action: { type: '[Cart] Add', item: 'oslo' },
        changes: [{ op: 'set', path: ['cart', 'items'], value: ['rome', 'oslo'] }],
      },
    ],
    ...overrides,
  };
}

describe('ngrx session patches', () => {
  it('turns one state into the next and back to the same value', () => {
    const before = { a: 1, list: [1, 2], nested: { keep: { x: 1 }, drop: true }, grow: [1] };
    const after = { a: 2, list: [1, 3], nested: { keep: { x: 1 }, added: 'y' }, grow: [1, 2] };
    const patches = patchesBetween(before, after);
    expect(patches).toEqual([
      { op: 'set', path: ['a'], value: 2 },
      { op: 'set', path: ['list', 1], value: 3 },
      { op: 'delete', path: ['nested', 'drop'] },
      { op: 'set', path: ['nested', 'added'], value: 'y' },
      { op: 'set', path: ['grow'], value: [1, 2] },
    ]);
    const next = applyPatches(before, patches) as typeof after;
    expect(next).toEqual(after);
    // Untouched branches are shared, and the input is left as it was.
    expect(next.nested.keep).toBe(before.nested.keep);
    expect(before.a).toBe(1);
  });

  it('sets the whole state when an entry changed too much to list', () => {
    const before = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]));
    const after = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i + 1]));
    expect(patchesBetween(before, after, 10)).toEqual([{ op: 'set', path: [], value: after }]);
  });

  it('rebuilds each state, an entry detail and a slice', () => {
    const states = sessionStates(session());
    expect(states).toEqual([
      { cart: { items: ['rome'] }, user: { name: 'Ada' } },
      { cart: { items: ['rome', 'oslo'] }, user: { name: 'Ada' } },
    ]);
    expect(states[1]).toHaveProperty('user', states[0] && (states[0] as { user: unknown }).user);
    expect(sessionEntryDetail(session(), 4)).toMatchObject({
      seq: 4,
      before: { cart: { items: ['rome'] } },
      after: { cart: { items: ['rome', 'oslo'] } },
      diff: [{ path: 'cart.items[1]', op: 'add', after: 'oslo' }],
    });
    expect(sessionEntryDetail(session(), 9)).toBeNull();
    const sliced = sliceSession(session(), 4, 4);
    expect(sliced.initialState).toEqual({ cart: { items: ['rome'] }, user: { name: 'Ada' } });
    expect(sliced.entries.map((e) => e.seq)).toEqual([4]);
  });

  it('drops the oldest entries until the JSON fits', () => {
    // Each entry replaces one large value, so the state stays under the bound but the session does not.
    const s = session({
      initialState: {},
      entries: [1, 2, 3, 4].map((seq) => ({
        seq,
        type: 'set',
        timestamp: seq,
        source: 'store' as const,
        changes: [{ op: 'set' as const, path: ['big'], value: String(seq).repeat(1_500_000) }],
      })),
    });
    const { json, dropped } = sessionJson(s);
    expect(dropped).toBeGreaterThan(0);
    const kept = JSON.parse(json) as NgrxSession;
    expect(kept.entries.at(-1)?.seq).toBe(4);
    // The rebased start holds what the dropped entries set.
    expect(sessionStates(kept).at(-1)).toEqual(sessionStates(s).at(-1));
  });
});

describe('ngrx session import checks', () => {
  it('accepts a session as text or object and keeps only known fields', () => {
    const parsed = parseSession(JSON.stringify({ ...session(), extra: 'ignored' }));
    expect(parsed).toMatchObject({ store: { id: 'store' }, entries: [{ seq: 3 }, { seq: 4 }] });
    expect(parsed).not.toHaveProperty('extra');
    expect(parseSession(session())).toMatchObject({ format: SESSION_FORMAT });
  });

  it('refuses what is not a session, or not one this version reads', () => {
    expect(parseSession('{')).toBe('The session is not valid JSON.');
    expect(parseSession('[]')).toBe('The session must be a JSON object.');
    expect(parseSession({ format: 'other' })).toMatch(/not a Pangular Inspector NgRx session/);
    expect(parseSession({ ...session(), version: 2 })).toMatch(/Only version 1/);
    expect(parseSession({ ...session(), store: { id: 'x', kind: 'nope' } })).toMatch(/`store`/);
    const backwards = session();
    backwards.entries[1].seq = 2;
    expect(parseSession(backwards)).toMatch(/Entry 2 needs a whole `seq` larger/);
    const many = session({
      entries: Array.from({ length: MAX_SESSION_ENTRIES + 1 }, (_, i) => ({
        seq: i,
        type: 't',
        timestamp: 0,
        source: 'store' as const,
        changes: [],
      })),
    });
    expect(parseSession(many)).toMatch(/more than 1000 entries/);
    expect(parseSession('x'.repeat(4_000_001))).toMatch(/larger than/);
  });

  it('refuses paths and keys that could reach a prototype', () => {
    const polluted = session();
    polluted.entries[0].changes = [
      { op: 'set', path: ['constructor', 'prototype', 'x'], value: 1 },
    ];
    expect(parseSession(polluted)).toMatch(/Entry 1: a change has a `path`/);
    const proto = JSON.stringify(session()).replace(
      '"initialState":{',
      '"initialState":{"__proto__":{"admin":true},',
    );
    expect(parseSession(proto)).toMatch(/__proto__/);
    expect(({} as Record<string, unknown>)['admin']).toBeUndefined();
  });

  it('refuses changes that would grow a list without bound', () => {
    const base = session({ initialState: { items: [1] } });
    const hostile = (path: (string | number)[], value: unknown) =>
      parseSession({
        ...base,
        entries: [
          {
            seq: 1,
            type: 'x',
            timestamp: 1,
            source: 'store',
            changes: [{ op: 'set', path, value }],
          },
        ],
      });
    expect(hostile(['items', 'length'], 4294967295)).toMatch(
      /Entry 1: a change uses the key `length` on a list/,
    );
    expect(hostile(['items', 999_999], 1)).toMatch(/the index 999999 on a list of 1 items/);
    expect(hostile(['items', 999_999, 'a'], 1)).toMatch(/the index 999999/);
    // Appending at the end and replacing an index still work.
    expect(hostile(['items', 1], 2)).toMatchObject({ entries: [{ seq: 1 }] });
    expect(hostile(['items', 0], 2)).toMatchObject({ entries: [{ seq: 1 }] });
    // Checked against the state each change applies to, not only the first one.
    const grown = parseSession({
      ...base,
      entries: [
        {
          seq: 1,
          type: 'x',
          timestamp: 1,
          source: 'store',
          changes: [
            { op: 'set', path: ['items'], value: [1, 2, 3] },
            { op: 'set', path: ['items', 3], value: 4 },
          ],
        },
        {
          seq: 2,
          type: 'y',
          timestamp: 2,
          source: 'store',
          changes: [{ op: 'set', path: ['items', 9], value: 0 }],
        },
      ],
    });
    expect(grown).toMatch(/Entry 2: a change uses the index 9 on a list of 4 items/);
    // applyPatches skips such a change for callers that did not parse.
    const patch = { op: 'set' as const, path: ['items', 'length'], value: 4294967295 };
    expect(patchProblem({ items: [1] }, patch)).toMatch(/`length`/);
    expect(applyPatches({ items: [1] }, [patch])).toEqual({ items: [1] });
  });
});

/** The identifiers a generated spec runs, ignoring comments and strings. */
function identifiers(code: string): Set<string> {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, code);
  const out = new Set<string>();
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (token === ts.SyntaxKind.Identifier) out.add(scanner.getTokenText());
  }
  return out;
}

describe('ngrx generated tests from a hostile session', () => {
  it('writes a recorded RegExp as new RegExp(source, flags), never as code', () => {
    const run = (value: unknown) =>
      new Function(`return ${toCode({ '@type': 'RegExp', value })};`)();
    const fine = run('/a\\/b+/gi') as RegExp;
    expect(fine).toBeInstanceOf(RegExp);
    expect(fine.source).toBe('a\\/b+');
    expect(fine.flags).toBe('gi');
    const g = globalThis as Record<string, unknown>;
    const escaped = run('/x/; globalThis.pwned = 1; //') as RegExp;
    expect(escaped.source).toBe('x\\/; globalThis.pwned = 1; \\/');
    expect(g['pwned']).toBeUndefined();
    expect(toCode({ '@type': 'RegExp', value: '(globalThis.pwned = 1)' })).toBe(
      'undefined /* a RegExp that could not be read */',
    );
    expect(toCode({ '@type': 'RegExp', value: '/x/gg' })).toMatch(/^undefined /);
    expect(toCode({ '@type': 'RegExp', value: '/x/g;pwned()' })).toMatch(/^undefined /);
    expect(toCode({ '@type': 'RegExp', value: 42 })).toMatch(/^undefined /);
  });

  it('keeps line separators in a type or URL inside their comment', () => {
    const hostile = session({ page: { url: 'https://x.test/\u2029pwnedUrl()' } });
    hostile.entries[0].type = '[Cart] Add\u2028pwnedType()';
    const test = generateTest(hostile);
    if (typeof test === 'string') throw new Error(test);
    expect(test.code).not.toMatch(/[\u2028\u2029]/);
    const ids = identifiers(test.code);
    expect(ids.has('pwnedType')).toBe(false);
    expect(ids.has('pwnedUrl')).toBe(false);
  });

  it('writes the describe title as a string literal', () => {
    const feature = "x\\'); globalThis.pwned = 1; ('";
    const hostile = session({ initialState: { [feature]: { n: 0 } } });
    hostile.entries = [
      {
        seq: 1,
        type: 'inc',
        timestamp: 1,
        source: 'store',
        action: { type: 'inc' },
        changes: [{ op: 'set', path: [feature, 'n'], value: 1 }],
      },
    ];
    const test = generateTest(hostile);
    if (typeof test === 'string') throw new Error(test);
    expect(test.code).toContain(`describe(${JSON.stringify(`${feature} (entry #1)`)}, () => {`);
    expect(identifiers(test.code).has('pwned')).toBe(false);
  });
});

describe('ngrx generated tests', () => {
  it('writes a feature reducer spec when only one top-level key changed', () => {
    const test = generateTest(session());
    if (typeof test === 'string') throw new Error(test);
    expect(test.framework).toBe('Vitest');
    expect(test.file).toBe('cart.reducer.session.spec.ts');
    expect(test.code).toContain("import { cartReducer } from './cart.reducer';");
    expect(test.code).toContain('// #3 [Cart] Add');
    expect(test.code).toContain('item: "oslo"');
    expect(test.code).toContain(
      'expect(state).toEqual({\n      items: [\n        "rome",\n        "oslo",',
    );
    expect(test.notes.join(' ')).toMatch(/Only the `cart` slice changed/);
  });

  it('writes a root reducer spec through combineReducers when several keys changed', () => {
    const s = session();
    s.entries[1].changes.push({ op: 'set', path: ['user', 'name'], value: 'Bo' });
    const test = generateTest(s);
    if (typeof test === 'string') throw new Error(test);
    expect(test.code).toContain("import { combineReducers } from '@ngrx/store';");
    expect(test.code).toContain('combineReducers(reducers)');
  });

  it('writes a signal store spec that calls the recorded methods', () => {
    const test = generateTest({
      ...session(),
      store: { id: 'ngrx-1', kind: 'signal-store', name: 'TripStore' },
      initialState: { query: '', saved: [] },
      entries: [
        {
          seq: 1,
          type: 'setQuery',
          timestamp: 1,
          source: 'signal-store',
          args: ['rome'],
          changes: [{ op: 'set', path: ['query'], value: 'rome' }],
        },
        {
          seq: 2,
          type: 'patchState',
          timestamp: 2,
          source: 'signal-store',
          changes: [{ op: 'set', path: ['saved'], value: ['r1'] }],
        },
      ],
    });
    if (typeof test === 'string') throw new Error(test);
    expect(test.file).toBe('trip.store.session.spec.ts');
    expect(test.code).toContain("import { TripStore } from './trip.store';");
    expect(test.code).toContain('store.setQuery("rome");');
    expect(test.code).toContain('patchState(unprotected(store), {\n      saved: [');
    expect(test.code).toContain('expect(getState(store)).toEqual({');
  });

  it('turns serializer markers back into values and flags what was lost', () => {
    expect(toCode({ '@type': 'undefined' })).toBe('undefined');
    expect(toCode({ '@type': 'Date', value: '2026-01-01T00:00:00.000Z' })).toBe(
      'new Date("2026-01-01T00:00:00.000Z")',
    );
    expect(toCode({ '@type': 'Set', size: 1, values: [1] })).toBe('new Set([\n  1,\n])');
    expect(toCode({ 'a-b': 1 })).toBe('{\n  "a-b": 1,\n}');
    expect(hasLossyMarkers({ password: '[redacted]' })).toBe(true);
    expect(hasLossyMarkers({ deep: '[Truncated]' })).toBe(true);
    expect(hasLossyMarkers({ name: 'Ada' })).toBe(false);
    const lossy = generateTest(
      session({ initialState: { cart: { items: [] }, token: '[redacted]' } }),
    );
    if (typeof lossy === 'string') throw new Error(lossy);
    expect(lossy.notes[0]).toMatch(/cut, redacted or unreadable/);
    expect(generateTest(session({ entries: [] }))).toMatch(/no entries/);
  });
});

/** A classic store the fake collector finds, with a reducer and a secret field. */
function classicPage() {
  document.body.innerHTML = '<app-root ng-version="22"></app-root>';
  const root = document.querySelector('app-root')!;
  let state = { cart: { items: [] as string[] }, auth: { password: 'p', user: 'ada' } };
  const listeners: ((a: unknown) => void)[] = [];
  class _Store {
    source = { getValue: () => state };
    dispatch(action: { type: string; item?: string }) {
      if (action.type === 'add') {
        state = { ...state, cart: { items: [...state.cart.items, action.item!] } };
      }
      for (const l of listeners) l(action);
    }
    select() {}
  }
  class ScannedActionsSubject {
    subscribe(fn: (a: unknown) => void) {
      listeners.push(fn);
      return { unsubscribe: () => {} };
    }
  }
  const store = new _Store();
  const values = new Map<unknown, unknown>([
    [_Store, store],
    [ScannedActionsSubject, new ScannedActionsSubject()],
  ]);
  const rootEnv = {
    scopes: new Set(['root']),
    records: new Map([...values.keys()].map((k) => [k, { value: undefined }])),
  };
  const node = { get: (token: unknown) => values.get(token) ?? null };
  const ng = {
    getInjector: () => node,
    getComponent: (el: Element) => (el === root ? {} : null),
    ɵgetInjectorResolutionPath: () => [node, rootEnv],
    ɵgetInjectorProviders: () => [],
  };
  const collector = createNgrxCollector(
    () => ng as never,
    () => {},
    domTree(),
  );
  collector.collect();
  return { store, collector };
}

describe('ngrx collector history', () => {
  it('answers the State and Diff of a past entry, redacted', () => {
    const { store, collector } = classicPage();
    store.dispatch({ type: 'add', item: 'rome' });
    store.dispatch({ type: 'add', item: 'oslo' });
    const result = collector.run({ type: 'entry', seq: 1 });
    expect(result.detail).toEqual({
      seq: 1,
      storeId: 'store',
      before: { cart: { items: [] }, auth: { password: '[redacted]', user: 'ada' } },
      after: { cart: { items: ['rome'] }, auth: { password: '[redacted]', user: 'ada' } },
      diff: [{ path: 'cart.items[0]', op: 'add', after: 'rome' }],
    });
    expect(collector.run({ type: 'entry', seq: 99 }).error).toMatch(/no longer in the page/);
  });

  it('exports a session that imports back to the same states', () => {
    const { store, collector } = classicPage();
    for (const item of ['rome', 'oslo', 'lima']) store.dispatch({ type: 'add', item });
    const result = collector.run({ type: 'export', from: 2 });
    expect(result.ok).toBe(true);
    const parsed = parseSession(JSON.stringify(result.session));
    if (typeof parsed === 'string') throw new Error(parsed);
    expect(parsed.entries.map((e) => [e.seq, e.action])).toEqual([
      [2, { type: 'add', item: 'oslo' }],
      [3, { type: 'add', item: 'lima' }],
    ]);
    expect(parsed.initialState).toMatchObject({ cart: { items: ['rome'] } });
    expect(sessionStates(parsed).at(-1)).toEqual({
      cart: { items: ['rome', 'oslo', 'lima'] },
      auth: { password: '[redacted]', user: 'ada' },
    });
    expect(JSON.stringify(result.session)).not.toContain('"p"');
  });

  it('keeps a session bounded by the change log limit', () => {
    const { store, collector } = classicPage();
    for (let i = 0; i < 250; i++) store.dispatch({ type: 'add', item: `i${i}` });
    const result = collector.run({ type: 'export' });
    expect(result.session?.entries.length).toBe(200);
    expect(result.session?.entries[0].seq).toBe(51);
  });
});

function report(pageId: string): NgrxPageReport {
  return {
    pageId,
    session: 's1',
    url: '/cart',
    title: 'Cart',
    stores: [],
    classic: { state: {}, devtools: true, scope: 'root' },
    log: [1, 2, 3].map((seq) => ({
      seq,
      source: 'store' as const,
      storeId: 'store',
      type: 'add',
      action: { type: 'add' },
      timestamp: seq,
      diff: [],
      restorable: true,
    })),
  };
}

describe('ngrx history on the server', () => {
  it('keeps imported sessions bounded and expires them', async () => {
    let now = 0;
    const history = createNgrxHistory({
      ask: async () => ({ error: 'no page' }),
      page: () => undefined,
      pages: () => [],
      now: () => now,
    });
    const first = history.importSession(JSON.stringify(session()));
    if ('error' in first) throw new Error(first.error);
    expect(first.entries.map((e) => e.seq)).toEqual([3, 4]);
    expect(first.entries[0]).not.toHaveProperty('changes');
    expect(
      await history.history({ session: first.id, request: { type: 'entry', seq: 4 } }),
    ).toMatchObject({
      ok: true,
      detail: { after: { cart: { items: ['rome', 'oslo'] } } },
    });
    const test = await history.history({ session: first.id, request: { type: 'test', from: 4 } });
    expect(test.test?.code).toContain('// #4 [Cart] Add');
    expect(test.test?.code).not.toContain('// #3');
    for (let i = 0; i < MAX_IMPORTED; i++) history.importSession(session());
    expect(history.importedCount()).toBe(MAX_IMPORTED);
    expect(
      await history.history({ session: first.id, request: { type: 'entry', seq: 4 } }),
    ).toMatchObject({
      error: expect.stringMatching(/no longer kept/),
    });
    now += IMPORTED_TTL_MS + 1;
    expect(history.importedCount()).toBe(0);
    expect(history.importSession('{')).toEqual({ error: 'The session is not valid JSON.' });
  });

  it('writes the tool answers as untrusted markdown', () => {
    const detail = sessionEntryDetail(session(), 4)!;
    const text = entryDetailText({ ok: true, detail }, 'on page `p1`', {
      type: '[Cart] Add',
      action: { type: '[Cart] Add', item: 'oslo' },
    });
    expect(text).toContain('come from the running page');
    expect(text).toContain('### Action');
    expect(text).toContain('### Diff');
    expect(text).toContain('`cart.items[1]` add "oslo"');
    expect(text).toContain('### State after');
    expect(exportText({ ok: true, session: session() })).toContain(
      '"format": "pangular-ngrx-session"'.replace(': ', ':'),
    );
    expect(importText({ error: 'nope' })).toBe('Not imported: nope');
    const generated = generateTest(session());
    if (typeof generated === 'string') throw new Error(generated);
    expect(testText({ ok: true, test: generated })).toContain('```ts');
  });
});

describe('ngrx history agent tools', () => {
  async function boot() {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await pangular.setup(ctx as never);
    const push = (name: string, payload: unknown) =>
      ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
    const call = async (tool: string, args: Record<string, unknown>) =>
      await answerText(ctx.agent.invoke(`pangular:${tool}`, args));
    return { ctx, push, call };
  }

  /** Answers the page's NgRx requests with a real collector. */
  function answerWith(
    ctx: Awaited<ReturnType<typeof boot>>['ctx'],
    push: (name: string, payload: unknown) => unknown,
    run: (request: NgrxRequest) => unknown,
  ) {
    const sent: NgrxRequest[] = [];
    vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: {
      method: string;
      args: { requestId: string; pageId: string; request: NgrxRequest }[];
    }) => {
      if (!options.method.endsWith('ngrx-action')) return;
      const { requestId, pageId, request } = options.args[0];
      sent.push(request);
      const result = run(request);
      setTimeout(() => void push('ngrx-action-result', { requestId, pageId, result }), 1);
    }) as never);
    return sent;
  }

  it('reads an entry, exports, imports and generates a test from the live page', async () => {
    const { ctx, push, call } = await boot();
    const { store, collector } = classicPage();
    for (const item of ['rome', 'oslo', 'lima']) store.dispatch({ type: 'add', item });
    await push('push-ngrx-state', report('p1'));
    const sent = answerWith(ctx, push, (request) => collector.run(request));

    const entry = await call('inspect-ngrx-entry', { seq: 2 });
    expect(sent[0]).toEqual({ type: 'entry', seq: 2 });
    expect(entry).toContain('## Entry #2 on `store`');
    expect(entry).toContain('"oslo"');

    const exported = await call('export-ngrx-session', { from: 2 });
    expect(exported).toContain('Exported 2 entries of `store`');
    const json = /```json\n([\s\S]*?)\n```/.exec(exported)![1];
    expect(JSON.parse(json).page).toEqual({ url: '/cart', title: 'Cart' });

    const imported = await call('import-ngrx-session', { session: json });
    const id = /Imported session `([^`]+)`/.exec(imported)![1];
    expect(imported).toContain('#2 to #3');
    const fromImport = await call('inspect-ngrx-entry', { seq: 3, session: id });
    expect(fromImport).toContain('"lima"');

    const live = await call('generate-ngrx-test', { from: 1, to: 3 });
    expect(live).toContain("import { cartReducer } from './cart.reducer';");
    const offline = await call('generate-ngrx-test', { session: id });
    expect(offline).toContain('(entries #2 to #3)');
  });

  it('restores a past state through the page as an action, and refuses with writes off', async () => {
    const { ctx, push, call } = await boot();
    await push('push-ngrx-state', report('p1'));
    const sent = answerWith(ctx, push, () => ({
      ok: true,
      message: 'Jumped to the state after action #2.',
    }));
    expect(await call('restore-ngrx-state', { seq: 2 })).toContain(
      'Jumped to the state after action #2.',
    );
    expect(await call('restore-ngrx-state', { latest: true })).toContain('Jumped');
    expect(sent).toEqual([{ type: 'restore', seq: 2 }, { type: 'latest' }]);
    expect(await call('restore-ngrx-state', {})).toMatch(/Pass `seq`/);
  });

  it('keeps reading history with the ngrx write action off, and refuses restores', async () => {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await createPangular({ actions: { ngrx: false } }).setup(ctx as never);
    const push = (name: string, payload: unknown) =>
      ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
    const { store, collector } = classicPage();
    store.dispatch({ type: 'add', item: 'rome' });
    await push('push-ngrx-state', report('p1'));
    answerWith(ctx, push, (request) => collector.run(request));
    expect(
      await push('request-ngrx-history', { pageId: 'p1', request: { type: 'entry', seq: 1 } }),
    ).toMatchObject({ ok: true, detail: { after: { cart: { items: ['rome'] } } } });
    expect(
      await push('request-ngrx-action', { pageId: 'p1', request: { type: 'restore', seq: 1 } }),
    ).toMatchObject({ error: expect.stringMatching(/actions\.ngrx/) });
    expect(ctx.agent.list().tools.map((t) => t.id)).not.toContain('pangular:restore-ngrx-state');
  });
});
