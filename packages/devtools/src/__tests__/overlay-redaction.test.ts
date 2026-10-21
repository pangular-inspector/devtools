// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSecretKey, setRedaction } from '../forms-privacy.ts';
import { serverRedaction, whenTrusted, type TrustClient } from '../overlay-redaction.ts';

type Listener = (status: string) => void;

/** A devframe client double: trust and status change when the test says so. */
function fakeClient(trusted: boolean) {
  const listeners = new Set<Listener>();
  const calls: string[] = [];
  const replies = new Map<string, unknown>();
  const client = {
    status: trusted ? 'connected' : 'unauthorized',
    isTrusted: trusted,
    connectionMeta: { backend: 'websocket', configs: { pangular: {} } },
    events: {
      on: (event: string, listener: Listener) => {
        if (event !== 'connection:status') return () => {};
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    scope: () => ({
      rpc: {
        call: async (name: string) => {
          calls.push(name);
          if (!client.isTrusted) throw new Error('[devframe] Not authorized');
          return replies.get(name);
        },
        register: () => {},
      },
    }),
    close: () => {},
    trust() {
      client.isTrusted = true;
      client.status = 'connected';
      for (const listener of [...listeners]) listener('connected');
    },
  };
  return { client, calls, replies, listeners };
}

let next: ReturnType<typeof fakeClient>['client'] | undefined;

vi.mock('devframe/client', () => ({
  connectDevframe: async () => next,
  forgetDevframeConnection: () => {},
}));

const stops: (() => void)[] = [];

afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  sessionStorage.clear();
  setRedaction();
  next = undefined;
});

const tick = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

describe('whenTrusted', () => {
  it('resolves at once for a trusted client or one that says nothing about trust', async () => {
    await expect(whenTrusted(fakeClient(true).client)).resolves.toBeUndefined();
    await expect(whenTrusted({})).resolves.toBeUndefined();
  });

  it('waits for an untrusted client until it is trusted', async () => {
    const { client, listeners } = fakeClient(false);
    let done = false;
    void whenTrusted(client).then(() => (done = true));
    await tick(10);
    expect(done).toBe(false);
    client.trust();
    await tick(0);
    expect(done).toBe(true);
    expect(listeners.size).toBe(0);
  });

  it('stops waiting when the connection drops', async () => {
    const listeners: Listener[] = [];
    const client: TrustClient = {
      status: 'connecting',
      isTrusted: false,
      events: { on: (_event, listener) => void listeners.push(listener) },
    };
    const waiting = whenTrusted(client);
    listeners.forEach((listener) => listener('disconnected'));
    await expect(waiting).resolves.toBeUndefined();
  });
});

describe('serverRedaction', () => {
  const fallback = { secretNames: ['fallback'], unmask: [] };

  it('returns the lists the server sends', async () => {
    const rpc = { call: async () => ({ secretNames: ['passport'], unmask: ['pin'] }) };
    expect(await serverRedaction(rpc, fallback)).toEqual({
      secretNames: ['passport'],
      unmask: ['pin'],
    });
  });

  it('falls back for a server without the function or a malformed answer', async () => {
    expect(
      await serverRedaction({ call: async () => Promise.reject(new Error('no')) }, fallback),
    ).toBe(fallback);
    expect(await serverRedaction({ call: async () => undefined }, fallback)).toBe(fallback);
    expect(await serverRedaction({ call: async () => ({ secretNames: [1] }) }, fallback)).toBe(
      fallback,
    );
  });
});

describe('the overlay and the redaction config', () => {
  it('applies the server redaction config before its first report', async () => {
    const fake = fakeClient(true);
    fake.replies.set('redaction-config', { secretNames: ['passport'], unmask: [] });
    next = fake.client;
    const { initOverlay } = await import('../overlay.ts');
    stops.push(await initOverlay());
    await tick(100);
    const asked = fake.calls.indexOf('redaction-config');
    const firstPush = fake.calls.findIndex((name) => name.startsWith('push-'));
    expect(asked).toBeGreaterThanOrEqual(0);
    expect(firstPush).toBeGreaterThan(asked);
    expect(isSecretKey('passportNumber')).toBe(true);
  });

  it('reads nothing from the app until a page waiting for the code is trusted', async () => {
    const fake = fakeClient(false);
    fake.replies.set('redaction-config', { secretNames: ['passport'], unmask: [] });
    next = fake.client;
    const { initOverlay } = await import('../overlay.ts');
    const started = initOverlay();
    await tick(100);
    expect(fake.calls).toEqual([]);
    expect(isSecretKey('passportNumber')).toBe(false);
    fake.client.trust();
    stops.push(await started);
    await tick(100);
    expect(fake.calls[0]).toBe('redaction-config');
    expect(isSecretKey('passportNumber')).toBe(true);
  });
});
