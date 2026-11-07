// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { attachChangeDetection, recordingWasOn, rememberRecording } from '../cd-overlay.ts';

function fakeRpc() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const my = {
    rpc: {
      call: async () => undefined,
      register: (def: { name: string; handler: (...args: unknown[]) => unknown }) =>
        handlers.set(def.name, def.handler),
    },
  };
  return { my, handlers };
}

const ng = { ɵsetProfiler: () => () => {}, getHostElement: () => null };

describe('change detection recording across a reload', () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.body.innerHTML = '<app-root ng-version="22.1.0"></app-root>';
  });

  afterEach(() => {
    sessionStorage.clear();
    document.body.innerHTML = '';
  });

  it('starts recording again when the same page loads with the flag set', () => {
    const first = fakeRpc();
    const before = attachChangeDetection(first.my, 'p1', () => ng, 50);
    first.handlers.get('change-detection-record')!({ pageId: 'p1', on: true });
    expect(before.recording).toBe(true);
    expect(recordingWasOn('p1')).toBe(true);
    // The old page goes away; leaving on teardown must not forget the choice.
    before.stop();
    expect(recordingWasOn('p1')).toBe(true);

    const after = attachChangeDetection(fakeRpc().my, 'p1', () => ng, 50);
    expect(after.recording).toBe(true);
    after.stop();
  });

  it('keeps the flag per page, so another tab does not start recording', () => {
    rememberRecording('p1', true);
    const other = attachChangeDetection(fakeRpc().my, 'p2', () => ng, 50);
    expect(other.recording).toBe(false);
    other.stop();
  });

  it('forgets the flag when the user stops recording', () => {
    const { my, handlers } = fakeRpc();
    const cd = attachChangeDetection(my, 'p1', () => ng, 50);
    handlers.get('change-detection-record')!({ pageId: 'p1', on: true });
    handlers.get('change-detection-record')!({ pageId: 'p1', on: false });
    expect(recordingWasOn('p1')).toBe(false);
    expect(attachChangeDetection(fakeRpc().my, 'p1', () => ng, 50).recording).toBe(false);
    cd.stop();
  });

  it('records without the flag when session storage throws', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(() => rememberRecording('p1', true, blocked)).not.toThrow();
    expect(recordingWasOn('p1', blocked)).toBe(false);
  });

  it('remembers nothing on a platform without a DOM', () => {
    const { my, handlers } = fakeRpc();
    const cd = attachChangeDetection(my, 'p1', () => ng, 50, undefined, undefined, {
      profilerGate: () => ({ major: 22 }),
      roots: () => [],
      hostId: () => null,
    });
    handlers.get('change-detection-record')!({ pageId: 'p1', on: true });
    expect(recordingWasOn('p1')).toBe(false);
    cd.stop();
  });
});
