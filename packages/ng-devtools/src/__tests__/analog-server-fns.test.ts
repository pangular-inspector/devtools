// @vitest-environment jsdom
import { EventEmitter } from 'node:events';
import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it } from 'vitest';
import ngDevtools from '../devframe.ts';
import {
  analogMiddleware,
  clearCalls,
  recentCalls,
  recordCall,
  refetchedServerFns,
  type AnalogCall,
} from '../analog-server-log.ts';
import { decodePayload, sanitizePayload } from '../http-payload.ts';
import { lintAnalog, scanAnalog, serverFnId, serverFnsOf } from '../rpc/analog-scan.ts';
import { nameServerFns } from '../rpc/analog-register.ts';
import { BASE_FILES, makeProject } from './analog-fixture.ts';

const USERS = `import { serverFn } from '@analogjs/router/server';
import * as v from 'valibot';

export const getUsers = serverFn(async () => [{ id: 1 }]);
export const addUser = serverFn(v.object({ name: v.string() }), async (input) => input);
export const removeUser = serverFn({ method: 'DELETE' }, async () => null);
export const findUser = serverFn({ input: v.string() }, async (id) => id);
export const helper = 1;
`;

const FN_FILES: Record<string, string> = {
  'src/app/users/users.server.ts': USERS,
  'src/app/pages/products/[id].server.ts': `import { serverFn as fn } from '@analogjs/router/server';
export const productName = fn(() => 'Chair');
`,
  'src/app/pages/reports.server.ts': `import { serverFn } from '@analogjs/router/server';
export const report = serverFn(() => ({}));
`,
  'src/main.server.ts': `import { serverFn } from '@analogjs/router/server';
export const notAHost = serverFn(() => 1);
`,
  'src/app/app.config.server.ts': `import { serverFn } from '@analogjs/router/server';
export const skipped = serverFn(() => 1);
`,
};

class FakeRes extends EventEmitter {
  statusCode = 200;
  getHeader() {
    return undefined;
  }
  write(_chunk: unknown) {
    return true;
  }
  end() {
    this.emit('finish');
    return this;
  }
}

afterEach(() => clearCalls());

