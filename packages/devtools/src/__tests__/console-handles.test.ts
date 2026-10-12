// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  attachConsoleGlobals,
  createConsoleHandles,
  isConsoleTarget,
  NG_HANDLES,
  providerRefusal,
  redactedCopy,
  type ConsoleGlobalResult,
} from '../console-handles.ts';
import { elementId } from '../element-id.ts';
import { REDACTED } from '../forms-privacy.ts';

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

describe('createConsoleHandles', () => {
  it('sets $ng0 on selection and shifts earlier selections down to $ng4', () => {
    const win: Record<string, unknown> = {};
    const handles = createConsoleHandles(win);
    const picks = Array.from({ length: NG_HANDLES + 1 }, (_, i) => ({ i }));
    for (const pick of picks) handles.select(pick);
    expect(win['$ng0']).toBe(picks[5]);
    expect(win['$ng1']).toBe(picks[4]);
    expect(win['$ng4']).toBe(picks[1]);
    expect('$ng5' in win).toBe(false);
  });

  it('moves a component selected again back to $ng0 without repeating it', () => {
    const win: Record<string, unknown> = {};
    const handles = createConsoleHandles(win);
    const [a, b, c] = [{ a: 1 }, { b: 1 }, { c: 1 }];
    handles.select(a);
    handles.select(b);
    handles.select(b);
    expect([win['$ng0'], win['$ng1']]).toEqual([b, a]);
    handles.select(c);
    handles.select(a);
    expect([win['$ng0'], win['$ng1'], win['$ng2']]).toEqual([a, c, b]);
    expect('$ng3' in win).toBe(false);
    handles.select(null);
    expect(win['$ng0']).toBe(a);
  });

  it('never overwrites a $ng global the page set itself', () => {
    const own = { mine: true };
    const win: Record<string, unknown> = { $ng1: own };
    const handles = createConsoleHandles(win);
    handles.select({ a: 1 });
    const b = { b: 1 };
    handles.select(b);
    expect(win['$ng0']).toBe(b);
    expect(win['$ng1']).toBe(own);
  });

  it('names stored values temp1, temp2… and skips names the page uses', () => {
    const win: Record<string, unknown> = { temp2: 'page' };
    const handles = createConsoleHandles(win);
    expect(handles.store('a')).toBe('temp1');
    expect(handles.store('b')).toBe('temp3');
    expect(win['temp2']).toBe('page');
    expect(win['temp3']).toBe('b');
  });

  it('removes only the globals it still owns when disposed', () => {
    const win: Record<string, unknown> = {};
    const handles = createConsoleHandles(win);
    handles.select({ a: 1 });
    handles.store('x');
    handles.store('y');
    win['temp2'] = 'changed by the page';
    handles.dispose();
    expect(win).toEqual({ temp2: 'changed by the page' });
  });
});

describe('redaction of stored values', () => {
  it('copies state with secret fields and tokens masked, and leaves the original alone', () => {
    const state = {
      user: { name: 'Ada', password: 'hunter2', session: `Bearer ${JWT}` },
      list: [{ apiKey: 'k' }],
      map: new Map([['token', 'abc']]),
      when: new Date(0),
    };
    const { value, masked } = redactedCopy(state);
    expect(masked).toBe(true);
    const copy = value as typeof state;
    expect(copy).not.toBe(state);
    expect(copy.user.name).toBe('Ada');
    expect(copy.user.password).toBe(REDACTED);
    expect(copy.user.session).not.toContain(JWT);
    expect(copy.list[0].apiKey).toBe(REDACTED);
    expect(copy.map.get('token')).toBe(REDACTED);
    expect(copy.when).toBe(state.when);
    expect(state.user.password).toBe('hunter2');
  });

  it('says nothing was masked for plain data, and keeps cycles', () => {
    const state: Record<string, unknown> = { count: 1 };
    state['self'] = state;
    const { value, masked } = redactedCopy(state);
    expect(masked).toBe(false);
    expect((value as Record<string, unknown>)['self']).toBe(value);
  });

  it('refuses providers whose token looks secret or whose value is a credential', () => {
    expect(providerRefusal('API_KEY', 'x')).toMatch(/looks like a secret/);
    expect(providerRefusal('GREETING', `Bearer ${JWT}`)).toMatch(/credential/);
    expect(providerRefusal('TripService', {})).toBeNull();
    expect(providerRefusal('API_KEY', 'x', 'log')).toMatch(/did not log it/);
  });

  it('accepts only well-formed targets', () => {
    expect(isConsoleTarget({ kind: 'component', id: 'c1' })).toBe(true);
    expect(isConsoleTarget({ kind: 'provider', injectorId: 'i', token: 'T', index: 0 })).toBe(true);
    expect(isConsoleTarget({ kind: 'provider', injectorId: 'i', token: 'T', index: -1 })).toBe(
      false,
    );
    expect(isConsoleTarget({ kind: 'ngrx', storeId: '' })).toBe(false);
    expect(isConsoleTarget({ kind: 'window' })).toBe(false);
  });
});

