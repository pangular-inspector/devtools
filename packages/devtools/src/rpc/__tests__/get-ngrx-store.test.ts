import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtureDir } from './fixture-dir.ts';
import { scan } from './scan.ts';
import { describe, expect, it } from 'vitest';
import { getNgrxStore } from '../get-ngrx-store.ts';

async function storeFor(source: string) {
  const dir = fixtureDir('pangular-ngrx-');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'store.ts'), source);
  return scan(getNgrxStore, dir);
}

describe('get-ngrx-store', () => {
  it('reads a signal store', async () => {
    const entries = await storeFor(
      `export const ProductStore = signalStore(withState({ items: [] }));`,
    );
    expect(entries.map((e) => [e.name, e.line])).toEqual([['ProductStore', 1]]);
  });

  it('reads a file whose only ngrx marker is the import', async () => {
    const entries = await storeFor(
      [
        "import { provideStore } from '@ngrx/store';",
        'export const appConfig = { providers: [provideStore({})] };',
      ].join('\n'),
    );
    expect(entries.map((e) => e.name)).toContain('provideStore');
  });

  it('ignores a commented out store', async () => {
    const entries = await storeFor(
      [
        '// export const OldStore = signalStore(withState({ a: 1 }))',
        'export const ProductStore = signalStore(withState({ items: [] }));',
      ].join('\n'),
    );
    expect(entries.map((e) => e.name)).toEqual(['ProductStore']);
  });

  it('ignores a store written inside a template string', async () => {
    const entries = await storeFor(
      [
        'const docs = `export const DocsStore = signalStore(withState({}))`;',
        'export const ProductStore = signalStore(withState({ items: [] }));',
      ].join('\n'),
    );
    expect(entries.map((e) => e.name)).toEqual(['ProductStore']);
  });
});

describe('get-ngrx-store action types', () => {
  it('reads the type strings of createAction and createActionGroup', async () => {
    const entries = await storeFor(
      [
        "import { createAction, createActionGroup, emptyProps, props } from '@ngrx/store';",
        "export const addItem = createAction('[Cart] Add Item', props<{ id: number }>());",
        'export const clear = createAction(`[Cart] Clear`);',
        'export const dynamic = createAction(`[${source}] Dynamic`);',
        'export const CartActions = createActionGroup({',
        "  source: 'Cart Page',",
        '  events: {',
        "    'Remove Item': props<{ id: number }>(),",
        '    opened: emptyProps(),',
        '  },',
        '});',
      ].join('\n'),
    );
    const actions = entries.filter((e) => e.kind === 'action');
    expect(actions.map((e) => [e.name, e.types, e.detail])).toEqual([
      ['addItem', ['[Cart] Add Item'], '[Cart] Add Item'],
      ['clear', ['[Cart] Clear'], '[Cart] Clear'],
      ['dynamic', undefined, undefined],
      [
        'CartActions',
        ['[Cart Page] Remove Item', '[Cart Page] opened'],
        '[Cart Page] Remove Item, [Cart Page] opened',
      ],
    ]);
  });

  it('unescapes the quotes and backslashes in an action type', async () => {
    const entries = await storeFor(
      [
        'export const add = createAction("[Cart] Don\'t \\"Add\\"");',
        "export const profile = createAction('[Auth] User\\'s Profile');",
        'export const path = createAction(`[Files] C:\\\\tmp \\u0041`);',
        'export const Group = createActionGroup({',
        "  source: 'Team\\'s',",
        "  events: { 'It\\'s Open': emptyProps() },",
        '});',
      ].join('\n'),
    );
    const actions = entries.filter((e) => e.kind === 'action');
    expect(actions.map((e) => e.types)).toEqual([
      ['[Cart] Don\'t "Add"'],
      ["[Auth] User's Profile"],
      ['[Files] C:\\tmp A'],
      ["[Team's] It's Open"],
    ]);
  });
});

describe('get-ngrx-store members', () => {
  it('lists the members of a signal store', async () => {
    const entries = await storeFor(
      [
        'const initialState: State = { query: "", saved: [], bookings: [] };',
        'export const TravelStore = signalStore(',
        "  { providedIn: 'root' },",
        '  withState(initialState),',
        '  withEntities<Todo>(),',
        '  withComputed(({ saved }) => ({ count: computed(() => saved().length), other: computed(() => 1) })),',
        '  withProps(() => ({ api: inject(Api) })),',
        '  withMethods((store) => ({',
        '    setQuery(query: string): void { patchState(store, { query }); },',
        '    book(b: Omit<Booking, "id">): Booking { return b as Booking; },',
        '    load: rxMethod<void>(pipe()),',
        '  })),',
        '  withHooks({ onInit() {}, onDestroy: () => {} }),',
        ');',
      ].join('\n'),
    );
    const store = entries.find((e) => e.name === 'TravelStore')!;
    expect(store.members).toEqual({
      state: ['query', 'saved', 'bookings'],
      entities: ['Todo'],
      computed: ['count', 'other'],
      props: ['api'],
      methods: ['setQuery', 'book', 'load'],
      rxMethods: ['load'],
      hooks: ['onInit', 'onDestroy'],
    });
    expect(store.detail).toBe(
      'state: query, saved, bookings; computed: count, other; methods: setQuery, book, load; rxMethod: load; props: api; hooks: onInit, onDestroy; entities: Todo',
    );
  });

  it('reads the returned object of a block body, not a nested helper return', async () => {
    const entries = await storeFor(
      [
        'export const S = signalStore(',
        '  withState({ a: 1, b: 2 }),',
        '  withMethods((store) => {',
        '    const f = () => { return { zzz: 1 }; };',
        '    if (!store) { return { early: true }; }',
        '    return { inc() {}, dec: () => {} };',
        '  }),',
        ');',
      ].join('\n'),
    );
    expect(entries.find((e) => e.name === 'S')!.members).toEqual({
      state: ['a', 'b'],
      methods: ['inc', 'dec'],
    });
  });

  it('reads inline withState keys and class field signalState', async () => {
    const entries = await storeFor(
      [
        "import { signalState, signalMethod } from '@ngrx/signals';",
        'export const S = signalStore(withState({ a: 1, b: { c: 2 } }));',
        'class Cmp {',
        '  readonly state = signalState({ x: 1 });',
        '  private readonly log = signalMethod<number>((n) => n);',
        '}',
      ].join('\n'),
    );
    expect(entries.find((e) => e.name === 'S')?.members).toEqual({ state: ['a', 'b'] });
    expect(entries.map((e) => [e.name, e.kind])).toEqual(
      expect.arrayContaining([
        ['state', 'signal-state'],
        ['log', 'signal-method'],
      ]),
    );
  });
});