describe('Analog server functions', () => {
  it('derives the same ids as Analog and reads each export method', () => {
    expect(serverFnId('/src/app/users/users.server.ts', 'getUser')).toBe('df288e37493fb8da');
    const fns = serverFnsOf('/src/app/users/users.server.ts', USERS);
    expect(fns.map((f) => `${f.method} ${f.name}`)).toEqual([
      'GET getUsers',
      'POST addUser',
      'DELETE removeUser',
      'POST findUser',
    ]);
    expect(fns[0].id).toBe(serverFnId('/src/app/users/users.server.ts', 'getUsers'));
    expect(serverFnsOf('/a.server.ts', 'export const load = async () => ({});')).toEqual([]);
  });

  it('scans every .server.ts under src and stops false lint warnings for them', () => {
    const project = scanAnalog(makeProject(BASE_FILES, FN_FILES));
    expect(project.serverFns.map((f) => `${f.name} ${f.file}`).sort()).toEqual([
      'addUser /src/app/users/users.server.ts',
      'findUser /src/app/users/users.server.ts',
      'getUsers /src/app/users/users.server.ts',
      'productName /src/app/pages/products/[id].server.ts',
      'removeUser /src/app/users/users.server.ts',
      'report /src/app/pages/reports.server.ts',
    ]);
    const product = makeProject(BASE_FILES, FN_FILES, {
      'src/app/pages/products/[id].server.ts': FN_FILES['src/app/pages/products/[id].server.ts'],
    });
    const rules = lintAnalog(scanAnalog(product)).map((f) => `${f.rule} ${f.file}`);
    expect(rules).not.toContain('server-without-load /src/app/pages/products/[id].server.ts');
    expect(rules).not.toContain('orphan-server-file /src/app/pages/reports.server.ts');
    const ghost = makeProject(BASE_FILES, {
      'src/app/pages/ghost.server.ts': `import { serverFn } from '@analogjs/router/server';
export const load = async () => ({});
export const ping = serverFn(() => 1);
`,
    });
    expect(lintAnalog(scanAnalog(ghost)).map((f) => f.rule)).toContain('orphan-server-file');
  });

  it('records server functions seeded while rendering a page, before the page itself', () => {
    const id = 'df288e37493fb8da';
    const req = {
      url: '/users',
      method: 'GET',
      headers: { accept: 'text/html', 'user-agent': 'Mozilla' },
    } as never;
    const res = new FakeRes();
    analogMiddleware('api')(req, res as never, () => {});
    res.write(
      '<app-root ng-server-context="ssr-analog"></app-root><script id="ng-state">{"__analog_f',
    );
    res.write(`n_${id}__":[1],"__analog_fn_${id}_{\\"a\\":1}":2}</script>`);
    res.end();
    const calls = recentCalls();
    expect(calls.map((c) => `${c.kind} ${c.from} ${c.route}`)).toEqual([
      `fn ssr ${id}`,
      'page browser /users',
    ]);
    expect(calls[0]).toMatchObject({ seeded: true, method: 'SSR', url: `/_analog/fn/${id}` });
  });

  it('flags a seeded read called again in the browser right after hydration', () => {
    const base = { method: 'GET', url: '', status: 200, ms: 1 };
    const fn = { ...base, kind: 'fn' as const };
    const page = { ...base, kind: 'page' as const, from: 'browser' as const };
    const list: AnalogCall[] = [
      { ...fn, id: 1, at: 1000, route: 'a', from: 'ssr', seeded: true },
      { ...fn, id: 2, at: 1000, route: 'b', from: 'ssr', seeded: true },
      { ...page, id: 3, at: 1000, route: '/users', render: 'ssr' },
      { ...fn, id: 4, at: 1300, route: 'a', from: 'browser' },
      { ...fn, id: 5, at: 1400, route: 'a', from: 'browser' },
      { ...fn, id: 6, at: 20_000, route: 'b', from: 'browser' },
      { ...fn, id: 7, at: 30_000, route: 'c', from: 'ssr', seeded: true },
      { ...page, id: 8, at: 30_000, route: '/c', render: 'client' },
      { ...fn, id: 9, at: 30_100, route: 'c', from: 'browser' },
    ];
    expect(refetchedServerFns(list)).toEqual([{ id: 'a', ssrAt: 1000, browserAt: 1300 }]);
  });

  it('labels seeded payload entries and names them from the scan', async () => {
    const script = document.createElement('script');
    script.id = 'ng-state';
    script.type = 'application/json';
    const id = serverFnId('/src/app/users/users.server.ts', 'getUsers');
    script.textContent = JSON.stringify({ [`__analog_fn_${id}__`]: [{ id: 1 }], other: 1 });
    document.body.append(script);
    const payload = sanitizePayload(decodePayload(document));
    script.remove();
    expect(payload.entries[0]).toMatchObject({ source: 'analog', fn: { id } });
    expect(payload.entries[1].fn).toBeUndefined();
    expect(sanitizePayload({ entries: [{ key: 'x', fn: { id: 'nope' } }] }).entries[0].fn).toBe(
      undefined,
    );

    const cwd = makeProject(BASE_FILES, FN_FILES);
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd, mode: 'dev', host: host as never });
    await ngDevtools.setup(ctx as never);
    expect(nameServerFns(payload).entries[0].fn).toEqual({
      id,
      name: 'getUsers',
      file: '/src/app/users/users.server.ts',
    });
    const call = async (tool: string, args: Record<string, unknown> = {}) =>
      ((await ctx.agent.invoke(`ng-devtools:${tool}`, args)) as { markdown: string }).markdown;
    recordCall({
      at: 1000,
      kind: 'fn',
      method: 'SSR',
      url: `/_analog/fn/${id}`,
      route: id,
      status: 200,
      ms: 0,
      from: 'ssr',
      seeded: true,
    });
    recordCall({
      at: 1000,
      kind: 'page',
      method: 'GET',
      url: '/users',
      route: '/users',
      status: 200,
      ms: 9,
      from: 'browser',
      render: 'ssr',
    });
    recordCall({
      at: 1200,
      kind: 'fn',
      method: 'GET',
      url: `/_analog/fn/${id}`,
      route: id,
      status: 200,
      ms: 4,
      from: 'browser',
    });
    const fns = await call('analog-server-functions');
    expect(fns).toContain(
      `- GET getUsers \`/src/app/users/users.server.ts\` id \`${id}\`; seen 1 HTTP call(s), 1 during server rendering; called again in the browser right after hydration`,
    );
    expect(fns).toContain('- DELETE removeUser');
    const calls = await call('analog-server-calls', { route: 'getUsers' });
    expect(calls).toContain(
      'fn getUsers (`/src/app/users/users.server.ts`) ran in-process during server rendering',
    );
    expect(calls).toContain(
      `fn getUsers (\`/src/app/users/users.server.ts\`) GET \`/_analog/fn/${id}\` 200 in 4ms (browser)`,
    );
    expect(calls).toContain('Server functions seeded during server rendering and called again');
    expect(await call('analog-lint')).toContain('fn-fetched-twice');
  });
});
