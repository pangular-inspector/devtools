import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

function fakeClient(analog: boolean): DevframeRpcClient {
  const rpc = {
    call: (name: string) =>
      name === 'analog-project'
        ? Promise.resolve({ analog, routes: [], api: [], middleware: [], content: [] })
        : new Promise(() => {}),
    callEvent: () => Promise.resolve(),
    sharedState: () => Promise.resolve({ value: () => null, on: () => () => {} }),
  };
  return {
    connectionMeta: { configs: {} },
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

function activeTab(fixture: ComponentFixture<unknown>) {
  return (fixture.nativeElement as HTMLElement)
    .querySelector('nav button.active')
    ?.textContent?.trim();
}

afterEach(() => {
  document.body.innerHTML = '';
  location.hash = '';
  sessionStorage.clear();
});

describe('App restoring the Analog tab', () => {
  it('opens Analog from a #tab=analog link once the project is known to be Analog', async () => {
    location.hash = '#tab=analog';
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    connection.resolve(fakeClient(true));
    await settle(fixture);
    expect(activeTab(fixture)).toBe('Analog');
  });

  it('opens Analog from the remembered tab', async () => {
    sessionStorage.setItem('pangular-tab:panel', 'analog');
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    connection.resolve(fakeClient(true));
    await settle(fixture);
    expect(activeTab(fixture)).toBe('Analog');
  });

  it('stays on the Dashboard when the project is not Analog', async () => {
    location.hash = '#tab=analog';
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    connection.resolve(fakeClient(false));
    await settle(fixture);
    expect(activeTab(fixture)).toBe('Dashboard');
  });

  it('does not pull the user back to Analog after they chose another tab', async () => {
    location.hash = '#tab=analog';
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    fixture.componentInstance.switchTab('routes');
    connection.resolve(fakeClient(true));
    await settle(fixture);
    expect(activeTab(fixture)).toBe('Routes');
  });
});
