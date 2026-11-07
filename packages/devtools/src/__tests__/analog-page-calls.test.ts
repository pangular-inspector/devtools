import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCalls, recordCall, recentCalls, type AnalogCall } from '../analog-server-log.ts';
import { beginRender, clearRenders } from '../analog-call-pages.ts';
import { registerAnalog, stopAnalog } from '../rpc/analog-register.ts';
import { resetScanVersion, viteScanWatcher } from '../rpc/analog-scan-cache.ts';
import type { AnalogState } from '../rpc/analog-tools.ts';
import type { AnalogRuntimeReport } from '../analog-runtime.ts';
import { BASE_FILES, makeProject } from './analog-fixture.ts';

const scans = vi.hoisted(() => ({ count: 0 }));
vi.mock('../rpc/analog-scan.ts', async (original) => {
  const actual = await original<typeof import('../rpc/analog-scan.ts')>();
  return {
    ...actual,
    scanAnalog: (cwd: string) => {
      scans.count++;
      return actual.scanAnalog(cwd);
    },
  };
});

type AnyRecord = Record<string, any>;

async function boot(cwd: string, ttl = () => 30_000) {
  let value: AnalogState;
  const handlers = new Map<string, (arg: unknown) => unknown>();
  const tools = new Map<string, (args: AnyRecord) => Promise<{ markdown: string }>>();
  const my = {
    rpc: {
      register: (d: AnyRecord) => handlers.set(d['name'], d['handler']),
      sharedState: async (_name: string, options: AnyRecord) => {
        value = structuredClone(options['initialValue']);
        return {
          value: () => value,
          mutate: (fn: (draft: AnalogState) => void) => fn(value),
        };
      },
    },
  };
  const ctx = {
    cwd,
    agent: { registerTool: (t: AnyRecord) => tools.set(t['id'], t['handler']) },
  };
  await registerAnalog(my, ctx, { ttl });
  return {
    state: () => value,
    rpc: (name: string, arg?: unknown) => handlers.get(name)!(arg),
    tool: async (id: string, args: AnyRecord = {}) =>
      (await tools.get(`pangular:${id}`)!(args)).markdown,
  };
}

const report = (pageId: string, extra: Partial<AnalogRuntimeReport> = {}): AnalogRuntimeReport => ({
  pageId,
  url: '/products/1',
  analog: true,
  chain: [{ path: '/products/:id', file: '/src/app/pages/products/[id].page.ts' }],
  hydrated: 0,
  transferState: false,
  hydrationErrors: [],
  configPaths: ['/'],
  ...extra,
});

const call = (fields: Partial<AnalogCall>) =>
  recordCall({
    at: Date.now(),
    kind: 'load',
    method: 'GET',
    url: '/api/_analog/pages/products/1',
    route: '/products/1',
    status: 200,
    ms: 1,
    from: 'browser',
    ...fields,
  });

beforeEach(() => {
  clearCalls();
  clearRenders();
  resetScanVersion();
  scans.count = 0;
});

afterEach(() => {
  stopAnalog();
  resetScanVersion();
  vi.useRealTimers();
});

