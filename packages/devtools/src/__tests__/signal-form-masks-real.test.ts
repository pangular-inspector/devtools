// @vitest-environment jsdom
import '@angular/compiler';
import {
  Component,
  computed,
  provideZonelessChangeDetection,
  signal,
  type ApplicationRef,
} from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { bootstrapApplication } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { forgetMaskedFormValues } from '../component-form-masks.ts';
import { setRedaction } from '../forms-privacy.ts';
import { collectSignalGraph, graphValue, type SignalDebugNg } from '../signal-graph.ts';
import { createSignalHistory } from '../signal-history.ts';
import { maskHistory, secretsOfGraph } from '../signal-masks.ts';
import { answerPeek } from '../signal-peek.ts';
import { serializeNamed } from '../serialize.ts';
import { angularAtLeast, STANDALONE } from './angular-version.ts';

const PW = 'CNRY_pw_q7Zx';
const TOKEN = 'CNRY_token_k2Lm';
const API_KEY = 'CNRY_apiKey_w9Rt';
const CONFIRM = 'CNRY_confirm_b4Np';
const CLIENT_SECRET = 'CNRY_clientSecret_h3Vd';
const NICKNAME = 'CNRY_nickname_z8Qa';
const EMAIL = 'ada@example.com';

class SignalSecrets {
  readonly model = signal({
    email: EMAIL,
    password: PW,
    token: TOKEN,
    apiKey: API_KEY,
    confirm: CONFIRM,
    clientSecret: CLIENT_SECRET,
    nickname: NICKNAME,
  });
  readonly login = form(this.model);
  // Not bound in the template: only the name tells it is secret.
  readonly secretSize = computed(() => this.login.clientSecret().value().length);
  readonly nicknameSize = computed(() => this.login.nickname().value().length);
}

Component({
  ...STANDALONE,
  selector: 'app-signal-secrets',
  imports: [FormField],
  template: `
    <input [formField]="login.email" />
    <input [formField]="login.password" />
    <input [formField]="login.token" />
    <input [formField]="login.apiKey" />
    <input type="password" [formField]="login.confirm" />
    {{ secretSize() }} {{ nicknameSize() }}
  `,
})(SignalSecrets);

const settle = async (app: ApplicationRef) => {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    app.tick();
  }
};

const CANARIES = [PW, TOKEN, API_KEY, CONFIRM, CLIENT_SECRET];

function history() {
  return createSignalHistory(
    (value, name) => serializeNamed(name, value, { budget: 1000 }),
    Date.now,
    (value, name) => graphValue(name, value),
  );
}

describe.skipIf(!angularAtLeast('21.0.0'))('signal graph of a Signal Forms form', () => {
  let app: ApplicationRef | null = null;
  const ng = () => (globalThis as { ng?: SignalDebugNg }).ng!;

  beforeEach(async () => {
    forgetMaskedFormValues();
    setRedaction();
    document.body.innerHTML = '<app-signal-secrets></app-signal-secrets>';
    app = await bootstrapApplication(SignalSecrets, {
      providers: [provideZonelessChangeDetection()],
    });
    await settle(app);
  });

  afterEach(() => {
    app?.destroy();
    app = null;
    setRedaction();
    delete (globalThis as { __PANGULAR_FORMS__?: unknown }).__PANGULAR_FORMS__;
  });

  it('masks secret field values in the nodes the page pushes, and keeps other fields readable', () => {
    // No target: the graph the page pushes for its root component.
    for (const target of [null, { selector: 'app-signal-secrets' }]) {
      const graph = collectSignalGraph(ng(), target)!;
      const text = JSON.stringify(graph);
      // Signal Forms keeps each field value in an unnamed computed node.
      expect(graph.nodes.some((n) => n.kind === 'computed' && !n.label && n.value === EMAIL)).toBe(
        true,
      );
      expect(graph.nodes.filter((n) => n.value === '[redacted]').length).toBeGreaterThanOrEqual(5);
      for (const canary of CANARIES) expect(text).not.toContain(canary);
    }
  });

  it('masks a field named by redaction.secretNames', () => {
    expect(JSON.stringify(collectSignalGraph(ng(), null))).toContain(NICKNAME);
    setRedaction({ secretNames: ['nickname'] });
    expect(JSON.stringify(collectSignalGraph(ng(), null))).not.toContain(NICKNAME);
  });

  it('keeps a field the page unmasks readable', () => {
    (globalThis as { __PANGULAR_FORMS__?: unknown }).__PANGULAR_FORMS__ = { unmask: ['token'] };
    const text = JSON.stringify(collectSignalGraph(ng(), null));
    expect(text).toContain(TOKEN);
    for (const canary of [PW, API_KEY, CONFIRM, CLIENT_SECRET]) expect(text).not.toContain(canary);
  });

  it('masks secret values in a peek and its history, also after the value changed', async () => {
    const signals = history();
    const peek = () =>
      answerPeek(
        { requestId: 'r1', selector: 'app-signal-secrets' },
        'page-1',
        (target) => collectSignalGraph(ng(), target),
        signals,
      ).graph!;
    const first = peek();
    expect(first.component?.tag).toBe('app-signal-secrets');
    expect(JSON.stringify(first.history)).toContain(EMAIL);
    for (const canary of CANARIES) expect(JSON.stringify(first)).not.toContain(canary);

    const component = (
      ng() as unknown as { getComponent(el: Element): SignalSecrets }
    ).getComponent(document.querySelector('app-signal-secrets')!);
    component.model.update((m) => ({ ...m, password: 'CNRY_pw_next_r5Tu' }));
    await settle(app!);

    const second = peek();
    const text = JSON.stringify(second);
    // The history now holds the old and the new password: both masked.
    for (const canary of [...CANARIES, 'CNRY_pw_next_r5Tu']) expect(text).not.toContain(canary);
    expect(Object.values(second.history!).some((changes) => changes.length > 1)).toBe(true);
  });

  it('masks history entries recorded before the value was known to be secret', () => {
    const graph = collectSignalGraph(ng(), null)!;
    const recorded = {
      '1': [{ epoch: 1, value: PW, at: 0, source: 'write' as const }],
      '2': [{ epoch: 1, value: { note: `copy of ${TOKEN}` }, at: 0, source: 'sample' as const }],
      '3': [{ epoch: 1, value: EMAIL, at: 0, source: 'initial' as const }],
    };
    const masked = maskHistory(recorded, secretsOfGraph({ ...graph }));
    expect(masked['1']![0]!.value).toBe('[redacted]');
    expect(masked['2']![0]!.value).toEqual({ note: 'copy of [redacted]' });
    expect(masked['3']![0]).toBe(recorded['3'][0]);
    // The kept entries are left as recorded, for restores.
    expect(recorded['1'][0].value).toBe(PW);
  });
});
