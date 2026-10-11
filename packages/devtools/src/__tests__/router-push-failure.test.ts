import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';
import type { RouterState } from '../rpc/router-tools.ts';

const failFor = new Set<string>();

vi.mock('../rpc/router-tools.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../rpc/router-tools.ts')>();
  return {
    ...actual,
    mergeRouterReport: (...args: Parameters<typeof actual.mergeRouterReport>) => {
      const [pages, report] = args;
      if (failFor.has(report.pageId)) {
        pages.set(report.pageId, { ...pages.get(report.pageId)!, ...report } as never);
        throw new Error('bad report');
      }
      return actual.mergeRouterReport(...args);
    },
  };
});

async function boot() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await pangular.setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const router = async () =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: { get: (key: string) => Promise<{ value: () => RouterState }> };
        }
      ).sharedState.get('pangular:router')
    ).value();
  return { push, router };
}

const report = (pageId: string) => ({
  pageId,
  generation: 1,
  snapshot: null,
  navigations: [],
});

describe('push-router when a report cannot be merged', () => {
  it('drops the page from the shared router state too', async () => {
    const { push, router } = await boot();
    await push('push-router', report('p1'));
    await push('push-router', report('p2'));
    expect((await router()).pages.map((p) => p.pageId).sort()).toEqual(['p1', 'p2']);

    failFor.add('p1');
    expect(await push('push-router', report('p1'))).toEqual({ hasConfig: false });
    expect((await router()).pages.map((p) => p.pageId)).toEqual(['p2']);
  });
});
