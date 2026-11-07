// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Injector, PLATFORM_ID, runInInjectionContext } from '@angular/core';
import { HttpErrorResponse, HttpRequest, type HttpHandlerFn } from '@angular/common/http';
import { of } from 'rxjs';
import { angularAtLeast } from './angular-version.ts';
import { HTTP_RULE_PRESETS, presetRules } from '../http-data.ts';
import { pangularHttpInterceptor } from '../http.ts';
import { resetTransferEntries } from '../http-internals.ts';
import {
  httpRegistry,
  matchRule,
  sanitizeRules,
  storeRules,
  type HttpRule,
} from '../http-rules.ts';
import { httpRulesText, upsertHttpRule } from '../rpc/http-rule-tools.ts';

const rule = (overrides: Partial<HttpRule> = {}): HttpRule => ({
  id: 'r1',
  pattern: '/api/products',
  enabled: true,
  target: 'both',
  status: 503,
  ...overrides,
});

describe('rule presets', () => {
  it('offers Offline, Slow 3G and Flaky as plain client rules for every request', () => {
    expect(HTTP_RULE_PRESETS.map((p) => p.label)).toEqual(['Offline', 'Slow 3G', 'Flaky']);
    let n = 0;
    const rules = HTTP_RULE_PRESETS.flatMap((p) => presetRules(p.id, () => `p${++n}`));
    expect(rules).toEqual([
      { id: 'p1', enabled: true, pattern: '*', target: 'client', status: 0 },
      { id: 'p2', enabled: true, pattern: '*', target: 'client', delayMs: 2000 },
      { id: 'p3', enabled: true, pattern: '*', target: 'client', status: 503, chance: 30 },
    ]);
    // They survive the server's own check unchanged.
    expect(sanitizeRules(rules)).toEqual(rules.map((r) => ({ ...r, method: undefined })));
    expect(presetRules('nope', () => 'x')).toEqual([]);
  });

  it('match every browser URL and no SSR call', () => {
    const [offline] = presetRules('offline', () => 'o');
    expect(matchRule('/anything?x=1', 'POST', sanitizeRules([offline]), 'client')?.id).toBe('o');
    expect(matchRule('http://api/x', 'GET', sanitizeRules([offline]), 'server')).toBeUndefined();
  });
});

describe('rule chance', () => {
  it('keeps a whole percent from 1 to 99 and drops anything else', () => {
    const chances = sanitizeRules(
      [30, 1, 99, 0, 100, 12.4, '30', Number.NaN].map((chance, i) =>
        rule({ id: `r${i}`, chance: chance as number }),
      ),
    ).map((r) => r.chance);
    expect(chances).toEqual([30, 1, 99, undefined, undefined, 12, undefined, undefined]);
  });

  it('applies the rule when the roll lands under the chance, else tries the next rule', () => {
    const rules = [
      rule({ id: 'flaky', chance: 30 }),
      rule({ id: 'slow', status: undefined, delayMs: 5 }),
    ];
    expect(matchRule('/api/products', 'GET', rules, 'client', () => 0.29)?.id).toBe('flaky');
    expect(matchRule('/api/products', 'GET', rules, 'client', () => 0.3)?.id).toBe('slow');
    expect(matchRule('/api/products', 'GET', [rules[0]], 'client', () => 0.9)).toBeUndefined();
  });

  it('is set and listed through the agent tools', () => {
    const change = upsertHttpRule([], { pattern: '*', status: 0, chance: 25 }, () => 'a1');
    expect(change).toMatchObject({ rule: { status: 0, chance: 25 } });
    if (!('rules' in change)) throw new Error('expected a rule');
    expect(httpRulesText(change.rules, true)).toContain(
      'fails with a network error (status 0), for 25% of requests',
    );
    expect(upsertHttpRule([], { pattern: '*', status: 503, chance: 100 }, () => 'a2')).toEqual({
      error: expect.stringContaining('`chance` must be a whole percent from 1 to 99'),
    });
  });
});

describe.runIf(angularAtLeast('16.0'))('network error rule', () => {
  const g = globalThis as { ngDevMode?: unknown };
  let saved: unknown;
  beforeEach(() => {
    saved = g.ngDevMode;
    g.ngDevMode ??= true;
    httpRegistry().calls = [];
    resetTransferEntries();
  });
  afterEach(() => {
    g.ngDevMode = saved;
    delete httpRegistry().rules;
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  const injector = Injector.create({ providers: [{ provide: PLATFORM_ID, useValue: 'browser' }] });
  const backend: HttpHandlerFn = () => {
    throw new Error('the request should not reach the backend');
  };

  it('fails the request with status 0 and a ProgressEvent, as a dropped connection does', async () => {
    storeRules([rule({ status: 0 })]);
    const error = await new Promise<HttpErrorResponse>((resolve) =>
      runInInjectionContext(injector, () =>
        pangularHttpInterceptor(new HttpRequest('GET', '/api/products'), backend),
      ).subscribe({ error: resolve }),
    );
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(error.status).toBe(0);
    expect(error.statusText).toBe('Unknown Error');
    expect(error.error).toBeInstanceOf(ProgressEvent);
    const [call] = httpRegistry().calls ?? [];
    expect(call).toMatchObject({ status: 0, faulted: true, ruleId: 'r1' });
    expect(call.mocked).toBeUndefined();
    expect(call.preview).toBeUndefined();
  });

  it('lets the other requests of a flaky rule through to the backend', async () => {
    storeRules([rule({ status: 503, chance: 30 })]);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const passed = await new Promise<boolean>((resolve) =>
      runInInjectionContext(injector, () =>
        pangularHttpInterceptor(new HttpRequest('GET', '/api/products'), () => of()),
      ).subscribe({ complete: () => resolve(true), error: () => resolve(false) }),
    );
    expect(passed).toBe(true);
  });
});
