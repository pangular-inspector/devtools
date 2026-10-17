import { createHostContext } from 'devframe/node';
import { beforeEach, describe, expect, it } from 'vitest';
import pangular, { createPangular } from '../devframe.ts';
import { agentToolOffered, resolvePangularConfig, type PangularConfig } from '../config.ts';
import { clearCalls, recordCall, recentCalls } from '../analog-server-log.ts';
import { answerText, toolAnswer } from './tool-answer.ts';

async function boot(options?: PangularConfig) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await (options ? createPangular(options) : pangular).setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const call = async (tool: string, args: Record<string, unknown> = {}) =>
    await answerText(ctx.agent.invoke(`pangular:${tool}`, args));
  const answer = (tool: string, args: Record<string, unknown> = {}) =>
    toolAnswer(ctx.agent.invoke(`pangular:${tool}`, args));
  const manifest = ctx.agent.list();
  const tools = manifest.tools.map((t) => t.id.replace(/^pangular:/, ''));
  const targets = () => {
    const tool = manifest.tools.find((t) => t.id === 'pangular:clear-recordings');
    return (tool?.inputSchema as { properties: { target: { enum: string[] } } } | undefined)
      ?.properties.target.enum;
  };
  return { ctx, push, call, answer, tools, targets };
}

function routerReport(pageId: string, navigations: unknown[] = []) {
  return {
    pageId,
    generation: 1,
    snapshot: {
      url: '/',
      queryParams: {},
      fragment: null,
      root: { path: '', url: '', outlet: 'primary', params: {}, data: {}, children: [] },
    },
    navigations,
  };
}

function httpReport(pageId: string, calls: unknown[] = []) {
  return {
    pageId,
    url: 'http://localhost:4200/',
    payload: { entries: [] },
    calls,
  };
}

