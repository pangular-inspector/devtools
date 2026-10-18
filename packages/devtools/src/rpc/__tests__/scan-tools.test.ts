import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import { createPangular } from '../../devframe.ts';
import type { PangularConfig } from '../../config.ts';
import { SCAN_TOOLS } from '../scan-tools.ts';

async function boot(config: PangularConfig = {}) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await createPangular(config).setup(ctx as never);
  const definitions = (ctx.rpc as unknown as { definitions: Map<string, { agent?: unknown }> })
    .definitions;
  return { ctx, definitions };
}

describe('source scan agent tools', () => {
  it('registers a scan-* tool per scan and keeps the panel RPC functions without an agent tool', async () => {
    const { ctx, definitions } = await boot();
    const ids = ctx.agent.list().tools.map((tool) => tool.id);
    for (const spec of SCAN_TOOLS) expect(ids).toContain(spec.id);
    for (const name of ['get-routes', 'get-components', 'get-signals', 'build-meta']) {
      expect(definitions.get(`pangular:${name}`), name).toBeDefined();
      expect(definitions.get(`pangular:${name}`)?.agent, name).toBeUndefined();
      expect(ids).not.toContain(`pangular:${name}`);
    }
  });

  it('answers compact JSON, the same data the panel RPC returns', async () => {
    const { ctx } = await boot();
    const text = (await ctx.agent.invoke('pangular:scan-build', {})) as string;
    expect(typeof text).toBe('string');
    expect(text).not.toContain('\n');
    const rpc = (await ctx.rpc.invokeLocal(
      'pangular:build-meta' as never,
      ...([] as never),
    )) as Record<string, unknown>;
    const scanned = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(scanned).sort()).toEqual(Object.keys(rpc).sort());
    expect(scanned['angularVersion']).toBe(rpc['angularVersion']);
    expect(scanned['projectName']).toBe(rpc['projectName']);
  });

  it('follows the inspector of each scan', async () => {
    const { ctx } = await boot({ inspectors: { router: false, ngrx: false } });
    const ids = ctx.agent.list().tools.map((tool) => tool.id);
    expect(ids).not.toContain('pangular:scan-routes');
    expect(ids).not.toContain('pangular:ngrx-scan');
    expect(ids).toContain('pangular:scan-components');
    // scan-build belongs to no inspector, so it stays.
    expect(ids).toContain('pangular:scan-build');
  });
});
