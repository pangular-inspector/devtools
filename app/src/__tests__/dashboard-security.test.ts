import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import type { SecurityStatus } from '@pangular-inspector/devtools/internal/config';
import { afterEach, describe, expect, it } from 'vitest';
import { Dashboard } from '../pages/dashboard';
import { inTime, securityItems } from '../pages/security-summary';

const HOUR = 3_600_000;

function status(overrides: Partial<SecurityStatus> = {}): SecurityStatus {
  return {
    reported: true,
    auth: true,
    originCheck: true,
    allowedOrigins: [],
    customOrigins: false,
    allowedHosts: [],
    network: false,
    tokens: { count: 0, nextExpiresAt: null, lastExpiresAt: null, ttlMs: 168 * HOUR },
    pairingTokens: 0,
    oneTimeCode: { state: 'accepting' },
    ...overrides,
  };
}

const value = (items: { label: string; value: string }[], label: string) =>
  items.find((item) => item.label === label)?.value;

describe('security summary', () => {
  it('says times ahead in words', () => {
    expect(inTime(4 * 60_000, 0)).toBe('in 4 min');
    expect(inTime(3 * HOUR, 0)).toBe('in 3 hours');
    expect(inTime(6 * 24 * HOUR, 0)).toBe('in 6 days');
    expect(inTime(0, 10)).toBe('in 0 min');
  });

  it('lists the code, the trusted tokens and the reach of a default server', () => {
    const items = securityItems(
      status({
        oneTimeCode: { state: 'accepting', expiresAt: 4 * 60_000 },
        tokens: { count: 2, nextExpiresAt: 3 * HOUR, lastExpiresAt: 6 * 24 * HOUR, ttlMs: 1 },
        pairingTokens: 1,
      }),
      0,
    );
    expect(value(items, 'One-time code')).toBe('On, current code expires in 4 min');
    expect(value(items, 'Trusted clients')).toBe(
      '2 tokens, the first expires in 3 hours, the last in 6 days',
    );
    expect(value(items, 'Pairing tokens')).toBe('1 accepted instead of the code');
    expect(value(items, 'Reach')).toBe('This machine only');
    expect(value(items, 'Allowed origins')).toBe('This machine and the Chrome extension');
    expect(value(items, 'Allowed hosts')).toBeUndefined();
  });

  it('says when auth is off, the code is locked, and the origin check is off', () => {
    const off = securityItems(status({ auth: false, oneTimeCode: { state: 'off' } }), 0);
    expect(value(off, 'One-time code')).toBe('Off: every client is trusted');
    expect(value(off, 'Trusted clients')).toBeUndefined();
    const locked = securityItems(status({ oneTimeCode: { state: 'locked' } }), 0);
    expect(value(locked, 'One-time code')).toContain('Locked');
    const open = securityItems(
      status({ originCheck: false, network: true, allowedHosts: 'any' }),
      0,
    );
    expect(value(open, 'Allowed origins')).toBe('Any: the origin check is off');
    expect(value(open, 'Reach')).toBe('This machine and other machines');
    expect(value(open, 'Allowed hosts')).toBe('Any');
  });

  it('leaves out the access rows when the host did not report them', () => {
    const items = securityItems(status({ reported: false }), 0);
    expect(items.map((item) => item.label)).toEqual(['One-time code', 'Trusted clients']);
  });
});

function fakeClient(backend: string, calls: string[], answer: unknown): DevframeRpcClient {
  const rpc = {
    call: (name: string) => {
      calls.push(name);
      if (name === 'security-status') return Promise.resolve(answer);
      return new Promise(() => {});
    },
    callEvent: () => Promise.resolve(),
    sharedState: () => Promise.resolve({ value: () => null, on: () => () => {} }),
  };
  return {
    status: 'connected',
    connectionMeta: { backend, configs: { pangular: {} } },
    scope: () => ({ rpc }),
    events: { on: () => () => {} },
  } as unknown as DevframeRpcClient;
}

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

const section = (fixture: ComponentFixture<unknown>) =>
  (fixture.nativeElement as HTMLElement).querySelector('[aria-labelledby="security-title"]');

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Dashboard security rows', () => {
  it('shows the security status a trusted panel reads from the server', async () => {
    const calls: string[] = [];
    const fixture = TestBed.createComponent(Dashboard);
    fixture.componentRef.setInput(
      'rpc',
      fakeClient('websocket', calls, status({ allowedOrigins: ['http://192.168.1.20:8100'] })),
    );
    await settle(fixture);
    expect(calls).toContain('security-status');
    const text = section(fixture)?.textContent ?? '';
    expect(text).toContain('Security');
    expect(text).toContain('One-time code');
    expect(text).toContain('http://192.168.1.20:8100');
  });

  it('shows nothing for a static report or a server without the RPC', async () => {
    const staticCalls: string[] = [];
    const report = TestBed.createComponent(Dashboard);
    report.componentRef.setInput('rpc', fakeClient('static', staticCalls, status()));
    await settle(report);
    expect(staticCalls).not.toContain('security-status');
    expect(section(report)).toBeNull();

    const older = TestBed.createComponent(Dashboard);
    older.componentRef.setInput('rpc', fakeClient('websocket', [], null));
    await settle(older);
    expect(section(older)).toBeNull();
  });
});
