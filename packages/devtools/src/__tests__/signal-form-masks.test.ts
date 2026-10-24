// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { forgetMaskedFormValues } from '../component-form-masks.ts';
import { collectSignalGraph, graphValue, type SignalDebugNg } from '../signal-graph.ts';
import { createSignalHistory } from '../signal-history.ts';
import { maskHistory, secretsOfGraph } from '../signal-masks.ts';
import { answerPeek } from '../signal-peek.ts';

function directive(selector: string, fields: Record<string, unknown>) {
  class Dir {}
  (Dir as unknown as Record<string, unknown>)['ɵdir'] = { selectors: [['', selector, '']] };
  return Object.assign(new Dir(), fields);
}

const field = (name: string, value: unknown) =>
  directive('formField', { state: () => ({ name: () => `login.${name}`, value: () => value }) });

class Login {}

const root = { scopes: new Set(['environment', 'root']) };

/**
 * A component with Signal Forms fields bound with `[formField]`, and a signal
 * graph shaped like Angular's: one unnamed `computed` per field value.
 */
function setup(values: Record<string, string>) {
  document.body.innerHTML = `
    <app-login ng-version="22.0.0">
      <input id="email" />
      <input id="password" />
      <input id="token" />
      <input id="apiKey" />
      <input id="code" autocomplete="one-time-code" />
      <input id="note" data-pangular="mask" />
    </app-login>`;
  const host = document.querySelector('app-login')!;
  const at = (id: string) => document.getElementById(id)!;
  const instance = new Login();
  const ng: SignalDebugNg = {
    getComponent: (el) => (el === host ? instance : null),
    getInjector: (el) => el,
    getDirectives: (el) => (el.id && el.id in values ? [field(el.id, values[el.id])] : []),
    ɵgetInjectorResolutionPath: (injector) => [injector, root],
    ɵgetInjectorMetadata: (injector) =>
      injector === root
        ? { type: 'environment', source: null }
        : { type: 'element', source: at('email') },
    ɵgetSignalGraph: (injector) => ({
      nodes:
        injector === root
          ? [{ id: '20', kind: 'signal', label: 'lastLogin', epoch: 1, value: values['password'] }]
          : [
              { id: '1', kind: 'signal', label: 'model', epoch: 1, value: { ...values } },
              ...Object.keys(values).map((key, i) => ({
                id: String(i + 2),
                kind: 'computed',
                epoch: 1,
                value: values[key],
              })),
              {
                id: '9',
                kind: 'computed',
                label: 'summary',
                epoch: 1,
                value: `token ${values['token']} for ${values['email']}`,
              },
            ],
      edges: [],
    }),
  };
  return { ng, host };
}

const VALUES = {
  email: 'ada@example.com',
  password: 'CNRY_pw_q7Zx',
  token: 'CNRY_token_k2Lm',
  apiKey: 'CNRY_apiKey_w9Rt',
  code: '845210',
  note: 'CNRY_note_m1Xc',
};
const SECRETS = ['CNRY_pw_q7Zx', 'CNRY_token_k2Lm', 'CNRY_apiKey_w9Rt', '845210', 'CNRY_note_m1Xc'];

function history() {
  return createSignalHistory(
    (value, name) => graphValue(name, value),
    Date.now,
    (value, name) => graphValue(name, value),
  );
}

describe('signal graph form masks', () => {
  afterEach(() => {
    forgetMaskedFormValues();
    document.body.innerHTML = '';
  });

  it('masks unnamed nodes that hold a secret field value, in the graph the page pushes', () => {
    const { ng } = setup(VALUES);
    const graph = collectSignalGraph(ng, null)!;
    expect(graph.component?.tag).toBe('app-login');
    const text = JSON.stringify(graph);
    for (const secret of SECRETS) expect(text).not.toContain(secret);
    const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n.value]));
    expect(byId['2']).toBe('ada@example.com');
    expect(byId['3']).toBe('[redacted]');
    expect(byId['9']).toBe('token [redacted] for ada@example.com');
  });

  it('masks a peek by selector, by id and its history, and keeps harmless values', () => {
    const { ng } = setup(VALUES);
    const signals = history();
    for (const request of [{ selector: 'app-login' }, { env: 'root' }]) {
      const answer = answerPeek(
        { requestId: 'r', ...request },
        'page-1',
        (target) => collectSignalGraph(ng, target),
        signals,
      );
      const text = JSON.stringify(answer);
      expect(answer.graph).not.toBeNull();
      for (const secret of SECRETS) expect(text).not.toContain(secret);
    }
    // The environment graph masks the values the component's fields showed as secret.
    const env = collectSignalGraph(ng, { env: 'root' })!;
    expect(env.nodes[0]!.value).toBe('[redacted]');
    const peek = answerPeek(
      { requestId: 'r', selector: 'app-login' },
      'page-1',
      (target) => collectSignalGraph(ng, target),
      signals,
    ).graph!;
    expect(peek.history!['2']![0]!.value).toBe('ada@example.com');
    expect(peek.history!['3']![0]!.value).toBe('[redacted]');
  });

  it('keeps masking a secret value after the field changed', () => {
    const first = setup(VALUES);
    collectSignalGraph(first.ng, null);
    const { ng } = setup({ ...VALUES, password: 'CNRY_pw_next_r5Tu' });
    const graph = collectSignalGraph(ng, null)!;
    const old = maskHistory(
      { '3': [{ epoch: 1, value: 'CNRY_pw_q7Zx', at: 0, source: 'initial' }] },
      secretsOfGraph(graph),
    );
    expect(old['3']![0]!.value).toBe('[redacted]');
    expect(JSON.stringify(graph)).not.toContain('CNRY_pw_next_r5Tu');
  });

  it('leaves history alone when the graph has no secrets', () => {
    const recorded = { '1': [{ epoch: 1, value: 'x', at: 0, source: 'write' as const }] };
    expect(maskHistory(recorded, new Set())).toBe(recorded);
  });
});