describe('Analog server calls per tab', () => {
  it('ties a render and its calls to the page that reports the render id', async () => {
    const { rpc, state } = await boot(makeProject(BASE_FILES));
    const renderId = beginRender();
    call({ kind: 'page', url: '/products/1', from: 'browser', renderId });
    call({ from: 'ssr', renderId });
    rpc('push-analog', report('pg1', { renderId }));
    expect(state().calls.map((c) => c.pageId)).toEqual(['pg1', 'pg1']);
  });

  it("lists one tab's calls with `page`, and every call without it", async () => {
    const { rpc, tool } = await boot(makeProject(BASE_FILES));
    rpc('push-analog', report('pg1'));
    rpc('push-analog', report('pg2'));
    call({ url: '/api/_analog/pages/one', pageId: 'pg1' });
    call({ url: '/api/_analog/pages/two', pageId: 'pg2' });
    call({ url: '/api/_analog/pages/untagged' });

    const one = await tool('analog-list-server-calls', { page: 'pg1' });
    expect(one).toContain('/api/_analog/pages/one');
    expect(one).not.toContain('/two');
    expect(one).not.toContain('/untagged');

    const all = await tool('analog-list-server-calls');
    expect(all).toContain('/two');
    expect(all).toContain('/untagged');
    expect(all).toContain('page `pg1`');

    expect(await tool('analog-list-server-calls', { page: 'nope' })).toContain(
      'No page `nope` is reporting Analog data',
    );
  });

  it('says when a tab has no calls of its own yet', async () => {
    const { rpc, tool } = await boot(makeProject(BASE_FILES));
    rpc('push-analog', report('pg1'));
    call({ url: '/api/_analog/pages/untagged' });
    expect(await tool('analog-list-server-calls', { page: 'pg1' })).toContain(
      'No server call recorded for page `pg1` yet',
    );
  });

  it("drops a page's calls when the page leaves", async () => {
    const { rpc, state } = await boot(makeProject(BASE_FILES));
    rpc('push-analog', report('pg1'));
    call({ url: '/a', pageId: 'pg1' });
    call({ url: '/b' });
    rpc('forget-analog-page', 'pg1');
    expect(state().calls.map((c) => c.url)).toEqual(['/b']);
  });

  it('expires calls tagged with a page that stopped reporting', async () => {
    vi.useFakeTimers();
    const { rpc } = await boot(makeProject(BASE_FILES), () => 30_000);
    rpc('push-analog', report('pg1'));
    call({ url: '/a', pageId: 'pg1' });
    // Tagged by its header, from a page that never sent an Analog report.
    call({ url: '/b', pageId: 'pg9' });
    call({ url: '/c' });
    vi.advanceTimersByTime(35_000);
    expect(recentCalls().map((c) => c.url)).toEqual(['/c']);
  });
});

describe('the Analog source scan', () => {
  it('is not run again on pushes while no file changes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { rpc } = await boot(makeProject(BASE_FILES));
    rpc('push-analog', report('pg1'));
    const after = scans.count;
    for (let i = 0; i < 5; i++) {
      vi.setSystemTime(Date.now() + 5000);
      rpc('push-analog', report('pg1', { hydrated: i }));
    }
    expect(scans.count).toBe(after);
  });

  it('rescans after the Vite watcher sees a change, without holding up the push', async () => {
    const root = makeProject(BASE_FILES);
    const onChange = viteScanWatcher();
    const { rpc, tool } = await boot(root);
    rpc('push-analog', report('pg1'));
    const before = scans.count;

    writeFileSync(
      join(root, 'src/app/pages/team.page.ts'),
      BASE_FILES['src/app/pages/index.page.ts'],
    );
    onChange('add', join(root, 'src/app/pages/team.page.ts'));
    rpc('push-analog', report('pg1', { hydrated: 1 }));
    // The push took the last scan; the rescan runs on a later tick.
    expect(scans.count).toBe(before);
    await new Promise((resolve) => setImmediate(resolve));
    expect(scans.count).toBe(before + 1);
    expect(await tool('analog-scan-routes')).toContain('team.page.ts');
    expect(scans.count).toBe(before + 1);
  });

  it('rescans after a file changes on disk when no Vite watcher runs', async () => {
    const root = makeProject(BASE_FILES);
    const { rpc, tool } = await boot(root);
    rpc('push-analog', report('pg1'));
    expect(await tool('analog-scan-routes')).not.toContain('team.page.ts');
    writeFileSync(
      join(root, 'src/app/pages/team.page.ts'),
      BASE_FILES['src/app/pages/index.page.ts'],
    );
    await vi.waitFor(
      async () => expect(await tool('analog-scan-routes')).toContain('team.page.ts'),
      {
        timeout: 3000,
        interval: 50,
      },
    );
  });
});
