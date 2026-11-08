// @vitest-environment jsdom
// Loads the example plugin package (`examples/pangular-plugin-example`) the
// way an app does: its page entry registers through the public registry, the
// overlay's plugins collector runs it, and its server entry adds agent tools
// to a real devframe. The page and server RPCs are wired to each other, so a
// tool call goes all the way to the page action and back.
import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolvePangularConfig, type PangularConfig } from '../config.ts';
import { createPangular } from '../devframe.ts';
import { pangularPluginRegistry } from '../plugin.ts';
import { attachPlugins, type PluginsReport } from '../plugins-collector.ts';
import type { PluginsState } from '../rpc/plugins-register.ts';
import { createFlagStore } from '../../../../examples/pangular-plugin-example/src/index.ts';
import {
  FLAGS_PLUGIN_ID,
  flagsView,
  registerFlagsPangularPlugin,
} from '../../../../examples/pangular-plugin-example/src/pangular.ts';
import { flagsServerPlugin } from '../../../../examples/pangular-plugin-example/src/pangular-server.ts';
import { answerText } from './tool-answer.ts';

type Handler = (...args: unknown[]) => unknown;

const store = () =>
  createFlagStore({
    'promo-banner': { default: false, description: 'Shows the promo banner.' },
    'blog-teaser': { default: true },
  });

async function server(config: PangularConfig = {}) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await createPangular(config, { serverPlugins: [flagsServerPlugin] }).setup(ctx as never);
  const call = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const invoke = (id: string, args: Record<string, unknown> = {}) =>
    answerText(ctx.agent.invoke(id, args));
  const sharedState = (
    ctx.rpc as unknown as {
      sharedState: { get: (key: string) => Promise<{ value: () => unknown }> };
    }
  ).sharedState;
  const state = async () => (await sharedState.get('pangular:plugins')).value() as PluginsState;
  return { ctx, call, invoke, state };
}

/** Starts the plugins collector for one page, with its RPC wired to the server. */
function page(
  pageId: string,
  backend: Awaited<ReturnType<typeof server>>,
  config: PangularConfig = {},
) {
  const handlers = new Map<string, Handler>();
  const pushes: PluginsReport[] = [];
  const calls: { name: string; payload: unknown }[] = [];
  const collector = attachPlugins(
    {
      rpc: {
        call: async (name: string, ...args: unknown[]) => {
          calls.push({ name, payload: args[0] });
          if (name === 'push-plugins') pushes.push(args[0] as PluginsReport);
          return backend.call(name, args[0]);
        },
        register: (definition: { name: string; handler: Handler }) => {
          handlers.set(definition.name, definition.handler);
        },
      },
    },
    pageId,
    () => undefined,
    { config: resolvePangularConfig(config) },
  );
  cleanups.push(() => collector.stop());
  // The server broadcasts page actions; this page answers the ones for it.
  vi.spyOn(backend.ctx.rpc, 'broadcast').mockImplementation(((request: {
    method: string;
    args: unknown[];
  }) => {
    if (request.method === 'pangular:plugin-action')
      handlers.get('plugin-action')?.(request.args[0]);
  }) as never);
  return { collector, pushes, handlers, calls };
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.restoreAllMocks();
});

