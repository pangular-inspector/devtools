// The page side of Pangular plugins: runs the page plugins a library
// registered (`plugin.ts`) and pushes their views as one report per page.
//
// Each plugin gets a context with the page id, the debug API, the redaction
// helpers and the activity lease. Its views go through `serialize()` and
// `sanitizePluginView()` before they leave the page, unchanged reports are
// skipped, and a keepalive keeps the page from expiring on the server.

import { keepaliveDue } from './change-detection.ts';
import { pluginSwitches, type ResolvedPangularConfig } from './config.ts';
import {
  PANGULAR_PLUGIN_API_VERSION,
  pangularPluginRegistry,
  type PangularPagePlugin,
  type PangularPluginContext,
  type PluginSerializeLimits,
} from './plugin.ts';
import {
  PLUGIN_VIEW_SERIALIZE,
  sanitizePluginView,
  type PluginStatus,
  type PluginView,
} from './plugin-view.ts';
import { redactMessage, redactUrl } from './router.ts';
import { isSecretName, redactText, serialize } from './serialize.ts';

interface Rpc {
  rpc: {
    call(name: string, ...args: unknown[]): Promise<unknown>;
    register(definition: {
      name: string;
      type: 'event';
      jsonSerializable: boolean;
      handler: (...args: any[]) => unknown;
    }): void;
  };
}

/** How long a page action may run before the page answers with a timeout. */
export const PLUGIN_ACTION_TIMEOUT_MS = 10_000;
/** A `push` or `refresh` from a plugin is sent after this pause, so a burst sends once. */
const SOON_MS = 50;

/** One plugin in a page report. */
export interface PluginReportEntry {
  id: string;
  version: string;
  title: string;
  description?: string;
  apiVersion: number;
  status: PluginStatus;
  /** Why the plugin failed or was not run, masked. */
  error?: string;
  view: PluginView | null;
  /** The names of its page actions. */
  actions: string[];
}

/** What a page pushes as `push-plugins`. */
export interface PluginsReport {
  pageId: string;
  url?: string;
  title?: string;
  plugins: PluginReportEntry[];
}

interface Running {
  plugin: PangularPagePlugin;
  ctx: PangularPluginContext;
  cleanup?: () => void;
  status: PluginStatus;
  error?: string;
  view: PluginView | null;
}

export interface PluginsOptions {
  config: ResolvedPangularConfig;
  /** Whether a panel or an agent watches (`page-lease.ts`). */
  active?: () => boolean;
  tickMs?: () => number;
  /** Where the registry lives; the global object by default. */
  target?: object;
  now?: () => number;
}

export interface PluginsCollector {
  /** Collects (while someone watches) and sends the report when it changed. */
  push(force?: boolean): Promise<void>;
  /** The page is going away: the server forgets its plugins. */
  leave(): void;
  resume(): void;
  stop(): void;
  /** The current report, for tests. */
  report(): PluginsReport;
}

function message(error: unknown): string {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return redactMessage(text).slice(0, 300);
}

function plainView(value: unknown): PluginView | null {
  return sanitizePluginView(serialize(value, PLUGIN_VIEW_SERIALIZE));
}

