import { afterEach, describe, expect, it, vi } from 'vitest';
import { keepaliveDue } from '../change-detection.ts';
import { createDeltaChannel } from '../delta-channel.ts';
import {
  PAGE_HEARTBEAT_MS,
  createPageHeartbeat,
  heartbeatRunning,
  keepaliveAfter,
} from '../page-heartbeat.ts';
import { COMPONENT_TREE_SHAPE } from '../push-delta.ts';

function fakeServer(answer: () => unknown) {
  const calls: { name: string; arg: unknown }[] = [];
  return {
    calls,
    my: {
      rpc: {
        call: async (name: string, arg?: unknown) => {
          calls.push({ name, arg });
          return name === 'page-heartbeat' ? answer() : { delta: true, known: true };
        },
      },
    },
  };
}

describe('page heartbeat', () => {
  let stop = () => {};
  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it('beats once per interval and turns the collectors keepalives off', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const server = fakeServer(() => ({ known: true, watching: false }));
    const watching = vi.fn();
    const heartbeat = createPageHeartbeat(server.my, 'p1', { watching });
    stop = heartbeat.stop;
    // Before the first answer, the collectors keep their own keepalives.
    expect(keepaliveDue(0, 0, 60_000)).toBe(true);
    heartbeat.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(heartbeatRunning()).toBe(true);
    expect(watching).toHaveBeenLastCalledWith(false);

    // An unchanged tree over many keepalive periods: one beat per interval, nothing else.
    const tree = createDeltaChannel({
      call: server.my.rpc.call,
      pageId: 'p1',
      push: 'push-component-tree',
      ping: 'ping-component-tree',
      shape: COMPONENT_TREE_SHAPE,
    });
    const report = { roots: [{ id: 'c1', name: 'App', children: [] }], count: 1 };
    await tree.send(report);
    server.calls.length = 0;
    for (let i = 0; i < 30; i++) {
      await vi.advanceTimersByTimeAsync(2000);
      await tree.send(report);
      await tree.keepalive(() => report);
    }
    expect(server.calls.map((call) => call.name)).toEqual(
      Array(60_000 / PAGE_HEARTBEAT_MS).fill('page-heartbeat'),
    );
    expect(server.calls[0]!.arg).toEqual({ pageId: 'p1' });
  });

  it('marks every earlier send as due once the server lost the page', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    let known = true;
    const server = fakeServer(() => ({ known }));
    const heartbeat = createPageHeartbeat(server.my, 'p1');
    stop = heartbeat.stop;
    await heartbeat.beat();
    const sentAt = Date.now();
    vi.advanceTimersByTime(60_000);
    expect(keepaliveDue(sentAt, 0)).toBe(false);
    expect(keepaliveAfter(sentAt, 5000)).toBe(false);

    known = false;
    await heartbeat.beat();
    expect(keepaliveDue(sentAt, 0)).toBe(true);
    expect(keepaliveAfter(sentAt, 5000)).toBe(true);
    // A report sent after the loss is not due again.
    vi.advanceTimersByTime(1);
    expect(keepaliveDue(Date.now(), 0)).toBe(false);
  });

  it('leaves the keepalives on against a server without the heartbeat', async () => {
    const heartbeat = createPageHeartbeat(
      { rpc: { call: async () => Promise.reject(new Error('function not found')) } },
      'p1',
    );
    stop = heartbeat.stop;
    await heartbeat.beat();
    expect(heartbeatRunning()).toBe(false);
    expect(keepaliveAfter(0, 5000, 6000)).toBe(true);
  });

  it('stops for good and hands the keepalives back', async () => {
    const heartbeat = createPageHeartbeat(fakeServer(() => ({ known: true })).my, 'p1');
    await heartbeat.beat();
    expect(heartbeatRunning()).toBe(true);
    heartbeat.stop();
    expect(heartbeatRunning()).toBe(false);
  });
});
