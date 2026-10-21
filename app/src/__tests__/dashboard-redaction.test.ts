import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it } from 'vitest';
import { Dashboard } from '../pages/dashboard';

/** A trusted client whose `__connection.json` config has no redaction, like a current server's. */
function fakeClient(backend: string, calls: string[]): DevframeRpcClient {
  const rpc = {
    call: (name: string) => {
      calls.push(name);
      if (name === 'redaction-config') {
        return Promise.resolve({ secretNames: ['passport'], unmask: ['pin'] });
      }
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

function configText(fixture: ComponentFixture<unknown>): string {
  return (fixture.nativeElement as HTMLElement).querySelector('section.config')?.textContent ?? '';
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Dashboard redaction rows', () => {
  it('lists the secret names a trusted panel reads from the server', async () => {
    const calls: string[] = [];
    const fixture = TestBed.createComponent(Dashboard);
    fixture.componentRef.setInput('rpc', fakeClient('websocket', calls));
    await settle(fixture);
    expect(calls).toContain('redaction-config');
    const text = configText(fixture);
    expect(text).toContain('Extra secret names');
    expect(text).toContain('passport');
    expect(text).toContain('Unmasked names');
    expect(text).toContain('pin');
  });

  it('does not ask a static report, which carries no secret names', async () => {
    const calls: string[] = [];
    const fixture = TestBed.createComponent(Dashboard);
    fixture.componentRef.setInput('rpc', fakeClient('static', calls));
    await settle(fixture);
    expect(calls).not.toContain('redaction-config');
    expect(configText(fixture)).not.toContain('Extra secret names');
  });
});
