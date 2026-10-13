// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolvePangularConfig } from '../config.ts';
import { setRedaction } from '../forms-privacy.ts';
import {
  PANGULAR_PLUGIN_API_VERSION,
  pangularPluginRegistry,
  registerPangularPlugin,
  type PangularPagePlugin,
  type PangularPluginContext,
} from '../plugin.ts';
import { attachPlugins, type PluginsReport } from '../plugins-collector.ts';
import {
  travelPlugin,
  type TravelBooking,
  type TravelSource,
} from '../../../../src/app/devtools/travel-plugin.ts';

const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');

type Handler = (...args: any[]) => unknown;

function fakeRpc() {
  const calls: { name: string; args: unknown[] }[] = [];
  const handlers = new Map<string, Handler>();
  return {
    calls,
    handlers,
    pushes: () =>
      calls
        .filter((call) => call.name === 'push-plugins')
        .map((call) => call.args[0] as PluginsReport),
    my: {
      rpc: {
        call: async (name: string, ...args: unknown[]) => {
          calls.push({ name, args });
          return undefined;
        },
        register: (definition: { name: string; handler: Handler }) => {
          handlers.set(definition.name, definition.handler);
        },
      },
    },
  };
}

const wait = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

function travelSource(extra: Partial<TravelSource> = {}) {
  const bookings: TravelBooking[] = [
    {
      id: 'TRV-1041',
      destinationName: 'Kyoto',
      startDate: '2026-11-02',
      travelers: 2,
      total: 3120,
      email: 'ada@example.com',
    },
  ];
  const saved = ['kyoto', 'lisbon'];
  return {
    saved,
    source: {
      bookings: () => bookings,
      saved: () => saved,
      recentQueries: () => ['beach'],
      filters: () => ({ query: '', region: 'Asia', sort: 'popular' }),
      unsaveAll: () => saved.splice(0),
      ...extra,
    } satisfies TravelSource,
  };
}

const config = resolvePangularConfig();
let cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  setRedaction({});
});

function attach(
  target: object,
  options: {
    active?: () => boolean;
    tickMs?: () => number;
    now?: () => number;
    config?: unknown;
  } = {},
) {
  const rpc = fakeRpc();
  const fakeNg = { getComponent: () => null };
  const collector = attachPlugins(rpc.my, 'tab1', () => fakeNg, {
    config: resolvePangularConfig(options.config ?? {}),
    target,
    active: options.active,
    tickMs: options.tickMs,
    now: options.now,
  });
  cleanups.push(() => collector.stop());
  return { rpc, collector, fakeNg };
}