/** Starts the registered page plugins and returns their collector. */
export function attachPlugins(
  my: Rpc,
  pageId: string,
  getNg: () => unknown,
  options: PluginsOptions,
): PluginsCollector {
  const active = options.active ?? (() => true);
  const tickMs = options.tickMs ?? (() => 0);
  const now = options.now ?? Date.now;
  const registry = pangularPluginRegistry(options.target);
  const running = new Map<string, Running>();
  let lastJson = '';
  let sentAt = 0;
  let reported = false;
  let left = false;
  let stopped = false;
  let soon: ReturnType<typeof setTimeout> | undefined;
  let queue = Promise.resolve();

  const schedule = (force = false) => {
    if (stopped || soon) return;
    soon = setTimeout(() => {
      soon = undefined;
      void push(force).catch(() => {});
    }, SOON_MS);
  };

  const contextFor = (plugin: PangularPagePlugin): PangularPluginContext => ({
    apiVersion: PANGULAR_PLUGIN_API_VERSION,
    pageId,
    get active() {
      return active();
    },
    getNg: () => {
      const ng = getNg();
      return ng && typeof ng === 'object' ? (ng as Record<string, unknown>) : undefined;
    },
    push: (view: PluginView) => {
      const entry = running.get(plugin.id);
      if (!entry || entry.plugin !== plugin || entry.status === 'unsupported') return;
      try {
        entry.view = plainView(view);
        entry.status = 'running';
        delete entry.error;
      } catch (error) {
        entry.status = 'error';
        entry.error = message(error);
      }
      schedule();
    },
    refresh: () => schedule(),
    serialize: (value: unknown, limits?: PluginSerializeLimits) => serialize(value, limits),
    redact: (text: string) => redactText(String(text)),
    isSecretName: (name: string) => isSecretName(name),
  });

  const start = (plugin: PangularPagePlugin) => {
    const ctx = contextFor(plugin);
    const apiVersion = typeof plugin.apiVersion === 'number' ? plugin.apiVersion : 1;
    const entry: Running = { plugin, ctx, status: 'running', view: null };
    running.set(plugin.id, entry);
    if (apiVersion > PANGULAR_PLUGIN_API_VERSION) {
      entry.status = 'unsupported';
      entry.error = `It needs plugin API ${apiVersion}; this version of Pangular Inspector runs ${PANGULAR_PLUGIN_API_VERSION}. Update @pangular-inspector/devtools.`;
      return;
    }
    try {
      const cleanup = plugin.setup?.(ctx);
      if (typeof cleanup === 'function') entry.cleanup = cleanup;
    } catch (error) {
      entry.status = 'error';
      entry.error = message(error);
    }
  };

  const end = (entry: Running) => {
    try {
      entry.cleanup?.();
    } catch {
      // A plugin's cleanup failing must not stop the others.
    }
  };

  /** Starts new plugins and ends removed or replaced ones. */
  const sync = () => {
    if (stopped) return;
    const wanted = registry.plugins.filter(
      (plugin) => pluginSwitches(plugin.id, options.config).enabled,
    );
    for (const [id, entry] of running) {
      if (!wanted.includes(entry.plugin)) {
        end(entry);
        running.delete(id);
      }
    }
    for (const plugin of wanted) {
      if (running.get(plugin.id)?.plugin !== plugin) start(plugin);
    }
    schedule(true);
  };
  registry.listeners.add(sync);
  sync();

  const collect = () => {
    for (const entry of running.values()) {
      if (entry.status === 'unsupported' || !entry.plugin.collect) continue;
      try {
        const view = entry.plugin.collect(entry.ctx);
        if (view !== undefined) entry.view = view === null ? null : plainView(view);
        entry.status = 'running';
        delete entry.error;
      } catch (error) {
        entry.status = 'error';
        entry.error = message(error);
      }
    }
  };

  const report = (): PluginsReport => ({
    pageId,
    ...(typeof location === 'undefined' ? {} : { url: redactUrl(location.href) }),
    ...(typeof document === 'undefined' ? {} : { title: redactMessage(document.title) }),
    plugins: [...running.values()].map(({ plugin, status, error, view }) => ({
      id: plugin.id,
      version: String(plugin.version ?? '').slice(0, 40),
      title: redactMessage(String(plugin.title ?? plugin.id)).slice(0, 80),
      ...(plugin.description
        ? { description: redactMessage(String(plugin.description)).slice(0, 300) }
        : {}),
      apiVersion: typeof plugin.apiVersion === 'number' ? plugin.apiVersion : 1,
      status,
      ...(error ? { error } : {}),
      view,
      actions: Object.keys(plugin.actions ?? {}).slice(0, 20),
    })),
  });

  const send = async (force: boolean) => {
    if (stopped || left) return;
    // An idle page only says it is there (`page-lease.ts`); a wake sends everything.
    const idle = !force && !active();
    if (!idle) collect();
    const next = report();
    if (!next.plugins.length) {
      // The last plugin was removed: the server drops the page instead of keeping an empty one.
      if (reported) {
        reported = false;
        lastJson = '';
        await my.rpc.call('forget-plugins-page', pageId);
      }
      return;
    }
    const json = JSON.stringify(next);
    const due = keepaliveDue(sentAt, tickMs(), now());
    if (!force && (idle || json === lastJson) && !due) return;
    lastJson = json;
    sentAt = now();
    reported = true;
    try {
      await my.rpc.call('push-plugins', next);
    } catch (error) {
      lastJson = '';
      throw error;
    }
  };

  const push = (force = false) => {
    const run = queue.then(() => send(force));
    queue = run.catch(() => {});
    return run;
  };

  my.rpc.register({
    name: 'plugin-action',
    type: 'event',
    jsonSerializable: true,
    handler: (request: {
      requestId?: unknown;
      pageId?: unknown;
      pluginId?: unknown;
      action?: unknown;
      args?: unknown;
    }) => {
      if (stopped || !request || request.pageId !== pageId) return;
      if (typeof request.requestId !== 'string') return;
      const requestId = request.requestId;
      const respond = (result: { ok: boolean; result?: unknown; error?: string }) =>
        void my.rpc.call('plugin-action-result', { requestId, pageId, result }).catch(() => {});
      const entry =
        typeof request.pluginId === 'string' ? running.get(request.pluginId) : undefined;
      if (!entry) return respond({ ok: false, error: 'This page does not run that plugin.' });
      if (!pluginSwitches(entry.plugin.id, options.config).actions) {
        return respond({
          ok: false,
          error: `Actions of the ${entry.plugin.id} plugin are turned off in the devtools config.`,
        });
      }
      const name = typeof request.action === 'string' ? request.action : '';
      const action = Object.prototype.hasOwnProperty.call(entry.plugin.actions ?? {}, name)
        ? entry.plugin.actions![name]
        : undefined;
      if (typeof action !== 'function') {
        return respond({
          ok: false,
          error: `The ${entry.plugin.id} plugin has no action ${name}.`,
        });
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('The action did not finish in time.')),
          PLUGIN_ACTION_TIMEOUT_MS,
        );
      });
      Promise.race([Promise.resolve().then(() => action(request.args, entry.ctx)), timeout])
        .then(
          (result) =>
            respond({
              ok: true,
              ...(result === undefined ? {} : { result: serialize(result, { budget: 2000 }) }),
            }),
          (error: unknown) => respond({ ok: false, error: message(error) }),
        )
        .finally(() => {
          clearTimeout(timer);
          schedule(true);
        });
    },
  });

  return {
    push,
    leave() {
      if (left) return;
      left = true;
      clearTimeout(soon);
      soon = undefined;
      lastJson = '';
      if (reported) void my.rpc.call('forget-plugins-page', pageId).catch(() => {});
      reported = false;
    },
    resume() {
      left = false;
      lastJson = '';
      schedule(true);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      clearTimeout(soon);
      registry.listeners.delete(sync);
      for (const entry of running.values()) end(entry);
      running.clear();
    },
    report,
  };
}
