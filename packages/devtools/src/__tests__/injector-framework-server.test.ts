import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';
import type { InjectorPage, InjectorTreeNode } from '../types.ts';
import { answerText } from './tool-answer.ts';

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
  const call = async (tool: string, args: Record<string, unknown>) =>
    await answerText(ctx.agent.invoke(`pangular:${tool}`, args));
  const pages = async () =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: {
            get: (key: string) => Promise<{ value: () => { pages: Record<string, InjectorPage> } }>;
          };
        }
      ).sharedState.get('pangular:injector-tree')
    ).value().pages;
  return { push, call, pages };
}

const provider = (token: string, extra: Record<string, unknown> = {}) => ({
  token,
  type: 'class',
  isViewProvider: false,
  ...extra,
});

const report = (pageId: string) => ({
  pageId,
  roots: [
    {
      injector: {
        id: 'inj-1',
        type: 'element',
        name: 'app-root',
        providerCount: 0,
        component: 'App',
        componentId: 'cab-1',
        // A page can't mark anything as framework itself.
        framework: true,
      },
      providers: [],
      children: [
        {
          injector: {
            id: 'inj-2',
            type: 'element',
            name: 'router-outlet',
            providerCount: 0,
            directives: ['RouterOutlet'],
          },
          providers: [],
          children: [],
        },
      ],
    },
  ],
  environment: [
    {
      injector: { id: 'inj-3', type: 'environment', name: 'Platform', providerCount: 1 },
      providers: [provider('Console')],
      children: [
        {
          injector: { id: 'inj-4', type: 'environment', name: 'Root', providerCount: 2 },
          providers: [provider('ApplicationRef'), provider('TripStore', { framework: true })],
          children: [],
        },
      ],
    },
  ],
});

const flatten = (nodes: InjectorTreeNode[]): InjectorTreeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

describe('framework injectors on the server', () => {
  it('marks Angular injectors and providers in what the panel and agents read', async () => {
    const { push, pages } = await boot();
    await push('push-injector-tree', report('p1'));
    // The token names load in the background, then every stored page is marked again.
    const page = await vi.waitFor(
      async () => {
        const found = (await pages())['p1']!;
        const root = flatten(found.environment).find((n) => n.injector.name === 'Root')!;
        expect(root.providers[0]!.framework).toBe(true);
        return found;
      },
      { timeout: 10_000 },
    );
    const all = flatten([...page.roots, ...page.environment]);
    const byId = (id: string) => all.find((n) => n.injector.id === id)!;
    expect(byId('inj-1').injector.framework).toBeUndefined();
    expect(byId('inj-1').injector.componentId).toBe('cab-1');
    expect(byId('inj-2').injector.framework).toBe(true);
    expect(byId('inj-3').injector.framework).toBe(true);
    expect(byId('inj-4').injector.framework).toBeUndefined();
    expect(byId('inj-4').providers.map((p) => p.framework ?? false)).toEqual([true, false]);

    // A later push is marked straight away.
    await push('push-injector-tree', report('p2'));
    const second = (await pages())['p2']!;
    expect(flatten(second.environment)[0]!.injector.framework).toBe(true);
  });

  it("finds a component's element injector by its component id", async () => {
    const { push, call } = await boot();
    await push('push-injector-tree', report('p1'));
    const text = await call('inspect-providers', { selector: 'cab-1' });
    expect(text).toContain('matching `cab-1` (1)');
    expect(text).toContain('"componentId":"cab-1"');
  });
});
