import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const connection = vi.hoisted(() => ({
  attempts: 0,
  /** What each attempt does: `true` connects, `false` fails. */
  answers: [] as boolean[],
  /** Sends a `connection:status` event to the last connected client's listeners. */
  emitStatus: (_status: string) => {},
}));

function fakeClient(): DevframeRpcClient {
  const rpc = {
    call: () => new Promise(() => {}),
    callEvent: () => Promise.resolve(),
    sharedState: () => Promise.resolve({ value: () => null, on: () => () => {} }),
  };
  const listeners: ((status: string) => void)[] = [];
  connection.emitStatus = (status) => listeners.forEach((listener) => listener(status));
  return {
    connectionMeta: { configs: {} },
    scope: () => ({ rpc }),
    events: {
      on: (name: string, listener: (status: string) => void) => {
        if (name === 'connection:status') listeners.push(listener);
        return () => {};
      },
    },
    close: () => {},
  } as unknown as DevframeRpcClient;
}

vi.mock('devframe/client', () => ({
  connectDevframe: () => {
    const ok = connection.answers[connection.attempts++] ?? false;
    return ok ? Promise.resolve(fakeClient()) : Promise.reject(new Error('no server'));
  },
}));

const { App } = await import('../app');

async function settle(fixture: ComponentFixture<unknown>) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

const host = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;
const status = (fixture: ComponentFixture<unknown>) =>
  host(fixture).querySelector('.status')?.textContent?.trim();

afterEach(() => {
  document.body.innerHTML = '';
  connection.attempts = 0;
  connection.answers = [];
  TestBed.resetTestingModule();
});

describe('App connection retry', () => {
  it('offers Retry now when the server does not answer, and connects from it', async () => {
    connection.answers = [false, true];
    const fixture = TestBed.createComponent(App);
    document.body.appendChild(host(fixture));
    await settle(fixture);

    const alert = host(fixture).querySelector('.connection-error')!;
    expect(alert.getAttribute('role')).toBe('alert');
    expect(status(fixture)).toBe('Disconnected');
    const retry = alert.querySelector('button')!;
    expect(retry.textContent?.trim()).toBe('Retry now');

    retry.focus();
    retry.click();
    await settle(fixture);
    expect(connection.attempts).toBe(2);
    expect(host(fixture).querySelector('.connection-error')).toBeNull();
    expect(status(fixture)).toBe('Live');
    // The button went with the error, so focus moved on rather than falling to the page.
    expect(document.activeElement).toBe(host(fixture).querySelector('nav button.active'));
    fixture.destroy();
  });

  it('tries again on its own after a failed first connection', async () => {
    connection.answers = [false, true];
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    expect(connection.attempts).toBe(1);

    await vi.waitFor(() => expect(connection.attempts).toBe(2), { timeout: 3000 });
    await settle(fixture);
    expect(status(fixture)).toBe('Live');
    fixture.destroy();
  });

  it('connects again when an open connection drops', async () => {
    connection.answers = [true, true];
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    expect(status(fixture)).toBe('Live');

    // The dev server restarted: the old client is closed for good.
    connection.emitStatus('disconnected');
    await settle(fixture);
    expect(status(fixture)).toBe('Disconnected');
    expect(host(fixture).querySelector('.connection-error button')).not.toBeNull();

    await vi.waitFor(() => expect(connection.attempts).toBe(2), { timeout: 3000 });
    await settle(fixture);
    expect(status(fixture)).toBe('Live');
    fixture.destroy();
  });

  it('stops retrying once the panel is gone', async () => {
    connection.answers = [false, true];
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    fixture.destroy();

    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect(connection.attempts).toBe(1);
  });
});

describe('App tab bar', () => {
  it('keeps one tab in the Tab order and moves along the bar with arrow keys', async () => {
    connection.answers = [true];
    const fixture = TestBed.createComponent(App);
    document.body.appendChild(host(fixture));
    await settle(fixture);

    const buttons = [...host(fixture).querySelectorAll<HTMLButtonElement>('nav button')];
    expect(buttons.length).toBeGreaterThan(2);
    expect(buttons.filter((b) => b.tabIndex === 0)).toEqual([buttons[0]]);

    const press = (key: string) =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
    buttons[0].focus();
    press('ArrowRight');
    expect(document.activeElement).toBe(buttons[1]);
    press('ArrowLeft');
    press('ArrowLeft');
    expect(document.activeElement).toBe(buttons.at(-1));
    press('Home');
    expect(document.activeElement).toBe(buttons[0]);

    buttons[2].click();
    await settle(fixture);
    const now = [...host(fixture).querySelectorAll<HTMLButtonElement>('nav button')];
    expect(now.filter((b) => b.tabIndex === 0)).toEqual([now[2]]);
    fixture.destroy();
  });
});
