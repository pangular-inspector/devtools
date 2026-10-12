// @vitest-environment jsdom
import '@angular/compiler';
import {
  Component,
  Injectable,
  InjectionToken,
  inject,
  provideZonelessChangeDetection,
  type ApplicationRef,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { afterEach, describe, expect, it } from 'vitest';
import { attachConsoleGlobals } from '../console-handles.ts';
import { collectInjectorTree, providerValue, type DebugNg } from '../injector-tree.ts';
import type { InjectorTreeNode } from '../types.ts';

const API_URL = new InjectionToken<string>('API_URL');
const UNUSED = new InjectionToken<{ ready: boolean }>('UNUSED');
const API_KEY = new InjectionToken<string>('API_KEY');
let unusedCreated = 0;

class CardState {
  readonly open = true;
}
Injectable()(CardState);

class SpareState {}
Injectable()(SpareState);

class TripCard {
  readonly state = inject(CardState);
  readonly api = inject(API_URL);
}
Component({
  selector: 'app-root',
  template: 'card',
  providers: [CardState, SpareState],
})(TripCard);

const flatten = (nodes: InjectorTreeNode[]): InjectorTreeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

describe('providerValue with a real app', () => {
  let app: ApplicationRef | null = null;
  afterEach(() => {
    app?.destroy();
    app = null;
    document.body.innerHTML = '';
  });

  it('gives the live value of created providers and never creates one', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(TripCard, {
      providers: [
        provideZonelessChangeDetection(),
        { provide: API_URL, useValue: '/api' },
        {
          provide: UNUSED,
          useFactory: () => {
            unusedCreated++;
            return { ready: true };
          },
        },
      ],
    });
    app.tick();
    const ng = (globalThis as { ng?: DebugNg }).ng!;
    const report = collectInjectorTree(ng);
    const card = flatten(report.roots).find((n) => n.injector.component === 'TripCard')!;
    const card$ = app.components[0].instance as TripCard;

    const index = (node: InjectorTreeNode, token: string) =>
      node.providers.findIndex((p) => p.token === token);
    expect(providerValue(ng, card.injector.id, 'CardState', index(card, 'CardState'))).toEqual({
      value: card$.state,
    });
    expect(
      providerValue(ng, card.injector.id, 'SpareState', index(card, 'SpareState')),
    ).toMatchObject({ error: expect.stringMatching(/storing it would create it/) });
    expect(providerValue(ng, card.injector.id, 'Nope', 0)).toMatchObject({
      error: expect.stringMatching(/no longer provided/),
    });

    const env = flatten(report.environment).find((n) =>
      n.providers.some((p) => p.token === 'API_URL'),
    )!;
    expect(providerValue(ng, env.injector.id, 'API_URL', index(env, 'API_URL'))).toEqual({
      value: '/api',
    });
    expect(providerValue(ng, env.injector.id, 'UNUSED', index(env, 'UNUSED'))).toMatchObject({
      error: expect.stringMatching(/not been created yet/),
    });
    expect(providerValue(ng, env.injector.id, 'UNUSED', index(env, 'UNUSED'), 'log')).toMatchObject(
      { error: expect.stringMatching(/logging it would create it\. Log it once/) },
    );
    expect(unusedCreated).toBe(0);
  });

  it('logs a provider value in the page console and refuses a secret one', async () => {
    document.body.innerHTML = '<app-root></app-root>';
    app = await bootstrapApplication(TripCard, {
      providers: [
        provideZonelessChangeDetection(),
        { provide: API_URL, useValue: '/api' },
        { provide: API_KEY, useValue: 'sk-live-123' },
      ],
    });
    app.tick();
    const ng = (globalThis as { ng?: DebugNg }).ng!;
    const report = collectInjectorTree(ng);
    const env = flatten(report.environment).find((n) =>
      n.providers.some((p) => p.token === 'API_URL'),
    )!;
    const index = (token: string) => env.providers.findIndex((p) => p.token === token);
    const handlers = new Map<string, (message: unknown) => void>();
    const results: { result: { ok: boolean; message: string } }[] = [];
    const logged: unknown[][] = [];
    attachConsoleGlobals(
      {
        rpc: {
          call: async (_name: string, payload: unknown) => {
            results.push(payload as (typeof results)[number]);
          },
          register: (definition: { name: string; handler: (message: unknown) => void }) => {
            handlers.set(definition.name, definition.handler);
          },
        },
      },
      'p1',
      {
        getNg: () => ng,
        inspectors: { components: true, injectors: true, ngrx: true },
        win: {},
        log: (...args) => logged.push(args),
      },
    );
    const log = (token: string) =>
      handlers.get('console-global')!({
        requestId: token,
        pageId: 'p1',
        mode: 'log',
        target: { kind: 'provider', injectorId: env.injector.id, token, index: index(token) },
      });
    log('API_URL');
    log('API_KEY');
    expect(results.map((r) => r.result)).toEqual([
      { ok: true, message: 'Logged API_URL in the page console.' },
      {
        ok: false,
        message: 'API_KEY looks like a secret, so the devtools mask it and did not log it.',
      },
    ]);
    expect(logged).toEqual([['[pangular] API_URL:', '/api']]);
  });
});
