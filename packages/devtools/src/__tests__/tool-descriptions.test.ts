import { createHostContext } from 'devframe/node';
import { expect, it } from 'vitest';
import { createPangular } from '../devframe.ts';

it('keeps all agent tool and resource descriptions under 300 characters', async () => {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  // The library tools are on too, so their descriptions are checked as well.
  await createPangular({
    inspectors: { analog: true, capacitor: true, tanstackQuery: true },
  }).setup(ctx as never);
  const { tools, resources } = ctx.agent.list();

  const oversizedTools: { id: string; len: number }[] = [];
  for (const tool of tools) {
    if (tool.description.length > 300) {
      oversizedTools.push({ id: tool.id, len: tool.description.length });
    }
    expect(
      tool.description.length,
      `Tool "${tool.id}" description is too short (${tool.description.length} chars)`,
    ).toBeGreaterThanOrEqual(40);
  }

  const oversizedResources: { id: string; len: number }[] = [];
  for (const resource of resources) {
    const desc = resource.description ?? '';
    if (desc.length > 300) {
      oversizedResources.push({ id: resource.id, len: desc.length });
    }
    expect(
      desc.length,
      `Resource "${resource.id}" description is too short (${desc.length} chars)`,
    ).toBeGreaterThanOrEqual(40);
  }

  expect(
    oversizedTools,
    `Found tools with description > 300 chars: ${JSON.stringify(oversizedTools)}`,
  ).toEqual([]);

  expect(
    oversizedResources,
    `Found resources with description > 300 chars: ${JSON.stringify(oversizedResources)}`,
  ).toEqual([]);
});
