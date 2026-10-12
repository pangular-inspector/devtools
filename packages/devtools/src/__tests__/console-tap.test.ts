// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { consoleTapInfo, tapConsole, type ConsoleLevel } from '../console-tap.ts';
import { attachAnalog } from '../analog-runtime.ts';
import { attachForms } from '../forms-collector.ts';

const originals = { log: console.log, warn: console.warn, error: console.error };

afterEach(() => {
  console.log = originals.log;
  console.warn = originals.warn;
  console.error = originals.error;
  vi.useRealTimers();
});

describe('tapConsole', () => {
  it('patches each level once and fans calls out to every listener', () => {
    const printed: unknown[][] = [];
    const base = (...args: unknown[]) => void printed.push(args);
    console.warn = base;
    const first: unknown[][] = [];
    const second: [ConsoleLevel, unknown[]][] = [];
    const stopFirst = tapConsole(['warn'], (_level, args) => void first.push([...args]));
    const patched = console.warn;
    const stopSecond = tapConsole(
      ['warn', 'error'],
      (level, args) => void second.push([level, [...args]]),
    );
    // The second listener reuses the patch on warn.
    expect(console.warn).toBe(patched);
    expect(consoleTapInfo().patched).toEqual(['warn', 'error']);

    console.warn('NG0500: hydration', 1);
    expect(printed).toEqual([['NG0500: hydration', 1]]);
    expect(first).toEqual([['NG0500: hydration', 1]]);
    expect(second).toEqual([['warn', ['NG0500: hydration', 1]]]);

    stopFirst();
    expect(console.warn).toBe(patched);
    stopSecond();
    expect(console.warn).toBe(base);
    expect(console.error).toBe(originals.error);
    expect(consoleTapInfo()).toEqual({ listeners: 0, patched: [] });
  });

  it("keeps the console's this, arguments and return value", () => {
    let seenThis: unknown;
    console.log = function (this: unknown, ...args: unknown[]) {
      seenThis = this;
      return args.length;
    } as typeof console.log;
    const stop = tapConsole(['log'], () => {});
    const result = (console.log as unknown as (...args: unknown[]) => unknown)('a', 'b');
    expect(result).toBe(2);
    expect(seenThis).toBe(console);
    stop();
  });

  it('never lets a listener break logging or hear itself', () => {
    const printed: unknown[] = [];
    console.error = (...args: unknown[]) => void printed.push(args[0]);
    let heard = 0;
    const stopThrowing = tapConsole(['error'], () => {
      throw new Error('listener failed');
    });
    const stopLogging = tapConsole(['error'], () => {
      heard++;
      console.error('from the listener');
    });
    expect(() => console.error('app error')).not.toThrow();
    expect(heard).toBe(1);
    expect(printed).toEqual(['from the listener', 'app error']);
    stopThrowing();
    stopLogging();
  });

  it('wraps a method replaced after it patched, without hearing a call twice', () => {
    const heard: unknown[] = [];
    const stop = tapConsole(['warn'], (_level, args) => void heard.push(args[0]));
    const ours = console.warn;
    // Another tool wraps the patched method.
    console.warn = (...args: unknown[]) => ours(...args);
    const again = tapConsole(['warn'], () => {});
    console.warn('once');
    expect(heard).toEqual(['once']);
    again();
    stop();
  });

  it('leaves a method someone wrapped on top of it in place when it stops', () => {
    const stop = tapConsole(['log'], () => {});
    const theirs = (...args: unknown[]) => args;
    console.log = theirs;
    stop();
    expect(console.log).toBe(theirs);
  });

  it('serves the forms and Analog collectors from one patch and restores the console after both', () => {
    vi.useFakeTimers();
    const base = console.error;
    const my = { rpc: { call: async () => undefined, register: () => {} } };
    const forms = attachForms(my as never, 'p1', () => undefined, {
      show: () => {},
      clear: () => {},
    });
    const afterForms = console.error;
    const stopAnalog = attachAnalog(my as never, 'p1', () => undefined, 1000);
    expect(console.error).toBe(afterForms);
    expect(consoleTapInfo().listeners).toBe(2);
    forms.stop();
    expect(console.error).toBe(afterForms);
    stopAnalog();
    expect(console.error).toBe(base);
    expect(consoleTapInfo().listeners).toBe(0);
  });
});
