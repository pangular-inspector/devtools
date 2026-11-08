import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it } from 'vitest';
import pangular, { createPangular } from '../devframe.ts';
import {
  captureSsrConsoleErrors,
  recordServerError,
  serverErrorsRegistry,
  ssrErrorFromConsole,
  takeServerErrors,
  viteErrorFromPayload,
  watchViteErrors,
  type ServerErrorInput,
} from '../server-errors.ts';
import {
  MAX_SERVER_ERRORS,
  SERVER_ERROR_TTL_MS,
  listServerErrorsText,
  mergeServerError,
  staleServerErrors,
  type ServerErrorsState,
} from '../rpc/server-errors-register.ts';
import { runInSsrRequest } from '../ssr-context.ts';
import { ssrRegistry } from '../ssr-registry.ts';
import { answerText } from './tool-answer.ts';

const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');

const vitePayload = (err: Record<string, unknown>) => ({ type: 'error', err });

afterEach(() => {
  serverErrorsRegistry().stopConsole?.();
  delete (globalThis as { __PANGULAR_SERVER_ERRORS__?: unknown }).__PANGULAR_SERVER_ERRORS__;
  ssrRegistry().active.clear();
});

describe('Vite errors', () => {
  it('reads an error payload and ignores other payloads', () => {
    expect(
      viteErrorFromPayload(
        vitePayload({
          message: 'Transform failed with 1 error',
          stack: 'Error: Transform failed\n    at esbuild',
          plugin: 'vite:esbuild',
          id: '/app/src/main.ts?v=1',
          frame: '1 | const a = ;',
          loc: { file: '/app/src/main.ts?v=1', line: 1, column: 10 },
        }),
      ),
    ).toEqual({
      kind: 'vite',
      message: 'Transform failed with 1 error',
      stack: 'Error: Transform failed\n    at esbuild',
      plugin: 'vite:esbuild',
      file: '/app/src/main.ts',
      line: 1,
      column: 10,
      frame: '1 | const a = ;',
    });
    expect(viteErrorFromPayload({ type: 'update', updates: [] })).toBeUndefined();
    expect(viteErrorFromPayload(vitePayload({}))).toBeUndefined();
    expect(viteErrorFromPayload(null)).toBeUndefined();
  });

  it('wraps ws.send, passes every payload on and puts send back', () => {
    const sent: unknown[] = [];
    const server = { ws: { send: (payload: unknown) => void sent.push(payload) } };
    const original = server.ws.send;
    const recorded: ServerErrorInput[] = [];
    takeServerErrors((error) => recorded.push(error));
    const stop = watchViteErrors(server);
    server.ws.send(vitePayload({ message: 'Failed to resolve import "./missing"' }));
    server.ws.send({ type: 'full-reload' });
    expect(sent).toHaveLength(2);
    expect(recorded.map((e) => e.message)).toEqual(['Failed to resolve import "./missing"']);
    stop();
    expect(server.ws.send).toBe(original);
  });
});

describe('SSR errors', () => {
  it("takes Angular's ErrorHandler format and calls inside a traced render", () => {
    const error = new Error('NG0201: No provider found for `TripsApi`');
    expect(ssrErrorFromConsole(['ERROR', error])).toMatchObject({
      kind: 'ssr',
      message: 'NG0201: No provider found for `TripsApi`',
      stack: error.stack,
    });
    // A plain log outside a render is not an SSR error.
    expect(ssrErrorFromConsole(['Server listening'])).toBeUndefined();
    ssrRegistry().active.set('r1', { url: '/trips', fetches: 0, fetchMs: 0 });
    const inside = runInSsrRequest('r1', () => ssrErrorFromConsole(['Render failed', error]));
    expect(inside).toMatchObject({ kind: 'ssr', url: '/trips', requestId: 'r1' });
    expect(inside!.message).toContain('Render failed');
  });

  it('listens to console.error and still prints the call', () => {
    const printed: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => void printed.push(args);
    try {
      const recorded: ServerErrorInput[] = [];
      takeServerErrors((error) => recorded.push(error));
      const stop = captureSsrConsoleErrors();
      expect(captureSsrConsoleErrors()).toBe(stop);
      console.error('ERROR', new Error('boom'));
      console.error('unrelated');
      expect(printed).toHaveLength(2);
      expect(recorded.map((e) => e.message)).toEqual(['boom']);
      stop();
      console.error('ERROR', new Error('after'));
      expect(recorded).toHaveLength(1);
    } finally {
      console.error = original;
    }
  });

  it('keeps the last errors until the devframe server takes them', () => {
    for (let i = 0; i < 25; i++) recordServerError({ kind: 'vite', message: `e${i}` });
    const taken: string[] = [];
    const stop = takeServerErrors((error) => taken.push(error.message));
    expect(taken).toHaveLength(20);
    expect(taken[0]).toBe('e5');
    recordServerError({ kind: 'ssr', message: 'live' });
    expect(taken.at(-1)).toBe('live');
    stop();
    recordServerError({ kind: 'ssr', message: 'kept' });
    expect(serverErrorsRegistry().pending.map((e) => e.message)).toEqual(['kept']);
  });
});

