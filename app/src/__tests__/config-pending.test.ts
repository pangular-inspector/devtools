import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../pages/dashboard';

const connection = vi.hoisted(() => ({
  resolve: (_client: unknown) => {},
}));

vi.mock('devframe/client', () => ({
  connectDevframe: () =>
    new Promise((resolve) => {
      connection.resolve = resolve;
    }),
}));

const { App } = await import('../app');

function fakeClient(configs: object = {}): DevframeRpcClient {
  const rpc = {
    call: () => new Promise(() => {}),
    callEvent: () => Promise.resolve(),
    sharedState: () => Promise.resolve({ value: () => null, on: () => () => {} }),
  };
  return {
    connectionMeta: { configs },
    scope: () => ({ rpc }),
    events: { on: () => () => {} },
  } as unknown as DevframeRpcClient;
}

const signalsOff = { pangular: { inspectors: { signals: false } } };

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

function host(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

afterEach(() => {
  document.body.innerHTML = '';
  location.hash = '';
});

describe('Dashboard before the connection is up', () => {
  it('shows a loading configuration block and no stat cards', async () => {
    const fixture = TestBed.createComponent(Dashboard);
    await settle(fixture);
    const config = host(fixture).querySelector('section.config')!;
    expect(config.getAttribute('aria-busy')).toBe('true');
    expect(config.textContent).toContain('Loading');
    expect(config.textContent).not.toContain('Defaults');
    expect(host(fixture).querySelectorAll('button.stat')).toHaveLength(0);
  });

  it('shows the stat cards and configuration once connected', async () => {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.componentRef.setInput('rpc', fakeClient(signalsOff));
    await settle(fixture);
    const config = host(fixture).querySelector('section.config')!;
    expect(config.getAttribute('aria-busy')).not.toBe('true');
    expect(config.textContent).toContain('Inspectors off');
    const labels = [...host(fixture).querySelectorAll('button.stat .label')].map((el) =>
      el.textContent?.trim(),
    );
    expect(labels).toContain('Components');
    expect(labels).not.toContain('Signals');
  });
});

describe('App tabs before the connection is up', () => {
  function tabNames(fixture: ComponentFixture<unknown>) {
    return [...host(fixture).querySelectorAll('nav button')].map((b) => b.textContent?.trim());
  }

  it('lists only the Dashboard until the config arrives, then the enabled inspectors', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    expect(tabNames(fixture)).toEqual(['Dashboard']);

    connection.resolve(fakeClient(signalsOff));
    await settle(fixture);
    const names = tabNames(fixture);
    expect(names).toContain('Components');
    expect(names).not.toContain('Signals');
  });

  it('keeps a tab restored from the address visible while connecting', async () => {
    location.hash = '#tab=routes';
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    expect(tabNames(fixture)).toEqual(['Dashboard', 'Routes']);
  });
});
