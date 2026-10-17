import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DevframeRpcClient } from 'devframe/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const connection = vi.hoisted(() => ({
  attempts: 0,
  /** What each attempt does: `true` connects, `false` fails. */
  answers: [] as boolean[],
  /** Sends a `connection:status` event to the last connected client's listeners. */
  emitStatus: (_status: string) => {},
  /** `emitStatus` for each client, in the order they were made. */
  emitters: [] as ((status: string) => void)[],
  /** The options each attempt passed to `connectDevframe`. */
  options: [] as unknown[],
  /** How many clients the panel closed. */
  closed: 0,
  /** The status each new client starts with. */
  initialStatus: 'connected',
  /** The one-time code the fake server accepts. */
  code: '123456',
}));

function fakeClient(): DevframeRpcClient {
  const rpc = {
    call: () => new Promise(() => {}),
    callEvent: () => Promise.resolve(),
    sharedState: () => Promise.resolve({ value: () => null, on: () => () => {} }),
  };
  const listeners: ((status: string) => void)[] = [];
  const client = {
    status: connection.initialStatus,
    connection: { authToken: undefined as string | undefined },
    requestAuthCode: vi.fn(() => Promise.resolve()),
    requestTrustWithCode: vi.fn(async (code: string) => {
      if (code !== connection.code) return false;
      client.connection.authToken = 'token-for-code';
      connection.emitStatus('connected');
      return true;
    }),
  };
  connection.emitStatus = (status) => {
    client.status = status;
    listeners.forEach((listener) => listener(status));
  };
  connection.emitters.push(connection.emitStatus);
  return {
    get status() {
      return client.status;
    },
    get connection() {
      return client.connection;
    },
    requestAuthCode: client.requestAuthCode,
    requestTrustWithCode: client.requestTrustWithCode,
    connectionMeta: { configs: {} },
    scope: () => ({ rpc }),
    events: {
      on: (name: string, listener: (status: string) => void) => {
        if (name === 'connection:status') listeners.push(listener);
        return () => {};
      },
    },
    close: () => {
      connection.closed++;
    },
  } as unknown as DevframeRpcClient;
}

vi.mock('devframe/client', () => ({
  connectDevframe: (options?: unknown) => {
    connection.options.push(options);
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
  connection.options = [];
  connection.emitters = [];
  connection.closed = 0;
  connection.initialStatus = 'connected';
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
    const kept = globalThis as Record<string, unknown>;
    kept['__DEVFRAME_CONNECTION__'] = { connectionMeta: { websocket: 9777 } };
    connection.emitStatus('disconnected');
    await settle(fixture);
    expect(status(fixture)).toBe('Disconnected');
    expect(host(fixture).querySelector('.connection-error button')).not.toBeNull();

    await vi.waitFor(() => expect(connection.attempts).toBe(2), { timeout: 3000 });
    await settle(fixture);
    expect(status(fixture)).toBe('Live');
    // It read the connection file again: the server may listen on another port now.
    expect(kept['__DEVFRAME_CONNECTION__']).toBeUndefined();
    fixture.destroy();
  });

  it('caches only build-meta, in a new client after the connection drops', async () => {
    connection.answers = [true, true];
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    expect(connection.options[0]).toMatchObject({
      cacheOptions: { functions: ['pangular:build-meta'] },
    });

    // A restarted server gets a new client, so nothing cached before is reused.
    connection.emitStatus('disconnected');
    await settle(fixture);
    expect(connection.closed).toBe(1);
    await vi.waitFor(() => expect(connection.attempts).toBe(2), { timeout: 3000 });
    expect(connection.options[1]).toMatchObject({
      cacheOptions: { functions: ['pangular:build-meta'] },
    });
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

describe('App before the server trusts it', () => {
  it('shows Connecting, not Live, until the socket is trusted, and the error when it fails', async () => {
    connection.answers = [true, false];
    connection.initialStatus = 'connecting';
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    expect(status(fixture)).toBe('Connecting…');
    expect(host(fixture).textContent).toContain('Connecting to the devtools server…');
    expect(host(fixture).querySelector('app-dashboard')).toBeNull();
    expect(connection.options[0]).toMatchObject({ simpleAuth: false });

    // The server is down: the reused connection file resolves, the socket does not open.
    connection.emitStatus('error');
    await settle(fixture);
    expect(status(fixture)).toBe('Disconnected');
    expect(host(fixture).querySelector('.connection-error')).not.toBeNull();
    fixture.destroy();
  });

  it('does not start a second client while one still waits for the server', async () => {
    connection.answers = [false, true, true];
    connection.initialStatus = 'connecting';
    const fixture = TestBed.createComponent(App);
    document.body.appendChild(host(fixture));
    await settle(fixture);
    const retry = () => host(fixture).querySelector<HTMLButtonElement>('.connection-error button');

    // The first retry finds the connection file; its socket is still opening.
    retry()!.click();
    await settle(fixture);
    expect(connection.attempts).toBe(2);
    expect(retry()).not.toBeNull();

    retry()!.click();
    await settle(fixture);
    expect(connection.attempts).toBe(2);

    connection.emitters[0]!('connected');
    await settle(fixture);
    expect(status(fixture)).toBe('Live');
    fixture.destroy();
  });

  it('asks for the one-time code when the server does not trust the panel, then connects', async () => {
    connection.answers = [true];
    connection.initialStatus = 'connecting';
    const fixture = TestBed.createComponent(App);
    document.body.appendChild(host(fixture));
    await settle(fixture);
    connection.emitStatus('unauthorized');
    await settle(fixture);
    expect(status(fixture)).toBe('Code needed');
    const form = host(fixture).querySelector('app-auth-code')!;
    expect(form).not.toBeNull();
    expect(form.querySelector('h2')?.textContent).toBe('Enter the one-time code');
    const input = form.querySelector<HTMLInputElement>('input')!;
    expect(document.activeElement).toBe(input);

    input.value = '000000';
    input.dispatchEvent(new Event('input'));
    form.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
    expect(form.querySelector('[role="alert"]')?.textContent).toContain("didn't match");
    expect(status(fixture)).toBe('Code needed');

    input.value = ' 123456 ';
    input.dispatchEvent(new Event('input'));
    form.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(fixture);
    expect(host(fixture).querySelector('app-auth-code')).toBeNull();
    expect(status(fixture)).toBe('Live');
    expect(host(fixture).querySelector('app-dashboard')).not.toBeNull();
    fixture.destroy();
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
