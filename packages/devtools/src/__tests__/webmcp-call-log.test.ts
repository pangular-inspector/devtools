// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  noteWebMcpEffect,
  shareWebMcp,
  watchWebMcp,
  webMcpCallNow,
  type WebMcpWatcher,
} from '../forms-webmcp.ts';

type Tool = {
  name: string;
  description: string;
  inputSchema?: unknown;
  annotations?: Record<string, unknown>;
  execute: (args: unknown) => unknown;
};

interface FakeContext {
  registerTool(tool: Tool): Promise<void>;
}

interface FakeZone {
  get(key: string): unknown;
  run<T>(fn: () => T): T;
}

const nav = navigator as Navigator & { modelContext?: FakeContext };
const global = globalThis as { Zone?: { readonly current: FakeZone & { fork: unknown } } };

const watchers: WebMcpWatcher[] = [];
afterEach(() => {
  watchers.splice(0).forEach((w) => w.stop());
  delete nav.modelContext;
  delete global.Zone;
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeContext() {
  const tools = new Map<string, Tool>();
  nav.modelContext = {
    registerTool: vi.fn(async (tool: Tool) => {
      tools.set(tool.name, tool);
    }),
  };
  return tools;
}

function watch() {
  const watcher = watchWebMcp(() => {});
  watchers.push(watcher);
  return watcher;
}

async function register(tool: Tool) {
  await nav.modelContext!.registerTool(tool);
  await tick();
}

describe('the WebMCP call log', () => {
  it('keeps masked argument and result values, the annotations and the outcome', async () => {
    const tools = fakeContext();
    const watcher = watch();
    await register({
      name: 'login',
      description: 'Sign in',
      annotations: { readOnlyHint: false },
      execute: async () => ({ content: [{ type: 'text', text: 'ok' }], token: 'abc' }),
    });
    await tools.get('login')!.execute({ email: 'a@b.c', password: 'hunter22' });
    await tick();
    const report = watcher.report();
    expect(report.tools[0]).toMatchObject({ name: 'login', annotations: { readOnlyHint: false } });
    const [call] = report.calls;
    expect(call).toMatchObject({ tool: 'login', outcome: 'done' });
    expect(call!.args).toEqual({ email: 'a@b.c', password: '[redacted]' });
    expect((call!.result as { token?: unknown }).token).toBe('[redacted]');
    expect(typeof call!.ms).toBe('number');
  });

  it('keeps the newest calls up to the limit and counts the dropped ones', async () => {
    const tools = fakeContext();
    const watcher = watch();
    watcher.setMaxCalls(2);
    await register({ name: 'ping', description: 'Ping', execute: () => 'pong' });
    for (let i = 0; i < 3; i++) await tools.get('ping')!.execute({ i });
    await tick();
    const report = watcher.report();
    expect(report.calls.map((call) => (call.args as { i?: number }).i)).toEqual([1, 2]);
    expect(report.dropped).toBe(1);
  });

  it('records a call that throws', async () => {
    const tools = fakeContext();
    const watcher = watch();
    await register({
      name: 'boom',
      description: 'Fails',
      execute: () => {
        throw new Error('nope');
      },
    });
    expect(() => tools.get('boom')!.execute({})).toThrow('nope');
    expect(watcher.report().calls[0]).toMatchObject({ outcome: 'threw', detail: 'nope' });
  });

  it('ties effects noted while execute runs to the call, and nothing outside it', async () => {
    const tools = fakeContext();
    const watcher = watch();
    let seen: number | undefined;
    await register({
      name: 'save',
      description: 'Save',
      execute: () => {
        seen = webMcpCallNow();
        noteWebMcpEffect(seen, 'http', 'c1');
        return 'saved';
      },
    });
    expect(webMcpCallNow()).toBeUndefined();
    await tools.get('save')!.execute({});
    noteWebMcpEffect(undefined, 'http', 'c2');
    await tick();
    expect(seen).toBeTypeOf('number');
    expect(watcher.report().calls[0]!.caused).toEqual([{ layer: 'http', key: 'c1' }]);
  });

  it('runs execute in a forked zone when Zone.js is there, so later work stays tied', async () => {
    let current: FakeZone = { get: () => undefined, run: (fn) => fn() };
    const fork = vi.fn((spec: { properties: Record<string, unknown> }) => {
      const zone: FakeZone = {
        get: (key: string) => spec.properties[key],
        run: (fn) => {
          const previous = current;
          current = zone;
          try {
            return fn();
          } finally {
            current = previous;
          }
        },
      };
      return zone;
    });
    global.Zone = {
      get current() {
        return { ...current, fork };
      },
    };
    const tools = fakeContext();
    const watcher = watch();
    let later: () => void = () => {};
    await register({
      name: 'slow',
      description: 'Slow',
      execute: () => {
        const zone = global.Zone!.current;
        // Work the zone resumes later still sees the call's zone.
        later = () => zone.run(() => noteWebMcpEffect(webMcpCallNow(), 'ngrx', '7'));
        return 'ok';
      },
    });
    await tools.get('slow')!.execute({});
    later();
    await tick();
    expect(fork).toHaveBeenCalledOnce();
    expect(watcher.report().calls[0]!.caused).toEqual([{ layer: 'ngrx', key: '7' }]);
  });

  it('marks a call the user was active during', async () => {
    const tools = fakeContext();
    const watcher = watch();
    await register({ name: 'ping', description: 'Ping', execute: () => 'pong' });
    await tools.get('ping')!.execute({});
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    await tick();
    expect(watcher.report().calls[0]!.userInput).toBe(true);
  });

  it('keeps a call marked once the user was active, however much input follows', async () => {
    const tools = fakeContext();
    const watcher = watch();
    await register({ name: 'ping', description: 'Ping', execute: () => 'pong' });
    let resolve: (value: string) => void = () => {};
    await register({
      name: 'slow',
      description: 'Slow',
      execute: () => new Promise<string>((done) => (resolve = done)),
    });
    void tools.get('slow')!.execute({});
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    resolve('ok');
    await tick();
    const now = Date.now();
    const later = vi.spyOn(Date, 'now').mockReturnValue(now + 60_000);
    for (let i = 0; i < 80; i++) document.dispatchEvent(new KeyboardEvent('keydown'));
    later.mockRestore();
    expect(watcher.report().calls[0]!.userInput).toBe(true);
  });

  it('records the read-only claim with each call', async () => {
    const tools = fakeContext();
    const watcher = watch();
    await register({
      name: 'look',
      description: 'Look',
      annotations: { readOnlyHint: true },
      execute: () => 'seen',
    });
    await tools.get('look')!.execute({});
    await tick();
    expect(watcher.report().calls[0]!.readOnly).toBe(true);
  });
});

describe('shareWebMcp', () => {
  it('replaces registerTool once for every collector and stops with the last one', async () => {
    fakeContext();
    const original = nav.modelContext!.registerTool;
    const first = vi.fn();
    const second = vi.fn();
    const a = shareWebMcp(first);
    const b = shareWebMcp(second);
    expect(a.watcher).toBe(b.watcher);
    await register({ name: 'x', description: 'X', execute: () => 'x' });
    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
    a.release();
    expect(nav.modelContext!.registerTool).not.toBe(original);
    b.release();
    expect(nav.modelContext!.registerTool).toBe(original);
  });
});