describe('attachConsoleGlobals', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function setup(inspectors = { components: true, injectors: true, ngrx: true }) {
    document.body.innerHTML = '<app-root ng-version="22.0.0"><app-card></app-card></app-root>';
    const card = document.querySelector('app-card')!;
    const instance = { title: 'Rome' };
    const handlers = new Map<string, (message: unknown) => void>();
    const results: { requestId: string; pageId: string; result: ConsoleGlobalResult }[] = [];
    const my = {
      rpc: {
        call: async (name: string, payload: unknown) => {
          if (name === 'console-global-result') results.push(payload as (typeof results)[number]);
        },
        register: (definition: { name: string; handler: (message: unknown) => void }) => {
          handlers.set(definition.name, definition.handler);
        },
      },
    };
    const win: Record<string, unknown> = {};
    const logged: unknown[][] = [];
    const globals = attachConsoleGlobals(my, 'p1', {
      getNg: () => ({ getComponent: (el: Element) => (el === card ? instance : null) }),
      inspectors,
      ngrxState: (id) => (id === 'store' ? { value: { trips: [], token: 'abc' } } : null),
      win,
      log: (...args) => logged.push(args),
    });
    const send = (message: unknown) => handlers.get('console-global')!(message);
    return { card, instance, win, globals, results, send, logged };
  }

  it('sets $ng0 for a component selected on this page', () => {
    const { card, instance, win, globals } = setup();
    globals.selectComponent(elementId(card));
    expect(win['$ng0']).toBe(instance);
    globals.dispose();
    expect('$ng0' in win).toBe(false);
  });

  it('leaves $ng0 alone when the components inspector is off', () => {
    const { card, win, globals } = setup({ components: false, injectors: true, ngrx: true });
    globals.selectComponent(elementId(card));
    expect('$ng0' in win).toBe(false);
  });

  it('stores a component as temp1 and answers only for its own page', () => {
    const { card, instance, win, results, send } = setup();
    const target = { kind: 'component', id: elementId(card) };
    send({ requestId: 'g1', pageId: 'p2', target });
    send({ requestId: 'g2', target });
    expect(results).toEqual([]);
    expect('temp1' in win).toBe(false);
    send({ requestId: 'g3', pageId: 'p1', target });
    expect(results).toEqual([
      {
        requestId: 'g3',
        pageId: 'p1',
        result: { ok: true, name: 'temp1', message: 'Stored as temp1.' },
      },
    ]);
    expect(win['temp1']).toBe(instance);
  });

  it('stores a masked copy of NgRx state and says so', () => {
    const { win, results, send } = setup();
    send({ requestId: 'g1', pageId: 'p1', target: { kind: 'ngrx', storeId: 'store' } });
    expect(results[0].result).toMatchObject({ ok: true, name: 'temp1', masked: true });
    expect(win['temp1']).toEqual({ trips: [], token: REDACTED });
    send({ requestId: 'g2', pageId: 'p1', target: { kind: 'ngrx', storeId: 'gone' } });
    expect(results[1].result).toMatchObject({ ok: false, message: /no longer on the page/ });
  });

  it('refuses a target whose inspector is off, and malformed targets', () => {
    const { win, results, send } = setup({ components: true, injectors: true, ngrx: false });
    send({ requestId: 'g1', pageId: 'p1', target: { kind: 'ngrx', storeId: 'store' } });
    send({ requestId: 'g2', pageId: 'p1', target: { kind: 'window', name: 'x' } });
    expect(results.map((r) => r.result.ok)).toEqual([false, false]);
    expect(results[0].result.message).toMatch(/ngrx inspector is turned off/);
    expect(Object.keys(win)).toEqual([]);
  });

  it('logs a component in the page console without storing a global', () => {
    const { card, instance, win, results, send, logged } = setup();
    send({
      requestId: 'g1',
      pageId: 'p1',
      target: { kind: 'component', id: elementId(card) },
      mode: 'log',
    });
    expect(results[0]!.result).toEqual({
      ok: true,
      message: 'Logged Component in the page console.',
    });
    expect(logged).toEqual([['[pangular] Component:', instance]]);
    expect(Object.keys(win)).toEqual([]);
  });

  it('logs a masked copy of NgRx state, never the secret fields', () => {
    const { results, send, logged } = setup();
    send({
      requestId: 'g1',
      pageId: 'p1',
      target: { kind: 'ngrx', storeId: 'store' },
      mode: 'log',
    });
    expect(results[0]!.result).toMatchObject({ ok: true, masked: true });
    expect(results[0]!.result.message).toMatch(/with secret fields masked/);
    expect(logged[0]![1]).toEqual({ trips: [], token: REDACTED });
  });

  it('says a provider it cannot find was not logged, in the words of a log', () => {
    const { results, send, logged } = setup();
    send({
      requestId: 'g1',
      pageId: 'p1',
      target: { kind: 'provider', injectorId: 'inj-404', token: 'TripService', index: 0 },
      mode: 'log',
    });
    expect(results[0]!.result).toMatchObject({ ok: false, message: /no longer on the page/ });
    expect(logged).toEqual([]);
  });

  it('refuses a provider the injector tree never listed', () => {
    const { results, send } = setup();
    send({
      requestId: 'g1',
      pageId: 'p1',
      target: { kind: 'provider', injectorId: 'inj-404', token: 'TripService', index: 0 },
    });
    expect(results[0].result).toMatchObject({ ok: false, message: /no longer on the page/ });
  });
});