describe('clear-recordings agent tool', () => {
  beforeEach(() => {
    clearCalls();
  });

  it('rejects missing or invalid target arguments with isError', async () => {
    const { answer } = await boot();
    const missing = await answer('clear-recordings', {});
    expect(missing.isError).toBe(true);
    expect(missing.markdown).toMatch(/^Pass `target`/);
    const invalid = await answer('clear-recordings', { target: 'invalid' });
    expect(invalid.isError).toBe(true);
    expect(invalid.markdown).toContain(
      '`target` must be one of `http`, `router`, `analog`, `all`, not a string ("invalid").',
    );
  });

  it('never clears every page for a page that is not a string', async () => {
    const { push, answer } = await boot();
    await push('push-router', routerReport('p1'));
    const result = await answer('clear-recordings', { target: 'all', page: 12345 });
    expect(result.isError).toBe(true);
    expect(result.markdown).toMatch(/^`page` must be a string, not the number \(12345\)\./);
    expect(result.markdown).not.toContain('Cleared');
  });

  it('clears recorded HTTP calls when target is http', async () => {
    const { push, call } = await boot();
    await push(
      'push-http',
      httpReport('page-1', [
        {
          id: 'call-1',
          url: '/api/data',
          method: 'GET',
          status: 200,
          durationMs: 12,
          side: 'client',
        },
      ]),
    );

    const before = await call('list-http-calls');
    expect(before).toContain('/api/data');

    const result = await call('clear-recordings', { target: 'http' });
    expect(result).toBe('Cleared recorded HTTP calls.');

    const after = await call('list-http-calls');
    expect(after).not.toContain('/api/data');
    expect(after).toContain('No HttpClient calls recorded');
  });

  it('clears router navigations across all pages when target is router without page', async () => {
    const { push, call } = await boot();
    const nav1 = {
      id: 1,
      url: '/home',
      trigger: 'imperative',
      startedAt: 1000,
      endedAt: 1020,
      outcome: 'succeeded',
    };
    const nav2 = {
      id: 2,
      url: '/about',
      trigger: 'imperative',
      startedAt: 1030,
      endedAt: 1050,
      outcome: 'succeeded',
    };

    await push('push-router', routerReport('page-1', [nav1]));
    await push('push-router', routerReport('page-2', [nav2]));

    const beforeP1 = await call('explain-navigation', { page: 'page-1' });
    expect(beforeP1).toContain('/home');

    const result = await call('clear-recordings', { target: 'router' });
    expect(result).toBe('Cleared router navigations.');

    const afterP1 = await call('explain-navigation', { page: 'page-1' });
    expect(afterP1).not.toContain('/home');
    expect(afterP1).toContain('No navigations recorded');
  });

  it('clears router navigations for a specific page when page argument is provided', async () => {
    const { push, call } = await boot();
    await push(
      'push-router',
      routerReport('page-1', [
        {
          id: 1,
          url: '/page1-nav',
          trigger: 'imperative',
          startedAt: 1000,
          endedAt: 1020,
          outcome: 'succeeded',
        },
      ]),
    );
    await push(
      'push-router',
      routerReport('page-2', [
        {
          id: 2,
          url: '/page2-nav',
          trigger: 'imperative',
          startedAt: 1030,
          endedAt: 1050,
          outcome: 'succeeded',
        },
      ]),
    );

    const result = await call('clear-recordings', { target: 'router', page: 'page-1' });
    expect(result).toBe('Cleared router navigations for page "page-1".');

    const afterP1 = await call('explain-navigation', { page: 'page-1' });
    expect(afterP1).toContain('No navigations recorded');

    const afterP2 = await call('explain-navigation', { page: 'page-2' });
    expect(afterP2).toContain('/page2-nav');
  });

  it('clears Analog server calls when target is analog', async () => {
    const { call } = await boot();
    recordCall({
      at: Date.now(),
      kind: 'api',
      method: 'GET',
      url: '/api/users',
      status: 200,
      ms: 15,
      from: 'browser',
    });
    expect(recentCalls().length).toBe(1);

    const result = await call('clear-recordings', { target: 'analog' });
    expect(result).toBe('Cleared Analog server calls.');
    expect(recentCalls().length).toBe(0);
  });

  it('clears all targets when target is all', async () => {
    const { push, call } = await boot();
    await push(
      'push-http',
      httpReport('page-1', [
        {
          id: 'call-all',
          url: '/api/test',
          method: 'GET',
          status: 200,
          durationMs: 10,
          side: 'client',
        },
      ]),
    );
    await push(
      'push-router',
      routerReport('page-1', [
        {
          id: 1,
          url: '/nav-all',
          trigger: 'imperative',
          startedAt: 1000,
          endedAt: 1020,
          outcome: 'succeeded',
        },
      ]),
    );
    recordCall({
      at: Date.now(),
      kind: 'api',
      method: 'GET',
      url: '/api/all',
      status: 200,
      ms: 5,
      from: 'browser',
    });

    const result = await call('clear-recordings', { target: 'all' });
    expect(result).toBe('Cleared recorded HTTP calls, router navigations, Analog server calls.');

    const httpAfter = await call('list-http-calls');
    expect(httpAfter).toContain('No HttpClient calls recorded');
    expect(recentCalls().length).toBe(0);
  });

  it('offers only the targets whose action is on, and refuses the others', async () => {
    const httpBlocked = await boot({ actions: { http: false } });
    expect(httpBlocked.targets()).toEqual(['router', 'analog', 'all']);
    const http = await httpBlocked.answer('clear-recordings', { target: 'http' });
    expect(http.isError).toBe(true);
    expect(http.markdown).toContain('`target` must be one of `router`, `analog`, `all`');

    const routerBlocked = await boot({ actions: { router: false } });
    expect(routerBlocked.targets()).toEqual(['http', 'analog', 'all']);
    expect((await routerBlocked.answer('clear-recordings', { target: 'router' })).isError).toBe(
      true,
    );

    const analogBlocked = await boot({ actions: { analog: false } });
    expect(analogBlocked.targets()).toEqual(['http', 'router', 'all']);
    expect((await analogBlocked.answer('clear-recordings', { target: 'analog' })).isError).toBe(
      true,
    );
  });

  it('is offered exactly when agentToolOffered says so', async () => {
    const configs: PangularConfig[] = [
      {},
      { inspectors: { http: false } },
      { inspectors: { http: false, router: false } },
      { inspectors: { http: false, router: false, analog: false } },
      { actions: { http: false, router: false } },
      { agent: { tools: { http: false } } },
      { agent: { readOnly: true } },
    ];
    for (const config of configs) {
      const { tools } = await boot(config);
      expect(tools.includes('clear-recordings'), JSON.stringify(config)).toBe(
        agentToolOffered('clear-recordings', resolvePangularConfig(config)),
      );
    }
  });

  it('partially skips disabled targets and reports them when target is all', async () => {
    const { call } = await boot({ actions: { http: false, analog: false } });
    const result = await call('clear-recordings', { target: 'all' });
    expect(result).toContain('Cleared router navigations.');
    expect(result).toContain(
      'Skipped: HTTP calls (actions.http is turned off), Analog calls (actions.analog is turned off).',
    );
  });

  it('drops clear-recordings in read-only mode', async () => {
    const { tools } = await boot({ agent: { readOnly: true } });
    expect(tools).not.toContain('clear-recordings');
  });

  it('drops clear-recordings when all related inspectors are turned off', async () => {
    const { tools } = await boot({
      agent: { tools: { http: false, router: false, analog: false } },
    });
    expect(tools).not.toContain('clear-recordings');
  });

  it('drops clear-recordings when no target has both actions and agent tools enabled', async () => {
    const { tools } = await boot({
      actions: { http: true, router: false, analog: false },
      agent: { tools: { http: false, router: true, analog: true } },
    });
    expect(tools).not.toContain('clear-recordings');
  });

  it('blocks target when agent.tools is false even if action is true', async () => {
    const { answer, targets } = await boot({
      actions: { http: true, router: true },
      agent: { tools: { http: false, router: true } },
    });
    expect(targets()).not.toContain('http');
    const result = await answer('clear-recordings', { target: 'http' });
    expect(result.isError).toBe(true);
    expect(result.markdown).toMatch(/^`target` must be one of `router`/);
  });

  it('returns unknown page text when requested router page is absent', async () => {
    const { call } = await boot();
    const result = await call('clear-recordings', { target: 'router', page: 'missing-page-id' });
    expect(result).toContain('No page `missing-page-id` is reporting a router report.');
  });

  it('validates router page upfront and preserves other recordings when target is all and page is unknown', async () => {
    const { push, call } = await boot();
    await push(
      'push-http',
      httpReport('page-1', [
        {
          id: 'call-keep',
          url: '/api/preserve',
          method: 'GET',
          status: 200,
          durationMs: 10,
          side: 'client',
        },
      ]),
    );

    const result = await call('clear-recordings', { target: 'all', page: 'non-existent-page' });
    expect(result).toContain('No page `non-existent-page` is reporting a router report.');

    // HTTP calls must not have been cleared
    const httpList = await call('list-http-calls');
    expect(httpList).toContain('/api/preserve');
  });
});