describe('the example plugin package', () => {
  it('registers its page plugin through the public registry and removes it again', () => {
    const unregister = registerFlagsPangularPlugin(store());
    expect(pangularPluginRegistry().plugins.map((plugin) => plugin.id)).toEqual([FLAGS_PLUGIN_ID]);
    unregister();
    expect(pangularPluginRegistry().plugins).toEqual([]);
  });

  it('describes the flags as a view the panel can render', () => {
    const flags = store();
    expect(flagsView(flags)).toMatchObject({
      summary: '2 flags, 1 on, 0 overridden',
      badges: [],
      actions: [],
    });
    flags.set('promo-banner', true);
    const view = flagsView(flags);
    expect(view.summary).toBe('2 flags, 2 on, 1 overridden');
    expect(view.sections.map((section) => section.kind)).toEqual(['stats', 'table']);
    expect(view.actions).toEqual([expect.objectContaining({ name: 'reset' })]);
    // Setting a flag back to its default is no override.
    flags.set('promo-banner', false);
    expect(flagsView(flags).summary).toBe('2 flags, 1 on, 0 overridden');
  });

  it("reports the store's tab from the page, with the page id, and pushes each change", async () => {
    const backend = await server();
    const flags = store();
    cleanups.push(registerFlagsPangularPlugin(flags));
    const { collector, pushes } = page('tab1', backend);
    await collector.push(true);
    expect(pushes[0]).toMatchObject({
      pageId: 'tab1',
      plugins: [
        {
          id: 'feature-flags',
          version: '1.0.0',
          title: 'Feature flags',
          status: 'running',
          actions: ['set', 'reset'],
        },
      ],
    });
    expect((await backend.state()).pages['tab1']).toBeDefined();

    // The store changes outside Angular; the plugin pushes on its own.
    flags.set('promo-banner', true);
    await vi.waitFor(() =>
      expect(pushes.at(-1)?.plugins[0]?.view?.summary).toBe('2 flags, 2 on, 1 overridden'),
    );
  });

  it('adds read and action tools under its own namespace', async () => {
    const backend = await server();
    const ids = backend.ctx.agent
      .list()
      .tools.filter((tool) => tool.id.startsWith('pangular:plugin:'))
      .map((tool) => [tool.id, tool.safety]);
    expect(ids).toEqual([
      ['pangular:plugin:feature-flags:flags', 'read'],
      ['pangular:plugin:feature-flags:set', 'action'],
    ]);
    const readOnly = await server({ agent: { readOnly: true } });
    expect(
      readOnly.ctx.agent
        .list()
        .tools.map((tool) => tool.id)
        .filter((id) => id.startsWith('pangular:plugin:')),
    ).toEqual(['pangular:plugin:feature-flags:flags']);
  });

  it('answers the read tool from the page report, and says so when no page runs it', async () => {
    const backend = await server();
    expect(await backend.invoke('pangular:plugin:feature-flags:flags')).toContain(
      'No page runs the feature flag store',
    );
    cleanups.push(registerFlagsPangularPlugin(store()));
    const { collector } = page('tab1', backend);
    await collector.push(true);
    const text = await backend.invoke('pangular:plugin:feature-flags:flags');
    expect(text).toContain('This answer comes from the feature-flags plugin');
    expect(text).toContain('| promo-banner | off | off | Shows the promo banner. |');
  });

  it('turns a flag on from an agent tool through the page action', async () => {
    const backend = await server();
    const flags = store();
    cleanups.push(registerFlagsPangularPlugin(flags));
    const { collector } = page('tab1', backend);
    await collector.push(true);
    const answer = await backend.invoke('pangular:plugin:feature-flags:set', {
      name: 'promo-banner',
      value: true,
    });
    expect(answer).toContain('Turned `promo-banner` on on page `tab1`.');
    expect(flags.enabled('promo-banner')).toBe(true);
    const unknown = await backend.invoke('pangular:plugin:feature-flags:set', {
      name: 'nope',
      value: true,
    });
    expect(unknown).toContain('There is no flag nope.');
  });

  it('keeps the page action from running while actions are off', async () => {
    const config: PangularConfig = { plugins: { 'feature-flags': { actions: false } } };
    const backend = await server(config);
    const flags = store();
    cleanups.push(registerFlagsPangularPlugin(flags));
    const { collector, handlers, calls } = page('tab1', backend, config);
    await collector.push(true);
    handlers.get('plugin-action')?.({
      requestId: 'r1',
      pageId: 'tab1',
      pluginId: 'feature-flags',
      action: 'set',
      args: { name: 'promo-banner', value: true },
    });
    await vi.waitFor(() =>
      expect(calls.find((call) => call.name === 'plugin-action-result')?.payload).toMatchObject({
        requestId: 'r1',
        result: {
          ok: false,
          error: 'Actions of the feature-flags plugin are turned off in the devtools config.',
        },
      }),
    );
    expect(flags.enabled('promo-banner')).toBe(false);
    expect(
      backend.ctx.agent
        .list()
        .tools.map((tool) => tool.id)
        .filter((id) => id.startsWith('pangular:plugin:')),
    ).toEqual(['pangular:plugin:feature-flags:flags']);
  });
});
