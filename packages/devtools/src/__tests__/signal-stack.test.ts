// @vitest-environment jsdom
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { appFrames, captureStack } from '../signal-stack.ts';
import {
  createSignalHistory,
  installSignalWriteHook,
  type RawSignalNode,
} from '../signal-history.ts';
import type { SignalGraphNode } from '../types.ts';

const identity = (v: unknown) => v;

describe('appFrames', () => {
  it('skips the overlay, Angular, zone.js and packages and keeps three app frames', () => {
    const stack = [
      'Error',
      '    at captureStack (http://localhost:4200/@fs/repo/node_modules/@pangular-inspector/devtools/dist/overlay.mjs:10:5)',
      '    at hook (http://localhost:4200/@fs/repo/.angular/cache/vite/deps/@pangular-inspector_devtools_overlay.js:20:3)',
      '    at signalValueChanged (http://localhost:4200/@fs/repo/.angular/cache/vite/deps/chunk-ABC.js:1:1)',
      '    at signalSetFn (http://localhost:4200/chunk-ANGULAR.js:300:7)',
      '    at set (http://localhost:4200/chunk-ANGULAR.js:310:9)',
      '    at Counter.increment (http://localhost:4200/main.js?v=12:45:12)',
      '    at Counter_Template_button_click_0_listener (http://localhost:4200/main.js:80:3)',
      '    at executeListenerWithErrorHandling (http://localhost:4200/chunk-ANGULAR.js:900:1)',
      '    at _ZoneDelegate.invokeTask (http://localhost:4200/polyfills.js:1:1)',
      '    at http://localhost:4200/node_modules/zone.js/fesm2015/zone.js:2:2',
      '    at Cart.add (http://localhost:4200/src/app/cart.ts:9:1)',
      '    at Shop.buy (http://localhost:4200/src/app/shop.ts:4:1)',
    ].join('\n');
    expect(appFrames(stack)).toEqual([
      'Counter.increment (main.js:45:12)',
      'Counter_Template_button_click_0_listener (main.js:80:3)',
      'Cart.add (src/app/cart.ts:9:1)',
    ]);
  });

  it('reads Firefox and Safari frames and frames without a function name', () => {
    const stack = [
      'signalSetFn@http://localhost:5173/node_modules/.vite/deps/@angular_core.js:1:1',
      'increment@http://localhost:5173/src/app/counter.ts?t=17:12:5',
      'http://localhost:5173/src/main.ts:3:1',
    ].join('\n');
    expect(appFrames(stack)).toEqual(['increment (src/app/counter.ts:12:5)', 'src/main.ts:3:1']);
  });

  it('masks tokens in frame urls', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const [frame] = appFrames(`Error\n    at load (http://localhost/src/app/${jwt}.ts:1:1)`);
    expect(frame).not.toContain(jwt);
  });

  it('answers nothing for no stack', () => {
    expect(appFrames(undefined)).toEqual([]);
    expect(appFrames('Error')).toEqual([]);
  });
});

describe('captureStack', () => {
  it('raises the frame limit only while it takes the stack', () => {
    const before = Error.stackTraceLimit;
    Error.stackTraceLimit = 5;
    try {
      const deep = (n: number): string | undefined => (n ? deep(n - 1) : captureStack());
      const stack = deep(20)!;
      expect(stack.split('\n').filter((line) => line.includes('deep')).length).toBeGreaterThan(5);
      expect(Error.stackTraceLimit).toBe(5);
    } finally {
      Error.stackTraceLimit = before;
    }
  });
});

describe('signal history write stacks', () => {
  const node = (epoch: number, value: unknown): SignalGraphNode => ({
    id: 'a',
    kind: 'signal',
    label: 'count',
    epoch,
    value,
  });

  function setCount(onWrite: (n: RawSignalNode) => void, raw: RawSignalNode, value: number) {
    raw.value = value;
    raw.version = (raw.version ?? 0) + 1;
    onWrite(raw);
  }

  it('records the app frames of each write while stacks are on', async () => {
    let stacks = true;
    const h = createSignalHistory(identity, () => 1, identity, { stacks: () => stacks });
    const raw: RawSignalNode = { debugName: 'count', kind: 'signal', value: 0, version: 0 };
    h.collect([node(0, 0)]);
    setCount(h.onWrite, raw, 1);
    stacks = false;
    setCount(h.onWrite, raw, 2);
    await Promise.resolve();
    const [, first, second] = h.collect([node(2, 2)])['a']!;
    expect(first!.stack?.[0]).toMatch(/setCount .*signal-stack\.test\.ts/);
    expect(first!.stack!.length).toBeLessThanOrEqual(3);
    expect(second!.stack).toBeUndefined();
  });

  it('takes no stack while stacks are off', () => {
    const capture = vi.spyOn(Error, 'captureStackTrace');
    const errors = vi.fn();
    const Original = globalThis.Error;
    const h = createSignalHistory(identity, () => 1, identity, { stacks: () => false });
    const raw: RawSignalNode = { debugName: 'count', kind: 'signal', value: 0, version: 0 };
    globalThis.Error = new Proxy(Original, {
      construct(target, args) {
        errors();
        return Reflect.construct(target, args);
      },
    });
    try {
      for (let i = 1; i <= 100; i++) setCount(h.onWrite, raw, i);
    } finally {
      globalThis.Error = Original;
    }
    expect(errors).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it('tells the listener the node id of a write once a snapshot bound it', async () => {
    const changes: [string | undefined, string, unknown][] = [];
    const h = createSignalHistory(identity, () => 1, identity, {
      onChange: (id, label, change) => changes.push([id, label, change.value]),
    });
    const raw: RawSignalNode = { debugName: 'count', kind: 'signal', value: 0, version: 0 };
    setCount(h.onWrite, raw, 1);
    h.collect([node(1, 1)]);
    setCount(h.onWrite, raw, 2);
    await Promise.resolve();
    expect(changes).toEqual([
      [undefined, 'count', 1],
      ['a', 'count', 2],
    ]);
  });

  it('records the frames of a real Angular signal write', async () => {
    const h = createSignalHistory(identity, Date.now, identity, { stacks: () => true });
    const restore = await installSignalWriteHook(h.onWrite);
    try {
      const count = signal(0, { debugName: 'count' });
      h.collect([node(0, 0)]);
      const increment = () => count.update((n) => n + 1);
      increment();
      await Promise.resolve();
      const last = h.collect([node(1, 1)])['a']!.at(-1)!;
      expect(last.source).toBe('write');
      expect(last.stack?.[0]).toMatch(/^increment .*signal-stack\.test\.ts/);
    } finally {
      restore?.();
    }
  });
});