describe('server errors state', () => {
  const empty = (): ServerErrorsState => ({ errors: [], dropped: 0 });
  let n = 0;
  const id = () => `s${++n}`;

  it('groups repeats, moves them first and masks secrets', () => {
    const state = empty();
    mergeServerError(state, { kind: 'ssr', message: `Bad token ${JWT}`, url: '/a', at: 1 }, id);
    mergeServerError(state, { kind: 'vite', message: 'Syntax error', file: '/x.ts', at: 2 }, id);
    mergeServerError(state, { kind: 'ssr', message: `Bad token ${JWT}`, url: '/a', at: 3 }, id);
    expect(state.errors.map((g) => [g.kind, g.count, g.lastAt])).toEqual([
      ['ssr', 2, 3],
      ['vite', 1, 2],
    ]);
    expect(state.errors[0]!.message).not.toContain(JWT);
    expect(state.errors[0]!.firstAt).toBe(1);
  });

  it('reads the Angular code, drops the oldest groups at the cap and expires stale ones', () => {
    const state = empty();
    for (let i = 0; i <= MAX_SERVER_ERRORS; i++) {
      mergeServerError(state, { kind: 'vite', message: `e${i}`, at: i }, id);
    }
    expect(state.errors).toHaveLength(MAX_SERVER_ERRORS);
    expect(state.dropped).toBe(1);
    mergeServerError(
      state,
      { kind: 'ssr', message: 'NG0100: changed', at: SERVER_ERROR_TTL_MS },
      id,
    );
    expect(state.errors[0]!.code).toBe('NG0100');
    const stale = staleServerErrors(state, SERVER_ERROR_TTL_MS + 50);
    expect(stale).toContain(state.errors.at(-1)!.id);
    expect(stale).not.toContain(state.errors[0]!.id);
  });

  it('lists groups and shows one with its frame and stack', () => {
    const state = empty();
    mergeServerError(
      state,
      {
        kind: 'vite',
        message: 'Unexpected token',
        file: '/src/app.ts',
        line: 3,
        column: 7,
        plugin: 'vite:esbuild',
        frame: '3 | let = 1',
        stack: 'at transform',
        at: Date.now(),
      },
      () => 'v1',
    );
    const list = listServerErrorsText(state);
    expect(list).toContain('`v1`');
    expect(list).toContain('`/src/app.ts:3:7`');
    expect(listServerErrorsText(state, { kind: 'ssr' })).toMatch(/^No SSR errors/);
    const one = listServerErrorsText(state, { id: 'v1' });
    expect(one).toContain('3 | let = 1');
    expect(one).toContain('at transform');
    expect(listServerErrorsText(state, { id: 'nope' })).toMatch(/No server error with the id/);
  });
});

async function boot(definition = pangular) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await definition.setup(ctx as never);
  const call = (name: string) =>
    (ctx.rpc.invokeLocal as (name: string) => Promise<unknown>)(`pangular:${name}`);
  const invoke = async (tool: string, args: Record<string, unknown> = {}) =>
    await answerText(ctx.agent.invoke(`pangular:${tool}`, args));
  const state = async () =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: { get: (key: string) => Promise<{ value: () => ServerErrorsState }> };
        }
      ).sharedState.get('pangular:server-errors')
    ).value();
  return { ctx, call, invoke, state };
}

describe('server errors on the devframe server', () => {
  it('takes captured errors into shared state, lists and clears them', async () => {
    recordServerError({ kind: 'vite', message: 'Before the server started' });
    const { invoke, state, call } = await boot();
    recordServerError({ kind: 'ssr', message: 'During a render', url: '/trips' });
    expect((await state()).errors.map((g) => g.message)).toEqual([
      'During a render',
      'Before the server started',
    ]);
    expect(await invoke('list-server-errors')).toContain('During a render');
    await call('clear-server-errors');
    expect((await state()).errors).toEqual([]);
  });

  it('is a read tool that disappears with the errors inspector', async () => {
    const off = await boot(createPangular({ inspectors: { errors: false } }));
    expect(off.ctx.agent.list().tools.map((t) => t.id)).not.toContain(
      'pangular:list-server-errors',
    );
    await expect(off.call('clear-server-errors')).rejects.toThrow();
    // With the inspector off nothing takes the errors, so they wait.
    recordServerError({ kind: 'vite', message: 'waiting' });
    expect(serverErrorsRegistry().pending.some((e) => e.message === 'waiting')).toBe(true);
    const { ctx } = await boot();
    const tool = ctx.agent.list().tools.find((t) => t.id === 'pangular:list-server-errors');
    expect(tool?.safety).toBe('read');
  });
});