describe('the plugins collector', () => {
  it('runs the example travel plugin and pushes its view with the page id', async () => {
    const target = {};
    pangularPluginRegistry(target).plugins.push(travelPlugin(travelSource().source));
    const { rpc, collector } = attach(target);
    await collector.push(true);
    const [report] = rpc.pushes();
    expect(report.pageId).toBe('tab1');
    expect(report.plugins).toHaveLength(1);
    const [entry] = report.plugins;
    expect(entry).toMatchObject({
      id: 'travel',
      version: '1.0.0',
      title: 'Travel store',
      status: 'running',
      apiVersion: 1,
      actions: ['unsave-all'],
    });
    expect(entry.view?.summary).toBe('1 booking, 2 saved destinations');
    expect(entry.view?.sections.map((section) => section.kind)).toEqual([
      'stats',
      'table',
      'list',
      'tree',
    ]);
    expect(entry.view?.actions).toEqual([
      expect.objectContaining({ name: 'unsave-all', label: 'Clear saved destinations' }),
    ]);
  });

  it('hands the plugin a context with the page id, the debug API and the helpers', async () => {
    const target = {};
    let seen: PangularPluginContext | undefined;
    pangularPluginRegistry(target).plugins.push({
      id: 'probe',
      version: '0.1.0',
      setup: (ctx) => {
        seen = ctx;
      },
    });
    const { fakeNg } = attach(target);
    expect(seen?.pageId).toBe('tab1');
    expect(seen?.apiVersion).toBe(PANGULAR_PLUGIN_API_VERSION);
    expect(seen?.getNg()).toBe(fakeNg);
    expect(seen?.active).toBe(true);
    expect(seen?.isSecretName('password')).toBe(true);
    expect(seen?.redact(`token ${JWT}`)).not.toContain(JWT);
    expect(seen?.serialize({ apiKey: 'abc', ok: 1 })).toEqual({ apiKey: '[redacted]', ok: 1 });
  });

  it('masks secret names, extra secret names and JWTs in a view', async () => {
    setRedaction({ secretNames: ['passport'] });
    const target = {};
    pangularPluginRegistry(target).plugins.push({
      id: 'secrets',
      version: '1',
      collect: () => ({
        sections: [
          {
            kind: 'tree',
            title: 'User',
            value: { password: 'hunter2', passportNumber: 'X123', name: 'Ada' },
          },
          {
            kind: 'table',
            title: 'Tokens',
            columns: [{ key: 'value', label: 'Value' }],
            rows: [{ value: `Bearer ${JWT}` }],
          },
        ],
      }),
    });
    const { rpc, collector } = attach(target);
    await collector.push(true);
    const json = JSON.stringify(rpc.pushes()[0]);
    expect(json).not.toContain('hunter2');
    expect(json).not.toContain('X123');
    expect(json).not.toContain(JWT);
    expect(json).toContain('Ada');
  });

  it('skips an unchanged report and sends it again when the keepalive is due', async () => {
    const target = {};
    pangularPluginRegistry(target).plugins.push(travelPlugin(travelSource().source));
    let now = 1000;
    const { rpc, collector } = attach(target, { now: () => now, tickMs: () => 1000 });
    await collector.push(true);
    await collector.push();
    expect(rpc.pushes()).toHaveLength(1);
    now += 7500;
    await collector.push();
    expect(rpc.pushes()).toHaveLength(2);
  });

  it('collects only while someone watches, and keeps the page alive meanwhile', async () => {
    const target = {};
    let collects = 0;
    pangularPluginRegistry(target).plugins.push({
      id: 'counter',
      version: '1',
      collect: () => {
        collects++;
        return { sections: [{ kind: 'text', title: 'Count', text: String(collects) }] };
      },
    });
    let watching = false;
    let now = 1000;
    const { rpc, collector } = attach(target, {
      active: () => watching,
      now: () => now,
      tickMs: () => 1000,
    });
    // The first report goes out in full either way.
    await collector.push(true);
    expect(collects).toBe(1);
    await collector.push();
    expect(collects).toBe(1);
    expect(rpc.pushes()).toHaveLength(1);
    now += 7500;
    await collector.push();
    expect(collects).toBe(1);
    expect(rpc.pushes()).toHaveLength(2);
    watching = true;
    await collector.push();
    expect(collects).toBe(2);
  });

  it('runs no plugin the config turns off', async () => {
    const target = {};
    let started = 0;
    pangularPluginRegistry(target).plugins.push(
      { id: 'travel', version: '1', setup: () => void started++ },
      { id: 'other', version: '1', setup: () => void started++ },
    );
    const { rpc, collector } = attach(target, { config: { plugins: { travel: false } } });
    await collector.push(true);
    expect(started).toBe(1);
    expect(rpc.pushes()[0].plugins.map((plugin) => plugin.id)).toEqual(['other']);
  });

  it('reports a plugin that needs a later API or that throws, without stopping the others', async () => {
    const target = {};
    pangularPluginRegistry(target).plugins.push(
      {
        id: 'future',
        version: '9',
        apiVersion: PANGULAR_PLUGIN_API_VERSION + 1,
        collect: () => ({ sections: [] }),
      },
      {
        id: 'broken',
        version: '1',
        collect: () => {
          throw new Error(`bad token ${JWT}`);
        },
      },
      travelPlugin(travelSource().source),
    );
    const { rpc, collector } = attach(target);
    await collector.push(true);
    const [future, broken, travel] = rpc.pushes()[0].plugins;
    expect(future).toMatchObject({ status: 'unsupported', view: null });
    expect(future.error).toMatch(/plugin API 2/);
    expect(broken.status).toBe('error');
    expect(broken.error).toMatch(/bad token/);
    expect(broken.error).not.toContain(JWT);
    expect(travel.status).toBe('running');
  });

  it('follows the registry: a plugin registered later reports, an unregistered one is forgotten', async () => {
    const { rpc } = attach(globalThis);
    const unregister = registerPangularPlugin(travelPlugin(travelSource().source));
    cleanups.push(unregister);
    await wait();
    expect(
      rpc
        .pushes()
        .at(-1)
        ?.plugins.map((plugin) => plugin.id),
    ).toEqual(['travel']);
    unregister();
    await wait();
    expect(rpc.calls.at(-1)).toEqual({ name: 'forget-plugins-page', args: ['tab1'] });
  });

  it('refuses a plugin id that is not lowercase letters, digits and dashes', () => {
    expect(() => registerPangularPlugin({ id: 'Bad Id', version: '1' })).toThrow(/plugin id/);
  });

  it('sends a view a plugin pushes on its own, once', async () => {
    const target = {};
    let ctx: PangularPluginContext | undefined;
    pangularPluginRegistry(target).plugins.push({
      id: 'pusher',
      version: '1',
      setup: (context) => {
        ctx = context;
      },
    } satisfies PangularPagePlugin);
    const { rpc } = attach(target);
    await wait();
    const before = rpc.pushes().length;
    ctx!.push({ sections: [{ kind: 'text', title: 'Event', text: 'one' }] });
    ctx!.push({ sections: [{ kind: 'text', title: 'Event', text: 'two' }] });
    await wait();
    expect(rpc.pushes()).toHaveLength(before + 1);
    expect(rpc.pushes().at(-1)?.plugins[0].view?.sections[0]).toEqual({
      kind: 'text',
      title: 'Event',
      text: 'two',
    });
  });

  it('runs a page action for its own page and answers with the result', async () => {
    const target = {};
    const { source, saved } = travelSource();
    pangularPluginRegistry(target).plugins.push(travelPlugin(source));
    const { rpc } = attach(target);
    const run = rpc.handlers.get('plugin-action')!;
    run({ requestId: 'r0', pageId: 'other-tab', pluginId: 'travel', action: 'unsave-all' });
    run({ requestId: 'r1', pageId: 'tab1', pluginId: 'travel', action: 'unsave-all' });
    await wait();
    expect(saved).toEqual([]);
    const answers = rpc.calls.filter((call) => call.name === 'plugin-action-result');
    expect(answers).toEqual([
      {
        name: 'plugin-action-result',
        args: [{ requestId: 'r1', pageId: 'tab1', result: { ok: true, result: { removed: 2 } } }],
      },
    ]);
  });

  it('refuses an unknown action and every action while actions are off', async () => {
    const target = {};
    const { source, saved } = travelSource();
    pangularPluginRegistry(target).plugins.push(travelPlugin(source));
    const open = attach(target);
    open.rpc.handlers.get('plugin-action')!({
      requestId: 'r1',
      pageId: 'tab1',
      pluginId: 'travel',
      action: 'toString',
    });
    const blocked = attach(target, { config: { actions: false } });
    blocked.rpc.handlers.get('plugin-action')!({
      requestId: 'r2',
      pageId: 'tab1',
      pluginId: 'travel',
      action: 'unsave-all',
    });
    await wait();
    expect(saved).toHaveLength(2);
    const result = (rpc: ReturnType<typeof fakeRpc>) =>
      (
        rpc.calls.find((call) => call.name === 'plugin-action-result')?.args[0] as {
          result: { ok: boolean; error: string };
        }
      ).result;
    expect(result(open.rpc)).toEqual({
      ok: false,
      error: 'The travel plugin has no action toString.',
    });
    expect(result(blocked.rpc).error).toMatch(/turned off/);
  });

  it('asks the server to forget the page when it leaves', async () => {
    const target = {};
    pangularPluginRegistry(target).plugins.push(travelPlugin(travelSource().source));
    const { rpc, collector } = attach(target);
    await collector.push(true);
    collector.leave();
    expect(rpc.calls.at(-1)).toEqual({ name: 'forget-plugins-page', args: ['tab1'] });
    await collector.push(true);
    expect(rpc.pushes()).toHaveLength(1);
    collector.resume();
    await wait();
    expect(rpc.pushes()).toHaveLength(2);
  });

  it('offers no actions for a plugin it cannot run, and refuses to run one', async () => {
    const target = {};
    let ran = 0;
    pangularPluginRegistry(target).plugins.push({
      id: 'future',
      version: '9',
      apiVersion: PANGULAR_PLUGIN_API_VERSION + 1,
      actions: { reset: () => void ran++ },
    });
    const { rpc, collector } = attach(target);
    await collector.push(true);
    expect(rpc.pushes()[0].plugins[0]).toMatchObject({ status: 'unsupported', actions: [] });
    rpc.handlers.get('plugin-action')!({
      requestId: 'r1',
      pageId: 'tab1',
      pluginId: 'future',
      action: 'reset',
    });
    await wait();
    expect(ran).toBe(0);
    const answer = rpc.calls.find((call) => call.name === 'plugin-action-result')?.args[0] as {
      result: { ok: boolean; error: string };
    };
    expect(answer.result).toEqual({
      ok: false,
      error:
        "This version of Pangular Inspector can't run the future plugin, so it runs none of its actions.",
    });
  });

  it('skips registry entries that are not plugins or that throw, and runs the rest', async () => {
    const target = {};
    const hostile = {
      get id(): string {
        throw new Error('no id');
      },
      version: '1',
    };
    pangularPluginRegistry(target).plugins.push(
      null as unknown as PangularPagePlugin,
      'travel' as unknown as PangularPagePlugin,
      hostile as unknown as PangularPagePlugin,
      { id: 7, version: '1' } as unknown as PangularPagePlugin,
      travelPlugin(travelSource().source),
    );
    let attached: ReturnType<typeof attach> | undefined;
    expect(() => {
      attached = attach(target);
    }).not.toThrow();
    await attached!.collector.push(true);
    expect(attached!.rpc.pushes()[0].plugins.map((plugin) => plugin.id)).toEqual(['travel']);
  });

  it('keeps a forced push that comes while a plugin push waits', async () => {
    const target = {};
    let ctx: PangularPluginContext | undefined;
    const registry = pangularPluginRegistry(target);
    registry.plugins.push({
      id: 'pusher',
      version: '1',
      setup: (context) => {
        ctx = context;
      },
    });
    // Nobody watches and the keepalive is not due, so only a forced push is sent.
    const { rpc } = attach(target, { active: () => false, now: () => 1000, tickMs: () => 0 });
    await wait();
    const before = rpc.pushes().length;
    ctx!.push({ sections: [{ kind: 'text', title: 'Event', text: 'one' }] });
    registry.plugins.push({ id: 'later', version: '1' });
    for (const listener of registry.listeners) listener();
    await wait();
    expect(rpc.pushes()).toHaveLength(before + 1);
    expect(
      rpc
        .pushes()
        .at(-1)
        ?.plugins.map((plugin) => plugin.id),
    ).toEqual(['pusher', 'later']);
  });

  it('paces collects a plugin asks for to one a second', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    try {
      const target = {};
      let collects = 0;
      let ctx: PangularPluginContext | undefined;
      pangularPluginRegistry(target).plugins.push({
        id: 'counter',
        version: '1',
        setup: (context) => {
          ctx = context;
        },
        collect: () => {
          collects++;
          return { sections: [{ kind: 'text', title: 'Count', text: String(collects) }] };
        },
      });
      const { collector } = attach(target, { now: () => Date.now() });
      // The first report collects right away.
      await vi.advanceTimersByTimeAsync(60);
      expect(collects).toBe(1);
      ctx!.refresh();
      ctx!.refresh();
      await collector.push();
      await vi.advanceTimersByTimeAsync(500);
      expect(collects).toBe(1);
      await vi.advanceTimersByTimeAsync(600);
      expect(collects).toBe(2);
      // A forced push, as when a panel starts watching, does not wait.
      await collector.push(true);
      expect(collects).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up on an action after the timeout the server sent', async () => {
    const target = {};
    pangularPluginRegistry(target).plugins.push({
      id: 'slow',
      version: '1',
      actions: { wait: () => new Promise(() => {}) },
    });
    const { rpc } = attach(target);
    rpc.handlers.get('plugin-action')!({
      requestId: 'r1',
      pageId: 'tab1',
      pluginId: 'slow',
      action: 'wait',
      timeoutMs: 120,
    });
    await wait(250);
    const answer = rpc.calls.find((call) => call.name === 'plugin-action-result')?.args[0] as {
      result: { ok: boolean; error: string };
    };
    expect(answer.result).toEqual({
      ok: false,
      error: 'Error: The action did not finish in time.',
    });
  });

  it('warns about and drops an action whose name the server would refuse', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const plugin: PangularPagePlugin = {
        id: 'travel',
        version: '1',
        actions: { 'unsave-all': () => 1, 'Drop DB': () => 2 },
      };
      cleanups.push(registerPangularPlugin(plugin));
      const [stored] = pangularPluginRegistry().plugins.filter((each) => each.id === 'travel');
      expect(Object.keys(stored!.actions!)).toEqual(['unsave-all']);
      expect(stored!.version).toBe('1');
      expect(Object.keys(plugin.actions!)).toEqual(['unsave-all', 'Drop DB']);
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[pangular\] A plugin action name is lowercase.*"Drop DB" was dropped/,
        ),
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('cleans up each plugin when it stops', () => {
    const target = {};
    let cleaned = 0;
    pangularPluginRegistry(target).plugins.push({
      id: 'tidy',
      version: '1',
      setup: () => () => void cleaned++,
    });
    const { collector } = attach(target);
    collector.stop();
    collector.stop();
    expect(cleaned).toBe(1);
    expect(pangularPluginRegistry(target).listeners.size).toBe(0);
  });
});
